import { z } from 'zod';

export const isoDate = z.string().refine((v) => !Number.isNaN(Date.parse(v)), {
  message: 'Must be a valid ISO date string',
});

export const baseFields = {
  id: z.string().uuid(),
  createdAt: isoDate,
  updatedAt: isoDate,
  authorId: z.string().uuid().nullable().optional(),
};

export const taskStatus = z.enum(['todo', 'inProgress', 'review', 'done']);
export const taskPriority = z.enum(['low', 'medium', 'high', 'urgent']);

export const taskSchema = z.object({
  ...baseFields,
  title: z.string().min(1).max(500),
  status: taskStatus,
  priority: taskPriority,
  estimate: z.number().int().nonnegative().optional(),
  actualHours: z.number().int().nonnegative().optional(),
  labels: z.array(z.string().max(50)).max(20).default([]),
  blockedBy: z.array(z.string().uuid()).default([]),
  description: z.string().max(10_000).default(''),
});

export const issueSeverity = z.enum(['critical', 'high', 'medium', 'low']);
export const issueStatus = z.enum(['open', 'reproduced', 'fixing', 'resolved', 'wontfix']);

export const issueSchema = z.object({
  ...baseFields,
  title: z.string().min(1).max(500),
  severity: issueSeverity,
  status: issueStatus,
  reproduction: z.string().max(10_000).default(''),
  linkedTaskId: z.string().uuid().nullable().optional(),
});

export const testCaseStatus = z.enum(['pass', 'fail', 'pending']);

export const testCaseSchema = z.object({
  ...baseFields,
  name: z.string().min(1).max(300),
  taskId: z.string().uuid().nullable().optional(),
  issueId: z.string().uuid().nullable().optional(),
  steps: z.string().max(10_000).default(''),
  expected: z.string().max(5_000).default(''),
  status: testCaseStatus,
});

export const techEntryCategory = z.enum(['frontend', 'backend', 'database', 'tooling']);
export const techStatus = z.enum(['current', 'updateAvailable', 'majorUpgrade']);

export const techEntrySchema = z.object({
  ...baseFields,
  name: z.string().min(1).max(200),
  version: z.string().max(100).default(''),
  category: techEntryCategory,
  status: techStatus,
  notes: z.string().max(5_000).default(''),
});

export const columnSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(200),
  type: z.string().min(1).max(100),
  nullable: z.boolean().default(true),
  primaryKey: z.boolean().default(false),
  default: z.string().max(500).nullable().optional(),
  comment: z.string().max(2_000).default(''),
});

export const tableSchema = z.object({
  ...baseFields,
  name: z.string().min(1).max(200),
  comment: z.string().max(2_000).default(''),
  columns: z.array(columnSchema).max(200).default([]),
  indexes: z.array(z.string().max(500)).max(50).default([]),
});

export const relationCardinality = z.enum(['1:1', '1:N', 'N:M']);
export const onDelete = z.enum(['cascade', 'setNull', 'restrict']);

export const relationSchema = z.object({
  ...baseFields,
  fromTableId: z.string().uuid(),
  fromColumnId: z.string().uuid(),
  toTableId: z.string().uuid(),
  toColumnId: z.string().uuid(),
  cardinality: relationCardinality,
  onDelete: onDelete,
});

export const schemaVersionSchema = z.object({
  ...baseFields,
  version: z.string().min(1).max(100),
  appliedAt: isoDate,
  notes: z.string().max(5_000).default(''),
});

export const decisionStatus = z.enum(['proposed', 'accepted', 'rejected', 'superseded']);

export const decisionSchema = z.object({
  ...baseFields,
  title: z.string().min(1).max(300),
  status: decisionStatus,
  context: z.string().max(20_000).default(''),
  options: z.array(z.string().max(1_000)).max(20).default([]),
  decision: z.string().max(20_000).default(''),
  consequences: z.string().max(10_000).default(''),
  date: isoDate,
});

export const milestoneStatus = z.enum(['planned', 'inProgress', 'released']);

export const milestoneSchema = z.object({
  ...baseFields,
  name: z.string().min(1).max(300),
  version: z.string().max(100).nullable().optional(),
  targetDate: isoDate.nullable().optional(),
  status: milestoneStatus,
  changelog: z.string().max(20_000).default(''),
});

export const projectStatus = z.enum(['active', 'archived']);

export const stateSchema = z.object({
  tasks: z.array(taskSchema).default([]),
  issues: z.array(issueSchema).default([]),
  testCases: z.array(testCaseSchema).default([]),
  techEntries: z.array(techEntrySchema).default([]),
  tables: z.array(tableSchema).default([]),
  columns: z.array(columnSchema).default([]),
  relations: z.array(relationSchema).default([]),
  schemaVersions: z.array(schemaVersionSchema).default([]),
  decisions: z.array(decisionSchema).default([]),
  milestones: z.array(milestoneSchema).default([]),
});

export type State = z.infer<typeof stateSchema>;
export type Task = z.infer<typeof taskSchema>;
export type Issue = z.infer<typeof issueSchema>;
export type TestCase = z.infer<typeof testCaseSchema>;
export type TechEntry = z.infer<typeof techEntrySchema>;
export type Table = z.infer<typeof tableSchema>;
export type Column = z.infer<typeof columnSchema>;
export type Relation = z.infer<typeof relationSchema>;
export type SchemaVersion = z.infer<typeof schemaVersionSchema>;
export type Decision = z.infer<typeof decisionSchema>;
export type Milestone = z.infer<typeof milestoneSchema>;

export const emptyState: State = {
  tasks: [],
  issues: [],
  testCases: [],
  techEntries: [],
  tables: [],
  columns: [],
  relations: [],
  schemaVersions: [],
  decisions: [],
  milestones: [],
};

export const exportDocumentSchema = z.object({
  meta: z.object({
    app: z.literal('devhub'),
    version: z.string(),
    exportedAt: isoDate,
    projectId: z.string().uuid(),
  }),
  state: stateSchema,
});

export type ExportDocument = z.infer<typeof exportDocumentSchema>;

export const projectSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(200),
  description: z.string().max(5_000).default(''),
  status: projectStatus,
  createdAt: isoDate,
  updatedAt: isoDate,
});

export type Project = z.infer<typeof projectSchema>;
