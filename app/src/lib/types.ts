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

export interface SchemaVersion extends Base {
  version: string;
  appliedAt: string;
  notes: string;
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
