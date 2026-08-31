import { z } from 'zod';

/**
 * Batas tunggal untuk field teks/array — dipakai oleh stateSchema dan skema
 * input tool MCP agar tidak ada drift (audit 2026-08b, MCP-2).
 */
export const LIMITS = {
  TASK_TITLE: 300,
  TASK_DESCRIPTION: 10_000,
  ISSUE_TITLE: 300,
  ISSUE_DESCRIPTION: 10_000,
  ISSUE_REPRODUCTION: 10_000,
  TESTCASE_NAME: 300,
  TESTCASE_STEPS: 10_000,
  TESTCASE_EXPECTED: 5_000,
  DECISION_TITLE: 300,
  DECISION_CONTEXT: 20_000,
  DECISION_OPTION: 1_000,
  DECISION_OPTIONS: 20,
  DECISION_TEXT: 20_000,
  DECISION_CONSEQUENCES: 10_000,
  MILESTONE_NAME: 300,
  MILESTONE_VERSION: 100,
  MILESTONE_CHANGELOG: 20_000,
  BRIEF: 50_000,
  WHITEBOARD_NAME: 300,
  WHITEBOARD_DESCRIPTION: 2_000,
  WHITEBOARD_ELEMENTS: 1_000,
  WHITEBOARDS_PER_PROJECT: 50,
  TIMELINE_ORDER: 5000,
} as const;

export const isoDate = z.string().max(100).refine((v) => !Number.isNaN(Date.parse(v)), {
  message: 'Must be a valid ISO date string',
});

export const hours = z
  .number()
  .nonnegative()
  .refine((v) => Math.abs(v * 10 - Math.round(v * 10)) < 1e-9, {
    message: 'Must have at most 1 decimal place',
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
  title: z.string().min(1).max(LIMITS.TASK_TITLE),
  status: taskStatus,
  priority: taskPriority,
  estimate: z.number().int().nonnegative().optional(),
  actualHours: hours.optional(),
  labels: z.array(z.string().max(50)).max(20).default([]),
  blockedBy: z.array(z.string().uuid()).default([]),
  milestoneId: z.string().uuid().nullable().optional(),
  dueDate: isoDate.nullable().optional(),
  startDate: isoDate.nullable().optional(),
  completedAt: isoDate.nullable().optional(),
  assigneeId: z.string().uuid().nullable().optional(),
  pinned: z.boolean().default(false),
  description: z.string().max(LIMITS.TASK_DESCRIPTION).default(''),
});

export const issueSeverity = z.enum(['critical', 'high', 'medium', 'low']);
export const issueStatus = z.enum(['open', 'reproduced', 'fixing', 'resolved', 'wontfix']);

export const issueSchema = z.object({
  ...baseFields,
  title: z.string().min(1).max(LIMITS.ISSUE_TITLE),
  severity: issueSeverity,
  status: issueStatus,
  description: z.string().max(LIMITS.ISSUE_DESCRIPTION).default(''),
  reproduction: z.string().max(LIMITS.ISSUE_REPRODUCTION).default(''),
  linkedTaskId: z.string().uuid().nullable().optional(),
  pinned: z.boolean().default(false),
});

export const testCaseStatus = z.enum(['pass', 'fail', 'pending']);

export const testCaseSchema = z.object({
  ...baseFields,
  name: z.string().min(1).max(LIMITS.TESTCASE_NAME),
  taskId: z.string().uuid().nullable().optional(),
  issueId: z.string().uuid().nullable().optional(),
  steps: z.string().max(LIMITS.TESTCASE_STEPS).default(''),
  expected: z.string().max(LIMITS.TESTCASE_EXPECTED).default(''),
  status: testCaseStatus,
  pinned: z.boolean().default(false),
});

export const techEntryCategory = z.enum(['frontend', 'backend', 'database', 'tooling']);
export const techStatus = z.enum(['current', 'updateAvailable', 'majorUpgrade']);

export const techEntrySchema = z.object({
  ...baseFields,
  name: z.string().min(1).max(300),
  version: z.string().max(100).default(''),
  category: techEntryCategory,
  status: techStatus,
  notes: z.string().max(5_000).default(''),
});

export const columnSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(300),
  type: z.string().min(1).max(100),
  nullable: z.boolean().default(true),
  primaryKey: z.boolean().default(false),
  default: z.string().max(500).nullable().optional(),
  comment: z.string().max(2_000).default(''),
});

export const tableSchema = z.object({
  ...baseFields,
  name: z.string().min(1).max(300),
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
  milestoneId: z.string().uuid().nullable().optional(),
});

export const decisionStatus = z.enum(['proposed', 'accepted', 'rejected', 'superseded']);

export const decisionSchema = z.object({
  ...baseFields,
  title: z.string().min(1).max(LIMITS.DECISION_TITLE),
  status: decisionStatus,
  context: z.string().max(LIMITS.DECISION_CONTEXT).default(''),
  options: z.array(z.string().max(LIMITS.DECISION_OPTION)).max(LIMITS.DECISION_OPTIONS).default([]),
  decision: z.string().max(LIMITS.DECISION_TEXT).default(''),
  consequences: z.string().max(LIMITS.DECISION_CONSEQUENCES).default(''),
  date: isoDate,
  pinned: z.boolean().default(false),
  milestoneId: z.string().uuid().nullable().optional(),
});

export const milestoneStatus = z.enum(['planned', 'inProgress', 'released']);

export const milestoneSchema = z.object({
  ...baseFields,
  name: z.string().min(1).max(LIMITS.MILESTONE_NAME),
  version: z.string().max(LIMITS.MILESTONE_VERSION).nullable().optional(),
  targetDate: isoDate.nullable().optional(),
  status: milestoneStatus,
  changelog: z.string().max(LIMITS.MILESTONE_CHANGELOG).default(''),
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
  name: z.string().min(1).max(300),
  description: z.string().max(2_000).default(''),
});

export const apiEndpointSchema = z.object({
  ...baseFields,
  collectionId: z.string().uuid().nullable().optional(),
  method: apiMethod,
  path: z.string().min(1).max(500),
  name: z.string().min(1).max(300),
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
  locked: z.boolean().default(false),
  groupId: z.string().uuid().nullable().default(null),
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
  textColor: z.string().max(20).nullable().optional(),
  fontSize: z.number().min(4).max(72).nullable().optional(),
  align: z.enum(['left', 'center', 'right']).nullable().optional(),
  rotation: z.number().min(-360).max(360).default(0),
  locked: z.boolean().default(false),
  groupId: z.string().uuid().nullable().default(null),
});

const whiteboardTextSchema = z.object({
  id: whiteboardElementId,
  kind: z.literal('text'),
  x: whiteboardCoord,
  y: whiteboardCoord,
  color: z.string().max(20).default('#e4e4e7'),
  fontSize: z.number().min(4).max(200).default(16),
  text: z.string().max(1000).default(''),
  w: z.number().min(20).max(2000).nullable().optional(),
  align: z.enum(['left', 'center', 'right']).nullable().optional(),
  rotation: z.number().min(-360).max(360).default(0),
  locked: z.boolean().default(false),
  groupId: z.string().uuid().nullable().default(null),
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
  labelColor: z.string().max(20).nullable().optional(),
  fontSize: z.number().min(4).max(72).nullable().optional(),
  align: z.enum(['left', 'center', 'right']).nullable().optional(),
  rotation: z.number().min(-360).max(360).default(0),
  locked: z.boolean().default(false),
  groupId: z.string().uuid().nullable().default(null),
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
  dash: z.enum(['solid', 'dashed', 'dotted']).default('solid'),
  fontSize: z.number().min(4).max(72).nullable().optional(),
  align: z.enum(['left', 'center', 'right']).nullable().optional(),
  locked: z.boolean().default(false),
  groupId: z.string().uuid().nullable().default(null),
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
  labelColor: z.string().max(20).nullable().optional(),
  fontSize: z.number().min(4).max(72).nullable().optional(),
  align: z.enum(['left', 'center', 'right']).nullable().optional(),
  locked: z.boolean().default(false),
  groupId: z.string().uuid().nullable().default(null),
});

const whiteboardRefSchema = z.object({
  id: whiteboardElementId,
  kind: z.literal('ref'),
  entity: z.enum(['tasks', 'issues', 'testCases', 'milestones', 'techEntries', 'decisions', 'tables', 'apiCollections', 'apiEndpoints']),
  entityId: z.string().uuid(),
  x: whiteboardCoord,
  y: whiteboardCoord,
  locked: z.boolean().default(false),
  groupId: z.string().uuid().nullable().default(null),
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
  name: z.string().min(1).max(LIMITS.WHITEBOARD_NAME).default('Whiteboard'),
  description: z.string().max(LIMITS.WHITEBOARD_DESCRIPTION).default(''),
  elements: z.array(whiteboardElementSchema).max(LIMITS.WHITEBOARD_ELEMENTS).default([]),
});

export const stateSchema = z.object({
  tasks: z.array(taskSchema).max(5_000).default([]),
  issues: z.array(issueSchema).max(5_000).default([]),
  testCases: z.array(testCaseSchema).max(5_000).default([]),
  techEntries: z.array(techEntrySchema).max(500).default([]),
  tables: z.array(tableSchema).max(500).default([]),
  relations: z.array(relationSchema).max(500).default([]),
  schemaVersions: z.array(schemaVersionSchema).max(100).default([]),
  decisions: z.array(decisionSchema).max(2_000).default([]),
  milestones: z.array(milestoneSchema).max(500).default([]),
  apiCollections: z.array(apiCollectionSchema).max(500).default([]),
  apiEndpoints: z.array(apiEndpointSchema).max(5_000).default([]),
  whiteboards: z.array(whiteboardSchema).max(LIMITS.WHITEBOARDS_PER_PROJECT).default([]),
  timelineOrder: z.record(z.string().max(100), z.array(z.string().uuid()).max(5000)).default({}),
  timelineRow: z.record(z.string().max(100), z.record(z.string().max(100), z.number().int().min(0).max(10000))).default({}),
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
  timelineOrder: {},
  timelineRow: {},
};

export const exportDocumentSchema = z.object({
  meta: z.object({
    app: z.literal('devhub'),
    version: z.string().max(100),
    exportedAt: isoDate,
    projectId: z.string().uuid(),
    // Versi state saat ekspor — dipakai import restore untuk optimistic lock (audit 2026-08b, REST-4)
    stateVersion: z.number().int().positive().optional(),
  }),
  state: stateSchema,
});

export type ExportDocument = z.infer<typeof exportDocumentSchema>;

export const projectSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(300),
  description: z.string().max(5_000).default(''),
  status: projectStatus,
  createdAt: isoDate,
  updatedAt: isoDate,
});

export type Project = z.infer<typeof projectSchema>;
