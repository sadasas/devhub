import { z } from 'zod';

// Validation schemas for owner-only project templates.
// Routers parse with these (thin-router pattern); services receive typed input.

export const saveTemplateSchema = z.object({
  projectId: z.string().uuid('Project is required'),
  name: z.string().trim().min(1, 'Name is required').max(200),
  description: z.string().max(5_000).default(''),
});

export type SaveTemplateInput = z.infer<typeof saveTemplateSchema>;

export const updateTemplateSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(200).optional(),
  description: z.string().max(5_000).optional(),
});

export type UpdateTemplateInput = z.infer<typeof updateTemplateSchema>;

export const instantiateTemplateSchema = z.object({
  teamId: z.string().uuid('Team is required'),
  name: z.string().trim().min(1).max(200).optional(),
  description: z.string().max(5_000).optional(),
});

export type InstantiateTemplateInput = z.infer<typeof instantiateTemplateSchema>;

export interface TemplateRow {
  id: string;
  owner_id: string;
  name: string;
  description: string;
  state: unknown;
  created_by: string;
  created_at: Date;
  updated_at: Date;
}
