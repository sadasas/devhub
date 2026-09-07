import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
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
import { Modal } from '../../components/Modal';

interface RefPickerProps {
  open: boolean;
  state: State | null;
  onPick: (entity: WhiteboardRefEntity, entityId: string) => void;
  onClose: () => void;
}

interface RefOption {
  entity: WhiteboardRefEntity;
  id: string;
  title: string;
  status: string;
  badge: string;
}

const MAX_OPTIONS = 50;

function labelOf<K extends string>(map: Record<K, { label: string }>, key: K | undefined | null): string {
  return (key ? map[key]?.label : undefined) ?? String(key ?? '');
}

export function RefPicker({ open, state, onPick, onClose }: RefPickerProps) {
  const { t } = useTranslation('extras');
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);

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
    for (const t of techEntries) {
      if (!match(t.name, t.status ?? '', t.version ?? '', t.id)) continue;
      push({ entity: 'techEntries', id: t.id, title: t.name, status: `${labelOf(TECH_STATUS, t.status)} · ${t.version || '—'}`, badge: badge('whiteboard.refPicker.badgeTech') });
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
  }, [state, query, t]);

  useEffect(() => {
    if (open) {
      setQuery('');
      setActive(0);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  useEffect(() => {
    if (active >= options.length) setActive(options.length > 0 ? 0 : -1);
  }, [options.length, active]);

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
      if (opt) onPick(opt.entity, opt.id);
    }
  };

  return (
    <Modal open={open} title={t('whiteboard.refPicker.title')} onClose={onClose} width="md">
      <div className="ref-picker">
        <input
          ref={inputRef}
          className="input"
          placeholder={t('whiteboard.refPicker.searchPlaceholder')}
          aria-label={t('whiteboard.refPicker.searchAria')}
          autoFocus
          value={query}
          maxLength={100}
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(0);
          }}
          onKeyDown={handleKeyDown}
        />
        {options.length === 0 ? (
          <p className="ref-picker-empty">{t('whiteboard.refPicker.empty')}</p>
        ) : (
          <ul className="ref-picker-list" role="listbox" aria-label={t('whiteboard.refPicker.listAria')}>
            {options.map((opt, i) => (
              <li key={`${opt.entity}-${opt.id}`} role="option" aria-selected={i === active}>
                <button
                  type="button"
                  className={`ref-picker-row${i === active ? ' ref-picker-row-active' : ''}`}
                  onClick={() => onPick(opt.entity, opt.id)}
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
      </div>
    </Modal>
  );
}
