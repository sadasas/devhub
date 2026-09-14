import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { api } from '../../lib/api';
import type { PublicProject, State } from '../../lib/types';
import { PublicProjectPage } from './PublicProjectPage';

vi.mock('../../state/auth-context', () => ({
  useAuth: () => ({ user: null }),
}));

const PROJECT_ID = '11111111-1111-4111-8111-111111111111';

function makeMeta(over: Partial<PublicProject> = {}): PublicProject {
  return {
    id: PROJECT_ID,
    name: 'Demo Project',
    description: 'A public demo',
    status: 'active',
    visibility: 'public',
    tabs: ['board', 'issues', 'stack', 'milestones', 'about'],
    prd: {
      purpose: '',
      goals: '',
      features: '',
      scope: '',
      outOfScope: '',
    },
    teamName: 'Personal',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-02T00:00:00.000Z',
    ...over,
  };
}

function makeState(over: Partial<State> = {}): State {
  return {
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
    ...over,
  };
}

const TASK = {
  id: 't1',
  title: 'Public task detail',
  status: 'inProgress' as const,
  priority: 'high' as const,
  estimate: 5,
  actualHours: 2,
  labels: ['frontend', 'urgent-fix'],
  blockedBy: ['t2'],
  milestoneId: 'm1',
  dueDate: '2026-09-18',
  startDate: '2026-09-10',
  completedAt: null,
  assigneeId: null,
  description: 'Task **markdown** body.',
  createdAt: '2026-09-01T10:00:00.000Z',
  updatedAt: '2026-09-12T10:00:00.000Z',
};

const BLOCKER = {
  id: 't2',
  title: 'Blocker task',
  status: 'todo' as const,
  priority: 'medium' as const,
  labels: [],
  blockedBy: [],
  milestoneId: null,
  dueDate: null,
  startDate: null,
  completedAt: null,
  assigneeId: null,
  description: '',
  createdAt: '2026-09-01T10:00:00.000Z',
  updatedAt: '2026-09-01T10:00:00.000Z',
};

const ISSUE = {
  id: 'i1',
  title: 'Public issue detail',
  severity: 'critical' as const,
  status: 'open' as const,
  description: 'Issue **markdown** body.',
  reproduction: '1. Open\n2. Crash',
  linkedTaskId: 't1',
  createdAt: '2026-09-02T10:00:00.000Z',
  updatedAt: '2026-09-12T10:00:00.000Z',
};

function mockBackend(state: State, metaOver: Partial<PublicProject> = {}) {
  vi.spyOn(api, 'getPublicProject').mockResolvedValue(makeMeta(metaOver));
  vi.spyOn(api, 'getPublicState').mockResolvedValue({ state, version: 1 });
}

function renderPage(entry: string) {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <PublicProjectPage />
    </MemoryRouter>,
  );
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('PublicDetailModal (DetailShell read-only)', () => {
  it('renders the task modal with the same DetailShell layout as edit, without activity or edit controls', async () => {
    const fetchActivity = vi.spyOn(api, 'fetchActivity');
    mockBackend(
      makeState({
        tasks: [TASK, BLOCKER],
        milestones: [
          { id: 'm1', name: 'Alpha', version: null, status: 'planned', targetDate: null, changelog: '', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' },
        ],
        testCases: [
          { id: 'tc1', name: 'TC one', taskId: 't1', issueId: null, steps: 's', expected: 'e', status: 'pass', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' },
        ],
      }),
    );

    renderPage(`/p/${PROJECT_ID}?tab=board&task=t1`);
    await screen.findByRole('heading', { name: 'Demo Project' });

    const dialog = await screen.findByRole('dialog');
    expect(dialog.className).toContain('modal-composer');
    const modal = within(dialog);
    // Sidebar properti ala modal edit
    expect(modal.getByText('Properties')).toBeDefined();
    expect(modal.getByText('Status')).toBeDefined();
    expect(modal.getByText('Alpha')).toBeDefined();
    expect(modal.getByText('frontend')).toBeDefined();
    expect(modal.getByText('5h')).toBeDefined();
    expect(modal.getByText('1 linked')).toBeDefined();
    expect(modal.getByText('Blocker task')).toBeDefined();
    // Konten utama (markdown dirender: **markdown** jadi <strong>)
    expect(modal.getByText('Public task detail')).toBeDefined();
    expect(modal.getByText((_, el) => el?.tagName === 'P' && el.textContent === 'Task markdown body.')).toBeDefined();
    expect(modal.getByText('markdown')).toBeDefined();
    // Read-only: tanpa activity, tanpa delete, tanpa fetch activity
    expect(modal.queryByText('Activity')).toBeNull();
    expect(modal.queryByRole('button', { name: 'Delete' })).toBeNull();
    expect(fetchActivity).not.toHaveBeenCalled();
  });

  it('renders the issue modal with description + reproduction, and the linked task navigates to the task modal', async () => {
    mockBackend(makeState({ tasks: [TASK, BLOCKER], issues: [ISSUE] }));

    renderPage(`/p/${PROJECT_ID}?tab=issues&issue=i1`);
    await screen.findByRole('heading', { name: 'Demo Project' });

    const dialog = await screen.findByRole('dialog');
    expect(dialog.className).toContain('modal-composer');
    const modal = within(dialog);
    expect(modal.getByText('Public issue detail')).toBeDefined();
    expect(modal.getByText((_, el) => el?.tagName === 'P' && el.textContent === 'Issue markdown body.')).toBeDefined();
    expect(modal.getByText('Reproduction steps')).toBeDefined();
    expect(modal.queryByText('Activity')).toBeNull();
    expect(modal.queryByRole('button', { name: 'Delete' })).toBeNull();

    fireEvent.click(modal.getByRole('button', { name: 'Public task detail' }));
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeDefined();
      expect(within(screen.getByRole('dialog')).getByText('Properties')).toBeDefined();
    });
  });

  it('renders no dialog without ?task= / ?issue=', async () => {
    mockBackend(makeState({ tasks: [TASK], issues: [ISSUE] }));

    renderPage(`/p/${PROJECT_ID}?tab=board`);
    await screen.findByRole('heading', { name: 'Demo Project' });
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
  });
});

describe('PublicDetailModal overflow (wrap, bukan scrollbar horizontal)', () => {
  const LONG = 'K'.repeat(200);
  const LONG_URL = `https://example.com/${'p'.repeat(280)}`;

  it('task modal: judul/label/URL/milestone tanpa spasi ter-render di kontainer wrap', async () => {
    mockBackend(
      makeState({
        tasks: [
          {
            ...TASK,
            id: 'tw',
            title: `Task ${LONG}`,
            labels: [`label-${LONG}`, 'ok'],
            milestoneId: 'mw',
            description: `Lihat ${LONG_URL} untuk detail.`,
          },
        ],
        milestones: [
          { id: 'mw', name: `Milestone ${LONG}`, version: null, status: 'planned', targetDate: null, changelog: '', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' },
        ],
      }),
    );

    const { container } = renderPage(`/p/${PROJECT_ID}?tab=board&task=tw`);
    await screen.findByRole('heading', { name: 'Demo Project' });
    const dialog = await screen.findByRole('dialog');
    const modal = within(dialog);
    void container;

    // Kontrak struktur yang ditarget rule CSS wrap (modal via portal → query dari dialog):
    // - judul di h3.detail-title (punya overflow-wrap, bukan nowrap)
    // - deskripsi di .md-blocks (punya overflow-wrap + min-width:0)
    // - sidebar .detail-side (overflow-x: clip)
    const title = modal.getByText((_, el) => el?.tagName === 'H3' && (el.textContent ?? '').startsWith('Task K'));
    expect(title.className).toContain('detail-title');
    expect(title.style.whiteSpace).not.toBe('nowrap');
    expect(dialog.querySelector('.detail-side')).not.toBeNull();
    expect(dialog.querySelector('.md-blocks')).not.toBeNull();
    // Pill status/priority adalah span langsung baris [data-prop] → ditarget
    // rule hug-content (flex:0 0 auto), bukan selebar sidebar.
    for (const prop of ['status', 'priority']) {
      const row = dialog.querySelector(`.detail-side .prop[data-prop='${prop}']`);
      expect(row).not.toBeNull();
      const view = row!.querySelector(':scope > span:not(.prop-label)');
      expect(view?.tagName).toBe('SPAN');
    }
  });

  it('issue modal: severity/status pill + repro URL panjang ter-render di kontainer wrap', async () => {
    mockBackend(
      makeState({
        issues: [{ ...ISSUE, id: 'iw', title: `Issue ${LONG}`, reproduction: `Buka ${LONG_URL}` }],
      }),
    );

    const { container } = renderPage(`/p/${PROJECT_ID}?tab=issues&issue=iw`);
    await screen.findByRole('heading', { name: 'Demo Project' });
    const dialog = await screen.findByRole('dialog');
    const modal = within(dialog);
    void container;

    expect(modal.getByText((_, el) => el?.tagName === 'H3' && (el.textContent ?? '').startsWith('Issue K'))).toBeDefined();
    expect(dialog.querySelector('.detail-side')).not.toBeNull();
    for (const prop of ['severity', 'status']) {
      const row = dialog.querySelector(`.detail-side .prop[data-prop='${prop}']`);
      expect(row).not.toBeNull();
      const view = row!.querySelector(':scope > span:not(.prop-label)');
      expect(view?.tagName).toBe('SPAN');
    }
  });
});

describe('PublicProjectPage chrome', () => {  it('has no Lihat Board button, no tab counts, and the footer sticks to the bottom outside main', async () => {
    mockBackend(makeState({ tasks: [TASK] }));

    const { container } = renderPage(`/p/${PROJECT_ID}?tab=issues`);
    await screen.findByRole('heading', { name: 'Demo Project' });

    expect(screen.queryByRole('button', { name: /Lihat Board|View Board/ })).toBeNull();
    expect(container.querySelectorAll('.tab-count').length).toBe(0);
    // Footer di luar <main>, di dalam .public-footer (margin-top:auto -> pojok bawah)
    expect(container.querySelector('main .legal-footer')).toBeNull();
    expect(container.querySelector('.public-footer .legal-footer')).not.toBeNull();
  });
});

describe('PublicProjectPage owner CTA', () => {
  it('renders Contact + View Demo links when URLs are valid http(s)', async () => {
    mockBackend(makeState({ tasks: [TASK] }), {
      contactUrl: 'https://owner.example/contact',
      liveDemoUrl: 'https://demo.example/app',
    });

    renderPage(`/p/${PROJECT_ID}?tab=board`);
    await screen.findByRole('heading', { name: 'Demo Project' });

    const group = await screen.findByRole('group', { name: 'Owner links' });
    const contact = within(group).getByRole('link', { name: 'Contact' });
    const demo = within(group).getByRole('link', { name: 'View Demo' });
    expect(contact.getAttribute('href')).toBe('https://owner.example/contact');
    expect(demo.getAttribute('href')).toBe('https://demo.example/app');
    for (const link of [contact, demo]) {
      expect(link.getAttribute('target')).toBe('_blank');
      expect(link.getAttribute('rel')).toContain('noopener');
    }
  });

  it.each([
    ['null', { contactUrl: null, liveDemoUrl: null }],
    ['empty', { contactUrl: '', liveDemoUrl: '   ' }],
    ['non-http', { contactUrl: 'javascript:alert(1)', liveDemoUrl: 'ftp://files.example/x' }],
  ])('renders no owner links when URLs are %s (fail-closed)', async (_, metaOver) => {
    mockBackend(makeState({ tasks: [TASK] }), metaOver);

    renderPage(`/p/${PROJECT_ID}?tab=board`);
    await screen.findByRole('heading', { name: 'Demo Project' });
    await waitFor(() => {
      expect(screen.queryByRole('group', { name: 'Owner links' })).toBeNull();
    });
    expect(screen.queryByRole('link', { name: 'Contact' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'View Demo' })).toBeNull();
  });
});
