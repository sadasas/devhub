import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { textContent, toolError } from '../../domain/entity.js';
import {
  layoutSequence,
  SEQUENCE_MAX_MESSAGES,
  SEQUENCE_MAX_PARTICIPANTS,
  type SequenceMessageVariant,
} from '../../../projects/domain/whiteboard-layout.js';

const messageSchema = z.object({
  from: z.number().int().min(0).describe('Sender participant index (0-based)'),
  to: z.number().int().min(0).describe('Receiver participant index (0-based)'),
  label: z.string().min(1).max(200).describe('Message label (required — labels are semantic data)'),
  variant: z
    .enum(['call', 'return', 'async', 'security'])
    .default('call')
    .describe('call = solid request, return/async = dotted, security = auth & policy'),
});

const participantSchema = z.union([
  z.string().min(1).max(100),
  z.object({
    name: z.string().min(1).max(100),
    sub: z.string().min(1).max(100).optional().describe('Second line under the name (role, e.g. "mobile app")'),
  }),
]);

const activationSchema = z.object({
  participant: z.number().int().min(0).describe('Participant index owning the lifeline'),
  fromMessage: z.number().int().min(0).describe('First message index the bar spans'),
  toMessage: z.number().int().min(0).describe('Last message index the bar spans'),
});

const phaseSchema = z.object({
  label: z.string().min(1).max(100).describe('Phase band label (e.g. "Accept")'),
  fromMessage: z.number().int().min(0).describe('First message index in the band'),
  toMessage: z.number().int().min(0).describe('Last message index in the band'),
});

const inputSchema = z.object({
  type: z
    .enum(['sequence'])
    .describe('Diagram type (only sequence for now; workflow/dataflow/architecture/lifecycle follow)'),
  participants: z
    .array(participantSchema)
    .min(2)
    .max(SEQUENCE_MAX_PARTICIPANTS)
    .describe('Participants in story order (2-12): plain names or {name, sub}'),
  messages: z
    .array(messageSchema)
    .max(SEQUENCE_MAX_MESSAGES)
    .describe('Messages in time order (top to bottom). from/to are participant indexes; from==to renders an out-and-back self-message pair.'),
  activations: z
    .array(activationSchema)
    .max(50)
    .optional()
    .describe('Activation bars on lifelines (message index ranges)'),
  phases: z
    .array(phaseSchema)
    .max(10)
    .optional()
    .describe('Phase bands (message index ranges). First band auto-extends to cover participants.'),
});

export function registerLayoutBoard(server: McpServer): void {
  server.registerTool(
    'layout_board',
    {
      title: 'Layout a diagram board',
      description:
        'Constrained layout assistant (not generic auto-layout): turns a semantic sequence graph into standard-positioned whiteboard elements. Participants across the top in story order (optional sub-role second line), dashed lifelines, horizontal labeled messages top-to-bottom (solid = call, dotted = return/async), optional activation bars and phase bands, fixed 4-entry legend. from==to renders an out-and-back self-message pair. Returns elements with ids — paste them straight into create_whiteboard or patch_whiteboard. Read-only, no DB write.',
      inputSchema,
    },
    async (args) => {
      if (args.type !== 'sequence') {
        return toolError(`Unsupported diagram type: ${args.type}`);
      }
      try {
        const layout = layoutSequence({
          participants: args.participants,
          messages: args.messages.map((m) => ({
            from: m.from,
            to: m.to,
            label: m.label,
            variant: m.variant as SequenceMessageVariant,
          })),
          activations: args.activations,
          phases: args.phases,
        });
        return {
          content: [
            textContent({
              type: args.type,
              elementCount: layout.elements.length,
              width: layout.width,
              height: layout.height,
              legendY: layout.legendY,
              elements: layout.elements,
              next: 'Pass elements to create_whiteboard (new board) or patch_whiteboard add (existing board). Run validate_whiteboard first when unsure.',
            }),
          ],
        };
      } catch (err) {
        return toolError(err instanceof Error ? err.message : 'Layout failed');
      }
    },
  );
}
