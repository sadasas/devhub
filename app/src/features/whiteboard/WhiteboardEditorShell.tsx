import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { ArrowClockwise, ArrowCounterClockwise, ArrowLeft, ArrowsOutSimple, BoundingBox, Cards, Cursor, DotsThree, Eraser, Export, FlowArrow, FrameCorners, HandPointing, MagnetStraight, Note, PenNib, Presentation, Selection, Stack, TextT, Trash, X } from '@phosphor-icons/react';
import { Badge } from '../../components/Badge';
import { Button } from '../../components/Button';
import { Tooltip } from '../../components/Tooltip';
import type { State, Whiteboard, WhiteboardAlign, WhiteboardShape, WhiteboardShapeType, WhiteboardArrowStyle, WhiteboardEdge } from '../../lib/types';
import { WhiteboardCanvas } from './WhiteboardCanvas';
import { WhiteboardInspector } from './WhiteboardInspector';
import { WhiteboardLayers } from './WhiteboardLayers';
import { SHORTCUTS } from './shortcuts';
import { isModalOrPaletteOpen, isTypingTarget } from '../../lib/keys';
import type { WbTool } from './tools';
import { useWhiteboardHistory } from './useWhiteboardHistory';
import { buildRefDataMap } from './ref-data';
import { shapePath } from './geometry';
import { downloadWhiteboardPdf, downloadWhiteboardPng, downloadWhiteboardSvg } from './export';
import { useProject } from '../../state/project-context';
import { entityDeepLink } from '../../lib/deep-link';

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

// Mobile (≤640px): hand paling kiri + select/pen/shape; text dan sisanya di •••.
const MOBILE_TOOL_IDS: ReadonlySet<string> = new Set(['view', 'select', 'pen', 'shape']);
const MORE_TOOL_IDS: ReadonlySet<string> = new Set(['text', 'marquee', 'eraser', 'sticky', 'edge', 'ref', 'boundary']);
// Tool menggambar yang punya default props di inspector (sheet mobile ikut tampil).
const DRAW_DEFAULT_TOOLS: ReadonlySet<string> = new Set(['pen', 'eraser', 'sticky', 'text', 'shape', 'edge', 'boundary']);
const SHAPE_TYPE_LABEL: Record<string, string> = {
  rect: 'Rectangle',
  diamond: 'Diamond',
  ellipse: 'Ellipse',
  cylinder: 'Cylinder',
  parallelogram: 'Parallelogram',
  hexagon: 'Hexagon',
  roundedRect: 'Rounded rect',
};

function useIsWbMobile(): boolean {
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

const clampFont = (v: number, def: number) => (Number.isFinite(v) ? Math.max(4, Math.min(72, v)) : def);
const ALLOWED_SHAPE_TYPES: ReadonlySet<string> = new Set(['rect', 'diamond', 'ellipse', 'cylinder', 'parallelogram', 'hexagon', 'roundedRect']);
const ALLOWED_ARROW: ReadonlySet<string> = new Set(['none', 'open', 'solid', 'diamond', 'circle']);
const ALLOWED_DASH: ReadonlySet<string> = new Set(['solid', 'dashed', 'dotted']);

export function WhiteboardEditorShell({ board, state, readOnly = false, onBack }: WhiteboardEditorShellProps) {
  const { t } = useTranslation('extras');
  const { dispatch, projectId } = useProject();
  const navigate = useNavigate();
  const [tool, setTool] = useState<WbTool>('view');
  const history = useWhiteboardHistory(board.id, board.elements);
  const historyRef = useRef(history);
  historyRef.current = history;
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [presenting, setPresenting] = useState(false);
  const shellRef = useRef<HTMLDivElement | null>(null);
  const presentBtnRef = useRef<HTMLButtonElement | null>(null);
  const [shapeMenuOpen, setShapeMenuOpen] = useState(false);
  const [shapeMenuPos, setShapeMenuPos] = useState<{ top?: number; bottom?: number; left: number } | null>(null);
  const toolbarRef = useRef<HTMLDivElement | null>(null);
  const shapeBtnRef = useRef<HTMLButtonElement | null>(null);
  const shapeMenuRef = useRef<HTMLDivElement | null>(null);
  const shapeHoverTimer = useRef<number | null>(null);
  const exitBtnRef = useRef<HTMLButtonElement | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement | null>(null);
  const isMobile = useIsWbMobile();
  const [moreOpen, setMoreOpen] = useState(false);
  const [mobileLayersOpen, setMobileLayersOpen] = useState(false);
  const moreMenuRef = useRef<HTMLDivElement | null>(null);
  const moreBtnRef = useRef<HTMLButtonElement | null>(null);
  // WB-3/WB-6/WB-10: transient canvas notice (export failure, edge hint, trash restore).
  interface NoticeAction {
    label: string;
    run: () => void;
  }
  const [notice, setNotice] = useState<{ msg: string; action?: NoticeAction } | null>(null);
  const noticeTimer = useRef<number | null>(null);
  const flashNotice = (msg: string, action?: NoticeAction) => {
    setNotice({ msg, action });
    if (noticeTimer.current !== null) window.clearTimeout(noticeTimer.current);
    noticeTimer.current = window.setTimeout(() => setNotice(null), 6000);
  };
  useEffect(() => () => {
    if (noticeTimer.current !== null) window.clearTimeout(noticeTimer.current);
  }, []);
  // WB-4: transparent-background toggle (default bakes the theme canvas BG).
  const [exportTransparent, setExportTransparent] = useState<boolean>(() => {
    try {
      return localStorage.getItem('wb:exportTransparent') === '1';
    } catch {
      return false;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem('wb:exportTransparent', exportTransparent ? '1' : '0');
    } catch {}
  }, [exportTransparent]);
  const exportOpts: { background: 'transparent' | 'theme' } = {
    background: exportTransparent ? 'transparent' : 'theme',
  };
  const refDataMap = useMemo(() => buildRefDataMap(board.elements, state), [board.elements, state]);
  const elementCount = board.elements.length;
  const nearCap = elementCount >= WARN_ELEMENTS;
  const atCap = elementCount >= MAX_ELEMENTS;

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  // WB-4: per-selection export source (elements + their ref data).
  const { selectedElements, selectedRefData: selectionRefData } = useMemo(() => {
    const els = board.elements.filter((el) => selectedIds.includes(el.id));
    return {
      selectedElements: els,
      selectedRefData: new Map(els.map((el) => [el.id, refDataMap.get(el.id) ?? null] as const)),
    };
  }, [board.elements, selectedIds, refDataMap]);
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
    try { const v = Number(localStorage.getItem('wb:stickyFontSize')); return clampFont(v, 12); } catch { return 12; }
  });
  const [stickyAlign, setStickyAlign] = useState<WhiteboardAlign>(() => {
    try { return (localStorage.getItem('wb:stickyAlign') as WhiteboardAlign) ?? 'left'; } catch { return 'left'; }
  });
  const [textColor, setTextColor] = useState<string>(() => {
    try { return localStorage.getItem('wb:textColor') ?? '#e4e4e7'; } catch { return '#e4e4e7'; }
  });
  const [textFontSize, setTextFontSize] = useState<number>(() => {
    try { const v = Number(localStorage.getItem('wb:textFontSize')); return clampFont(v, 16); } catch { return 16; }
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
    try { const v = Number(localStorage.getItem('wb:shapeFontSize')); return clampFont(v, 12); } catch { return 12; }
  });
  const [shapeAlign, setShapeAlign] = useState<WhiteboardAlign>(() => {
    try { return (localStorage.getItem('wb:shapeAlign') as WhiteboardAlign) ?? 'center'; } catch { return 'center'; }
  });
  const [shapeType, setShapeType] = useState<WhiteboardShapeType>(() => {
    try { const v = localStorage.getItem('wb:shapeType'); return (v && ALLOWED_SHAPE_TYPES.has(v) ? v : 'rect') as WhiteboardShapeType; } catch { return 'rect'; }
  });
  const [shapeLabel, setShapeLabel] = useState<string>(() => {
    try { return localStorage.getItem('wb:shapeLabel') ?? ''; } catch { return ''; }
  });
  const [shapeFill, setShapeFill] = useState<boolean>(() => {
    try { return localStorage.getItem('wb:shapeFill') === '1'; } catch { return false; }
  });
  const [edgeColor, setEdgeColor] = useState<string>(() => {
    try { return localStorage.getItem('wb:edgeColor') ?? '#e4e4e7'; } catch { return '#e4e4e7'; }
  });
  const [edgeFontSize, setEdgeFontSize] = useState<number>(() => {
    try { const v = Number(localStorage.getItem('wb:edgeFontSize')); return clampFont(v, 11); } catch { return 11; }
  });
  const [edgeAlign, setEdgeAlign] = useState<WhiteboardAlign>(() => {
    try { return (localStorage.getItem('wb:edgeAlign') as WhiteboardAlign) ?? 'center'; } catch { return 'center'; }
  });
  const [edgeLabel, setEdgeLabel] = useState<string>(() => {
    try { return localStorage.getItem('wb:edgeLabel') ?? ''; } catch { return ''; }
  });
  const [edgeArrowStyle, setEdgeArrowStyle] = useState<WhiteboardArrowStyle>(() => {
    try { const v = localStorage.getItem('wb:edgeArrowStyle'); return (v && ALLOWED_ARROW.has(v) ? v : 'solid') as WhiteboardArrowStyle; } catch { return 'solid'; }
  });
  const [edgeDash, setEdgeDash] = useState<NonNullable<WhiteboardEdge['dash']>>(() => {
    try { const v = localStorage.getItem('wb:edgeDash'); return (v && ALLOWED_DASH.has(v) ? v : 'solid') as NonNullable<WhiteboardEdge['dash']>; } catch { return 'solid'; }
  });
  const [boundaryColor, setBoundaryColor] = useState<string>(() => {
    try { return localStorage.getItem('wb:boundaryColor') ?? '#6ea8fe'; } catch { return '#6ea8fe'; }
  });
  const [boundaryLabelColor, setBoundaryLabelColor] = useState<string>(() => {
    try { return localStorage.getItem('wb:boundaryLabelColor') ?? '#e4e4e7'; } catch { return '#e4e4e7'; }
  });
  const [boundaryFontSize, setBoundaryFontSize] = useState<number>(() => {
    try { const v = Number(localStorage.getItem('wb:boundaryFontSize')); return clampFont(v, 12); } catch { return 12; }
  });
  const [boundaryAlign, setBoundaryAlign] = useState<WhiteboardAlign>(() => {
    try { return (localStorage.getItem('wb:boundaryAlign') as WhiteboardAlign) ?? 'left'; } catch { return 'left'; }
  });
  const [boundaryLabel, setBoundaryLabel] = useState<string>(() => {
    try { return localStorage.getItem('wb:boundaryLabel') ?? ''; } catch { return ''; }
  });
  const [panToId, setPanToId] = useState<string | null>(null);
  // WB-11: only Layers collapses (via its panel header); Properties always visible.
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
  useEffect(() => { try { localStorage.setItem('wb:shapeType', shapeType); } catch {} }, [shapeType]);
  useEffect(() => { try { localStorage.setItem('wb:shapeLabel', shapeLabel); } catch {} }, [shapeLabel]);
  useEffect(() => { try { localStorage.setItem('wb:shapeFill', shapeFill ? '1' : '0'); } catch {} }, [shapeFill]);
  useEffect(() => { try { localStorage.setItem('wb:edgeColor', edgeColor); } catch {} }, [edgeColor]);
  useEffect(() => { try { localStorage.setItem('wb:edgeFontSize', String(edgeFontSize)); } catch {} }, [edgeFontSize]);
  useEffect(() => { try { localStorage.setItem('wb:edgeAlign', edgeAlign); } catch {} }, [edgeAlign]);
  useEffect(() => { try { localStorage.setItem('wb:edgeLabel', edgeLabel); } catch {} }, [edgeLabel]);
  useEffect(() => { try { localStorage.setItem('wb:edgeArrowStyle', edgeArrowStyle); } catch {} }, [edgeArrowStyle]);
  useEffect(() => { try { localStorage.setItem('wb:edgeDash', edgeDash); } catch {} }, [edgeDash]);
  useEffect(() => { try { localStorage.setItem('wb:boundaryColor', boundaryColor); } catch {} }, [boundaryColor]);
  useEffect(() => { try { localStorage.setItem('wb:boundaryLabelColor', boundaryLabelColor); } catch {} }, [boundaryLabelColor]);
  useEffect(() => { try { localStorage.setItem('wb:boundaryFontSize', String(boundaryFontSize)); } catch {} }, [boundaryFontSize]);
  useEffect(() => { try { localStorage.setItem('wb:boundaryAlign', boundaryAlign); } catch {} }, [boundaryAlign]);
  useEffect(() => { try { localStorage.setItem('wb:boundaryLabel', boundaryLabel); } catch {} }, [boundaryLabel]);

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

  // WB-8: jump from a ref card to its source entity.
  const handleOpenRef = () => {
    if (selectedElement?.kind === 'ref') {
      navigate(entityDeepLink(projectId, selectedElement.entity, selectedElement.entityId));
    }
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
    if (!exportOpen && !shapeMenuOpen && !moreOpen) return;
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (!exportMenuRef.current?.contains(target)) setExportOpen(false);
      if (!shapeMenuRef.current?.contains(target) && !shapeBtnRef.current?.contains(target)) {
        setShapeMenuOpen(false);
      }
      if (!moreMenuRef.current?.contains(target) && !moreBtnRef.current?.contains(target)) {
        setMoreOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setExportOpen(false);
        setShapeMenuOpen(false);
        setMoreOpen(false);
      }
    };
    window.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [exportOpen, shapeMenuOpen, moreOpen]);

  // Tooltip pill kini via komponen Tooltip reusable (floating-ui) per tombol.
  // (Delegasi [data-tooltip] + wb-tip-fixed lama dihapus.)

  const openShapeMenu = () => {
    setExportOpen(false);
    const btn = shapeBtnRef.current;
    const bar = toolbarRef.current;
    if (btn && bar) {
      const r = btn.getBoundingClientRect();
      const pill = bar.getBoundingClientRect();
      const left = Math.max(0, Math.min(r.left - pill.left, pill.width - 250));
      // Toolbar mobile di bawah → menu buka ke atas (jangkar bottom).
      const smallScreen =
        typeof window !== 'undefined' &&
        typeof window.matchMedia === 'function' &&
        window.matchMedia('(max-width: 640px)').matches;
      setShapeMenuPos(
        smallScreen ? { bottom: pill.bottom - r.top + 6, left } : { top: r.bottom - pill.top + 6, left },
      );
    } else {
      setShapeMenuPos(null);
    }
    setShapeMenuOpen(true);
  };

  const toggleShapeMenu = () => {
    if (shapeMenuOpen) setShapeMenuOpen(false);
    else openShapeMenu();
  };

  // WB-21: hover intent open/close (click still toggles).
  const cancelShapeHoverTimer = () => {
    if (shapeHoverTimer.current !== null) {
      window.clearTimeout(shapeHoverTimer.current);
      shapeHoverTimer.current = null;
    }
  };
  const scheduleOpenShapeMenu = () => {
    cancelShapeHoverTimer();
    shapeHoverTimer.current = window.setTimeout(openShapeMenu, 200);
  };
  const scheduleCloseShapeMenu = () => {
    cancelShapeHoverTimer();
    shapeHoverTimer.current = window.setTimeout(() => setShapeMenuOpen(false), 300);
  };
  useEffect(() => () => cancelShapeHoverTimer(), []);

  const pickShapeType = (st: WhiteboardShapeType) => {
    setShapeType(st);
    if (selectedElement?.kind === 'shape') {
      handleInspectorPatch({ shapeType: st });
    } else {
      setTool('shape');
    }
    setShapeMenuOpen(false);
  };

  // State + renderer tombol tool bersama (pill desktop, pill mobile, menu •••).
  const toolBtnState = (item: (typeof TOOLS)[number]) => {
    const active = ACTIVE_TOOLS.has(item.id) && tool === item.id;
    const blocked = atCap && ADD_TOOLS.has(item.id);
    const readOnlyBlocked = readOnly && item.id !== 'view' && item.id !== 'select' && item.id !== 'marquee';
    const name = t(item.nameKey);
    const disabled = !ACTIVE_TOOLS.has(item.id) || blocked || readOnlyBlocked;
    const tip = readOnlyBlocked ? t('whiteboard.viewer.readOnlyTip') : blocked ? t('whiteboard.tool.limitReached', { name }) : `${name} — ${item.shortcut}`;
    return { active, disabled, tip, name };
  };

  const renderToolButton = (item: (typeof TOOLS)[number]) => {
    const { active, disabled, tip, name } = toolBtnState(item);
    const isShape = item.id === 'shape';
    return (
      <Tooltip key={item.id} content={tip} side="bottom">
        <button
          ref={isShape ? shapeBtnRef : undefined}
          type="button"
          className={`sub-tab${active ? ' sub-tab-active' : ''}`}
          disabled={disabled}
          aria-label={`${name} — ${item.shortcut}`}
          aria-pressed={active}
          aria-haspopup={isShape ? 'menu' : undefined}
          aria-expanded={isShape ? shapeMenuOpen : undefined}
          onClick={() => {
            if (disabled) return;
            setMoreOpen(false);
            if (isShape) toggleShapeMenu();
            else if (ACTIVE_TOOLS.has(item.id)) setTool(item.id as WbTool);
          }}
          onMouseEnter={isShape ? scheduleOpenShapeMenu : undefined}
          onMouseLeave={isShape ? scheduleCloseShapeMenu : undefined}
        >
          <item.icon size={15} aria-hidden="true" />
        </button>
      </Tooltip>
    );
  };

  const renderUndoButton = () => (
    <Tooltip content={readOnly ? t('whiteboard.viewer.readOnlyTip') : t('whiteboard.toolbar.undoTitle')} side="bottom">
      <button
        type="button"
        className="sub-tab"
        disabled={!history.canUndo || readOnly}
        aria-label={t('whiteboard.toolbar.undoAria')}
        onClick={history.undo}
      >
        <ArrowCounterClockwise size={15} aria-hidden="true" />
      </button>
    </Tooltip>
  );

  const renderRedoButton = () => (
    <Tooltip content={readOnly ? t('whiteboard.viewer.readOnlyTip') : t('whiteboard.toolbar.redoTitle')} side="bottom">
      <button
        type="button"
        className="sub-tab"
        disabled={!history.canRedo || readOnly}
        aria-label={t('whiteboard.toolbar.redoAria')}
        onClick={history.redo}
      >
        <ArrowClockwise size={15} aria-hidden="true" />
      </button>
    </Tooltip>
  );

  const renderSnapButton = () => (
    <Tooltip content={readOnly ? t('whiteboard.viewer.readOnlyTip') : snapOn ? t('whiteboard.canvas.snapOn') : t('whiteboard.canvas.snapOff')} side="bottom">
      <button
        type="button"
        className={`sub-tab${snapOn ? ' sub-tab-active' : ''}`}
        aria-label={snapOn ? t('whiteboard.canvas.snapOn') : t('whiteboard.canvas.snapOff')}
        aria-pressed={snapOn}
        disabled={readOnly}
        onClick={() => setSnapOn((v) => !v)}
      >
        <MagnetStraight size={15} aria-hidden="true" />
      </button>
    </Tooltip>
  );

  const renderPresentButton = () => (
    <Tooltip content={t('whiteboard.toolbar.presentTitle')} side="bottom">
      <button
        type="button"
        ref={presentBtnRef}
        className="sub-tab"
        aria-label={t('whiteboard.toolbar.presentAria')}
        onClick={handleEnterPresenting}
      >
        <Presentation size={15} aria-hidden="true" />
      </button>
    </Tooltip>
  );

  const renderExportButton = () => (
    <Tooltip content={elementCount === 0 ? t('whiteboard.export.emptyTitle') : t('whiteboard.export.title')} side="bottom">
      <button
        type="button"
        className="sub-tab"
        disabled={elementCount === 0}
        aria-label={t('whiteboard.export.menuLabel')}
        aria-haspopup="menu"
        aria-expanded={exportOpen}
        onClick={() => setExportOpen((open) => !open)}
      >
        <Export size={15} aria-hidden="true" />
      </button>
    </Tooltip>
  );

  // Hapus seleksi dari sheet mobile — mirror WhiteboardCanvas.removeSelection
  // (edge yang menempel ikut terhapus, locked dilewati). Tanpa trash-restore
  // notice (milik internal canvas); undo via history tetap jalan.
  const handleDeleteSelection = () => {
    if (readOnly || selectedIds.length === 0) return;
    const sel = new Set(selectedIds);
    const lockedIds = new Set(board.elements.filter((el) => el.locked).map((el) => el.id));
    const next = board.elements.filter((el) => {
      if (lockedIds.has(el.id)) return true;
      if (sel.has(el.id)) return false;
      if (el.kind === 'edge' && ((el.sourceNodeId && sel.has(el.sourceNodeId) && !lockedIds.has(el.sourceNodeId)) || (el.targetNodeId && sel.has(el.targetNodeId) && !lockedIds.has(el.targetNodeId)))) {
        return false;
      }
      return true;
    });
    const removedCount = board.elements.length - next.length;
    if (removedCount === 0) return;
    history.record();
    dispatch({ type: 'whiteboard/update', id: board.id, patch: { elements: next } });
    setSelectedIds([]);
    flashNotice(t('whiteboard.canvas.deletedN', { count: removedCount }));
  };

  // Sheet properti mobile tampil hanya bila ada konten: seleksi atau
  // tool gambar yang punya default props. Empty-state inspector = hidden.
  const showMobileProps = isMobile && !presenting && (selectedElement !== null || selectedIds.length > 1 || DRAW_DEFAULT_TOOLS.has(tool));

  const mobilePropsTitle = (): string => {
    if (selectedElement) {
      if (selectedElement.kind === 'shape') {
        return SHAPE_TYPE_LABEL[(selectedElement as WhiteboardShape).shapeType] ?? (t('whiteboard.tool.shape') as string);
      }
      if (selectedElement.kind === 'stroke') return t('whiteboard.tool.pen') as string;
      const found = TOOLS.find((x) => x.id === selectedElement.kind);
      return found ? (t(found.nameKey) as string) : selectedElement.kind;
    }
    if (selectedIds.length > 1) return t('whiteboard.inspector.multiTitle', { count: selectedIds.length }) as string;
    const found = TOOLS.find((x) => x.id === tool);
    return found ? (t(found.nameKey) as string) : tool;
  };

  // Menu export dipakai ulang di pill desktop dan panel ••• mobile.
  const exportMenu = exportOpen ? (
    <div ref={exportMenuRef} className="wb-export-menu" role="menu" aria-label={t('whiteboard.export.menuLabel')}>
      <button
        type="button"
        role="menuitem"
        className="wb-export-item"
        onClick={() => {
          setExportOpen(false);
          downloadWhiteboardPng(board, refDataMap, { ...exportOpts, onError: () => flashNotice(t('whiteboard.export.pngFailed')) });
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
          downloadWhiteboardSvg(board, refDataMap, exportOpts);
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
          downloadWhiteboardPdf(board, refDataMap, { ...exportOpts, onError: () => flashNotice(t('whiteboard.export.pdfBlocked')) });
        }}
      >
        {t('whiteboard.export.pdf')}
      </button>
      {selectedElements.length > 0 && (
        <>
          <div className="wb-export-sep" role="separator" aria-hidden="true" />
          <button
            type="button"
            role="menuitem"
            className="wb-export-item"
            onClick={() => {
              setExportOpen(false);
              const sel = { ...board, elements: selectedElements };
              downloadWhiteboardPng(sel, selectionRefData, { ...exportOpts, onError: () => flashNotice(t('whiteboard.export.pngFailed')) });
            }}
          >
            {t('whiteboard.export.pngSelection')}
          </button>
          <button
            type="button"
            role="menuitem"
            className="wb-export-item"
            onClick={() => {
              setExportOpen(false);
              const sel = { ...board, elements: selectedElements };
              downloadWhiteboardSvg(sel, selectionRefData, exportOpts);
            }}
          >
            {t('whiteboard.export.svgSelection')}
          </button>
          <button
            type="button"
            role="menuitem"
            className="wb-export-item"
            onClick={() => {
              setExportOpen(false);
              const sel = { ...board, elements: selectedElements };
              downloadWhiteboardPdf(sel, selectionRefData, { ...exportOpts, onError: () => flashNotice(t('whiteboard.export.pdfBlocked')) });
            }}
          >
            {t('whiteboard.export.pdfSelection')}
          </button>
        </>
      )}
      <div className="wb-export-sep" role="separator" aria-hidden="true" />
      <button
        type="button"
        role="menuitemcheckbox"
        aria-checked={exportTransparent}
        className="wb-export-item"
        onClick={() => setExportTransparent((v) => !v)}
      >
        {t('whiteboard.export.transparent')}
      </button>
    </div>
  ) : null;

  // Panel inspector dipakai ulang di dock desktop dan sheet mobile.
  const inspectorPanel = (
    <WhiteboardInspector
      element={tool !== 'select' ? null : selectedElement}
      selectedCount={tool !== 'select' ? 0 : selectedIds.length}
      onPatch={handleInspectorPatch}
      onDone={handleInspectorDone}
      onCancel={handleInspectorCancel}
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
      shapeLabel={shapeLabel}
      shapeFill={shapeFill}
      onShapeColorChange={setShapeColor}
      onShapeLabelColorChange={setShapeLabelColor}
      onShapeFontSizeChange={setShapeFontSize}
      onShapeAlignChange={(a) => setShapeAlign(a)}
      onShapeLabelChange={setShapeLabel}
      onShapeFillChange={setShapeFill}
      edgeColor={edgeColor}
      edgeFontSize={edgeFontSize}
      edgeAlign={edgeAlign}
      edgeLabel={edgeLabel}
      edgeArrowStyle={edgeArrowStyle}
      edgeDash={edgeDash}
      onEdgeColorChange={setEdgeColor}
      onEdgeFontSizeChange={setEdgeFontSize}
      onEdgeAlignChange={(a) => setEdgeAlign(a)}
      onEdgeLabelChange={setEdgeLabel}
      onEdgeArrowStyleChange={setEdgeArrowStyle}
      onEdgeDashChange={setEdgeDash}
      boundaryColor={boundaryColor}
      boundaryLabelColor={boundaryLabelColor}
      boundaryFontSize={boundaryFontSize}
      boundaryAlign={boundaryAlign}
      boundaryLabel={boundaryLabel}
      onBoundaryColorChange={setBoundaryColor}
      onBoundaryLabelColorChange={setBoundaryLabelColor}
      onBoundaryFontSizeChange={setBoundaryFontSize}
      onBoundaryAlignChange={(a) => setBoundaryAlign(a)}
      onBoundaryLabelChange={setBoundaryLabel}
      refTitle={selectedRefData?.title ?? null}
      refMeta={selectedRefData?.meta ?? null}
      onOpenRef={handleOpenRef}
    />
  );

  const exitToNormal = () => {
    try {
      const p = document.exitFullscreen?.() as Promise<void> | undefined;
      p?.catch?.(() => {});
    } catch {
      /* abaikan — overlay tetap ditutup */
    }
    setPresenting(false);
    setIsFullscreen(false);
  };

  // WB-20: presentasi = true browser fullscreen (pola schema R11) + hide chrome.
  // Gagal/unsupported → tetap jalan sebagai overlay fullscreen (fallback graceful).
  const handleEnterPresenting = () => {
    setExportOpen(false);
    setShapeMenuOpen(false);
    setMoreOpen(false);
    setMobileLayersOpen(false);
    setIsFullscreen(true);
    setPresenting(true);
    try {
      const req = shellRef.current?.requestFullscreen?.() as Promise<void> | undefined;
      req?.catch?.(() => {});
    } catch {
      /* abaikan — mode overlay tetap berlaku */
    }
  };

  const handleExitPresenting = () => {
    exitToNormal();
  };

  const toggleFullscreen = () => {
    setIsFullscreen((v) => !v);
  };

  // WB-17: overlay modes lock body scroll.
  useEffect(() => {
    if (!isFullscreen && !presenting) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isFullscreen, presenting]);

  // WB-17: focus the exit control when entering an overlay mode.
  useEffect(() => {
    if (isFullscreen || presenting) exitBtnRef.current?.focus();
  }, [isFullscreen, presenting]);

  // WB-20: sinkron bila user keluar fullscreen via browser (Esc native):
  // fullscreenchange tanpa fullscreenElement = sudah tidak fullscreen.
  useEffect(() => {
    const onFsChange = () => {
      if (!document.fullscreenElement) {
        setPresenting(false);
        setIsFullscreen(false);
      }
    };
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  // WB-20: fokus kembali ke tombol Present saat keluar presentasi.
  const prevPresentingRef = useRef(presenting);
  useEffect(() => {
    const was = prevPresentingRef.current;
    prevPresentingRef.current = presenting;
    if (was && !presenting) presentBtnRef.current?.focus({ preventScroll: true });
  }, [presenting]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target) || isModalOrPaletteOpen()) return;
      if (e.altKey) return;
      const key = e.key;
      const mod = e.ctrlKey || e.metaKey;
      if (key === 'f' || key === 'F') {
        e.preventDefault();
        // WB-17: F steps out of present first, otherwise toggles fullscreen.
        if (presenting) handleExitPresenting();
        else toggleFullscreen();
        return;
      }
      // WB-17: tiered Esc — shape menu, then present, then fullscreen.
      // (Export menu owns its Esc; canvas clears selection itself.)
      if (key === 'Escape') {
        if (shapeMenuOpen) {
          e.preventDefault();
          setShapeMenuOpen(false);
          return;
        }
        if (presenting) {
          e.preventDefault();
          handleExitPresenting();
          return;
        }
        if (isFullscreen) {
          e.preventDefault();
          setIsFullscreen(false);
          return;
        }
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
  }, [atCap, readOnly, presenting, isFullscreen, shapeMenuOpen]);

  return (
    <div className={`wb-shell${isFullscreen ? ' wb-fullscreen' : ''}${presenting ? ' wb-presenting' : ''}`} ref={shellRef}>
      {!isFullscreen && !presenting && (
        <div className="wb-topbar">
          <Button variant="ghost" size="sm" className="back-btn" onClick={onBack} aria-label={t('whiteboard.toolbar.back')}>
            <ArrowLeft size={14} aria-hidden="true" />
          </Button>
          <span className="wb-board-name" title={board.name}>{board.name}</span>
          <span className="wb-topbar-spacer" aria-hidden="true" />
          <Button variant="ghost" size="sm" className="wb-canvas-mode-btn" leftIcon={<ArrowsOutSimple size={14} aria-hidden="true" />} onClick={toggleFullscreen} aria-label={t('whiteboard.toolbar.fsEnterAria')} title={t('whiteboard.toolbar.fsEnterTitle')}>
            {t('whiteboard.toolbar.canvasMode')}
          </Button>
        </div>
      )}
      <div className="wb-main">
        <div className="wb-main-canvas">
          <WhiteboardCanvas
            board={board}
            tool={readOnly && tool !== 'view' && tool !== 'select' && tool !== 'marquee' ? 'select' : tool}
            history={history}
            readOnly={readOnly || presenting}
            hideChrome={presenting}
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
            shapeType={shapeType}
            shapeLabel={shapeLabel}
            shapeFill={shapeFill}
            edgeColor={edgeColor}
            edgeFontSize={edgeFontSize}
            edgeAlign={edgeAlign}
            edgeLabel={edgeLabel}
            edgeArrowStyle={edgeArrowStyle}
            edgeDash={edgeDash}
            boundaryColor={boundaryColor}
            boundaryLabelColor={boundaryLabelColor}
            boundaryFontSize={boundaryFontSize}
            boundaryAlign={boundaryAlign}
            boundaryLabel={boundaryLabel}
            onToolChange={setTool}
            onNotice={flashNotice}
            panToId={panToId}
          />
      {!presenting && (
      <div
        className="board-toolbar"
        ref={toolbarRef}
      >
        {isMobile ? (
          <>
            <div className="sub-tabs wb-tool-scroll" role="toolbar" aria-label={t('whiteboard.toolbar.tools')}>
              {TOOLS.filter((item) => MOBILE_TOOL_IDS.has(item.id)).map((item) => renderToolButton(item))}
              <span className="wb-sep" aria-hidden="true" />
              <Tooltip content={t('whiteboard.toolbar.moreTools')} side="bottom">
                <button
                  ref={moreBtnRef}
                  type="button"
                  className={`sub-tab${moreOpen ? ' sub-tab-active' : ''}`}
                  aria-haspopup="menu"
                  aria-expanded={moreOpen}
                  aria-label={t('whiteboard.toolbar.moreTools')}
                  onClick={() => setMoreOpen((v) => !v)}
                >
                  <DotsThree size={15} weight="bold" aria-hidden="true" />
                </button>
              </Tooltip>
            </div>
            {moreOpen && (
              <div ref={moreMenuRef} className="wb-more-menu" role="menu" aria-label={t('whiteboard.toolbar.moreTools')}>
                <div className="wb-more-grid" role="group" aria-label={t('whiteboard.toolbar.tools')}>
                  {TOOLS.filter((item) => MORE_TOOL_IDS.has(item.id)).map((item) => renderToolButton(item))}
                </div>
                <div className="wb-more-sep" role="separator" aria-hidden="true" />
                <div className="wb-more-actions">
                  {renderSnapButton()}
                  {renderPresentButton()}
                  {renderExportButton()}
                </div>
                {exportOpen && <div className="wb-more-export">{exportMenu}</div>}
              </div>
            )}
          </>
        ) : (
          <>
            <div className="sub-tabs wb-tool-scroll" role="toolbar" aria-label={t('whiteboard.toolbar.tools')}>
              {TOOL_GROUPS.map((group, gi) => (
                <span key={gi} className="wb-tool-group" role="group" aria-label={gi === 0 ? 'Select' : gi === 1 ? 'Draw' : 'Insert'}>
                  {group.map((item) => renderToolButton(item))}
                </span>
              ))}
            </div>
            <div className="wb-tool-actions">
              <span className="wb-sep" aria-hidden="true" />
              {renderSnapButton()}
              <span className="wb-sep" aria-hidden="true" />
              {renderUndoButton()}
              {renderRedoButton()}
              <span className="wb-sep" aria-hidden="true" />
              {renderPresentButton()}
              <span className="wb-export-wrap">
                {renderExportButton()}
                {exportMenu}
              </span>
            </div>
          </>
        )}
        {shapeMenuOpen && (
          <div
            ref={shapeMenuRef}
            className="wb-export-menu wb-shape-menu"
            role="menu"
            aria-label={t('whiteboard.tool.shapeMenu')}
            style={shapeMenuPos ? { position: 'absolute', top: shapeMenuPos.top, bottom: shapeMenuPos.bottom, left: shapeMenuPos.left } : undefined}
            onMouseEnter={cancelShapeHoverTimer}
            onMouseLeave={scheduleCloseShapeMenu}
          >
            {([...ALLOWED_SHAPE_TYPES] as WhiteboardShapeType[]).map((st) => {
              const thumb: WhiteboardShape = {
                id: `thumb-${st}`, kind: 'shape', shapeType: st,
                x: 4, y: 8, w: 32, h: 24, color: '#6ea8fe', fill: false, strokeWidth: 2, label: '',
              };
              return (
                <Tooltip key={st} content={st} side="right">
                <button
                  type="button"
                  role="menuitemradio"
                  aria-checked={shapeType === st}
                  aria-label={st}
                  className="wb-export-item wb-shape-opt"
                  onClick={() => pickShapeType(st)}
                >
                  <svg viewBox="0 0 40 40" width={40} height={40} aria-hidden="true">
                    <path d={shapePath(thumb)} fill="none" stroke="currentColor" strokeWidth={2} />
                  </svg>
                </button>
                </Tooltip>
              );
            })}
          </div>
        )}
      </div>
      )}
      {isMobile && !presenting && (
        <>
          <div className="wb-mobile-undo" role="toolbar" aria-label={t('whiteboard.toolbar.tools')}>
            {renderUndoButton()}
            {renderRedoButton()}
          </div>
          <div className="wb-mobile-layers-anchor">
            <button
              type="button"
              className={`sub-tab wb-mobile-layers${mobileLayersOpen ? ' sub-tab-active' : ''}`}
              aria-haspopup="dialog"
              aria-expanded={mobileLayersOpen}
              aria-label={`${t('whiteboard.layers.title')} — ${board.elements.length}`}
              onClick={() => setMobileLayersOpen((v) => !v)}
            >
              <Stack size={15} aria-hidden="true" />
              <span className="wb-mobile-layers-count tabular">{board.elements.length}</span>
            </button>
            {mobileLayersOpen && (
              <div className="wb-mobile-layers-panel" role="dialog" aria-label={t('whiteboard.layers.panelLabel')}>
                <WhiteboardLayers
                  elements={board.elements}
                  selectedIds={selectedIds}
                  onSelect={(id) => { handleLayersSelect(id); setMobileLayersOpen(false); }}
                  onToggleLock={handleLayersToggleLock}
                  collapsed={false}
                  onToggleCollapse={() => setMobileLayersOpen(false)}
                />
              </div>
            )}
          </div>
          {showMobileProps && (
            <div className="wb-mobile-props" role="dialog" aria-label={mobilePropsTitle()}>
              <div className="sheet-handle" aria-hidden="true" />
              <div className="wb-mobile-props-head">
                <span className="wb-inspector-title">{mobilePropsTitle()}</span>
                {selectedIds.length > 0 && !readOnly && (
                  <button
                    type="button"
                    className="wb-mobile-props-delete"
                    aria-label={t('whiteboard.canvas.deleteSelected')}
                    title={t('whiteboard.canvas.deleteSelectedTitle')}
                    onClick={handleDeleteSelection}
                  >
                    <Trash size={15} aria-hidden="true" />
                  </button>
                )}
              </div>
              <div className="wb-mobile-props-body">
                {inspectorPanel}
              </div>
            </div>
          )}
        </>
      )}
      {!presenting && !isMobile && (
            <div className="wb-dock-right">
          <aside className="wb-side" role="complementary" aria-label={t('whiteboard.inspector.panelLabel')}>
            {inspectorPanel}
          </aside>
          <aside className="wb-layers-wrap" role="complementary" aria-label={t('whiteboard.layers.panelLabel')}>
            <WhiteboardLayers elements={board.elements} selectedIds={selectedIds} onSelect={handleLayersSelect} onToggleLock={handleLayersToggleLock} collapsed={layersCollapsed} onToggleCollapse={() => setLayersCollapsed((v) => !v)} />
          </aside>
            </div>
      )}
      {!presenting && isFullscreen && (
        <div className="wb-board-title" aria-hidden="true">{board.name}</div>
      )}
      {(isFullscreen || presenting) && (
        <button
          ref={exitBtnRef}
          type="button"
          className="wb-exit-overlay"
          aria-label={presenting ? t('whiteboard.toolbar.presentExitAria') : t('whiteboard.toolbar.fsExitAria')}
          title={presenting ? t('whiteboard.toolbar.presentExitTitle') : t('whiteboard.toolbar.fsExitTitle')}
          onClick={exitToNormal}
        >
          <X size={15} aria-hidden="true" />
        </button>
      )}
        </div>
      </div>
      {!presenting && (notice || nearCap || readOnly) && (
        <div className="wb-status-row">
        {notice && (
          <div className="wb-cap-banner wb-cap-banner-danger" role="alert">
            <span>{notice.msg}</span>
            {notice.action && (
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => {
                  notice.action?.run();
                  setNotice(null);
                }}
              >
                {notice.action.label}
              </button>
            )}
          </div>
        )}
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
      )}
    </div>
  );
}



