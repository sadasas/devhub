import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { loadState, saveState } from '../state-db.js';
import { applyDefined, findEntity, newId, nowIso, textContent, toolError } from '../../domain/entity.js';
import { whiteboardElementSchema, LIMITS, type WhiteboardElement } from '../../../projects/domain/state.js';
import { EmbedSanitizerError, embedGroupingHints, sanitizeStateEmbeds } from '../../../projects/domain/sanitize-svg.js';
import { EMBED_EXAMPLE_GROUPED, EMBED_GUIDE } from './whiteboard-embed-guide.js';
import { findDanglingRefs } from '../../../projects/domain/whiteboard-refs.js';
import { validateWhiteboardShowcase } from '../../../projects/domain/validate-whiteboard.js';
import { CONTRAST_GUIDE } from '../../../projects/domain/color-contrast.js';

const ELEMENTS_DESCRIPTION =
  'Full replacement of the board elements (max 1000). Each element: { id?, kind: "stroke"|"sticky"|"text"|"shape"|"edge"|"boundary"|"ref"|"embed", ...fields }. ' +
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
  whiteboardId: z.string().uuid().describe('UUID of the whiteboard to update'),
  name: z.string().min(1).max(LIMITS.WHITEBOARD_NAME).describe('Rename the board').optional(),
  description: z.string().max(LIMITS.WHITEBOARD_DESCRIPTION).optional(),
  elements: z
    .array(z.record(z.string().max(100), z.unknown()))
    .max(LIMITS.WHITEBOARD_ELEMENTS)
    .optional()
    .describe(ELEMENTS_DESCRIPTION),
  confirmEmpty: z
    .boolean()
    .default(false)
    .describe('Required when replacing a non-empty board with an empty elements array (mass-delete guard)'),
});

export function registerUpdateWhiteboard(server: McpServer): void {
  server.registerTool(
    'update_whiteboard',
    {
      title: 'Update a whiteboard',
      description:
        'Change a whiteboard board in a DevHub project: rename it, replace its description, or replace its elements. Elements are replaced as a whole document (no per-element patch — use patch_whiteboard for granular edits). Supports AI SVG embed wireframes; prefer validate_whiteboard dry-run first.',
      inputSchema,
    },
    async (args) => {
      const state = await loadState(args.projectId);
      const board = findEntity(state.whiteboards, args.whiteboardId, 'Whiteboard');
      let elements: WhiteboardElement[] | undefined;
      if (args.elements !== undefined) {
        const normalized = args.elements.map((el) => ({ ...el, id: typeof el.id === 'string' ? el.id : newId() }));
        const parsed = whiteboardElementSchema.array().safeParse(normalized);
        if (!parsed.success) {
          return toolError(
            `Invalid whiteboard elements: ${parsed.error.issues
              .slice(0, 5)
              .map((i) => `${i.path.join('.')} (${i.message})`)
              .join('; ')}`,
          );
        }
        // Showcase validation (Archify-style). Kind `embed` bebas dari aturan ini.
        const showcase = validateWhiteboardShowcase(parsed.data);
        if (!showcase.ok) {
          const first = showcase.diagnostics[0]!;
          return toolError(`Showcase validation failed: ${first.message} | fix: ${first.supportedFixes[0]} | evidence: ${JSON.stringify(first.evidence)}`);
        }
        elements = parsed.data;
      }
      // Mass-delete guard: replacing a non-empty board with [] needs explicit confirmation.
      if (elements !== undefined && elements.length === 0 && board.elements.length > 0 && !args.confirmEmpty) {
        return toolError(
          `Refusing to delete ${board.elements.length} element(s) from board ${board.id} — pass confirmEmpty: true to confirm, or use patch_whiteboard delete for selective removal`,
        );
      }
      // Sanitizer embed (fail-closed); saveState mengulanginya sebagai backstop.
      let stripped: string[] = [];
      try {
        stripped = sanitizeStateEmbeds(state).stripped;
      } catch (err) {
        if (err instanceof EmbedSanitizerError) {
          return toolError(`Embed rejected: ${err.message}`);
        }
        throw err;
      }
      applyDefined(board, {
        name: args.name?.trim(),
        description: args.description,
        elements,
      });
      board.updatedAt = nowIso();
      await saveState(args.projectId, state);
      const grouping = embedGroupingHints(board.elements);
      const warnings = findDanglingRefs(state, board.elements);
      return {
        content: [
          textContent({
            id: board.id,
            name: board.name,
            elementCount: board.elements.length,
            updatedAt: board.updatedAt,
            ...(stripped.length > 0 ? { sanitizerStripped: stripped } : {}),
            ...(grouping.length > 0 ? { groupingHints: grouping } : {}),
            ...(warnings.length > 0 ? { warnings } : {}),
          }),
        ],
      };
    },
  );
}


