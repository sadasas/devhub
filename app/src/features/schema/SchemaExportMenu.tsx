import { useEffect, useRef, useState } from 'react';
import { CaretDown, DownloadSimple } from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';
import { Tooltip } from '../../components/Tooltip';
import type { Relation, Table } from '../../lib/types';
import { safeFileName, triggerDownload } from '../whiteboard/export';
import { toPostgresDDL } from './ddl-export';
import { toDBML } from './dbml-export';
import { downloadERDPNG, downloadERDSVG } from './erd-export';

interface SchemaExportMenuProps {
  tables: Table[];
  relations: Relation[];
  /** Project display name for the download filename. Empty falls back to "schema". */
  projectName: string;
  /** Snapshot version label (e.g. "v1.2.0") when viewing ?v=, otherwise null for live. */
  versionLabel?: string | null;
  /** Canvas pill mode: ghost icon-only 36px square (label in .sr-only + aria/title/tooltip). */
  iconOnly?: boolean;
}

export function SchemaExportMenu({ tables, relations, projectName, versionLabel = null, iconOnly = false }: SchemaExportMenuProps) {
  const { t } = useTranslation('project');
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const triggerLabel = versionLabel
    ? t('schema.export.triggerVersion', { version: versionLabel })
    : t('schema.export.trigger');
  const menuAria = versionLabel
    ? t('schema.export.menuVersionAria', { version: versionLabel })
    : t('schema.export.menuAria');

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

  const handleExportDdl = () => {
    const ddl = toPostgresDDL(tables, relations);
    const trimmedName = projectName.trim();
    const baseName = trimmedName !== '' ? `${trimmedName}-schema` : 'schema';
    const fullBase = versionLabel ? `${baseName}-${versionLabel}` : baseName;
    const body = ddl.trim() !== '' ? ddl : `-- ${fullBase} — no tables to export\n`;
    const blob = new Blob([body], { type: 'application/sql' });
    const url = URL.createObjectURL(blob);
    triggerDownload(url, `${safeFileName(fullBase)}.sql`);
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
    setOpen(false);
    triggerRef.current?.focus();
  };

  const handleExportDbml = () => {
    const dbml = toDBML(tables, relations);
    const trimmedName = projectName.trim();
    const baseName = trimmedName !== '' ? `${trimmedName}-schema` : 'schema';
    const fullBase = versionLabel ? `${baseName}-${versionLabel}` : baseName;
    const body = dbml.trim() !== '' ? dbml : `// ${fullBase} — no tables to export\n`;
    const blob = new Blob([body], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    triggerDownload(url, `${safeFileName(fullBase)}.dbml`);
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
    setOpen(false);
    triggerRef.current?.focus();
  };

  const hasTables = tables.length > 0;

  /** Raw (unsanitized) `*-erd` filename base; download helpers apply safeFileName. */
  const erdBase = () => {
    const trimmedName = projectName.trim();
    const baseName = trimmedName !== '' ? `${trimmedName}-schema` : 'schema';
    const fullBase = versionLabel ? `${baseName}-${versionLabel}` : baseName;
    return `${fullBase}-erd`;
  };

  const handleExportSvg = () => {
    downloadERDSVG(tables, relations, erdBase());
    setOpen(false);
    triggerRef.current?.focus();
  };

  const handleExportPng = () => {
    downloadERDPNG(tables, relations, erdBase());
    setOpen(false);
    triggerRef.current?.focus();
  };

  if (iconOnly) {
    return (
      <div className="sort-control" ref={wrapRef}>
        <Tooltip content={menuAria} side="bottom">
        <button
          ref={triggerRef}
          type="button"
          className="btn btn-ghost btn-sm sort-control-trigger"
          aria-haspopup="menu"
          aria-expanded={open}
          aria-controls="schema-export-menu"
          aria-label={menuAria}
          onClick={() => setOpen((v) => !v)}
        >
          <DownloadSimple size={15} aria-hidden="true" />
          <span className="sr-only">{triggerLabel}</span>
        </button>
        </Tooltip>
        {open && (
          <div id="schema-export-menu" className="sort-menu" role="menu" aria-label={menuAria}>
            <button type="button" role="menuitem" className="sort-menu-row" onClick={handleExportDdl}>
              {t('schema.export.ddl')}
            </button>
            <button type="button" role="menuitem" className="sort-menu-row" onClick={handleExportDbml}>
              {t('schema.export.dbml')}
            </button>
            <button
              type="button"
              role="menuitem"
              className="sort-menu-row"
              disabled={!hasTables}
              onClick={handleExportSvg}
            >
              {t('schema.export.svg')}
            </button>
            <button
              type="button"
              role="menuitem"
              className="sort-menu-row"
              disabled={!hasTables}
              onClick={handleExportPng}
            >
              {t('schema.export.png')}
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="sort-control" ref={wrapRef}>
      <button
        ref={triggerRef}
        type="button"
        className="btn btn-ghost btn-sm sort-control-trigger"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls="schema-export-menu"
        aria-label={menuAria}
        onClick={() => setOpen((v) => !v)}
      >
        <DownloadSimple size={13} aria-hidden="true" />
        {triggerLabel}
        <CaretDown size={10} aria-hidden="true" />
      </button>
      {open && (
        <div id="schema-export-menu" className="sort-menu" role="menu" aria-label={menuAria}>
          <button type="button" role="menuitem" className="sort-menu-row" onClick={handleExportDdl}>
            {t('schema.export.ddl')}
          </button>
          <button type="button" role="menuitem" className="sort-menu-row" onClick={handleExportDbml}>
            {t('schema.export.dbml')}
          </button>
          <button
            type="button"
            role="menuitem"
            className="sort-menu-row"
            disabled={!hasTables}
            onClick={handleExportSvg}
          >
            {t('schema.export.svg')}
          </button>
          <button
            type="button"
            role="menuitem"
            className="sort-menu-row"
            disabled={!hasTables}
            onClick={handleExportPng}
          >
            {t('schema.export.png')}
          </button>
        </div>
      )}
    </div>
  );
}
