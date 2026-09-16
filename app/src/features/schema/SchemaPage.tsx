import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';
import { ArrowLeft, ArrowsOutSimple, Broom, CaretLeft, CaretRight, DotsThree, Eye, FloppyDisk, GitDiff, Graph, LinkSimple, List, Plus, Presentation, Stack, Trash, UploadSimple, Warning } from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';
import { formatDate, relationLabel as formatRelation, shortId } from '../../lib/utils';
import type { Relation, SchemaVersion, Table } from '../../lib/types';
import { applySort, type SortSpec } from '../../lib/sort';
import { useProject } from '../../state/project-context';
import { api } from '../../lib/api';
import { useEntityDeepLink } from '../../hooks/useEntityDeepLink';
import { useSortParam } from '../../hooks/useSortParam';
import { Badge } from '../../components/Badge';
import { BottomSheet } from '../../components/BottomSheet';
import { Button } from '../../components/Button';
import { Tooltip } from '../../components/Tooltip';
import { EmptyState } from '../../components/EmptyState';
import { Modal } from '../../components/Modal';
import { Skeleton } from '../../components/Skeleton';
import { SortControl } from '../../components/SortControl';
import { ERD, type ERDLocateRequest, type ERDViewportHandle, type ErdPosition } from './ERD';
import { ERDCanvasMode } from './ERDCanvasMode';
import { ERDCanvasPanel } from './ERDCanvasPanel';
import { lintSchema } from './schema-lint';
import { SchemaIssuesStrip } from './SchemaIssuesStrip';
import { SchemaExportMenu } from './SchemaExportMenu';
import { toPostgresDDL } from './ddl-export';
import { toDBML } from './dbml-export';
import { downloadERDPNG, downloadERDSVG } from './erd-export';
import { safeFileName, triggerDownload } from '../whiteboard/export';
import { ImportSchemaModal } from './ImportSchemaModal';
import { NewRelationModal } from './NewRelationModal';
import { NewTableModal } from './NewTableModal';
import { SaveVersionModal } from './SaveVersionModal';
import { DiffVersionModal } from './DiffVersionModal';
import { TableModal } from './TableModal';
import { DataErrorState } from '../../components/DataErrorState';

type SchemaView = 'tables' | 'erd';

/** Header ringkas ≤640px (count hilang, mode/sort/canvas/tidy icon-only,
    export+import gabung ke menu "...", + Table/+ Relation). */
function useIsSchemaNarrow(): boolean {
  const [matches, setMatches] = useState(() =>
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia('(max-width: 640px)').matches
      : false,
  );
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const mq = window.matchMedia('(max-width: 640px)');
    const update = (): void => setMatches(mq.matches);
    update();
    if (typeof mq.addEventListener === 'function') {
      mq.addEventListener('change', update);
      return () => mq.removeEventListener('change', update);
    }
    mq.addListener(update);
    return () => mq.removeListener(update);
  }, []);
  return matches;
}

/** Menu "..." mobile: gabungan Export (DDL/DBML/SVG/PNG) + Import sebagai
    bottom sheet (dropdown terpotong di tepi viewport). */
function SchemaMoreMenu({ tables, relations, projectName, versionLabel, showImport, onImport }: {
  tables: Table[];
  relations: Relation[];
  projectName: string;
  versionLabel: string | null;
  showImport: boolean;
  onImport: () => void;
}) {
  const { t } = useTranslation('project');
  const [open, setOpen] = useState(false);

  const trimmedName = projectName.trim();
  const baseName = trimmedName !== '' ? `${trimmedName}-schema` : 'schema';
  const fullBase = versionLabel ? `${baseName}-${versionLabel}` : baseName;
  const hasTables = tables.length > 0;
  const downloadText = (body: string, filename: string) => {
    const blob = new Blob([body], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    triggerDownload(url, filename);
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
    setOpen(false);
  };
  const menuTitle = versionLabel
    ? t('schema.export.menuVersionAria', { version: versionLabel })
    : t('schema.export.menuAria');

  return (
    <div className="sort-control">
      <button
        type="button"
        className="btn btn-ghost btn-sm sort-control-trigger"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={t('schema.page.moreActions')}
        title={t('schema.page.moreActions')}
        onClick={() => setOpen(true)}
      >
        <DotsThree size={16} weight="bold" aria-hidden="true" />
      </button>
      <BottomSheet open={open} title={menuTitle} onClose={() => setOpen(false)} hideHeader>
        <p className="sheet-section-label">{t('schema.export.trigger')}</p>
        <button
          type="button"
          className="sort-menu-row"
          onClick={() => {
            const ddl = toPostgresDDL(tables, relations);
            const body = ddl.trim() !== '' ? ddl : `-- ${fullBase} — no tables to export\n`;
            downloadText(body, `${safeFileName(fullBase)}.sql`);
          }}
        >
          {t('schema.export.ddl')}
        </button>
        <button
          type="button"
          className="sort-menu-row"
          onClick={() => {
            const dbml = toDBML(tables, relations);
            const body = dbml.trim() !== '' ? dbml : `// ${fullBase} — no tables to export\n`;
            downloadText(body, `${safeFileName(fullBase)}.dbml`);
          }}
        >
          {t('schema.export.dbml')}
        </button>
        <button
          type="button"
          className="sort-menu-row"
          disabled={!hasTables}
          onClick={() => {
            downloadERDSVG(tables, relations, `${fullBase}-erd`);
            setOpen(false);
          }}
        >
          {t('schema.export.svg')}
        </button>
        <button
          type="button"
          className="sort-menu-row"
          disabled={!hasTables}
          onClick={() => {
            downloadERDPNG(tables, relations, `${fullBase}-erd`);
            setOpen(false);
          }}
        >
          {t('schema.export.png')}
        </button>
        {showImport && (
          <>
            <p className="sheet-section-label">{t('schema.page.import')}</p>
            <button
              type="button"
              className="sort-menu-row"
              onClick={() => {
                setOpen(false);
                onImport();
              }}
            >
              <UploadSimple size={13} aria-hidden="true" />
              {t('schema.import.title')}
            </button>
          </>
        )}
      </BottomSheet>
    </div>
  );
}

const TABLE_SORT_SPECS: SortSpec<Table>[] = [
  { key: 'name', label: 'schema.sort.name', get: (t) => t.name },
  { key: 'createdAt', label: 'schema.sort.createdAt', get: (t) => t.createdAt },
];

const VERSION_SORT_SPECS: SortSpec<SchemaVersion>[] = [
  { key: 'appliedAt', label: 'schema.sort.applied', get: (v) => v.appliedAt },
];

export function SchemaPage({ unreadIds, projectName = '' }: { unreadIds?: ReadonlySet<string>; projectName?: string }) {
  const { t } = useTranslation('project');
  const { state, loading, error, loadError, dispatch, canEdit, projectId, retryLoad } = useProject();
  const [searchParams, setSearchParams] = useSearchParams();
  const viewParam = searchParams.get('schemaView');
  const view: SchemaView = viewParam === 'erd' ? 'erd' : 'tables';
  const setView = useCallback(
    (next: SchemaView) => {
      setSearchParams(
        (prev) => {
          const p = new URLSearchParams(prev);
          p.set('schemaView', next);
          return p;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );
  // U1: fullscreen canvas overlay — only on top of the ERD view.
  const canvasOpen = view === 'erd' && searchParams.get('canvas') === '1';
  const openCanvas = useCallback(() => {
    setSearchParams(
      (prev) => {
        const p = new URLSearchParams(prev);
        p.set('schemaView', 'erd');
        p.set('canvas', '1');
        return p;
      },
      { replace: true },
    );
  }, [setSearchParams]);
  const closeCanvas = useCallback(() => {
    setSearchParams(
      (prev) => {
        const p = new URLSearchParams(prev);
        p.delete('canvas');
        return p;
      },
      { replace: true },
    );
  }, [setSearchParams]);
  const { value: sortValue, setSort } = useSortParam();
  const effectiveSort = sortValue ?? { key: 'createdAt', dir: 'desc' as const };
  const isNarrow = useIsSchemaNarrow();
  const { value: versionSortValue, setSort: setVersionSort } = useSortParam('sortv');
  const tableSortSpec = TABLE_SORT_SPECS.find((s) => s.key === effectiveSort.key) ?? null;
  const versionSortSpec = VERSION_SORT_SPECS.find((s) => s.key === versionSortValue?.key) ?? null;
  const [newTableOpen, setNewTableOpen] = useState(false);
  // U2: pending placement for the next created table (canvas center / dblclick
  // point). Null = grid fallback (plain tab + header buttons).
  const [newTablePos, setNewTablePos] = useState<ErdPosition | null>(null);
  const [createdStatus, setCreatedStatus] = useState('');
  const erdCanvasViewportRef = useRef<ERDViewportHandle | null>(null);
  const [tableId, setTableId] = useState<string | null>(null);
  useEntityDeepLink('tables', setTableId);
  const [newRelationOpen, setNewRelationOpen] = useState(false);
  // U3: connect-drag prefill — set just before opening so NewRelationModal's
  // open-transition effect picks it up; cleared on close (header [+ Relation]
  // opens with empty fields, existing behaviour).
  const [relationPrefill, setRelationPrefill] = useState<{
    from: { tableId: string; columnId: string };
    to: { tableId: string; columnId: string };
  } | null>(null);
  const handleConnectColumns = useCallback(
    (args: { fromTableId: string; fromColumnId: string; toTableId: string; toColumnId: string }) => {
      setRelationPrefill({
        from: { tableId: args.fromTableId, columnId: args.fromColumnId },
        to: { tableId: args.toTableId, columnId: args.toColumnId },
      });
      setNewRelationOpen(true);
    },
    [],
  );
  const closeNewRelation = useCallback(() => {
    setNewRelationOpen(false);
    setRelationPrefill(null);
  }, []);
  const [confirmRel, setConfirmRel] = useState<Relation | null>(null);
  const [saveVersionOpen, setSaveVersionOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  // Mobile: daftar versi dibuka sebagai bottom sheet dari bar ringkas.
  const [versionsSheetOpen, setVersionsSheetOpen] = useState(false);
  const [diffOpen, setDiffOpen] = useState(false);
  const [versionsCollapsed, setVersionsCollapsed] = useState(false);
  // U4: selection-driven props panel (canvas mode only). ERD lifts node
  // clicks via onSelectTable + relation clicks via onSelectRelation;
  // the panel itself never steals focus (announce lives in ERD).
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null);
  const [selectedRelationId, setSelectedRelationId] = useState<string | null>(null);
  const handleSelectTable = useCallback((id: string | null) => {
    setSelectedTableId(id);
    if (id !== null) setSelectedRelationId(null);
  }, []);
  const handleSelectRelation = useCallback((id: string | null) => {
    setSelectedRelationId(id);
    if (id !== null) setSelectedTableId(null);
  }, []);
  const handleClosePanelSelection = useCallback(() => {
    setSelectedTableId(null);
    setSelectedRelationId(null);
  }, []);

  const tabTablesRef = useRef<HTMLButtonElement>(null);
  const tabErdRef = useRef<HTMLButtonElement>(null);

  // Opsi B: snapshot viewing via ?v=<uuid>
  const selectedVersionId = searchParams.get('v');
  const selectedVersion = useMemo(
    () => (state ? (state.schemaVersions.find((v) => v.id === selectedVersionId) ?? null) : null),
    [state, selectedVersionId],
  );
  const isViewing = !!selectedVersion;
  const hasSnapshot = !!selectedVersion?.snapshot;
  const displayTables = useMemo(() => {
    if (!state) return [];
    if (!isViewing) return state.tables;
    if (!hasSnapshot) return [];
    return selectedVersion!.snapshot!.tables;
  }, [state, isViewing, hasSnapshot, selectedVersion]);
  const displayRelations = useMemo(() => {
    if (!state) return [];
    if (!isViewing) return state.relations;
    if (!hasSnapshot) return [];
    return selectedVersion!.snapshot!.relations;
  }, [state, isViewing, hasSnapshot, selectedVersion]);
  const displayStateForERD = useMemo(() => {
    if (!state) return null;
    if (!isViewing) return state;
    return { ...state, tables: displayTables, relations: displayRelations };
  }, [state, isViewing, displayTables, displayRelations]);
  const canEditEffective = canEdit && !isViewing;

  // U4: derived panel selection from the display snapshot (live or ?v=).
  // Stale ids (deleted table/relation) resolve to null → empty variant.
  const selectedTable = useMemo(
    () => displayTables.find((t) => t.id === selectedTableId) ?? null,
    [displayTables, selectedTableId],
  );
  const selectedRelation = useMemo(
    () => displayRelations.find((r) => r.id === selectedRelationId) ?? null,
    [displayRelations, selectedRelationId],
  );
  const panelSelectionOpen = selectedTable !== null || selectedRelation !== null;

  // U4: clear the panel when the canvas closes or the selection goes stale.
  // Presenting resets together with the canvas.
  const [presenting, setPresenting] = useState(false);
  const [presentStatus, setPresentStatus] = useState('');
  const presentBtnRef = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    if (!canvasOpen) {
      setSelectedTableId(null);
      setSelectedRelationId(null);
      setPresenting(false);
    }
  }, [canvasOpen]);
  const handleEnterPresenting = useCallback(() => {
    setPresenting(true);
    setPresentStatus(t('schema.canvas.presentAnnounce'));
    // Fullscreen beneran di elemen overlay; gagal/unsupported → tetap jalan
    // sebagai chrome-hidden (fallback graceful).
    try {
      const el = document.querySelector('.erd-canvas-mode') as HTMLElement | null;
      const req = el?.requestFullscreen?.() as Promise<void> | undefined;
      req?.catch?.(() => {});
    } catch {
      /* abaikan — mode chrome-hidden tetap berlaku */
    }
  }, [t]);
  const handleExitPresenting = useCallback(() => {
    try {
      const p = document.exitFullscreen?.() as Promise<void> | undefined;
      p?.catch?.(() => {});
    } catch {
      /* abaikan */
    }
    setPresenting(false);
    setPresentStatus('');
  }, []);
  // Tombol Present di-unmount selama presentasi (top bar hidden) → fokus
  // balik harus menunggu remount, jadi via effect, bukan di handler.
  const prevPresentingRef = useRef(presenting);
  useEffect(() => {
    const was = prevPresentingRef.current;
    prevPresentingRef.current = presenting;
    if (was && !presenting) presentBtnRef.current?.focus({ preventScroll: true });
  }, [presenting]);
  // Sinkron bila user keluar fullscreen via browser (Esc native / F11):
  // fullscreenchange tanpa fullscreenElement = sudah tidak fullscreen.
  useEffect(() => {
    if (!canvasOpen) return undefined;
    const onFsChange = () => {
      if (!document.fullscreenElement) setPresenting(false);
    };
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, [canvasOpen]);
  useEffect(() => {
    if (selectedTableId && !displayTables.some((t) => t.id === selectedTableId)) {
      setSelectedTableId(null);
    }
  }, [displayTables, selectedTableId]);
  useEffect(() => {
    if (selectedRelationId && !displayRelations.some((r) => r.id === selectedRelationId)) {
      setSelectedRelationId(null);
    }
  }, [displayRelations, selectedRelationId]);
  // U4: deleting the shown relation via the page-level confirm also empties the panel.
  useEffect(() => {
    if (confirmRel === null && selectedRelationId && !displayRelations.some((r) => r.id === selectedRelationId)) {
      setSelectedRelationId(null);
    }
  }, [confirmRel, displayRelations, selectedRelationId]);

  // F2-3: non-blocking lint from the snapshot-safe display snapshot (live or ?v=).
  const schemaIssues = useMemo(
    () => lintSchema(displayTables, displayRelations),
    [displayTables, displayRelations],
  );
  const [issuesOpen, setIssuesOpen] = useState(true);
  const issuesStripWrapRef = useRef<HTMLDivElement | null>(null);
  const prevIssuesOpenRef = useRef(issuesOpen);
  // Badge tidak toggle: selalu buka + antar fokus ke strip. Collapse hanya
  // lewat header strip. Tutup via header membiarkan fokus di header.
  const focusIssuesStrip = useCallback(() => {
    const raf = requestAnimationFrame(() => {
      const el = issuesStripWrapRef.current;
      if (!el) return;
      try {
        el.scrollIntoView({ block: 'nearest' });
      } catch {
        /* no-op */
      }
      el.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(raf);
  }, []);
  useEffect(() => {
    const was = prevIssuesOpenRef.current;
    prevIssuesOpenRef.current = issuesOpen;
    if (issuesOpen && !was) focusIssuesStrip();
    return undefined;
  }, [issuesOpen, focusIssuesStrip]);
  const [locateRequest, setLocateRequest] = useState<ERDLocateRequest | null>(null);
  const [tidyStatus, setTidyStatus] = useState('');
  const handleLocate = useCallback((targetTableId: string) => {
    setLocateRequest((prev) => ({ tableId: targetTableId, nonce: (prev?.nonce ?? 0) + 1 }));
  }, []);
  const handleOpenTable = useCallback(
    (targetTableId: string) => {
      if (isViewing) return;
      setTableId(targetTableId);
    },
    [isViewing],
  );

  // F2-5: commit a node move — optimistic dispatch + bulk persist (BoardTimeline pattern).
  const handleMoveTable = useCallback(
    (tableId: string, pos: { x: number; y: number }) => {
      if (!canEditEffective || !state) return;
      dispatch({ type: 'erdLayout/set', tableId, pos });
      const next = { ...(state.erdLayout ?? {}), [tableId]: { ...pos } };
      api.patchErdLayout(projectId, next).catch(() => {});
    },
    [canEditEffective, state, dispatch, projectId],
  );

  // F2-5: Tidy — clear stored overrides so the grid recomputes as default.
  // Focus stays on the button naturally; the status live-region announces completion.
  const handleTidy = useCallback(() => {
    if (!canEditEffective) return;
    dispatch({ type: 'erdLayout/clear' });
    api.patchErdLayout(projectId, {}).catch(() => {});
    setTidyStatus(t('schema.erd.tidyDone'));
  }, [canEditEffective, dispatch, projectId, t]);

  // U2: open NewTable without placement (grid fallback) — plain tab + header.
  const openNewTableDefault = useCallback(() => {
    setNewTablePos(null);
    setNewTableOpen(true);
  }, []);

  // U2: canvas [+ Table] pill — place at the visible viewport center
  // (world = ((w/2−x)/s, (h/2−y)/s)) read on demand via the ERD handle.
  const handleCanvasNewTable = useCallback(() => {
    const center = erdCanvasViewportRef.current?.getViewportCenterWorld() ?? null;
    setNewTablePos(center);
    setNewTableOpen(true);
  }, []);

  // U2: canvas empty-background dblclick — place at the click point (precise).
  const handleCanvasEmptyDoubleClick = useCallback(
    (pos: ErdPosition) => {
      if (!canEditEffective) return;
      setNewTablePos({ ...pos });
      setNewTableOpen(true);
    },
    [canEditEffective],
  );

  // U2: after create — 2s highlight via the F2-3 locate path + SR announce.
  const handleTableCreated = useCallback(
    (tableId: string, tableName: string) => {
      setLocateRequest((prev) => ({ tableId, nonce: (prev?.nonce ?? 0) + 1 }));
      setCreatedStatus(t('schema.erd.tableCreated', { name: tableName }));
    },
    [t],
  );

  const closeNewTable = useCallback(() => {
    setNewTableOpen(false);
    setNewTablePos(null);
  }, []);

  const toggleVersion = useCallback(
    (v: SchemaVersion) => {
      setSearchParams(
        (prev) => {
          const p = new URLSearchParams(prev);
          if (p.get('v') === v.id) p.delete('v');
          else p.set('v', v.id);
          return p;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  const exitViewing = useCallback(() => {
    setSearchParams(
      (prev) => {
        const p = new URLSearchParams(prev);
        p.delete('v');
        return p;
      },
      { replace: true },
    );
  }, [setSearchParams]);

  // focus is handled via autoFocus on Back button for SR announcement

  useEffect(() => {
    if (!isViewing) return;
    // U1 tiered Esc: canvas overlay closes first, snapshot exit on the next Esc.
    if (canvasOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        if (diffOpen) return; // let modal handle its own escape
        exitViewing();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isViewing, diffOpen, exitViewing, canvasOpen]);

  const handleTabKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        e.preventDefault();
        const next = view === 'tables' ? 'erd' : 'tables';
        setView(next);
        (next === 'tables' ? tabTablesRef : tabErdRef).current?.focus();
      }
    },
    [view, setView],
  );

  if (loading) {
    return (
      <>
      <div className="data-list-header" aria-hidden="true">
        <Skeleton style={{ width: 130, height: 13 }} />
        <span className="data-list-actions" style={{ display: "flex", gap: 8 }}>
          <Skeleton style={{ width: 110, height: 28, borderRadius: 8 }} />
          <Skeleton style={{ width: 96, height: 28, borderRadius: 8 }} />
          <Skeleton style={{ width: 96, height: 28, borderRadius: 8 }} />
        </span>
      </div>
      <div className="schema-subtabs-row" aria-hidden="true">
        <div className="sub-tabs">
          <Skeleton style={{ width: 96, height: 28, borderRadius: 8 }} />
          <Skeleton style={{ width: 72, height: 28, borderRadius: 8 }} />
        </div>
      </div>
      {viewParam === "erd" ? (
        <div className="erd-wrap" role="status" aria-live="polite" aria-busy="true" aria-label="Loading diagram">
          <span className="sr-only">Loading diagram…</span>
          <div aria-hidden="true">
            <Skeleton style={{ width: "100%", height: 320, borderRadius: 12 }} />
            <Skeleton style={{ width: "100%", height: 40, marginTop: 8, borderRadius: 8 }} />
            <Skeleton style={{ width: "100%", height: 96, marginTop: 8, borderRadius: 8 }} />
          </div>
        </div>
      ) : (
      <div className="data-list" role="status" aria-live="polite" aria-busy="true" aria-label="Loading schema">
        <span className="sr-only">Loading schema…</span>
        <div aria-hidden="true" style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
          {[0, 1, 2].map((i) => (
            <div key={i} className="data-row" style={{ minHeight: 56, gap: 12 }}>
              <div className="data-row-main" style={{ gap: 6 }}>
                <Skeleton style={{ width: `${50 + i * 5}%`, height: 14 }} />
                <Skeleton style={{ width: '70%', height: 11, opacity: 0.8 }} />
                <div style={{ display: 'flex', gap: 8 }}>
                  <Skeleton style={{ width: 64, height: 11 }} />
                  <Skeleton style={{ width: 48, height: 11 }} />
                  <Skeleton style={{ width: 44, height: 11 }} />
                  <Skeleton style={{ width: 24, height: 16, borderRadius: 999 }} />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
      )}
      </>
    );
  }

  if (error) {
    return <DataErrorState error={loadError ?? error} onRetry={retryLoad} />;
  }

  if (!state || !displayStateForERD) return null;

  const relationLabel = (rel: Relation, tables: Table[] = displayTables) => {
    const ft = tables.find((t) => t.id === rel.fromTableId);
    const tt = tables.find((t) => t.id === rel.toTableId);
    return formatRelation(
      ft?.name,
      ft?.columns.find((c) => c.id === rel.fromColumnId)?.name,
      tt?.name,
      tt?.columns.find((c) => c.id === rel.toColumnId)?.name,
    );
  };

  const relationLabelCurrent = (rel: Relation) => relationLabel(rel, state.tables);
  const relationLabelDisplay = (rel: Relation) => relationLabel(rel, displayTables);

  const sortedVersions = applySort(state.schemaVersions, versionSortSpec, versionSortValue?.dir ?? 'asc');
  const renderVersionRow = (v: SchemaVersion, onSelect?: () => void) => {
    const isActive = v.id === selectedVersionId;
    const hasSnap = !!v.snapshot;
    return (
      <button
        key={v.id}
        type="button"
        className={`version-row ${isActive ? 'version-row-active' : ''} ${!hasSnap ? 'version-row-no-snapshot' : ''}`}
        onClick={() => {
          toggleVersion(v);
          onSelect?.();
        }}
        aria-pressed={isActive}
        aria-current={isActive ? 'true' : undefined}
        aria-label={t('schema.viewRow.aria', { version: v.version })}
        title={hasSnap ? t('schema.viewRow.aria', { version: v.version }) : t('schema.viewRow.noSnapshotTooltip')}
      >
        <Badge tone="accent">{v.version}</Badge>
        {unreadIds?.has(v.id) && (
          <span className="unread-pill" role="status" aria-label="New — not yet viewed" title="New · not yet viewed">
            New
          </span>
        )}
        <div className="version-main">
          <div className="version-notes">{v.notes || t('schema.noNotes')}</div>
          <div className="version-date">{t('schema.appliedAt', { date: formatDate(v.appliedAt) })}</div>
        </div>
        <span className="version-row-eye" aria-hidden="true">
          {isActive ? <Eye size={14} weight="fill" /> : <Eye size={14} />}
        </span>
        {!hasSnap && (
          <span className="version-row-warn" aria-hidden="true">
            <Warning size={12} />
          </span>
        )}
      </button>
    );
  };

  const columnsCount = displayTables.reduce((acc, t) => acc + t.columns.length, 0);

  return (
    <div className="schema-page">
      <div className="data-list-header">
        <span className="data-list-count">
          {isViewing && selectedVersion ? (
            hasSnapshot ? (
              t('schema.viewBanner.count', {
                version: selectedVersion.version,
                tables: displayTables.length,
                relations: displayRelations.length,
                date: formatDate(selectedVersion.appliedAt),
              })
            ) : (
              t('schema.viewBanner.count', {
                version: selectedVersion.version,
                tables: 0,
                relations: 0,
                date: formatDate(selectedVersion.appliedAt),
              })
            )
          ) : (
            t('schema.page.count', {
              tables: state.tables.length,
              relations: state.relations.length,
              versions: state.schemaVersions.length,
            })
          )}
        </span>
        <div className="data-list-actions">
          <SortControl
            options={TABLE_SORT_SPECS.filter((s) => s.key !== 'createdAt').map((s) => ({ value: s.key, label: t(s.label) }))}
            value={sortValue}
            onChange={setSort}
          />
          {isNarrow ? (
            <SchemaMoreMenu
              tables={displayTables}
              relations={displayRelations}
              projectName={projectName}
              versionLabel={isViewing && selectedVersion ? selectedVersion.version : null}
              showImport={canEditEffective}
              onImport={() => setImportOpen(true)}
            />
          ) : (
            <>
              <SchemaExportMenu
                tables={displayTables}
                relations={displayRelations}
                projectName={projectName}
                versionLabel={isViewing && selectedVersion ? selectedVersion.version : null}
              />
              {canEditEffective && (
                <Button
                  variant="ghost"
                  size="sm"
                  leftIcon={<UploadSimple size={14} aria-hidden="true" />}
                  onClick={() => setImportOpen(true)}
                >
                  {t('schema.page.import')}
                </Button>
              )}
            </>
          )}
          {canEditEffective && (
            <Button
              variant="ghost"
              size="sm"
              leftIcon={<LinkSimple size={14} aria-hidden="true" />}
              onClick={() => setNewRelationOpen(true)}
            >
              {isNarrow ? t('schema.page.newRelationShort', { defaultValue: 'Relation' }) : t('schema.page.newRelation')}
            </Button>
          )}
          {canEditEffective && (
            <Button size="sm" leftIcon={<Plus size={14} weight="bold" aria-hidden="true" />} onClick={openNewTableDefault}>
              {isNarrow ? t('schema.page.newTableShort', { defaultValue: 'Table' }) : t('schema.page.newTable')}
            </Button>
          )}
        </div>
      </div>

      <div className="schema-subtabs-row">
        <div className="sub-tabs" role="tablist" aria-label={t('schema.page.viewAria')}>
          <button
            ref={tabTablesRef}
            type="button"
            className={`sub-tab ${view === 'tables' ? 'sub-tab-active' : ''}`}
            onClick={() => setView('tables')}
            onKeyDown={handleTabKeyDown}
            role="tab"
            id="tab-tables"
            aria-selected={view === 'tables'}
            aria-label={t('schema.page.tablesTab')}
            title={t('schema.page.tablesTab')}
            aria-controls="panel-tables"
            tabIndex={view === 'tables' ? 0 : -1}
          >
            <List size={13} aria-hidden="true" />
            <span className="sub-tab-label">{t('schema.page.tablesTab')}</span>
          </button>
          <button
            ref={tabErdRef}
            type="button"
            className={`sub-tab ${view === 'erd' ? 'sub-tab-active' : ''}`}
            onClick={() => setView('erd')}
            onKeyDown={handleTabKeyDown}
            role="tab"
            id="tab-erd"
            aria-selected={view === 'erd'}
            aria-label={t('schema.page.erdTab')}
            title={t('schema.page.erdTab')}
            aria-controls="panel-erd"
            tabIndex={view === 'erd' ? 0 : -1}
          >
            <Graph size={13} aria-hidden="true" />
            <span className="sub-tab-label">{t('schema.page.erdTab')}</span>
          </button>
        </div>
        <div className="schema-subtabs-actions">
          {isNarrow && (
            <Button
              variant="ghost"
              size="sm"
              leftIcon={<Stack size={14} aria-hidden="true" />}
              onClick={() => setVersionsSheetOpen(true)}
              aria-haspopup="dialog"
              aria-expanded={versionsSheetOpen}
              aria-label={t('schema.versionsHeading')}
              title={t('schema.versionsHeading')}
            >
              {state.schemaVersions.length}
            </Button>
          )}
          {view === 'erd' && (
            <Button
              variant="ghost"
              size="sm"
              className="schema-canvas-btn"
              leftIcon={<ArrowsOutSimple size={14} aria-hidden="true" />}
              onClick={openCanvas}
              aria-label={t('schema.canvas.open')}
              title={t('schema.canvas.open')}
            >
              {t('schema.canvas.open')}
            </Button>
          )}
          {view === 'erd' && canEditEffective && (
            <Button
              variant="ghost"
              size="sm"
              className="schema-tidy-btn"
              leftIcon={<Broom size={14} aria-hidden="true" />}
              onClick={handleTidy}
              aria-label={t('schema.erd.tidy')}
              title={t('schema.erd.tidyHint')}
            >
              {t('schema.erd.tidy')}
            </Button>
          )}
          {view === 'erd' && schemaIssues.length > 0 && (
            <button
              type="button"
              className="badge badge-warn schema-issues-badge"
              onClick={() => {
                if (!issuesOpen) setIssuesOpen(true);
                focusIssuesStrip();
              }}
              aria-controls="schema-issues-strip"
              aria-live="polite"
              aria-label={t('schema.issues.badgeAria', { count: schemaIssues.length })}
              title={t('schema.issues.badgeAria', { count: schemaIssues.length })}
            >
              <Warning size={13} aria-hidden="true" />
              {t('schema.issues.badge', { count: schemaIssues.length })}
            </button>
          )}
        </div>
      </div>
      <div role="status" aria-live="polite" className="sr-only">
        {tidyStatus}
      </div>
      <div role="status" aria-live="polite" className="sr-only">
        {createdStatus}
      </div>

      {isViewing && selectedVersion && (
        <div
          className="snapshot-banner"
          role="status"
          aria-live="polite"
          aria-atomic="true"
        >
          <div className="snapshot-banner-left">
            <Eye size={14} aria-hidden="true" style={{ color: 'var(--accent)', flexShrink: 0 }} />
            <span className="snapshot-banner-label">{t('schema.viewBanner.viewing')}</span>
            <Badge tone="accent">{selectedVersion.version}</Badge>
            <span className="snapshot-banner-meta">
              {t('schema.appliedAt', { date: formatDate(selectedVersion.appliedAt) })}
              {selectedVersion.notes ? ` · ${selectedVersion.notes}` : ` · ${t('schema.noNotes')}`}
              {hasSnapshot && ` · ${displayTables.length} tables · ${displayRelations.length} relations · ${columnsCount} columns`}
            </span>
            {!hasSnapshot && (
              <span className="snapshot-banner-warn" title={t('schema.viewRow.noSnapshotTooltip')}>
                <Warning size={13} aria-hidden="true" /> {t('schema.viewBanner.noSnapshotTitle')}
              </span>
            )}
          </div>
          <div className="snapshot-banner-actions">
            <Button
              variant="secondary"
              size="sm"
              leftIcon={<ArrowLeft size={14} aria-hidden="true" />}
              onClick={exitViewing}
              aria-label={t('schema.viewBanner.backToCurrent')}
              autoFocus={isViewing}
            >
              {t('schema.viewBanner.backToCurrent')}
            </Button>
            {hasSnapshot && (
              <Button
                variant="ghost"
                size="sm"
                leftIcon={<GitDiff size={14} aria-hidden="true" />}
                onClick={() => setDiffOpen(true)}
              >
                {t('schema.viewBanner.diffWithCurrent')}
              </Button>
            )}
          </div>
          <div className="snapshot-banner-notice">{t('schema.viewBanner.readOnlyNotice')}</div>
        </div>
      )}

      <div className={`schema-layout ${versionsCollapsed ? 'schema-layout-collapsed' : ''} `}>
        <div className="schema-main">
          {view === 'tables' ? (
            <div id="panel-tables" role="tabpanel" aria-labelledby="tab-tables" tabIndex={0}>
              {isViewing && !hasSnapshot ? (
                <EmptyState
                  icon={<FloppyDisk size={22} />}
                  title={t('schema.viewBanner.noSnapshotTitle')}
                  description={t('schema.viewBanner.noSnapshotDesc')}
                  action={<Button size="sm" variant="secondary" leftIcon={<ArrowLeft size={14} aria-hidden="true" />} onClick={exitViewing}>{t('schema.viewBanner.backToCurrent')}</Button>}
                />
              ) : displayTables.length === 0 ? (
                <EmptyState
                  icon={<Graph size={22} />}
                  title={isViewing ? t('schema.viewBanner.noTablesInSnapshot') : t('schema.empty.tablesTitle')}
                  description={isViewing ? t('schema.viewBanner.noTablesDesc') : t('schema.empty.tablesDesc')}
                  action={
                    !isViewing && canEditEffective ? (
                      <Button size="sm" leftIcon={<Plus size={14} weight="bold" aria-hidden="true" />} onClick={openNewTableDefault}>
                        {isNarrow ? t('schema.page.newTableShort', { defaultValue: 'Table' }) : t('schema.page.newTable', { defaultValue: 'Create table' })}
                      </Button>
                    ) : undefined
                  }
                />
              ) : (
                <div className="data-list">
                  {applySort(displayTables, tableSortSpec, effectiveSort.dir).map((t2) => (
                    <div key={t2.id} className={`data-row ${isViewing ? 'snapshot-row' : ''}`}>
                      {isViewing ? (
                        <div className="data-row-main snapshot-row-main" aria-label={t2.name}>
                          <div className="data-row-title">
                            <span className="row-title-text">{t2.name}</span>
                            <span className="snapshot-row-id">#{shortId(t2.id)}</span>
                          </div>
                          <div className="data-row-sub">{t2.comment || t('schema.noComment')}</div>
                          <div className="data-row-meta">
                            <span>
                              {t('schema.columnCount', { count: t2.columns.length })}
                            </span>
                            <span>
                              {t('schema.indexCount', { count: t2.indexes.length })}
                            </span>
                          </div>
                          {t2.columns.length > 0 && (
                            <div className="snapshot-cols" role="list" aria-label={`${t2.name} columns`}>
                              <div className="snapshot-cols-head">
                                <span>{t('schema.table.captionName')}</span>
                                <span>{t('schema.table.captionType')}</span>
                                <span>{t('schema.table.detailCaptionFlags')}</span>
                                <span>{t('schema.table.captionDefault')}</span>
                              </div>
                              {t2.columns.map((c) => (
                                <div key={c.id} className="snapshot-col" role="listitem">
                                  <span className="snapshot-col-name font-mono" title={c.name}>
                                    {c.name}
                                    {c.primaryKey && <span className="snapshot-pk" title={t('schema.table.primaryKeyTitle')}> PK</span>}
                                  </span>
                                  <span className="snapshot-col-type font-mono">{c.type || '—'}</span>
                                  <span className="snapshot-col-flags font-mono">
                                    {c.nullable ? '' : 'NOT NULL'}
                                    {c.primaryKey && c.nullable ? ' · PK' : ''}
                                  </span>
                                  <span className="snapshot-col-default font-mono">{c.default ?? '—'}</span>
                                </div>
                              ))}
                            </div>
                          )}
                          {t2.indexes.length > 0 && (
                            <div className="snapshot-indexes">
                              <span className="snapshot-indexes-label">{t('schema.table.indexesLabel')}:</span>{' '}
                              <span className="font-mono">{t2.indexes.join(', ')}</span>
                            </div>
                          )}
                          {t2.columns.length === 0 && (
                            <div className="field-helper" style={{ marginTop: 6, fontStyle: 'italic' }}>
                              {t('schema.table.noColumnsView')}
                            </div>
                          )}
                        </div>
                      ) : (
                        <button
                          type="button"
                          className="data-row-main"
                          onClick={() => setTableId(t2.id)}
                          aria-label={t('schema.page.editTableAria', { name: t2.name })}
                        >
                          <div className="data-row-title">
                            <span className="row-title-text">{t2.name}</span>
                          </div>
                          <div className="data-row-sub">{t2.comment || t('schema.noComment')}</div>
                          <div className="data-row-meta">
                            <span>
                              {t('schema.columnCount', { count: t2.columns.length })}
                            </span>
                            <span>
                              {t('schema.indexCount', { count: t2.indexes.length })}
                            </span>
                            <span>#{shortId(t2.id)}</span>
                            {unreadIds?.has(t2.id) && (
                              <span className="unread-pill" role="status" aria-label="New — not yet viewed" title="New · not yet viewed">
                                New
                              </span>
                            )}
                          </div>
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div id="panel-erd" role="tabpanel" aria-labelledby="tab-erd" tabIndex={0}>
              <div className="erd-wrap">
                <ERD
                  state={displayStateForERD}
                  readOnly={!canEditEffective}
                  locateRequest={locateRequest}
                  onDeleteRelation={canEditEffective ? setConfirmRel : () => { }}
                  onNewTable={canEditEffective ? openNewTableDefault : () => { }}
                  onMoveTable={canEditEffective ? handleMoveTable : undefined}
                  onOpenTable={handleOpenTable}
                  onConnectColumns={canEditEffective ? handleConnectColumns : undefined}
                />
                {schemaIssues.length > 0 && !canvasOpen && (
                  <div ref={issuesStripWrapRef} tabIndex={-1} className="schema-issues-focus">
                    <SchemaIssuesStrip
                      idPrefix="schema-issues"
                      issues={schemaIssues}
                      tables={displayTables}
                      relations={displayRelations}
                      isViewing={isViewing}
                      onLocate={handleLocate}
                      onOpenTable={handleOpenTable}
                      open={issuesOpen}
                      onToggle={() => setIssuesOpen(false)}
                    />
                  </div>
                )}
                {displayRelations.length > 0 && (
                  <div className="data-list relation-list">
                    <span className="data-list-count">{t('schema.relationsHeading')}</span>
                    {displayRelations.map((r) => (
                      <div className="data-row" key={r.id}>
                        <div className="data-row-main">
                          <div className="data-row-title">
                            <span className="row-title-text font-mono">{isViewing ? relationLabelDisplay(r) : relationLabelCurrent(r)}</span>
                          </div>
                          <div className="data-row-meta">
                            <span>{r.cardinality}</span>
                            <span>{t('schema.page.onDelete', { value: r.onDelete })}</span>
                            <span>#{shortId(r.id)}</span>
                            {!isViewing && unreadIds?.has(r.id) && (
                              <span className="unread-pill" role="status" aria-label="New — not yet viewed" title="New · not yet viewed">
                                New
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="data-row-side">
                          {canEditEffective && (
                            <Button
                              variant="danger"
                              size="sm"
                              className="btn-icon"
                              aria-label={t('schema.page.deleteRelationAria', { label: isViewing ? relationLabelDisplay(r) : relationLabelCurrent(r) })}
                              onClick={() => setConfirmRel(r)}
                            >
                              <Trash size={13} aria-hidden="true" />
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {isViewing && displayRelations.length === 0 && hasSnapshot && displayTables.length > 0 && (
                  <div className="field-helper" style={{ marginTop: 8, textAlign: 'center' }}>
                    {t('schema.relationsHeading')} — 0
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {isNarrow && (
          <BottomSheet
            open={versionsSheetOpen}
            title={t('schema.versionsHeading')}
            onClose={() => setVersionsSheetOpen(false)}
          >
            {canEdit && (
              <Button
                variant="ghost"
                size="md"
                className="schema-versions-sheet-save"
                leftIcon={<FloppyDisk size={14} aria-hidden="true" />}
                onClick={() => {
                  setVersionsSheetOpen(false);
                  setSaveVersionOpen(true);
                }}
              >
                {t('schema.saveVersion')}
              </Button>
            )}
            <div className="versions-list">
              {sortedVersions.map((v) => renderVersionRow(v, () => setVersionsSheetOpen(false)))}
            </div>
          </BottomSheet>
        )}
        {!isNarrow && (
        <aside className={`schema-side ${versionsCollapsed ? 'schema-side-collapsed' : ''} `} aria-label={t('schema.versionsHeading')}>
          {versionsCollapsed ? (
            <button type="button" className="schema-side-collapsed-btn" onClick={() => setVersionsCollapsed(false)} aria-label="Expand versions" title="Expand versions">
              <CaretLeft size={14} aria-hidden="true" />
              <span className="schema-side-collapsed-label">{t('schema.versionsHeading')}</span>
              <Badge tone="accent">{state.schemaVersions.length}</Badge>
            </button>
          ) : (
            <div className="versions-section">
              <div className="data-list-header">
                <Button
                  variant="ghost"
                  size="sm"
                  className="btn-icon"
                  aria-label={versionsCollapsed ? 'Expand versions' : 'Minimize versions'}
                  aria-expanded={!versionsCollapsed}
                  aria-controls="versions-list"
                  onClick={() => setVersionsCollapsed((v) => !v)}
                  title={versionsCollapsed ? 'Expand' : 'Minimize'}
                >
                  <CaretRight size={13} aria-hidden="true" />
                </Button>
                <span className="data-list-count">{t('schema.versionsHeading')}</span>
                <SortControl
                  options={VERSION_SORT_SPECS.map((s) => ({ value: s.key, label: t(s.label) }))}
                  value={versionSortValue}
                  onChange={setVersionSort}
                />
                {state.schemaVersions.filter((v) => v.snapshot).length >= 2 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    leftIcon={<GitDiff size={14} aria-hidden="true" />}
                    onClick={() => setDiffOpen(true)}
                  >
                    {t('schema.diffVersions')}
                  </Button>
                )}
                {canEdit && (
                  <Button
                    variant="ghost"
                    size="sm"
                    leftIcon={<FloppyDisk size={14} aria-hidden="true" />}
                    onClick={() => setSaveVersionOpen(true)}
                  >
                    {t('schema.saveVersion')}
                  </Button>
                )}
              </div>
              {state.schemaVersions.length === 0 ? (
                <EmptyState
                  icon={<FloppyDisk size={22} />}
                  title={t('schema.empty.versionsTitle')}
                  description={t('schema.empty.versionsDesc')}
                  action={canEdit ? <Button size="sm" variant="ghost" leftIcon={<FloppyDisk size={14} aria-hidden="true" />} onClick={() => setSaveVersionOpen(true)}>{t('schema.saveVersion')}</Button> : undefined}
                />
              ) : (
                <div id="versions-list" className="versions-list">
                  {sortedVersions.map((v) => renderVersionRow(v))}
                </div>
              )}
            </div>
          )}
        </aside>
        )}
      </div>

      {canvasOpen && (
        <ERDCanvasMode
          projectName={projectName}
          onClose={closeCanvas}
          panelSelectionOpen={panelSelectionOpen}
          onClosePanelSelection={handleClosePanelSelection}
          presenting={presenting}
          onExitPresenting={handleExitPresenting}
          toolbar={
            <>
              {canEditEffective && (
                <Tooltip content={t('schema.page.newTable')} side="bottom">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCanvasNewTable}
                  aria-label={t('schema.page.newTable')}
                >
                  <Plus size={15} weight="bold" aria-hidden="true" />
                  <span className="sr-only">{t('schema.page.newTable')}</span>
                </Button>
                </Tooltip>
              )}
              {canEditEffective && (
                <Tooltip content={t('schema.page.newRelation')} side="bottom">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setNewRelationOpen(true)}
                  aria-label={t('schema.page.newRelation')}
                >
                  <LinkSimple size={15} aria-hidden="true" />
                  <span className="sr-only">{t('schema.page.newRelation')}</span>
                </Button>
                </Tooltip>
              )}
              {canEditEffective && (
                <Tooltip content={t('schema.erd.tidyHint')} side="bottom">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleTidy}
                  aria-label={t('schema.erd.tidy')}
                >
                  <Broom size={15} aria-hidden="true" />
                  <span className="sr-only">{t('schema.erd.tidy')}</span>
                </Button>
                </Tooltip>
              )}
              <SchemaExportMenu
                tables={displayTables}
                relations={displayRelations}
                projectName={projectName}
                versionLabel={isViewing && selectedVersion ? selectedVersion.version : null}
                iconOnly
              />
              {canEditEffective && (
                <Tooltip content={t('schema.page.import')} side="bottom">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setImportOpen(true)}
                  aria-label={t('schema.page.import')}
                >
                  <UploadSimple size={15} aria-hidden="true" />
                  <span className="sr-only">{t('schema.page.import')}</span>
                </Button>
                </Tooltip>
              )}
              <Tooltip content={t('schema.canvas.present')} side="bottom">
              <button
                ref={presentBtnRef}
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={handleEnterPresenting}
                aria-label={t('schema.canvas.present')}
              >
                <Presentation size={15} aria-hidden="true" />
                <span className="sr-only">{t('schema.canvas.present')}</span>
              </button>
              </Tooltip>
            </>
          }
        >
          <div role="status" aria-live="polite" className="sr-only">
            {presentStatus}
          </div>
          <div className="erd-canvas-main">
            <ERD
              state={displayStateForERD}
              readOnly={presenting || !canEditEffective}
              locateRequest={locateRequest}
              onDeleteRelation={canEditEffective && !presenting ? setConfirmRel : () => { }}
              onNewTable={canEditEffective && !presenting ? handleCanvasNewTable : () => { }}
              onMoveTable={canEditEffective && !presenting ? handleMoveTable : undefined}
              onOpenTable={presenting ? undefined : handleOpenTable}
              onDoubleClickEmpty={canEditEffective && !presenting ? handleCanvasEmptyDoubleClick : undefined}
              onConnectColumns={canEditEffective && !presenting ? handleConnectColumns : undefined}
              viewportRef={erdCanvasViewportRef}
              onSelectTable={presenting ? undefined : handleSelectTable}
              onSelectRelation={presenting ? undefined : handleSelectRelation}
              panelSelectionOpen={presenting ? false : panelSelectionOpen}
              onClosePanelSelection={handleClosePanelSelection}
              selectedTableId={selectedTableId}
              selectedRelationId={selectedRelationId}
              presenting={presenting}
            />
            {!presenting && (
              <ERDCanvasPanel
                table={selectedTable}
                relation={selectedRelation}
                tables={displayTables}
                readOnly={!canEditEffective}
                onClose={handleClosePanelSelection}
                onOpenTable={isViewing ? undefined : handleOpenTable}
                onDeleteRelation={canEditEffective ? setConfirmRel : () => { }}
                issues={schemaIssues}
                relations={displayRelations}
                isViewing={isViewing}
                onLocateIssue={handleLocate}
                onOpenIssueTable={handleOpenTable}
                issuesOpen={issuesOpen}
                onToggleIssues={() => setIssuesOpen((v) => !v)}
                onSelectTable={handleSelectTable}
                onSelectRelation={handleSelectRelation}
              />
            )}
          </div>
        </ERDCanvasMode>
      )}

      <NewTableModal
        open={newTableOpen}
        initialPosition={newTablePos ?? undefined}
        onCreated={handleTableCreated}
        onClose={closeNewTable}
      />
      <TableModal tableId={tableId} onClose={() => setTableId(null)} />
      <NewRelationModal
        open={newRelationOpen}
        initialFrom={relationPrefill?.from ?? undefined}
        initialTo={relationPrefill?.to ?? undefined}
        onClose={closeNewRelation}
      />
      <SaveVersionModal open={saveVersionOpen} onClose={() => setSaveVersionOpen(false)} />
      <ImportSchemaModal open={importOpen} onClose={() => setImportOpen(false)} />
      <DiffVersionModal open={diffOpen} versions={state.schemaVersions} onClose={() => setDiffOpen(false)} />
      <Modal
        open={confirmRel !== null}
        title={t('schema.deleteRelationModal.title')}
        onClose={() => setConfirmRel(null)}
        width="sm"
        footer={
          <>
            <Button variant="ghost" size="md" onClick={() => setConfirmRel(null)}>
              {t('schema.deleteRelationModal.cancel')}
            </Button>
            <Button
              variant="danger"
              size="md"
              leftIcon={<Trash size={14} aria-hidden="true" />}
              onClick={() => {
                if (confirmRel) dispatch({ type: 'relation/remove', id: confirmRel.id });
                setConfirmRel(null);
              }}
            >
              {t('schema.deleteRelationModal.confirm')}
            </Button>
          </>
        }
      >
        <p className="modal-copy">
          {t('schema.deleteRelationModal.body', { relation: confirmRel ? relationLabelCurrent(confirmRel) : '' })}
        </p>
      </Modal>
    </div>
  );
}
