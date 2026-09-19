import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent, ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { CaretDown } from '@phosphor-icons/react';

export interface ProjectTabItem {
  id: string;
  label: string;
  icon: ReactNode;
}

export interface ProjectTabNavProps {
  tabs: ProjectTabItem[];
  active: string;
  onSelect: (id: string) => void;
  unread: Record<string, number | { new: number; deleted: number; total: number }>;
}

type UnreadCount = { new: number; deleted: number; total: number };

function toCount(raw: number | { new: number; deleted: number; total: number } | undefined): UnreadCount | null {
  if (raw === undefined) return null;
  if (typeof raw === 'number') return { new: raw, deleted: 0, total: raw };
  return raw;
}

function TabBadge({ tabId, label, count }: { tabId: string; label: string; count: UnreadCount | null }) {
  const { t } = useTranslation('project');
  if (count === null || count.total <= 0) return null;
  const newCount = count.new;
  const delCount = count.deleted;
  const total = count.total;
  return (
    <span
      className="tab-badge-split"
      aria-label={t('tabs.badgeNewDeleted', { new: newCount, deleted: delCount, label })}
      title={`${newCount} new · ${delCount} deleted`}
      data-testid={`tab-badge-${tabId}`}
    >
      {newCount > 0 && (
        <span className="tab-badge tab-badge-new" aria-hidden="true">
          {newCount > 99 ? '99+' : newCount}
        </span>
      )}
      {delCount > 0 && (
        <span className="tab-badge tab-badge-deleted" aria-hidden="true">
          {delCount > 99 ? '99+' : delCount}
        </span>
      )}
      {newCount === 0 && delCount === 0 && (
        <span className="tab-badge" aria-hidden="true">
          {total > 99 ? '99+' : total}
        </span>
      )}
    </span>
  );
}

/**
 * Progressive-disclosure tab bar (P0 mobile).
 * Tabs that fit stay in the main row; the rest collapse into a "More"
 * dropdown. The active tab is always kept visible.
 * Overflow detection uses a width budget (scrollWidth vs clientWidth) with
 * cached tab widths + reserved More-button width, driven by a single
 * ResizeObserver. No IntersectionObserver / scrollIntoView in the measure
 * path to avoid resize → scroll → observe feedback loops (flicker).
 * Roving Arrow/Home/End is preserved; Alt+1..0 stays in useTabShortcuts.
 */
export function ProjectTabNav({ tabs, active, onSelect, unread }: ProjectTabNavProps) {
  const { t } = useTranslation('project');
  const navRef = useRef<HTMLElement | null>(null);
  const tabRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  const moreBtnRef = useRef<HTMLButtonElement | null>(null);
  const moreWrapRef = useRef<HTMLDivElement | null>(null);
  const [overflowIds, setOverflowIdsState] = useState<ReadonlyArray<string>>([]);
  const overflowIdsRef = useRef<ReadonlyArray<string>>([]);
  const widthCacheRef = useRef<Map<string, number>>(new Map());
  const rafRef = useRef(0);
  const [moreOpen, setMoreOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number; width: number } | null>(null);

  const setOverflowNext = useCallback((next: ReadonlyArray<string>) => {
    const prev = overflowIdsRef.current;
    if (prev.length === next.length && prev.every((v, i) => v === next[i])) return;
    overflowIdsRef.current = next;
    setOverflowIdsState(next);
  }, []);

  const overflowSet = useMemo(() => new Set<string>(overflowIds), [overflowIds]);
  const visibleTabs = useMemo(
    () => tabs.filter((tab) => tab.id === active || !overflowSet.has(tab.id)),
    [tabs, active, overflowSet],
  );
  const hiddenTabs = useMemo(
    () => tabs.filter((tab) => tab.id !== active && overflowSet.has(tab.id)),
    [tabs, active, overflowSet],
  );

  const focusTab = useCallback((id: string) => {
    requestAnimationFrame(() => {
      document.getElementById(`project-tab-${id}`)?.focus();
    });
  }, []);

  const selectAndFocus = useCallback(
    (id: string) => {
      onSelect(id);
      setMoreOpen(false);
      focusTab(id);
    },
    [onSelect, focusTab],
  );

  const measureOverflow = useCallback(() => {
    const nav = navRef.current;
    if (nav === null) return;
    // No layout (JSDOM / hidden) — keep everything visible so tests stay green.
    if (nav.clientWidth === 0 && nav.scrollWidth === 0) {
      setOverflowNext([]);
      return;
    }
    // Normalize: drop ids that no longer exist or equal active (active is pinned visible).
    const valid = new Set(tabs.map((tab) => tab.id));
    const current = overflowIdsRef.current.filter((id) => id !== active && valid.has(id));
    if (current.length !== overflowIdsRef.current.length) {
      const order = new Map(tabs.map((tab, index) => [tab.id, index] as const));
      const sorted = [...current].sort((a, b) => (order.get(a) ?? 0) - (order.get(b) ?? 0));
      setOverflowNext(sorted);
      return;
    }
    // Refresh width cache for mounted (visible) tabs.
    tabRefs.current.forEach((el, id) => {
      const w = el.offsetWidth;
      if (w > 0) widthCacheRef.current.set(id, w);
    });
    const moreW = moreBtnRef.current?.offsetWidth && moreBtnRef.current.offsetWidth > 0
      ? moreBtnRef.current.offsetWidth
      : 92;
    const fits = nav.scrollWidth <= nav.clientWidth + 1;
    if (fits) {
      if (current.length === 0) return;
      // Spare room: bring back at most one tab per pass, only if the
      // cached width proves it fits (prevents bring-back → overflow ping-pong).
      const first = current[0];
      if (!first) return;
      const cached = widthCacheRef.current.get(first) ?? 96;
      const need =
        current.length === 1
          ? nav.scrollWidth - moreW + cached
          : nav.scrollWidth + cached;
      if (need <= nav.clientWidth + 1) {
        setOverflowNext(current.slice(1));
      }
      return;
    }
    // Overflow: move the last visible non-active tab into the menu,
    // preserving tabs order inside the overflow list.
    const visibleInOrder = tabs.filter((tab) => tab.id === active || !current.includes(tab.id));
    for (let i = visibleInOrder.length - 1; i >= 0; i -= 1) {
      const candidate = visibleInOrder[i];
      if (!candidate || candidate.id === active) continue;
      const id = candidate.id;
      if (current.includes(id)) return;
      const next = [...current, id];
      const order = new Map(tabs.map((tab, index) => [tab.id, index] as const));
      next.sort((a, b) => (order.get(a) ?? 0) - (order.get(b) ?? 0));
      setOverflowNext(next);
      return;
    }
  }, [tabs, active, setOverflowNext]);

  const scheduleMeasure = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      measureOverflow();
    });
  }, [measureOverflow]);

  useEffect(() => {
    const nav = navRef.current;
    if (nav === null) return;
    if (typeof ResizeObserver === 'undefined') {
      scheduleMeasure();
      return;
    }
    let disposed = false;
    const ro = new ResizeObserver(() => {
      if (!disposed) scheduleMeasure();
    });
    ro.observe(nav);
    // Observe tiap tab yang tampil: lebar tab berubah (font swap, badge
    // masuk/keluar, ganti bahasa) tanpa mengubah clientWidth nav — tanpa ini
    // overflow basi (tab tidak kembali meski muat). Ukur idempoten + guard
    // equality sehingga konvergen, bukan loop.
    tabRefs.current.forEach((el) => {
      ro.observe(el);
    });
    // Font web (Geist Variable) menyusutkan/melebarkan tab setelah load tanpa
    // memicu ResizeObserver — ukur ulang sekali saat font siap.
    try {
      document.fonts?.ready.then(() => {
        if (!disposed) scheduleMeasure();
      }).catch(() => {});
    } catch {
      /* font API unavailable */
    }
    window.addEventListener('resize', scheduleMeasure);
    scheduleMeasure();
    return () => {
      disposed = true;
      cancelAnimationFrame(rafRef.current);
      ro.disconnect();
      window.removeEventListener('resize', scheduleMeasure);
    };
  }, [scheduleMeasure, visibleTabs]);

  // Converge one extra pass after membership changes (wider viewport brings
  // tabs back). measureOverflow is idempotent so this settles instead of looping.
  useEffect(() => {
    scheduleMeasure();
  }, [scheduleMeasure, tabs.length, active, overflowIds.length]);

  // Close the More menu on outside tap / Escape; return focus to the trigger.
  // The menu is portaled to document.body (outside the scroll container so it
  // is never clipped), so outside detection must cover both the trigger wrap
  // and the floating panel.
  useEffect(() => {
    if (!moreOpen) return;
    const onPointer = (e: PointerEvent) => {
      const t = e.target as Node;
      if (moreWrapRef.current !== null && moreWrapRef.current.contains(t)) return;
      if (menuRef.current !== null && menuRef.current.contains(t)) return;
      setMoreOpen(false);
    };
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setMoreOpen(false);
        moreBtnRef.current?.focus();
      }
    };
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [moreOpen]);

  // Anchor the floating panel under the trigger (same pattern as
  // SearchableSelect / WorkspaceSwitcher): fixed positioning via portal,
  // flipped above when there is no room below, clamped to the viewport.
  useLayoutEffect(() => {
    if (!moreOpen) {
      setMenuPos(null);
      return;
    }
    const compute = () => {
      const trigger = moreBtnRef.current;
      if (!trigger) return;
      const rect = trigger.getBoundingClientRect();
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const width = Math.min(Math.max(rect.width, 208), Math.max(vw - 16, 0));
      const left = Math.min(Math.max(rect.right - width, 8), Math.max(vw - width - 8, 8));
      const panelHeight = menuRef.current?.offsetHeight ?? 220;
      const spaceBelow = vh - rect.bottom;
      const top =
        spaceBelow >= panelHeight + 8 ? rect.bottom + 4 : Math.max(8, rect.top - panelHeight - 4);
      setMenuPos((p) => (p && p.top === top && p.left === left && p.width === width ? p : { top, left, width }));
    };
    compute();
    const onScroll = () => compute();
    const onResize = () => compute();
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onResize);
    };
  }, [moreOpen]);

  // If the overflow list empties (resize wider), close the menu.
  useEffect(() => {
    if (overflowIds.length === 0) setMoreOpen(false);
  }, [overflowIds.length]);

  const handleKeyDown = (e: KeyboardEvent<HTMLElement>) => {
    const idx = tabs.findIndex((tab) => tab.id === active);
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault();
      const dir = e.key === 'ArrowRight' ? 1 : -1;
      const next = tabs[(idx + dir + tabs.length) % tabs.length];
      if (!next) return;
      selectAndFocus(next.id);
    } else if (e.key === 'Home') {
      e.preventDefault();
      const first = tabs[0];
      if (!first) return;
      selectAndFocus(first.id);
    } else if (e.key === 'End') {
      e.preventDefault();
      const last = tabs[tabs.length - 1];
      if (!last) return;
      selectAndFocus(last.id);
    }
  };

  const handleMenuKeyDown = (e: KeyboardEvent<HTMLElement>) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const items = Array.from(
        menuRef.current?.querySelectorAll<HTMLButtonElement>('.more-item') ?? [],
      );
      if (items.length === 0) return;
      const current = document.activeElement as HTMLElement | null;
      const at = items.findIndex((el) => el === current);
      const dir = e.key === 'ArrowDown' ? 1 : -1;
      const nextIndex = at === -1 ? (dir === 1 ? 0 : items.length - 1) : (at + dir + items.length) % items.length;
      const nextEl = items[nextIndex];
      nextEl?.focus();
    } else if (e.key === 'Home') {
      e.preventDefault();
      const first = menuRef.current?.querySelector<HTMLButtonElement>('.more-item');
      first?.focus();
    } else if (e.key === 'End') {
      e.preventDefault();
      const items = menuRef.current?.querySelectorAll<HTMLButtonElement>('.more-item');
      const last = items?.[items.length - 1];
      last?.focus();
    }
  };

  const moreLabel = t('tabs.more');
  const moreAria = t('tabs.moreAria');

  return (
    <nav
      ref={navRef}
      className="tabs tabs--progressive"
      role="tablist"
      aria-label={t('tabs.navAria')}
      onKeyDown={handleKeyDown}
    >
      {visibleTabs.map((tab) => {
        const count = toCount(unread[tab.id]);
        const isActive = active === tab.id;
        return (
          <button
            key={tab.id}
            ref={(el) => {
              if (el) tabRefs.current.set(tab.id, el);
              else tabRefs.current.delete(tab.id);
            }}
            type="button"
            role="tab"
            id={`project-tab-${tab.id}`}
            aria-selected={isActive}
            aria-controls="project-tabpanel"
            tabIndex={isActive ? 0 : -1}
            className={`tab ${isActive ? 'tab-active' : ''}`}
            onClick={() => onSelect(tab.id)}
          >
            {tab.icon}
            {tab.label}
            <TabBadge tabId={tab.id} label={tab.label} count={count} />
          </button>
        );
      })}
      {hiddenTabs.length > 0 && (
        <div ref={moreWrapRef} className="more-dropdown-wrapper">
          <button
            ref={moreBtnRef}
            type="button"
            className={`tab-more-btn ${moreOpen ? 'tab-more-btn-open' : ''}`}
            aria-expanded={moreOpen}
            aria-haspopup="menu"
            aria-label={moreAria}
            aria-controls="project-tabs-more-menu"
            onClick={() => {
              setMoreOpen((o) => !o);
            }}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
                if (!moreOpen) {
                  e.preventDefault();
                  setMoreOpen(true);
                  requestAnimationFrame(() => {
                    menuRef.current?.querySelector<HTMLButtonElement>('.more-item')?.focus();
                  });
                }
              }
            }}
          >
            {moreLabel}
            <span className="tab-more-chevron" aria-hidden="true">
              <CaretDown size={12} weight="bold" />
            </span>
          </button>
          {moreOpen &&
            hiddenTabs.length > 0 &&
            typeof document !== 'undefined' &&
            createPortal(
              <div
                ref={menuRef}
                id="project-tabs-more-menu"
                role="menu"
                aria-label={moreAria}
                className="more-dropdown"
                style={
                  menuPos ? { top: menuPos.top, left: menuPos.left, width: menuPos.width } : undefined
                }
                onKeyDown={handleMenuKeyDown}
              >
                {hiddenTabs.map((tab) => {
                  const count = toCount(unread[tab.id]);
                  return (
                    <button
                      key={tab.id}
                      id={`project-tab-${tab.id}`}
                      type="button"
                      role="menuitem"
                      className="more-item"
                      onClick={() => {
                        selectAndFocus(tab.id);
                      }}
                    >
                      <span className="more-item-icon" aria-hidden="true">
                        {tab.icon}
                      </span>
                      <span className="more-item-label">{tab.label}</span>
                      <TabBadge tabId={tab.id} label={tab.label} count={count} />
                    </button>
                  );
                })}
              </div>,
              document.body,
            )}
        </div>
      )}
    </nav>
  );
}
