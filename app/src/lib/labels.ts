import type { BadgeTone } from '../components/Badge';
import type {
  DecisionStatus,
  IssueSeverity,
  IssueStatus,
  MilestoneStatus,
  ProjectStatus,
  TaskPriority,
  TaskStatus,
  TeamRole,
  TechEntryCategory,
  TechStatus,
  TestCaseStatus,
} from './types';

interface Meta {
  label: string;
  tone: BadgeTone;
}

export const TASK_STATUS: Record<TaskStatus, Meta> = {
  todo: { label: 'Todo', tone: 'neutral' },
  inProgress: { label: 'In Progress', tone: 'info' },
  review: { label: 'Review', tone: 'warn' },
  done: { label: 'Done', tone: 'success' },
};

export const TASK_PRIORITY: Record<TaskPriority, Meta> = {
  low: { label: 'Low', tone: 'neutral' },
  medium: { label: 'Medium', tone: 'info' },
  high: { label: 'High', tone: 'warn' },
  urgent: { label: 'Urgent', tone: 'danger' },
};

export const TASK_PRIORITY_ORDER: TaskPriority[] = ['low', 'medium', 'high', 'urgent'];

export const ISSUE_SEVERITY: Record<IssueSeverity, Meta> = {
  critical: { label: 'Critical', tone: 'danger' },
  high: { label: 'High', tone: 'warn' },
  medium: { label: 'Medium', tone: 'info' },
  low: { label: 'Low', tone: 'neutral' },
};

export const ISSUE_STATUS: Record<IssueStatus, Meta> = {
  open: { label: 'Open', tone: 'info' },
  reproduced: { label: 'Reproduced', tone: 'warn' },
  fixing: { label: 'Fixing', tone: 'accent' },
  resolved: { label: 'Resolved', tone: 'success' },
  wontfix: { label: "Won't Fix", tone: 'neutral' },
};

export const TEST_CASE_STATUS: Record<TestCaseStatus, Meta> = {
  pass: { label: 'Pass', tone: 'success' },
  fail: { label: 'Fail', tone: 'danger' },
  pending: { label: 'Pending', tone: 'neutral' },
};

export const TECH_CATEGORY: Record<TechEntryCategory, Meta> = {
  frontend: { label: 'Frontend', tone: 'info' },
  backend: { label: 'Backend', tone: 'accent' },
  database: { label: 'Database', tone: 'warn' },
  tooling: { label: 'Tooling', tone: 'neutral' },
};

export const TECH_STATUS: Record<TechStatus, Meta> = {
  current: { label: 'Current', tone: 'success' },
  updateAvailable: { label: 'Update Available', tone: 'warn' },
  majorUpgrade: { label: 'Major Upgrade', tone: 'danger' },
};

export const DECISION_STATUS: Record<DecisionStatus, Meta> = {
  proposed: { label: 'Proposed', tone: 'info' },
  accepted: { label: 'Accepted', tone: 'success' },
  rejected: { label: 'Rejected', tone: 'danger' },
  superseded: { label: 'Superseded', tone: 'neutral' },
};

export const MILESTONE_STATUS: Record<MilestoneStatus, Meta> = {
  planned: { label: 'Planned', tone: 'neutral' },
  inProgress: { label: 'In Progress', tone: 'info' },
  released: { label: 'Released', tone: 'success' },
};

export const PROJECT_STATUS: Record<ProjectStatus, Meta> = {
  active: { label: 'Active', tone: 'success' },
  archived: { label: 'Archived', tone: 'neutral' },
};

export const TEAM_ROLE: Record<TeamRole, Meta> = {
  owner: { label: 'Owner', tone: 'accent' },
  admin: { label: 'Admin', tone: 'info' },
  editor: { label: 'Editor', tone: 'neutral' },
  viewer: { label: 'Viewer', tone: 'warn' },
};
