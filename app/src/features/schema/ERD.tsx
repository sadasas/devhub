import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { RefObject } from 'react';
import { CornersOut, Graph, MagnifyingGlassMinus, MagnifyingGlassPlus } from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';
import type { Column, Relation, Table } from '../../lib/types';
import type { State } from '../../lib/types';
import { relationLabel, shortId } from '../../lib/utils';
import { isUniqueIndex } from './column-helpers';
import { headerFill, headerTitleColor, normalizeHeaderColor } from './erd-header-color';
import { dropTargetGroup, resolveGroupBox, resizeBox } from './erd-groups';
import type { ErdGroupBox, GroupCorner } from './erd-groups';
import { Button } from '../../components/Button';
import { TooltipCard } from '../../components/Tooltip';

const TABLE_W = 208;
const HEADER_H = 30;
const ROW_H = 20;
const GAP = 48;
const COLS = 4;
const MIN_ZOOM = 0.3;
const MAX_ZOOM = 3;
/** F2-5: screen-px tolerance for node hit-test (hit first, then pan). */
const HIT_TOLERANCE_PX = 8;
/** F2-5: screen-px threshold — below = click/selection, at/above = node drag. */
const DRAG_THRESHOLD_PX = 4;
/** F2-5: touch long-press delay reused from useTouchDrag (180ms) + move threshold. */
const TOUCH_LONG_PRESS_MS = 180;
const TOUCH_MOVE_THRESHOLD_PX = 10;
/** F2-5: keyboard nudge step (Shift = large). */
const KB_STEP = 8;
const KB_STEP_LARGE = 32;

export interface ErLayout {
  table: Table;
  x: number;
  y: number;
  h: number;
}

export type ErdPosition = { x: number; y: number };

export interface ERDView {
  x: number;
  y: number;
  s: number;
}

/** U2: imperative read of the live viewport — keeps view uncontrolled (no parent re-render per pan/zoom). */
export interface ERDViewportHandle {
  /** Visible viewport center in world coords: ((w/2−x)/s, (h/2−y)/s), rounded to 1 decimal. */
  getViewportCenterWorld: () => ErdPosition;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/**
 * U2: pure viewport-center math (tested directly).
 * `w`/`h` are the visible canvas size in screen px.
 */
export function viewportCenterWorld(view: ERDView, w: number, h: number): ErdPosition {
  const s = view.s > 0 ? view.s : 1;
  return { x: round1((w / 2 - view.x) / s), y: round1((h / 2 - view.y) / s) };
}

/**
 * F2-5: grid is the fallback. When `overrides[tableId]` holds finite numbers
 * the node uses the stored position, otherwise the default grid cell.
 * Orphan entries (no matching table) are ignored by construction.
 */
export function layoutTables(tables: Table[], overrides?: Record<string, ErdPosition>): ErLayout[] {
  const rows: Table[][] = [];
  tables.forEach((t, i) => {
    const r = Math.floor(i / COLS);
    if (rows[r]) rows[r]!.push(t);
    else rows[r] = [t];
  });
  const rowHeights = rows.map((r) =>
    Math.max(...r.map((t) => HEADER_H + t.columns.length * ROW_H + 14)),
  );
  const out: ErLayout[] = [];
  let y = 16;
  rows.forEach((r, ri) => {
    r.forEach((t, ci) => {
      const gridX = 16 + ci * (TABLE_W + GAP);
      const ov = overrides?.[t.id];
      const useOverride =
        ov !== undefined &&
        Number.isFinite(ov.x) &&
        Number.isFinite(ov.y);
      out.push({
        table: t,
        x: useOverride ? (ov as ErdPosition).x : gridX,
        y: useOverride ? (ov as ErdPosition).y : y,
        h: rowHeights[ri]!,
      });
    });
    y += rowHeights[ri]! + GAP;
  });
  return out;
}

function truncate(s: string, max: number): string {
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

/** U3: connect-drag drop target + prefill payload for NewRelationModal. */
export interface ErdConnectColumns {
  fromTableId: string;
  fromColumnId: string;
  toTableId: string;
  toColumnId: string;
}

export interface ERDLocateRequest {
  tableId: string;
  nonce: number;
}

interface ERDProps {
  state: State;
  onDeleteRelation: (relation: Relation) => void;
  onNewTable: () => void;
  readOnly?: boolean;
  /** F2-3: pan-to-table request from the Issues strip. Nonce bumps per Locate click. */
  locateRequest?: ERDLocateRequest | null;
  /** F2-5: commit a node move (dispatch erdLayout/set + persist lives in the caller). */
  onMoveTable?: (tableId: string, pos: ErdPosition) => void;
  /**
   * Drop spasial ke area: dipanggil saat node selesai digeser — groupId bila
   * titik drop di dalam bounds sebuah area, null bila di luar semua area
   * (caller melepas membership bila ada). Opsional; tanpa grup = tidak dipanggil.
   */
  onAssignTableGroup?: (tableId: string, groupId: string | null) => void;
  /** Commit geometri area (geser/resize dari kanvas). Opsional. */
  onMoveGroup?: (groupId: string, box: { x: number; y: number; w: number; h: number }) => void;
  /**
   * Bulk commit posisi member area (geser grup dari kanvas): satu array
   * untuk semua member agar caller persist sekali (hindari N PATCH se-tick
   * yang balapan last-write-wins di server). Opsional; tanpa ini fallback
   * ke loop onMoveTable per member.
   */
  onMoveTables?: (moves: { tableId: string; x: number; y: number }[]) => void;
  /** F2-5: open the table modal (SchemaPage setTableId). No-op in readOnly/snapshot. */
  onOpenTable?: (tableId: string) => void;
  /**
   * U3: connect-drag commit — pointerup over another column row (or tap-tap /
   * keyboard commit) reports both endpoints. The caller opens NewRelationModal
   * with from/to prefilled. Omitted = handles still render in edit mode but
   * commits are dropped (readOnly never renders handles).
   */
  onConnectColumns?: (args: ErdConnectColumns) => void;
  /**
   * U2: dblclick on empty background (world coords of the click point).
   * Only wired in canvas mode — the plain ERD tab omits it so existing
   * behaviour is untouched. Gated by readOnly inside.
   */
  onDoubleClickEmpty?: (pos: ErdPosition) => void;
  /**
   * U2: read-only handle for the canvas [+ Table] pill to place the new
   * table at the visible viewport center on demand. View stays uncontrolled.
   */
  viewportRef?: RefObject<ERDViewportHandle | null>;
  /**
   * U4: selection-driven props panel (canvas mode only). Clicking a node
   * (below the drag threshold) reports the table; empty-background click
   * reports null. Omitted = existing behaviour (plain ERD tab untouched).
   */
  onSelectTable?: (tableId: string | null) => void;
  /**
   * U4: lifts the relation selection to the parent so the canvas props
   * panel can show the relation variant. Ronde 4: tanpa popover — klik /
   * keyboard garis hanya lift + announce (Delete ada di panel).
   */
  onSelectRelation?: (relationId: string | null) => void;
  /**
   * U4: tiered Esc — true while the props panel shows a table/relation
   * selection. Esc on the canvas then closes the panel (focus back to the
   * canvas) via onClosePanelSelection instead of bubbling up to close the
   * canvas overlay.
   */
  panelSelectionOpen?: boolean;
  onClosePanelSelection?: () => void;
  /**
   * Ronde 5 ITEM 4: id tabel/relasi yang terseleksi untuk highlight kanvas.
   * SchemaPage mengoper selectedTableId/selectedRelationId yang sudah ada.
   * Null/undefined = tanpa highlight (tab ERD biasa tidak berubah).
   */
  selectedTableId?: string | null;
  selectedRelationId?: string | null;
  /**
   * Presentation mode: hide zoom controls + hover tooltips (CSS hides them
   * too; unmounting keeps them out of the tab order / a11y tree).
   */
  presenting?: boolean;
}

interface NodeDragState {
  tableId: string;
  pointerId: number;
  startClientX: number;
  startClientY: number;
  origX: number;
  origY: number;
  moved: boolean;
  /** Touch: waiting for the 180ms long-press before the drag arms. */
  touchPending: boolean;
  touchArmed: boolean;
  timerId: number | null;
}

/** U3: active connect-drag from a column handle (node locked, pan off for this pointer). */
interface ConnectDragState {
  fromTableId: string;
  fromColumnId: string;
  pointerId: number;
  startClientX: number;
  startClientY: number;
  moved: boolean;
  fromX: number;
  fromY: number;
}

export function ERD({
  state,
  onDeleteRelation: _onDeleteRelation,
  onNewTable,
  readOnly = false,
  locateRequest = null,
  onMoveTable,
  onMoveTables,
  onAssignTableGroup,
  onMoveGroup,
  onOpenTable,
  onConnectColumns,
  onDoubleClickEmpty,
  viewportRef,
  onSelectTable,
  onSelectRelation,
  panelSelectionOpen = false,
  onClosePanelSelection,
  selectedTableId = null,
  selectedRelationId = null,
  presenting = false,
}: ERDProps) {
  void _onDeleteRelation;
  const { t } = useTranslation('project');
  const canvasRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const dragStartRef = useRef<{ pointerX: number; pointerY: number; x: number; y: number } | null>(null);
  const nodeDragRef = useRef<NodeDragState | null>(null);
  const suppressRelClickRef = useRef(false);
  const relRefs = useRef(new Map<string, SVGGElement | null>());
  const nodeRefs = useRef(new Map<string, SVGGElement | null>());
  const [view, setView] = useState({ x: 16, y: 16, s: 1 });
  const viewRef = useRef(view);
  viewRef.current = view;
  const [dragging, setDragging] = useState(false);
  const [nodeDraggingId, setNodeDraggingId] = useState<string | null>(null);
  const [dragPreview, setDragPreview] = useState<{ tableId: string; x: number; y: number } | null>(null);
  // Geser grup: drag label area memindahkan semua anggota (delta dunia, commit per tabel).
  // Resize: drag handle sudut mengubah geometri rect (anggota tetap).
  const [groupDragPreview, setGroupDragPreview] = useState<{
    groupId: string;
    mode: 'move' | 'resize';
    box: { x: number; y: number; w: number; h: number };
    dx: number;
    dy: number;
  } | null>(null);
  const groupDragRef = useRef<{
    groupId: string;
    mode: 'move' | 'resize';
    corner?: GroupCorner;
    pointerId: number;
    startClientX: number;
    startClientY: number;
    moved: boolean;
    orig: { x: number; y: number; w: number; h: number };
  } | null>(null);
  // Seleksi grup (internal kanvas): menampilkan resize handle. Manajemen
  // keyboard tetap via checkbox panel.
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const canDragGroups = !readOnly && !!onMoveTable;
  const spaceHeldRef = useRef(false);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const highlightTimerRef = useRef<number | null>(null);
  const [announce, setAnnounce] = useState('');
  // U3: connect-drag (handle → column row) + tap-tap pending source.
  const connectDragRef = useRef<ConnectDragState | null>(null);
  const [connectPreview, setConnectPreview] = useState<{
    fromX: number;
    fromY: number;
    toX: number;
    toY: number;
  } | null>(null);
  const [pendingSource, setPendingSource] = useState<{ tableId: string; columnId: string } | null>(null);
  const pendingSourceRef = useRef(pendingSource);
  pendingSourceRef.current = pendingSource;
  // U3: down-position of a tap started while a source is armed (row body /
  // empty — handle taps go through connectDragRef instead).
  const pendingTapRef = useRef<{ pointerId: number; startClientX: number; startClientY: number } | null>(null);
  // Column tooltip (hover + focus-visible on row/handle): screen-px anchor.
  const [colTip, setColTip] = useState<{ tableId: string; columnId: string; sx: number; sy: number } | null>(null);
  // Ronde 3: relation tooltip — satu kartu putih yang sama, di kanan garis.
  const [relTip, setRelTip] = useState<{ relationId: string; sx: number; sy: number } | null>(null);
  // Ronde 3 follow-connect: throttle posisi kursor terakhir (screen px).
  const followLastRef = useRef<{ x: number; y: number } | null>(null);
  // Ronde 3 ITEM 5: pan lazy-capture hanya sekali per gesture.
  const panCapturedRef = useRef<number | null>(null);
  // Ronde 3: live state untuk tooltip relasi (dideklarasi awal agar closure aman).
  const stateRef = useRef(state);
  stateRef.current = state;
  const tRef = useRef(t);
  tRef.current = t;

  /**
   * U3: cancel an active connect-drag and/or an armed tap-tap source.
   * Silent unless `announceIt` (empty drop / Esc / pinch / self-drop).
   * Declared early — handleCanvasEscape (below) and the pinch effect use it.
   * Also hides the follow-connect temp line + the column tooltip.
   */
  const cancelConnect = useCallback((announceIt: boolean) => {
    const had = connectDragRef.current !== null || pendingSourceRef.current !== null;
    connectDragRef.current = null;
    pendingTapRef.current = null;
    setConnectPreview(null);
    followLastRef.current = null;
    panCapturedRef.current = null;
    if (pendingSourceRef.current) setPendingSource(null);
    setColTip(null);
    setRelTip(null);
    suppressRelClickRef.current = false;
    if (announceIt && had) setAnnounce(tRef.current('schema.erd.connectCancelled'));
  }, []);

  const clearTips = useCallback(() => {
    setColTip(null);
    setRelTip(null);
  }, []);

  /** Geser grup dibatalkan: buang preview tanpa commit. */
  const cancelGroupDrag = useCallback(() => {
    groupDragRef.current = null;
    setGroupDragPreview(null);
  }, []);

  const containerSize = useCallback(() => {
    const el = canvasRef.current;
    const rect = el?.getBoundingClientRect();
    return {
      w: rect && rect.width > 0 ? rect.width : 800,
      h: rect && rect.height > 0 ? rect.height : 480,
    };
  }, []);

  /** Ronde 3: tooltip selalu di KANAN elemen, flip ke kiri bila mentok, tetap clamp(). */
  const placeRightOrFlip = useCallback(
    (anchorRightSx: number, anchorLeftSx: number, anchorSy: number) => {
      const { w } = containerSize();
      const TIP_W = 280;
      const GAP_PX = 12;
      let sx = anchorRightSx + GAP_PX;
      if (sx + TIP_W + 8 > w) {
        sx = anchorLeftSx - TIP_W - GAP_PX;
      }
      return {
        sx: Math.round(sx * 10) / 10,
        sy: Math.round((anchorSy - 10) * 10) / 10,
      };
    },
    [containerSize],
  );

  /** Ronde 4 ITEM 7: tooltip relasi diagonal kanan-bawah kursor + flip bila mentok. */
  const placeNearCursor = useCallback(
    (cursorSx: number, cursorSy: number) => {
      const { w, h } = containerSize();
      const TIP_W = 280;
      const TIP_H = 100;
      const DX = 14;
      const DY = 16;
      let sx = cursorSx + DX;
      if (sx + TIP_W + 8 > w) {
        sx = cursorSx - TIP_W - DX;
      }
      let sy = cursorSy + DY;
      if (sy + TIP_H + 8 > h) {
        sy = cursorSy - TIP_H - DY;
      }
      return {
        sx: Math.round(Math.max(8, sx) * 10) / 10,
        sy: Math.round(Math.max(8, sy) * 10) / 10,
      };
    },
    [containerSize],
  );

  /** Screen px posisi kursor relatif ke kontainer canvas (untuk offset tooltip relasi). */
  const cursorToCanvas = useCallback(
    (clientX: number, clientY: number) => {
      const rect = canvasRef.current?.getBoundingClientRect();
      return { x: clientX - (rect?.left ?? 0), y: clientY - (rect?.top ?? 0) };
    },
    [],
  );

  /** Show the column tooltip: near the cursor on hover, table-edge anchored on keyboard focus. */
  const showColTip = useCallback(
    (tableId: string, columnId: string, cursor?: { x: number; y: number } | null) => {
      const l = layoutRef.current.find((item) => item.table.id === tableId);
      const idx = l?.table.columns.findIndex((c) => c.id === columnId) ?? -1;
      if (!l || idx < 0) return;
      if (cursor) {
        const placed = placeNearCursor(cursor.x, cursor.y);
        setRelTip(null);
        setColTip({ tableId, columnId, sx: placed.sx, sy: placed.sy });
        return;
      }
      const v = viewRef.current;
      const worldY = l.y + HEADER_H + idx * ROW_H + ROW_H / 2;
      const rightSx = v.x + (l.x + TABLE_W) * v.s;
      const leftSx = v.x + l.x * v.s;
      const anchorSy = v.y + worldY * v.s;
      const placed = placeRightOrFlip(rightSx, leftSx, anchorSy);
      setRelTip(null);
      setColTip({ tableId, columnId, sx: placed.sx, sy: placed.sy });
    },
    [placeRightOrFlip, placeNearCursor],
  );

  /** Ronde 3: relation tooltip — label + cardinality + onDelete di kanan garis.
   * Ronde 4 ITEM 7: bila cursor (posisi kursor relatif canvas) diteruskan,
   * tooltip di-offset diagonal kanan-bawah kursor (+14/+16 + flip); tanpa
   * cursor (fokus keyboard) tetap midpoint seperti sebelumnya. */
  const showRelTip = useCallback(
    (relationId: string, cursor?: { x: number; y: number } | null) => {
      if (cursor) {
        const placed = placeNearCursor(cursor.x, cursor.y);
        setColTip(null);
        setRelTip({ relationId, sx: placed.sx, sy: placed.sy });
        return;
      }
      const st = layoutRef.current;
      // Cari relasi dari state via layout? Ambil dari DOM-independent: butuh tables.
      // Caller menjamin id valid; hitung midpoint dari layout saat ini.
      const rel = (stateRef.current?.relations ?? []).find((r) => r.id === relationId);
      if (!rel) return;
      const ft = st.find((item) => item.table.id === rel.fromTableId);
      const tt = st.find((item) => item.table.id === rel.toTableId);
      const fc = ft?.table.columns.find((c) => c.id === rel.fromColumnId);
      const tc = tt?.table.columns.find((c) => c.id === rel.toColumnId);
      if (!ft || !tt || !fc || !tc) return;
      const fx = ft.x + TABLE_W;
      const fy = ft.y + HEADER_H + ft.table.columns.indexOf(fc) * ROW_H + ROW_H / 2;
      const tx = tt.x;
      const ty = tt.y + HEADER_H + tt.table.columns.indexOf(tc) * ROW_H + ROW_H / 2;
      const mx = (fx + tx) / 2;
      const my = (fy + ty) / 2;
      const v = viewRef.current;
      const midSx = v.x + mx * v.s;
      // Garis tipis: kanan = mid + 7px dunia, kiri = mid - 7px dunia (hit 14px).
      const rightSx = v.x + (mx + 7) * v.s;
      const leftSx = v.x + (mx - 7) * v.s;
      void midSx;
      const anchorSy = v.y + my * v.s;
      const placed = placeRightOrFlip(rightSx, leftSx, anchorSy);
      setColTip(null);
      setRelTip({ relationId, sx: placed.sx, sy: placed.sy });
    },
    [placeRightOrFlip, placeNearCursor],
  );

  // U2: on-demand viewport-center read for the canvas [+ Table] pill.
  // Same canvas-size fallback as the F2-3 Locate effect (400/240 halves).
  const getViewportCenterWorld = useCallback((): ErdPosition => {
    const el = canvasRef.current;
    const rect = el?.getBoundingClientRect();
    const w = rect && rect.width > 0 ? rect.width : 800;
    const h = rect && rect.height > 0 ? rect.height : 480;
    return viewportCenterWorld(viewRef.current, w, h);
  }, []);

  useEffect(() => {
    if (!viewportRef) return;
    viewportRef.current = { getViewportCenterWorld };
    return () => {
      viewportRef.current = null;
    };
  }, [viewportRef, getViewportCenterWorld]);

  const canDrag = !readOnly;
  const layout = useMemo(
    () => layoutTables(state.tables, state.erdLayout),
    [state.tables, state.erdLayout],
  );
  // Posisi render: layout + preview drag node + offset drag grup.
  // Satu sumber kebenaran untuk node, relasi, dan boundary area.
  const renderPos = useMemo(() => {
    const m = new Map<string, ErdPosition>();
    const groups = state.erdGroups ?? [];
    for (const l of layout) {
      let x = l.x;
      let y = l.y;
      if (dragPreview?.tableId === l.table.id) {
        x = dragPreview.x;
        y = dragPreview.y;
      } else if (groupDragPreview?.mode === 'move') {
        const g = groups.find((gg) => gg.id === groupDragPreview.groupId);
        if (g && (g.tableIds ?? []).includes(l.table.id)) {
          x += groupDragPreview.dx;
          y += groupDragPreview.dy;
        }
      }
      m.set(l.table.id, { x, y });
    }
    return m;
  }, [layout, dragPreview, groupDragPreview, state.erdGroups]);
  // Areas: bounds eksplisit bila ada, else turunan anggota (ikut preview drag).
  const groupBoxes: ErdGroupBox[] = useMemo(() => {
    const rl = layout.map((l) => ({
      table: l.table,
      x: renderPos.get(l.table.id)?.x ?? l.x,
      y: renderPos.get(l.table.id)?.y ?? l.y,
      h: l.h,
    }));
    const out: ErdGroupBox[] = [];
    for (const g of state.erdGroups ?? []) {
      if (groupDragPreview && groupDragPreview.groupId === g.id) {
        const b = groupDragPreview.box;
        out.push({ group: g, x: b.x, y: b.y, w: b.w, h: b.h });
        continue;
      }
      const box = resolveGroupBox(g, rl, TABLE_W);
      if (box) out.push(box);
    }
    return out;
  }, [state.erdGroups, renderPos, layout, groupDragPreview]);
  const layoutRef = useRef(layout);
  layoutRef.current = layout;
  const groupsRef = useRef(state.erdGroups);
  groupsRef.current = state.erdGroups;

  // U8: derivasi connected/neighbor dari selectedTableId (snapshot-safe: dari props/state args).
  // Incident = relasi yang menyentuh tabel terpilih; neighbor = ujung lainnya.
  const connectedRelIds = useMemo(() => {
    if (!selectedTableId) return new Set<string>();
    const s = new Set<string>();
    for (const r of state.relations ?? []) {
      if (!r) continue;
      if (r.fromTableId === selectedTableId || r.toTableId === selectedTableId) s.add(r.id);
    }
    return s;
  }, [state.relations, selectedTableId]);
  const neighborTableIds = useMemo(() => {
    if (!selectedTableId) return new Set<string>();
    const s = new Set<string>();
    for (const r of state.relations ?? []) {
      if (!r) continue;
      if (r.fromTableId === selectedTableId && r.toTableId !== selectedTableId) s.add(r.toTableId);
      else if (r.toTableId === selectedTableId && r.fromTableId !== selectedTableId) s.add(r.fromTableId);
    }
    return s;
  }, [state.relations, selectedTableId]);
  const hasFocusSelection = selectedTableId !== null && selectedTableId !== undefined && selectedTableId !== '';
  const incidentCountFor = useCallback(
    (tableId: string) => {
      let n = 0;
      for (const r of state.relations ?? []) {
        if (!r) continue;
        if (r.fromTableId === tableId || r.toTableId === tableId) n += 1;
      }
      return n;
    },
    [state.relations],
  );

  useEffect(() => {
    return () => {
      if (highlightTimerRef.current !== null) {
        window.clearTimeout(highlightTimerRef.current);
        highlightTimerRef.current = null;
      }
      const pending = nodeDragRef.current;
      if (pending?.timerId !== null && pending?.timerId !== undefined) {
        window.clearTimeout(pending.timerId);
      }
      nodeDragRef.current = null;
    };
  }, []);

  // F2-5: Space held = pan even when the pointer starts on a node (whiteboard pattern).
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code !== 'Space') return;
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return;
      // U3: Space on a connect handle arms/commits instead of panning.
      if (target && typeof target.closest === 'function' && target.closest('.erd-handle')) return;
      if (document.querySelector('.modal-backdrop, .palette')) return;
      e.preventDefault();
      spaceHeldRef.current = true;
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code !== 'Space' && e.key !== ' ') return;
      spaceHeldRef.current = false;
    };
    const onBlur = () => {
      spaceHeldRef.current = false;
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
    };
  }, []);

  // F2-3 Locate: center the view on the target table (keeps zoom) + 2s node highlight.
  // Reuses setView so existing pan/zoom semantics stay intact. No-op when the table is gone.
  useEffect(() => {
    if (!locateRequest) return;
    const target = layoutRef.current.find((l) => l.table.id === locateRequest.tableId);
    if (!target) return;
    const el = canvasRef.current;
    if (el) {
      const rect = el.getBoundingClientRect();
      const cx = rect.width > 0 ? rect.width / 2 : 400;
      const cy = rect.height > 0 ? rect.height / 2 : 240;
      const tx = target.x + TABLE_W / 2;
      const ty = target.y + target.h / 2;
      setView((v) => ({ ...v, x: cx - tx * v.s, y: cy - ty * v.s }));
    }
    setHighlightId(locateRequest.tableId);
    if (highlightTimerRef.current !== null) {
      window.clearTimeout(highlightTimerRef.current);
    }
    highlightTimerRef.current = window.setTimeout(() => {
      setHighlightId(null);
      highlightTimerRef.current = null;
    }, 2000);
  }, [locateRequest]);

  const handleCanvasEscape = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape' && (colTip || relTip)) {
        e.stopPropagation();
        e.preventDefault();
        setColTip(null);
        setRelTip(null);
        return;
      }
      // U3 tiered Esc: an active connect-drag / armed source cancels first
      // (announced); ronde 4: connect → panel selection → canvas.
      if (e.key === 'Escape' && (connectDragRef.current || pendingSourceRef.current)) {
        e.stopPropagation();
        e.preventDefault();
        cancelConnect(true);
        return;
      }
      // Geser grup aktif dibatalkan dulu (tanpa commit).
      if (e.key === 'Escape' && groupDragRef.current) {
        e.stopPropagation();
        e.preventDefault();
        cancelGroupDrag();
        return;
      }
      // Seleksi grup dilepas sebelum tier panel (fokus tetap di kanvas).
      if (e.key === 'Escape' && selectedGroupId) {
        e.stopPropagation();
        e.preventDefault();
        setSelectedGroupId(null);
        svgRef.current?.focus();
        return;
      }
      // Ronde 4: panel selection closes (focus back to the canvas) instead of
      // bubbling to the canvas-overlay window handler (which closes canvas).
      if (e.key === 'Escape' && panelSelectionOpen && onClosePanelSelection) {
        e.stopPropagation();
        e.preventDefault();
        onClosePanelSelection();
        svgRef.current?.focus();
      }
    },
    [cancelConnect, cancelGroupDrag, panelSelectionOpen, onClosePanelSelection, colTip, relTip, selectedGroupId],
  );

  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      setColTip(null);
      setRelTip(null);
      const rect = el.getBoundingClientRect();
      const cx = e.clientX - rect.left;
      const cy = e.clientY - rect.top;
      setView((v) => {
        const s = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, v.s * (e.deltaY < 0 ? 1.12 : 0.89)));
        const k = s / v.s;
        return { x: cx - (cx - v.x) * k, y: cy - (cy - v.y) * k, s };
      });
    };
    const onScroll = () => {
      setColTip(null);
      setRelTip(null);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    el.addEventListener('scroll', onScroll);
    return () => {
      el.removeEventListener('wheel', onWheel);
      el.removeEventListener('scroll', onScroll);
    };
  }, []);

  // F2-5: two-finger pinch zoom (copied from WhiteboardCanvas useView pinch block).
  // Takes over pan/node-drag while two touch pointers are down.
  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const pointers = new Map<number, { x: number; y: number }>();
    let pinchStart: { dist: number; cx: number; cy: number; view: { x: number; y: number; s: number } } | null = null;
    let pinching = false;

    const cancelNodeDrag = () => {
      const pending = nodeDragRef.current;
      if (pending?.timerId != null) window.clearTimeout(pending.timerId);
      nodeDragRef.current = null;
      setDragPreview(null);
      setNodeDraggingId(null);
      // U3: two-finger pinch also aborts an active connect-drag / armed source.
      const hadConnect = connectDragRef.current !== null || pendingSourceRef.current !== null;
      connectDragRef.current = null;
      pendingTapRef.current = null;
      setConnectPreview(null);
      followLastRef.current = null;
      panCapturedRef.current = null;
      setColTip(null);
      setRelTip(null);
      if (pendingSourceRef.current) setPendingSource(null);
      if (hadConnect) {
        suppressRelClickRef.current = false;
        setAnnounce(tRef.current('schema.erd.connectCancelled'));
      }
    };

    const onPointerDown = (e: PointerEvent) => {
      if (e.pointerType === 'mouse') return;
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.size >= 2) {
        e.stopPropagation();
        if (!pinching) {
          const pts = [...pointers.values()];
          const a = pts[0];
          const b = pts[1];
          if (!a || !b) return;
          const rect = el.getBoundingClientRect();
          pinchStart = {
            dist: Math.hypot(a.x - b.x, a.y - b.y),
            cx: (a.x + b.x) / 2 - rect.left,
            cy: (a.y + b.y) / 2 - rect.top,
            view: { ...viewRef.current },
          };
          pinching = true;
          dragStartRef.current = null;
          setDragging(false);
          cancelNodeDrag();
        }
      }
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!pointers.has(e.pointerId)) return;
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (!pinching || !pinchStart || pointers.size < 2) return;
      e.stopPropagation();
      const pts = [...pointers.values()];
      const a = pts[0];
      const b = pts[1];
      if (!a || !b) return;
      const rect = el.getBoundingClientRect();
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      const cx = (a.x + b.x) / 2 - rect.left;
      const cy = (a.y + b.y) / 2 - rect.top;
      if (pinchStart.dist <= 0) return;
      const factor = dist / pinchStart.dist;
      const base = pinchStart.view;
      const s = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, base.s * factor));
      const k = s / base.s;
      const bx = pinchStart.cx - (pinchStart.cx - base.x) * k;
      const by = pinchStart.cy - (pinchStart.cy - base.y) * k;
      setView({ s, x: bx + (cx - pinchStart.cx), y: by + (cy - pinchStart.cy) });
    };

    const endPointer = (e: PointerEvent) => {
      pointers.delete(e.pointerId);
      if (pinching && pointers.size < 2) {
        pinching = false;
        pinchStart = null;
      }
    };

    el.addEventListener('pointerdown', onPointerDown);
    el.addEventListener('pointermove', onPointerMove);
    el.addEventListener('pointerup', endPointer);
    el.addEventListener('pointercancel', endPointer);
    return () => {
      el.removeEventListener('pointerdown', onPointerDown);
      el.removeEventListener('pointermove', onPointerMove);
      el.removeEventListener('pointerup', endPointer);
      el.removeEventListener('pointercancel', endPointer);
    };
  }, []);

  const zoomAt = useCallback((factor: number) => {
    const el = canvasRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const cx = rect.width / 2;
    const cy = rect.height / 2;
    setView((v) => {
      const s = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, v.s * factor));
      const k = s / v.s;
      return { x: cx - (cx - v.x) * k, y: cy - (cy - v.y) * k, s };
    });
  }, []);

  const columnY = (table: Table, column: Column) => {
    const idx = table.columns.indexOf(column);
    return HEADER_H + idx * ROW_H + ROW_H / 2;
  };

  /** F2-5: world-space hit-test over table rects, topmost last-rendered wins. */
  const hitTestNode = useCallback(
    (worldX: number, worldY: number, toleranceWorld: number) => {
      for (let i = layoutRef.current.length - 1; i >= 0; i -= 1) {
        const l = layoutRef.current[i]!;
        if (
          worldX >= l.x - toleranceWorld &&
          worldX <= l.x + TABLE_W + toleranceWorld &&
          worldY >= l.y - toleranceWorld &&
          worldY <= l.y + l.h + toleranceWorld
        ) {
          return l;
        }
      }
      return null;
    },
    [],
  );

  const toWorld = useCallback(
    (clientX: number, clientY: number, svg: SVGSVGElement) => {
      const rect = svg.getBoundingClientRect();
      const v = viewRef.current;
      return {
        x: (clientX - rect.left - v.x) / v.s,
        y: (clientY - rect.top - v.y) / v.s,
      };
    },
    [],
  );

  const clearNodeDragTimer = useCallback(() => {
    const pending = nodeDragRef.current;
    if (pending?.timerId != null) {
      window.clearTimeout(pending.timerId);
      pending.timerId = null;
    }
  }, []);

  /** U3: world-space hit-test over column handles (r10 hit-area), closest wins. */
  const findHandleAt = useCallback((worldX: number, worldY: number) => {
    const rWorld = 10 / Math.max(MIN_ZOOM, viewRef.current.s);
    const items = layoutRef.current;
    for (let i = items.length - 1; i >= 0; i -= 1) {
      const l = items[i]!;
      for (let ci = 0; ci < l.table.columns.length; ci += 1) {
        const col = l.table.columns[ci]!;
        const cy = l.y + HEADER_H + ci * ROW_H + ROW_H / 2;
        const leftDx = worldX - l.x;
        const rightDx = worldX - (l.x + TABLE_W);
        const dy = worldY - cy;
        if (Math.hypot(leftDx, dy) <= rWorld) {
          return { tableId: l.table.id, columnId: col.id, side: 'left' as const, x: l.x, y: cy };
        }
        if (Math.hypot(rightDx, dy) <= rWorld) {
          return { tableId: l.table.id, columnId: col.id, side: 'right' as const, x: l.x + TABLE_W, y: cy };
        }
      }
    }
    return null;
  }, []);

  /** U3: world-space hit-test over column row bands (drop targets), topmost wins. */
  const findColumnAt = useCallback((worldX: number, worldY: number, toleranceWorld: number) => {
    const items = layoutRef.current;
    for (let i = items.length - 1; i >= 0; i -= 1) {
      const l = items[i]!;
      if (worldX < l.x - toleranceWorld || worldX > l.x + TABLE_W + toleranceWorld) continue;
      const relY = worldY - l.y - HEADER_H;
      const idx = Math.floor(relY / ROW_H);
      if (idx < 0 || idx >= l.table.columns.length) continue;
      const top = l.y + HEADER_H + idx * ROW_H;
      if (worldY < top - toleranceWorld || worldY > top + ROW_H + toleranceWorld) continue;
      const col = l.table.columns[idx]!;
      return { tableId: l.table.id, columnId: col.id };
    }
    return null;
  }, []);

  /** U3: drop-target lookup from a bubbled event target (robust when client coords are synthetic). */
  const targetFromEvent = useCallback((target: EventTarget | null) => {
    const el = target as Element | null;
    const marked = typeof el?.closest === 'function' ? el.closest('[data-connect-col]') : null;
    const raw = marked?.getAttribute('data-connect-col');
    if (!raw) return null;
    const sep = raw.indexOf(':');
    if (sep < 0) return null;
    return { tableId: raw.slice(0, sep), columnId: raw.slice(sep + 1) };
  }, []);

  const columnNames = useCallback((tableId: string, columnId: string) => {
    const table = layoutRef.current.find((l) => l.table.id === tableId)?.table;
    const col = table?.columns.find((c) => c.id === columnId);
    return { table: table?.name ?? shortId(tableId), column: col?.name || shortId(columnId) };
  }, []);

  /** U3: pointerdown exactly on a handle starts connect mode (node locked, no pan for this pointer). */
  const onHandlePointerDown = (
    e: React.PointerEvent<SVGGElement>,
    tableId: string,
    columnId: string,
    side: 'left' | 'right',
  ) => {
    if (readOnly) return;
    // Space held = pan always (hit order: handle → node → empty).
    if (spaceHeldRef.current) return;
    e.stopPropagation();
    if (connectDragRef.current) return;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    const l = layoutRef.current.find((item) => item.table.id === tableId);
    const idx = l?.table.columns.findIndex((c) => c.id === columnId) ?? -1;
    const fromX = side === 'left' ? (l?.x ?? 0) : (l ? l.x + TABLE_W : 0);
    const fromY = l && idx >= 0 ? l.y + HEADER_H + idx * ROW_H + ROW_H / 2 : 0;
    connectDragRef.current = {
      fromTableId: tableId,
      fromColumnId: columnId,
      pointerId: e.pointerId,
      startClientX: e.clientX,
      startClientY: e.clientY,
      moved: false,
      fromX,
      fromY,
    };
  };

  /** U3: keyboard handle — Enter/Space arms or commits, Esc cancels. Node keys untouched. */
  const onHandleKeyDown = (e: React.KeyboardEvent, tableId: string, columnId: string) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      e.stopPropagation();
      if (readOnly) return;
      const armed = pendingSourceRef.current;
      if (armed) {
        if (armed.tableId === tableId && armed.columnId === columnId) {
          setPendingSource(null);
          setConnectPreview(null);
          followLastRef.current = null;
          setAnnounce(t('schema.erd.connectCancelled'));
        } else {
          setPendingSource(null);
          setConnectPreview(null);
          followLastRef.current = null;
          suppressRelClickRef.current = true;
          window.setTimeout(() => {
            suppressRelClickRef.current = false;
          }, 0);
          onConnectColumns?.({
            fromTableId: armed.tableId,
            fromColumnId: armed.columnId,
            toTableId: tableId,
            toColumnId: columnId,
          });
        }
      } else {
        setPendingSource({ tableId, columnId });
        followLastRef.current = null;
        const names = columnNames(tableId, columnId);
        setAnnounce(t('schema.erd.connectArmed', { table: names.table, column: names.column }));
      }
      return;
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      cancelConnect(true);
    }
  };

  /**
   * Geser grup dari label boundary-nya (satu-satunya handle geser —
   * klik area kosong tetap pan). Seluruh anggota ikut bergeser preview,
   * commit per tabel + geometri (bila eksplisit) saat pointerup.
   * Tap tanpa gerak = seleksi grup (menampilkan resize handle).
   */
  const startGroupDrag = (e: React.PointerEvent<SVGElement>, groupId: string) => {
    // Space held = pan walau mulai dari dalam area (pola whiteboard F2-5) —
    // return sebelum stopPropagation agar svg pan handler tetap menerima event.
    if (spaceHeldRef.current) return;
    e.stopPropagation();
    e.preventDefault();
    if (e.button !== 0 || readOnly || !onMoveTable) return;
    const box = groupBoxes.find((b) => b.group.id === groupId);
    if (!box) return;
    setSelectedGroupId(groupId);
    groupDragRef.current = {
      groupId,
      mode: 'move',
      pointerId: e.pointerId,
      startClientX: e.clientX,
      startClientY: e.clientY,
      moved: false,
      orig: { x: box.x, y: box.y, w: box.w, h: box.h },
    };
  };

  /** Resize grup dari handle sudut (min clamp di resizeBox). */
  const startGroupResize = (e: React.PointerEvent<SVGCircleElement>, groupId: string, corner: GroupCorner) => {
    // Konsisten dengan startGroupDrag: space held = pan.
    if (spaceHeldRef.current) return;
    e.stopPropagation();
    e.preventDefault();
    if (e.button !== 0 || readOnly || !onMoveTable) return;
    const box = groupBoxes.find((b) => b.group.id === groupId);
    if (!box) return;
    setSelectedGroupId(groupId);
    groupDragRef.current = {
      groupId,
      mode: 'resize',
      corner,
      pointerId: e.pointerId,
      startClientX: e.clientX,
      startClientY: e.clientY,
      moved: false,
      orig: { x: box.x, y: box.y, w: box.w, h: box.h },
    };
  };

  const onPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (e.button !== 0) return;
    // Space held (or readOnly) always pans — existing behaviour preserved.
    // Ronde 3 ITEM 5: no eager capture — lazy capture on first move past threshold.
    if (spaceHeldRef.current || readOnly) {
      panCapturedRef.current = null;
      dragStartRef.current = { pointerX: e.clientX, pointerY: e.clientY, x: viewRef.current.x, y: viewRef.current.y };
      setDragging(true);
      return;
    }
    // U3: a connect-drag locks its pointer — extra pointers are ignored here
    // (pinch takes over via its own listeners and cancels the connect).
    if (connectDragRef.current) return;
    const svg = e.currentTarget;
    const world = toWorld(e.clientX, e.clientY, svg);
    const tolWorld = HIT_TOLERANCE_PX / Math.max(MIN_ZOOM, viewRef.current.s);
    // U3 hit order: handle → node → empty.
    const handleHit = findHandleAt(world.x, world.y);
    if (handleHit) {
      connectDragRef.current = {
        fromTableId: handleHit.tableId,
        fromColumnId: handleHit.columnId,
        pointerId: e.pointerId,
        startClientX: e.clientX,
        startClientY: e.clientY,
        moved: false,
        fromX: handleHit.x,
        fromY: handleHit.y,
      };
      return;
    }
    // U3: remember the down point while a source is armed so the matching
    // pointerup can commit (row tap) or cancel (empty tap) the tap-tap flow.
    if (pendingSourceRef.current) {
      pendingTapRef.current = { pointerId: e.pointerId, startClientX: e.clientX, startClientY: e.clientY };
    }
    const hit = hitTestNode(world.x, world.y, tolWorld);
    if (!hit || !canDrag) {
      panCapturedRef.current = null;
      dragStartRef.current = { pointerX: e.clientX, pointerY: e.clientY, x: viewRef.current.x, y: viewRef.current.y };
      setDragging(true);
      return;
    }
    // Hit a table header/body → node drag (preview locally, commit once on pointerup).
    // Ronde 3 ITEM 5: no eager capture here — lazy on first move past threshold.
    // jsdom fireEvent omits pointerType — treat missing as mouse (immediate drag).
    const isTouch = e.pointerType === 'touch';
    const pending: NodeDragState = {
      tableId: hit.table.id,
      pointerId: e.pointerId,
      startClientX: e.clientX,
      startClientY: e.clientY,
      origX: hit.x,
      origY: hit.y,
      moved: false,
      touchPending: isTouch,
      touchArmed: !isTouch,
      timerId: null,
    };
    nodeDragRef.current = pending;
    setNodeDraggingId(hit.table.id);
    if (isTouch) {
      // Long-press 180ms arms the node drag (useTouchDrag pattern); early
      // motion beyond 10px cancels into a canvas pan instead.
      pending.timerId = window.setTimeout(() => {
        if (nodeDragRef.current === pending) {
          pending.touchPending = false;
          pending.touchArmed = true;
        }
      }, TOUCH_LONG_PRESS_MS);
    }
  };

  const onPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    // U3: live temp line (erd-rel-line styling, local state like dragPreview).
    const conn = connectDragRef.current;
    if (conn) {
      if (e.pointerId !== conn.pointerId) return;
      const dxScreen = e.clientX - conn.startClientX;
      const dyScreen = e.clientY - conn.startClientY;
      if (!conn.moved && Math.hypot(dxScreen, dyScreen) < DRAG_THRESHOLD_PX) return;
      const firstMove = !conn.moved;
      conn.moved = true;
      if (firstMove) {
        // Ronde 3 ITEM 5: lazy capture — hanya saat gerakan pertama lewat ambang.
        try {
          e.currentTarget.setPointerCapture?.(e.pointerId);
        } catch {
          /* jsdom / pointer sudah lepas — abaikan */
        }
      }
      // Lines passed over must not pop the F2-1 relation popover.
      suppressRelClickRef.current = true;
      const w = toWorld(e.clientX, e.clientY, e.currentTarget);
      setConnectPreview({ fromX: conn.fromX, fromY: conn.fromY, toX: w.x, toY: w.y });
      return;
    }
    // Geser/resize grup: delta dunia di-preview (anggota + boundary).
    const gd = groupDragRef.current;
    if (gd) {
      if (e.pointerId !== gd.pointerId) return;
      if (!gd.moved && Math.hypot(e.clientX - gd.startClientX, e.clientY - gd.startClientY) < DRAG_THRESHOLD_PX) return;
      gd.moved = true;
      suppressRelClickRef.current = true;
      const s = Math.max(MIN_ZOOM, viewRef.current.s);
      const dx = Math.round(((e.clientX - gd.startClientX) / s) * 10) / 10;
      const dy = Math.round(((e.clientY - gd.startClientY) / s) * 10) / 10;
      if (gd.mode === 'resize' && gd.corner) {
        const box = resizeBox(gd.orig, gd.corner, dx, dy);
        setGroupDragPreview({ groupId: gd.groupId, mode: 'resize', box, dx: 0, dy: 0 });
      } else {
        setGroupDragPreview({
          groupId: gd.groupId,
          mode: 'move',
          box: { x: gd.orig.x + dx, y: gd.orig.y + dy, w: gd.orig.w, h: gd.orig.h },
          dx,
          dy,
        });
      }
      return;
    }
    const pending = nodeDragRef.current;
    if (pending) {
      if (e.pointerId !== pending.pointerId) return;
      const dxScreen = e.clientX - pending.startClientX;
      const dyScreen = e.clientY - pending.startClientY;
      const dist = Math.hypot(dxScreen, dyScreen);
      if (pending.touchPending && !pending.touchArmed) {
        // Touch pre-arm: fast swipe becomes a pan so one finger can still
        // pan when starting on a node without a long-press.
        if (dist > TOUCH_MOVE_THRESHOLD_PX) {
          clearNodeDragTimer();
          nodeDragRef.current = null;
          setNodeDraggingId(null);
          setDragPreview(null);
          panCapturedRef.current = null;
          dragStartRef.current = {
            pointerX: e.clientX,
            pointerY: e.clientY,
            x: viewRef.current.x,
            y: viewRef.current.y,
          };
          setDragging(true);
        }
        return;
      }
      if (!pending.moved && dist < DRAG_THRESHOLD_PX) return;
      const firstMove = !pending.moved;
      pending.moved = true;
      if (firstMove) {
        // Ronde 3 ITEM 5: lazy capture untuk drag node.
        try {
          e.currentTarget.setPointerCapture?.(e.pointerId);
        } catch {
          /* abaikan */
        }
      }
      suppressRelClickRef.current = true;
      const s = Math.max(MIN_ZOOM, viewRef.current.s);
      setDragPreview({
        tableId: pending.tableId,
        x: pending.origX + dxScreen / s,
        y: pending.origY + dyScreen / s,
      });
      return;
    }
    const start = dragStartRef.current;
    if (start) {
      // Ronde 3 ITEM 5: pan juga lazy — di bawah ambang = tap, bukan pan.
      const dxScreen = e.clientX - start.pointerX;
      const dyScreen = e.clientY - start.pointerY;
      if (Math.hypot(dxScreen, dyScreen) < DRAG_THRESHOLD_PX) return;
      if (panCapturedRef.current !== e.pointerId) {
        panCapturedRef.current = e.pointerId;
        try {
          e.currentTarget.setPointerCapture?.(e.pointerId);
        } catch {
          /* abaikan */
        }
      }
      setView((v) => ({ ...v, x: start.x + (e.clientX - start.pointerX), y: start.y + (e.clientY - start.pointerY) }));
      return;
    }
    // Ronde 3 ITEM 1b: tap-tap follow-connect — sumber armed, tanpa drag/pan/connect
    // lain → garis temp mengikuti kursor (throttle moved >2px screen).
    const armed = pendingSourceRef.current;
    if (armed) {
      if (connectDragRef.current || nodeDragRef.current || dragStartRef.current) return;
      const last = followLastRef.current;
      if (last && Math.hypot(e.clientX - last.x, e.clientY - last.y) <= 2) return;
      const l = layoutRef.current.find((item) => item.table.id === armed.tableId);
      const idx = l?.table.columns.findIndex((c) => c.id === armed.columnId) ?? -1;
      if (!l || idx < 0) return;
      const cursorWorld = toWorld(e.clientX, e.clientY, e.currentTarget);
      const rowY = l.y + HEADER_H + idx * ROW_H + ROW_H / 2;
      const centerX = l.x + TABLE_W / 2;
      const fromX = cursorWorld.x >= centerX ? l.x + TABLE_W : l.x;
      followLastRef.current = { x: e.clientX, y: e.clientY };
      setConnectPreview({ fromX, fromY: rowY, toX: cursorWorld.x, toY: cursorWorld.y });
    }
  };

  const commitNodeDrag = useCallback(
    (pending: NodeDragState, clientX: number, clientY: number) => {
      const s = Math.max(MIN_ZOOM, viewRef.current.s);
      const dxScreen = clientX - pending.startClientX;
      const dyScreen = clientY - pending.startClientY;
      const next = {
        x: Math.round((pending.origX + dxScreen / s) * 10) / 10,
        y: Math.round((pending.origY + dyScreen / s) * 10) / 10,
      };
      onMoveTable?.(pending.tableId, next);
      // Auto-membership spasial: uji tengah node hasil drop terhadap bounds
      // grup (tanpa tabel yang digeser). Tanpa grup / tanpa handler = diam.
      if (onAssignTableGroup) {
        const groups = groupsRef.current ?? [];
        if (groups.length > 0) {
          const box = layoutRef.current.find((l) => l.table.id === pending.tableId);
          const cx = next.x + TABLE_W / 2;
          const cy = next.y + (box ? box.h / 2 : HEADER_H);
          const target = dropTargetGroup(groups, layoutRef.current, TABLE_W, pending.tableId, { x: cx, y: cy });
          if (target) {
            const already = (target.tableIds ?? []).includes(pending.tableId);
            if (!already) onAssignTableGroup(pending.tableId, target.id);
          } else {
            const memberOf = groups.some((g) => (g.tableIds ?? []).includes(pending.tableId));
            if (memberOf) onAssignTableGroup(pending.tableId, null);
          }
        }
      }
    },
    [onMoveTable, onAssignTableGroup],
  );

  const endNodeDrag = (e: React.PointerEvent<SVGSVGElement>, cancelled: boolean) => {
    const pending = nodeDragRef.current;
    if (!pending || e.pointerId !== pending.pointerId) return false;
    clearNodeDragTimer();
    nodeDragRef.current = null;
    setNodeDraggingId(null);
    const wasMoved = pending.moved && !cancelled;
    // Touch that never armed the long-press is a tap → focus only.
    const tapped = cancelled || !wasMoved;
    setDragPreview(null);
    if (wasMoved) {
      commitNodeDrag(pending, e.clientX, e.clientY);
      // Keep suppress until the ensuing click fires, then relation/svg
      // click handlers consume + clear it (no F2-1 selection while dragging).
      window.setTimeout(() => {
        suppressRelClickRef.current = false;
      }, 0);
    } else if (tapped && !cancelled) {
      suppressRelClickRef.current = false;
      // Below threshold = click/selection: focus the node for keyboard users.
      nodeRefs.current.get(pending.tableId)?.focus();
    } else {
      suppressRelClickRef.current = false;
    }
    return true;
  };

  const onPointerUp = (e: React.PointerEvent<SVGSVGElement>) => {
    // U3: connect-drag pointerup — commit, arm (tap-tap), or silent cancel.
    const conn = connectDragRef.current;
    if (conn && e.pointerId === conn.pointerId) {
      connectDragRef.current = null;
      setConnectPreview(null);
      const dist = Math.hypot(e.clientX - conn.startClientX, e.clientY - conn.startClientY);
      const moved = conn.moved || dist >= DRAG_THRESHOLD_PX;
      const upWorld = toWorld(e.clientX, e.clientY, e.currentTarget);
      const tolWorld = HIT_TOLERANCE_PX / Math.max(MIN_ZOOM, viewRef.current.s);
      const target = targetFromEvent(e.target) ?? findColumnAt(upWorld.x, upWorld.y, tolWorld);
      if (!moved) {
        // Tap without motion on a handle: arm, or resolve against an armed source.
        const armed = pendingSourceRef.current;
        if (armed) {
          if (armed.tableId === conn.fromTableId && armed.columnId === conn.fromColumnId) {
            setPendingSource(null);
            followLastRef.current = null;
            setAnnounce(t('schema.erd.connectCancelled'));
          } else {
            setPendingSource(null);
            followLastRef.current = null;
            suppressRelClickRef.current = true;
            window.setTimeout(() => {
              suppressRelClickRef.current = false;
            }, 0);
            onConnectColumns?.({
              fromTableId: armed.tableId,
              fromColumnId: armed.columnId,
              toTableId: conn.fromTableId,
              toColumnId: conn.fromColumnId,
            });
          }
        } else {
          setPendingSource({ tableId: conn.fromTableId, columnId: conn.fromColumnId });
          followLastRef.current = null;
          const names = columnNames(conn.fromTableId, conn.fromColumnId);
          setAnnounce(t('schema.erd.connectArmed', { table: names.table, column: names.column }));
        }
        return;
      }
      // Dragged: keep suppress until the ensuing click fires (F2-1 guard).
      window.setTimeout(() => {
        suppressRelClickRef.current = false;
      }, 0);
      if (!target) {
        setAnnounce(t('schema.erd.connectCancelled'));
        return;
      }
      // Exact same column = silent cancel; same table / different column still
      // commits — the modal/server self-table guard rejects it (future-proof
      // for table↔collection drops, which cannot exist yet).
      if (target.tableId === conn.fromTableId && target.columnId === conn.fromColumnId) {
        setAnnounce(t('schema.erd.connectCancelled'));
        return;
      }
      if (pendingSourceRef.current) setPendingSource(null);
      followLastRef.current = null;
      onConnectColumns?.({
        fromTableId: conn.fromTableId,
        fromColumnId: conn.fromColumnId,
        toTableId: target.tableId,
        toColumnId: target.columnId,
      });
      return;
    }
    // U3: tap-tap second tap landed on a row body / empty (handle taps go
    // through the branch above). A tap commits or cancels; a real drag/pan
    // leaves the armed source alone.
    const tap = pendingTapRef.current;
    if (tap && e.pointerId === tap.pointerId) {
      pendingTapRef.current = null;
      const tapDist = Math.hypot(e.clientX - tap.startClientX, e.clientY - tap.startClientY);
      if (tapDist < DRAG_THRESHOLD_PX) {
        const armed = pendingSourceRef.current;
        if (armed) {
          const upWorld = toWorld(e.clientX, e.clientY, e.currentTarget);
          const tolWorld = HIT_TOLERANCE_PX / Math.max(MIN_ZOOM, viewRef.current.s);
          const target = targetFromEvent(e.target) ?? findColumnAt(upWorld.x, upWorld.y, tolWorld);
          if (!target || (target.tableId === armed.tableId && target.columnId === armed.columnId)) {
            setPendingSource(null);
            setConnectPreview(null);
            followLastRef.current = null;
            setAnnounce(t('schema.erd.connectCancelled'));
          } else {
            setPendingSource(null);
            setConnectPreview(null);
            followLastRef.current = null;
            suppressRelClickRef.current = true;
            window.setTimeout(() => {
              suppressRelClickRef.current = false;
            }, 0);
            onConnectColumns?.({
              fromTableId: armed.tableId,
              fromColumnId: armed.columnId,
              toTableId: target.tableId,
              toColumnId: target.columnId,
            });
          }
        }
      }
      // Fall through: the tap is also a normal node-focus / pan-end no-op.
    }
    // Geser/resize grup selesai: drag = commit, tap = tanpa aksi (seleksi via onClick label).
    const gd = groupDragRef.current;
    if (gd && e.pointerId === gd.pointerId) {
      groupDragRef.current = null;
      setGroupDragPreview(null);
      if (!gd.moved) return;
      const s = Math.max(MIN_ZOOM, viewRef.current.s);
      const dx = Math.round(((e.clientX - gd.startClientX) / s) * 10) / 10;
      const dy = Math.round(((e.clientY - gd.startClientY) / s) * 10) / 10;
      if (gd.mode === 'resize') {
        onMoveGroup?.(gd.groupId, resizeBox(gd.orig, gd.corner ?? 'se', dx, dy));
      } else if (onMoveTables ?? onMoveTable) {
        const members = (groupsRef.current ?? []).find((g) => g.id === gd.groupId)?.tableIds ?? [];
        const moves: { tableId: string; x: number; y: number }[] = [];
        for (const l of layoutRef.current) {
          if (!members.includes(l.table.id)) continue;
          moves.push({
            tableId: l.table.id,
            x: Math.round((l.x + dx) * 10) / 10,
            y: Math.round((l.y + dy) * 10) / 10,
          });
        }
        if (moves.length > 0) {
          if (onMoveTables) onMoveTables(moves);
          else for (const m of moves) onMoveTable?.(m.tableId, { x: m.x, y: m.y });
        }
        // Rect eksplisit ikut bergeser; turunan mengikuti anggota.
        const g = (groupsRef.current ?? []).find((x) => x.id === gd.groupId);
        if (g && Number.isFinite(g.x) && Number.isFinite(g.y) && Number.isFinite(g.w) && Number.isFinite(g.h)) {
          onMoveGroup?.(gd.groupId, {
            x: Math.round((gd.orig.x + dx) * 10) / 10,
            y: Math.round((gd.orig.y + dy) * 10) / 10,
            w: gd.orig.w,
            h: gd.orig.h,
          });
        }
      }
      suppressRelClickRef.current = true;
      window.setTimeout(() => {
        suppressRelClickRef.current = false;
      }, 0);
      return;
    }
    if (endNodeDrag(e, false)) return;
    dragStartRef.current = null;
    panCapturedRef.current = null;
    setDragging(false);
  };

  const onPointerCancel = (e: React.PointerEvent<SVGSVGElement>) => {
    // U3: interruption aborts the connect without side effects.
    if (connectDragRef.current && e.pointerId === connectDragRef.current.pointerId) {
      cancelConnect(true);
      return;
    }
    // Geser grup yang terinterupsi dibatalkan tanpa commit.
    if (groupDragRef.current && e.pointerId === groupDragRef.current.pointerId) {
      cancelGroupDrag();
      return;
    }
    pendingTapRef.current = null;
    if (endNodeDrag(e, true)) return;
    dragStartRef.current = null;
    panCapturedRef.current = null;
    setDragging(false);
  };

  const PAN_STEP = 40;

  const handleCanvasKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        e.preventDefault();
        const dir = e.key === 'ArrowLeft' ? -1 : e.key === 'ArrowRight' ? 1 : 0;
        const vert = e.key === 'ArrowUp' ? -1 : e.key === 'ArrowDown' ? 1 : 0;
        setView((v) => ({ ...v, x: v.x - dir * PAN_STEP, y: v.y - vert * PAN_STEP }));
      } else if (e.key === '+' || e.key === '=') {
        e.preventDefault();
        zoomAt(1.2);
      } else if (e.key === '-' || e.key === '_') {
        e.preventDefault();
        zoomAt(1 / 1.2);
      } else if (e.key === '0') {
        e.preventDefault();
        setView({ x: 16, y: 16, s: 1 });
      }
    },
    [zoomAt],
  );

  /** F2-5: per-node keyboard — Arrow nudges + persists, Enter opens, Esc back to canvas. Shift+Enter selects the panel. */
  const handleNodeKeyDown = useCallback(
    (e: React.KeyboardEvent, table: Table) => {
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        e.preventDefault();
        e.stopPropagation();
        if (readOnly || !onMoveTable) return;
        const current = layoutRef.current.find((l) => l.table.id === table.id);
        if (!current) return;
        const step = e.shiftKey ? KB_STEP_LARGE : KB_STEP;
        const dx = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0;
        const dy = e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0;
        const next = { x: Math.round((current.x + dx) * 10) / 10, y: Math.round((current.y + dy) * 10) / 10 };
        onMoveTable(table.id, next);
        setAnnounce(t('schema.erd.nodeMoved', { name: table.name }));
        return;
      }
      // Shift+Enter selects the props panel (click parity); plain Enter still opens the editor.
      // U10: announce +count relasi insiden (snapshot-safe dari state.relations).
      if (e.key === 'Enter' && e.shiftKey) {
        e.preventDefault();
        e.stopPropagation();
        onSelectTable?.(table.id);
        onSelectRelation?.(null);
        if (onSelectTable) setAnnounce(t('schema.panel.tableSelected', { name: table.name, count: incidentCountFor(table.id) }));
        return;
      }
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        e.stopPropagation();
        onOpenTable?.(table.id);
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        setColTip(null);
        setRelTip(null);
        // U4 tiered: a focused node closes the props-panel selection first
        // (focus stays on the canvas); the plain-tab path is unchanged.
        if (panelSelectionOpen && onClosePanelSelection) {
          onClosePanelSelection();
        }
        svgRef.current?.focus();
      }
    },
    [onMoveTable, onOpenTable, onSelectTable, onSelectRelation, readOnly, t, panelSelectionOpen, onClosePanelSelection, incidentCountFor],
  );

  const renderX = (l: ErLayout) => renderPos.get(l.table.id)?.x ?? l.x;
  const renderY = (l: ErLayout) => renderPos.get(l.table.id)?.y ?? l.y;

  const tipTable = colTip ? layout.find((l) => l.table.id === colTip.tableId)?.table ?? null : null;
  const tipCol = tipTable?.columns.find((c) => c.id === colTip?.columnId) ?? null;
  const tipUnique = tipTable && tipCol ? isUniqueIndex(tipTable.indexes, tipCol.name) : false;
  // Ronde 3: relation tooltip data (label + cardinality + onDelete).
  const tipRel = relTip ? state.relations.find((r) => r.id === relTip.relationId) ?? null : null;
  const tipRelTables = tipRel
    ? {
        fromTable: layout.find((l) => l.table.id === tipRel.fromTableId)?.table ?? null,
        toTable: layout.find((l) => l.table.id === tipRel.toTableId)?.table ?? null,
      }
    : null;
  const tipRelFromCol = tipRelTables?.fromTable?.columns.find((c) => c.id === tipRel?.fromColumnId) ?? null;
  const tipRelToCol = tipRelTables?.toTable?.columns.find((c) => c.id === tipRel?.toColumnId) ?? null;
  const tipRelLabel =
    tipRel && tipRelTables?.fromTable && tipRelTables?.toTable && tipRelFromCol && tipRelToCol
      ? relationLabel(
          tipRelTables.fromTable.name,
          tipRelFromCol.name,
          tipRelTables.toTable.name,
          tipRelToCol.name,
        )
      : null;
  const tipAnchor = colTip ?? relTip;

  return (
    <div
      ref={canvasRef}
      className={`erd-canvas${dragging ? ' dragging' : ''}${pendingSource ? ' erd-connect-armed' : ''}`}
      style={pendingSource ? { cursor: 'crosshair' } : undefined}
      onKeyDown={handleCanvasEscape}
      onScroll={() => clearTips()}
      onPointerLeave={() => clearTips()}
    >
      <svg
        ref={svgRef}
        width="100%"
        height="100%"
        role="group"
        aria-label={t('schema.erd.svgAria', { tables: state.tables.length, relations: state.relations.length })}
        tabIndex={0}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        onKeyDown={handleCanvasKeyDown}
        onClick={(e) => {
          if (suppressRelClickRef.current) {
            suppressRelClickRef.current = false;
            return;
          }
          // Tap di dalam bounds grup (teratas dulu) = seleksi grup itu;
          // klik kosong di luar semua grup = bersihkan semua seleksi.
          const world = toWorld(e.clientX, e.clientY, e.currentTarget);
          const hit = [...groupBoxes].reverse().find(
            (b) => world.x >= b.x && world.x <= b.x + b.w && world.y >= b.y && world.y <= b.y + b.h,
          );
          onSelectTable?.(null);
          onSelectRelation?.(null);
          setSelectedGroupId(hit ? hit.group.id : null);
        }}
        onDoubleClick={(e) => {
          // U2 canvas-only: empty-background dblclick opens NewTable at the
          // click point (world coords). Node/relation dblclicks stop
          // propagation below, so reaching here means background. Plain ERD
          // tab omits onDoubleClickEmpty → behaviour unchanged.
          if (readOnly || !onDoubleClickEmpty) return;
          const svg = e.currentTarget;
          const world = toWorld(e.clientX, e.clientY, svg);
          // Belt-and-suspenders: ignore dblclicks landing on a node even if
          // stopPropagation was missed (e.g. synthetic test events).
          const tolWorld = HIT_TOLERANCE_PX / Math.max(MIN_ZOOM, viewRef.current.s);
          if (hitTestNode(world.x, world.y, tolWorld)) return;
          onDoubleClickEmpty({ x: round1(world.x), y: round1(world.y) });
        }}
      >
        <defs>
          <marker
            id="erd-arrow"
            viewBox="0 0 10 10"
            refX="8"
            refY="5"
            markerWidth="7"
            markerHeight="7"
            orient="auto-start-reverse"
          >
            <path d="M0,0 L10,5 L0,10 z" className="erd-arrow-head" />
          </marker>
        </defs>
        <g transform={`translate(${view.x},${view.y}) scale(${view.s})`}>
          {groupBoxes.map(({ group, x, y, w, h }) => {
            const stroke = normalizeHeaderColor(group.color ?? null);
            const labelFill = stroke ? headerTitleColor(stroke) : null;
            const selected = selectedGroupId === group.id;
            const corners: { id: GroupCorner; cx: number; cy: number; cursor: string }[] = [
              { id: 'nw', cx: x, cy: y, cursor: 'nwse-resize' },
              { id: 'ne', cx: x + w, cy: y, cursor: 'nesw-resize' },
              { id: 'sw', cx: x, cy: y + h, cursor: 'nesw-resize' },
              { id: 'se', cx: x + w, cy: y + h, cursor: 'nwse-resize' },
            ];
            return (
              <g
                key={group.id}
                className={`erd-group${canDragGroups ? ' erd-group-draggable' : ''}${selected ? ' erd-group-selected' : ''}`}
                aria-hidden="true"
              >
                <rect
                  x={x}
                  y={y}
                  width={w}
                  height={h}
                  rx={10}
                  className="erd-group-box"
                  style={stroke ? { stroke, fill: stroke } : undefined}
                  onPointerDown={canDragGroups ? (e) => startGroupDrag(e, group.id) : undefined}
                  onClick={(e) => {
                    if (suppressRelClickRef.current) return;
                    e.stopPropagation();
                    onSelectTable?.(null);
                    onSelectRelation?.(null);
                    setSelectedGroupId(group.id);
                  }}
                />
                <text
                  x={x + 12}
                  y={y + 22}
                  className="erd-group-label"
                  style={
                    stroke && labelFill
                      ? { fill: labelFill, paintOrder: 'stroke', stroke, strokeWidth: 14, strokeLinejoin: 'round', strokeOpacity: 0.25 }
                      : undefined
                  }
                  onPointerDown={canDragGroups ? (e) => startGroupDrag(e, group.id) : undefined}
                  onClick={(e) => {
                    if (suppressRelClickRef.current) return;
                    e.stopPropagation();
                    onSelectTable?.(null);
                    onSelectRelation?.(null);
                    setSelectedGroupId(group.id);
                  }}
                >
                  {truncate(group.name.trim() !== '' ? group.name : 'Area', 28)}
                </text>
                {selected &&
                  canDragGroups &&
                  corners.map((c) => (
                    <circle
                      key={c.id}
                      cx={c.cx}
                      cy={c.cy}
                      r={6}
                      className="erd-group-handle"
                      style={{ cursor: c.cursor }}
                      onPointerDown={(e) => startGroupResize(e, group.id, c.id)}
                    />
                  ))}
              </g>
            );
          })}
          {state.relations.map((rel) => {
            const ft = layout.find((l) => l.table.id === rel.fromTableId);
            const tt = layout.find((l) => l.table.id === rel.toTableId);
            const fc = ft?.table.columns.find((c) => c.id === rel.fromColumnId);
            const tc = tt?.table.columns.find((c) => c.id === rel.toColumnId);
            if (!ft || !tt || !fc || !tc) return null;
            // Relations follow the rendered (preview-inclusive) node positions.
            const ftx = renderX(ft);
            const fty = renderY(ft);
            const ttx = renderX(tt);
            const tty = renderY(tt);
            const fx = ftx + TABLE_W;
            const fy = fty + columnY(ft.table, fc);
            const tx = ttx;
            const ty = tty + columnY(tt.table, tc);
            const mx = (fx + tx) / 2;
            const pts = `${fx},${fy} ${mx},${fy} ${mx},${ty} ${tx},${ty}`;
            const relTipActive = relTip?.relationId === rel.id;
            const isRelSelected = selectedRelationId === rel.id;
            // U8: incident terhadap selectedTableId -> connected, sisanya redup saat fokus aktif.
            const isIncident = connectedRelIds.has(rel.id);
            const isDimRel = hasFocusSelection && !isIncident;
            // U9: overlay flow hanya untuk insiden; reverse bila terpilih == sisi `to`.
            const showFlow = hasFocusSelection && isIncident;
            const flowReverse = showFlow && rel.toTableId === selectedTableId;
            return (
              <g
                key={rel.id}
                ref={(el) => {
                  if (el) relRefs.current.set(rel.id, el);
                  else relRefs.current.delete(rel.id);
                }}
                className={`erd-rel${isRelSelected ? ' erd-rel-selected' : ''}${isIncident ? ' erd-rel-connected' : ''}${isDimRel ? ' erd-rel-dim' : ''}`}
                role="button"
                tabIndex={0}
                aria-label={t('schema.erd.relAria', {
                  from: `${ft.table.name}.${fc.name}`,
                  to: `${tt.table.name}.${tc.name}`,
                })}
                aria-current={isRelSelected ? ('true' as const) : undefined}
                aria-describedby={relTipActive ? 'erd-col-tip' : undefined}
                onMouseEnter={(e) => showRelTip(rel.id, cursorToCanvas(e.clientX, e.clientY))}
                onMouseMove={(e) => {
                  if (relTip?.relationId === rel.id) showRelTip(rel.id, cursorToCanvas(e.clientX, e.clientY));
                }}
                onMouseLeave={() => setRelTip(null)}
                onFocus={() => showRelTip(rel.id)}
                onBlur={() => setRelTip(null)}
                onClick={(e) => {
                  if (suppressRelClickRef.current) {
                    suppressRelClickRef.current = false;
                    return;
                  }
                  e.stopPropagation();
                  // Ronde 4 ITEM 3: tanpa popover — hanya lift seleksi + announce
                  // (panel varian relasi sudah punya Delete).
                  onSelectRelation?.(rel.id);
                  onSelectTable?.(null);
                  setSelectedGroupId(null);
                  if (onSelectRelation) {
                    setAnnounce(t('schema.panel.relationSelected', { label: relationLabel(ft.table.name, fc.name, tt.table.name, tc.name) }));
                  }
                }}
                onDoubleClick={(e) => {
                  // U2: a line dblclick is not empty background.
                  e.stopPropagation();
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    e.stopPropagation();
                    // Ronde 4 ITEM 3: keyboard sama seperti klik (tanpa popover).
                    onSelectRelation?.(rel.id);
                    onSelectTable?.(null);
                    if (onSelectRelation) {
                      setAnnounce(t('schema.panel.relationSelected', { label: relationLabel(ft.table.name, fc.name, tt.table.name, tc.name) }));
                    }
                  }
                }}
              >
                <polyline points={pts} fill="none" stroke="transparent" strokeWidth={14} className="erd-rel-hit" />
                <polyline points={pts} fill="none" className="erd-rel-line" />
                {showFlow && (
                  <polyline
                    points={pts}
                    fill="none"
                    aria-hidden="true"
                    className={`erd-rel-flow${flowReverse ? ' erd-rel-flow-reverse' : ''}`}
                  />
                )}
                <text x={mx} y={(fy + ty) / 2 - 6} className="erd-cardinality" textAnchor="middle">
                  {rel.cardinality}
                </text>
              </g>
            );
          })}
          {layout.map((l) => {
            const table = l.table;
            const isHighlighted = highlightId === table.id;
            const isDragging = nodeDraggingId === table.id && dragPreview?.tableId === table.id;
            const isSelected = selectedTableId === table.id;
            // U8: neighbor vs redup saat ada fokus tabel (selectedTableId).
            const isNeighbor = neighborTableIds.has(table.id);
            const isDimNode = hasFocusSelection && !isSelected && !isNeighbor;
            const x = renderX(l);
            const y = renderY(l);
            // U7: header berwarna — 2 rect + text (inline fill, fallback CSS saat Default).
            const customFill = headerFill((table as Table).color ?? null);
            const customTitle = customFill ? headerTitleColor(customFill) : null;
            return (
              <g
                key={table.id}
                ref={(el) => {
                  if (el) nodeRefs.current.set(table.id, el);
                  else nodeRefs.current.delete(table.id);
                }}
                role="button"
                tabIndex={0}
                aria-label={t('schema.erd.tableAria', { name: table.name, count: table.columns.length })}
                aria-disabled={readOnly && !presenting || undefined}
                aria-current={isSelected ? ('true' as const) : undefined}
                className={`erd-node${isHighlighted ? ' erd-table-highlight' : ''}${isDragging ? ' erd-node-dragging' : ''}${isSelected ? ' erd-node-selected' : ''}${isNeighbor ? ' erd-node-neighbor' : ''}${isDimNode ? ' erd-node-dim' : ''}`}
                data-table-id={table.id}
                data-dragging={isDragging || undefined}
                style={{ transform: `translate(${x}px, ${y}px)` }}
                onKeyDown={(e) => handleNodeKeyDown(e, table)}
                onClick={(e) => {
                  if (suppressRelClickRef.current) return;
                  e.stopPropagation();
                  // U4: click without drag selects the table for the canvas
                  // props panel. Announce instead of stealing focus.
                  // U10: sertakan +count relasi insiden.
                  onSelectTable?.(table.id);
                  onSelectRelation?.(null);
                  setSelectedGroupId(null);
                  if (onSelectTable) setAnnounce(t('schema.panel.tableSelected', { name: table.name, count: incidentCountFor(table.id) }));
                }}
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  if (!readOnly) onOpenTable?.(table.id);
                }}
              >
                <rect width={TABLE_W} height={l.h} rx={8} className="erd-table-body" />
                <rect
                  width={TABLE_W}
                  height={HEADER_H}
                  rx={8}
                  className="erd-table-header"
                  style={customFill ? { fill: customFill } : undefined}
                />
                <rect
                  y={HEADER_H - 8}
                  width={TABLE_W}
                  height={8}
                  className="erd-table-header"
                  style={customFill ? { fill: customFill } : undefined}
                />
                <text x={12} y={20} className="erd-table-title" style={customTitle ? { fill: customTitle } : undefined}>
                  {truncate(table.name, 24)}
                </text>
                {table.columns.map((c) => {
                  const armed =
                    pendingSource?.tableId === table.id && pendingSource?.columnId === c.id;
                  const connectLabel = t('schema.erd.connectFrom', { table: table.name, column: c.name });
                  const tipActive = colTip?.tableId === table.id && colTip?.columnId === c.id;
                  return (
                    <g
                      key={c.id}
                      transform={`translate(0,${HEADER_H + table.columns.indexOf(c) * ROW_H})`}
                      aria-label={`${c.name} ${c.type}${c.primaryKey ? ' PK' : ''}${c.nullable ? '' : ' NOT NULL'}`}
                      aria-describedby={tipActive ? 'erd-col-tip' : undefined}
                      data-connect-col={`${table.id}:${c.id}`}
                      onMouseEnter={(e) => showColTip(table.id, c.id, cursorToCanvas(e.clientX, e.clientY))}
                      onMouseMove={(e) => showColTip(table.id, c.id, cursorToCanvas(e.clientX, e.clientY))}
                      onMouseLeave={() => setColTip(null)}
                      onFocus={() => showColTip(table.id, c.id)}
                      onBlur={() => setColTip(null)}
                    >
                      {/* Ronde 4 ITEM 4: hit rect full-row agar celah antar teks ikut hover. */}
                      <rect
                        x={0}
                        y={0}
                        width={TABLE_W}
                        height={ROW_H}
                        fill="transparent"
                        style={{ pointerEvents: 'all' }}
                        aria-hidden="true"
                      />
                      {c.primaryKey && <circle cx={10} cy={ROW_H / 2} r={2.5} className="erd-pk" />}
                      <text x={22} y={14} className="erd-col-name">
                        {truncate(c.name, 20)}
                      </text>
                      <text x={TABLE_W - 10} y={14} className="erd-col-type" textAnchor="end">
                        {truncate(c.type || '—', 16)}
                      </text>
                      {!readOnly &&
                        (['left', 'right'] as const).map((side) => (
                          <g
                            key={side}
                            transform={`translate(${side === 'left' ? 0 : TABLE_W},${ROW_H / 2})`}
                            className={`erd-handle${armed ? ' erd-handle-armed' : ''}`}
                            data-handle={`${table.id}:${c.id}:${side}`}
                            data-connect-col={`${table.id}:${c.id}`}
                            role="button"
                            tabIndex={0}
                            aria-label={connectLabel}
                            aria-pressed={armed}
                            data-armed={armed || undefined}
                            onPointerDown={(ev) => onHandlePointerDown(ev, table.id, c.id, side)}
                            onClick={(ev) => {
                              ev.stopPropagation();
                            }}
                            onDoubleClick={(ev) => {
                              ev.stopPropagation();
                            }}
                            onKeyDown={(ev) => onHandleKeyDown(ev, table.id, c.id)}
                          >
                            <circle cx={0} cy={0} r={10} className="erd-handle-hit" />
                            <circle cx={0} cy={0} r={5} className="erd-handle-dot" />
                          </g>
                        ))}
                    </g>
                  );
                })}
              </g>
            );
          })}
          {connectPreview && (
            <g className="erd-connect-temp" aria-hidden="true" style={{ pointerEvents: 'none' }}>
              <line
                x1={connectPreview.fromX}
                y1={connectPreview.fromY}
                x2={connectPreview.toX}
                y2={connectPreview.toY}
                className="erd-rel-line erd-connect-line"
                markerEnd="url(#erd-arrow)"
              />
              <circle cx={connectPreview.toX} cy={connectPreview.toY} r={4} className="erd-handle-dot" />
            </g>
          )}
        </g>
      </svg>
      {((colTip && tipTable && tipCol) || (relTip && tipRel && tipRelLabel)) && tipAnchor && (
        <div
          id="erd-col-tip"
          role="tooltip"
          className="erd-col-tip"
          style={{
            left: `clamp(8px, ${tipAnchor.sx}px, calc(100% - 180px))`,
            top: `clamp(8px, ${tipAnchor.sy}px, calc(100% - 90px))`,
          }}
        >
          {colTip && tipTable && tipCol ? (
            <TooltipCard
              title={tipCol.name}
              description={tipCol.type.trim() !== '' ? tipCol.type : '—'}
            >
              {(tipCol.primaryKey || tipUnique || !tipCol.nullable) && (
                <span className="erd-col-tip-badges">
                  {tipCol.primaryKey && <span className="erd-col-tip-badge erd-col-tip-badge-pk">PK</span>}
                  {tipUnique && <span className="erd-col-tip-badge erd-col-tip-badge-unique">Unique</span>}
                  {!tipCol.nullable && (
                    <span className="erd-col-tip-badge erd-col-tip-badge-notnull">NOT NULL</span>
                  )}
                </span>
              )}
              <div className="erd-col-tip-divider" aria-hidden="true" />
              <div className="erd-col-tip-row">
                <span className="erd-col-tip-label">Default:</span>{' '}
                <span className="erd-col-tip-value font-mono">{tipCol.default ?? '—'}</span>
              </div>
              {tipCol.comment.trim() !== '' && (
                <div className="erd-col-tip-row">
                  <span className="erd-col-tip-label">Comment:</span>{' '}
                  <span className="erd-col-tip-value">{tipCol.comment}</span>
                </div>
              )}
            </TooltipCard>
          ) : (
            tipRel &&
            tipRelLabel && (
              <TooltipCard title={tipRelLabel}>
                <div className="erd-col-tip-divider" aria-hidden="true" />
                <div className="erd-col-tip-row">
                  <span className="erd-col-tip-label">Cardinality:</span>{' '}
                  <span className="erd-col-tip-value font-mono">{tipRel.cardinality}</span>
                </div>
                <div className="erd-col-tip-row">
                  <span className="erd-col-tip-label">On delete:</span>{' '}
                  <span className="erd-col-tip-value font-mono">{tipRel.onDelete}</span>
                </div>
              </TooltipCard>
            )
          )}
        </div>
      )}
      <div role="status" aria-live="polite" className="sr-only">
        {announce}
      </div>
      {state.tables.length === 0 && !readOnly && (
        <div className="erd-empty">
          <div className="empty-state">
            <Graph size={22} aria-hidden="true" />
            <p className="empty-state-title">{t('schema.empty.tablesTitle')}</p>
            <p className="empty-state-desc">{t('schema.erd.emptyDesc')}</p>
            <Button size="sm" onClick={onNewTable}>
              {t('schema.page.newTable')}
            </Button>
          </div>
        </div>
      )}
      {state.tables.length === 0 && readOnly && (
        <div className="erd-empty">
          <div className="empty-state">
            <Graph size={22} aria-hidden="true" />
            <p className="empty-state-title">{t('schema.empty.tablesTitle')}</p>
            <p className="empty-state-desc">{t('schema.viewBanner.noTablesInSnapshot')}</p>
          </div>
        </div>
      )}
      {!presenting && (
      <div className="erd-zoom">
        <Button
          variant="secondary"
          size="sm"
          aria-label={t('schema.erd.zoomIn')}
          title={t('schema.erd.zoomIn')}
          onClick={() => zoomAt(1.2)}
        >
          <MagnifyingGlassPlus size={13} aria-hidden="true" />
        </Button>
        <Button
          variant="secondary"
          size="sm"
          aria-label={t('schema.erd.zoomOut')}
          title={t('schema.erd.zoomOut')}
          onClick={() => zoomAt(1 / 1.2)}
        >
          <MagnifyingGlassMinus size={13} aria-hidden="true" />
        </Button>
        <Button
          variant="secondary"
          size="sm"
          aria-label={t('schema.erd.resetView')}
          title={t('schema.erd.resetView')}
          onClick={() => setView({ x: 16, y: 16, s: 1 })}
        >
          <CornersOut size={13} aria-hidden="true" />
        </Button>
      </div>
      )}
    </div>
  );
}
