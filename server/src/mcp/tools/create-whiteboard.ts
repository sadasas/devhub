import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { loadState, saveState } from '../state-db.js';
import { newId, nowIso, textContent, toolError } from '../entity.js';
import { whiteboardElementSchema, LIMITS, type WhiteboardElement } from '../../schema/state.js';

const ELEMENTS_DESCRIPTION =
  'Board elements (max 1000). Each element: { id?, kind: "stroke"|"sticky"|"text"|"shape"|"edge"|"boundary"|"ref", ...fields }. ' +
  '`id` is optional — the server assigns one when omitted. ' +
  'Examples: ' +
  '{ kind: "sticky", x: 0, y: 0, w: 200, h: 120, color: "#e8b955", text: "note" }, ' +
  '{ kind: "text", x: 0, y: 0, color: "#e4e4e7", fontSize: 16, text: "title" }, ' +
  '{ kind: "shape", shapeType: "rect", x: 0, y: 0, w: 120, h: 80, color: "#6ea8fe", fill: false, strokeWidth: 2, label: "" }, ' +
  '{ kind: "boundary", x: 0, y: 0, w: 300, h: 200, color: "#6ea8fe", label: "" }, ' +
  '{ kind: "edge", x1: 0, y1: 0, x2: 200, y2: 0, color: "#8b5cf6", width: 2, arrowhead: true, arrowStyle: "solid", dash: "solid", label: "", sourceNodeId: null, targetNodeId: null }, ' +
  '{ kind: "ref", entity: "tasks", entityId: "<task-uuid>", x: 0, y: 0 }';

const inputSchema = z.object({
  projectId: z.string().describe('UUID of the target project'),
  name: z.string().min(1).max(LIMITS.WHITEBOARD_NAME).describe('Board name'),
  description: z.string().max(LIMITS.WHITEBOARD_DESCRIPTION).default(''),
  elements: z
    .array(z.record(z.string(), z.unknown()))
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
        'Add a whiteboard board to a DevHub project with name, description and optional elements (stickies, shapes, edges, boundaries, text and live entity ref cards).',
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
      state.whiteboards.push(board);
      await saveState(args.projectId, state);
      return {
        content: [textContent({ id: board.id, name: board.name, elementCount: board.elements.length, updatedAt: now })],
      };
    },
  );
}
