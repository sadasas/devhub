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

export interface ChecklistItem {
  id: string;
  title: string;
  done: boolean;
}

export type AttachmentProvider = 'devhub' | 'link';

export interface Attachment {
  id: string;
  provider: AttachmentProvider;
  name: string;
  mime: string;
  /** Byte; 0 untuk tipe tautan (tak dihitung kuota). */
  size: number;
  storageKey?: string | null;
  url?: string | null;
  linkedBy?: string | null;
  linkedAt: string;
}

export type LabelColor =
  | 'red'
  | 'orange'
  | 'amber'
  | 'green'
  | 'emerald'
  | 'teal'
  | 'sky'
  | 'blue'
  | 'violet'
  | 'pink'
  | 'slate'
  | 'lime';

export interface LabelDef extends Base {
  name: string;
  color: LabelColor;
  description: string;
}

export interface GitHubLink {
  id: string;
  repo: string;
  kind: 'branch' | 'pr' | 'commit';
  ref: string;
  url: string;
  title: string;
  status: 'open' | 'draft' | 'merged' | 'closed' | 'unknown';
  lastSyncedAt?: string | null;
  linkedBy?: string | null;
  linkedAt?: string | null;
  ciState?: 'pass' | 'fail' | 'pending' | null;
  reviewState?: 'approved' | 'changes_requested' | null;
}

export interface GitHubRepo {
  owner: string;
  repo: string;
}

export type GitHubAutomationMode = 'suggest' | 'auto' | 'off';

export interface GitHubAutomation {
  onPrOpened: GitHubAutomationMode;
  onPrMerged: GitHubAutomationMode;
}

export interface GitHubStatus {
  connected: boolean;
  owner: string | null;
  repo: string | null;
  installationId: number | null;
  accountLogin: string | null;
  automation: GitHubAutomation | null;
}

export interface GitHubInstallationRepo {
  owner: string;
  repo: string;
  fullName: string;
  isPrivate: boolean;
}

export interface Task extends Base {
  title: string;
  status: TaskStatus;
  priority: TaskPriority;
  estimate?: number;
  actualHours?: number;
  labels: string[];
  blockedBy: string[];
  parentTaskId?: string | null;
  checklist?: ChecklistItem[];
  milestoneId?: string | null;
  dueDate?: string | null;
  startDate?: string | null;
  completedAt?: string | null;
  assigneeId?: string | null;
  pinned?: boolean;
  description: string;
  attachments?: Attachment[];
  githubLinks?: GitHubLink[];
}

export interface Issue extends Base {
  title: string;
  severity: IssueSeverity;
  status: IssueStatus;
  description: string;
  reproduction: string;
  linkedTaskId?: string | null;
  pinned?: boolean;
  attachments?: Attachment[];
  fixPr?: GitHubLink | null;
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
  autoincrement?: boolean;
  default?: string | null;
  comment: string;
}

export interface Table extends Base {
  name: string;
  comment: string;
  color?: string | null;
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
  milestoneId?: string | null;
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
  milestoneId?: string | null;
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
  | 'roundedRect'
  | 'triangleUp'
  | 'triangleDown'
  | 'capsule'
  | 'triangleRight'
  | 'hCylinder'
  | 'trapezoid'
  | 'trapezoidRight'
  | 'pentagon'
  | 'octagon'
  | 'document'
  | 'snipRect'
  | 'chamferRect'
  | 'roundedDiamond'
  | 'plusBlock'
  | 'chevronRight'
  | 'doubleChevron'
  | 'pentagonRight'
  | 'star5'
  | 'star4'
  | 'sealBurst'
  | 'shieldBox'
  | 'semicircle'
  | 'pieSlice'
  | 'nutHex'
  | 'cubeBox'
  | 'envelopeBox'
  | 'calendarBox'
  | 'clockFace'
  | 'predefinedProcess'
  | 'manualInput'
  | 'offPageRef'
  | 'delayHalf'
  | 'multiDocument'
  | 'orJunction'
  | 'sumJunction'
  | 'crossDoc'
  | 'intermediateRing'
  | 'messageEvent'
  | 'timerEvent'
  | 'errorEvent'
  | 'exclusiveGateway'
  | 'parallelGateway'
  | 'inclusiveGateway'
  | 'complexGateway'
  | 'subProcess'
  | 'taskMarker'
  | 'classBox'
  | 'packageBox'
  | 'componentBox'
  | 'actorFigure'
  | 'nodeBox'
  | 'interfaceBall'
  | 'objectBox'
  | 'signalReceipt'
  | 'partitionActivity'
  | 'generalizationTri'
  | 'weakEntity'
  | 'identifyingRel'
  | 'multiAttribute'
  | 'keyAttribute'
  | 'associativeBox'
  | 'categoryCluster'
  | 'ternaryInner'
  | 'datastoreOpen'
  | 'yourdonStore'
  | 'diskStack'
  | 'fileRuled'
  | 'punchCard'
  | 'serverBox'
  | 'routerBox'
  | 'cloudShape'
  | 'firewallBox'
  | 'antennaTower'
  | 'printerBox'
  | 'switchStack'
  | 'hubSpoke'
  | 'modemBox'
  | 'satelliteDish'
  | 'laptopSlab'
  | 'rackCabinet'
  | 'loadBalancer'
  | 'podHex'
  | 'serviceMesh'
  | 'deployBox'
  | 'ingressArrow'
  | 'configBox'
  | 'namespaceBox'
  | 'cronBox'
  | 'secretVault'
  | 'bandedCylinder'
  | 'sidecarBox'
  | 'readinessProbe'
  | 'replicaBars';
export type WhiteboardArrowStyle = 'none' | 'open' | 'solid' | 'diamond' | 'circle';
export type WhiteboardAlign = 'left' | 'center' | 'right';
export type WhiteboardValign = 'top' | 'center' | 'bottom';
export type WhiteboardFontFamily = 'simple' | 'bookish' | 'technical' | 'scribbled';
export type WhiteboardTextList = 'none' | 'bullet';
export type WhiteboardShapeDash = 'solid' | 'dashed' | 'none';

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
  textColor?: string | null;
  fontSize?: number | null;
  align?: WhiteboardAlign | null;
  valign?: WhiteboardValign | null;
  fontFamily?: WhiteboardFontFamily | null;
  bold?: boolean | null;
  strikethrough?: boolean | null;
  list?: WhiteboardTextList | null;
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
  align?: WhiteboardAlign | null;
  fontFamily?: WhiteboardFontFamily | null;
  bold?: boolean | null;
  strikethrough?: boolean | null;
  list?: WhiteboardTextList | null;
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
  dash?: WhiteboardShapeDash | null;
  label: string;
  labelColor?: string | null;
  fontSize?: number | null;
  align?: WhiteboardAlign | null;
  valign?: WhiteboardValign | null;
  fontFamily?: WhiteboardFontFamily | null;
  bold?: boolean | null;
  strikethrough?: boolean | null;
  list?: WhiteboardTextList | null;
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
  fontSize?: number | null;
  align?: WhiteboardAlign | null;
  fontFamily?: WhiteboardFontFamily | null;
  bold?: boolean | null;
  strikethrough?: boolean | null;
  list?: WhiteboardTextList | null;
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
  labelColor?: string | null;
  fontSize?: number | null;
  align?: WhiteboardAlign | null;
  fontFamily?: WhiteboardFontFamily | null;
  bold?: boolean | null;
  strikethrough?: boolean | null;
  list?: WhiteboardTextList | null;
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

/** Area grup tabel di ERD — bounds dihitung render-time dari tabel anggota. */
export interface ErdGroup extends Base {
  name: string;
  color?: string | null;
  tableIds: string[];
  /** Geometri eksplisit (kanvas); absen = bounds turunan anggota. */
  x?: number | null;
  y?: number | null;
  w?: number | null;
  h?: number | null;
}

export interface ErdPosition {
  x: number;
  y: number;
}

export type ErdLayout = Record<string, ErdPosition>;

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
  /** Definisi label berwarna (zod default [] — opsional agar state lama tetap valid). */
  labelDefs?: LabelDef[];
  erdGroups?: ErdGroup[];
  timelineOrder?: Record<string, string[]>;
  timelineRow?: Record<string, Record<string, number>>;
  erdLayout?: ErdLayout;
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
  /** Opt-in owner CTA (fail-closed: undefined/null/'' = tidak tampil). */
  contactUrl?: string | null;
  liveDemoUrl?: string | null;
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
  /** Opt-in owner CTA (fail-closed: hanya http(s) valid yang dirender). */
  contactUrl?: string | null;
  liveDemoUrl?: string | null;
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
  /** Byte; null = unlimited, 0 = tanpa upload. */
  maxStorageBytes: number | null;
  sortOrder: number;
  isFeatured: boolean;
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
  teamId: string;
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

export interface BillingPendingPackage {
  id: string;
  name: string;
  maxMembers: number | null;
  maxProjects: number | null;
  maxStorageBytes: number | null;
  durationDays: number;
  activateAt: string;
  createdAt: string;
}

export interface BillingStatus {
  team: {
    id: string;
    name: string;
    plan: TeamPlan;
    planExpiresAt: string | null;
    planPackageName: string;
    planPackageId?: string | null;
    pendingPackage?: BillingPendingPackage | null;
  };
  usage: {
    members: BillingUsageItem;
    projects: BillingUsageItem;
    storage: { usedBytes: number; limitBytes: number | null };
  };
  payments: BillingPayment[];
}

export interface Team {
  id: string;
  name: string;
  icon?: string | null;
  slug: string;
  role: TeamRole;
  plan: TeamPlan;
  planPackageName: string;
  memberCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface TeamMember {
  id: string;
  email: string;
  displayName?: string;
  avatarUrl?: string | null;
  role: TeamRole;
  joinedAt: string;
}

export interface ProjectTemplate {
  id: string;
  ownerId: string;
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
  authorAvatarUrl?: string | null;
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
  avatarUrl?: string | null;
  emailVerified?: boolean;
  /** Deadline grace period user lama (ISO) — null = hard gate / sudah verified. Untuk banner UI (T6/T7). */
  graceUntil?: string | null;
  hasPassword?: boolean;
  providers?: string[];
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

/** Badge unread server-side (ADR M32 — M38 revisi: hanya new+deleted, pill NEW, banner per tab). */
export interface ActivityUnreadDeleted {
  id: string;
  entity: string;
  entityId: string;
  authorName: string;
  summary: string;
  createdAt: string;
  tab: string;
}

export interface UnreadCounts {
  new: number;
  deleted: number;
  total: number;
}

export interface UnreadIds {
  new: string[];
  deleted: string[];
}

export interface ActivityUnreadSummary {
  counts: Record<string, UnreadCounts>;
  ids: Record<string, UnreadIds>;
  deleted: ActivityUnreadDeleted[];
  watermarks: Record<string, string>;
  // legacy compat (server lama): counts flat number, ids flat string[] — di-handle di hook
}
