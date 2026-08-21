import { z } from 'zod';

export const CHAT_REF_ENTITIES = [
  'tasks',
  'issues',
  'testCases',
  'techEntries',
  'tables',
  'relations',
  'schemaVersions',
  'decisions',
  'milestones',
  'apiCollections',
  'apiEndpoints',
  'whiteboards',
] as const;

export type ChatRefEntity = (typeof CHAT_REF_ENTITIES)[number];

export const chatRefSchema = z.object({
  entity: z.enum(CHAT_REF_ENTITIES),
  entityId: z.string().uuid(),
});

export interface ChatRef {
  entity: ChatRefEntity;
  entityId: string;
}

export const messageCreateSchema = z.object({
  content: z.string().trim().min(1, 'Message is required').max(4000),
  refs: z.array(chatRefSchema).max(10).default([]),
});

export const readStateSchema = z.object({
  lastReadAt: z.string().datetime(),
});

export const resolveRefsSchema = z.object({
  refs: z.array(chatRefSchema).min(1).max(10),
});