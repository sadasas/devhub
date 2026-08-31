import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowClockwise, ArrowCounterClockwise, ArrowLeft, ArrowsInSimple, ArrowsOutSimple, BoundingBox, Cards, Cursor, Eraser, Export, FlowArrow, FrameCorners, HandPointing, List, MagnetStraight, Note, PenNib, Selection, TextT, SidebarSimple } from '@phosphor-icons/react';
import { Badge } from '../../components/Badge';
import { Button } from '../../components/Button';
import type { State, Whiteboard, WhiteboardAlign } from '../../lib/types';
import { WhiteboardCanvas } from './WhiteboardCanvas';
import { WhiteboardInspector } from './WhiteboardInspector';
import { WhiteboardLayers } from './WhiteboardLayers';
import { SHORTCUTS } from './shortcuts';
import { isModalOrPaletteOpen, isTypingTarget } from '../../lib/keys';
import type { WbTool } from './tools';
import { useWhiteboardHistory } from './useWhiteboardHistory';
import { buildRefDataMap } from './ref-data';
import { downloadWhiteboardPdf, downloadWhiteboardPng, downloadWhiteboardSvg } from './export';
import { useProject } from '../../state/project-context';

interface WhiteboardEditorShellProps {
  board: Whiteboard;
  state: State;
  readOnly?: boolean;
  onBack: () => void;
}

const WARN_ELEMENTS = 800;
const MAX_ELEMENTS = 1000;
const ADD_TOOLS: ReadonlySet<string> = new Set(['pen', 'text', 'sticky', 'shape', 'edge', 'ref', 'boundary']);

const TOOLS = [
  { id: 'view', nameKey: 'whiteboard.tool.view', icon: HandPointing, shortcut: SHORTCUTS.view },
  { id: 'select', nameKey: 'whiteboard.tool.select', icon: Cursor, shortcut: SHORTCUTS.select },
  { id: 'marquee', nameKey: 'whiteboard.tool.marquee', icon: Selection, shortcut: SHORTCUTS.marquee },
  { id: 'pen', nameKey: 'whiteboard.tool.pen', icon: PenNib, shortcut: SHORTCUTS.pen },
  { id: 'eraser', nameKey: 'whiteboard.tool.eraser', icon: Eraser, shortcut: SHORTCUTS.eraser },
  { id: 'text', nameKey: 'whiteboard.tool.text', icon: TextT, shortcut: SHORTCUTS.text },
  { id: 'sticky', nameKey: 'whiteboard.tool.sticky', icon: Note, shortcut: SHORTCUTS.sticky },
  { id: 'shape', nameKey: 'whiteboard.tool.shape', icon: BoundingBox, shortcut: SHORTCUTS.shape },
  { id: 'edge', nameKey: 'whiteboard.tool.edge', icon: FlowArrow, shortcut: SHORTCUTS.edge },
  { id: 'ref', nameKey: 'whiteboard.tool.ref', icon: Cards, shortcut: SHORTCUTS.ref },
  { id: 'boundary', nameKey: 'whiteboard.tool.boundary', icon: FrameCorners, shortcut: SHORTCUTS.boundary },
] as const;

const ACTIVE_TOOLS: ReadonlySet<string> = new Set(['view', 'select', 'marquee', 'pen', 'eraser', 'text', 'sticky', 'shape', 'edge', 'ref', 'boundary']);
const TOOL_GROUPS: Array<ReadonlyArray<(typeof TOOLS)[number]>> = [
  TOOLS.slice(0, 3) as unknown as ReadonlyArray<(typeof TOOLS)[number]>, // view/select/marquee
  TOOLS.slice(3, 5) as unknown as ReadonlyArray<(typeof TOOLS)[number]>, // pen/eraser
  TOOLS.slice(5) as unknown as ReadonlyArray<(typeof TOOLS)[number]>, // text/sticky/shape/edge/ref/boundary
];

export function WhiteboardEditorShell({ board, state, readOnly = false, onBack }: WhiteboardEditorShellProps) {
  const { t } = useTranslation('extras');
  const { dispatch } = useProject();
  const [tool, setTool] = useState<WbTool>('select');
  const history = useWhiteboardHistory(board.id, board.elements);
  const historyRef = useRef(history);
  historyRef.current = history;
  const shellRef = useRef<HTMLDivElement | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement | null>(null);
  const refDataMap = useMemo(() => buildRefDataMap(board.elements, state), [board.elements, state]);
  const elementCount = board.elements.length;
  const nearCap = elementCount >= WARN_ELEMENTS;
  const atCap = elementCount >= MAX_ELEMENTS;

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [snapOn, setSnapOn] = useState<boolean>(() => {
    try {
      const v = localStorage.getItem('wb:snap');
      return v ? v === '1' : true;
    } catch {
      return true;
    }
  });
  const [penColor, setPenColor] = useState<string>(() => {
    try {
      return localStorage.getItem('wb:penColor') ?? '#e4e4e7';
    } catch {
      return '#e4e4e7';
    }
  });
  const [penWidth, setPenWidth] = useState<number>(() => {
    try {
      const v = Number(localStorage.getItem('wb:penWidth'));
      return Number.isFinite(v) && v >= 1 && v <= 20 ? v : 2;
    } catch {
      return 2;
    }
  });
  const [eraserWidth, setEraserWidth] = useState<number>(() => {
    try {
      const v = Number(localStorage.getItem('wb:eraserWidth'));
      return Number.isFinite(v) && v >= 4 && v <= 20 ? v : 6;
    } catch {
      return 6;
    }
  });
  const [stickyColor, setStickyColor] = useState<string>(() => {
    try { return localStorage.getItem('wb:stickyColor') ?? '#e8b955'; } catch { return '#e8b955'; }
  });
  const [stickyTextColor, setStickyTextColor] = useState<string>(() => {
    try { return localStorage.getItem('wb:stickyTextColor') ?? '#1a1a1a'; } catch { return '#1a1a1a'; }
  });
  const [stickyFontSize, setStickyFontSize] = useState<number>(() => {
    try { const v = Number(localStorage.getItem('wb:stickyFontSize')); return Number.isFinite(v) ? v : 12; } catch { return 12; }
  });
  const [stickyAlign, setStickyAlign] = useState<WhiteboardAlign>(() => {
    try { return (localStorage.getItem('wb:stickyAlign') as WhiteboardAlign) ?? 'left'; } catch { return 'left'; }
  });
  const [textColor, setTextColor] = useState<string>(() => {
    try { return localStorage.getItem('wb:textColor') ?? '#e4e4e7'; } catch { return '#e4e4e7'; }
  });
  const [textFontSize, setTextFontSize] = useState<number>(() => {
    try { const v = Number(localStorage.getItem('wb:textFontSize')); return Number.isFinite(v) ? v : 16; } catch { return 16; }
  });
  const [textAlign, setTextAlign] = useState<WhiteboardAlign>(() => {
    try { return (localStorage.getItem('wb:textAlign') as WhiteboardAlign) ?? 'left'; } catch { return 'left'; }
  });
  const [shapeColor, setShapeColor] = useState<string>(() => {
    try { return localStorage.getItem('wb:shapeColor') ?? '#6ea8fe'; } catch { return '#6ea8fe'; }
  });
  const [shapeLabelColor, setShapeLabelColor] = useState<string>(() => {
    try { return localStorage.getItem('wb:shapeLabelColor') ?? '#6ea8fe'; } catch { return '#6ea8fe'; }
  });
  const [shapeFontSize, setShapeFontSize] = useState<number>(() => {
    try { const v = Number(localStorage.getItem('wb:shapeFontSize')); return Number.isFinite(v) ? v : 12; } catch { return 12; }
  });
  const [shapeAlign, setShapeAlign] = useState<WhiteboardAlign>(() => {
    try { return (localStorage.getItem('wb:shapeAlign') as WhiteboardAlign) ?? 'center'; } catch { return 'center'; }
  });
  const [edgeColor, setEdgeColor] = useState<string>(() => {
    try { return localStorage.getItem('wb:edgeColor') ?? '#e4e4e7'; } catch { return '#e4e4e7'; }
  });
  const [edgeFontSize, setEdgeFontSize] = useState<number>(() => {
    try { const v = Number(localStorage.getItem('wb:edgeFontSize')); return Number.isFinite(v) ? v : 11; } catch { return 11; }
  });
  const [edgeAlign, setEdgeAlign] = useState<WhiteboardAlign>(() => {
    try { return (localStorage.getItem('wb:edgeAlign') as WhiteboardAlign) ?? 'center'; } catch { return 'center'; }
  });
  const [boundaryColor, setBoundaryColor] = useState<string>(() => {
    try { return localStorage.getItem('wb:boundaryColor') ?? '#6ea8fe'; } catch { return '#6ea8fe'; }
  });
  const [boundaryLabelColor, setBoundaryLabelColor] = useState<string>(() => {
    try { return localStorage.getItem('wb:boundaryLabelColor') ?? '#e4e4e7'; } catch { return '#e4e4e7'; }
  });
  const [boundaryFontSize, setBoundaryFontSize] = useState<number>(() => {
    try { const v = Number(localStorage.getItem('wb:boundaryFontSize')); return Number.isFinite(v) ? v : 12; } catch { return 12; }
  });
  const [boundaryAlign, setBoundaryAlign] = useState<WhiteboardAlign>(() => {
    try { return (localStorage.getItem('wb:boundaryAlign') as WhiteboardAlign) ?? 'left'; } catch { return 'left'; }
  });
  const [panToId, setPanToId] = useState<string | null>(null);
  const [inspectorCollapsed, setInspectorCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem('wb:inspector:collapsed') === '1';
    } catch {
      return false;
    }
  });
  const [layersCollapsed, setLayersCollapsed] = useState<boolean>(() => {
    try {
      const v = localStorage.getItem('wb:layers:collapsed');
      return v ? v === '1' : true;
    } catch {
      return true;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('wb:inspector:collapsed', inspectorCollapsed ? '1' : '0');
    } catch {}
  }, [inspectorCollapsed]);

  useEffect(() => {
    try {
      localStorage.setItem('wb:layers:collapsed', layersCollapsed ? '1' : '0');
    } catch {}
  }, [layersCollapsed]);

  useEffect(() => {
    try {
      localStorage.setItem('wb:snap', snapOn ? '1' : '0');
    } catch {}
  }, [snapOn]);

  useEffect(() => {
    try {
      localStorage.setItem('wb:penColor', penColor);
    } catch {}
  }, [penColor]);

  useEffect(() => {
    try {
      localStorage.setItem('wb:penWidth', String(penWidth));
    } catch {}
  }, [penWidth]);

  useEffect(() => {
    try {
      localStorage.setItem('wb:eraserWidth', String(eraserWidth));
    } catch {}
  }, [eraserWidth]);

  useEffect(() => { try { localStorage.setItem('wb:stickyColor', stickyColor); } catch {} }, [stickyColor]);
  useEffect(() => { try { localStorage.setItem('wb:stickyTextColor', stickyTextColor); } catch {} }, [stickyTextColor]);
  useEffect(() => { try { localStorage.setItem('wb:stickyFontSize', String(stickyFontSize)); } catch {} }, [stickyFontSize]);
  useEffect(() => { try { localStorage.setItem('wb:stickyAlign', stickyAlign); } catch {} }, [stickyAlign]);
  useEffect(() => { try { localStorage.setItem('wb:textColor', textColor); } catch {} }, [textColor]);
  useEffect(() => { try { localStorage.setItem('wb:textFontSize', String(textFontSize)); } catch {} }, [textFontSize]);
  useEffect(() => { try { localStorage.setItem('wb:textAlign', textAlign); } catch {} }, [textAlign]);
  useEffect(() => { try { localStorage.setItem('wb:shapeColor', shapeColor); } catch {} }, [shapeColor]);
  useEffect(() => { try { localStorage.setItem('wb:shapeLabelColor', shapeLabelColor); } catch {} }, [shapeLabelColor]);
  useEffect(() => { try { localStorage.setItem('wb:shapeFontSize', String(shapeFontSize)); } catch {} }, [shapeFontSize]);
  useEffect(() => { try { localStorage.setItem('wb:shapeAlign', shapeAlign); } catch {} }, [shapeAlign]);
  useEffect(() => { try { localStorage.setItem('wb:edgeColor', edgeColor); } catch {} }, [edgeColor]);
  useEffect(() => { try { localStorage.setItem('wb:edgeFontSize', String(edgeFontSize)); } catch {} }, [edgeFontSize]);
  useEffect(() => { try { localStorage.setItem('wb:edgeAlign', edgeAlign); } catch {} }, [edgeAlign]);
  useEffect(() => { try { localStorage.setItem('wb:boundaryColor', boundaryColor); } catch {} }, [boundaryColor]);
  useEffect(() => { try { localStorage.setItem('wb:boundaryLabelColor', boundaryLabelColor); } catch {} }, [boundaryLabelColor]);
  useEffect(() => { try { localStorage.setItem('wb:boundaryFontSize', String(boundaryFontSize)); } catch {} }, [boundaryFontSize]);
  useEffect(() => { try { localStorage.setItem('wb:boundaryAlign', boundaryAlign); } catch {} }, [boundaryAlign]);

  useEffect(() => {
    setSelectedIds([]);
  }, [board.id]);

  const selectedElement = useMemo(() => {
    if (selectedIds.length === 1) {
      return board.elements.find((e) => e.id === selectedIds[0]) ?? null;
    }
    return null;
  }, [board.elements, selectedIds]);

  const selectedRefData = useMemo(() => {
    if (selectedElement?.kind === 'ref') {
      return refDataMap.get(selectedElement.id) ?? null;
    }
    return null;
  }, [selectedElement, refDataMap]);

  const handleInspectorPatch = (patch: Record<string, unknown>) => {
    if (readOnly) return;
    if (!selectedElement) return;
    const next = board.elements.map((el) => (el.id === selectedElement.id ? ({ ...el, ...patch } as typeof el) : el));
    history.record();
    dispatch({ type: 'whiteboard/update', id: board.id, patch: { elements: next } });
  };

  const handleInspectorDone = () => {
    // keep selection, just blur - no-op for inline panel (preserve selection)
  };

  const handleInspectorCancel = () => {
    if (readOnly) return;
    if (selectedElement && (selectedElement.kind === 'sticky' || selectedElement.kind === 'text')) {
      const txt = (selectedElement as { text?: string }).text ?? '';
      if (txt === '') {
        const next = board.elements.filter((el) => el.id !== selectedElement.id);
        history.record();
        dispatch({ type: 'whiteboard/update', id: board.id, patch: { elements: next } });
        setSelectedIds([]);
        return;
      }
    }
    // for other kinds, just clear selection on cancel when empty not applicable
    // keep selection - user asked cancel to discard changes, but inline panel has no staged changes
    // so we just keep selection
  };

  const handleLayersSelect = (id: string) => {
    setSelectedIds([id]);
    setPanToId(id);
    setTimeout(() => setPanToId(null), 50);
  };

  const handleLayersToggleLock = (id: string) => {
    if (readOnly) return;
    const el = board.elements.find((e) => e.id === id);
    if (!el || el.kind === 'stroke') return;
    const next = board.elements.map((e) => (e.id === id ? ({ ...e, locked: !e.locked } as typeof e) : e));
    history.record();
    dispatch({ type: 'whiteboard/update', id: board.id, patch: { elements: next } });
  };



  useEffect(() => {
    if (!exportOpen) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!exportMenuRef.current?.contains(e.target as Node)) setExportOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setExportOpen(false);
    };
    window.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [exportOpen]);

  const toggleFullscreen = () => {
    if (document.fullscreenElement) {
      void document.exitFullscreen();
    } else {
      void shellRef.current?.requestFullscreen();
    }
  };

  useEffect(() => {
    const onFsChange = () => setIsFullscreen(document.fullscreenElement === shellRef.current);
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target) || isModalOrPaletteOpen()) return;
      if (e.altKey) return;
      const key = e.key;
      const mod = e.ctrlKey || e.metaKey;
      if (key === 'f' || key === 'F') {
        e.preventDefault();
        toggleFullscreen();
        return;
      }
      if (mod && key === 'z' && !e.shiftKey) {
        if (readOnly) return;
        e.preventDefault();
        historyRef.current.undo();
        return;
      }
      if (mod && key === 'y') {
        if (readOnly) return;
        e.preventDefault();
        historyRef.current.redo();
        return;
      }
      if (mod && key === 'z' && e.shiftKey) {
        if (readOnly) return;
        e.preventDefault();
        historyRef.current.redo();
        return;
      }
      if (key === SHORTCUTS.view && ACTIVE_TOOLS.has('view')) {
        setTool('view');
      } else if (key === SHORTCUTS.select && ACTIVE_TOOLS.has('select')) {
        setTool('select');
      } else if (key === SHORTCUTS.marquee && ACTIVE_TOOLS.has('marquee')) {
        setTool('marquee');
      } else if (!atCap && !readOnly && key === SHORTCUTS.pen && ACTIVE_TOOLS.has('pen')) {
        setTool('pen');
      } else if (!readOnly && key === SHORTCUTS.eraser && ACTIVE_TOOLS.has('eraser')) {
        setTool('eraser');
      } else if (!atCap && !readOnly && key === SHORTCUTS.text && ACTIVE_TOOLS.has('text')) {
        setTool('text');
      } else if (!atCap && !readOnly && key === SHORTCUTS.sticky && ACTIVE_TOOLS.has('sticky')) {
        setTool('sticky');
      } else if (!atCap && !readOnly && key === SHORTCUTS.shape && ACTIVE_TOOLS.has('shape')) {
        setTool('shape');
      } else if (!atCap && !readOnly && key === SHORTCUTS.edge && ACTIVE_TOOLS.has('edge')) {
        setTool('edge');
      } else if (!atCap && !readOnly && key === SHORTCUTS.ref && ACTIVE_TOOLS.has('ref')) {
        setTool('ref');
      } else if (!atCap && !readOnly && key === SHORTCUTS.boundary && ACTIVE_TOOLS.has('boundary')) {
        setTool('boundary');
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [atCap, readOnly]);

  return (
    <div className="wb-shell" ref={shellRef}>
      <div className="board-toolbar">
        <Button variant="ghost" size="sm" className="back-btn" onClick={onBack} aria-label={t('whiteboard.toolbar.back')}>
          <ArrowLeft size={14} aria-hidden="true" />
        </Button>
        <div className="sub-tabs" role="toolbar" aria-label={t('whiteboard.toolbar.tools')}>
          {TOOL_GROUPS.map((group, gi) => (
            <span key={gi} className="wb-tool-group" role="group" aria-label={gi === 0 ? 'Select' : gi === 1 ? 'Draw' : 'Insert'}>
              {group.map((item) => {
                const active = ACTIVE_TOOLS.has(item.id) && tool === item.id;
                const blocked = atCap && ADD_TOOLS.has(item.id);
                const readOnlyBlocked = readOnly && item.id !== 'view' && item.id !== 'select' && item.id !== 'marquee';
                const name = t(item.nameKey);
                const disabled = !ACTIVE_TOOLS.has(item.id) || blocked || readOnlyBlocked;
                const tip = readOnlyBlocked ? t('whiteboard.viewer.readOnlyTip') : blocked ? t('whiteboard.tool.limitReached', { name }) : `${name} — ${item.shortcut}`;
                return (
              <button
                key={item.id}
                type="button"
                className={`sub-tab${active ? ' sub-tab-active' : ''}`}
                disabled={disabled}
                title={readOnlyBlocked ? t('whiteboard.viewer.readOnlyTip') : blocked ? t('whiteboard.tool.limitReached', { name }) : name}
                data-tooltip={tip}
                aria-label={`${name} — ${item.shortcut}`}
                aria-pressed={active}
                onClick={() => {
                  if (disabled) return;
                  if (ACTIVE_TOOLS.has(item.id)) setTool(item.id as WbTool);
                }}
              >
                    <item.icon size={15} aria-hidden="true" />
                  </button>
                );
              })}
            </span>
          ))}
          <span className="wb-sep" aria-hidden="true" />
          <button
            type="button"
            className={`sub-tab${snapOn ? ' sub-tab-active' : ''}`}
            title={readOnly ? t('whiteboard.viewer.readOnlyTip') : snapOn ? t('whiteboard.canvas.snapOn') : t('whiteboard.canvas.snapOff')}
            data-tooltip={readOnly ? t('whiteboard.viewer.readOnlyTip') : snapOn ? t('whiteboard.canvas.snapOn') : t('whiteboard.canvas.snapOff')}
            aria-label={snapOn ? t('whiteboard.canvas.snapOn') : t('whiteboard.canvas.snapOff')}
            aria-pressed={snapOn}
            disabled={readOnly}
            onClick={() => setSnapOn((v) => !v)}
          >
            <MagnetStraight size={15} aria-hidden="true" />
          </button>
          <span className="wb-sep" aria-hidden="true" />
          <button
            type="button"
            className="sub-tab"
            disabled={!history.canUndo || readOnly}
            title={readOnly ? t('whiteboard.viewer.readOnlyTip') : t('whiteboard.toolbar.undoTitle')}
            data-tooltip={readOnly ? t('whiteboard.viewer.readOnlyTip') : t('whiteboard.toolbar.undoTitle')}
            aria-label={t('whiteboard.toolbar.undoAria')}
            onClick={history.undo}
          >
            <ArrowCounterClockwise size={15} aria-hidden="true" />
          </button>
          <button
            type="button"
            className="sub-tab"
            disabled={!history.canRedo || readOnly}
            title={readOnly ? t('whiteboard.viewer.readOnlyTip') : t('whiteboard.toolbar.redoTitle')}
            data-tooltip={readOnly ? t('whiteboard.viewer.readOnlyTip') : t('whiteboard.toolbar.redoTitle')}
            aria-label={t('whiteboard.toolbar.redoAria')}
            onClick={history.redo}
          >
            <ArrowClockwise size={15} aria-hidden="true" />
          </button>
          <span className="wb-sep" aria-hidden="true" />
          <button
            type="button"
            className="sub-tab"
            title={isFullscreen ? t('whiteboard.toolbar.fsExitTitle') : t('whiteboard.toolbar.fsEnterTitle')}
            data-tooltip={isFullscreen ? t('whiteboard.toolbar.fsExitTitle') : t('whiteboard.toolbar.fsEnterTitle')}
            aria-label={isFullscreen ? t('whiteboard.toolbar.fsExitAria') : t('whiteboard.toolbar.fsEnterAria')}
            aria-pressed={isFullscreen}
            onClick={toggleFullscreen}
          >
            {isFullscreen ? (
              <ArrowsInSimple size={15} aria-hidden="true" />
            ) : (
              <ArrowsOutSimple size={15} aria-hidden="true" />
            )}
          </button>
          <span className="wb-export-wrap">
            <button
              type="button"
              className="sub-tab"
              disabled={elementCount === 0}
              title={elementCount === 0 ? t('whiteboard.export.emptyTitle') : t('whiteboard.export.title')}
              data-tooltip={elementCount === 0 ? t('whiteboard.export.emptyTitle') : t('whiteboard.export.title')}
              aria-label={t('whiteboard.export.menuLabel')}
              aria-haspopup="menu"
              aria-expanded={exportOpen}
              onClick={() => setExportOpen((open) => !open)}
            >
              <Export size={15} aria-hidden="true" />
            </button>
            {exportOpen && (
              <div ref={exportMenuRef} className="wb-export-menu" role="menu" aria-label={t('whiteboard.export.menuLabel')}>
                <button
                  type="button"
                  role="menuitem"
                  className="wb-export-item"
                  onClick={() => {
                    setExportOpen(false);
                    downloadWhiteboardPng(board, refDataMap);
                  }}
                >
                  {t('whiteboard.export.png')}
                </button>
                <button
                  type="button"
                  role="menuitem"
                  className="wb-export-item"
                  onClick={() => {
                    setExportOpen(false);
                    downloadWhiteboardSvg(board, refDataMap);
                  }}
                >
                  {t('whiteboard.export.svg')}
                </button>
                <button
                  type="button"
                  role="menuitem"
                  className="wb-export-item"
                  onClick={() => {
                    setExportOpen(false);
                    downloadWhiteboardPdf(board, refDataMap);
                  }}
                >
                  {t('whiteboard.export.pdf')}
                </button>
              </div>
            )}
          </span>
          {!layersCollapsed && (
            <>
              <span className="wb-sep" aria-hidden="true" />
              <button
                type="button"
                className="sub-tab"
                title={t('whiteboard.layers.collapse')}
                data-tooltip={t('whiteboard.layers.collapse')}
                aria-label={t('whiteboard.layers.collapse')}
                onClick={() => setLayersCollapsed(true)}
              >
                <List size={15} aria-hidden="true" />
              </button>
            </>
          )}
          {layersCollapsed && (
            <>
              <span className="wb-sep" aria-hidden="true" />
              <button
                type="button"
                className="sub-tab"
                title={t('whiteboard.layers.expand')}
                data-tooltip={t('whiteboard.layers.expand')}
                aria-label={t('whiteboard.layers.expand')}
                onClick={() => setLayersCollapsed(false)}
              >
                <List size={15} aria-hidden="true" />
              </button>
            </>
          )}
          {!inspectorCollapsed && (
            <>
              <span className="wb-sep" aria-hidden="true" />
              <button
                type="button"
                className="sub-tab"
                title={t('whiteboard.inspector.collapse')}
                data-tooltip={t('whiteboard.inspector.collapse')}
                aria-label={t('whiteboard.inspector.collapse')}
                onClick={() => setInspectorCollapsed(true)}
              >
                <SidebarSimple size={15} aria-hidden="true" />
              </button>
            </>
          )}
          {inspectorCollapsed && (
            <>
              <span className="wb-sep" aria-hidden="true" />
              <button
                type="button"
                className="sub-tab"
                title={t('whiteboard.inspector.expand')}
                data-tooltip={t('whiteboard.inspector.expand')}
                aria-label={t('whiteboard.inspector.expand')}
                onClick={() => setInspectorCollapsed(false)}
              >
                <SidebarSimple size={15} aria-hidden="true" />
              </button>
            </>
          )}
        </div>
        {nearCap && (
          <div className={`wb-cap-banner${atCap ? ' wb-cap-banner-danger' : ''}`} role="alert">
            <Badge tone={atCap ? 'danger' : 'warn'}>{t('whiteboard.cap.badge', { count: elementCount })}</Badge>
            <span>
              {atCap
                ? t('whiteboard.cap.atLimit')
                : t('whiteboard.cap.nearLimit')}
            </span>
          </div>
        )}
        {readOnly && (
          <div className="wb-cap-banner" role="status" aria-live="polite">
            <Badge tone="info">{t('whiteboard.viewer.badge')}</Badge>
            <span>{t('whiteboard.viewer.banner')}</span>
          </div>
        )}
      </div>

      <div className="wb-main">
        {!layersCollapsed && (
          <aside className="wb-layers-wrap" role="complementary" aria-label={t('whiteboard.layers.panelLabel')}>
            <WhiteboardLayers elements={board.elements} selectedIds={selectedIds} onSelect={handleLayersSelect} onToggleLock={handleLayersToggleLock} />
          </aside>
        )}
        <div className="wb-main-canvas">
          <WhiteboardCanvas
            board={board}
            tool={readOnly && tool !== 'view' && tool !== 'select' && tool !== 'marquee' ? 'select' : tool}
            history={history}
            readOnly={readOnly}
            selectedIds={selectedIds}
            onSelectedChange={setSelectedIds}
            snapOn={snapOn}
            onSnapChange={setSnapOn}
            penColor={penColor}
            penWidth={penWidth}
            eraserWidth={eraserWidth}
            stickyColor={stickyColor}
            stickyTextColor={stickyTextColor}
            stickyFontSize={stickyFontSize}
            stickyAlign={stickyAlign}
            textColor={textColor}
            textFontSize={textFontSize}
            textAlign={textAlign}
            shapeColor={shapeColor}
            shapeLabelColor={shapeLabelColor}
            shapeFontSize={shapeFontSize}
            shapeAlign={shapeAlign}
            edgeColor={edgeColor}
            edgeFontSize={edgeFontSize}
            edgeAlign={edgeAlign}
            boundaryColor={boundaryColor}
            boundaryLabelColor={boundaryLabelColor}
            boundaryFontSize={boundaryFontSize}
            boundaryAlign={boundaryAlign}
            onToolChange={setTool}
            panToId={panToId}
          />
        </div>
        {!inspectorCollapsed && (
          <aside className="wb-side" role="complementary" aria-label={t('whiteboard.inspector.panelLabel')}>
            <WhiteboardInspector
              element={tool !== 'select' ? null : selectedElement}
              selectedCount={tool !== 'select' ? 0 : selectedIds.length}
              onPatch={handleInspectorPatch}
              onDone={handleInspectorDone}
              onCancel={handleInspectorCancel}
              onCollapse={() => setInspectorCollapsed(true)}
              tool={tool}
              penColor={penColor}
              penWidth={penWidth}
              onPenColorChange={setPenColor}
              onPenWidthChange={setPenWidth}
              eraserWidth={eraserWidth}
              onEraserWidthChange={setEraserWidth}
              stickyColor={stickyColor}
              stickyTextColor={stickyTextColor}
              stickyFontSize={stickyFontSize}
              stickyAlign={stickyAlign}
              onStickyColorChange={setStickyColor}
              onStickyTextColorChange={setStickyTextColor}
              onStickyFontSizeChange={setStickyFontSize}
              onStickyAlignChange={(a) => setStickyAlign(a)}
              textColor={textColor}
              textFontSize={textFontSize}
              textAlign={textAlign}
              onTextColorChange={setTextColor}
              onTextFontSizeChange={setTextFontSize}
              onTextAlignChange={(a) => setTextAlign(a)}
              shapeColor={shapeColor}
              shapeLabelColor={shapeLabelColor}
              shapeFontSize={shapeFontSize}
              shapeAlign={shapeAlign}
              onShapeColorChange={setShapeColor}
              onShapeLabelColorChange={setShapeLabelColor}
              onShapeFontSizeChange={setShapeFontSize}
              onShapeAlignChange={(a) => setShapeAlign(a)}
              edgeColor={edgeColor}
              edgeFontSize={edgeFontSize}
              edgeAlign={edgeAlign}
              onEdgeColorChange={setEdgeColor}
              onEdgeFontSizeChange={setEdgeFontSize}
              onEdgeAlignChange={(a) => setEdgeAlign(a)}
              boundaryColor={boundaryColor}
              boundaryLabelColor={boundaryLabelColor}
              boundaryFontSize={boundaryFontSize}
              boundaryAlign={boundaryAlign}
              onBoundaryColorChange={setBoundaryColor}
              onBoundaryLabelColorChange={setBoundaryLabelColor}
              onBoundaryFontSizeChange={setBoundaryFontSize}
              onBoundaryAlignChange={(a) => setBoundaryAlign(a)}
              refTitle={selectedRefData?.title ?? null}
              refMeta={selectedRefData?.meta ?? null}
            />
          </aside>
        )}
      </div>
    </div>
  );
}
