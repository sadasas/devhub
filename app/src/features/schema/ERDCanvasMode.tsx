import { useEffect, useRef, useState, type ReactNode } from 'react';
import { FileCode, FloppyDisk, LinkSimple, Selection, Table, X } from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';

export type ErdRailTab = 'tables' | 'relations' | 'versions' | 'dbml' | 'areas';

interface ERDCanvasModeProps {
  /** Project display name for the title + dialog aria-label. */
  projectName: string;
  /** Remove the `canvas` search param (replace) — Esc + Close both funnel here. */
  onClose: () => void;
  /** Pill contents — built by SchemaPage from existing handlers/components (no logic duplicated here). */
  toolbar: ReactNode;
  /** Top-card actions (present) — rendered in the floating title card next to Close. */
  topActions?: ReactNode;
  /** Sidebar content — the props panel (ERDCanvasPanel). Unmounted in presentation. */
  panel?: ReactNode;
  /** ERD canvas (fills the right area). */
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
  /** U3: controlled rail tab (SchemaPage owns panelTab). Default 'tables'. */
  railTab?: ErdRailTab;
  /** U3: rail tab change (controls ERDCanvasPanel activeTab). */
  onRailTabChange?: (tab: ErdRailTab) => void;
}

const RAIL_ORDER: ErdRailTab[] = ['tables', 'relations', 'areas', 'versions', 'dbml'];

/**
 * U1: fullscreen ERD shell + floating pill toolbar.
 * Layout: full-height left sidebar [rail | panel, one card] + right area
 * (centered title top, canvas fills, pill toolbar bottom-center).
 * Opened via `?schemaView=erd&canvas=1`. Pure shell — readOnly gating lives
 * in SchemaPage via the existing `canEditEffective` flag.
 */
export function ERDCanvasMode({
  projectName,
  onClose,
  toolbar,
  topActions,
  panel,
  children,
  panelSelectionOpen = false,
  onClosePanelSelection,
  presenting = false,
  onExitPresenting,
  railTab = 'tables',
  onRailTabChange,
}: ERDCanvasModeProps) {
  const { t } = useTranslation('project');
  const closeRef = useRef<HTMLButtonElement>(null);
  const exitPresentRef = useRef<HTMLButtonElement>(null);
  const prevFocusRef = useRef<Element | null>(null);
  const railRefs = useRef(new Map<ErdRailTab, HTMLButtonElement | null>());
  // Mobile sheet ala sketsa: peek (tab bar saja) ↔ expanded (konten + tab bar).
  // Tap toggle; tap tab lain = ganti tab + mengembang; tap tab aktif = menciut.
  // Desktop tak terpengaruh (CSS sheet hanya dalam media ≤860px).
  const [sheetExpanded, setSheetExpanded] = useState(false);

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
      // Mobile sheet: expanded → ciut dulu (sebelum tutup kanvas).
      if (sheetExpanded) {
        e.preventDefault();
        setSheetExpanded(false);
        return;
      }
      e.preventDefault();
      onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose, panelSelectionOpen, onClosePanelSelection, presenting, onExitPresenting, sheetExpanded]);

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

  // Rail Refs (LinkSimple) maps to panel `relations` tab — short label for 56px rail.
  const railItems: { id: ErdRailTab; icon: ReactNode; label: string }[] = [
    { id: 'tables', icon: <Table size={18} aria-hidden="true" />, label: t('schema.rail.tables') },
    { id: 'relations', icon: <LinkSimple size={18} aria-hidden="true" />, label: t('schema.rail.refs') },
    { id: 'areas', icon: <Selection size={18} aria-hidden="true" />, label: t('schema.rail.areas') },
    { id: 'versions', icon: <FloppyDisk size={18} aria-hidden="true" />, label: t('schema.rail.versions') },
    { id: 'dbml', icon: <FileCode size={18} aria-hidden="true" />, label: t('schema.rail.dbml') },
  ];
  const handleRailKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown' && e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault();
    const idx = RAIL_ORDER.indexOf(railTab);
    const delta = e.key === 'ArrowDown' || e.key === 'ArrowRight' ? 1 : -1;
    const next = RAIL_ORDER[(idx + delta + RAIL_ORDER.length) % RAIL_ORDER.length]!;
    setSheetExpanded(true);
    onRailTabChange?.(next);
    railRefs.current.get(next)?.focus();
  };

  const handleRailTabClick = (id: ErdRailTab) => {
    if (id === railTab && sheetExpanded) {
      setSheetExpanded(false);
      return;
    }
    setSheetExpanded(true);
    onRailTabChange?.(id);
  };

  return (
    <div
      className="erd-canvas-mode"
      role="dialog"
      aria-modal="true"
      aria-label={t('schema.canvas.dialogAria', { project: projectName })}
    >
      <aside
        className={`erd-sidebar${sheetExpanded ? ' erd-sheet-expanded' : ''}`}
        aria-label={t('schema.rail.aria')}
      >
        {/* Handle hanya di-render saat expanded (ekspansi lewat tap tab) —
            sekaligus membuat peek ramping tanpa mengandalkan CSS. */}
        {sheetExpanded && (
        <button
          type="button"
          className="erd-sheet-handle"
          aria-expanded={sheetExpanded}
          aria-controls="erd-sheet-panel"
          aria-label={t('schema.canvas.sheetCollapse')}
          title={t('schema.canvas.sheetCollapse')}
          onClick={() => {
            // Handle hanya ada saat expanded (ekspansi lewat tap tab);
            // fokus kembali ke tab aktif agar keyboard tidak kehilangan arah.
            setSheetExpanded(false);
            railRefs.current.get(railTab)?.focus();
          }}
        >
          <span className="erd-sheet-grip" aria-hidden="true" />
        </button>
        )}
        <nav
          className="erd-rail"
          role="tablist"
          aria-label={t('schema.rail.aria')}
          aria-orientation="vertical"
          onKeyDown={handleRailKeyDown}
        >
          {railItems.map((item) => {
            const isActive = railTab === item.id;
            return (
              <button
                key={item.id}
                ref={(el) => {
                  if (el) railRefs.current.set(item.id, el);
                  else railRefs.current.delete(item.id);
                }}
                type="button"
                role="tab"
                id={`erd-rail-tab-${item.id}`}
                aria-selected={isActive}
                aria-controls={`erd-panel-tabpanel-${item.id}`}
                tabIndex={isActive ? 0 : -1}
                className={`erd-rail-btn${isActive ? ' erd-rail-btn-active' : ''}`}
                title={item.label}
                aria-label={item.label}
                onClick={() => handleRailTabClick(item.id)}
              >
                {item.icon}
                <span className="erd-rail-label" aria-hidden="true">
                  {item.label}
                </span>
              </button>
            );
          })}
        </nav>
        <div className="erd-sidebar-panel" id="erd-sheet-panel">{panel}</div>
      </aside>
      <div className="erd-canvas-mode-body">
        <div className="erd-canvas-mode-top">
          {projectName.trim() !== '' && (
            <span className="erd-canvas-mode-title" title={projectName}>
              {projectName}
            </span>
          )}
          {topActions}
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
        <div className="erd-canvas-mode-content">{children}</div>
        <div className="erd-canvas-mode-pill" role="toolbar" aria-label={t('schema.canvas.toolbarAria')}>
          {toolbar}
        </div>
      </div>
    </div>
  );
}

export { RAIL_ORDER };
