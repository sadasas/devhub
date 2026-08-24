import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent } from 'react';
import { useTranslation } from 'react-i18next';
import {
  AlignBottom,
  AlignCenterHorizontal,
  AlignCenterVertical,
  AlignLeft,
  AlignRight,
  AlignTop,
  ArrowDown,
  ArrowUp,
  Columns,
  CornersOut,
  Intersect,
  LockSimple,
  LockSimpleOpen,
  MagnetStraight,
  MagnifyingGlassMinus,
  MagnifyingGlassPlus,
  Rows,
  Trash,
  Union,
} from '@phosphor-icons/react';
import type {
  State,
  Whiteboard,
  WhiteboardEdge,
  WhiteboardElement,
  WhiteboardRefEntity,
} from '../../lib/types';
import { useProjectOptional } from '../../state/project-context';
import { useNavigate } from 'react-router';
import { entityDeepLink } from '../../lib/deep-link';
import { newId } from '../../lib/utils';
import {
  alignmentGuides,
  alignSelection,
  clampPopover,
  distributeSelection,
  elementBounds,
  rectsIntersect,
  refCardLayout,
  refCardRect,
  screenToWorld,
  shapePath,
  snapToGrid,
  truncateToWidth,
  textLineHeight,
  unionBounds,
  worldToScreen,
  worldViewportRect,
  wrapTextLines,
  wrapToWidth,
  zoomAtPoint,
  CHIP_CHAR_W,
  REF_LAYOUT,
  type AlignMode,
  type Guide,
  type Rect,
  type RefCardBlock,
  type RefCardData,
  type ViewState,
} from './geometry';
import {
  EDGE_TOUCH_TOLERANCE,
  edgeEndpoints,
  edgeMidpoint,
  effectiveArrowStyle,
  elementsAtPoint,
  eraseStrokes,
  nearestPortSide,
  orthogonalPath,
  pathMidpoint,
  pointInRect,
  portPoint,
  portSideToward,
  portToward,
  type EdgeEndpoints,
  type Point,
  type PortSide,
} from './edges';
import {
  buildBoundary,
  buildRef,
  buildShape,
  buildSticky,
  buildStroke,
  buildText,
  drawColor,
  drawWidth,
  ERASER_WIDTH,
  shouldCommitStroke,
  type WbTool,
} from './tools';
import { isModalOrPaletteOpen, isTypingTarget } from '../../lib/keys';
import { WhiteboardPopover } from './WhiteboardPopover';
import { RefPicker } from './RefPicker';
import { buildRefDataMap } from './ref-data';
import type { WhiteboardHistory } from './useWhiteboardHistory';

interface WhiteboardCanvasProps {
  board: Whiteboard;
  tool: WbTool;
  history: WhiteboardHistory;
  readOnly?: boolean;
  readOnlyState?: State | null;
  readOnlyProjectId?: string;
}

const DOT_STEP = 32;

const TOOL_CURSOR: Record<WbTool, string> = {
  view: 'grab',
  select: 'grab',
  marquee: 'crosshair',
  pen: 'crosshair',
  eraser: 'crosshair',
  text: 'text',
  sticky: 'crosshair',
  shape: 'crosshair',
  edge: 'crosshair',
  ref: 'crosshair',
  boundary: 'crosshair',
};
const MIN_ZOOM = 0.3;
const MAX_ZOOM = 3;
const MAX_ELEMENTS = 1000;
const NO_BOUNDARY: ReadonlySet<string> = new Set(['boundary']);
const RESIZEABLE_KINDS: ReadonlySet<string> = new Set(['shape', 'sticky', 'boundary', 'text']);
const RESIZE_MIN = 20;
const noopDispatch = () => {};
const DEFAULT_EDGE_COLOR = '#e4e4e7';
const DEFAULT_EDGE_WIDTH = 2;

function useView(panEnabled: boolean) {
  const [view, setView] = useState<ViewState>({ x: 16, y: 16, s: 1 });
  const [dragging, setDragging] = useState(false);
  const dragStartRef = useRef<{ pointerX: number; pointerY: number; x: number; y: number } | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const viewRef = useRef(view);
  viewRef.current = view;

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

  // Pinch zoom — two-finger touch gestures take over pan/tool interactions.
  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const pointers = new Map<number, { x: number; y: number }>();
    let pinchStart: { dist: number; cx: number; cy: number; view: ViewState } | null = null;
    let pinching = false;

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
            view: viewRef.current,
          };
          pinching = true;
          dragStartRef.current = null;
          setDragging(false);
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
      const base = zoomAtPoint(pinchStart.view, pinchStart.cx, pinchStart.cy, factor, MIN_ZOOM, MAX_ZOOM);
      setView({ ...base, x: base.x + (cx - pinchStart.cx), y: base.y + (cy - pinchStart.cy) });
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

  const onPointerDown = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (e.button !== 0 || !panEnabled) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    dragStartRef.current = { pointerX: e.clientX, pointerY: e.clientY, x: view.x, y: view.y };
    setDragging(true);
  };

  const onPointerMove = (e: ReactPointerEvent<SVGSVGElement>) => {
    const start = dragStartRef.current;
    if (!start) return;
    setView((v) => ({
      ...v,
      x: start.x + (e.clientX - start.pointerX),
      y: start.y + (e.clientY - start.pointerY),
    }));
  };

  const endDrag = () => {
    dragStartRef.current = null;
    setDragging(false);
  };

  return { view, setView, dragging, onPointerDown, onPointerMove, onPointerUp: endDrag, onPointerCancel: endDrag, ref: svgRef };
}

interface DragOffset {
  dx: number;
  dy: number;
}

/** Applies the drag offset to an edge's endpoints when its nodes are selected. */
function shiftEndpoints(
  ep: EdgeEndpoints | null,
  offset: DragOffset | null,
  selected: ReadonlySet<string> | null,
  el: WhiteboardEdge,
): EdgeEndpoints | null {
  if (!ep || !offset) return ep;
  const off1 = el.sourceNodeId && selected?.has(el.sourceNodeId) ? offset : null;
  const off2 = el.targetNodeId && selected?.has(el.targetNodeId) ? offset : null;
  if (!off1 && !off2) return ep;
  return {
    x1: ep.x1 + (off1 ? off1.dx : 0),
    y1: ep.y1 + (off1 ? off1.dy : 0),
    x2: ep.x2 + (off2 ? off2.dx : 0),
    y2: ep.y2 + (off2 ? off2.dy : 0),
  };
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
  const { t } = useTranslation('extras');
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
        const fontSize = 12;
        const lineHeight = textLineHeight(fontSize);
        const maxLines = Math.max(1, Math.floor((el.h - 8) / lineHeight));
        const innerW = Math.max(24, el.w - 12);
        const lines = wrapTextLines(el.text, fontSize, innerW)
          .slice(0, maxLines)
          .map((line) => truncateToWidth(line, fontSize, innerW));
        const rot = el.rotation ? `rotate(${el.rotation}, ${el.x + el.w / 2}, ${el.y + el.h / 2})` : undefined;
        return (
          <g transform={rot}>
            <rect x={el.x} y={el.y} width={el.w} height={el.h} rx={4} fill={el.color} fillOpacity={0.85} />
            {lines.length > 0 &&
              lines.map((line, i) => (
                <text
                  key={i}
                  x={el.x + 6}
                  y={el.y + 14 + i * lineHeight}
                  fontSize={fontSize}
                  fill="rgba(6,5,4,0.85)"
                >
                  {line}
                </text>
              ))}
          </g>
        );
      }
      case 'text': {
        const fontSize = el.fontSize;
        const rot = el.rotation ? `rotate(${el.rotation}, ${el.x}, ${el.y})` : undefined;
        if (el.w) {
          const lines = wrapTextLines(el.text, fontSize, el.w);
          return (
            <g transform={rot}>
              <text x={el.x} y={el.y} fontSize={fontSize} fill={el.color}>
                {lines.map((line, i) => (
                  <tspan key={i} x={el.x} dy={i === 0 ? 0 : textLineHeight(fontSize)}>
                    {line}
                  </tspan>
                ))}
              </text>
            </g>
          );
        }
        return (
          <g transform={rot}>
            <text x={el.x} y={el.y} fontSize={fontSize} fill={el.color}>
              {el.text}
            </text>
          </g>
        );
      }
      case 'shape': {
        const labelLines = el.label ? wrapToWidth(el.label, 12, Math.max(24, el.w - 12), 4) : [];
        const rot = el.rotation ? `rotate(${el.rotation}, ${el.x + el.w / 2}, ${el.y + el.h / 2})` : undefined;
        return (
          <g transform={rot}>
            <path
              d={shapePath(el)}
              fill={el.fill ? el.color : 'none'}
              fillOpacity={el.fill ? 0.15 : undefined}
              stroke={el.color}
              strokeWidth={el.strokeWidth}
            />
            {labelLines.length > 0 && (
              <text
                className="wb-shape-label"
                x={el.x + el.w / 2}
                y={el.y + el.h / 2}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize={12}
                fill={el.color}
                pointerEvents="none"
              >
                {labelLines.map((line, i) => (
                  <tspan key={i} x={el.x + el.w / 2} dy={i === 0 ? 0 : 14}>
                    {line}
                  </tspan>
                ))}
              </text>
            )}
          </g>
        );
      }
      case 'edge': {
        const ep = derivedEndpoints ?? { x1: el.x1, y1: el.y1, x2: el.x2, y2: el.y2 };
        const path =
          el.sourcePort && el.targetPort
            ? orthogonalPath({ x1: ep.x1, y1: ep.y1, x2: ep.x2, y2: ep.y2 }, el.sourcePort, el.targetPort)
            : null;
        const points = path ?? [
          { x: ep.x1, y: ep.y1 },
          { x: ep.x2, y: ep.y2 },
        ];
        const last = points[points.length - 1]!;
        const prev = points[points.length - 2] ?? last;
        const deg = Math.atan2(last.y - prev.y, last.x - prev.x) * (180 / Math.PI);
        const hasSpan = last.x !== prev.x || last.y !== prev.y;
        const linePoints = points.map((p) => `${p.x},${p.y}`).join(' ');
        const mid = pathMidpoint(points);
        const arrowStyle = effectiveArrowStyle(el);
        const dashArray = (el.dash ?? 'solid') === 'dashed' ? '8 5' : (el.dash ?? 'solid') === 'dotted' ? '2 4' : undefined;
        const arrow =
          arrowStyle !== 'none' && hasSpan ? (
            <g transform={`translate(${last.x},${last.y}) rotate(${deg})`}>
              {arrowStyle === 'open' ? (
                <polygon points="-8,-4 0,0 -8,4" fill="none" stroke={el.color} strokeWidth={el.width} />
              ) : arrowStyle === 'solid' ? (
                <polygon points="-8,-4 0,0 -8,4" fill={el.color} stroke={el.color} strokeWidth={el.width} />
              ) : arrowStyle === 'diamond' ? (
                <polygon points="-8,0 0,-5 8,0 0,5" fill={el.color} stroke="none" />
              ) : (
                <circle r={4} fill={el.color} stroke="none" />
              )}
            </g>
          ) : null;
        return (
          <g>
            <polyline
              points={linePoints}
              fill="none"
              stroke={el.color}
              strokeWidth={el.width}
              strokeDasharray={dashArray}
            />
            {selected && (
              <polyline
                points={linePoints}
                fill="none"
                stroke="var(--accent)"
                strokeWidth={el.width + 3}
                strokeOpacity={0.3}
              />
            )}
            {arrow}
            {el.label && (
              <text
                className="wb-edge-label"
                x={mid.x}
                y={mid.y}
                textAnchor="middle"
                fontSize={11}
                fill={el.color}
                pointerEvents="none"
              >
                {el.label}
              </text>
            )}
          </g>
        );
      }
      case 'boundary':
        return (
          <g>
            <rect
              x={el.x}
              y={el.y}
              width={el.w}
              height={el.h}
              rx={8}
              fill={el.color}
              fillOpacity={0.05}
              stroke={el.color}
              strokeWidth={1.5}
              strokeDasharray="6 4"
            />
            {el.label && (() => {
              const chipW = Math.min(el.label.length * 7.5 + 12, Math.max(20, el.w - 12));
              return (
                <g transform={`translate(${el.x + 6}, ${el.y + 6})`}>
                  <rect
                    x={-4}
                    y={-16}
                    width={chipW}
                    height={18}
                    rx={5}
                    fill={el.color}
                    fillOpacity={0.25}
                  />
                  <text x={0} y={0} fontSize={12} fill="#e4e4e7">
                    {truncateToWidth(el.label, 12, chipW - 12)}
                  </text>
                </g>
              );
            })()}
          </g>
        );
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
                  {truncateToWidth(missing ? t('whiteboard.canvas.refUntitled', { entity: el.entity }) : refData!.title, 12, w - pad * 2 - toggle.rightOff)}
                </text>
                <text x={x + pad} y={y + pad + REF_LAYOUT.titleH + 10} fontSize={10} fill={missing ? '#6b7280' : '#8a8a93'}>
                  {missing ? t('whiteboard.canvas.refDeleted') : refData!.meta}
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
  kind: 'text' | 'sticky' | 'shape' | 'edge' | 'boundary';
  wx: number;
  wy: number;
  el: WhiteboardElement;
}

export function WhiteboardCanvas({ board, tool, history, readOnly = false, readOnlyState = null, readOnlyProjectId }: WhiteboardCanvasProps) {
  const { t } = useTranslation('extras');
  const proj = useProjectOptional(null);
  const { canEdit, dispatch, projectId, state } =
    proj ?? { canEdit: false, dispatch: noopDispatch, projectId: readOnlyProjectId ?? '', state: readOnlyState };
  const navigate = useNavigate();

  const openRef = useCallback(
    (entity: WhiteboardRefEntity, entityId: string) => {
      navigate(entityDeepLink(projectId, entity, entityId));
    },
    [navigate, projectId],
  );
  const [spaceHeld, setSpaceHeld] = useState(false);
  const [snapOn, setSnapOn] = useState(true);
  const snap = useCallback((v: number) => (snapOn ? snapToGrid(v) : v), [snapOn]);
  const [canvasSize, setCanvasSize] = useState({ w: 800, h: 600 });
  const panEnabled = tool === 'select' || tool === 'view' || spaceHeld;
  const view = useView(panEnabled);

  useEffect(() => {
    const el = view.ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const update = () => {
      const r = el.getBoundingClientRect();
      setCanvasSize({ w: r.width, h: r.height });
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [view.ref]);
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
  const panDragRef = useRef(false);
  const [edgeDraft, setEdgeDraft] = useState<EdgeDraft | null>(null);
  const edgeDraftRef = useRef<EdgeDraft | null>(null);
  const [marquee, setMarquee] = useState<{ x1: number; y1: number; x2: number; y2: number; shift: boolean } | null>(null);
  const marqueeRef = useRef<{ x1: number; y1: number; x2: number; y2: number; shift: boolean } | null>(null);
  const [boundaryDraft, setBoundaryDraft] = useState<{ x1: number; y1: number; x2: number; y2: number } | null>(null);
  const [guides, setGuides] = useState<Guide[] | null>(null);
  const [refPending, setRefPending] = useState<Point | null>(null);
  const [collapsedRefs, setCollapsedRefs] = useState<ReadonlySet<string>>(() => new Set());
  const [clipboard, setClipboard] = useState<WhiteboardElement[] | null>(null);
  const [resizePreview, setResizePreview] = useState<{ w: number; h: number } | null>(null);
  const resizeRef = useRef<{ startWorld: Point; startW: number; startH: number; startX: number; startY: number } | null>(null);

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const [viewport, setViewport] = useState<Rect | null>(null);
  useLayoutEffect(() => {
    const el = view.ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) {
      setViewport(null);
      return;
    }
    setViewport(worldViewportRect(view.view, rect.width, rect.height));
  }, [view.view]);

  const toggleCollapse = useCallback((id: string) => {
    setCollapsedRefs((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const byId = useMemo(() => new Map(board.elements.map((el) => [el.id, el])), [board.elements]);

  const refDataMap = useMemo(() => buildRefDataMap(board.elements, state), [board.elements, state]);

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

  const visibleElements = useMemo(() => {
    const sortBack = (els: WhiteboardElement[]) =>
      [...els].sort((a, b) => Number(b.kind === 'boundary') - Number(a.kind === 'boundary'));
    if (!viewport) return sortBack(board.elements);
    return sortBack(board.elements.filter((el) => rectsIntersect(boundsFor(el), viewport)));
  }, [board.elements, boundsFor, viewport]);

  const derivedEdges = useMemo(() => {
    const map = new Map<string, EdgeEndpoints>();
    for (const el of board.elements) {
      if (el.kind !== 'edge' || !el.sourceNodeId || !el.targetNodeId) continue;
      const src = byId.get(el.sourceNodeId);
      const dst = byId.get(el.targetNodeId);
      if (!src || !dst) continue;
      const sb = boundsFor(src);
      const tb = boundsFor(dst);
      const sc = { x: sb.x + sb.w / 2, y: sb.y + sb.h / 2 };
      const tc = { x: tb.x + tb.w / 2, y: tb.y + tb.h / 2 };
      const p1 = el.sourcePort ? portPoint(sb, el.sourcePort) : portToward(sb, tc);
      const p2 = el.targetPort ? portPoint(tb, el.targetPort) : portToward(tb, sc);
      map.set(el.id, { x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y });
    }
    return map;
  }, [board.elements, byId, boundsFor]);

  const edgeDraftHover = useMemo(() => {
    if (!edgeDraft) return null;
    const fromEl = board.elements.find((el) => el.id === edgeDraft.fromId);
    if (!fromEl) return null;
    const hover = elementsAtPoint(board.elements, edgeDraft.cur, EDGE_TOUCH_TOLERANCE, refRects, NO_BOUNDARY);
    return { fromEl, hover };
  }, [board.elements, edgeDraft, refRects]);

  const removeSelection = useCallback(() => {
    if (selectedIds.length === 0) return;
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

  const reorderSelection = useCallback(
    (dir: 1 | -1) => {
      if (selectedIds.length === 0) return;
      const sel = new Set(selectedIds);
      const next = [...board.elements];
      if (dir === 1) {
        for (let i = next.length - 2; i >= 0; i -= 1) {
          if (sel.has(next[i]!.id) && !next[i]!.locked && !sel.has(next[i + 1]!.id) && !next[i + 1]!.locked) {
            [next[i], next[i + 1]] = [next[i + 1]!, next[i]!];
          }
        }
      } else {
        for (let i = 1; i < next.length; i += 1) {
          if (sel.has(next[i]!.id) && !next[i]!.locked && !sel.has(next[i - 1]!.id) && !next[i - 1]!.locked) {
            [next[i], next[i - 1]] = [next[i - 1]!, next[i]!];
          }
        }
      }
      if (next.every((el, i) => el.id === board.elements[i]?.id)) return;
      history.record();
      dispatch({ type: 'whiteboard/update', id: board.id, patch: { elements: next } });
    },
    [board.elements, board.id, dispatch, history, selectedIds],
  );

  const copiedElements = useCallback(() => {
    const sel = new Set(selectedIds);
    return board.elements.filter((el) => {
      if (!sel.has(el.id)) return false;
      if (el.kind === 'edge') {
        return Boolean(el.sourceNodeId && sel.has(el.sourceNodeId) && el.targetNodeId && sel.has(el.targetNodeId));
      }
      return true;
    });
  }, [board.elements, selectedIds]);

  const copySelection = useCallback(() => {
    if (selectedIds.length === 0) return;
    setClipboard(copiedElements());
  }, [copiedElements, selectedIds]);

  const applyPaste = useCallback(
    (source: WhiteboardElement[], offset: number) => {
      if (source.length === 0) return;
      if (board.elements.length + source.length > MAX_ELEMENTS) return;
      const idMap = new Map<string, string>();
      const pasted = source.map((el) => {
        const next = { ...el, id: newId() };
        idMap.set(el.id, next.id);
        return next;
      });
      const placed = pasted.map((el) => {
        if (el.kind === 'edge') {
          return {
            ...el,
            sourceNodeId: el.sourceNodeId ? (idMap.get(el.sourceNodeId) ?? el.sourceNodeId) : el.sourceNodeId,
            targetNodeId: el.targetNodeId ? (idMap.get(el.targetNodeId) ?? el.targetNodeId) : el.targetNodeId,
          };
        }
        if (el.kind === 'stroke') return el;
        return { ...el, x: el.x + offset, y: el.y + offset };
      });
      history.record();
      dispatch({ type: 'whiteboard/update', id: board.id, patch: { elements: [...board.elements, ...placed] } });
      setSelectedIds(placed.map((el) => el.id));
      setClipboard(placed);
    },
    [board.elements, board.id, dispatch, history],
  );

  const pasteElements = useCallback(
    (offset: number) => {
      if (!clipboard || clipboard.length === 0) return;
      applyPaste(clipboard, offset);
    },
    [applyPaste, clipboard],
  );

  const onDistribute = useCallback(
    (axis: 'x' | 'y') => () => {
      const moves = distributeSelection(
        board.elements.map((el) => ({ id: el.id, ...elementBounds(el) })),
        selectedIds,
        axis,
      );
      if (moves.size === 0) return;
      const next = board.elements.map((el) => {
        const pos = moves.get(el.id);
        if (pos === undefined || el.locked) return el;
        if (el.kind === 'edge' || el.kind === 'stroke') return el;
        return { ...el, ...(axis === 'x' ? { x: pos } : { y: pos }) };
      });
      history.record();
      dispatch({ type: 'whiteboard/update', id: board.id, patch: { elements: next } });
    },
    [board.elements, board.id, dispatch, history, selectedIds],
  );

  const onAlign = useCallback(
    (mode: AlignMode) => () => {
      const moves = alignSelection(
        board.elements.map((el) => ({ id: el.id, ...elementBounds(el) })),
        selectedIds,
        mode,
      );
      if (moves.size === 0) return;
      const next = board.elements.map((el) => {
        const pos = moves.get(el.id);
        if (pos === undefined || el.locked) return el;
        if (el.kind === 'edge' || el.kind === 'stroke') return el;
        return { ...el, x: pos.x, y: pos.y };
      });
      history.record();
      dispatch({ type: 'whiteboard/update', id: board.id, patch: { elements: next } });
    },
    [board.elements, board.id, dispatch, history, selectedIds],
  );

  const onToggleLock = useCallback(() => {
    if (selectedIds.length === 0) return;
    const sel = new Set(selectedIds);
    const selected = board.elements.filter((el) => sel.has(el.id) && el.kind !== 'stroke');
    if (selected.length === 0) return;
    const target = !selected.some((el) => el.locked);
    const next = board.elements.map((el) =>
      sel.has(el.id) && el.kind !== 'stroke' ? ({ ...el, locked: target } as WhiteboardElement) : el,
    );
    history.record();
    dispatch({ type: 'whiteboard/update', id: board.id, patch: { elements: next } });
  }, [board.elements, board.id, dispatch, history, selectedIds]);

  const onGroup = useCallback(() => {
    const members = board.elements.filter((el) => selectedIds.includes(el.id) && !el.groupId && el.kind !== 'stroke');
    if (members.length < 2) return;
    const gid = newId();
    const next = board.elements.map((el) => (members.includes(el) ? ({ ...el, groupId: gid } as WhiteboardElement) : el));
    history.record();
    dispatch({ type: 'whiteboard/update', id: board.id, patch: { elements: next } });
  }, [board.elements, board.id, dispatch, history, selectedIds]);

  const onUngroup = useCallback(() => {
    const gids = new Set(
      board.elements.filter((el) => selectedIds.includes(el.id) && el.groupId).map((el) => el.groupId) as string[],
    );
    if (gids.size === 0) return;
    const next = board.elements.map((el) =>
      el.groupId && gids.has(el.groupId) ? ({ ...el, groupId: null } as WhiteboardElement) : el,
    );
    history.record();
    dispatch({ type: 'whiteboard/update', id: board.id, patch: { elements: next } });
  }, [board.elements, board.id, dispatch, history, selectedIds]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target) || isModalOrPaletteOpen()) return;
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === 'c') {
        if (selectedIds.length === 0) return;
        e.preventDefault();
        copySelection();
        return;
      }
      if (mod && e.key.toLowerCase() === 'a') {
        e.preventDefault();
        setSelectedIds(board.elements.filter((el) => !el.locked).map((el) => el.id));
        return;
      }
      if (mod && e.key.toLowerCase() === 'v') {
        e.preventDefault();
        pasteElements(24);
        return;
      }
      if (mod && e.key.toLowerCase() === 'd') {
        if (selectedIds.length === 0) return;
        e.preventDefault();
        const src = copiedElements();
        setClipboard(src);
        applyPaste(src, 24);
        return;
      }
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
        marqueeRef.current = null;
        setMarquee(null);
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
  }, [selectedIds, removeSelection, copySelection, pasteElements, copiedElements, applyPaste, board.elements]);

  useEffect(() => {
    if (tool !== 'select' && tool !== 'marquee') {
      setPopover(null);
      setSelectedIds([]);
      setDragOffset(null);
      resizeRef.current = null;
      setResizePreview(null);
      marqueeRef.current = null;
      setMarquee(null);
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
    if (current.tool === 'eraser') {
      const result = eraseStrokes(
        board.elements,
        current.points.map(([x, y]) => ({ x, y })),
        ERASER_WIDTH,
      );
      if (!result.changed) return;
      history.record();
      dispatch({
        type: 'whiteboard/update',
        id: board.id,
        patch: { elements: result.elements },
      });
      return;
    }
    if (board.elements.length >= MAX_ELEMENTS) return;
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
    if (board.elements.length >= MAX_ELEMENTS) return;
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
    setGuides(null);
    const off = dragOffset;
    setDragOffset(null);
    if (!off || (off.dx === 0 && off.dy === 0)) return;
    const sel = new Set(selectedIds);
    const moveIds = new Set(selectedIds);
    const groupIds = new Set(
      board.elements.filter((el) => sel.has(el.id) && el.groupId).map((el) => el.groupId) as string[],
    );
    for (const el of board.elements) {
      if (el.groupId && groupIds.has(el.groupId)) moveIds.add(el.id);
    }
    const next = board.elements.map((el) => {
      if (el.locked) return el;
      if (!moveIds.has(el.id)) return el;
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
    const target = elementsAtPoint(board.elements, d.cur, EDGE_TOUCH_TOLERANCE, refRects, NO_BOUNDARY);
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
      label: '',
      arrowStyle: 'solid',
      sourceNodeId: fromEl.id,
      targetNodeId: target.id,
      sourcePort,
      targetPort,
    };
    if (board.elements.length >= MAX_ELEMENTS) return;
    history.record();
    dispatch({ type: 'whiteboard/update', id: board.id, patch: { elements: [...board.elements, edge] } });
  };

  const placeRef = (entity: WhiteboardRefEntity, entityId: string) => {
    const pt = refPending;
    setRefPending(null);
    if (!pt) return;
    if (board.elements.length >= MAX_ELEMENTS) return;
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
    if (
      tool === 'view' ||
      spaceHeld ||
      (tool === 'select' && !elementsAtPoint(board.elements, pt, EDGE_TOUCH_TOLERANCE, refRects))
    ) {
      setSelectedIds([]);
      setDragOffset(null);
      panDragRef.current = true;
      view.onPointerDown(e);
      return;
    }
    e.currentTarget.setPointerCapture(e.pointerId);
    if (tool === 'select') {
      const resizeTargetEl = selectedIds.length === 1 ? board.elements.find((el) => el.id === selectedIds[0] && RESIZEABLE_KINDS.has(el.kind) && !el.locked) : undefined;
      if (resizeTargetEl) {
        const b = boundsFor(resizeTargetEl);
        const off = dragOffset ?? { dx: 0, dy: 0 };
        const hx = b.x + b.w + off.dx;
        const hy = b.y + b.h + off.dy;
        if (Math.abs(pt.x - hx) <= 6 && Math.abs(pt.y - hy) <= 6) {
          resizeRef.current = { startWorld: pt, startW: b.w, startH: b.h, startX: b.x, startY: b.y };
          return;
        }
      }
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
      } else if (selectedIds.includes(hit.id)) {
        nextSel = selectedIds;
      } else {
        nextSel = [hit.id];
      }
      setSelectedIds(nextSel);
      if (!readOnly) {
        dragRef.current = { startWorld: pt, originals: new Map(board.elements.map((el) => [el.id, el])) };
      }
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
      const hit = elementsAtPoint(board.elements, pt, EDGE_TOUCH_TOLERANCE, refRects, NO_BOUNDARY);
      if (!hit || hit.kind === 'edge') return;
      const d: EdgeDraft = { fromId: hit.id, fromBounds: boundsFor(hit), cur: pt };
      edgeDraftRef.current = d;
      setEdgeDraft(d);
      return;
    }
    if (tool === 'boundary') {
      e.currentTarget.setPointerCapture(e.pointerId);
      setBoundaryDraft({ x1: pt.x, y1: pt.y, x2: pt.x, y2: pt.y });
      return;
    }
    if (tool === 'marquee') {
      const m = { x1: pt.x, y1: pt.y, x2: pt.x, y2: pt.y, shift: e.shiftKey };
      marqueeRef.current = m;
      setMarquee(m);
      return;
    }
    if (tool === 'ref') {
      setRefPending(pt);
      return;
    }
  };

  const handlePointerMove = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (spaceHeld || panDragRef.current) {
      view.onPointerMove(e);
      return;
    }
    if (tool === 'select') {
      const pt = worldAt(e);
      if (resizeRef.current) {
        const r = resizeRef.current;
        const dx = pt.x - r.startWorld.x;
        const dy = pt.y - r.startWorld.y;
        const w = Math.max(RESIZE_MIN, snap(r.startW + dx));
        const h = Math.max(RESIZE_MIN, snap(r.startH + dy));
        const target = selectedIds.length === 1 ? board.elements.find((el) => el.id === selectedIds[0]) : undefined;
        if (target?.kind === 'text') {
          const wrapW = Math.min(w, 2000);
          setResizePreview({
            w: wrapW,
            h: wrapTextLines(target.text, target.fontSize, wrapW).length * textLineHeight(target.fontSize) + 2,
          });
          return;
        }
        setResizePreview({ w, h });
        return;
      }
      if (!dragRef.current) return;
      let dx = pt.x - dragRef.current.startWorld.x;
      let dy = pt.y - dragRef.current.startWorld.y;
      const sel = new Set(selectedIds);
      const moving = selectedIds
        .map((id) => board.elements.find((el) => el.id === id))
        .filter((el): el is WhiteboardElement => Boolean(el));
      if (moving.length > 0) {
        const bounds = unionBounds(moving.map(boundsFor));
        const snappedX = snap(bounds.x + dx) - bounds.x;
        const snappedY = snap(bounds.y + dy) - bounds.y;
        const others = board.elements
          .filter((el) => !sel.has(el.id))
          .map(boundsFor);
        const { guides, dx: gdx, dy: gdy } = alignmentGuides(
          { x: bounds.x + snappedX, y: bounds.y + snappedY, w: bounds.w, h: bounds.h },
          others,
        );
        setGuides(guides.length > 0 ? guides : null);
        dx = snappedX + gdx;
        dy = snappedY + gdy;
      }
      setDragOffset({ dx, dy });
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
    if (tool === 'marquee') {
      const m = marqueeRef.current;
      if (!m) return;
      const pt = worldAt(e);
      const next = { ...m, x2: pt.x, y2: pt.y };
      marqueeRef.current = next;
      setMarquee(next);
      return;
    }
    if (tool === 'boundary') {
      const d = boundaryDraft;
      if (!d) return;
      const pt = worldAt(e);
      const next = { ...d, x2: snap(pt.x), y2: snap(pt.y) };
      setBoundaryDraft(next);
      return;
    }
  };

  const handlePointerUp = (_e: ReactPointerEvent<SVGSVGElement>) => {
    if (spaceHeld || panDragRef.current) {
      panDragRef.current = false;
      view.onPointerUp();
      return;
    }
    if (tool === 'marquee') {
      const m = marqueeRef.current;
      marqueeRef.current = null;
      setMarquee(null);
      if (!m) return;
      const rect: Rect = {
        x: Math.min(m.x1, m.x2),
        y: Math.min(m.y1, m.y2),
        w: Math.abs(m.x2 - m.x1),
        h: Math.abs(m.y2 - m.y1),
      };
      const hits = board.elements.filter((el) => rectsIntersect(boundsFor(el), rect));
      setSelectedIds(m.shift ? Array.from(new Set([...selectedIds, ...hits.map((el) => el.id)])) : hits.map((el) => el.id));
      setDragOffset(null);
      return;
    }
    if (tool === 'select') {
      if (resizeRef.current) {
        const preview = resizePreview;
        resizeRef.current = null;
        setResizePreview(null);
        const targetId = selectedIds.length === 1 ? selectedIds[0] : null;
        if (preview && targetId) {
          history.record();
          const target = board.elements.find((el) => el.id === targetId);
          const patch = target?.kind === 'text' ? { w: preview.w } : { w: preview.w, h: preview.h };
          dispatch({
            type: 'whiteboard/update',
            id: board.id,
            patch: {
              elements: board.elements.map((el) => (el.id === targetId ? { ...el, ...patch } : el)),
            },
          });
        }
        return;
      }
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
    if (tool === 'boundary') {
      const d = boundaryDraft;
      setBoundaryDraft(null);
      if (!d) return;
      const x = Math.min(d.x1, d.x2);
      const y = Math.min(d.y1, d.y2);
      const w = Math.abs(d.x2 - d.x1);
      const h = Math.abs(d.y2 - d.y1);
      if (w < 40 || h < 40) return;
      if (board.elements.length >= MAX_ELEMENTS) return;
      history.record();
      const boundary = buildBoundary(x, y, w, h);
      dispatch({ type: 'whiteboard/update', id: board.id, patch: { elements: [...board.elements, boundary] } });
      setSelectedIds([boundary.id]);
      return;
    }
  };

  const handlePointerCancel = (_e: ReactPointerEvent<SVGSVGElement>) => {
    if (spaceHeld || panDragRef.current) {
      panDragRef.current = false;
      view.onPointerCancel();
      return;
    }
    if (tool === 'select') {
      dragRef.current = null;
      setDragOffset(null);
      setGuides(null);
      resizeRef.current = null;
      setResizePreview(null);
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
    if (tool === 'marquee') {
      marqueeRef.current = null;
      setMarquee(null);
      return;
    }
    if (tool === 'boundary') {
      setBoundaryDraft(null);
      return;
    }
  };

  const handleDoubleClick = (e: ReactMouseEvent<SVGSVGElement>) => {
    if (tool === 'view' || tool === 'marquee') return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pt = screenToWorld(view.view, e.clientX - rect.left, e.clientY - rect.top);
    const hit = elementsAtPoint(board.elements, pt, EDGE_TOUCH_TOLERANCE, refRects);
    if (!hit) return;
    if (hit.kind === 'ref') {
      const b = boundsFor(hit);
      const t = REF_LAYOUT.toggle;
      if (pointInRect(pt, { x: b.x + b.w - t.rightOff, y: b.y + t.topOff, w: t.w, h: t.h })) return;
      const rows = state?.[hit.entity] as Array<{ id: string }> | undefined;
      if (!rows?.some((r) => r.id === hit.entityId)) return;
      openRef(hit.entity, hit.entityId);
      return;
    }
    if (hit.kind === 'stroke') return;
    if (readOnly) return;
    const anchor =
      hit.kind === 'edge'
        ? edgeMidpoint({ x1: hit.x1, y1: hit.y1, x2: hit.x2, y2: hit.y2 })
        : { x: hit.x, y: hit.y };
    setPopover({ id: hit.id, kind: hit.kind, wx: anchor.x, wy: anchor.y, el: hit });
  };

  return (
    <div className="wb-canvas" role="group" aria-label={t('whiteboard.canvas.label', { name: board.name, count: board.elements.length })} tabIndex={0}>
      <svg
        ref={view.ref}
        className={`wb-svg ${view.dragging ? 'dragging' : ''}`}
        style={{ cursor: view.dragging || spaceHeld ? 'grabbing' : TOOL_CURSOR[tool] }}
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
          x={viewport?.x ?? 0}
          y={viewport?.y ?? 0}
          width={viewport?.w ?? 1000}
          height={viewport?.h ?? 800}
          fill="url(#wb-dots)"
        />
        <g transform={`translate(${view.view.x} ${view.view.y}) scale(${view.view.s})`}>
          {visibleElements.map((el) => (
            <ElementView
              key={el.id}
              el={el}
              selected={selectedSet.has(el.id)}
              offset={selectedSet.has(el.id) ? dragOffset : null}
              derivedEndpoints={
                el.kind === 'edge' ? shiftEndpoints(derivedEdges.get(el.id) ?? null, dragOffset, selectedSet, el) : null
              }
              refData={el.kind === 'ref' ? (refDataMap.get(el.id) ?? null) : undefined}
              collapsed={el.kind === 'ref' ? collapsedRefs.has(el.id) : undefined}
              bounds={el.kind === 'ref' ? refRects.get(el.id) : undefined}
            />
          ))}
          {draft &&
            (draft.tool === 'eraser' ? (
              <g>
                {draft.points.map((p, i) => (
                  <circle key={i} cx={p[0]} cy={p[1]} r={ERASER_WIDTH / 2} fill="rgba(138,138,147,0.35)" />
                ))}
              </g>
            ) : (
              <polyline
                points={draft.points.map((p) => `${p[0]},${p[1]}`).join(' ')}
                fill="none"
                stroke={drawColor(draft.tool)}
                strokeWidth={drawWidth(draft.tool)}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ))}
          {edgeDraft &&
            edgeDraftHover &&
            (() => {
              const { hover } = edgeDraftHover;
              const snap =
                hover && hover.id !== edgeDraft.fromId
                  ? {
                      fromBounds: edgeDraft.fromBounds,
                      toBounds: boundsFor(hover),
                    }
                  : null;
              const ep = snap
                ? edgeEndpoints(snap.fromBounds, snap.toBounds, edgeDraft.cur)
                : { ...edgeEndpoints(edgeDraft.fromBounds, edgeDraft.fromBounds, edgeDraft.cur), x2: edgeDraft.cur.x, y2: edgeDraft.cur.y };
              const sourcePort = portSideToward(edgeDraft.fromBounds, edgeDraft.cur);
              const targetPort = snap
                ? (nearestPortSide(edgeDraft.cur, snap.toBounds) ?? portSideToward(snap.toBounds, edgeDraft.cur))
                : null;
              const path = targetPort
                ? orthogonalPath({ x1: ep.x1, y1: ep.y1, x2: ep.x2, y2: ep.y2 }, sourcePort, targetPort)
                : null;
              const pts = path ?? [
                { x: ep.x1, y: ep.y1 },
                { x: ep.x2, y: ep.y2 },
              ];
              const last = pts[pts.length - 1]!;
              const prev = pts[pts.length - 2] ?? last;
              const deg = Math.atan2(last.y - prev.y, last.x - prev.x) * (180 / Math.PI);
              const hasSpan = last.x !== prev.x || last.y !== prev.y;
              return (
                <g>
                  <polyline
                    points={pts.map((p) => `${p.x},${p.y}`).join(' ')}
                    fill="none"
                    stroke="var(--accent)"
                    strokeWidth={1.5}
                    strokeDasharray="5 4"
                  />
                  {hasSpan && (
                    <g transform={`translate(${last.x},${last.y}) rotate(${deg})`}>
                      <polygon points="-8,-4 0,0 -8,4" fill="none" stroke="var(--accent)" strokeWidth={1.5} />
                    </g>
                  )}
                </g>
              );
            })()}
          {boundaryDraft &&
            (() => {
              const x = Math.min(boundaryDraft.x1, boundaryDraft.x2);
              const y = Math.min(boundaryDraft.y1, boundaryDraft.y2);
              const w = Math.abs(boundaryDraft.x2 - boundaryDraft.x1);
              const h = Math.abs(boundaryDraft.y2 - boundaryDraft.y1);
              return (
                <rect
                  x={x}
                  y={y}
                  width={w}
                  height={h}
                  rx={8}
                  fill="rgba(110,168,254,0.05)"
                  stroke="var(--accent)"
                  strokeWidth={1.5}
                  strokeDasharray="6 4"
                  pointerEvents="none"
                  data-testid="wb-boundary-draft"
                />
              );
            })()}
          {(resizeRef.current || null) && resizePreview && resizeRef.current && (
            <rect
              x={resizeRef.current.startX}
              y={resizeRef.current.startY}
              width={resizePreview.w}
              height={resizePreview.h}
              fill="none"
              stroke="var(--accent)"
              strokeWidth={1.5}
              strokeDasharray="4 3"
              pointerEvents="none"
              data-testid="wb-resize-preview"
            />
          )}
          {(() => {
            const target =
              selectedIds.length === 1
                ? (board.elements.find((el) => el.id === selectedIds[0] && RESIZEABLE_KINDS.has(el.kind)) ?? null)
                : null;
            if (!target || readOnly) return null;
            const b = boundsFor(target);
            const off = dragOffset ?? { dx: 0, dy: 0 };
            return (
              <rect
                x={b.x + b.w + off.dx - 5}
                y={b.y + b.h + off.dy - 5}
                width={10}
                height={10}
                fill="var(--accent)"
                stroke="var(--bg-base)"
                strokeWidth={1.5}
                style={{ cursor: 'nwse-resize' }}
                data-testid="wb-resize-handle"
              />
            );
          })()}
          {guides &&
            guides.map((g, i) =>
              g.axis === 'x' ? (
                <line
                  key={`gx${i}`}
                  x1={g.coord}
                  y1={g.min}
                  x2={g.coord}
                  y2={g.max}
                  stroke="var(--status-info)"
                  strokeWidth={1}
                  strokeDasharray="4 3"
                  pointerEvents="none"
                  data-testid="wb-guide"
                />
              ) : (
                <line
                  key={`gy${i}`}
                  x1={g.min}
                  y1={g.coord}
                  x2={g.max}
                  y2={g.coord}
                  stroke="var(--status-info)"
                  strokeWidth={1}
                  strokeDasharray="4 3"
                  pointerEvents="none"
                  data-testid="wb-guide"
                />
              ),
            )}
          {marquee &&
            (() => {
              const rx = Math.min(marquee.x1, marquee.x2);
              const ry = Math.min(marquee.y1, marquee.y2);
              return (
                <rect
                  x={rx}
                  y={ry}
                  width={Math.abs(marquee.x2 - marquee.x1)}
                  height={Math.abs(marquee.y2 - marquee.y1)}
                  fill="rgba(110,168,254,0.08)"
                  stroke="var(--accent)"
                  strokeWidth={1.5}
                  strokeDasharray="5 4"
                  pointerEvents="none"
                  data-testid="wb-marquee"
                />
              );
            })()}
        </g>
      </svg>
      <div className="erd-zoom" role="group" aria-label={t('whiteboard.canvas.zoomGroup')}>
        <button
          type="button"
          className="erd-zoom-btn"
          title={t('whiteboard.canvas.zoomIn')}
          aria-label={t('whiteboard.canvas.zoomIn')}
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
          title={t('whiteboard.canvas.zoomOut')}
          aria-label={t('whiteboard.canvas.zoomOut')}
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
          title={t('whiteboard.canvas.resetView')}
          aria-label={t('whiteboard.canvas.resetView')}
          onClick={() => view.setView({ x: 16, y: 16, s: 1 })}
        >
          <CornersOut size={15} aria-hidden="true" />
        </button>
        {canEdit && (
          <button
            type="button"
            className={`erd-zoom-btn${snapOn ? ' erd-zoom-btn-active' : ''}`}
            title={snapOn ? t('whiteboard.canvas.snapOn') : t('whiteboard.canvas.snapOff')}
            aria-label={snapOn ? t('whiteboard.canvas.snapOn') : t('whiteboard.canvas.snapOff')}
            aria-pressed={snapOn}
            onClick={() => setSnapOn((v) => !v)}
          >
            <MagnetStraight size={15} aria-hidden="true" />
          </button>
        )}
      </div>
      {canEdit && selectedIds.length > 0 && (
        <div className="wb-selection-bar" role="group" aria-label={t('whiteboard.canvas.selectionActions')}>
          {(() => {
            const hasLocked = board.elements.some((el) => selectedIds.includes(el.id) && el.locked);
            return (
              <>
                <button
                  type="button"
                  className="wb-selection-btn"
                  title={hasLocked ? t('whiteboard.canvas.unlock') : t('whiteboard.canvas.lock')}
                  aria-label={hasLocked ? t('whiteboard.canvas.unlock') : t('whiteboard.canvas.lock')}
                  aria-pressed={hasLocked}
                  onClick={onToggleLock}
                >
                  {hasLocked ? (
                    <LockSimpleOpen size={15} aria-hidden="true" />
                  ) : (
                    <LockSimple size={15} aria-hidden="true" />
                  )}
                </button>
                <span className="wb-sep" aria-hidden="true" />
                {(() => {
                  const hasGroup = board.elements.some((el) => selectedIds.includes(el.id) && el.groupId);
                  return (
                    <button
                      type="button"
                      className="wb-selection-btn"
                      title={hasGroup ? t('whiteboard.canvas.ungroup') : t('whiteboard.canvas.group')}
                      aria-label={hasGroup ? t('whiteboard.canvas.ungroup') : t('whiteboard.canvas.group')}
                      onClick={hasGroup ? onUngroup : onGroup}
                    >
                      {hasGroup ? (
                        <Intersect size={15} aria-hidden="true" />
                      ) : (
                        <Union size={15} aria-hidden="true" />
                      )}
                    </button>
                  );
                })()}
                <span className="wb-sep" aria-hidden="true" />
              </>
            );
          })()}
          {selectedIds.length >= 2 && (
            <>
              <button
                type="button"
                className="wb-selection-btn"
                title={t('whiteboard.canvas.alignLeft')}
                aria-label={t('whiteboard.canvas.alignLeft')}
                onClick={onAlign('left')}
              >
                <AlignLeft size={15} aria-hidden="true" />
              </button>
              <button
                type="button"
                className="wb-selection-btn"
                title={t('whiteboard.canvas.alignCenterH')}
                aria-label={t('whiteboard.canvas.alignCenterH')}
                onClick={onAlign('centerX')}
              >
                <AlignCenterHorizontal size={15} aria-hidden="true" />
              </button>
              <button
                type="button"
                className="wb-selection-btn"
                title={t('whiteboard.canvas.alignRight')}
                aria-label={t('whiteboard.canvas.alignRight')}
                onClick={onAlign('right')}
              >
                <AlignRight size={15} aria-hidden="true" />
              </button>
              <button
                type="button"
                className="wb-selection-btn"
                title={t('whiteboard.canvas.alignTop')}
                aria-label={t('whiteboard.canvas.alignTop')}
                onClick={onAlign('top')}
              >
                <AlignTop size={15} aria-hidden="true" />
              </button>
              <button
                type="button"
                className="wb-selection-btn"
                title={t('whiteboard.canvas.alignMiddleV')}
                aria-label={t('whiteboard.canvas.alignMiddleV')}
                onClick={onAlign('middleY')}
              >
                <AlignCenterVertical size={15} aria-hidden="true" />
              </button>
              <button
                type="button"
                className="wb-selection-btn"
                title={t('whiteboard.canvas.alignBottom')}
                aria-label={t('whiteboard.canvas.alignBottom')}
                onClick={onAlign('bottom')}
              >
                <AlignBottom size={15} aria-hidden="true" />
              </button>
              <span className="wb-sep" aria-hidden="true" />
            </>
          )}
          {selectedIds.length >= 3 && (
            <>
              <button
                type="button"
                className="wb-selection-btn"
                title={t('whiteboard.canvas.distributeH')}
                aria-label={t('whiteboard.canvas.distributeH')}
                onClick={onDistribute('x')}
              >
                <Columns size={15} aria-hidden="true" />
              </button>
              <button
                type="button"
                className="wb-selection-btn"
                title={t('whiteboard.canvas.distributeV')}
                aria-label={t('whiteboard.canvas.distributeV')}
                onClick={onDistribute('y')}
              >
                <Rows size={15} aria-hidden="true" />
              </button>
            </>
          )}
          <button
            type="button"
            className="wb-selection-btn"
            title={t('whiteboard.canvas.bringForward')}
            aria-label={t('whiteboard.canvas.bringForward')}
            onClick={() => reorderSelection(1)}
          >
            <ArrowUp size={15} aria-hidden="true" />
          </button>
          <button
            type="button"
            className="wb-selection-btn"
            title={t('whiteboard.canvas.sendBackward')}
            aria-label={t('whiteboard.canvas.sendBackward')}
            onClick={() => reorderSelection(-1)}
          >
            <ArrowDown size={15} aria-hidden="true" />
          </button>
          <button
            type="button"
            className="wb-selection-btn"
            title={t('whiteboard.canvas.deleteSelectedTitle')}
            aria-label={t('whiteboard.canvas.deleteSelected')}
            onClick={removeSelection}
          >
            <Trash size={15} aria-hidden="true" />
          </button>
        </div>
      )}
      <span className="wb-hint">{t('whiteboard.canvas.hint')}</span>
      {board.elements.length > 0 && (
        (() => {
          const bounds = unionBounds(board.elements.map((el) => elementBounds(el)));
          const vp = worldViewportRect(view.view, canvasSize.w, canvasSize.h);
          const PAD = 6;
          const MW = 168;
          const MH = 110;
          const scale = Math.min((MW - PAD * 2) / Math.max(1, bounds.w), (MH - PAD * 2) / Math.max(1, bounds.h));
          const ox = PAD - bounds.x * scale;
          const oy = PAD - bounds.y * scale;
          const vpMini = {
            x: ox + vp.x * scale,
            y: oy + vp.y * scale,
            w: vp.w * scale,
            h: vp.h * scale,
          };
          const onMiniClick = (e: ReactMouseEvent<SVGSVGElement>) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const wx = (e.clientX - rect.left - ox) / scale;
            const wy = (e.clientY - rect.top - oy) / scale;
            view.setView((v) => ({ ...v, x: wx - canvasSize.w / 2, y: wy - canvasSize.h / 2 }));
          };
          return (
            <div className="wb-minimap" role="group" aria-label={t('whiteboard.canvas.minimap')}>
              <svg width={MW} height={MH} onClick={onMiniClick}>
                {board.elements.map((el) => {
                  const b = elementBounds(el);
                  if (b.w <= 0 || b.h <= 0) return null;
                  return (
                    <rect
                      key={el.id}
                      x={ox + b.x * scale}
                      y={oy + b.y * scale}
                      width={Math.max(1, b.w * scale)}
                      height={Math.max(1, b.h * scale)}
                      fill="rgba(110,168,254,0.35)"
                    />
                  );
                })}
                <rect
                  x={vpMini.x}
                  y={vpMini.y}
                  width={vpMini.w}
                  height={vpMini.h}
                  fill="rgba(228,228,231,0.08)"
                  stroke="#e4e4e7"
                  strokeWidth={1}
                />
              </svg>
            </div>
          );
        })()
      )}
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
        state={state}
        onPick={placeRef}
        onClose={() => setRefPending(null)}
      />
    </div>
  );
}