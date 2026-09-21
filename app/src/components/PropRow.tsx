import { useState } from 'react';
import type { ReactNode } from 'react';
import { PencilSimple } from '@phosphor-icons/react';

/** Portal dropdown/popup sedang terbuka (di luar baris) — baris tak boleh auto-tutup. */
export function anyPanelOpen(): boolean {
  return typeof document !== 'undefined' && !!document.querySelector('.ss-panel,.dp-panel,.prop-pop');
}

/** State baris properti yang sedang diedit (null = semua idle). */
export function useHotProp() {
  const [hotProp, setHotProp] = useState<string | null>(null);
  return { hotProp, setHotProp };
}

/**
 * Satu baris properti sidebar: kolom label + nilai (klik untuk edit), klik = kontrol.
 * Nilai kosong ditampilkan sebagai '—', bukan label.
 */
export function PropRow({
  propKey,
  label,
  icon,
  view,
  control,
  trailing,
  hot,
  setHot,
  canEdit,
}: {
  propKey: string;
  label: string;
  icon?: ReactNode;
  view: ReactNode;
  control: ReactNode;
  trailing?: ReactNode;
  hot: boolean;
  setHot: (v: string | null) => void;
  canEdit: boolean;
}) {
  return (
    <div
      className="prop"
      data-prop={propKey}
      data-hot={hot || undefined}
      onMouseLeave={(e) => { if (!e.currentTarget.contains(document.activeElement) && !anyPanelOpen()) setHot(null); }}
      onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null) && !anyPanelOpen()) setHot(null); }}
      onKeyDown={(e) => { if (e.key === 'Escape') setHot(null); }}
    >
      {canEdit && !hot ? (
        <button
          type="button"
          className="prop-label prop-label-btn"
          onClick={() => setHot(propKey)}
          aria-label={`${label} — edit`}
        >
          {icon}
          <span className="prop-label-text">{label}</span>
          <PencilSimple size={12} aria-hidden="true" className="prop-edit" />
        </button>
      ) : (
        <span className="prop-label">{icon}<span className="prop-label-text">{label}</span>{canEdit && <PencilSimple size={12} aria-hidden="true" className="prop-edit" />}</span>
      )}
      {hot ? control : canEdit ? (
        <button type="button" className="prop-view" onClick={() => setHot(propKey)}>
          {view}
        </button>
      ) : view}
      {trailing}
    </div>
  );
}
