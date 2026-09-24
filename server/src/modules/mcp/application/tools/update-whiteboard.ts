import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { loadState, saveState } from '../state-db.js';
import { applyDefined, findEntity, newId, nowIso, textContent, toolError } from '../../domain/entity.js';
import { whiteboardElementSchema, LIMITS, type WhiteboardElement } from '../../../projects/domain/state.js';
import { EmbedSanitizerError, embedGroupingHints, sanitizeStateEmbeds } from '../../../projects/domain/sanitize-svg.js';
import { validateWhiteboardShowcase } from '../../../projects/domain/validate-whiteboard.js';

const ELEMENTS_DESCRIPTION =
  'Full replacement of the board elements (max 1000). Each element: { id?, kind: "stroke"|"sticky"|"text"|"shape"|"edge"|"boundary"|"ref"|"embed", ...fields }. ' +
  '`id` is optional — the server assigns one when omitted. ' +
  'Kind "embed" holds raw AI-generated SVG (wireframes): allowlist-sanitized on write, exempt from showcase rules, max 20 embeds per board. ' +
  'Wrap each widget in <g data-component="name">; always set title. ' +
  'Example group: <g data-component="submit"><rect .../><text>Login</text></g>. ' +
  'Examples: ' +
  '{ kind: "sticky", x: 0, y: 0, w: 200, h: 120, color: "#e8b955", text: "note" }, ' +
  '{ kind: "text", x: 0, y: 0, color: "#374151", fontSize: 16, text: "title" }, ' +
  '{ kind: "shape", shapeType: "rect", x: 0, y: 0, w: 120, h: 80, color: "#2563eb", fill: false, strokeWidth: 2, label: "" }, ' +
  '{ kind: "boundary", x: 0, y: 0, w: 300, h: 200, color: "#2563eb", label: "" }, ' +
  '{ kind: "edge", x1: 0, y1: 0, x2: 200, y2: 0, color: "#8b5cf6", width: 2, arrowhead: true, arrowStyle: "solid", dash: "solid", label: "", sourceNodeId: null, targetNodeId: null }, ' +
  '{ kind: "ref", entity: "tasks", entityId: "<task-uuid>", x: 0, y: 0 }, ' +
  '{ kind: "embed", x: 0, y: 0, w: 360, h: 520, title: "Login form", svg: "<rect .../><text .../>..." }';

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
});

export function registerUpdateWhiteboard(server: McpServer): void {
  server.registerTool(
    'update_whiteboard',
    {
      title: 'Update a whiteboard',
      description:
        'Change a whiteboard board in a DevHub project: rename it, replace its description, or replace its elements. Elements are replaced as a whole document (no per-element patch).',
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
      return {
        content: [
          textContent({
            id: board.id,
            name: board.name,
            elementCount: board.elements.length,
            updatedAt: board.updatedAt,
            ...(stripped.length > 0 ? { sanitizerStripped: stripped } : {}),
            ...(grouping.length > 0 ? { groupingHints: grouping } : {}),
          }),
        ],
      };
    },
  );
}


