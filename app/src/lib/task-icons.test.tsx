import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { IssueStatusIcon, TaskPriorityIcon, TaskSeverityIcon, TaskStatusIcon } from './task-icons';
import type { IssueSeverity, IssueStatus, TaskPriority, TaskStatus } from './types';

const STATUSES: TaskStatus[] = ['todo', 'inProgress', 'review', 'done'];

describe('TaskStatusIcon', () => {
  it('renders a distinct icon per status', () => {
    const marks = STATUSES.map((status) => {
      const { container } = render(<TaskStatusIcon status={status} />);
      const svg = container.querySelector('svg');
      expect(svg).toBeTruthy();
      return svg?.outerHTML ?? '';
    });
    expect(new Set(marks).size).toBe(STATUSES.length);
  });

  it('hides the icon from assistive technology (label text stays the source)', () => {
    const { container } = render(<TaskStatusIcon status="review" />);
    expect(container.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
  });
});

describe('TaskPriorityIcon', () => {
  const priorities: TaskPriority[] = ['low', 'medium', 'high', 'urgent'];

  it('renders a distinct icon per priority', () => {
    const marks = priorities.map((priority) => {
      const { container } = render(<TaskPriorityIcon priority={priority} />);
      const svg = container.querySelector('svg');
      expect(svg).toBeTruthy();
      return svg?.outerHTML ?? '';
    });
    expect(new Set(marks).size).toBe(priorities.length);
  });
});

describe('TaskSeverityIcon', () => {
  const severities: IssueSeverity[] = ['critical', 'high', 'medium', 'low'];

  it('renders a distinct icon per severity', () => {
    const marks = severities.map((severity) => {
      const { container } = render(<TaskSeverityIcon severity={severity} />);
      const svg = container.querySelector('svg');
      expect(svg).toBeTruthy();
      return svg?.outerHTML ?? '';
    });
    expect(new Set(marks).size).toBe(severities.length);
  });
});

describe('IssueStatusIcon', () => {
  const statuses: IssueStatus[] = ['open', 'reproduced', 'fixing', 'resolved', 'wontfix'];

  it('renders a distinct icon per issue status', () => {
    const marks = statuses.map((status) => {
      const { container } = render(<IssueStatusIcon status={status} />);
      const svg = container.querySelector('svg');
      expect(svg).toBeTruthy();
      return svg?.outerHTML ?? '';
    });
    expect(new Set(marks).size).toBe(statuses.length);
  });
});
