import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { loadState, saveState } from '../state-db.js';
import { newId, nowIso, textContent, toolError } from '../../domain/entity.js';
import { whiteboardElementSchema, LIMITS, type WhiteboardElement } from '../../../projects/domain/state.js';
import { EmbedSanitizerError, embedGroupingHints, sanitizeStateEmbeds } from '../../../projects/domain/sanitize-svg.js';
import { EMBED_EXAMPLE_GROUPED, EMBED_GUIDE } from './whiteboard-embed-guide.js';
import { findDanglingRefs } from '../../../projects/domain/whiteboard-refs.js';
import { validateWhiteboardShowcase } from '../../../projects/domain/validate-whiteboard.js';
import { CONTRAST_GUIDE } from '../../../projects/domain/color-contrast.js';

const ELEMENTS_DESCRIPTION =
  'Board elements (max 1000). Each element: { id?, kind: "stroke"|"sticky"|"text"|"shape"|"edge"|"boundary"|"ref"|"embed", ...fields }. ' +
  '`id` is optional — the server assigns one when omitted. ' +
  EMBED_GUIDE +
  ' Examples: ' +
  '{ kind: "sticky", x: 0, y: 0, w: 200, h: 120, color: "#e8b955", text: "note" }, ' +
  '{ kind: "text", x: 0, y: 0, color: "#374151", fontSize: 16, text: "title" }, ' +
  '{ kind: "shape", shapeType: "rect", x: 0, y: 0, w: 120, h: 80, color: "#2563eb", fill: "none", strokeWidth: 2, label: "" }, ' +
  '{ kind: "boundary", x: 0, y: 0, w: 300, h: 200, color: "#2563eb", label: "" }, ' +
  '{ kind: "edge", x1: 0, y1: 0, x2: 200, y2: 0, color: "#7c3aed", width: 2, arrowhead: true, arrowStyle: "solid", dash: "solid", label: "", sourceNodeId: null, targetNodeId: null }, ' +
  '{ kind: "ref", entity: "tasks", entityId: "<task-uuid>", x: 0, y: 0 }, ' +
  EMBED_EXAMPLE_GROUPED + ' ' + CONTRAST_GUIDE;

const inputSchema = z.object({
  projectId: z.string().uuid().describe('UUID of the target project'),
  name: z.string().min(1).max(LIMITS.WHITEBOARD_NAME).describe('Board name'),
  description: z.string().max(LIMITS.WHITEBOARD_DESCRIPTION).default(''),
  elements: z
    .array(z.record(z.string().max(100), z.unknown()))
    .max(LIMITS.WHITEBOARD_ELEMENTS)
    .default([])
    .describe(ELEMENTS_DESCRIPTION),
});

function normalizeElements(raw: Array<Record<string, unknown>>): WhiteboardElement[] {
  return raw.map((el) => ({ ...el, id: typeof el.id === 'string' ? el.id : newId() })) as WhiteboardElement[];
}

export function registerCreateWhiteboard(server: McpServer): void {
  server.registerTool(
    'create_whiteboard',
    {
      title: 'Create a whiteboard',
      description:
        'Add a whiteboard board to a DevHub project with name, description and optional elements (stickies, shapes, edges, boundaries, text, strokes, live entity ref cards and AI SVG embed wireframes). Prefer validate_whiteboard dry-run before writing embeds.',
      inputSchema,
    },
    async (args) => {
      const state = await loadState(args.projectId);
      if (state.whiteboards.length >= LIMITS.WHITEBOARDS_PER_PROJECT) {
        return toolError(`Whiteboard limit reached (${LIMITS.WHITEBOARDS_PER_PROJECT} per project)`);
      }
      const elements = normalizeElements(args.elements);
      const parsed = whiteboardElementSchema.array().safeParse(elements);
      if (!parsed.success) {
        return toolError(
          `Invalid whiteboard elements: ${parsed.error.issues
            .slice(0, 5)
            .map((i) => `${i.path.join('.')} (${i.message})`)
            .join('; ')}`,
        );
      }
      const now = nowIso();
      const board = {
        id: newId(),
        createdAt: now,
        updatedAt: now,
        name: args.name.trim(),
        description: args.description,
        elements: parsed.data,
      };
      // Sanitizer embed berjalan di saveState (fail-closed); jalankan di sini
      // juga agar pesan stripped/fail langsung terlihat di respons tool.
      let stripped: string[] = [];
      try {
        const tmp = { ...state, whiteboards: [...state.whiteboards, board] };
        stripped = sanitizeStateEmbeds(tmp as typeof state).stripped;
        board.elements = tmp.whiteboards[tmp.whiteboards.length - 1]!.elements;
      } catch (err) {
        if (err instanceof EmbedSanitizerError) {
          return toolError(`Embed rejected: ${err.message}`);
        }
        throw err;
      }
      // Showcase validation (Archify-style) - fail closed with repair receipt.
      // Kind `embed` bebas dari aturan ini (wireframe tanpa panah lolos).
      const showcase = validateWhiteboardShowcase(parsed.data);
      if (!showcase.ok) {
        const first = showcase.diagnostics[0]!;
        return toolError(`Showcase validation failed: ${first.message} | fix: ${first.supportedFixes[0]} | evidence: ${JSON.stringify(first.evidence)}`);
      }
      state.whiteboards.push(board);
      await saveState(args.projectId, state);
      const grouping = embedGroupingHints(board.elements);
      const warnings = findDanglingRefs(state, board.elements);
      return {
        content: [textContent({ id: board.id, name: board.name, elementCount: board.elements.length, updatedAt: now, ...(stripped.length > 0 ? { sanitizerStripped: stripped } : {}), ...(grouping.length > 0 ? { groupingHints: grouping } : {}), ...(warnings.length > 0 ? { warnings } : {}) })],
      };
    },
  );
}


