import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { loadState, saveState } from '../state-db.js';
import { findEntity, newId, nowIso, textContent, toolError } from '../../domain/entity.js';
import { whiteboardElementSchema, LIMITS, type WhiteboardElement } from '../../../projects/domain/state.js';
import { EmbedSanitizerError, sanitizeStateEmbeds } from '../../../projects/domain/sanitize-svg.js';

const inputSchema = z.object({
  projectId: z.string().uuid().describe('UUID of the target project'),
  whiteboardId: z.string().uuid().describe('UUID of the whiteboard to patch'),
  add: z
    .array(z.record(z.string().max(100), z.unknown()))
    .max(LIMITS.WHITEBOARD_ELEMENTS)
    .optional()
    .describe(
      'Elements to append (same shape as create_whiteboard elements; id optional — assigned when omitted)',
    ),
  update: z
    .array(
      z.object({
        id: z.string().uuid().describe('Target element id'),
        patch: z.record(z.string().max(100), z.unknown()).describe('Shallow field patch (kind is immutable)'),
      }),
    )
    .max(LIMITS.WHITEBOARD_ELEMENTS)
    .optional()
    .describe('Shallow patches applied to existing elements by id'),
  delete: z
    .array(z.string().uuid())
    .max(LIMITS.WHITEBOARD_ELEMENTS)
    .optional()
    .describe('Element ids to remove (edges attached to deleted nodes cascade)'),
});

function invalidIssues(issues: Array<{ path: PropertyKey[]; message: string }>): string {
  return issues
    .slice(0, 5)
    .map((i) => `${i.path.map(String).join('.')} (${i.message})`)
    .join('; ');
}

export function registerPatchWhiteboard(server: McpServer): void {
  server.registerTool(
    'patch_whiteboard',
    {
      title: 'Patch whiteboard elements',
      description:
        'Granular whiteboard edit: add / update / delete individual elements without replacing the whole board (unlike update_whiteboard full replacement). Schema-validated per element; 1000 elements per board cap enforced.',
      inputSchema,
    },
    async (args) => {
      const state = await loadState(args.projectId);
      const board = findEntity(state.whiteboards, args.whiteboardId, 'Whiteboard');
      let added = 0;
      let updated = 0;
      let deleted = 0;
      const byId = new Map<string, WhiteboardElement>(board.elements.map((el) => [el.id, el]));

      // Delete first (with incident-edge cascade, mirroring the canvas).
      const delIds = new Set<string>(args.delete ?? []);
      if (delIds.size > 0) {
        for (const el of board.elements) {
          if (
            el.kind === 'edge' &&
            ((el.sourceNodeId && delIds.has(el.sourceNodeId)) ||
              (el.targetNodeId && delIds.has(el.targetNodeId)))
          ) {
            delIds.add(el.id);
          }
        }
        const before = board.elements.length;
        board.elements = board.elements.filter((el) => !delIds.has(el.id));
        deleted = before - board.elements.length;
        for (const id of delIds) byId.delete(id);
      }

      // Update (shallow merge, kind immutable, re-validated).
      for (const { id, patch } of args.update ?? []) {
        const el = byId.get(id);
        if (!el) return toolError(`Unknown element id: ${id}`);
        if (patch['kind'] !== undefined && patch['kind'] !== el.kind) {
          return toolError(`Element kind is immutable (id: ${id})`);
        }
        const parsed = whiteboardElementSchema.safeParse({ ...el, ...patch, id: el.id });
        if (!parsed.success) {
          return toolError(`Invalid patch for element ${id}: ${invalidIssues(parsed.error.issues)}`);
        }
        const idx = board.elements.findIndex((e) => e.id === id);
        board.elements[idx] = parsed.data;
        byId.set(id, parsed.data);
        updated += 1;
      }

      // Add (ids assigned when omitted, duplicates rejected, cap enforced).
      const additions = ((args.add ?? []) as Array<Record<string, unknown>>).map((el) => ({
        ...el,
        id: typeof el.id === 'string' ? el.id : newId(),
      }));
      if (additions.length > 0) {
        if (board.elements.length + additions.length > LIMITS.WHITEBOARD_ELEMENTS) {
          return toolError(`Element cap exceeded (${LIMITS.WHITEBOARD_ELEMENTS} per board)`);
        }
        const parsed = whiteboardElementSchema.array().safeParse(additions);
        if (!parsed.success) {
          return toolError(`Invalid added elements: ${invalidIssues(parsed.error.issues)}`);
        }
        for (const el of parsed.data) {
          if (byId.has(el.id)) return toolError(`Duplicate element id: ${el.id}`);
          board.elements.push(el);
          byId.set(el.id, el);
        }
        added = parsed.data.length;
      }

      board.updatedAt = nowIso();
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
      await saveState(args.projectId, state);
      return {
        content: [
          textContent({
            id: board.id,
            added,
            updated,
            deleted,
            elementCount: board.elements.length,
            updatedAt: board.updatedAt,
            ...(stripped.length > 0 ? { sanitizerStripped: stripped } : {}),
          }),
        ],
      };
    },
  );
}
