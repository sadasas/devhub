import { useTranslation } from 'react-i18next';
import { Tooltip } from './Tooltip';

interface ParentPillSectionProps {
  /** Judul parent; null bila parent hilang/unknown. */
  parentTitle: string | null;
  canEdit: boolean;
  /** Buka parent (navigasi). Bila absen, pill jadi teks statis. */
  onOpenParent?: () => void;
  onDetach: () => void;
}

/**
 * ParentPillSection — blok info parent untuk task yang berupa subtask.
 * Satu komponen dipakai FocusTaskDetail + TaskDetail (modal): pill
 * "Subtask of {{parent}}" (tombol navigasi bila onOpenParent ada) +
 * tombol detach × + teks info child. Menggantikan duplikasi inline
 * di kedua file.
 */
export function ParentPillSection({ parentTitle, canEdit, onOpenParent, onDetach }: ParentPillSectionProps) {
  const { t } = useTranslation('tracker');
  const missing = t('board.taskModal.parentMissing', { defaultValue: '(missing)' });
  const title = parentTitle ?? missing;
  return (
    <div className="focus-detail-check">
      <div className="focus-detail-subhead">
        <h4 className="detail-subtitle" style={{ marginBottom: 0, flex: 'none', minWidth: 0 }}>
          {t('board.taskModal.subtasksLabel', { defaultValue: 'Subtasks' })}
        </h4>
        <span className="focus-detail-parentpill">
          <span aria-hidden="true">✓</span>
          {onOpenParent ? (
            <button
              type="button"
              className="focus-detail-parentpill-text"
              onClick={onOpenParent}
              title={title}
              style={{ background: 'none', border: 'none', padding: 0, margin: 0, font: 'inherit', color: 'inherit', cursor: 'pointer', textAlign: 'left' }}
            >
              {t('board.taskModal.subtaskOf', { defaultValue: 'Subtask of {{parent}}', parent: title })}
            </button>
          ) : (
            <span className="focus-detail-parentpill-text">
              {t('board.taskModal.subtaskOf', { defaultValue: 'Subtask of {{parent}}', parent: title })}
            </span>
          )}
        </span>
        {canEdit && (
          <Tooltip title={t('board.taskModal.detachParent')}>
            <button
              type="button"
              className="btn btn-ghost btn-icon focus-detail-detach"
              onClick={onDetach}
              aria-label={t('board.taskModal.detachParent')}
            >
              <span aria-hidden="true">×</span>
            </button>
          </Tooltip>
        )}
      </div>
      <div className="focus-detail-childinfo">
        {t('board.taskModal.subtaskChildInfo', {
          defaultValue:
            "This task is a subtask of '{{parent}}', so it can't have subtasks of its own.",
          parent: title,
        })}
      </div>
    </div>
  );
}
