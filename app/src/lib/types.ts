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
  dueDate?: string | null;
  startDate?: string | null;
  completedAt?: string | null;
  assigneeId?: string | null;
  pinned?: boolean;
  description: string;
}

export interface Issue extends Base {
  title: string;
  severity: IssueSeverity;
  status: IssueStatus;
  description: string;
  reproduction: string;
  linkedTaskId?: string | null;
  pinned?: boolean;
}

export interface TestCase extends Base {
  name: string;
  taskId?: string | null;
  issueId?: string | null;
  steps: string;
  expected: string;
  status: TestCaseStatus;
  pinned?: boolean;
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
  pinned?: boolean;
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

export type WhiteboardElementKind = 'stroke' | 'sticky' | 'text' | 'shape' | 'edge' | 'boundary' | 'ref';
export type WhiteboardStrokeTool = 'pen' | 'eraser';
export type WhiteboardShapeType =
  | 'rect'
  | 'diamond'
  | 'ellipse'
  | 'cylinder'
  | 'parallelogram'
  | 'hexagon'
  | 'roundedRect';
export type WhiteboardArrowStyle = 'none' | 'open' | 'solid' | 'diamond' | 'circle';

export interface WhiteboardStroke {
  id: string;
  kind: 'stroke';
  tool: 'pen' | 'eraser';
  color: string;
  width: number;
  thinning: number;
  points: [number, number][];
  locked?: boolean;
  groupId?: string | null;
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
  rotation?: number;
  locked?: boolean;
  groupId?: string | null;
}

export interface WhiteboardText {
  id: string;
  kind: 'text';
  x: number;
  y: number;
  color: string;
  fontSize: number;
  text: string;
  w?: number | null;
  rotation?: number;
  locked?: boolean;
  groupId?: string | null;
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
  rotation?: number;
  locked?: boolean;
  groupId?: string | null;
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
  label: string;
  arrowStyle: WhiteboardArrowStyle;
  dash?: 'solid' | 'dashed' | 'dotted';
  locked?: boolean;
  groupId?: string | null;
  sourceNodeId?: string | null;
  targetNodeId?: string | null;
  sourcePort?: 'top' | 'right' | 'bottom' | 'left' | null;
  targetPort?: 'top' | 'right' | 'bottom' | 'left' | null;
}

export interface WhiteboardBoundary {
  id: string;
  kind: 'boundary';
  x: number;
  y: number;
  w: number;
  h: number;
  color: string;
  label: string;
  locked?: boolean;
  groupId?: string | null;
}

export type WhiteboardRefEntity =
  | 'tasks'
  | 'issues'
  | 'testCases'
  | 'milestones'
  | 'techEntries'
  | 'decisions'
  | 'tables'
  | 'apiCollections'
  | 'apiEndpoints';

export interface WhiteboardRef {
  id: string;
  kind: 'ref';
  entity: WhiteboardRefEntity;
  entityId: string;
  x: number;
  y: number;
  locked?: boolean;
  groupId?: string | null;
}

export type WhiteboardElement =
  | WhiteboardStroke
  | WhiteboardSticky
  | WhiteboardText
  | WhiteboardShape
  | WhiteboardEdge
  | WhiteboardBoundary
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
  prd: ProjectPrd | null;
  teamName: string;
  createdAt: string;
  updatedAt: string;
}

export type TeamRole = 'owner' | 'admin' | 'editor' | 'viewer';

export type TeamPlan = 'free' | 'pro';

export interface PackagePrice {
  id: string;
  durationDays: number;
  priceIdr: number;
  originalPriceIdr: number | null;
}

export interface BillingPackage {
  id: string;
  name: string;
  description: string;
  isFree: boolean;
  maxMembers: number | null;
  maxProjects: number | null;
  prices: PackagePrice[];
}

export interface BillingPayment {
  orderId: string;
  packageName: string;
  durationDays: number | null;
  amount: number;
  status: string;
  createdAt: string;
  completedAt: string | null;
}

export interface PaymentHistoryItem {
  orderId: string;
  teamName: string;
  packageName: string;
  durationDays: number | null;
  amount: number;
  status: string;
  createdAt: string;
  completedAt: string | null;
}

export interface BillingUsageItem {
  used: number;
  limit: number | null;
}

export interface BillingStatus {
  team: {
    id: string;
    name: string;
    plan: TeamPlan;
    planExpiresAt: string | null;
  };
  usage: {
    members: BillingUsageItem;
    projects: BillingUsageItem;
  };
  payments: BillingPayment[];
}

export interface Team {
  id: string;
  name: string;
  role: TeamRole;
  plan: TeamPlan;
  memberCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface TeamMember {
  id: string;
  email: string;
  displayName?: string;
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

export interface ChatResolvedRef {
  entity: string;
  entityId: string;
  projectId: string | null;
  title: string | null;
}

export interface User {
  id: string;
  email: string;
  displayName: string;
  bio: string;
  role: 'user' | 'admin';
  createdAt: string;
}

export interface AdminStats {
  users: number;
  teams: number;
  projects: number;
  activeKeys: number;
  activity24h: number;
  activity7d: number;
  revenue24h: number;
  revenue7d: number;
  revenueTotal: number;
  paidTeams: number;
  pendingPayments: number;
}

export interface AdminCharts {
  revenueByDay: Array<{ date: string; amount: number }>;
  revenueByPackage: Array<{ name: string; amount: number }>;
}

export interface AdminActivityChart {
  date: string;
  label: string;
  count: number;
}

export interface AdminUser {
  id: string;
  email: string;
  displayName: string;
  role: 'user' | 'admin';
  teamCount: number;
  createdAt: string;
  lastActiveAt: string | null;
  plan: string | null;
  lastPaymentAmount: number | null;
  lastPaymentAt: string | null;
}

export interface AdminTeam {
  id: string;
  name: string;
  ownerEmail: string | null;
  memberCount: number;
  projectCount: number;
  createdAt: string;
}

export interface AdminPayment {
  id: string;
  teamId: string;
  teamName: string;
  orderId: string;
  buyerEmail: string;
  packageName: string;
  durationDays: number | null;
  amount: number;
  status: string;
  createdAt: string;
  completedAt: string | null;
}

export interface AdminPackagePrice {
  id: string;
  durationDays: number;
  priceIdr: number;
  originalPriceIdr: number | null;
}

export interface AdminPackage {
  id: string;
  name: string;
  description: string;
  isFree: boolean;
  maxMembers: number | null;
  maxProjects: number | null;
  sortOrder: number;
  isActive: boolean;
  prices: AdminPackagePrice[];
}

export interface McpKey {
  id: string;
  name: string;
  prefix: string;
  createdAt: string;
  /** Tidak ada pada payload pembuatan key — baru terisi saat list */
  lastUsedAt?: string | null;
  /** Bisa di-reveal ulang (key disimpan terenkripsi); false = key lama */
  revealable: boolean;
}

export interface McpKeyCreated extends McpKey {
  key: string;
}

/** Respons GET /api/v1/keys — hanya key aktif, dipaginasi gaya GitHub */
export interface McpKeyList {
  keys: McpKey[];
  total: number;
  page: number;
  perPage: number;
}

/** Statistik profil gaya GitHub (ADR-039), dihitung server dari activity_log. */
export interface ActivityDay {
  date: string;
  count: number;
}

export interface UserStats {
  totalContributions: number;
  taskCompletions: number;
  issuesResolved: number;
  activeDays: number;
  currentStreak: number;
  longestStreak: number;
  days: ActivityDay[];
}

/** Badge unread server-side (ADR M32): agregat SQL vs watermark baca di DB. */
export interface ActivityUnreadDeleted {
  id: string;
  entity: string;
  entityId: string;
  authorName: string;
  summary: string;
  createdAt: string;
}

export interface ActivityUnreadSummary {
  counts: Record<string, number>;
  ids: Record<string, string[]>;
  deleted: ActivityUnreadDeleted[];
  watermarks: Record<string, string>;
}
