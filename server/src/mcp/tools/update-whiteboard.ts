import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { loadState, saveState } from '../state-db.js';
import { applyDefined, findEntity, newId, nowIso, textContent, toolError } from '../entity.js';
import { whiteboardElementSchema, LIMITS, type WhiteboardElement } from '../../schema/state.js';

const ELEMENTS_DESCRIPTION =
  'Full replacement of the board elements (max 1000). Each element: { id?, kind: "stroke"|"sticky"|"text"|"shape"|"edge"|"boundary"|"ref", ...fields }. ' +
  '`id` is optional — the server assigns one when omitted. ' +
  'Examples: ' +
  '{ kind: "sticky", x: 0, y: 0, w: 200, h: 120, color: "#e8b955", text: "note" }, ' +
  '{ kind: "text", x: 0, y: 0, color: "#e4e4e7", fontSize: 16, text: "title" }, ' +
  '{ kind: "shape", shapeType: "rect", x: 0, y: 0, w: 120, h: 80, color: "#6ea8fe", fill: false, strokeWidth: 2, label: "" }, ' +
  '{ kind: "boundary", x: 0, y: 0, w: 300, h: 200, color: "#6ea8fe", label: "" }, ' +
  '{ kind: "edge", x1: 0, y1: 0, x2: 200, y2: 0, color: "#8b5cf6", width: 2, arrowhead: true, arrowStyle: "solid", label: "", sourceNodeId: null, targetNodeId: null }, ' +
  '{ kind: "ref", entity: "tasks", entityId: "<task-uuid>", x: 0, y: 0 }';

const inputSchema = z.object({
  projectId: z.string().describe('UUID of the target project'),
  whiteboardId: z.string().describe('UUID of the whiteboard to update'),
  name: z.string().min(1).max(LIMITS.WHITEBOARD_NAME).describe('Rename the board').optional(),
  description: z.string().max(LIMITS.WHITEBOARD_DESCRIPTION).optional(),
  elements: z
    .array(z.record(z.string(), z.unknown()))
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
        elements = parsed.data;
      }
      applyDefined(board, {
        name: args.name?.trim(),
        description: args.description,
        elements,
      });
      board.updatedAt = nowIso();
      await saveState(args.projectId, state);
      return {
        content: [
          textContent({
            id: board.id,
            name: board.name,
            elementCount: board.elements.length,
            updatedAt: board.updatedAt,
          }),
        ],
      };
    },
  );
}
