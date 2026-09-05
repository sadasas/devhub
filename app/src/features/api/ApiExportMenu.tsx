import { useEffect, useRef, useState } from 'react';
import { CaretDown, DownloadSimple } from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';

interface ApiExportMenuProps {
  onExportOpenApi: () => void;
  onExportPdf: () => void;
}

export function ApiExportMenu({ onExportOpenApi, onExportPdf }: ApiExportMenuProps) {
  const { t } = useTranslation('extras');
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [open ]);

  const choose = (fn: () => void) => () => {
    fn();
    setOpen(false);
    triggerRef.current?.focus();
  };

  return (
    <div className="sort-control" ref={wrapRef}>
      <button
        ref={triggerRef}
        type="button"
        className="btn btn-ghost btn-sm sort-control-trigger"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls="api-export-menu"
        onClick={() => setOpen((v) => !v)}
      >
        <DownloadSimple size={13} aria-hidden="true" />
        {t('api.toolbar.exportMenu')}
        <CaretDown size={10} aria-hidden="true" />
      </button>
      {open && (
        <div id="api-export-menu" className="sort-menu" role="menu" aria-label={t('api.toolbar.exportMenuAria')}>
          <button type="button" role="menuitem" className="sort-menu-row" onClick={choose(onExportOpenApi)}>
            {t('api.toolbar.export')}
          </button>
          <button
            type="button"
            role="menuitem"
            className="sort-menu-row"
            title={t('api.toolbar.exportPdfHint')}
            onClick={choose(onExportPdf)}
          >
            {t('api.toolbar.exportPdf')}
          </button>
        </div>
      )}
    </div>
  );
}