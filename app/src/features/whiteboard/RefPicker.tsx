import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { FE_LIMITS } from '../../lib/limits';
import type { State, WhiteboardRefEntity } from '../../lib/types';
import {
  DECISION_STATUS,
  ISSUE_SEVERITY,
  ISSUE_STATUS,
  MILESTONE_STATUS,
  TASK_STATUS,
  TECH_STATUS,
  TEST_CASE_STATUS,
} from '../../lib/labels';

interface RefPickerProps {
  open: boolean;
  state: State | null;
  onPick: (entity: WhiteboardRefEntity, entityId: string) => void;
  onClose: () => void;
  onCreateNew?: (entity: WhiteboardRefEntity) => void;
  onBrowse?: (entity: WhiteboardRefEntity) => void;
}

interface RefOption {
  entity: WhiteboardRefEntity;
  id: string;
  title: string;
  status: string;
  badge: string;
}

type RefTab = 'all' | WhiteboardRefEntity;

const TABS: RefTab[] = [
  'all',
  'tasks',
  'issues',
  'testCases',
  'milestones',
  'techEntries',
  'decisions',
  'tables',
  'apiCollections',
  'apiEndpoints',
];

const MAX_OPTIONS = 50;
const RECENT_KEY = 'wb:refRecent';
const RECENT_MAX = 5;

interface RecentEntry {
  entity: WhiteboardRefEntity;
  id: string;
}

function readRefRecent(): RecentEntry[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (v): v is RecentEntry =>
        typeof v === 'object' && v !== null && TABS.includes((v as RecentEntry).entity) && typeof (v as RecentEntry).id === 'string',
    ).slice(0, RECENT_MAX);
  } catch {
    return [];
  }
}

export function pushRefRecent(entity: WhiteboardRefEntity, id: string): void {
  try {
    const next = [{ entity, id }, ...readRefRecent().filter((v) => v.id !== id)].slice(0, RECENT_MAX);
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    /* private mode — recent simply doesn't persist */
  }
}

// autoFocus hanya desktop (hover) — di touch, keyboard virtual melonjak (pola Modal).
const AUTO_FOCUS_INPUT = typeof window !== 'undefined' && window.matchMedia?.('(hover: hover)').matches;

function labelOf<K extends string>(map: Record<K, { label: string }>, key: K | undefined | null): string {
  return (key ? map[key]?.label : undefined) ?? String(key ?? '');
}

export function RefPicker({ open, state, onPick, onClose, onCreateNew, onBrowse }: RefPickerProps) {
  const { t } = useTranslation('extras');
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const [tab, setTab] = useState<RefTab>('all');
  const inputRef = useRef<HTMLInputElement | null>(null);

  const tabBadge = (entity: WhiteboardRefEntity): string => {
    switch (entity) {
      case 'tasks':
        return t('whiteboard.refPicker.badgeTask');
      case 'issues':
        return t('whiteboard.refPicker.badgeIssue');
      case 'testCases':
        return t('whiteboard.refPicker.badgeTestCase');
      case 'milestones':
        return t('whiteboard.refPicker.badgeMilestone');
      case 'techEntries':
        return t('whiteboard.refPicker.badgeTech');
      case 'decisions':
        return t('whiteboard.refPicker.badgeDecision');
      case 'tables':
        return t('whiteboard.refPicker.badgeTable');
      case 'apiCollections':
        return t('whiteboard.refPicker.badgeApiColl');
      case 'apiEndpoints':
        return t('whiteboard.refPicker.badgeEndpoint');
    }
  };

  const { options, truncated } = useMemo<{ options: RefOption[]; truncated: number }>(() => {
    const badge = (key: string) => t(key);
    const q = query.trim().toLowerCase();
    const match = (...fields: string[]) => !q || fields.some((f) => f.toLowerCase().includes(q));
    const tasks = state?.tasks ?? [];
    const issues = state?.issues ?? [];
    const testCases = state?.testCases ?? [];
    const milestones = state?.milestones ?? [];
    const techEntries = state?.techEntries ?? [];
    const decisions = state?.decisions ?? [];
    const tables = state?.tables ?? [];
    const apiCollections = state?.apiCollections ?? [];
    const apiEndpoints = state?.apiEndpoints ?? [];
    const out: RefOption[] = [];
    let matched = 0;
    const push = (opt: RefOption | null) => {
      if (!opt) return;
      if (tab !== 'all' && opt.entity !== tab) return;
      matched += 1;
      if (out.length < MAX_OPTIONS) out.push(opt);
    };
    for (const t of tasks) {
      if (!match(t.title, t.status ?? '', t.id)) continue;
      push({ entity: 'tasks', id: t.id, title: t.title, status: labelOf(TASK_STATUS, t.status), badge: badge('whiteboard.refPicker.badgeTask') });
    }
    for (const i of issues) {
      if (!match(i.title, i.severity ?? '', i.status ?? '', i.id)) continue;
      push({ entity: 'issues', id: i.id, title: i.title, status: `${labelOf(ISSUE_SEVERITY, i.severity)} · ${labelOf(ISSUE_STATUS, i.status)}`, badge: badge('whiteboard.refPicker.badgeIssue') });
    }
    for (const tc of testCases) {
      if (!match(tc.name, tc.status ?? '', tc.id)) continue;
      push({ entity: 'testCases', id: tc.id, title: tc.name, status: labelOf(TEST_CASE_STATUS, tc.status), badge: badge('whiteboard.refPicker.badgeTestCase') });
    }
    for (const m of milestones) {
      if (!match(m.name, m.status ?? '', m.id)) continue;
      push({ entity: 'milestones', id: m.id, title: m.name, status: labelOf(MILESTONE_STATUS, m.status), badge: badge('whiteboard.refPicker.badgeMilestone') });
    }
    for (const te of techEntries) {
      if (!match(te.name, te.status ?? '', te.version ?? '', te.id)) continue;
      push({ entity: 'techEntries', id: te.id, title: te.name, status: `${labelOf(TECH_STATUS, te.status)} · ${te.version || '—'}`, badge: badge('whiteboard.refPicker.badgeTech') });
    }
    for (const d of decisions) {
      if (!match(d.title, d.status ?? '', d.id)) continue;
      push({ entity: 'decisions', id: d.id, title: d.title, status: labelOf(DECISION_STATUS, d.status), badge: badge('whiteboard.refPicker.badgeDecision') });
    }
    for (const tb of tables) {
      if (!match(tb.name, tb.id)) continue;
      push({ entity: 'tables', id: tb.id, title: tb.name, status: t('whiteboard.refPicker.columns', { count: tb.columns.length }), badge: badge('whiteboard.refPicker.badgeTable') });
    }
    for (const c of apiCollections) {
      if (!match(c.name, c.id)) continue;
      push({ entity: 'apiCollections', id: c.id, title: c.name, status: t('whiteboard.refPicker.endpoints', { count: apiEndpoints.filter((e) => e.collectionId === c.id).length }), badge: badge('whiteboard.refPicker.badgeApiColl') });
    }
    for (const e of apiEndpoints) {
      if (!match(e.name, e.path, e.method ?? '', e.id)) continue;
      push({ entity: 'apiEndpoints', id: e.id, title: e.name, status: `${e.method} ${e.path}`, badge: badge('whiteboard.refPicker.badgeEndpoint') });
    }
    return { options: out, truncated: matched - out.length };
  }, [state, query, tab, t]);

  const recentItems = useMemo(() => {
    if (!open) return [];
    const byId = new Map(options.map((o) => [`${o.entity}:${o.id}`, o]));
    const resolved: RefOption[] = [];
    for (const r of readRefRecent()) {
      if (tab !== 'all' && r.entity !== tab) continue;
      const found = byId.get(`${r.entity}:${r.id}`);
      if (found) resolved.push(found);
    }
    return resolved;
  }, [open, options, tab]);

  useEffect(() => {
    if (open) {
      setQuery('');
      setActive(0);
      setTab('all');
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  useEffect(() => {
    setActive(0);
  }, [tab, query]);

  useEffect(() => {
    if (active >= options.length) setActive(options.length > 0 ? 0 : -1);
  }, [options.length, active]);

  if (!open) return null;

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((a) => (options.length === 0 ? -1 : (a + 1) % options.length));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => (options.length === 0 ? -1 : (a - 1 + options.length) % options.length));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const opt = options[active];
      if (opt) {
        pushRefRecent(opt.entity, opt.id);
        onPick(opt.entity, opt.id);
      }
    }
  };

  const pick = (opt: RefOption) => {
    pushRefRecent(opt.entity, opt.id);
    onPick(opt.entity, opt.id);
  };

  const createEntity: WhiteboardRefEntity = tab === 'all' ? 'tasks' : tab;

  return (
    <div
      className="wb-refpanel"
      role="dialog"
      aria-label={t('whiteboard.refPicker.title')}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.stopPropagation();
          onClose();
        }
      }}
    >
      <div className="wb-reftabs" role="group" aria-label={t('whiteboard.refPicker.title')}>
        {TABS.map((tb) => (
          <button
            key={tb}
            type="button"
            className={`wb-reftab${tab === tb ? ' wb-reftab-active' : ''}`}
            aria-pressed={tab === tb}
            onClick={() => setTab(tb)}
          >
            {tb === 'all' ? t('whiteboard.refPicker.tabAll') : tabBadge(tb)}
          </button>
        ))}
      </div>
      <label className="wb-refsearch">
        <input
          ref={inputRef}
          className="input"
          placeholder={t('whiteboard.refPicker.searchPlaceholder')}
          aria-label={t('whiteboard.refPicker.searchAria')}
          autoFocus={AUTO_FOCUS_INPUT}
          value={query}
          maxLength={FE_LIMITS.SEARCH}
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(0);
          }}
          onKeyDown={handleKeyDown}
        />
      </label>
      {recentItems.length > 0 && query.trim() === '' && (
        <div className="wb-refrecent">
          <div className="wb-refrecent-head">
            <span>{t('whiteboard.refPicker.recent')}</span>
            {onBrowse && (
              <button type="button" className="wb-reflink" onClick={() => onBrowse(createEntity)}>
                {t('whiteboard.refPicker.browse', { entity: tabBadge(createEntity) })}
              </button>
            )}
          </div>
          <ul className="wb-reflist" aria-label={t('whiteboard.refPicker.recent')}>
            {recentItems.map((opt) => (
              <li key={`${opt.entity}-${opt.id}`}>
                <button
                  type="button"
                  role="option"
                  aria-selected={false}
                  className="ref-picker-row"
                  onClick={() => pick(opt)}
                >
                  <span className="ref-picker-title">{opt.title}</span>
                  <span className="ref-picker-status">
                    {opt.badge} · {opt.status}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
      {options.length === 0 ? (
        <p className="ref-picker-empty">{t('whiteboard.refPicker.empty')}</p>
      ) : (
        <ul className="ref-picker-list" role="listbox" aria-label={t('whiteboard.refPicker.listAria')}>
          {options.map((opt, i) => (
            <li key={`${opt.entity}-${opt.id}`}>
              <button
                type="button"
                role="option"
                aria-selected={i === active}
                className={`ref-picker-row${i === active ? ' ref-picker-row-active' : ''}`}
                onClick={() => pick(opt)}
                onMouseEnter={() => setActive(i)}
              >
                <span className="ref-picker-title">{opt.title}</span>
                <span className="ref-picker-status">
                  {opt.badge} · {opt.status}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {truncated > 0 && (
        <p className="ref-picker-more">{t('whiteboard.refPicker.more', { count: truncated })}</p>
      )}
      {onCreateNew && (
        <button type="button" className="wb-refnew" onClick={() => onCreateNew(createEntity)}>
          {`+ ${t('whiteboard.refPicker.createNew')}`}
        </button>
      )}
    </div>
  );
}
