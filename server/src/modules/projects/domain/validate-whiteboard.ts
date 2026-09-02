import type { WhiteboardElement } from "./state.js";

export interface WhiteboardDiagnostic {
  code: string;
  severity: "error" | "warning";
  message: string;
  subject: Record<string, unknown>;
  evidence: Record<string, unknown>;
  supportedFixes: string[];
}

export interface WhiteboardValidationResult {
  ok: boolean;
  diagnostics: WhiteboardDiagnostic[];
}

interface Rect { x: number; y: number; w: number; h: number; }
interface Point { x: number; y: number; }

function elementBounds(el: WhiteboardElement): Rect | null {
  switch (el.kind) {
    case "sticky":
    case "shape":
    case "boundary":
      return { x: (el as any).x, y: (el as any).y, w: (el as any).w, h: (el as any).h };
    case "text": {
      const fontSize = (el as any).fontSize ?? 16;
      const text = (el as any).text ?? "";
      const w = Math.max(40, text.length * fontSize * 0.62);
      const h = fontSize + 4;
      // text y is baseline, adjust
      return { x: (el as any).x, y: (el as any).y - fontSize, w, h };
    }
    case "edge": {
      const x1 = (el as any).x1 ?? 0; const y1 = (el as any).y1 ?? 0;
      const x2 = (el as any).x2 ?? 0; const y2 = (el as any).y2 ?? 0;
      return { x: Math.min(x1, x2), y: Math.min(y1, y2), w: Math.abs(x2 - x1) || 1, h: Math.abs(y2 - y1) || 1 };
    }
    case "ref": return { x: (el as any).x, y: (el as any).y, w: 180, h: 44 };
    case "stroke": {
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

function distToSegment(pt: Point, a: Point, b: Point): number {
  const dx = b.x - a.x, dy = b.y - a.y;
  if (dx === 0 && dy === 0) return Math.hypot(pt.x - a.x, pt.y - a.y);
  const t = Math.max(0, Math.min(1, ((pt.x - a.x) * dx + (pt.y - a.y) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(pt.x - (a.x + t * dx), pt.y - (a.y + t * dy));
}

function approxTextWidth(text: string, fontSize: number): number {
  return Math.max(text.length * fontSize * 0.62, 40);
}

function isFiniteNumber(n: unknown): boolean {
  return typeof n === "number" && Number.isFinite(n);
}

function diag(code: string, message: string, subject: Record<string, unknown>, evidence: Record<string, unknown>, fixes: string[]): WhiteboardDiagnostic {
  return { code, severity: "error", message, subject, evidence, supportedFixes: fixes };
}

export function validateWhiteboardShowcase(elements: WhiteboardElement[]): WhiteboardValidationResult {
  const diagnostics: WhiteboardDiagnostic[] = [];

  // 1. finite_svg
  for (const el of elements) {
    const nums: number[] = [];
    if ("x" in el) nums.push((el as any).x, (el as any).y);
    if ("w" in el) nums.push((el as any).w, (el as any).h);
    if (el.kind === "edge") nums.push((el as any).x1, (el as any).y1, (el as any).x2, (el as any).y2);
    if (el.kind === "stroke") for (const [px, py] of (el as any).points) nums.push(px, py);
    for (const n of nums) {
      if (!isFiniteNumber(n) || n < -100000 || n > 100000) {
        diagnostics.push(diag("whiteboard/finite-coords", `Element ${el.id} has non-finite or out-of-bounds coord`, { elementId: el.id }, { value: n }, ["fix coords to -100000..100000"]));
      }
    }
    // size checks
    if ("w" in el && "h" in el) {
      const w = (el as any).w, h = (el as any).h;
      if (w < 1 || h < 1) diagnostics.push(diag("whiteboard/min-size", `Element ${el.id} too small`, { elementId: el.id }, { w, h }, ["increase w/h to >=20"]));
    }
  }
  if (diagnostics.length) return { ok: false, diagnostics: diagnostics.slice(0, 3) };

  const boundsMap = new Map<string, Rect>();
  for (const el of elements) {
    const b = elementBounds(el);
    if (b) boundsMap.set(el.id, b);
  }

  // helper to get edge segment
  const edgeSegments = (e: any): [Point, Point] => [{ x: e.x1, y: e.y1 }, { x: e.x2, y: e.y2 }];

  // 2. edge-through-node (only for edges with x1/y1/x2/y2)
  for (const el of elements) {
    if (el.kind !== "edge") continue;
    const seg = edgeSegments(el as any);
    const a = seg[0], b = seg[1];
    for (const [otherId, rect] of boundsMap) {
      if (otherId === el.id) continue;
      const other = elements.find(e => e.id === otherId);
      if (!other) continue;
      if (other.kind === "edge" || other.kind === "stroke" || other.kind === "boundary") continue;
      // skip if edge is connected to this node
      if ((el as any).sourceNodeId === otherId || (el as any).targetNodeId === otherId) continue;
      // check if segment intersects rect (with 2px tolerance)
      // simple check: if segment bbox intersects node rect and distance < 2
      const segBounds: Rect = { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), w: Math.abs(a.x - b.x) || 1, h: Math.abs(a.y - b.y) || 1 };
      if (!rectsIntersect(segBounds, rect)) continue;
      // more precise: distance from rect center to segment < (w/2 + 2)
      const center: Point = { x: rect.x + rect.w / 2, y: rect.y + rect.h / 2 };
      const d = distToSegment(center, a, b);
      // Only flag if actually through interior, not just near border
      if (d < 10) {
        diagnostics.push(diag("whiteboard/edge-through-node", `Edge ${el.id} crosses ${other.kind} ${otherId}`, { edgeId: el.id, obstacleId: otherId }, { from: a, to: b }, ["move edge via or move node"]));
        if (diagnostics.length >= 3) return { ok: false, diagnostics };
      }
    }
  }

  // 3. label-route-clearance >4px
  for (const el of elements) {
    if (el.kind !== "edge" || !(el as any).label) continue;
    const label = (el as any).label as string;
    const fontSize = (el as any).fontSize ?? 11;
    const w = approxTextWidth(label, fontSize);
    const seg = edgeSegments(el as any);
    const mid: Point = { x: (seg[0].x + seg[1].x) / 2, y: (seg[0].y + seg[1].y) / 2 };
    const labelRect: Rect = { x: mid.x - w / 2, y: mid.y - 7, w, h: 14 };
    for (const other of elements) {
      if (other.id === el.id) continue;
      if (other.kind !== "edge") continue;
      if ((other as any).dash === "dashed") continue;
      const otherSeg = edgeSegments(other as any);
      const d = distToSegment(mid, otherSeg[0], otherSeg[1]);
      // also check label rect vs other segment
      const segBounds: Rect = { x: Math.min(otherSeg[0].x, otherSeg[1].x), y: Math.min(otherSeg[0].y, otherSeg[1].y), w: Math.abs(otherSeg[0].x - otherSeg[1].x) || 1, h: Math.abs(otherSeg[0].y - otherSeg[1].y) || 1 };
      if (rectsIntersect(labelRect, segBounds) && d < 0.5) {
        diagnostics.push(diag("whiteboard/label-route-clearance", `Label "${label}" on ${el.id} too close to edge ${other.id}`, { edgeId: el.id, otherEdgeId: other.id }, { clearancePx: d, minimumPx: 4 }, ["move label or adjust edge route"]));
        if (diagnostics.length >= 3) return { ok: false, diagnostics };
      }
    }
    // also check label vs nodes
    for (const [otherId, rect] of boundsMap) {
      if (otherId === el.id) continue;
      const other = elements.find(e => e.id === otherId);
      if (!other || other.kind === "edge" || other.kind === "stroke" || other.kind === "boundary") continue;
      if (rectsIntersect(labelRect, rect)) {
        diagnostics.push(diag("whiteboard/label-overlap-node", `Label "${label}" overlaps ${other.kind} ${otherId}`, { edgeId: el.id, obstacleId: otherId }, {}, ["move label"]));
        if (diagnostics.length >= 3) return { ok: false, diagnostics };
      }
    }
  }

  // 4. ambiguous corridor 8px - two edges share corridor
  const edges = elements.filter(e => e.kind === "edge") as any[];
  for (let i = 0; i < edges.length; i++) {
    for (let j = i + 1; j < edges.length; j++) {
      const a = edges[i], b = edges[j];
      // skip if share node
      if (a.sourceNodeId && a.sourceNodeId === b.sourceNodeId) {
        // check if both go same direction roughly horizontal/vertical and are close
        const aSeg = edgeSegments(a), bSeg = edgeSegments(b);
        // check if segments are parallel and distance <8
        const aIsH = Math.abs(aSeg[0].y - aSeg[1].y) < 5;
        const bIsH = Math.abs(bSeg[0].y - bSeg[1].y) < 5;
        if (aIsH && bIsH && Math.abs(aSeg[0].y - bSeg[0].y) < 8) {
          const overlap = Math.min(aSeg[0].x, aSeg[1].x) < Math.max(bSeg[0].x, bSeg[1].x) && Math.max(aSeg[0].x, aSeg[1].x) > Math.min(bSeg[0].x, bSeg[1].x);
          if (overlap) {
            diagnostics.push(diag("whiteboard/ambiguous-corridor", `Edges ${a.id} and ${b.id} share corridor`, { edgeId: a.id, otherEdgeId: b.id }, { distance: Math.abs(aSeg[0].y - bSeg[0].y) }, ["spread ports vertically"]));
            if (diagnostics.length >= 3) return { ok: false, diagnostics };
          }
        }
      }
    }
  }

  // 5. proper crossings - unrelated edges cross at a point (not at shared node)
  for (let i = 0; i < edges.length; i++) {
    for (let j = i + 1; j < edges.length; j++) {
      const a = edges[i], b = edges[j];
      if (a.sourceNodeId && b.sourceNodeId && (a.sourceNodeId === b.sourceNodeId || a.sourceNodeId === b.targetNodeId || a.targetNodeId === b.sourceNodeId || a.targetNodeId === b.targetNodeId)) continue;
      // Exclude lifeline (dashed) vs message crossing for sequence
      const aDashed = (a as any).dash === "dashed";
      const bDashed = (b as any).dash === "dashed";
      if (aDashed !== bDashed) continue;
      const aSeg = edgeSegments(a), bSeg = edgeSegments(b);
      // simple bbox cross check + line intersection
      const denom = (aSeg[0].x - aSeg[1].x) * (bSeg[0].y - bSeg[1].y) - (aSeg[0].y - aSeg[1].y) * (bSeg[0].x - bSeg[1].x);
      if (denom === 0) continue;
      const t = ((aSeg[0].x - bSeg[0].x) * (bSeg[0].y - bSeg[1].y) - (aSeg[0].y - bSeg[0].y) * (bSeg[0].x - bSeg[1].x)) / denom;
      const u = -((aSeg[0].x - aSeg[1].x) * (aSeg[0].y - bSeg[0].y) - (aSeg[0].y - aSeg[1].y) * (aSeg[0].x - bSeg[0].x)) / denom;
      if (t >= 0 && t <= 1 && u >= 0 && u <= 1) {
        diagnostics.push(diag("whiteboard/proper-crossing", `Edges ${a.id} and ${b.id} cross`, { edgeId: a.id, otherEdgeId: b.id }, {}, ["adjust route via"]));
        if (diagnostics.length >= 3) return { ok: false, diagnostics };
      }
    }
  }


  // 7. orphan-edge / floating-edge - edge without node attachment
  for (const el of elements) {
    if (el.kind !== "edge") continue;
    const hasSource = !!(el as any).sourceNodeId;
    const hasTarget = !!(el as any).targetNodeId;
    if ((!hasSource || !hasTarget) && (el as any).dash !== "dashed" && Math.abs((el as any).y1 - (el as any).y2) > 5) {
      // check if edge endpoints near any node (within 15px)
      const seg = edgeSegments(el as any);
      const nearNode = (pt: any) => {
        for (const [id, rect] of boundsMap) {
          const other = elements.find(e => e.id === id);
          if (!other || other.kind === "edge" || other.kind === "stroke" || other.kind === "boundary") continue;
          const expanded: any = { x: rect.x - 15, y: rect.y - 15, w: rect.w + 30, h: rect.h + 30 };
          if (pt.x >= expanded.x && pt.x <= expanded.x + expanded.w && pt.y >= expanded.y && pt.y <= expanded.y + expanded.h) return true;
        }
        return false;
      };
      const floating = !nearNode(seg[0]) || !nearNode(seg[1]);
      if (floating) {
        diagnostics.push(diag("whiteboard/orphan-edge", `Edge ${el.id} floating without node`, { edgeId: el.id }, { hasSource, hasTarget }, ["attach to node via sourcePort/targetPort"]));
        if (diagnostics.length >= 3) return { ok: false, diagnostics };
      }
    }
  }

  // 8. redundant-parts - sticky/shape without any edge (check via ID or proximity 30px)
  {
    const connected = new Set<string>();
    for (const e of elements) if (e.kind === "edge") { if ((e as any).sourceNodeId) connected.add((e as any).sourceNodeId); if ((e as any).targetNodeId) connected.add((e as any).targetNodeId); }
    for (const el of elements) {
      if (el.kind !== "sticky" && el.kind !== "shape") continue;
      if (connected.has(el.id)) continue;
      // also check proximity: any edge endpoint within 30px of shape bounds
      const br = boundsMap.get(el.id);
      let near = false;
      if (br) {
        for (const e of elements.filter(x => x.kind === "edge")) {
          const seg = edgeSegments(e as any);
          for (const pt of seg) {
            const expanded = { x: br.x - 30, y: br.y - 30, w: br.w + 60, h: br.h + 60 };
            if (pt.x >= expanded.x && pt.x <= expanded.x + expanded.w && pt.y >= expanded.y && pt.y <= expanded.y + expanded.h) { near = true; break; }
          }
          if (near) break;
        }
      }
      if (!near) {
        diagnostics.push(diag("whiteboard/redundant-parts", `${el.kind} ${el.id} orphan without edge`, { elementId: el.id }, {}, ["connect to edge or remove"]));
        if (diagnostics.length >= 3) return { ok: false, diagnostics };
        break;
      }
    }
  }



  // 9. shape-text binding - check containerId for separate text elements
  for (const el of elements) {
    if (el.kind === "text" && (el as any).w) {
      const containerId = (el as any).containerId;
      if (containerId) {
        const container = elements.find(e => e.id === containerId);
        if (!container) {
          diagnostics.push(diag("whiteboard/shape-text-binding", `Text ${el.id} references missing container ${containerId}`, { textId: el.id }, {}, ["fix containerId"]));
          if (diagnostics.length >= 3) return { ok: false, diagnostics };
        }
      }
    }
  }

  // 10. spacing - minimum distance between nodes 24px
  {
    const nodes = elements.filter(e => e.kind === "shape" || e.kind === "sticky" || e.kind === "text").map(e => ({ id: e.id, rect: boundsMap.get(e.id)! })).filter(x => x.rect);
    for (let i=0;i<nodes.length;i++) for (let j=i+1;j<nodes.length;j++) {
      const a = nodes[i]!, b = nodes[j]!;
      const dx = Math.max(0, Math.max(a.rect.x - (b.rect.x+b.rect.w), b.rect.x - (a.rect.x+a.rect.w)));
      const dy = Math.max(0, Math.max(a.rect.y - (b.rect.y+b.rect.h), b.rect.y - (a.rect.y+a.rect.h)));
      const dist = Math.hypot(dx, dy);
      if (dist < 24 && dist > 0) {
        diagnostics.push(diag("whiteboard/spacing", `Nodes ${a.id} and ${b.id} too close ${dist.toFixed(1)}px <24`, { a: a.id, b: b.id }, { dist }, ["increase spacing"]));
        if (diagnostics.length >= 3) return { ok: false, diagnostics };
        break;
      }
    }
  }

  // 11. font-family + text overflow
  for (const el of elements) {
    if (el.kind === "sticky" && (el as any).text) {
      const text = (el as any).text as string;
      const w = (el as any).w, h = (el as any).h;
      const fontSize = (el as any).fontSize ?? 12;
      const maxLines = Math.max(1, Math.floor((h - 16) / (fontSize*1.35)));
      const lines = text.split("\n").length; // approx
      if (lines > maxLines || text.length > 500) {
        diagnostics.push(diag("whiteboard/text-overflow", `Sticky ${el.id} text may truncate`, { elementId: el.id }, { maxLines }, ["increase h or shorten text"]));
        if (diagnostics.length >= 3) return { ok: false, diagnostics };
        break;
      }
    }
  }



  // 12. container children-bounds strict - every shape/sticky must be inside a boundary if boundaries exist
  {
    const boundaries = elements.filter(e => e.kind === "boundary");
    if (boundaries.length > 0) {
      for (const el of elements.filter(e => e.kind === "shape" || e.kind === "sticky")) {
        const br = boundsMap.get(el.id);
        if (!br) continue;
        const inside = boundaries.some(bb => {
          const r = boundsMap.get(bb.id);
          if (!r) return false;
          return br.x >= r.x && br.y >= r.y && br.x + br.w <= r.x + r.w && br.y + br.h <= r.y + r.h;
        });
        if (!inside) {
          diagnostics.push(diag("whiteboard/container-children-bounds", `Element ${el.id} outside all boundaries`, { elementId: el.id }, {}, ["move inside boundary"]));
          if (diagnostics.length >= 3) return { ok: false, diagnostics };
          break;
        }
      }
    }
  }


  // Template-specific checks (light)
  // Architecture: every shape should be inside a boundary if template is architecture-like
  // We skip strict template check for generic boards, only warn if many shapes outside boundaries
  const boundaries = elements.filter(e => e.kind === "boundary");
  const shapes = elements.filter(e => e.kind === "shape" || e.kind === "sticky");
  if (boundaries.length > 0 && shapes.length > 0) {
    let outside = 0;
    for (const s of shapes) {
      const b = boundsMap.get(s.id);
      if (!b) continue;
      const inside = boundaries.some(bb => {
        const br = boundsMap.get(bb.id);
        if (!br) return false;
        return b.x >= br.x && b.y >= br.y && b.x + b.w <= br.x + br.w && b.y + b.h <= br.y + br.h;
      });
      if (!inside) outside++;
    }
    if (outside > shapes.length / 2) {
      diagnostics.push(diag("whiteboard/architecture-containment", `${outside}/${shapes.length} shapes outside boundaries`, { template: "architecture" }, { outside }, ["move shapes inside boundaries or add boundary"]));
      if (diagnostics.length >= 3) return { ok: false, diagnostics };
    }
  }

  return { ok: diagnostics.length === 0, diagnostics };
}
