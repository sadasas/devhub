import { describe, expect, it, vi, beforeEach } from 'vitest';
import { act, fireEvent, render, renderHook, screen } from '@testing-library/react';
import { i18n } from '../../i18n';
import { useNewItemShortcut } from '../../hooks/useNewItemShortcut';
import { useTabShortcuts } from '../../hooks/useTabShortcuts';
import { OnboardingWizard } from './OnboardingWizard';
import { TourPopover } from './TourPopover';
import {
  arrowOffset,
  computePopoverPlacement,
  fastForwardStep,
  mergeRects,
  newestTeamId,
  resolveTarget,
  unionRect,
} from './tour-dom';
import { TourProgressPill } from './TourProgressPill';
import { TourSpotlight } from './TourSpotlight';
import {
  TOUR_FINISHED_KEY,
  TOUR_SKIPPED_KEY,
  TOUR_STEP_KEY,
  hasTourStep,
  isTourActive,
  isTourFinished,
  isTourSkipped,
  setTourActiveFlag,
  trackTourEvent,
} from './tour-events';
import { TOUR_STEPS } from './tourSteps';

function renderWizard(step = 0, overrides: Partial<Parameters<typeof OnboardingWizard>[0]> = {}) {
  const props = {
    step,
    total: 7,
    onNext: vi.fn(),
    onBack: vi.fn(),
    onSkip: vi.fn(),
    onFinish: vi.fn(),
    ...overrides,
  };
  const view = render(<OnboardingWizard {...props} />);
  return { ...props, ...view };
}

beforeEach(() => {
  localStorage.removeItem(TOUR_SKIPPED_KEY);
  localStorage.removeItem(TOUR_FINISHED_KEY);
  localStorage.removeItem(TOUR_STEP_KEY);
  setTourActiveFlag(false);
  document.body.classList.remove('tour-spotlight-on');
  document.body.innerHTML = '';
});

describe('tour i18n (project namespace)', () => {
  it("resolves t('tour.plan.title') in EN", async () => {
    await i18n.changeLanguage('en');
    expect(i18n.t('tour.plan.title', { ns: 'project' })).toBe('Plan: Board + Issues');
  });

  it("resolves t('tour.plan.title') in ID", async () => {
    await i18n.changeLanguage('id');
    expect(i18n.t('tour.plan.title', { ns: 'project' })).toBe('Rencana: Board + Issue');
    await i18n.changeLanguage('en');
  });

  it('has all 7 step titles + bodies in both locales', async () => {
    for (const lng of ['en', 'id'] as const) {
      await i18n.changeLanguage(lng);
      for (const s of TOUR_STEPS) {
        const title = i18n.t(`tour.${s.id}.title`, { ns: 'project' });
        const body = i18n.t(`tour.${s.id}.body`, { ns: 'project' });
        expect(title, `${lng}.${s.id}.title`).not.toBe(`tour.${s.id}.title`);
        expect(body, `${lng}.${s.id}.body`).not.toBe(`tour.${s.id}.body`);
        expect(title.length, `${lng}.${s.id}.title non-empty`).toBeGreaterThan(3);
        expect(body.length, `${lng}.${s.id}.body non-empty`).toBeGreaterThan(10);
      }
    }
    await i18n.changeLanguage('en');
  });
});

describe('OnboardingWizard', () => {
  it('shows progress pill X/7 and one-click Skip', () => {
    const props = renderWizard(3);
    expect(screen.getByText('4/7')).toBeTruthy();
    const skip = screen.getByRole('button', { name: /skip tour/i });
    expect(skip).toBeTruthy();
    fireEvent.click(skip);
    expect(props.onSkip).toHaveBeenCalledTimes(1);
  });

  it('ESC skips the tour (Modal onClose)', () => {
    const props = renderWizard(0);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(props.onSkip).toHaveBeenCalled();
  });

  it('ArrowRight advances, ArrowLeft goes back', () => {
    const props = renderWizard(3);
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(props.onNext).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(window, { key: 'ArrowLeft' });
    expect(props.onBack).toHaveBeenCalledTimes(1);
  });

  it('last step shows Finish and fires onFinish', () => {
    const props = renderWizard(6);
    expect(screen.getByText('7/7')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /finish|selesai/i }));
    expect(props.onFinish).toHaveBeenCalledTimes(1);
  });

  it('project step shows no duplicate hint box or create button', () => {
    renderWizard(2);
    // The noProjectHint box is gone; only the hard-gate hint appears when blocked.
    expect(screen.queryByRole('note')).toBeNull();
    // No shortcut CTA inside the card: the user clicks the glowing real button.
    expect(screen.queryByRole('button', { name: /create project|buat project/i })).toBeNull();
    expect(document.querySelector('[data-tour-id="wizard-create-project"]')).toBeNull();
    expect(document.querySelector('[data-tour-id="wizard-create-team"]')).toBeNull();
  });

  it('shows no tap hint anywhere (removed by design)', () => {
    // Card content lives in a body portal, so query the document.
    const first = renderWizard(3);
    expect(screen.queryByText(/glowing button|tombol yang menyala/i)).toBeNull();
    expect(document.querySelector('.tour-tap-hint')).toBeNull();
    first.unmount();
    document.body.innerHTML = '';
    renderWizard(4);
    expect(screen.queryByText(/glowing button|tombol yang menyala/i)).toBeNull();
    expect(document.querySelector('.tour-tap-hint')).toBeNull();
  });
});

describe('TourProgressPill', () => {
  it('exposes progress via aria-label', () => {
    render(<TourProgressPill current={2} total={7} />);
    expect(screen.getByRole('status').getAttribute('aria-label')).toMatch(/2.*7/);
  });
});

describe('mergeRects (one block per cluster)', () => {
  it('merges touching/overlapping boxes', () => {
    const merged = mergeRects([
      { top: 0, left: 0, width: 100, height: 40 },
      { top: 0, left: 100, width: 100, height: 40 },
    ]);
    expect(merged).toHaveLength(1);
    expect(merged[0]).toMatchObject({ top: 0, left: 0, width: 200, height: 40 });
  });

  it('keeps distant boxes separate', () => {
    const merged = mergeRects([
      { top: 0, left: 0, width: 100, height: 40 },
      { top: 200, left: 200, width: 100, height: 40 },
    ]);
    expect(merged).toHaveLength(2);
  });

  it('chains three touching boxes into one', () => {
    const merged = mergeRects([
      { top: 0, left: 0, width: 100, height: 40 },
      { top: 0, left: 100, width: 100, height: 40 },
      { top: 0, left: 200, width: 100, height: 40 },
    ]);
    expect(merged).toHaveLength(1);
    expect(merged[0]).toMatchObject({ left: 0, width: 300 });
  });

  it('merges tab-like neighbors once padded (production path)', () => {
    // Tabs sit 2px apart; TourSpotlight pads by TOUR_HOLE_PAD first.
    const pad = 6;
    const padded = [
      { top: 100, left: 100, width: 100, height: 36 },
      { top: 100, left: 202, width: 100, height: 36 },
    ].map((r) => ({ top: r.top - pad, left: r.left - pad, width: r.width + pad * 2, height: r.height + pad * 2 }));
    const merged = mergeRects(padded);
    expect(merged).toHaveLength(1);
    expect(merged[0]).toMatchObject({ left: 94, width: 214 });
  });
});

describe('TourSpotlight (mask overlay with cutout holes)', () => {
  it('cuts one hole per target with an emerald ring', () => {
    const a = document.createElement('button');
    a.id = 'project-tab-board';
    a.textContent = 'Board';
    document.body.appendChild(a);
    mockRect(a, { top: 100, left: 100, width: 120, height: 36 });
    const b = document.createElement('button');
    b.id = 'project-tab-issues';
    document.body.appendChild(b);
    mockRect(b, { top: 100, left: 240, width: 120, height: 36 });
    const { unmount } = render(<TourSpotlight targetIds={['project-tab-board', 'project-tab-issues']} />);
    const overlay = document.querySelector('[data-tour="spotlight"]');
    expect(overlay).toBeTruthy();
    expect(overlay!.classList.contains('tour-overlay')).toBe(true);
    // Two holes => two rings + dim path with cutouts.
    expect(overlay!.querySelectorAll('.tour-overlay-ring').length).toBe(2);
    const dim = overlay!.querySelector('.tour-overlay-dim');
    expect(dim?.getAttribute('d')).toMatch(/M0,0H/);
    unmount();
    a.remove();
    b.remove();
  });

  it('dims fully while targets have not mounted yet (no give-up)', () => {
    const { unmount } = render(<TourSpotlight targetIds={['late-target']} />);
    const overlay = document.querySelector('[data-tour="spotlight"]');
    expect(overlay).toBeTruthy();
    expect(overlay!.querySelectorAll('.tour-overlay-ring').length).toBe(0);
    unmount();
  });

  it('merges adjacent tabs into a single ring (no seamed twin boxes)', () => {
    const mk = (id: string, left: number) => {
      const el = document.createElement('button');
      el.id = id;
      document.body.appendChild(el);
      mockRect(el, { top: 100, left, width: 100, height: 36 });
      return el;
    };
    // Tab-like adjacency: 2px gap, padded boxes overlap => one block.
    const a = mk('project-tab-board', 100);
    const b = mk('project-tab-issues', 202);
    const { unmount } = render(<TourSpotlight targetIds={['project-tab-board', 'project-tab-issues']} />);
    const overlay = document.querySelector('[data-tour="spotlight"]');
    expect(overlay!.querySelectorAll('.tour-overlay-ring').length).toBe(1);
    unmount();
    a.remove();
    b.remove();
  });

  it('renders nothing without targets (welcome = centered modal)', () => {
    const { container } = render(<TourSpotlight targetIds={[]} />);
    expect(container.innerHTML).toBe('');
  });

  it('clicks pass through holes: dim blocks, rings do not', () => {
    const el = document.createElement('button');
    el.id = 'project-tab-board';
    document.body.appendChild(el);
    mockRect(el, { top: 100, left: 100, width: 120, height: 36 });
    const { unmount } = render(<TourSpotlight targetIds={['project-tab-board']} />);
    // Container lets events through; only the dim shape captures them,
    // and holes are unpainted so the real button stays clickable.
    const overlay = document.querySelector('.tour-overlay') as HTMLElement;
    expect(overlay.style.pointerEvents ?? 'none').not.toBe('auto');
    const dim = document.querySelector('.tour-overlay-dim');
    expect(dim?.getAttribute('pointer-events')).toBe('auto');
    const ring = document.querySelector('.tour-overlay-ring');
    expect(ring?.getAttribute('pointer-events')).not.toBe('auto');
    unmount();
    el.remove();
  });
});

describe('tour-events storage + tracking stub', () => {
  it('distinguishes never-started tours from step 0 via hasTourStep', () => {
    expect(hasTourStep()).toBe(false);
    localStorage.setItem(TOUR_STEP_KEY, '0');
    expect(hasTourStep()).toBe(true);
    localStorage.setItem(TOUR_STEP_KEY, '2');
    expect(hasTourStep()).toBe(true);
  });

  it('tracks skipped/finished in localStorage only', () => {
    expect(isTourSkipped()).toBe(false);
    expect(isTourFinished()).toBe(false);
    localStorage.setItem(TOUR_SKIPPED_KEY, '1');
    expect(isTourSkipped()).toBe(true);
  });

  it('toggles the global active flag for N / Alt guards', () => {
    expect(isTourActive()).toBe(false);
    setTourActiveFlag(true);
    expect(isTourActive()).toBe(true);
    setTourActiveFlag(false);
    expect(isTourActive()).toBe(false);
  });

  it('tracking stub stays a console.debug no-op (no backend)', () => {
    const spy = vi.spyOn(console, 'debug').mockImplementation(() => {});
    trackTourEvent('tour_started', { at: 0 });
    expect(spy).toHaveBeenCalledWith('[tour]', 'tour_started', { at: 0 });
    spy.mockRestore();
  });
});

describe('tour keyboard rules (N off, Alt+digits on)', () => {
  function pressWin(key: string, init: KeyboardEventInit = {}) {
    const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init });
    act(() => {
      window.dispatchEvent(event);
    });
  }

  it('pauses N while the tour runs', () => {
    const onActivate = vi.fn();
    renderHook(() => useNewItemShortcut('board', true, onActivate));
    setTourActiveFlag(true);
    pressWin('n');
    expect(onActivate).not.toHaveBeenCalled();
    setTourActiveFlag(false);
    pressWin('n');
    expect(onActivate).toHaveBeenCalledWith('board', '1');
  });

  it('keeps Alt+digit tab switching alive behind the wizard modal', () => {
    const onSelect = vi.fn();
    renderHook(() => useTabShortcuts(['board', 'issues'], 'board', onSelect));
    // Wizard modal backdrop present (Modal reuses .modal-backdrop).
    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop';
    document.body.appendChild(backdrop);
    setTourActiveFlag(true);
    pressWin('2', { altKey: true });
    expect(onSelect).toHaveBeenCalledWith('issues');
    backdrop.remove();
    setTourActiveFlag(false);
  });
});

describe('tour-dom placement (pure geometry)', () => {
  const vp = { width: 1024, height: 768 };
  const size = { width: 320, height: 220 };

  it('prefers bottom and centers on the anchor', () => {
    const pos = computePopoverPlacement({ top: 100, left: 200, width: 120, height: 40 }, size, vp);
    expect(pos.placement).toBe('bottom');
    expect(pos.top).toBe(100 + 40 + 12);
    expect(pos.left).toBe(200 + 60 - 160);
  });

  it('flips to top when there is no room below', () => {
    const pos = computePopoverPlacement({ top: 600, left: 200, width: 120, height: 40 }, size, vp);
    expect(pos.placement).toBe('top');
    expect(pos.top).toBe(600 - 12 - 220);
  });

  it('uses left/right for tall side anchors and clamps inside the viewport', () => {
    // Tall anchors where neither bottom nor top fits: side placement wins.
    const right = computePopoverPlacement({ top: 100, left: 100, width: 40, height: 500 }, size, vp);
    expect(right.placement).toBe('right');
    expect(right.left).toBe(100 + 40 + 12);
    const wide = computePopoverPlacement({ top: 100, left: 900, width: 40, height: 500 }, size, vp);
    expect(wide.placement).toBe('left');
    expect(wide.left).toBeGreaterThanOrEqual(8);
  });

  it('centers when there is no anchor', () => {
    const pos = computePopoverPlacement(null, size, vp);
    expect(pos.placement).toBe('center');
    expect(pos.top).toBe((768 - 220) / 2);
    expect(pos.left).toBe((1024 - 320) / 2);
  });

  it('unions multiple targets into one box and aims the arrow at its center', () => {
    const mk = (top: number, left: number) => {
      const el = document.createElement('button');
      document.body.appendChild(el);
      el.getBoundingClientRect = () =>
        ({ top, left, width: 100, height: 40, bottom: top + 40, right: left + 100, x: left, y: top, toJSON: () => ({}) }) as DOMRect;
      return el;
    };
    const a = mk(100, 100);
    const b = mk(100, 220);
    const box = unionRect([a, b]);
    expect(box).toMatchObject({ top: 100, left: 100, width: 220, height: 40 });
    const pos = computePopoverPlacement(box, size, vp);
    expect(pos.placement).toBe('bottom');
    const arrow = arrowOffset(box!, pos, size);
    // anchor center x (210) minus popover left (50) = 160
    expect(arrow).toBe(160);
    a.remove();
    b.remove();
  });
});

function mockRect(el: HTMLElement, rect: { top: number; left: number; width: number; height: number }) {
  el.getBoundingClientRect = () =>
    ({
      ...rect,
      bottom: rect.top + rect.height,
      right: rect.left + rect.width,
      x: rect.left,
      y: rect.top,
      toJSON: () => ({}),
    }) as DOMRect;
}

describe('resolveTarget sidebar priority', () => {
  it('prefers a visible sidebar anchor over a dashboard one regardless of DOM order', () => {
    // Dashboard button first in DOM on purpose: scope must beat order.
    const dash = document.createElement('button');
    dash.setAttribute('data-tour-id', 'create-team');
    document.body.appendChild(dash);
    mockRect(dash, { top: 400, left: 400, width: 140, height: 36 });
    const rail = document.createElement('div');
    rail.className = 'sidebar';
    const railBtn = document.createElement('button');
    railBtn.setAttribute('data-tour-id', 'create-team');
    rail.appendChild(railBtn);
    document.body.appendChild(rail);
    mockRect(railBtn, { top: 200, left: 16, width: 40, height: 40 });
    expect(resolveTarget('create-team')).toBe(railBtn);
    rail.remove();
    dash.remove();
  });

  it('skips hidden scoped anchors and falls back to a visible dashboard one', () => {
    const rail = document.createElement('div');
    rail.className = 'sidebar';
    const railBtn = document.createElement('button');
    railBtn.setAttribute('data-tour-id', 'create-team');
    rail.appendChild(railBtn);
    document.body.appendChild(rail);
    // Zero rect = collapsed/hidden: must be ignored.
    mockRect(railBtn, { top: 0, left: 0, width: 0, height: 0 });
    const dash = document.createElement('button');
    dash.setAttribute('data-tour-id', 'create-team');
    document.body.appendChild(dash);
    mockRect(dash, { top: 400, left: 400, width: 140, height: 36 });
    expect(resolveTarget('create-team')).toBe(dash);
    rail.remove();
    dash.remove();
  });

  it('falls back to the first match when nothing is laid out (jsdom default)', () => {
    const a = document.createElement('button');
    a.setAttribute('data-tour-id', 'create-project');
    document.body.appendChild(a);
    const b = document.createElement('button');
    b.setAttribute('data-tour-id', 'create-project');
    document.body.appendChild(b);
    expect(resolveTarget('create-project')).toBe(a);
    a.remove();
    b.remove();
  });
});

describe('newestTeamId (tour-forced sidebar context)', () => {
  it('returns null when team-less', () => {
    expect(newestTeamId(null)).toBeNull();
    expect(newestTeamId([])).toBeNull();
  });

  it('picks the most recently updated team, falling back to the first', () => {
    const teams = [
      { id: 'a', updatedAt: '2026-01-01T00:00:00.000Z' },
      { id: 'b', updatedAt: '2026-09-01T00:00:00.000Z' },
      { id: 'c', updatedAt: '2026-05-01T00:00:00.000Z' },
    ];
    expect(newestTeamId(teams)).toBe('b');
    expect(newestTeamId([{ id: 'only' }])).toBe('only');
  });
});

describe('fastForwardStep (resume skips satisfied gates)', () => {
  it('jumps stale step 1 to step 2 when a team exists', () => {
    expect(fastForwardStep(1, true)).toBe(2);
    expect(fastForwardStep(1, false)).toBe(1);
    expect(fastForwardStep(0, true)).toBe(0);
    expect(fastForwardStep(2, true)).toBe(2);
  });
});

describe('TourPopover (anchored coachmark)', () => {
  it('pins to the anchor with an arrow instead of viewport center', () => {
    const el = document.createElement('button');
    el.id = 'project-tab-board';
    document.body.appendChild(el);
    mockRect(el, { top: 100, left: 200, width: 120, height: 40 });
    render(
      <TourPopover targetIds={['project-tab-board']} labelledBy="t" onEscape={vi.fn()}>
        <h2 id="t">Title</h2>
      </TourPopover>,
    );
    const card = document.querySelector('[data-tour="popover"]') as HTMLElement;
    expect(card).toBeTruthy();
    expect(card.getAttribute('data-placement')).toBe('bottom');
    expect(card.getAttribute('role')).toBe('dialog');
    expect(card.getAttribute('aria-modal')).toBe('false');
    expect(card.querySelector('.tour-popover-arrow')).toBeTruthy();
    el.remove();
  });

  it('falls back to a centered card when the target never resolves', () => {
    render(
      <TourPopover targetIds={['missing-target']} labelledBy="t" onEscape={vi.fn()}>
        <h2 id="t">Title</h2>
      </TourPopover>,
    );
    const card = document.querySelector('[data-tour="popover"]') as HTMLElement;
    // jsdom rects are empty, so union is null -> centered fallback renders immediately.
    expect(card).toBeTruthy();
    expect(card.getAttribute('data-placement')).toBe('center');
    expect(card.querySelector('.tour-popover-arrow')).toBeNull();
  });

  it('ESC calls onEscape (non-modal, owns its own dismiss)', () => {
    const onEscape = vi.fn();
    render(
      <TourPopover targetIds={[]} labelledBy="t" onEscape={onEscape}>
        <h2 id="t">Title</h2>
      </TourPopover>,
    );
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onEscape).toHaveBeenCalledTimes(1);
  });
});

describe('OnboardingWizard hard gate (blockReason)', () => {
  it('disables Next + shows a hint until the team exists, Skip stays free', async () => {
    await i18n.changeLanguage('en');
    const props = renderWizard(1, { blockReason: 'team' });
    const next = screen.getByRole('button', { name: /^next$/i });
    expect((next as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByRole('note').textContent).toMatch(/team first/i);
    const skip = screen.getByRole('button', { name: /skip tour/i });
    expect((skip as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(skip);
    expect(props.onSkip).toHaveBeenCalledTimes(1);
  });

  it('disables Next until the project exists', async () => {
    await i18n.changeLanguage('en');
    renderWizard(2, { blockReason: 'project' });
    const next = screen.getByRole('button', { name: /^next$/i });
    expect((next as HTMLButtonElement).disabled).toBe(true);
    const notes = screen.getAllByRole('note').map((el) => el.textContent ?? '');
    expect(notes.some((text) => /project first/i.test(text))).toBe(true);
  });

  it('enables Next when nothing blocks', () => {
    renderWizard(1, { blockReason: null });
    const next = screen.getByRole('button', { name: /^next$/i });
    expect((next as HTMLButtonElement).disabled).toBe(false);
  });

  it('ArrowRight does not advance while blocked, ArrowLeft still goes back', () => {
    const props = renderWizard(1, { blockReason: 'team' });
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(props.onNext).not.toHaveBeenCalled();
    fireEvent.keyDown(window, { key: 'ArrowLeft' });
    expect(props.onBack).toHaveBeenCalledTimes(1);
  });

  it('resolves needTeam/needProject copy in both locales', async () => {
    for (const lng of ['en', 'id'] as const) {
      await i18n.changeLanguage(lng);
      for (const key of ['needTeam', 'needProject'] as const) {
        const text = i18n.t(`tour.common.${key}`, { ns: 'project' });
        expect(text, `${lng}.${key}`).not.toBe(`tour.common.${key}`);
        expect(text.length, `${lng}.${key} non-empty`).toBeGreaterThan(10);
      }
    }
    await i18n.changeLanguage('en');
  });
});

describe('OnboardingWizard anchoring + suppression', () => {
  it('renders an anchored popover (not a centered modal) for targeted steps', () => {
    const el = document.createElement('button');
    el.setAttribute('data-tour-id', 'create-team');
    document.body.appendChild(el);
    mockRect(el, { top: 200, left: 300, width: 140, height: 36 });
    renderWizard(1);
    expect(document.querySelector('[data-tour="popover"]')).toBeTruthy();
    expect(document.querySelector('.tour-wizard-modal')).toBeNull();
    el.remove();
  });

  it('keeps the centered modal for the welcome step (no targets)', () => {
    renderWizard(0);
    expect(document.querySelector('.tour-wizard-modal')).toBeTruthy();
    expect(document.querySelector('[data-tour="popover"]')).toBeNull();
  });

  it('hides popover + spotlight while a create modal stacks above', () => {
    const el = document.createElement('button');
    el.setAttribute('data-tour-id', 'create-team');
    document.body.appendChild(el);
    mockRect(el, { top: 200, left: 300, width: 140, height: 36 });
    const backdrops = [document.createElement('div'), document.createElement('div')];
    for (const b of backdrops) {
      b.className = 'modal-backdrop';
      document.body.appendChild(b);
    }
    renderWizard(1);
    expect(document.querySelector('[data-tour="popover"]')).toBeNull();
    expect(document.querySelector('[data-tour="spotlight"]')).toBeNull();
    for (const b of backdrops) b.remove();
    el.remove();
  });
});
