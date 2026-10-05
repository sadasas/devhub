import { useEffect, useRef, useState } from 'react';
import { Plus, Trash } from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';
import type { Task } from '../lib/types';
import { newId } from '../lib/utils';
import { useProject } from '../state/project-context';
import { Button } from './Button';
import { ComposerTextarea } from './ComposerTextarea';
import { Tooltip } from './Tooltip';

const AUTO_FOCUS_INPUT =
  typeof window !== 'undefined' && window.matchMedia?.('(hover: hover)').matches;

interface ChecklistSectionProps {
  task: Task;
  canEdit: boolean;
  /** Tampilkan tombol tambah (Focus: canEdit && judul tak kosong; modal: canEdit). */
  allowAdd: boolean;
  /** Status buka composer dikendalikan parent (eksklusif vs subtask). */
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
}

/**
 * ChecklistSection — heading + progress bar + baris item + composer.
 * Satu komponen dipakai FocusTaskDetail + TaskDetail (modal): bar 4px
 * (track muted 18%, fill accent dengan fallback), baris wrap (bukan
 * ellipsis), hapus via ikon Trash, composer eksklusif via
 * [data-composer-toggle], outside-close bubble.
 */
export function ChecklistSection({ task, canEdit, allowAdd, open, onOpen, onClose }: ChecklistSectionProps) {
  const { t } = useTranslation('tracker');
  const { dispatch } = useProject();
  const [checkDraft, setCheckDraft] = useState('');
  const checkCardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const el = e.target as Element | null;
      if (el?.closest?.('[data-composer-toggle]')) return;
      if (checkCardRef.current?.contains(el as Node)) return;
      setCheckDraft('');
      onClose();
    };
    document.addEventListener('click', onDown);
    return () => document.removeEventListener('click', onDown);
  }, [open, onClose]);

  const checklist = task.checklist ?? [];
  const doneCount = checklist.filter((c) => c.done).length;
  const pct = checklist.length === 0 ? 0 : Math.round((doneCount / checklist.length) * 100);

  const toggleCheck = (cid: string) => {
    dispatch({ type: 'task/update', id: task.id, patch: { checklist: checklist.map((c) => (c.id === cid ? { ...c, done: !c.done } : c)) } });
  };
  const removeCheck = (cid: string) => {
    dispatch({ type: 'task/update', id: task.id, patch: { checklist: checklist.filter((c) => c.id !== cid) } });
  };
  const addCheck = () => {
    const title = checkDraft.trim().slice(0, 200);
    if (!title || checklist.length >= 20) return;
    dispatch({ type: 'task/update', id: task.id, patch: { checklist: [...checklist, { id: newId(), title, done: false }] } });
    setCheckDraft('');
  };

  return (
    <div className="focus-detail-check">
      <h4 className="detail-subtitle" style={{ marginBottom: 0 }}>
        {t('board.taskModal.checklistLabel', { defaultValue: 'Checklist' })}
        {checklist.length > 0 && (
          <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>
            {' '}
            · {doneCount}/{checklist.length}
          </span>
        )}
      </h4>
      {checklist.length > 0 && (
        <div
          role="progressbar"
          aria-valuenow={doneCount}
          aria-valuemin={0}
          aria-valuemax={checklist.length}
          aria-label={t('board.taskModal.checklistLabel', { defaultValue: 'Checklist' })}
          style={{
            height: 4,
            minHeight: 4,
            width: '100%',
            flex: 'none',
            borderRadius: 'var(--radius-pill)',
            background: 'color-mix(in srgb, var(--text-muted) 18%, transparent)',
          }}
        >
          <div
            style={{
              width: `${pct}%`,
              height: '100%',
              borderRadius: 'var(--radius-pill)',
              background: 'var(--accent-focus, var(--accent))',
            }}
          />
        </div>
      )}
      <div>
        {checklist.map((c, i) => (
          <div
            key={c.id}
            className="mini-row"
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 8,
              padding: '5px 0',
              borderTop: i === 0 ? 'none' : '1px solid var(--border-hairline)',
            }}
          >
            <Tooltip title={canEdit ? (c.done ? t('board.taskModal.uncheckItem', { defaultValue: 'Mark as todo' }) : t('board.taskModal.checkItem', { defaultValue: 'Mark done' })) : undefined}>
            <button
              type="button"
              role="checkbox"
              aria-checked={c.done}
              aria-label={c.title}
              onClick={() => canEdit && toggleCheck(c.id)}
              disabled={!canEdit}
              style={{
                width: 16,
                height: 16,
                borderRadius: 5,
                flexShrink: 0,
                border: '1px solid var(--border-strong)',
                background: c.done ? 'var(--status-success)' : 'transparent',
                color: 'var(--text-on-accent)',
                cursor: canEdit ? 'pointer' : 'default',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 11,
              }}
            >
              {c.done ? '✓' : ''}
            </button>
            </Tooltip>
            <span
              className="mini-row-body"
              style={{
                flex: 1,
                minWidth: 0,
                fontSize: 13,
                whiteSpace: 'normal',
                overflowWrap: 'anywhere',
                textDecoration: c.done ? 'line-through' : 'none',
                color: c.done ? 'var(--text-muted)' : 'var(--text-secondary)',
              }}
            >
              {c.title}
            </span>
            {canEdit && (
              <span className="mini-row-actions">
                <Tooltip title={`Remove ${c.title}`}>
                <button
                  type="button"
                  className="mini-del"
                  onClick={() => removeCheck(c.id)}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: 'var(--status-danger)',
                    padding: '6px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                  aria-label={`Remove ${c.title}`}
                >
                  <Trash size={15} aria-hidden="true" />
                </button>
                </Tooltip>
              </span>
            )}
          </div>
        ))}
        {allowAdd &&
          checklist.length < 20 &&
          (open ? (
            <div ref={checkCardRef} style={{ display: 'flex', gap: 6, marginTop: 4 }}>
              <ComposerTextarea
                autoFocus={AUTO_FOCUS_INPUT}
                value={checkDraft}
                onChange={setCheckDraft}
                onSubmit={() => { addCheck(); }}
                onCancel={() => { setCheckDraft(''); onClose(); }}
                onBlur={() => {
                  if (!checkDraft.trim()) onClose();
                }}
                maxLength={200}
                spellCheck={false}
                autoCorrect="off"
                autoCapitalize="off"
                placeholder={t('board.taskModal.addChecklist', { defaultValue: 'New item…' })}
                ariaLabel={t('board.taskModal.addChecklist', { defaultValue: 'New item…' })}
                wrapStyle={{ flex: 1, minWidth: 0 }}
                style={{ fontSize: 13, fontWeight: 400 }}
              />
              {checkDraft.trim() ? (
                <Tooltip title={t('board.taskModal.addChecklist', { defaultValue: 'New item…' })}>
                <Button
                  variant="primary"
                  size="md"
                  className="btn-icon"
                  aria-label={t('board.taskModal.addChecklist', {
                    defaultValue: 'New item…',
                  })}
                  onClick={addCheck}
                >
                  <Plus size={16} aria-hidden="true" />
                </Button>
                </Tooltip>
              ) : null}
            </div>
          ) : (
            <Button
              variant="ghost"
              size="md"
              data-composer-toggle="checklist"
              style={{ width: '100%', justifyContent: 'flex-start' }}
              onClick={onOpen}
            >
              + {t('board.taskModal.addChecklist', { defaultValue: 'New item…' })}
            </Button>
          ))}
      </div>
    </div>
  );
}
