import { useEffect, useRef, type ReactNode } from 'react';
import { X } from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';

interface ERDCanvasModeProps {
  /** Project display name for the title + dialog aria-label. */
  projectName: string;
  /** Remove the `canvas` search param (replace) — Esc + Close both funnel here. */
  onClose: () => void;
  /** Pill contents — built by SchemaPage from existing handlers/components (no logic duplicated here). */
  toolbar: ReactNode;
  /** U5: ERD + props panel (Issues lives as the bottom-most collapsible section inside the panel). */
  children: ReactNode;
  /**
   * U4 tiered Esc — true while the props panel shows a table/relation
   * selection. Esc then closes the panel (focus back to the canvas)
   * instead of closing the canvas overlay.
   */
  panelSelectionOpen?: boolean;
  onClosePanelSelection?: () => void;
  /** Presentation mode: all chrome hidden, canvas fills the overlay. */
  presenting?: boolean;
  /** Exit presentation (Esc tier paling awal + floating X). */
  onExitPresenting?: () => void;
}

/**
 * U1: fullscreen ERD shell + floating pill toolbar.
 * Opened via `?schemaView=erd&canvas=1`. Pure shell — readOnly gating lives
 * in SchemaPage via the existing `canEditEffective` flag.
 */
export function ERDCanvasMode({
  projectName,
  onClose,
  toolbar,
  children,
  panelSelectionOpen = false,
  onClosePanelSelection,
  presenting = false,
  onExitPresenting,
}: ERDCanvasModeProps) {
  const { t } = useTranslation('project');
  const closeRef = useRef<HTMLButtonElement>(null);
  const exitPresentRef = useRef<HTMLButtonElement>(null);
  const prevFocusRef = useRef<Element | null>(null);

  // Focus Close on open, restore the caller (Canvas trigger) on close.
  useEffect(() => {
    prevFocusRef.current = document.activeElement;
    closeRef.current?.focus();
    return () => {
      const prev = prevFocusRef.current as HTMLElement | null;
      if (prev && typeof prev.focus === 'function') prev.focus();
    };
  }, []);

  // Body scroll-lock + canvas flag while the overlay is open (Layout drawer pattern).
  // R1: body[data-erd-canvas="open"] hides the team-chat launcher via CSS
  // (launcher stays mounted for test-compat; open drawer/inline chat is left
  // mounted & interactive so existing Esc tiers keep working).
  useEffect(() => {
    const prev = document.body.style.overflow;
    const prevErd = document.body.dataset.erdCanvas;
    document.body.style.overflow = 'hidden';
    document.body.dataset.erdCanvas = 'open';
    return () => {
      document.body.style.overflow = prev;
      if (prevErd === undefined) delete document.body.dataset.erdCanvas;
      else document.body.dataset.erdCanvas = prevErd;
    };
  }, []);

  // Tiered Esc ronde 4 + presentasi: exit presentasi paling awal, lalu
  // connect → panel selection → canvas. Tooltip/connect di ERD via
  // stopPropagation (`handleCanvasEscape`), sehingga sampai `window`
  // berarti tidak ada tooltip/connect aktif.
  // Modals / palette / Export menu menangani Esc sendiri — bail out.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (document.querySelector('.modal-backdrop, .palette')) return;
      if (document.querySelector('#schema-export-menu')) return;
      // Presentasi: Esc pertama selalu keluar presentasi (panel di-unmount,
      // jadi tidak ada tier panel di sini).
      if (presenting && onExitPresenting) {
        e.preventDefault();
        onExitPresenting();
        return;
      }
      // U4: panel open → close the panel only, keep the canvas mounted.
      // Mouse users are unaffected (no focus move except on Esc).
      if (panelSelectionOpen && onClosePanelSelection) {
        e.preventDefault();
        onClosePanelSelection();
        const svg = document.querySelector('.erd-canvas-mode-body .erd-canvas svg') as HTMLElement | null;
        svg?.focus?.();
        return;
      }
      e.preventDefault();
      onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose, panelSelectionOpen, onClosePanelSelection, presenting, onExitPresenting]);

  // Presentasi: fokus ke tombol keluar saat masuk mode.
  useEffect(() => {
    if (presenting) exitPresentRef.current?.focus();
  }, [presenting]);

  if (presenting) {
    return (
      <div
        className="erd-canvas-mode erd-canvas-mode-presenting"
        role="dialog"
        aria-modal="true"
        aria-label={t('schema.canvas.dialogAria', { project: projectName })}
      >
        <div className="erd-canvas-mode-body">{children}</div>
        {onExitPresenting && (
          <button
            ref={exitPresentRef}
            type="button"
            className="btn btn-ghost btn-icon erd-present-exit"
            onClick={onExitPresenting}
            aria-label={t('schema.canvas.exitPresent')}
            title={t('schema.canvas.exitPresent')}
          >
            <X size={15} weight="bold" aria-hidden="true" />
          </button>
        )}
      </div>
    );
  }

  return (
    <div
      className="erd-canvas-mode"
      role="dialog"
      aria-modal="true"
      aria-label={t('schema.canvas.dialogAria', { project: projectName })}
    >
      <div className="erd-canvas-mode-top">
        {projectName.trim() !== '' && (
          <span className="erd-canvas-mode-title" title={projectName}>
            {projectName}
          </span>
        )}
        <div className="erd-canvas-mode-pill" role="toolbar" aria-label={t('schema.canvas.toolbarAria')}>
          {toolbar}
        </div>
        <button
          ref={closeRef}
          type="button"
          className="btn btn-ghost btn-sm btn-icon erd-canvas-mode-close"
          onClick={onClose}
          aria-label={t('schema.canvas.close')}
          title={t('schema.canvas.close')}
        >
          <X size={15} weight="bold" aria-hidden="true" />
        </button>
      </div>
      <div className="erd-canvas-mode-body">{children}</div>
    </div>
  );
}
