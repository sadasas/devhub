import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent } from 'react';
import {
  CornersOut,
  MagnifyingGlassMinus,
  MagnifyingGlassPlus,
  Trash,
} from '@phosphor-icons/react';
import type {
  Issue,
  Task,
  Whiteboard,
  WhiteboardEdge,
  WhiteboardElement,
  WhiteboardShape,
} from '../../lib/types';
import { useProject } from '../../state/project-context';
import { useNavigate } from 'react-router';
import { entityDeepLink } from '../../lib/deep-link';
import { newId } from '../../lib/utils';
import {
  clampPopover,
  elementBounds,
  panBy,
  refCardLayout,
  refCardRect,
  screenToWorld,
  truncateToWidth,
  worldToScreen,
  zoomAtPoint,
  CHIP_CHAR_W,
  REF_LAYOUT,
  type Rect,
  type RefCardBlock,
  type RefCardData,
  type ViewState,
} from './geometry';
import {
  EDGE_TOUCH_TOLERANCE,
  edgeEndpoints,
  elementsAtPoint,
  nearestPortSide,
  pointInRect,
  portPoint,
  portSideToward,
  portToward,
  type EdgeEndpoints,
  type Point,
  type PortSide,
} from './edges';
import {
  buildRef,
  buildShape,
  buildSticky,
  buildStroke,
  buildText,
  drawColor,
  drawWidth,
  shouldCommitStroke,
  type WbTool,
} from './tools';
import { ISSUE_SEVERITY, ISSUE_STATUS, TASK_PRIORITY, TASK_STATUS } from '../../lib/labels';
import { isModalOrPaletteOpen, isTypingTarget } from './shortcuts';
import { WhiteboardPopover } from './WhiteboardPopover';
import { RefPicker } from './RefPicker';
import type { WhiteboardHistory } from './useWhiteboardHistory';

interface WhiteboardCanvasProps {
  board: Whiteboard;
  tool: WbTool;
  history: WhiteboardHistory;
}

const DOT_STEP = 32;
const MIN_ZOOM = 0.3;
const MAX_ZOOM = 3;
const DEFAULT_EDGE_COLOR = '#e4e4e7';
const DEFAULT_EDGE_WIDTH = 2;

function useView(panEnabled: boolean) {
  const [view, setView] = useState<ViewState>({ x: 16, y: 16, s: 1 });
  const [dragging, setDragging] = useState(false);
  const dragStartRef = useRef<{ pointerX: number; pointerY: number; x: number; y: number } | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);

  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
      setView((v) => zoomAtPoint(v, e.clientX - rect.left, e.clientY - rect.top, factor, MIN_ZOOM, MAX_ZOOM));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  const onPointerDown = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (e.button !== 0 || !panEnabled) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    dragStartRef.current = { pointerX: e.clientX, pointerY: e.clientY, x: view.x, y: view.y };
    setDragging(true);
  };

  const onPointerMove = (e: ReactPointerEvent<SVGSVGElement>) => {
    const start = dragStartRef.current;
    if (!start) return;
    setView((v) => panBy(v, e.clientX - start.pointerX, e.clientY - start.pointerY));
  };

  const endDrag = () => {
    dragStartRef.current = null;
    setDragging(false);
  };

  return { view, setView, dragging, onPointerDown, onPointerMove, onPointerUp: endDrag, onPointerCancel: endDrag, ref: svgRef };
}

function shapePath(shape: WhiteboardShape): string {
  const { x, y, w, h } = shape;
  switch (shape.shapeType) {
    case 'diamond':
      return `M ${x + w / 2} ${y} L ${x + w} ${y + h / 2} L ${x + w / 2} ${y + h} L ${x} ${y + h / 2} Z`;
    case 'ellipse':
      return `M ${x + w / 2} ${y} a ${w / 2} ${h / 2} 0 1 0 0.01 0 Z`;
    default:
      return `M ${x} ${y} h ${w} v ${h} h ${-w} Z`;
  }
}

function offsetRect(rect: Rect, offset: { dx: number; dy: number } | null | undefined): Rect {
  if (!offset) return rect;
  return { x: rect.x + offset.dx, y: rect.y + offset.dy, w: rect.w, h: rect.h };
}

interface DragOffset {
  dx: number;
  dy: number;
}

interface EdgeDraft {
  fromId: string;
  fromBounds: Rect;
  cur: Point;
}

interface ElementViewProps {
  el: WhiteboardElement;
  selected?: boolean;
  offset?: DragOffset | null;
  derivedEndpoints?: EdgeEndpoints | null;
  refData?: RefCardData | null;
  collapsed?: boolean;
  bounds?: Rect;
}

const ElementView = memo(function ElementView({
  el,
  selected,
  offset,
  derivedEndpoints,
  refData,
  collapsed = false,
  bounds: boundsProp,
}: ElementViewProps) {
  const outline = (rect: Rect) => (
    <rect
      data-testid="wb-selection"
      x={rect.x}
      y={rect.y}
      width={rect.w}
      height={rect.h}
      fill="none"
      stroke="var(--accent)"
      strokeWidth={1.5}
      strokeDasharray="4 3"
      pointerEvents="none"
    />
  );

  const content = (() => {
    switch (el.kind) {
      case 'stroke': {
        const points = el.points.map((p) => `${p[0]},${p[1]}`).join(' ');
        return (
          <polyline
            points={points}
            fill="none"
            stroke={el.color}
            strokeWidth={el.width}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        );
      }
      case 'sticky': {
        return (
          <g>
            <rect x={el.x} y={el.y} width={el.w} height={el.h} rx={4} fill={el.color} fillOpacity={0.85} />
            {el.text &&
              (() => {
                const fontSize = 12;
                const maxChars = Math.max(8, Math.floor((el.w - 12) / (fontSize * 0.6)));
                const lines = el.text.split('\n').slice(0, 6).map((line) => (line.length > maxChars ? `${line.slice(0, maxChars)}…` : line));
                return lines.map((line, i) => (
                  <text key={i} x={el.x + 6} y={el.y + 14 + i * Math.ceil(fontSize * 1.35)} fontSize={fontSize} fill="rgba(6,5,4,0.85)">
                    {line}
                  </text>
                ));
              })()}
          </g>
        );
      }
      case 'text':
        return (
          <text x={el.x} y={el.y} fontSize={el.fontSize} fill={el.color}>
            {el.text}
          </text>
        );
      case 'shape':
        return (
          <path
            d={shapePath(el)}
            fill={el.fill ? el.color : 'none'}
            fillOpacity={el.fill ? 0.15 : undefined}
            stroke={el.color}
            strokeWidth={el.strokeWidth}
          />
        );
      case 'edge': {
        const ep = derivedEndpoints ?? { x1: el.x1, y1: el.y1, x2: el.x2, y2: el.y2 };
        const dx = ep.x2 - ep.x1;
        const dy = ep.y2 - ep.y1;
        const deg = Math.atan2(dy, dx) * (180 / Math.PI);
        const hasSpan = dx !== 0 || dy !== 0;
        return (
          <g>
            <line x1={ep.x1} y1={ep.y1} x2={ep.x2} y2={ep.y2} stroke={el.color} strokeWidth={el.width} />
            {selected && (
              <line x1={ep.x1} y1={ep.y1} x2={ep.x2} y2={ep.y2} stroke="var(--accent)" strokeWidth={el.width + 3} strokeOpacity={0.3} />
            )}
            {el.arrowhead && hasSpan && (
              <g transform={`translate(${ep.x2},${ep.y2}) rotate(${deg})`}>
                <polygon points="-8,-4 0,0 -8,4" fill="none" stroke={el.color} strokeWidth={el.width} />
              </g>
            )}
          </g>
        );
      }
      case 'ref': {
        const missing = !refData;
        const isCollapsed = missing || collapsed;
        const b = boundsProp ?? elementBounds(el);
        const { x, y, w, h } = b;
        const toggle = REF_LAYOUT.toggle;
        const btnX = x + w - toggle.rightOff;
        const btnY = y + toggle.topOff;
        const btnCx = btnX + toggle.w / 2;
        const btnCy = btnY + toggle.h / 2 + 1;
        const pad = REF_LAYOUT.pad;
        const layout = !missing && !isCollapsed ? refCardLayout(refData!) : null;
        const renderBlock = (blk: RefCardBlock | null, prefix: string, fontSize: number, fill: string, weight?: number) =>
          blk
            ? blk.lines.map((line, i) => (
                <text key={`${prefix}${i}`} x={x + pad} y={y + blk.y + i * blk.step} fontSize={fontSize} fill={fill} fontWeight={weight}>
                  {line}
                </text>
              ))
            : null;
        return (
          <g style={missing ? { pointerEvents: 'none' } : undefined}>
            <rect x={x} y={y} width={w} height={h} rx={6} fill="rgba(110,168,254,0.10)" stroke="#6ea8fe" strokeWidth={1.5} />
            {layout ? (
              <g>
                {renderBlock(layout.title, 't', 12, missing ? '#8a8a93' : '#6ea8fe', 600)}
                {renderBlock(layout.meta, 'm', 10, missing ? '#6b7280' : '#8a8a93')}
                {renderBlock(layout.sub, 's', 10, '#8a8a93')}
                {layout.labelRows.map((row, ri) => {
                  let lx = x + pad;
                  return (
                    <g key={`l${ri}`}>
                      {row.labels.map((label) => {
                        const cw = label.length * CHIP_CHAR_W + 12;
                        const chip = (
                          <g key={label}>
                            <rect x={lx} y={y + row.y - 9} width={cw} height={13} rx={3} fill="rgba(110,168,254,0.18)" />
                            <text x={lx + 6} y={y + row.y} fontSize={9} fill="#8a8a93">
                              {label}
                            </text>
                          </g>
                        );
                        lx += cw + 4;
                        return chip;
                      })}
                    </g>
                  );
                })}
                {renderBlock(layout.counts, 'c', 10, '#8a8a93')}
                {renderBlock(layout.desc, 'd', 10, '#6b7280')}
              </g>
            ) : (
              <g>
                <text x={x + pad} y={y + pad + 13} fontSize={12} fill={missing ? '#8a8a93' : '#6ea8fe'} fontWeight={600}>
                  {truncateToWidth(missing ? `untitled ${el.entity}` : refData!.title, 12, w - pad * 2 - toggle.rightOff)}
                </text>
                <text x={x + pad} y={y + pad + REF_LAYOUT.titleH + 10} fontSize={10} fill={missing ? '#6b7280' : '#8a8a93'}>
                  {missing ? 'Deleted' : refData!.meta}
                </text>
              </g>
            )}
            {!missing && (
              <g>
                <rect x={btnX} y={btnY} width={toggle.w} height={toggle.h} rx={4} fill="rgba(110,168,254,0.25)" stroke="#6ea8fe" strokeWidth={1} />
                <text x={btnCx} y={btnCy} fontSize={11} fill="#6ea8fe" textAnchor="middle">
                  {isCollapsed ? '+' : '−'}
                </text>
              </g>
            )}
          </g>
        );
      }
      default:
        return null;
    }
  })();

  const withOffset = (node: React.ReactNode) =>
    offset ? (
      <g transform={`translate(${offset.dx} ${offset.dy})`}>{node}</g>
    ) : (
      node
    );

  return withOffset(
    <g>
      {content}
      {selected && el.kind !== 'edge' && el.kind !== 'stroke' && outline(boundsProp ?? elementBounds(el))}
    </g>,
  );
});

interface DraftStroke {
  tool: 'pen' | 'eraser';
  points: Array<[number, number]>;
}

interface PopoverState {
  id: string;
  kind: 'text' | 'sticky' | 'shape';
  wx: number;
  wy: number;
  el: WhiteboardElement;
}

export function WhiteboardCanvas({ board, tool, history }: WhiteboardCanvasProps) {
  const { canEdit, dispatch, projectId, state } = useProject();
  const navigate = useNavigate();

  const openRef = useCallback(
    (entity: 'tasks' | 'issues', entityId: string) => {
      navigate(entityDeepLink(projectId, entity, entityId));
    },
    [navigate, projectId],
  );
  const [spaceHeld, setSpaceHeld] = useState(false);
  const panEnabled = tool === 'select' || spaceHeld;
  const view = useView(panEnabled);
  const isPlaceTool = tool === 'text' || tool === 'sticky' || tool === 'shape';

  const [draft, setDraft] = useState<DraftStroke | null>(null);
  const draftRef = useRef<DraftStroke | null>(null);
  const [popover, setPopover] = useState<PopoverState | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const [popoverPos, setPopoverPos] = useState<{ x: number; y: number } | null>(null);
  useLayoutEffect(() => {
    if (!popover) {
      setPopoverPos(null);
      return;
    }
    const raw = worldToScreen(view.view, popover.wx, popover.wy + 50);
    const node = popoverRef.current;
    const host = node?.parentElement;
    if (node && host) {
      const pr = node.getBoundingClientRect();
      const cr = host.getBoundingClientRect();
      if (pr.width > 0 && pr.height > 0 && cr.width > 0 && cr.height > 0) {
        setPopoverPos(clampPopover(raw, cr.width, cr.height, pr.width, pr.height));
        return;
      }
    }
    setPopoverPos(raw);
  }, [popover, view.view]);
  const placeStartRef = useRef<{ clientX: number; clientY: number } | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [dragOffset, setDragOffset] = useState<DragOffset | null>(null);
  const dragRef = useRef<{ startWorld: Point; originals: Map<string, WhiteboardElement> } | null>(null);
  const [edgeDraft, setEdgeDraft] = useState<EdgeDraft | null>(null);
  const edgeDraftRef = useRef<EdgeDraft | null>(null);
  const [refPending, setRefPending] = useState<Point | null>(null);
  const [collapsedRefs, setCollapsedRefs] = useState<ReadonlySet<string>>(() => new Set());

  const toggleCollapse = useCallback((id: string) => {
    setCollapsedRefs((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const byId = useMemo(() => new Map(board.elements.map((el) => [el.id, el])), [board.elements]);

  const refDataMap = useMemo(() => {
    const m = new Map<string, RefCardData | null>();
    const tasks = state?.tasks ?? [];
    const issues = state?.issues ?? [];
    const milestones = state?.milestones ?? [];
    const testCases = state?.testCases ?? [];
    for (const el of board.elements) {
      if (el.kind !== 'ref') continue;
      const row = (el.entity === 'tasks' ? tasks : issues).find((r) => r.id === el.entityId);
      if (!row) {
        m.set(el.id, null);
        continue;
      }
      if (el.entity === 'tasks') {
        const t = row as Task;
        const milestone = t.milestoneId ? milestones.find((ms) => ms.id === t.milestoneId) : undefined;
        const blockers = (t.blockedBy ?? []).filter((id) => tasks.some((x) => x.id === id)).length;
        const tests = testCases.filter((tc) => tc.taskId === t.id).length;
        const counts: string[] = [];
        if (blockers > 0) counts.push(`${blockers} blocked`);
        if (tests > 0) counts.push(`${tests} tests`);
        m.set(el.id, {
          title: t.title,
          meta: `${TASK_STATUS[t.status].label} · ${TASK_PRIORITY[t.priority].label}`,
          sub: milestone ? milestone.name : undefined,
          labels: t.labels ?? [],
          hours: t.estimate != null || t.actualHours != null ? `${t.actualHours ?? 0}/${t.estimate ?? '—'}h` : undefined,
          counts,
          description: t.description ?? '',
        });
      } else {
        const iss = row as Issue;
        const linked = iss.linkedTaskId ? tasks.find((t) => t.id === iss.linkedTaskId) : undefined;
        m.set(el.id, {
          title: iss.title,
          meta: `${ISSUE_SEVERITY[iss.severity].label} · ${ISSUE_STATUS[iss.status].label}`,
          sub: linked ? linked.title : undefined,
          labels: [],
          hours: undefined,
          counts: [],
          description: iss.description ?? '',
        });
      }
    }
    return m;
  }, [board.elements, state]);

  const refRects = useMemo(() => {
    const m = new Map<string, Rect>();
    for (const el of board.elements) {
      if (el.kind !== 'ref') continue;
      m.set(el.id, refCardRect(el, refDataMap.get(el.id) ?? null, collapsedRefs.has(el.id)));
    }
    return m;
  }, [board.elements, refDataMap, collapsedRefs]);

  const boundsFor = useCallback(
    (el: WhiteboardElement): Rect => {
      if (el.kind === 'ref') return refRects.get(el.id) ?? elementBounds(el);
      return elementBounds(el);
    },
    [refRects],
  );

  const derivedEdges = useMemo(() => {
    const map = new Map<string, EdgeEndpoints>();
    for (const el of board.elements) {
      if (el.kind !== 'edge' || !el.sourceNodeId || !el.targetNodeId) continue;
      const src = byId.get(el.sourceNodeId);
      const dst = byId.get(el.targetNodeId);
      if (!src || !dst) continue;
      const srcOff = selectedIds.includes(el.sourceNodeId) ? dragOffset : null;
      const dstOff = selectedIds.includes(el.targetNodeId) ? dragOffset : null;
      const sb = offsetRect(boundsFor(src), srcOff);
      const tb = offsetRect(boundsFor(dst), dstOff);
      const sc = { x: sb.x + sb.w / 2, y: sb.y + sb.h / 2 };
      const tc = { x: tb.x + tb.w / 2, y: tb.y + tb.h / 2 };
      const p1 = el.sourcePort ? portPoint(sb, el.sourcePort) : portToward(sb, tc);
      const p2 = el.targetPort ? portPoint(tb, el.targetPort) : portToward(tb, sc);
      map.set(el.id, { x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y });
    }
    return map;
  }, [board.elements, byId, boundsFor, selectedIds, dragOffset]);

  const removeSelection = useCallback(() => {
    if (selectedIds.length === 0) return;
    const sel = new Set(selectedIds);
    const next = board.elements.filter((el) => {
      if (sel.has(el.id)) return false;
      if (el.kind === 'edge' && ((el.sourceNodeId && sel.has(el.sourceNodeId)) || (el.targetNodeId && sel.has(el.targetNodeId)))) {
        return false;
      }
      return true;
    });
    setCollapsedRefs((prev) => {
      const keep = new Set<string>();
      for (const el of next) if (el.kind === 'ref' && prev.has(el.id)) keep.add(el.id);
      return keep.size === prev.size ? prev : keep;
    });
    history.record();
    dispatch({ type: 'whiteboard/update', id: board.id, patch: { elements: next } });
    setSelectedIds([]);
    setDragOffset(null);
  }, [board.id, board.elements, dispatch, history, selectedIds]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target) || isModalOrPaletteOpen()) return;
      if (e.code === 'Space' || e.key === ' ') {
        e.preventDefault();
        setSpaceHeld(true);
        return;
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedIds.length === 0) return;
        e.preventDefault();
        removeSelection();
        return;
      }
      if (e.key === 'Escape') {
        setSelectedIds([]);
        setDragOffset(null);
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.key === ' ') setSpaceHeld(false);
    };
    const onBlur = () => setSpaceHeld(false);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
    };
  }, [selectedIds, removeSelection]);

  useEffect(() => {
    if (tool !== 'select') {
      setPopover(null);
      setSelectedIds([]);
      setDragOffset(null);
    }
  }, [tool]);

  const worldAt = (e: ReactPointerEvent<SVGSVGElement>): Point => {
    const rect = e.currentTarget.getBoundingClientRect();
    return screenToWorld(view.view, e.clientX - rect.left, e.clientY - rect.top);
  };

  const startDraw = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const pt = worldAt(e);
    const next: DraftStroke = { tool: tool as 'pen' | 'eraser', points: [[pt.x, pt.y]] };
    draftRef.current = next;
    setDraft(next);
  };

  const moveDraw = (e: ReactPointerEvent<SVGSVGElement>) => {
    const current = draftRef.current;
    if (!current) return;
    const pt = worldAt(e);
    const next = { ...current, points: [...current.points, [pt.x, pt.y] as [number, number]] };
    draftRef.current = next;
    setDraft(next);
  };

  const endDraw = () => {
    const current = draftRef.current;
    draftRef.current = null;
    setDraft(null);
    if (!current || !shouldCommitStroke(current.points)) return;
    history.record();
    dispatch({
      type: 'whiteboard/update',
      id: board.id,
      patch: { elements: [...board.elements, buildStroke(current.tool, current.points)] },
    });
  };

  const cancelDraw = () => {
    draftRef.current = null;
    setDraft(null);
  };

  const placeElement = () => {
    const start = placeStartRef.current;
    placeStartRef.current = null;
    if (!start || tool !== 'text' && tool !== 'sticky' && tool !== 'shape') return;
    const rect = view.ref.current?.getBoundingClientRect();
    if (!rect) return;
    const pt = screenToWorld(view.view, start.clientX - rect.left, start.clientY - rect.top);
    const placed = tool === 'sticky' ? buildSticky(pt.x, pt.y) : tool === 'shape' ? buildShape(pt.x, pt.y) : buildText(pt.x, pt.y);
    history.record();
    dispatch({ type: 'whiteboard/update', id: board.id, patch: { elements: [...board.elements, placed] } });
    setPopover({ id: placed.id, kind: placed.kind === 'shape' ? 'shape' : placed.kind === 'text' ? 'text' : 'sticky', wx: pt.x, wy: pt.y, el: placed });
  };

  const patchElement = (patch: Record<string, unknown>) => {
    if (!popover) return;
    const id = popover.id;
    const next = board.elements.map((el) => (el.id === id ? ({ ...el, ...patch } as WhiteboardElement) : el));
    setPopover((p) => (p ? { ...p, el: { ...p.el, ...patch } as WhiteboardElement } : p));
    history.record();
    dispatch({ type: 'whiteboard/update', id: board.id, patch: { elements: next } });
  };

  const closePopover = (save: boolean) => {
    if (!popover) return;
    const el = popover.el;
    const canHaveText = el.kind === 'text' || el.kind === 'sticky';
    if (!save && canHaveText && el.text === '') {
      const next = board.elements.filter((item) => item.id !== popover.id);
      history.record();
      dispatch({ type: 'whiteboard/update', id: board.id, patch: { elements: next } });
    }
    setPopover(null);
  };

  const commitDrag = () => {
    dragRef.current = null;
    const off = dragOffset;
    setDragOffset(null);
    if (!off || (off.dx === 0 && off.dy === 0)) return;
    const sel = new Set(selectedIds);
    const next = board.elements.map((el) => {
      if (!sel.has(el.id)) return el;
      if (el.kind === 'stroke') {
        return { ...el, points: el.points.map(([x, y]) => [x + off.dx, y + off.dy] as [number, number]) };
      }
      if (el.kind === 'edge') {
        if (el.sourceNodeId || el.targetNodeId) return el;
        return { ...el, x1: el.x1 + off.dx, y1: el.y1 + off.dy, x2: el.x2 + off.dx, y2: el.y2 + off.dy };
      }
      return { ...el, x: el.x + off.dx, y: el.y + off.dy };
    });
    history.record();
    dispatch({ type: 'whiteboard/update', id: board.id, patch: { elements: next } });
  };

  const commitEdge = () => {
    const d = edgeDraftRef.current;
    edgeDraftRef.current = null;
    setEdgeDraft(null);
    if (!d) return;
    const fromEl = board.elements.find((el) => el.id === d.fromId);
    if (!fromEl) return;
    const target = elementsAtPoint(board.elements, d.cur, EDGE_TOUCH_TOLERANCE, refRects);
    if (!target || target.id === d.fromId) return;
    const fromBounds = boundsFor(fromEl);
    const toBounds = boundsFor(target);
    const sourcePort: PortSide = portSideToward(fromBounds, d.cur);
    const targetPort: PortSide = nearestPortSide(d.cur, toBounds) ?? portSideToward(toBounds, d.cur);
    const ep = edgeEndpoints(fromBounds, toBounds, d.cur);
    const edge: WhiteboardEdge = {
      id: newId(),
      kind: 'edge',
      x1: ep.x1,
      y1: ep.y1,
      x2: ep.x2,
      y2: ep.y2,
      color: DEFAULT_EDGE_COLOR,
      width: DEFAULT_EDGE_WIDTH,
      arrowhead: true,
      sourceNodeId: fromEl.id,
      targetNodeId: target.id,
      sourcePort,
      targetPort,
    };
    history.record();
    dispatch({ type: 'whiteboard/update', id: board.id, patch: { elements: [...board.elements, edge] } });
  };

  const placeRef = (entity: 'tasks' | 'issues', entityId: string) => {
    const pt = refPending;
    setRefPending(null);
    if (!pt) return;
    history.record();
    dispatch({
      type: 'whiteboard/update',
      id: board.id,
      patch: { elements: [...board.elements, buildRef(pt.x, pt.y, entity, entityId)] },
    });
  };

  const handlePointerDown = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (e.button !== 0) return;
    const pt = worldAt(e);
    if (spaceHeld || (tool === 'select' && !elementsAtPoint(board.elements, pt, EDGE_TOUCH_TOLERANCE, refRects))) {
      setSelectedIds([]);
      setDragOffset(null);
      view.onPointerDown(e);
      return;
    }
    e.currentTarget.setPointerCapture(e.pointerId);
    if (tool === 'select') {
      const hit = elementsAtPoint(board.elements, pt, EDGE_TOUCH_TOLERANCE, refRects);
      if (!hit) {
        view.onPointerDown(e);
        return;
      }
      if (hit.kind === 'ref' && !e.shiftKey) {
        const b = boundsFor(hit);
        const t = REF_LAYOUT.toggle;
        if (pointInRect(pt, { x: b.x + b.w - t.rightOff, y: b.y + t.topOff, w: t.w, h: t.h })) {
          toggleCollapse(hit.id);
          return;
        }
      }
      let nextSel: string[];
      if (e.shiftKey) {
        nextSel = selectedIds.includes(hit.id) ? selectedIds.filter((id) => id !== hit.id) : [...selectedIds, hit.id];
      } else if (selectedIds.length === 1 && selectedIds[0] === hit.id) {
        nextSel = selectedIds;
      } else {
        nextSel = [hit.id];
      }
      setSelectedIds(nextSel);
      dragRef.current = { startWorld: pt, originals: new Map(board.elements.map((el) => [el.id, el])) };
      setDragOffset(null);
      return;
    }
    if (tool === 'pen' || tool === 'eraser') {
      startDraw(e);
      return;
    }
    if (isPlaceTool) {
      e.currentTarget.setPointerCapture(e.pointerId);
      placeStartRef.current = { clientX: e.clientX, clientY: e.clientY };
      return;
    }
    if (tool === 'edge') {
      const hit = elementsAtPoint(board.elements, pt, EDGE_TOUCH_TOLERANCE, refRects);
      if (!hit || hit.kind === 'edge') return;
      const d: EdgeDraft = { fromId: hit.id, fromBounds: boundsFor(hit), cur: pt };
      edgeDraftRef.current = d;
      setEdgeDraft(d);
      return;
    }
    if (tool === 'ref') {
      setRefPending(pt);
      return;
    }
  };

  const handlePointerMove = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (spaceHeld) {
      view.onPointerMove(e);
      return;
    }
    if (tool === 'select') {
      if (!dragRef.current) return;
      const pt = worldAt(e);
      setDragOffset({ dx: pt.x - dragRef.current.startWorld.x, dy: pt.y - dragRef.current.startWorld.y });
      return;
    }
    if (tool === 'pen' || tool === 'eraser') {
      moveDraw(e);
      return;
    }
    if (tool === 'edge') {
      const d = edgeDraftRef.current;
      if (!d) return;
      const next = { ...d, cur: worldAt(e) };
      edgeDraftRef.current = next;
      setEdgeDraft(next);
      return;
    }
  };

  const handlePointerUp = (_e: ReactPointerEvent<SVGSVGElement>) => {
    if (spaceHeld) {
      view.onPointerUp();
      return;
    }
    if (tool === 'select') {
      commitDrag();
      return;
    }
    if (tool === 'pen' || tool === 'eraser') {
      endDraw();
      return;
    }
    if (isPlaceTool) {
      placeElement();
      return;
    }
    if (tool === 'edge') {
      commitEdge();
      return;
    }
  };

  const handlePointerCancel = (_e: ReactPointerEvent<SVGSVGElement>) => {
    if (spaceHeld) {
      view.onPointerCancel();
      return;
    }
    if (tool === 'select') {
      dragRef.current = null;
      setDragOffset(null);
      return;
    }
    if (tool === 'pen' || tool === 'eraser') {
      cancelDraw();
      return;
    }
    if (isPlaceTool) {
      placeStartRef.current = null;
      return;
    }
    if (tool === 'edge') {
      edgeDraftRef.current = null;
      setEdgeDraft(null);
      return;
    }
  };

  const handleDoubleClick = (e: ReactMouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const pt = screenToWorld(view.view, e.clientX - rect.left, e.clientY - rect.top);
    const hit = elementsAtPoint(board.elements, pt, EDGE_TOUCH_TOLERANCE, refRects);
    if (!hit || hit.kind !== 'ref') return;
    const b = boundsFor(hit);
    const t = REF_LAYOUT.toggle;
    if (pointInRect(pt, { x: b.x + b.w - t.rightOff, y: b.y + t.topOff, w: t.w, h: t.h })) return;
    const rows = state?.[hit.entity] as Array<{ id: string }> | undefined;
    if (!rows?.some((r) => r.id === hit.entityId)) return;
    openRef(hit.entity, hit.entityId);
  };

  const worldViewport = (() => {
    if (!view.ref.current) return null;
    const rect = view.ref.current.getBoundingClientRect();
    const tl = screenToWorld(view.view, 0, 0);
    const br = screenToWorld(view.view, rect.width, rect.height);
    return { x: tl.x, y: tl.y, w: br.x - tl.x, h: br.y - tl.y };
  })();

  return (
    <div className="wb-canvas" role="group" aria-label={`Whiteboard ${board.name} — ${board.elements.length} elements`} tabIndex={0}>
      <svg
        ref={view.ref}
        className={`wb-svg ${view.dragging ? 'dragging' : ''}`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
        onDoubleClick={handleDoubleClick}
      >
        <defs>
          <pattern id="wb-dots" width={DOT_STEP} height={DOT_STEP} patternUnits="userSpaceOnUse">
            <circle cx={1} cy={1} r={1} fill="var(--border-hairline)" />
          </pattern>
        </defs>
        <rect
          x={worldViewport?.x ?? 0}
          y={worldViewport?.y ?? 0}
          width={worldViewport?.w ?? 1000}
          height={worldViewport?.h ?? 800}
          fill="url(#wb-dots)"
        />
        <g transform={`translate(${view.view.x} ${view.view.y}) scale(${view.view.s})`}>
          {board.elements.map((el) => (
            <ElementView
              key={el.id}
              el={el}
              selected={selectedIds.includes(el.id)}
              offset={selectedIds.includes(el.id) ? dragOffset : null}
              derivedEndpoints={derivedEdges.get(el.id) ?? null}
              refData={el.kind === 'ref' ? (refDataMap.get(el.id) ?? null) : undefined}
              collapsed={el.kind === 'ref' ? collapsedRefs.has(el.id) : undefined}
              bounds={el.kind === 'ref' ? refRects.get(el.id) : undefined}
            />
          ))}
          {draft && (
            <polyline
              points={draft.points.map((p) => `${p[0]},${p[1]}`).join(' ')}
              fill="none"
              stroke={drawColor(draft.tool)}
              strokeWidth={drawWidth(draft.tool)}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}
          {edgeDraft &&
            (() => {
              const fromEl = board.elements.find((el) => el.id === edgeDraft.fromId);
              if (!fromEl) return null;
              const hover = elementsAtPoint(board.elements, edgeDraft.cur, EDGE_TOUCH_TOLERANCE, refRects);
              const ep =
                hover && hover.id !== edgeDraft.fromId
                  ? edgeEndpoints(edgeDraft.fromBounds, boundsFor(hover), edgeDraft.cur)
                  : { ...edgeEndpoints(edgeDraft.fromBounds, edgeDraft.fromBounds, edgeDraft.cur), x2: edgeDraft.cur.x, y2: edgeDraft.cur.y };
              const deg = Math.atan2(ep.y2 - ep.y1, ep.x2 - ep.x1) * (180 / Math.PI);
              const hasSpan = ep.x2 !== ep.x1 || ep.y2 !== ep.y1;
              return (
                <g>
                  <line x1={ep.x1} y1={ep.y1} x2={ep.x2} y2={ep.y2} stroke="var(--accent)" strokeWidth={1.5} strokeDasharray="5 4" />
                  {hasSpan && (
                    <g transform={`translate(${ep.x2},${ep.y2}) rotate(${deg})`}>
                      <polygon points="-8,-4 0,0 -8,4" fill="none" stroke="var(--accent)" strokeWidth={1.5} />
                    </g>
                  )}
                </g>
              );
            })()}
        </g>
      </svg>
      <div className="erd-zoom" role="group" aria-label="Canvas zoom">
        <button
          type="button"
          className="erd-zoom-btn"
          title="Zoom in"
          aria-label="Zoom in"
          onClick={() => {
            const el = view.ref.current;
            if (!el) return;
            const rect = el.getBoundingClientRect();
            view.setView((v) => zoomAtPoint(v, rect.width / 2, rect.height / 2, 1.25, MIN_ZOOM, MAX_ZOOM));
          }}
        >
          <MagnifyingGlassPlus size={15} aria-hidden="true" />
        </button>
        <button
          type="button"
          className="erd-zoom-btn"
          title="Zoom out"
          aria-label="Zoom out"
          onClick={() => {
            const el = view.ref.current;
            if (!el) return;
            const rect = el.getBoundingClientRect();
            view.setView((v) => zoomAtPoint(v, rect.width / 2, rect.height / 2, 1 / 1.25, MIN_ZOOM, MAX_ZOOM));
          }}
        >
          <MagnifyingGlassMinus size={15} aria-hidden="true" />
        </button>
        <button
          type="button"
          className="erd-zoom-btn"
          title="Reset view"
          aria-label="Reset view"
          onClick={() => view.setView({ x: 16, y: 16, s: 1 })}
        >
          <CornersOut size={15} aria-hidden="true" />
        </button>
      </div>
      {canEdit && selectedIds.length > 0 && (
        <button
          type="button"
          className="wb-delete-btn"
          title="Delete selected (Del)"
          aria-label="Delete selected"
          onClick={removeSelection}
        >
          <Trash size={15} aria-hidden="true" />
        </button>
      )}
      <span className="wb-hint">Scroll to zoom · drag to pan</span>
      {popover &&
        (() => {
          const pos = popoverPos ?? worldToScreen(view.view, popover.wx, popover.wy + 50);
          return (
            <div ref={popoverRef} className="wb-popover" style={{ left: pos.x, top: pos.y }}>
              <WhiteboardPopover
                el={popover.el}
                onPatch={patchElement}
                onDone={() => closePopover(true)}
                onCancel={() => closePopover(false)}
              />
            </div>
          );
        })()}
      <RefPicker
        open={refPending !== null}
        tasks={state?.tasks ?? []}
        issues={state?.issues ?? []}
        onPick={placeRef}
        onClose={() => setRefPending(null)}
      />
    </div>
  );
}