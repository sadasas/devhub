import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowClockwise, ArrowCounterClockwise, ArrowLeft, ArrowsOutSimple, BoundingBox, Cards, Cursor, DotsThree, DotsThreeVertical, Eraser, Export, FlowArrow, FrameCorners, HandPointing, MagnetStraight, Note, PenNib, Presentation, Selection, Stack, TextT, Trash, X } from '@phosphor-icons/react';
import { Badge } from '../../components/Badge';
import { Button } from '../../components/Button';
import { ToastStack } from '../../components/ToastStack';
import { Tooltip } from '../../components/Tooltip';
import type { State, Whiteboard, WhiteboardAlign, WhiteboardFontFamily, WhiteboardShapeType, WhiteboardArrowStyle } from '../../lib/types';
import { WhiteboardCanvas } from './WhiteboardCanvas';
import { WhiteboardLayers } from './WhiteboardLayers';
import { ShapeLibraryPanel } from './ShapeLibraryPanel';
import { ShapeThumb } from './ShapeThumb';
import { BASIC_SWATCHES } from './WhiteboardColorPanel';
import { WhiteboardShortcutsDialog } from './WhiteboardShortcutsDialog';
import { AlignDropdown, ColorDropdown, DropdownShell, DropCaret, FontDropdown, SizeDropdown, TextStyleToggles, WidthSlider } from './WhiteboardTextControls';
import { pushShapeRecent, type LibraryItem } from './libraries';
import { SHORTCUTS } from './shortcuts';
import { isModalOrPaletteOpen, isTypingTarget } from '../../lib/keys';
import type { WbTool } from './tools';
import { BOUNDARY_COLOR, PEN_COLOR, SHAPE_COLOR, TEXT_COLOR } from './tools';
import { remapLegacyLightColor } from './canvas-palette';

/**
 * Baca warna tersimpan dengan remap prefs light-legacy (didesain untuk
 * kanvas gelap) ke padanan gelap — kanvas kini selalu putih.
 */
function storedInk(key: string, fallback: string): string {
  try {
    return remapLegacyLightColor(localStorage.getItem(key) ?? fallback);
  } catch {
    return fallback;
  }
}
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
// FigJam delightful-toolbar grouping: navigation | objects | inserts.
const NAV_TOOL_IDS: ReadonlyArray<string> = ['view', 'select', 'marquee'];
const OBJECT_TOOL_IDS: ReadonlyArray<string> = ['pen', 'eraser', 'sticky', 'shape', 'edge'];
const INSERT_TOOL_IDS: ReadonlyArray<string> = ['text', 'boundary', 'ref'];

// Mobile (≤640px): select/pen/shape/view + more (text lives in •••).
const MOBILE_TOOL_IDS: ReadonlySet<string> = new Set(['select', 'pen', 'shape', 'view']);
const MORE_TOOL_IDS: ReadonlySet<string> = new Set(['text', 'marquee', 'eraser', 'sticky', 'edge', 'ref', 'boundary']);
// Tool menggambar yang punya defaults di strip atas pill.
const DRAW_DEFAULT_TOOLS: ReadonlySet<string> = new Set(['pen', 'eraser', 'sticky', 'text', 'shape', 'edge', 'boundary']);

// FigJam-identical primer strip (Image 1 order); the rest lives in More shapes.
const PRIMER_SHAPE_TYPES: ReadonlyArray<WhiteboardShapeType> = [
  'rect',
  'ellipse',
  'diamond',
  'triangleUp',
  'triangleDown',
  'capsule',
  'cylinder',
];

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

  const clampFont = (v: number, def: number) => (Number.isFinite(v) ? Math.max(4, Math.min(96, v)) : def);
const ALLOWED_SHAPE_TYPES: ReadonlySet<string> = new Set(['rect', 'diamond', 'ellipse', 'cylinder', 'parallelogram', 'hexagon', 'roundedRect', 'triangleUp', 'triangleDown', 'capsule']);
const ALLOWED_ARROW: ReadonlySet<string> = new Set(['none', 'open', 'solid', 'diamond', 'circle']);

export function WhiteboardEditorShell({ board, state, readOnly = false, onBack }: WhiteboardEditorShellProps) {
  const { t } = useTranslation('extras');
  const { dispatch } = useProject();
  const [tool, setTool] = useState<WbTool>('select');
  const history = useWhiteboardHistory(board.id, board.elements);
  const historyRef = useRef(history);
  historyRef.current = history;
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [presenting, setPresenting] = useState(false);
  const shellRef = useRef<HTMLDivElement | null>(null);
  const presentBtnRef = useRef<HTMLButtonElement | null>(null);
  const [shapeMenuOpen, setShapeMenuOpen] = useState(false);
  const toolbarRef = useRef<HTMLDivElement | null>(null);
  const shapeBtnRef = useRef<HTMLButtonElement | null>(null);
  const shapeMenuRef = useRef<HTMLDivElement | null>(null);
  const [layersOpen, setLayersOpen] = useState(false);
  const layersBtnRef = useRef<HTMLButtonElement | null>(null);
  const layersWrapRef = useRef<HTMLDivElement | null>(null);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const libraryWrapRef = useRef<HTMLDivElement | null>(null);
  const exitBtnRef = useRef<HTMLButtonElement | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement | null>(null);
  const isMobile = useIsWbMobile();
  const [moreOpen, setMoreOpen] = useState(false);
  const [trMoreOpen, setTrMoreOpen] = useState(false);
  const trMoreRef = useRef<HTMLDivElement | null>(null);
  const trMoreBtnRef = useRef<HTMLButtonElement | null>(null);
  const deleteSelRef = useRef<() => void>(() => {});
  const moreMenuRef = useRef<HTMLDivElement | null>(null);
  const moreBtnRef = useRef<HTMLButtonElement | null>(null);
  // Board-full feedback lives in the global toast (top-right) so deletes stay silent.
  const [capToast, setCapToast] = useState<string | null>(null);
  const capToastTimer = useRef<number | null>(null);
  const flashCapToast = (msg: string) => {
    setCapToast(msg);
    if (capToastTimer.current !== null) window.clearTimeout(capToastTimer.current);
    capToastTimer.current = window.setTimeout(() => setCapToast(null), 5000);
  };
  useEffect(() => () => {
    if (capToastTimer.current !== null) window.clearTimeout(capToastTimer.current);
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
  const [penColor, setPenColor] = useState<string>(() => storedInk('wb:penColor', PEN_COLOR));
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
  const [stickyFontSize, setStickyFontSize] = useState<number>(() => {
    try { const v = Number(localStorage.getItem('wb:stickyFontSize')); return clampFont(v, 12); } catch { return 12; }
  });
  const [stickyAlign, setStickyAlign] = useState<WhiteboardAlign>(() => {
    try { return (localStorage.getItem('wb:stickyAlign') as WhiteboardAlign) ?? 'left'; } catch { return 'left'; }
  });
  const [textColor, setTextColor] = useState<string>(() => storedInk('wb:textColor', TEXT_COLOR));
  const [textFontSize, setTextFontSize] = useState<number>(() => {
    try { const v = Number(localStorage.getItem('wb:textFontSize')); return clampFont(v, 16); } catch { return 16; }
  });
  const [textAlign, setTextAlign] = useState<WhiteboardAlign>(() => {
    try { return (localStorage.getItem('wb:textAlign') as WhiteboardAlign) ?? 'left'; } catch { return 'left'; }
  });
  const [textFontFamily, setTextFontFamily] = useState<WhiteboardFontFamily>(() => {
    try { return (localStorage.getItem('wb:textFontFamily') as WhiteboardFontFamily) ?? 'simple'; } catch { return 'simple'; }
  });
  const [textBold, setTextBold] = useState<boolean>(() => {
    try { return localStorage.getItem('wb:textBold') === '1'; } catch { return false; }
  });
  const [textStrike, setTextStrike] = useState<boolean>(() => {
    try { return localStorage.getItem('wb:textStrike') === '1'; } catch { return false; }
  });
  const [textBullet, setTextBullet] = useState<boolean>(() => {
    try { return localStorage.getItem('wb:textBullet') === '1'; } catch { return false; }
  });
  const [shapeColor, setShapeColor] = useState<string>(() => storedInk('wb:shapeColor', SHAPE_COLOR));
  const [shapeFontSize, setShapeFontSize] = useState<number>(() => {
    try { const v = Number(localStorage.getItem('wb:shapeFontSize')); return clampFont(v, 12); } catch { return 12; }
  });
  const [shapeAlign, setShapeAlign] = useState<WhiteboardAlign>(() => {
    try { return (localStorage.getItem('wb:shapeAlign') as WhiteboardAlign) ?? 'center'; } catch { return 'center'; }
  });
  const [shapeType, setShapeType] = useState<WhiteboardShapeType>(() => {
    try { const v = localStorage.getItem('wb:shapeType'); return (v && ALLOWED_SHAPE_TYPES.has(v) ? v : 'rect') as WhiteboardShapeType; } catch { return 'rect'; }
  });
  const [shapeFill, setShapeFill] = useState<boolean>(() => {
    try { return localStorage.getItem('wb:shapeFill') === '1'; } catch { return false; }
  });
  const [edgeColor, setEdgeColor] = useState<string>(() => storedInk('wb:edgeColor', TEXT_COLOR));
  const [edgeFontSize, setEdgeFontSize] = useState<number>(() => {
    try { const v = Number(localStorage.getItem('wb:edgeFontSize')); return clampFont(v, 11); } catch { return 11; }
  });
  const [edgeArrowStyle] = useState<WhiteboardArrowStyle>(() => {
    try { const v = localStorage.getItem('wb:edgeArrowStyle'); return (v && ALLOWED_ARROW.has(v) ? v : 'solid') as WhiteboardArrowStyle; } catch { return 'solid'; }
  });
  const [boundaryColor, setBoundaryColor] = useState<string>(() => storedInk('wb:boundaryColor', BOUNDARY_COLOR));
  const [boundaryFontSize] = useState<number>(() => {
    try { const v = Number(localStorage.getItem('wb:boundaryFontSize')); return clampFont(v, 14); } catch { return 14; }
  });
  const [boundaryAlign] = useState<WhiteboardAlign>(() => {
    try { return (localStorage.getItem('wb:boundaryAlign') as WhiteboardAlign) ?? 'left'; } catch { return 'left'; }
  });
  const [panToId, setPanToId] = useState<string | null>(null);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);

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
  useEffect(() => { try { localStorage.setItem('wb:stickyFontSize', String(stickyFontSize)); } catch {} }, [stickyFontSize]);
  useEffect(() => { try { localStorage.setItem('wb:stickyAlign', stickyAlign); } catch {} }, [stickyAlign]);
  useEffect(() => { try { localStorage.setItem('wb:textColor', textColor); } catch {} }, [textColor]);
  useEffect(() => { try { localStorage.setItem('wb:textFontSize', String(textFontSize)); } catch {} }, [textFontSize]);
  useEffect(() => { try { localStorage.setItem('wb:textAlign', textAlign); } catch {} }, [textAlign]);
  useEffect(() => { try { localStorage.setItem('wb:textFontFamily', textFontFamily); } catch {} }, [textFontFamily]);
  useEffect(() => { try { localStorage.setItem('wb:textBold', textBold ? '1' : '0'); } catch {} }, [textBold]);
  useEffect(() => { try { localStorage.setItem('wb:textStrike', textStrike ? '1' : '0'); } catch {} }, [textStrike]);
  useEffect(() => { try { localStorage.setItem('wb:textBullet', textBullet ? '1' : '0'); } catch {} }, [textBullet]);
  // Open strip popup (size/width/font/align/color only one at a time).
  type StripPop = null | 'penWidth' | 'eraserWidth' | 'stickySize' | 'stickyAlign' | 'textFont' | 'textSize' | 'textAlign' | 'textColor' | 'shapeSize' | 'shapeAlign' | 'edgeSize' | 'boundarySize';
  const [stripPop, setStripPop] = useState<StripPop>(null);
  useEffect(() => { setStripPop(null); }, [tool]);
  useEffect(() => { try { localStorage.setItem('wb:shapeColor', shapeColor); } catch {} }, [shapeColor]);
  useEffect(() => { try { localStorage.setItem('wb:shapeFontSize', String(shapeFontSize)); } catch {} }, [shapeFontSize]);
  useEffect(() => { try { localStorage.setItem('wb:shapeAlign', shapeAlign); } catch {} }, [shapeAlign]);
  useEffect(() => { try { localStorage.setItem('wb:shapeType', shapeType); } catch {} }, [shapeType]);
  useEffect(() => { try { localStorage.setItem('wb:shapeFill', shapeFill ? '1' : '0'); } catch {} }, [shapeFill]);
  useEffect(() => { try { localStorage.setItem('wb:edgeColor', edgeColor); } catch {} }, [edgeColor]);
  useEffect(() => { try { localStorage.setItem('wb:edgeFontSize', String(edgeFontSize)); } catch {} }, [edgeFontSize]);
  useEffect(() => { try { localStorage.setItem('wb:edgeArrowStyle', edgeArrowStyle); } catch {} }, [edgeArrowStyle]);
  useEffect(() => { try { localStorage.setItem('wb:boundaryColor', boundaryColor); } catch {} }, [boundaryColor]);
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

  /** Single-element patch used by the floating bars (replaces the old inspector). */
  const applySelectionPatch = (patch: Record<string, unknown>) => {
    if (readOnly) return;
    if (!selectedElement) return;
    const next = board.elements.map((el) => (el.id === selectedElement.id ? ({ ...el, ...patch } as typeof el) : el));
    history.record();
    dispatch({ type: 'whiteboard/update', id: board.id, patch: { elements: next } });
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
    if (!exportOpen && !shapeMenuOpen && !moreOpen && !layersOpen && !libraryOpen && !trMoreOpen) return;
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (!exportMenuRef.current?.contains(target)) setExportOpen(false);
      if (!shapeMenuRef.current?.contains(target) && !shapeBtnRef.current?.contains(target)) {
        setShapeMenuOpen(false);
      }
      if (!moreMenuRef.current?.contains(target) && !moreBtnRef.current?.contains(target)) {
        setMoreOpen(false);
      }
      if (!layersWrapRef.current?.contains(target) && !layersBtnRef.current?.contains(target)) {
        setLayersOpen(false);
      }
      if (!libraryWrapRef.current?.contains(target)) {
        setLibraryOpen(false);
      }
      if (!trMoreRef.current?.contains(target) && !trMoreBtnRef.current?.contains(target)) {
        setTrMoreOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setExportOpen(false);
        setShapeMenuOpen(false);
        setMoreOpen(false);
        setLayersOpen(false);
        setLibraryOpen(false);
        setTrMoreOpen(false);
      }
    };
    window.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [exportOpen, shapeMenuOpen, moreOpen, layersOpen, libraryOpen, trMoreOpen]);

  // Menu transient milik status tanpa-seleksi — jangan basi saat seleksi berubah.
  useEffect(() => {
    setMoreOpen(false);
    setTrMoreOpen(false);
  }, [selectedIds]);

  // Tooltip pill kini via komponen Tooltip reusable (floating-ui) per tombol.
  // (Delegasi [data-tooltip] + wb-tip-fixed lama dihapus.)

  const toggleShapeMenu = () => {
    if (shapeMenuOpen) {
      setShapeMenuOpen(false);
    } else {
      setExportOpen(false);
      setMoreOpen(false);
      setLibraryOpen(false);
      setShapeMenuOpen(true);
    }
  };

  const pickShapeType = (st: WhiteboardShapeType) => {
    setShapeType(st);
    if (selectedElement?.kind === 'shape') {
      applySelectionPatch({ shapeType: st });
    } else {
      setTool('shape');
    }
    setShapeMenuOpen(false);
  };

  /** Library pick: geometry only (items place blank shapes), then draw (or patch). */
  const pickLibraryItem = (item: LibraryItem) => {
    pushShapeRecent(item.id);
    setShapeType(item.shapeType);
    if (selectedElement?.kind === 'shape') {
      applySelectionPatch({ shapeType: item.shapeType });
    } else {
      setTool('shape');
    }
    setLibraryOpen(false);
  };

  // State + renderer tombol tool bersama (pill desktop, pill mobile, menu •••).
  const toolBtnState = (item: (typeof TOOLS)[number]) => {
    const active = ACTIVE_TOOLS.has(item.id) && tool === item.id;
    const blocked = atCap && ADD_TOOLS.has(item.id);
    const readOnlyBlocked = readOnly && item.id !== 'view' && item.id !== 'select' && item.id !== 'marquee';
    const name = t(item.nameKey);
    const disabled = !ACTIVE_TOOLS.has(item.id) || blocked || readOnlyBlocked;
    const tip = readOnlyBlocked ? t('whiteboard.viewer.readOnlyTip') : blocked ? t('whiteboard.tool.limitReached', { name }) : `${name} — ${item.shortcut.toUpperCase()}`;
    return { active, disabled, tip, name };
  };

  const renderToolButton = (item: (typeof TOOLS)[number]) => {
    const { active, disabled, tip, name } = toolBtnState(item);
    const isShape = item.id === 'shape';
    return (
      <Tooltip key={item.id} content={tip} side="bottom" disabled={isShape ? shapeMenuOpen : false}>
        <button
          ref={isShape ? shapeBtnRef : undefined}
          type="button"
          className={`sub-tab${active ? ' sub-tab-active' : ''}`}
          disabled={disabled}
          aria-label={`${name} — ${item.shortcut.toUpperCase()}`}
          aria-pressed={active}
          aria-haspopup={isShape ? 'menu' : undefined}
          aria-expanded={isShape ? shapeMenuOpen : undefined}
          onClick={() => {
            if (disabled) return;
            setMoreOpen(false);
            if (isShape) toggleShapeMenu();
            else if (ACTIVE_TOOLS.has(item.id)) setTool(item.id as WbTool);
          }}
        >
          <item.icon size={15} aria-hidden="true" />
        </button>
      </Tooltip>
    );
  };

  const renderLayersButton = () => (
    <Tooltip content={t('whiteboard.layers.title')} side="bottom" disabled={layersOpen}>
      <button
        ref={layersBtnRef}
        type="button"
        className={`sub-tab${layersOpen ? ' sub-tab-active' : ''}`}
        aria-label={t('whiteboard.layers.title')}
        aria-expanded={layersOpen}
        aria-haspopup="dialog"
        onClick={() => {
          setLayersOpen((v) => !v);
          setExportOpen(false);
          setShapeMenuOpen(false);
          setMoreOpen(false);
          setLibraryOpen(false);
        }}
      >
        <Stack size={15} aria-hidden="true" />
      </button>
    </Tooltip>
  );

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
    <Tooltip content={elementCount === 0 ? t('whiteboard.export.emptyTitle') : t('whiteboard.export.title')} side="bottom" disabled={exportOpen}>
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

  // Menu export dipakai ulang di topbar dan panel ••• mobile.
  const exportMenu = exportOpen ? (
    <div ref={exportMenuRef} className="wb-export-menu" role="menu" aria-label={t('whiteboard.export.menuLabel')}>
      <button
        type="button"
        role="menuitem"
        className="wb-export-item"
        onClick={() => {
          setExportOpen(false);
          downloadWhiteboardPng(board, refDataMap, exportOpts);
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
          downloadWhiteboardPdf(board, refDataMap, exportOpts);
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
              downloadWhiteboardPng(sel, selectionRefData, exportOpts);
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
              downloadWhiteboardPdf(sel, selectionRefData, exportOpts);
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

  // FigJam defaults strip (Image 4): tool defaults live above the pill, icon-only.
  const stripDots = (
    value: string | null | undefined,
    onPick: (c: string) => void,
    aria: string,
    colors: ReadonlyArray<string> = BASIC_SWATCHES,
  ) => (
    <span className="wb-stripdots" role="group" aria-label={aria}>
      {colors.map((c) => (
        <Tooltip key={c} content={`${aria} ${c}`} side="top">
          <button
            type="button"
            className={`wb-dot${(value ?? '').toLowerCase() === c.toLowerCase() ? ' wb-dot-active' : ''}`}
            style={{ backgroundColor: c }}
            aria-label={`${aria} ${c}`}
            aria-pressed={(value ?? '').toLowerCase() === c.toLowerCase()}
            onClick={() => onPick(c)}
          />
        </Tooltip>
      ))}
      <Tooltip content={t('whiteboard.colorPanel.custom')} side="top">
        <label className="wb-rainbow">
          <span aria-hidden="true" className="wb-rainbow-ui" />
          <span className="sr-only">{t('whiteboard.colorPanel.custom')}</span>
          <input
            type="color"
            className="wb-rainbow-input"
            value={/^#[0-9a-f]{6}$/i.test(value ?? '') ? (value as string) : '#2563eb'}
            onChange={(e) => onPick(e.target.value)}
            aria-label={t('whiteboard.colorPanel.custom')}
          />
        </label>
      </Tooltip>
    </span>
  );
  const toggleStrip = (key: Exclude<StripPop, null>) => setStripPop(stripPop === key ? null : key);
  const stripWidth = (
    key: 'penWidth' | 'eraserWidth',
    value: number,
    onPick: (v: number) => void,
    min: number,
    max: number,
    label: string,
  ) => (
    <DropdownShell
      open={stripPop === key}
      onToggle={() => toggleStrip(key)}
      onClose={() => setStripPop(null)}
      label={label}
      popLabel={label}
      button={
        <>
          <span className="wb-stripnum tabular" aria-hidden="true">{value}</span>
          <DropCaret />
        </>
      }
    >
      <WidthSlider value={value} min={min} max={max} label={label} onChange={onPick} />
    </DropdownShell>
  );
  const stripSize = (
    key: 'stickySize' | 'textSize' | 'shapeSize' | 'edgeSize' | 'boundarySize',
    value: number,
    onPick: (v: number) => void,
  ) => (
    <SizeDropdown
      value={value}
      open={stripPop === key}
      onToggle={() => toggleStrip(key)}
      onClose={() => setStripPop(null)}
      onPick={onPick}
    />
  );
  const defaultsStrip = !DRAW_DEFAULT_TOOLS.has(tool) || selectedElement !== null || shapeMenuOpen || libraryOpen ? null : (
    <div className="wb-shape-strip" role="toolbar" aria-label={t('whiteboard.toolbar.tools')}>
      {tool === 'pen' && (
        <>
          {stripDots(penColor, setPenColor, t('whiteboard.textbar.fill'))}
          {stripWidth('penWidth', penWidth, (v) => setPenWidth(Math.max(1, Math.min(20, v))), 1, 20, t('whiteboard.popover.lineWidth'))}
        </>
      )}
      {tool === 'eraser' && (
        <>{stripWidth('eraserWidth', eraserWidth, (v) => setEraserWidth(Math.max(4, Math.min(20, v))), 4, 20, t('whiteboard.popover.lineWidth'))}</>
      )}
      {tool === 'sticky' && (
        <>
          {stripDots(stickyColor, setStickyColor, t('whiteboard.textbar.fill'))}
          {stripSize('stickySize', stickyFontSize, (v) => setStickyFontSize(clampFont(v, 12)))}
          <AlignDropdown
            value={stickyAlign}
            open={stripPop === 'stickyAlign'}
            onToggle={() => toggleStrip('stickyAlign')}
            onClose={() => setStripPop(null)}
            onChange={setStickyAlign}
          />
        </>
      )}
      {tool === 'text' && (
        <>
          {stripDots(textColor, setTextColor, t('whiteboard.textbar.textColor'))}
          <FontDropdown
            value={textFontFamily}
            open={stripPop === 'textFont'}
            onToggle={() => toggleStrip('textFont')}
            onClose={() => setStripPop(null)}
            onPick={setTextFontFamily}
          />
          {stripSize('textSize', textFontSize, (v) => setTextFontSize(clampFont(v, 16)))}
          <TextStyleToggles
            bold={textBold}
            strikethrough={textStrike}
            bullet={textBullet}
            onBold={() => setTextBold((v) => !v)}
            onStrikethrough={() => setTextStrike((v) => !v)}
            onBullet={() => setTextBullet((v) => !v)}
          />
          <AlignDropdown
            value={textAlign}
            open={stripPop === 'textAlign'}
            onToggle={() => toggleStrip('textAlign')}
            onClose={() => setStripPop(null)}
            onChange={setTextAlign}
          />
          <ColorDropdown
            value={textColor}
            title={t('whiteboard.textbar.textColor')}
            open={stripPop === 'textColor'}
            onToggle={() => toggleStrip('textColor')}
            onClose={() => setStripPop(null)}
            onPick={setTextColor}
            label={t('whiteboard.textbar.textColor')}
            glyph="letter"
          />
        </>
      )}
      {tool === 'shape' && (
        <>
          {stripDots(shapeColor, setShapeColor, t('whiteboard.textbar.fill'))}
          {stripSize('shapeSize', shapeFontSize, (v) => setShapeFontSize(clampFont(v, 12)))}
          <AlignDropdown
            value={shapeAlign}
            open={stripPop === 'shapeAlign'}
            onToggle={() => toggleStrip('shapeAlign')}
            onClose={() => setStripPop(null)}
            onChange={setShapeAlign}
          />
          <Tooltip content={t('whiteboard.popover.filled')} side="top">
            <button
              type="button"
              className={`wb-stripbtn${shapeFill ? ' wb-stripbtn-active' : ''}`}
              aria-label={t('whiteboard.popover.filled')}
              aria-pressed={shapeFill}
              onClick={() => setShapeFill((v) => !v)}
            >
              <Stack size={15} aria-hidden="true" />
            </button>
          </Tooltip>
        </>
      )}
      {tool === 'edge' && (
        <>
          {stripDots(edgeColor, setEdgeColor, t('whiteboard.textbar.fill'))}
          {stripSize('edgeSize', edgeFontSize, (v) => setEdgeFontSize(clampFont(v, 11)))}
        </>
      )}
      {tool === 'boundary' && (
        <>{stripDots(boundaryColor, setBoundaryColor, t('whiteboard.textbar.fill'))}</>
      )}
    </div>
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
    setTrMoreOpen(false);
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
      if (key === '?' && !mod) {
        e.preventDefault();
        setShortcutsOpen(true);
        return;
      }
      // WB-17: tiered Esc — dialog, panels, then present, then fullscreen.
      // (Export menu owns its Esc; canvas clears selection itself.)
      if (key === 'Escape') {
        if (shortcutsOpen) {
          e.preventDefault();
          setShortcutsOpen(false);
          return;
        }
        if (shapeMenuOpen || libraryOpen || layersOpen || trMoreOpen) {
          e.preventDefault();
          setShapeMenuOpen(false);
          setLibraryOpen(false);
          setLayersOpen(false);
          setTrMoreOpen(false);
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
      if (key.toLowerCase() === SHORTCUTS.view && ACTIVE_TOOLS.has('view')) {
        setTool('view');
      } else if (key.toLowerCase() === SHORTCUTS.select && ACTIVE_TOOLS.has('select')) {
        setTool('select');
      } else if (key.toLowerCase() === SHORTCUTS.marquee && ACTIVE_TOOLS.has('marquee')) {
        setTool('marquee');
      } else if (!atCap && !readOnly && key.toLowerCase() === SHORTCUTS.pen && ACTIVE_TOOLS.has('pen')) {
        setTool('pen');
      } else if (!readOnly && key.toLowerCase() === SHORTCUTS.eraser && ACTIVE_TOOLS.has('eraser')) {
        setTool('eraser');
      } else if (!atCap && !readOnly && key.toLowerCase() === SHORTCUTS.text && ACTIVE_TOOLS.has('text')) {
        setTool('text');
      } else if (!atCap && !readOnly && key.toLowerCase() === SHORTCUTS.sticky && ACTIVE_TOOLS.has('sticky')) {
        setTool('sticky');
      } else if (!atCap && !readOnly && key.toLowerCase() === SHORTCUTS.shape && ACTIVE_TOOLS.has('shape')) {
        setTool('shape');
      } else if (!atCap && !readOnly && key.toLowerCase() === SHORTCUTS.edge && ACTIVE_TOOLS.has('edge')) {
        setTool('edge');
      } else if (!atCap && !readOnly && key.toLowerCase() === SHORTCUTS.ref && ACTIVE_TOOLS.has('ref')) {
        setTool('ref');
      } else if (!atCap && !readOnly && key.toLowerCase() === SHORTCUTS.boundary && ACTIVE_TOOLS.has('boundary')) {
        setTool('boundary');
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [atCap, readOnly, presenting, isFullscreen, shapeMenuOpen, libraryOpen, layersOpen, trMoreOpen, shortcutsOpen]);

  return (
    <div className={`wb-shell${isFullscreen ? ' wb-fullscreen' : ''}${presenting ? ' wb-presenting' : ''}`} ref={shellRef}>
      {!isFullscreen && !presenting && (
        <div className="wb-topbar">
          <Button variant="ghost" size="sm" className="back-btn" onClick={onBack} aria-label={t('whiteboard.toolbar.back')}>
            <ArrowLeft size={14} aria-hidden="true" />
          </Button>
          <span className="wb-board-head">
            <span className="wb-board-name">{board.name}</span>
            {board.description.trim() !== '' && (
              <span className="wb-board-desc">{board.description}</span>
            )}
          </span>
          <span className="wb-topbar-spacer" aria-hidden="true" />
          <Tooltip content={t('whiteboard.toolbar.fsEnterTitle')} side="bottom">
            <Button variant="ghost" size="sm" className="wb-canvas-mode-btn" leftIcon={<ArrowsOutSimple size={14} aria-hidden="true" />} onClick={toggleFullscreen} aria-label={t('whiteboard.toolbar.fsEnterAria')}>
              {!isMobile && t('whiteboard.toolbar.canvasMode')}
            </Button>
          </Tooltip>
        </div>
      )}
      <div className="wb-main">
        <div className="wb-main-canvas">
          {!isMobile && !presenting && (
            <div className="wb-corner-tl" role="toolbar" aria-label={t('whiteboard.toolbar.historyPanel')}>
              {renderUndoButton()}
              {renderRedoButton()}
              {renderLayersButton()}
              {layersOpen && (
                <div ref={layersWrapRef} className="wb-layers-pop" role="dialog" aria-label={t('whiteboard.layers.panelLabel')}>
                  <WhiteboardLayers
                    elements={board.elements}
                    selectedIds={selectedIds}
                    onSelect={handleLayersSelect}
                    onToggleLock={handleLayersToggleLock}
                    collapsed={false}
                    onToggleCollapse={() => setLayersOpen(false)}
                  />
                </div>
              )}
            </div>
          )}
          {!isMobile && (!presenting ? (
            <div className="wb-corner-tr" role="toolbar" aria-label={t('whiteboard.toolbar.boardPanel')}>
              <Tooltip content={board.name} side="bottom">
                <span className="wb-corner-name">{board.name}</span>
              </Tooltip>
              {renderPresentButton()}
              <span className="wb-export-anchor">
                {renderExportButton()}
                {exportMenu}
              </span>
              {isFullscreen && (
                <Tooltip content={t('whiteboard.toolbar.fsExitTitle')} side="bottom">
                  <button
                    ref={exitBtnRef}
                    type="button"
                    className="sub-tab"
                    aria-label={t('whiteboard.toolbar.fsExitAria')}
                    onClick={exitToNormal}
                  >
                    <X size={15} aria-hidden="true" />
                  </button>
                </Tooltip>
              )}
            </div>
          ) : (
            <div className="wb-corner-tr" role="toolbar" aria-label={t('whiteboard.toolbar.boardPanel')}>
              <Tooltip content={board.name} side="bottom">
                <span className="wb-corner-name">{board.name}</span>
              </Tooltip>
              <Tooltip content={t('whiteboard.toolbar.presentExitTitle')} side="bottom">
                <button
                  ref={exitBtnRef}
                  type="button"
                  className="sub-tab"
                  aria-label={t('whiteboard.toolbar.presentExitAria')}
                  onClick={exitToNormal}
                >
                  <X size={15} aria-hidden="true" />
                </button>
              </Tooltip>
            </div>
          ))}
          <WhiteboardCanvas
            board={board}
            tool={readOnly && tool !== 'view' && tool !== 'select' && tool !== 'marquee' ? 'select' : tool}
            history={history}
            readOnly={readOnly || presenting}
            hideChrome={presenting}
            selectedIds={selectedIds}
            onSelectedChange={setSelectedIds}
            snapOn={snapOn}
            penColor={penColor}
            penWidth={penWidth}
            eraserWidth={eraserWidth}
            stickyColor={stickyColor}
            stickyTextColor="#1a1a1a"
            stickyFontSize={stickyFontSize}
            stickyAlign={stickyAlign}
            textColor={textColor}
            textFontSize={textFontSize}
            textAlign={textAlign}
            textFontFamily={textFontFamily}
            textBold={textBold}
            textStrike={textStrike}
            textBullet={textBullet}
            shapeColor={shapeColor}
            shapeFontSize={shapeFontSize}
            shapeAlign={shapeAlign}
            shapeType={shapeType}
            shapeLabel=""
            shapeFill={shapeFill}
            edgeColor={edgeColor}
            edgeFontSize={edgeFontSize}
            edgeAlign="center"
            edgeLabel=""
            edgeArrowStyle={edgeArrowStyle}
            edgeDash="solid"
            boundaryColor={boundaryColor}
            boundaryLabelColor="#374151"
            boundaryFontSize={boundaryFontSize}
            boundaryAlign={boundaryAlign}
            boundaryLabel=""
            onToolChange={setTool}
            registerDelete={(fn) => { deleteSelRef.current = fn; }}
            isMobile={isMobile}
            onOpenShortcuts={() => setShortcutsOpen(true)}
            onNotice={flashCapToast}
            panToId={panToId}
          />
      {!presenting && (
      <div
        className="board-toolbar"
        ref={toolbarRef}
      >
        {isMobile ? (
          <>
            {selectedIds.length === 0 && (
            <div className="sub-tabs wb-tool-scroll wb-mobile-pill" role="toolbar" aria-label={t('whiteboard.toolbar.tools')}>
              {TOOLS.filter((item) => MOBILE_TOOL_IDS.has(item.id)).map((item) => renderToolButton(item))}
              <span className="wb-sep" aria-hidden="true" />
              <Tooltip content={t('whiteboard.toolbar.moreTools')} side="bottom" disabled={moreOpen}>
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
            )}
            {moreOpen && selectedIds.length === 0 && (
              <div ref={moreMenuRef} className="wb-more-menu" role="menu" aria-label={t('whiteboard.toolbar.moreTools')}>
                <div className="wb-more-grid" role="group" aria-label={t('whiteboard.toolbar.tools')}>
                  {TOOLS.filter((item) => MORE_TOOL_IDS.has(item.id)).map((item) => renderToolButton(item))}
                  {renderSnapButton()}
                </div>
              </div>
            )}
          </>
        ) : (
          <>
            <div className="sub-tabs wb-tool-scroll" role="toolbar" aria-label={t('whiteboard.toolbar.tools')}>
              {(
                [
                  [NAV_TOOL_IDS, 'Navigate'],
                  [OBJECT_TOOL_IDS, 'Objects'],
                  [INSERT_TOOL_IDS, 'Inserts'],
                ] as const
              ).map(([ids, groupLabel]) => (
                <span key={groupLabel} className="wb-tool-group" role="group" aria-label={groupLabel}>
                  {ids.map((id) => {
                    const item = TOOLS.find((x) => x.id === id)!;
                    return renderToolButton(item);
                  })}
                </span>
              ))}
            </div>
            <div className="wb-tool-actions">
              <span className="wb-sep" aria-hidden="true" />
              {renderSnapButton()}
            </div>
          </>
        )}
        {shapeMenuOpen && (
          <div
            ref={shapeMenuRef}
            className="wb-shape-strip"
            role="menu"
            aria-label={t('whiteboard.tool.shapeMenu')}
          >
            {PRIMER_SHAPE_TYPES.map((st) => (
              <Tooltip key={st} content={st} side="top">
                <button
                  type="button"
                  role="menuitemradio"
                  aria-checked={shapeType === st}
                  aria-label={st}
                  className="wb-shape-cell"
                  onClick={() => pickShapeType(st)}
                >
                  <ShapeThumb shapeType={st} />
                </button>
              </Tooltip>
            ))}
            <button
              type="button"
              className="wb-shape-more"
              onClick={() => {
                setShapeMenuOpen(false);
                setLibraryOpen(true);
              }}
            >
              {t('whiteboard.shapeLib.title')}
            </button>
          </div>
        )}
        {libraryOpen && (
          <div ref={libraryWrapRef} className="wb-library-anchor">
            <ShapeLibraryPanel onPick={pickLibraryItem} onClose={() => setLibraryOpen(false)} />
          </div>
        )}
        {defaultsStrip}
      </div>
      )}
      {shortcutsOpen && <WhiteboardShortcutsDialog onClose={() => setShortcutsOpen(false)} />}
      {isMobile && !presenting && selectedIds.length === 0 && (
        <div className="wb-mobile-tl" role="toolbar" aria-label={t('whiteboard.toolbar.historyPanel')}>
          {renderUndoButton()}
          {renderRedoButton()}
        </div>
      )}
      {isMobile && !presenting && selectedIds.length > 0 && (
        <div className="wb-mobile-tr" role="toolbar" aria-label={t('whiteboard.toolbar.boardPanel')}>
          <Tooltip content={t('whiteboard.canvas.deleteSelected')} side="bottom">
            <button
              type="button"
              className="sub-tab wb-mobile-delete"
              aria-label={t('whiteboard.canvas.deleteSelected')}
              disabled={readOnly}
              onClick={() => deleteSelRef.current()}
            >
              <Trash size={15} aria-hidden="true" />
            </button>
          </Tooltip>
          {isFullscreen && (
            <Tooltip content={t('whiteboard.toolbar.fsExitTitle')} side="bottom">
              <button
                ref={exitBtnRef}
                type="button"
                className="sub-tab"
                aria-label={t('whiteboard.toolbar.fsExitAria')}
                onClick={exitToNormal}
              >
                <X size={15} aria-hidden="true" />
              </button>
            </Tooltip>
          )}
        </div>
      )}
      {isMobile && !presenting && selectedIds.length === 0 && (
        <div className="wb-mobile-tr" role="toolbar" aria-label={t('whiteboard.toolbar.boardPanel')}>
          <Tooltip content={t('whiteboard.toolbar.moreTools')} side="bottom" disabled={trMoreOpen}>
            <button
              ref={trMoreBtnRef}
              type="button"
              className={`sub-tab${trMoreOpen ? ' sub-tab-active' : ''}`}
              aria-haspopup="menu"
              aria-expanded={trMoreOpen}
              aria-label={t('whiteboard.toolbar.moreTools')}
              onClick={() => setTrMoreOpen((v) => !v)}
            >
              <DotsThreeVertical size={15} weight="bold" aria-hidden="true" />
            </button>
          </Tooltip>
          {trMoreOpen && (
            <div ref={trMoreRef} className="wb-mobile-trmenu" role="group" aria-label={t('whiteboard.toolbar.moreTools')}>
              {renderPresentButton()}
              <span className="wb-export-anchor">
                {renderExportButton()}
                {exportMenu}
              </span>
            </div>
          )}
          {isFullscreen && (
            <Tooltip content={t('whiteboard.toolbar.fsExitTitle')} side="bottom">
              <button
                ref={exitBtnRef}
                type="button"
                className="sub-tab"
                aria-label={t('whiteboard.toolbar.fsExitAria')}
                onClick={exitToNormal}
              >
                <X size={15} aria-hidden="true" />
              </button>
            </Tooltip>
          )}
        </div>
      )}
      {isMobile && presenting && (
        <div className="wb-mobile-tr" role="toolbar" aria-label={t('whiteboard.toolbar.boardPanel')}>
          <Tooltip content={t('whiteboard.toolbar.presentExitTitle')} side="bottom">
            <button
              ref={exitBtnRef}
              type="button"
              className="sub-tab"
              aria-label={t('whiteboard.toolbar.presentExitAria')}
              onClick={handleExitPresenting}
            >
              <X size={15} aria-hidden="true" />
            </button>
          </Tooltip>
        </div>
      )}
        </div>
      </div>
      {!presenting && (nearCap || readOnly) && (
        <div className="wb-status-row">
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
      <ToastStack>
        {capToast && (
          <div className="save-toast" role="status" data-testid="wb-cap-toast">
            <div className="save-toast-body">
              <span>{capToast}</span>
            </div>
            <button
              type="button"
              className="btn btn-ghost btn-sm btn-icon save-toast-close"
              aria-label={t('whiteboard.canvas.dismissCap')}
              onClick={() => setCapToast(null)}
            >
              <X size={12} weight="bold" aria-hidden="true" />
            </button>
          </div>
        )}
      </ToastStack>
    </div>
  );
}



