import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { textContent, toolError } from '../../domain/entity.js';
import { whiteboardElementSchema, type State, type WhiteboardElement } from '../../../projects/domain/state.js';
import { embedGroupingHints } from '../../../projects/domain/sanitize-svg.js';
import { EMBED_EXAMPLE_GROUPED, EMBED_GUIDE } from './whiteboard-embed-guide.js';
import { findDanglingRefs } from '../../../projects/domain/whiteboard-refs.js';
import { CONTRAST_GUIDE, MIN_LABEL_CONTRAST, isLowContrastLabel } from '../../../projects/domain/color-contrast.js';
import { loadState } from '../state-db.js';

const ELEMENTS_DESCRIPTION =
  'Elements to validate (max 1000). Same schema as create_whiteboard. Each element: { id?, kind: "stroke"|"sticky"|"text"|"shape"|"edge"|"boundary"|"ref"|"embed", ...fields }. ' +
  EMBED_GUIDE +
  ' Examples: { kind: "sticky", x: 0, y: 0, w: 200, h: 120, color: "#e8b955", text: "note" }, ' +
  '{ kind: "text", x: 0, y: 0, color: "#374151", fontSize: 16, text: "title" }, ' +
  '{ kind: "shape", shapeType: "rect", x: 0, y: 0, w: 120, h: 80, color: "#2563eb", fill: "none", strokeWidth: 2, label: "" }, ' +
  '{ kind: "boundary", x: 0, y: 0, w: 300, h: 200, color: "#2563eb", label: "" }, ' +
  EMBED_EXAMPLE_GROUPED + ' ' + CONTRAST_GUIDE;

const inputSchema = z.object({
  projectId: z.string().uuid().describe('UUID of the project to validate against (for future ref-data expansion)'),
  elements: z
    .array(z.record(z.string().max(100), z.unknown()))
    .max(1000)
    .describe(ELEMENTS_DESCRIPTION),
});

interface Rect { x: number; y: number; w: number; h: number; }

// Mirror server validate-whiteboard elementBounds but with expanded ref estimate
const REF_COLLAPSED_W = 180;
const REF_COLLAPSED_H = 44;
const REF_EXPANDED_W = 260;
const REF_EXPANDED_H = 150; // worst-case expanded (title+meta+desc). Frontend refCardLayout height ~120-180

function elementBounds(el: WhiteboardElement, expandedRef = true): Rect | null {
  switch (el.kind) {
    case 'sticky':
    case 'shape':
    case 'boundary':
      return { x: (el as any).x, y: (el as any).y, w: (el as any).w, h: (el as any).h };
    case 'text': {
      const fontSize = (el as any).fontSize ?? 16;
      const text = (el as any).text ?? '';
      const w = Math.max(40, text.length * fontSize * 0.62);
      const h = fontSize + 4;
      return { x: (el as any).x, y: (el as any).y - fontSize, w, h };
    }
    case 'edge': {
      const x1 = (el as any).x1 ?? 0; const y1 = (el as any).y1 ?? 0;
      const x2 = (el as any).x2 ?? 0; const y2 = (el as any).y2 ?? 0;
      return { x: Math.min(x1, x2), y: Math.min(y1, y2), w: Math.abs(x2 - x1) || 1, h: Math.abs(y2 - y1) || 1 };
    }
    case 'ref':
      return expandedRef
        ? { x: (el as any).x, y: (el as any).y, w: REF_EXPANDED_W, h: REF_EXPANDED_H }
        : { x: (el as any).x, y: (el as any).y, w: REF_COLLAPSED_W, h: REF_COLLAPSED_H };
    case 'stroke': {
      const pts = (el as any).points ?? [];
      if (pts.length === 0) return null;
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const [px, py] of pts) { minX = Math.min(minX, px); minY = Math.min(minY, py); maxX = Math.max(maxX, px); maxY = Math.max(maxY, py); }
      const pad = ((el as any).width ?? 2) / 2 + 2;
      return { x: minX - pad, y: minY - pad, w: maxX - minX + pad * 2, h: maxY - minY + pad * 2 };
    }
    default: return null;
  }
}

function rectsIntersect(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function gapBetween(a: Rect, b: Rect): number {
  const dx = Math.max(0, Math.max(a.x - (b.x + b.w), b.x - (a.x + a.w)));
  const dy = Math.max(0, Math.max(a.y - (b.y + b.h), b.y - (a.y + a.h)));
  return Math.hypot(dx, dy);
}

function distToSegment(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax, dy = by - ay;
  if (dx === 0 && dy === 0) return Math.hypot(px - ax, py - ay);
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

const MIN_GAP = 30; // minimal breathing room — "too-close" threshold (was 24 in showcase)
const MIN_GAP_REF = 35; // ref expanded needs more

export function registerValidateWhiteboard(server: McpServer): void {
  server.registerTool(
    'validate_whiteboard',
    {
      title: 'Validate whiteboard layout',
      description:
        'Dry-run validator for whiteboard elements. Checks for overlap, too-close (<30px gap), out-of-bounds, ref-expanded collision, low-contrast labels (<4.5:1 on the always-white canvas), message labels crossing other lifelines, and advisory embed grouping (missing <g data-component>). Also surfaces dangling refs/edges. Use BEFORE create_whiteboard/update_whiteboard/patch_whiteboard to avoid overlap and first-try embed failures. Returns { ok, warnings, overlaps, closePairs, suggestions }. No DB write.',
      inputSchema,
    },
    async (args) => {
      // assign ids if missing for bounds calc
      const withIds = args.elements.map((el: any) => ({ ...el, id: typeof el.id === 'string' ? el.id : `tmp-${Math.random().toString(36).slice(2, 8)}` })) as WhiteboardElement[];
      const parsed = whiteboardElementSchema.array().safeParse(withIds);
      if (!parsed.success) {
        return toolError(
          `Invalid elements: ${parsed.error.issues.slice(0, 5).map((i) => `${i.path.join('.')} (${i.message})`).join('; ')}`,
        );
      }
      const elements = parsed.data;

      const warnings: Array<{ code: string; message: string; a: string; b: string; gap: number; suggestion: string }> = [];      const overlaps: Array<{ a: string; b: string; aKind: string; bKind: string }> = [];

      // Build bounds maps for both collapsed and expanded ref
      const boundsExpanded = new Map<string, Rect>();
      const boundsCollapsed = new Map<string, Rect>();
      for (const el of elements) {
        const be = elementBounds(el, true);
        const bc = elementBounds(el, false);
        if (be) boundsExpanded.set(el.id, be);
        if (bc) boundsCollapsed.set(el.id, bc);
      }

      // Check all pairs
      for (let i = 0; i < elements.length; i++) {
        for (let j = i + 1; j < elements.length; j++) {
          const a = elements[i]!; const b = elements[j]!;
          // skip edge/boundary vs boundary etc. — only check node vs node (sticky/shape/text/ref)
          const isNode = (k: string) => ['sticky', 'shape', 'text', 'ref'].includes(k);
          if (!isNode(a.kind) || !isNode(b.kind)) continue;
          // skip boundary interior? sticky inside boundary is expected (containment), not overlap
          // If either is boundary, skip (boundaries are containers)
          // Actually sticky inside boundary should NOT be considered overlap — boundary is container
          // So skip if one is boundary (already filtered)
          const ra = boundsExpanded.get(a.id)!;
          const rb = boundsExpanded.get(b.id)!;
          if (!ra || !rb) continue;

          // Overlap (expanded worst-case)
          if (rectsIntersect(ra, rb)) {
            overlaps.push({ a: a.id, b: b.id, aKind: a.kind, bKind: b.kind });
            const gap = 0;
            const threshold = a.kind === 'ref' || b.kind === 'ref' ? MIN_GAP_REF : MIN_GAP;
            warnings.push({
              code: 'overlap',
              message: `${a.kind} ${a.id.slice(0, 8)} overlaps ${b.kind} ${b.id.slice(0, 8)} (expanded)`,
              a: a.id, b: b.id, gap,
              suggestion: `Move ${b.kind} by +${threshold + 20}px on x or y. For ref, assume expanded 260×150, need gap ${threshold}px.`,
            });
            continue;
          }

          // Too-close (gap < MIN_GAP)
          const gap = gapBetween(ra, rb);
          const threshold = a.kind === 'ref' || b.kind === 'ref' ? MIN_GAP_REF : MIN_GAP;
          if (gap > 0 && gap < threshold) {
            warnings.push({
              code: 'too_close',
              message: `${a.kind} ${a.id.slice(0, 8)} and ${b.kind} ${b.id.slice(0, 8)} too close ${gap.toFixed(1)}px < ${threshold}px`,
              a: a.id, b: b.id, gap,
              suggestion: `Increase gap to ≥${threshold}px. Move ${b.kind} +${(threshold - gap + 10).toFixed(0)}px away.`,
            });
          }

          // Also check collapsed gap for too-close that only appears when collapsed? Already covered by expanded worst-case
        }
      }

      // Out of bounds check
      for (const el of elements) {
        const nums: number[] = [];
        if ('x' in el) nums.push((el as any).x, (el as any).y);
        if ('w' in el) nums.push((el as any).w, (el as any).h);
        for (const n of nums) {
          if (!Number.isFinite(n) || n < -100000 || n > 100000) {
            warnings.push({ code: 'oob', message: `Element ${el.id} out of bounds`, a: el.id, b: '', gap: 0, suggestion: 'Clamp coords to -100000..100000' });
          }
        }
      }

      // Kontrak grouping: ajari agen yang embed-nya belum dikelompokkan.
      // Advisory (tidak memblokir create/update) — embed tetap bebas showcase.
      for (const hint of embedGroupingHints(elements)) {
        warnings.push({
          code: 'grouping',
          message: hint.message,
          a: hint.elementId,
          b: '',
          gap: 0,
          suggestion: 'Wrap each widget in <g data-component="name">, e.g. <g data-component="submit">...</g>.',
        });
      }

      // Dangling references (advisory): ref targets missing from state,
      // edge endpoints missing from the submitted array. Best-effort —
      // unknown project skips ref checks (edge checks still run).
      let refState: State | null = null;
      try {
        refState = await loadState(args.projectId);
      } catch {
        refState = null;
      }
      // Kontras label (advisory): teks pastel di kanvas putih tak terbaca —
      // mis. shape fill:none + stroke pastel (label ikut warna stroke).
      // Tak memblokir create/update; sarankan labelColor gelap eksplisit.
      let contrastCount = 0;
      for (const el of elements) {
        if (el.kind !== 'sticky' && el.kind !== 'shape' && el.kind !== 'text' && el.kind !== 'edge' && el.kind !== 'boundary') continue;
        const hit = isLowContrastLabel(el);
        if (!hit) continue;
        warnings.push({
          code: 'low_contrast_label',
          message: `${el.kind} ${el.id.slice(0, 8)} label contrast ${hit.ratio.toFixed(2)}:1 < ${MIN_LABEL_CONTRAST}:1 on white canvas`,
          a: el.id,
          b: '',
          gap: 0,
          suggestion: `Set ${hit.field} to a dark color (e.g. "#0f172a") or use a stroke with contrast >= ${MIN_LABEL_CONTRAST}:1 on white.`,
        });
        if (++contrastCount >= 5) break;
      }

      // Label pesan vs lifeline (advisory, mirror domain
      // whiteboard/label-crosses-lifeline): label edge dirender terpusat
      // di tengah segmen, lifeline dashed tak tercakup cek clearance biasa.
      {
        const lifelines = elements.filter(
          (e) => e.kind === 'edge' && (e as any).dash === 'dashed' && Math.abs(((e as any).x1 ?? 0) - ((e as any).x2 ?? 0)) < 5,
        ) as any[];
        let crossCount = 0;
        for (const el of elements) {
          if (el.kind !== 'edge') continue;
          const label = (el as any).label;
          if (typeof label !== 'string' || label.length === 0) continue;
          if (((el as any).dash ?? 'solid') === 'dashed') continue;
          const fontSize = (el as any).fontSize ?? 16;
          const w = Math.max(label.length * fontSize * 0.62, 40);
          const x1 = (el as any).x1 ?? 0, y1 = (el as any).y1 ?? 0;
          const x2 = (el as any).x2 ?? 0, y2 = (el as any).y2 ?? 0;
          const midX = (x1 + x2) / 2, midY = (y1 + y2) / 2;
          const labelRect: Rect = { x: midX - w / 2, y: midY - 7, w, h: 14 };
          for (const life of lifelines) {
            if (life.id === el.id) continue;
            if ((el as any).sourceNodeId === life.id || (el as any).targetNodeId === life.id) continue;
            const lx1 = life.x1 ?? 0, ly1 = life.y1 ?? 0, lx2 = life.x2 ?? 0, ly2 = life.y2 ?? 0;
            if (distToSegment(midX, midY, lx1, ly1, lx2, ly2) >= w / 2 + 2) continue;
            const lifeBounds: Rect = { x: Math.min(lx1, lx2), y: Math.min(ly1, ly2), w: Math.abs(lx1 - lx2) || 1, h: Math.abs(ly1 - ly2) || 1 };
            if (!rectsIntersect(labelRect, lifeBounds)) continue;
            warnings.push({
              code: 'label_crosses_lifeline',
              message: `Label "${label}" on ${el.id.slice(0, 8)} crosses lifeline ${String(life.id).slice(0, 8)}`,
              a: el.id,
              b: String(life.id),
              gap: 0,
              suggestion: 'Shorten the label, route via multi-span, or split into two messages.',
            });
            crossCount++;
            break;
          }
          if (crossCount >= 5) break;
        }
      }

      for (const w of findDanglingRefs(refState, elements)) {
        warnings.push({
          code: w.code,
          message: w.message,
          a: w.elementId,
          b: '',
          gap: 0,
          suggestion: w.suggestion,
        });
      }

      const ok = warnings.length === 0 && overlaps.length === 0;
      return {
        content: [
          textContent({
            ok,
            elementCount: elements.length,
            overlaps,
            closeCount: warnings.filter((w) => w.code === 'too_close').length,
            warnings: warnings.slice(0, 20),
            summary: ok
              ? `OK — ${elements.length} elements, no overlap/too-close (gap ≥${MIN_GAP}px, ref ≥${MIN_GAP_REF}px). Safe to create/update.`
              : `Found ${overlaps.length} overlap(s) + ${warnings.length - overlaps.length} too-close warning(s). Fix suggestions included. Expanded ref assumed 260×150.`,
            hint: 'Tip: ref expanded 260×150, sticky ideal 175-190×115, boundary inner margin 20px, horizontal gap 30px, vertical ref->sticky 45px. Canvas is always white: keep label contrast >= 4.5:1 (pastel stroke + fill none needs explicit dark labelColor "#0f172a").',
          }),
        ],
      };
    },
  );
}
