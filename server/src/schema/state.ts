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
  milestoneId: z.string().uuid().nullable().optional(),
  dueDate: isoDate.nullable().optional(),
  startDate: isoDate.nullable().optional(),
  completedAt: isoDate.nullable().optional(),
  assigneeId: z.string().uuid().nullable().optional(),
  pinned: z.boolean().default(false),
  description: z.string().max(10_000).default(''),
});

export const issueSeverity = z.enum(['critical', 'high', 'medium', 'low']);
export const issueStatus = z.enum(['open', 'reproduced', 'fixing', 'resolved', 'wontfix']);

export const issueSchema = z.object({
  ...baseFields,
  title: z.string().min(1).max(500),
  severity: issueSeverity,
  status: issueStatus,
  description: z.string().max(10_000).default(''),
  reproduction: z.string().max(10_000).default(''),
  linkedTaskId: z.string().uuid().nullable().optional(),
  pinned: z.boolean().default(false),
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
  pinned: z.boolean().default(false),
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

export const schemaSnapshotSchema = z.object({
  tables: z.array(tableSchema),
  relations: z.array(relationSchema),
});

export const schemaVersionSchema = z.object({
  ...baseFields,
  version: z.string().min(1).max(100),
  appliedAt: isoDate,
  notes: z.string().max(5_000).default(''),
  snapshot: schemaSnapshotSchema.optional(),
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
  pinned: z.boolean().default(false),
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

export const apiMethod = z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']);
export const apiParamIn = z.enum(['path', 'query', 'header']);

export const apiHeaderSchema = z.object({
  key: z.string().min(1).max(200),
  value: z.string().max(2_000).default(''),
  description: z.string().max(2_000).default(''),
});

export const apiParamSchema = z.object({
  name: z.string().min(1).max(200),
  in: apiParamIn,
  required: z.boolean().default(false),
  description: z.string().max(2_000).default(''),
});

export const apiResponseSchema = z.object({
  status: z.number().int().min(100).max(599),
  contentType: z.string().max(100).default(''),
  description: z.string().max(5_000).default(''),
  body: z.string().max(50_000).default(''),
});

export const apiCollectionSchema = z.object({
  ...baseFields,
  name: z.string().min(1).max(200),
  description: z.string().max(2_000).default(''),
});

export const apiEndpointSchema = z.object({
  ...baseFields,
  collectionId: z.string().uuid().nullable().optional(),
  method: apiMethod,
  path: z.string().min(1).max(500),
  name: z.string().min(1).max(200),
  description: z.string().max(10_000).default(''),
  headers: z.array(apiHeaderSchema).max(100).default([]),
  params: z.array(apiParamSchema).max(100).default([]),
  body: z.string().max(50_000).default(''),
  responses: z.array(apiResponseSchema).max(50).default([]),
});

export const projectStatus = z.enum(['active', 'archived']);

export const whiteboardCoord = z.number().min(-100_000).max(100_000);

export const whiteboardElementId = z.string().uuid();

const whiteboardStrokeSchema = z.object({
  id: whiteboardElementId,
  kind: z.literal('stroke'),
  tool: z.enum(['pen', 'eraser']),
  color: z.string().max(20).default('#e4e4e7'),
  width: z.number().min(0.5).max(100).default(2),
  thinning: z.number().min(0).max(20).default(2),
  points: z.array(z.tuple([whiteboardCoord, whiteboardCoord])).min(2).max(2000),
});

const whiteboardStickySchema = z.object({
  id: whiteboardElementId,
  kind: z.literal('sticky'),
  x: whiteboardCoord,
  y: whiteboardCoord,
  w: z.number().min(20).max(2000),
  h: z.number().min(20).max(2000),
  color: z.string().max(20).default('#e8b955'),
  text: z.string().max(500).default(''),
});

const whiteboardTextSchema = z.object({
  id: whiteboardElementId,
  kind: z.literal('text'),
  x: whiteboardCoord,
  y: whiteboardCoord,
  color: z.string().max(20).default('#e4e4e7'),
  fontSize: z.number().min(8).max(200).default(16),
  text: z.string().max(1000).default(''),
  w: z.number().min(20).max(2000).nullable().optional(),
});

const whiteboardShapeSchema = z.object({
  id: whiteboardElementId,
  kind: z.literal('shape'),
  shapeType: z.enum(['rect', 'diamond', 'ellipse', 'cylinder', 'parallelogram', 'hexagon', 'roundedRect']),
  x: whiteboardCoord,
  y: whiteboardCoord,
  w: z.number().min(1).max(10_000),
  h: z.number().min(1).max(10_000),
  color: z.string().max(20).default('#6ea8fe'),
  fill: z.boolean().default(false),
  strokeWidth: z.number().min(0.5).max(100).default(2),
  label: z.string().max(200).default(''),
});

const whiteboardEdgeSchema = z.object({
  id: whiteboardElementId,
  kind: z.literal('edge'),
  x1: whiteboardCoord,
  y1: whiteboardCoord,
  x2: whiteboardCoord,
  y2: whiteboardCoord,
  color: z.string().max(20).default('#e4e4e7'),
  width: z.number().min(0.5).max(100).default(2),
  arrowhead: z.boolean().default(false),
  label: z.string().max(200).default(''),
  arrowStyle: z.enum(['none', 'open', 'solid', 'diamond', 'circle']).default('none'),
  sourceNodeId: whiteboardElementId.nullable().optional(),
  targetNodeId: whiteboardElementId.nullable().optional(),
  sourcePort: z.enum(['top', 'right', 'bottom', 'left']).nullable().optional(),
  targetPort: z.enum(['top', 'right', 'bottom', 'left']).nullable().optional(),
});

const whiteboardBoundarySchema = z.object({
  id: whiteboardElementId,
  kind: z.literal('boundary'),
  x: whiteboardCoord,
  y: whiteboardCoord,
  w: z.number().min(20).max(2000),
  h: z.number().min(20).max(2000),
  color: z.string().max(20).default('#6ea8fe'),
  label: z.string().max(200).default(''),
});

const whiteboardRefSchema = z.object({
  id: whiteboardElementId,
  kind: z.literal('ref'),
  entity: z.enum(['tasks', 'issues']),
  entityId: z.string().uuid(),
  x: whiteboardCoord,
  y: whiteboardCoord,
});

export const whiteboardElementSchema = z.discriminatedUnion('kind', [
  whiteboardStrokeSchema,
  whiteboardStickySchema,
  whiteboardTextSchema,
  whiteboardShapeSchema,
  whiteboardEdgeSchema,
  whiteboardBoundarySchema,
  whiteboardRefSchema,
]);

export const whiteboardSchema = z.object({
  ...baseFields,
  name: z.string().min(1).max(100).default('Whiteboard'),
  description: z.string().max(2_000).default(''),
  elements: z.array(whiteboardElementSchema).max(1000).default([]),
});

export const stateSchema = z.object({
  tasks: z.array(taskSchema).default([]),
  issues: z.array(issueSchema).default([]),
  testCases: z.array(testCaseSchema).default([]),
  techEntries: z.array(techEntrySchema).default([]),
  tables: z.array(tableSchema).default([]),
  relations: z.array(relationSchema).default([]),
  schemaVersions: z.array(schemaVersionSchema).default([]),
  decisions: z.array(decisionSchema).default([]),
  milestones: z.array(milestoneSchema).default([]),
  apiCollections: z.array(apiCollectionSchema).default([]),
  apiEndpoints: z.array(apiEndpointSchema).default([]),
  whiteboards: z.array(whiteboardSchema).max(5).default([]),
});

export type State = z.infer<typeof stateSchema>;
export type Task = z.infer<typeof taskSchema>;
export type Issue = z.infer<typeof issueSchema>;
export type TestCase = z.infer<typeof testCaseSchema>;
export type TechEntry = z.infer<typeof techEntrySchema>;
export type Table = z.infer<typeof tableSchema>;
export type Column = z.infer<typeof columnSchema>;
export type Relation = z.infer<typeof relationSchema>;
export type SchemaSnapshot = z.infer<typeof schemaSnapshotSchema>;
export type SchemaVersion = z.infer<typeof schemaVersionSchema>;
export type Decision = z.infer<typeof decisionSchema>;
export type Milestone = z.infer<typeof milestoneSchema>;
export type ApiCollection = z.infer<typeof apiCollectionSchema>;
export type ApiEndpoint = z.infer<typeof apiEndpointSchema>;
export type ApiMethod = z.infer<typeof apiMethod>;
export type ApiParamIn = z.infer<typeof apiParamIn>;
export type ApiHeader = z.infer<typeof apiHeaderSchema>;
export type ApiParam = z.infer<typeof apiParamSchema>;
export type ApiResponse = z.infer<typeof apiResponseSchema>;
export type WhiteboardElement = z.infer<typeof whiteboardElementSchema>;
export type WhiteboardStroke = z.infer<typeof whiteboardStrokeSchema>;
export type WhiteboardSticky = z.infer<typeof whiteboardStickySchema>;
export type WhiteboardText = z.infer<typeof whiteboardTextSchema>;
export type WhiteboardShape = z.infer<typeof whiteboardShapeSchema>;
export type WhiteboardEdge = z.infer<typeof whiteboardEdgeSchema>;
export type WhiteboardRef = z.infer<typeof whiteboardRefSchema>;
export type Whiteboard = z.infer<typeof whiteboardSchema>;

export const emptyState: State = {
  tasks: [],
  issues: [],
  testCases: [],
  techEntries: [],
  tables: [],
  relations: [],
  schemaVersions: [],
  decisions: [],
  milestones: [],
  apiCollections: [],
  apiEndpoints: [],
  whiteboards: [],
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
