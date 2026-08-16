/* DevHub client-side types.
   Mirror of the authoritative contract: server/src/schema/state.ts (zod) and
   the role enums in server/src/api/authz.ts. Keep in sync manually. */

export type TaskStatus = 'todo' | 'inProgress' | 'review' | 'done';
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';
export type IssueSeverity = 'critical' | 'high' | 'medium' | 'low';
export type IssueStatus = 'open' | 'reproduced' | 'fixing' | 'resolved' | 'wontfix';
export type TestCaseStatus = 'pass' | 'fail' | 'pending';
export type TechEntryCategory = 'frontend' | 'backend' | 'database' | 'tooling';
export type TechStatus = 'current' | 'updateAvailable' | 'majorUpgrade';
export type RelationCardinality = '1:1' | '1:N' | 'N:M';
export type OnDelete = 'cascade' | 'setNull' | 'restrict';
export type DecisionStatus = 'proposed' | 'accepted' | 'rejected' | 'superseded';
export type MilestoneStatus = 'planned' | 'inProgress' | 'released';
export type ProjectStatus = 'active' | 'archived';
export type PublicTab = 'board' | 'issues' | 'stack' | 'milestones' | 'about' | 'whiteboard';

export interface Base {
  id: string;
  createdAt: string;
  updatedAt: string;
  authorId?: string | null;
}

export interface Task extends Base {
  title: string;
  status: TaskStatus;
  priority: TaskPriority;
  estimate?: number;
  actualHours?: number;
  labels: string[];
  blockedBy: string[];
  milestoneId?: string | null;
  description: string;
}

export interface Issue extends Base {
  title: string;
  severity: IssueSeverity;
  status: IssueStatus;
  description: string;
  reproduction: string;
  linkedTaskId?: string | null;
}

export interface TestCase extends Base {
  name: string;
  taskId?: string | null;
  issueId?: string | null;
  steps: string;
  expected: string;
  status: TestCaseStatus;
}

export interface TechEntry extends Base {
  name: string;
  version: string;
  category: TechEntryCategory;
  status: TechStatus;
  notes: string;
}

export interface Column {
  id: string;
  name: string;
  type: string;
  nullable: boolean;
  primaryKey: boolean;
  default?: string | null;
  comment: string;
}

export interface Table extends Base {
  name: string;
  comment: string;
  columns: Column[];
  indexes: string[];
}

export interface Relation extends Base {
  fromTableId: string;
  fromColumnId: string;
  toTableId: string;
  toColumnId: string;
  cardinality: RelationCardinality;
  onDelete: OnDelete;
}

export interface SchemaSnapshot {
  tables: Table[];
  relations: Relation[];
}

export interface SchemaVersion extends Base {
  version: string;
  appliedAt: string;
  notes: string;
  snapshot?: SchemaSnapshot | null;
}

export interface Decision extends Base {
  title: string;
  status: DecisionStatus;
  context: string;
  options: string[];
  decision: string;
  consequences: string;
  date: string;
}

export interface Milestone extends Base {
  name: string;
  version?: string | null;
  targetDate?: string | null;
  status: MilestoneStatus;
  changelog: string;
}

export type ApiMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'OPTIONS';
export type ApiParamIn = 'path' | 'query' | 'header';

export interface ApiHeader {
  key: string;
  value: string;
  description: string;
}

export interface ApiParam {
  name: string;
  in: ApiParamIn;
  required: boolean;
  description: string;
}

export interface ApiResponse {
  status: number;
  contentType: string;
  description: string;
  body: string;
}

export interface ApiCollection extends Base {
  name: string;
  description: string;
}

export interface ApiEndpoint extends Base {
  collectionId?: string | null;
  method: ApiMethod;
  path: string;
  name: string;
  description: string;
  headers: ApiHeader[];
  params: ApiParam[];
  body: string;
  responses: ApiResponse[];
}

export type WhiteboardElementKind = 'stroke' | 'sticky' | 'text' | 'shape' | 'edge' | 'ref';
export type WhiteboardStrokeTool = 'pen' | 'eraser';
export type WhiteboardShapeType = 'rect' | 'diamond' | 'ellipse';

export interface WhiteboardStroke {
  id: string;
  kind: 'stroke';
  tool: WhiteboardStrokeTool;
  color: string;
  width: number;
  thinning: number;
  points: Array<[number, number]>;
}

export interface WhiteboardSticky {
  id: string;
  kind: 'sticky';
  x: number;
  y: number;
  w: number;
  h: number;
  color: string;
  text: string;
}

export interface WhiteboardText {
  id: string;
  kind: 'text';
  x: number;
  y: number;
  color: string;
  fontSize: number;
  text: string;
}

export interface WhiteboardShape {
  id: string;
  kind: 'shape';
  shapeType: WhiteboardShapeType;
  x: number;
  y: number;
  w: number;
  h: number;
  color: string;
  fill: boolean;
  strokeWidth: number;
  label: string;
}

export interface WhiteboardEdge {
  id: string;
  kind: 'edge';
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  color: string;
  width: number;
  arrowhead: boolean;
  sourceNodeId?: string | null;
  targetNodeId?: string | null;
  sourcePort?: 'top' | 'right' | 'bottom' | 'left' | null;
  targetPort?: 'top' | 'right' | 'bottom' | 'left' | null;
}

export interface WhiteboardRef {
  id: string;
  kind: 'ref';
  entity: 'tasks' | 'issues';
  entityId: string;
  x: number;
  y: number;
}

export type WhiteboardElement =
  | WhiteboardStroke
  | WhiteboardSticky
  | WhiteboardText
  | WhiteboardShape
  | WhiteboardEdge
  | WhiteboardRef;

export interface Whiteboard extends Base {
  name: string;
  description: string;
  elements: WhiteboardElement[];
}

export interface State {
  tasks: Task[];
  issues: Issue[];
  testCases: TestCase[];
  techEntries: TechEntry[];
  tables: Table[];
  relations: Relation[];
  schemaVersions: SchemaVersion[];
  decisions: Decision[];
  milestones: Milestone[];
  apiCollections: ApiCollection[];
  apiEndpoints: ApiEndpoint[];
  whiteboards: Whiteboard[];
}

export interface ExportMeta {
  app: 'devhub';
  version: string;
  exportedAt: string;
  projectId: string;
}

export interface ExportDocument {
  meta: ExportMeta;
  state: State;
}

export interface ProjectPrd {
  purpose: string;
  goals: string;
  features: string;
  scope: string;
  outOfScope: string;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  status: ProjectStatus;
  visibility: 'private' | 'public';
  tabs: PublicTab[];
  prd: ProjectPrd;
  teamId: string;
  teamName: string;
  role: TeamRole;
  createdAt: string;
  updatedAt: string;
}

export interface PublicProject {
  id: string;
  name: string;
  description: string;
  status: ProjectStatus;
  visibility: 'private' | 'public';
  tabs: PublicTab[];
  prd: ProjectPrd;
  teamName: string;
  createdAt: string;
  updatedAt: string;
}

export type TeamRole = 'owner' | 'admin' | 'editor' | 'viewer';

export interface Team {
  id: string;
  name: string;
  role: TeamRole;
  memberCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface TeamMember {
  id: string;
  email: string;
  role: TeamRole;
  joinedAt: string;
}

export interface ProjectTemplate {
  id: string;
  teamId: string;
  teamName: string;
  name: string;
  description: string;
  createdAt: string;
  updatedAt: string;
}

export interface Invitation {
  id: string;
  teamId: string;
  teamName: string;
  role: TeamRole;
  createdAt: string;
  expiresAt: string;
}

export interface TeamInvitation {
  id: string;
  email: string;
  role: TeamRole;
  createdAt: string;
  expiresAt: string;
}

export interface ChatRef {
  entity: string;
  entityId: string;
}

export interface ChatMessage {
  id: string;
  teamId: string;
  authorId: string | null;
  authorName: string;
  content: string;
  refs: ChatRef[];
  createdAt: string;
}

export interface User {
  id: string;
  email: string;
  displayName: string;
  bio: string;
  createdAt: string;
}

export interface McpKey {
  id: string;
  name: string;
  prefix: string;
  createdAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
}

export interface McpKeyCreated extends McpKey {
  key: string;
}
