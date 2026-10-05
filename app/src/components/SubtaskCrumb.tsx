import { ArrowUUpLeft } from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';
import type { TaskStatus } from '../lib/types';
import { TaskStatusBadge } from './TaskStatusBadge';

interface SubtaskCrumbProps {
  /** Judul parent yang tampil (sudah fallback ke "(missing)" oleh pemanggil bila perlu). */
  parentTitle: string;
  parentStatus?: TaskStatus | null;
  /** Tooltip nama penuh parent. */
  parentFullTitle?: string;
  currentTitle: string;
  /** Navigasi ke parent. Bila absen, parent jadi teks statis. */
  onOpenParent?: () => void;
}

/**
 * SubtaskCrumb — baris breadcrumb "↩ parent · status › current" untuk
 * task yang berupa subtask. Satu komponen dipakai FocusTaskDetail +
 * TaskDetail (modal): tombol parent (navigasi + badge status) + separator
 * › + judul saat ini. Menggantikan crumb inline Focus.
 */
export function SubtaskCrumb({ parentTitle, parentStatus, parentFullTitle, currentTitle, onOpenParent }: SubtaskCrumbProps) {
  const { t } = useTranslation('tracker');
  return (
    <div className="focus-detail-crumb">
      {onOpenParent ? (
        <button
          type="button"
          className="btn btn-ghost btn-sm focus-detail-parentbtn"
          onClick={onOpenParent}
          aria-label={t('board.taskModal.backToParent')}
          title={parentFullTitle}
        >
          <ArrowUUpLeft size={14} aria-hidden="true" />
          <span
            style={{
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            {parentTitle}
          </span>
          {parentStatus && <TaskStatusBadge status={parentStatus} />}
        </button>
      ) : (
        <span className="focus-detail-parentbtn" style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>
          {parentTitle}
          {parentStatus && (
            <TaskStatusBadge status={parentStatus} />
          )}
        </span>
      )}
      <span aria-hidden="true" style={{ color: 'var(--text-muted)', fontSize: 13 }}>
        ›
      </span>
      <span
        style={{
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          fontSize: 13,
          color: 'var(--text-muted)',
        }}
      >
        {currentTitle || t('board.taskModal.untitled')}
      </span>
    </div>
  );
}
