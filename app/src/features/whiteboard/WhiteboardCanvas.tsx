import { Children, memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent, type PointerEventHandler as ReactPointerEventHandler, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import {
  AlignBottom,
  AlignCenterHorizontal,
  AlignCenterVertical,
  AlignLeft,
  AlignRight,
  AlignTop,
  ArrowClockwise,
  ArrowDown,
  ArrowLineDown,
  ArrowLineUp,
  ArrowsHorizontal,
  ArrowsVertical,
  ArrowUp,
  CaretDown,
  CaretUp,
  ClipboardText,
  Columns,
  Copy,
  CornersOut,
  DotsThreeVertical,
  DownloadSimple,
  Image,
  Keyboard,
  Link,
  LockKey,
  LockOpen,
  MagnifyingGlassMinus,
  MagnifyingGlassPlus,
  Minus,
  Rows,
  Scissors,
  SquaresFour,
  Trash,
} from '@phosphor-icons/react';
import type {
  State,
  Whiteboard,
  WhiteboardAlign,
  WhiteboardBoundary,
  WhiteboardEdge,
  WhiteboardElement,
  WhiteboardFontFamily,
  WhiteboardRefEntity,
  WhiteboardShape,
  WhiteboardShapeType,
  WhiteboardSticky,
  WhiteboardValign,
} from '../../lib/types';
import { useProjectOptional } from '../../state/project-context';
import { useNavigate } from 'react-router';
import { entityDeepLink } from '../../lib/deep-link';
import { newId } from '../../lib/utils';
import {
  alignmentGuides,
  alignSelection,
  distributeSelection,
  elementBounds,
  inRotateZone,
  matchSizeSelection,
  type MatchSizeMode,
  rectsIntersect,
  refCardLayout,
  refCardRect,
  refEntityAccent,
  rotatePoint,
  rotationCenter,
  screenToWorld,
  worldToScreen,
  shapePath,
  snapRotation,
  snapToGrid,
  truncateToWidth,
  textLineHeight,
  unionBounds,
  worldViewportRect,
  wrapTextLines,
  wrapToWidth,
  CHIP_CHAR_W,
  REF_LAYOUT,
  type AlignMode,
  type Guide,
  type Rect,
  type RefCardBlock,
  type RefCardData,
} from './geometry';
import { useCanvasView } from '../../lib/useCanvasView';
import {
  EDGE_TOUCH_TOLERANCE,
  edgeEndpoints,
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
  BOUNDARY_COLOR,
  SHAPE_COLOR,
  SHAPE_H,
  SHAPE_W,
  STICKY_COLOR,
  STICKY_H,
  STICKY_W,
  TEXT_COLOR,
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
import { listedLines, svgTextStyle } from './fonts';
import { AlignDropdown, ColorDropdown, DropCaret, DropdownShell, FontDropdown, SizeDropdown, TextStyleToggles, ValignDropdown, WidthSlider } from './WhiteboardTextControls';
import { SHAPE_LIBRARY_TABS } from './libraries';
import { ShapeThumb } from './ShapeThumb';
import { RefPicker } from './RefPicker';
import { Tooltip } from '../../components/Tooltip';
import { BottomSheet } from '../../components/BottomSheet';
import { WhiteboardContextMenu } from './WhiteboardContextMenu';
import { downloadWhiteboardPng, downloadWhiteboardSvg } from './export';
import { buildRefDataMap } from './ref-data';
import type { WhiteboardHistory } from './useWhiteboardHistory';

interface WhiteboardCanvasProps {
  board: Whiteboard;
  tool: WbTool;
  history: WhiteboardHistory;
  readOnly?: boolean;
  readOnlyState?: State | null;
  readOnlyProjectId?: string;
  selectedIds?: string[];
  onSelectedChange?: (ids: string[]) => void;
  onToolChange?: (tool: WbTool) => void;
  registerDelete?: (fn: () => void) => void;
  isMobile?: boolean;
  onOpenShortcuts?: () => void;
  /** Surface transient cap-limit feedback via the shell's global toast. */
  onNotice?: (msg: string) => void;
  /** WB-17: presentation mode — hide all chrome (zoom, hint, minimap, selection bar). */
  hideChrome?: boolean;
  snapOn?: boolean;
  penColor?: string;
  penWidth?: number;
  eraserWidth?: number;
  stickyColor?: string;
  stickyTextColor?: string;
  stickyFontSize?: number;
  stickyAlign?: string | null;
  textColor?: string;
  textFontSize?: number;
  textAlign?: string | null;
  textFontFamily?: WhiteboardFontFamily | null;
  textBold?: boolean | null;
  textStrike?: boolean | null;
  textBullet?: boolean | null;
  shapeColor?: string;
  shapeLabelColor?: string;
  shapeFontSize?: number;
  shapeAlign?: string | null;
  shapeType?: string | null;
  shapeLabel?: string | null;
  shapeFill?: boolean;
  edgeColor?: string;
  edgeFontSize?: number;
  edgeAlign?: string | null;
  edgeLabel?: string | null;
  edgeArrowStyle?: string | null;
  edgeDash?: string | null;
  boundaryColor?: string;
  boundaryLabelColor?: string;
  boundaryFontSize?: number;
  boundaryAlign?: string | null;
  boundaryLabel?: string | null;
  panToId?: string | null;
}

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
const MAX_ELEMENTS = 1000;
const NO_BOUNDARY: ReadonlySet<string> = new Set(['boundary']);
const RESIZEABLE_KINDS: ReadonlySet<string> = new Set(['shape', 'sticky', 'boundary', 'text']);
/** Kinds with a schema `rotation` field (server state.ts) — rotation edits live in the floating bar. */
const ROTATABLE_KINDS: ReadonlySet<string> = new Set(['shape', 'sticky', 'text']);
/** Kinds that expose FigJam-style side port dots for drag-to-connect. */
const CONNECTABLE_KINDS: ReadonlySet<string> = new Set(['shape', 'sticky', 'text', 'ref']);
/** Kinds with inline-editable text (double-click / Enter). */
const TEXT_EDITABLE: ReadonlySet<string> = new Set(['sticky', 'text', 'shape', 'edge', 'boundary']);
const RESIZE_MIN = 20;
/** FigJam-style adornments: generous screen-space hit targets (px at any zoom). */
const CORNER_HIT = 12;
/** Rotate cursor: curved arrow readable on both themes, hotspot centered. */
const ROTATE_CURSOR =
  `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24'%3E` +
  `%3Cpath d='M20 12a8 8 0 1 1-2.34-5.66' fill='none' stroke='white' stroke-width='3.5' stroke-linecap='round'/%3E` +
  `%3Cpath d='M20 12a8 8 0 1 1-2.34-5.66' fill='none' stroke='%230f172a' stroke-width='1.75' stroke-linecap='round'/%3E` +
  `%3Cpath d='M20 3.5v5h-5' fill='none' stroke='white' stroke-width='3.5' stroke-linecap='round' stroke-linejoin='round'/%3E` +
  `%3Cpath d='M20 3.5v5h-5' fill='none' stroke='%230f172a' stroke-width='1.75' stroke-linecap='round' stroke-linejoin='round'/%3E` +
  `%3C/svg%3E") 12 12, grab`;
const PORT_HIT = 14;
const PORT_R = 5;
/** Resize corners in the element's rotated frame. */
type ResizeCorner = 'nw' | 'ne' | 'sw' | 'se';
const RESIZE_CORNERS: ReadonlyArray<ResizeCorner> = ['nw', 'ne', 'sw', 'se'];

/** World corner for an anchored resize in the element's rotated frame. */
function resizeCornerPoint(b: Rect, c: Point, rdeg: number, corner: ResizeCorner): Point {
  const px = corner === 'ne' || corner === 'se' ? b.x + b.w : b.x;
  const py = corner === 'sw' || corner === 'se' ? b.y + b.h : b.y;
  return rotatePoint(px, py, c.x, c.y, rdeg);
}
/** Where the ref picker's Browse / Create-new actions land per entity. */
const REF_CREATE_TARGET: Record<WhiteboardRefEntity, { tab: string; fresh: string }> = {
  tasks: { tab: 'board', fresh: '1' },
  issues: { tab: 'issues', fresh: '1' },
  testCases: { tab: 'tests', fresh: '1' },
  milestones: { tab: 'releases', fresh: '1' },
  techEntries: { tab: 'stack', fresh: '1' },
  decisions: { tab: 'decisions', fresh: '1' },
  tables: { tab: 'schema', fresh: '1' },
  apiCollections: { tab: 'api', fresh: '1' },
  apiEndpoints: { tab: 'api', fresh: 'endpoint' },
};
/** Optional model fields: absent on legacy elements but still writable via bars. */
const OPTIONAL_PATCH_FIELDS: ReadonlySet<string> = new Set([
  'fontSize',
  'align',
  'valign',
  'textColor',
  'labelColor',
  'dash',
  'fill',
  'fontFamily',
  'bold',
  'strikethrough',
  'list',
]);
const noopDispatch = () => {};
const DEFAULT_EDGE_COLOR = '#e4e4e7';
const DEFAULT_EDGE_WIDTH = 2;


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
  /** Hides the element text while the inline editor owns it (P8: no double text). */
  editing?: boolean;
  /** FigJam Add-text: ghost click selects + edits. */
  onGhostEdit?: (el: WhiteboardElement) => void;
  offset?: DragOffset | null;
  derivedEndpoints?: EdgeEndpoints | null;
  refData?: RefCardData | null;
  collapsed?: boolean;
  bounds?: Rect;
}

const ElementView = memo(function ElementView({
  el,
  selected,
  editing = false,
  onGhostEdit,
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
        const fontSize = el.fontSize ?? 12;
        const align = el.align ?? 'left';
        const lineHeight = textLineHeight(fontSize);
        const pad = 8;
        const maxLines = Math.max(1, Math.floor((el.h - pad * 2) / lineHeight));
        const innerW = Math.max(24, el.w - pad * 2);
        const style = svgTextStyle(el);
        const lines = wrapTextLines(listedLines(el.text, el).join('\n'), fontSize, innerW)
          .slice(0, maxLines)
          .map((line) => truncateToWidth(line, fontSize, innerW));
        const rot = el.rotation ? `rotate(${el.rotation}, ${el.x + el.w / 2}, ${el.y + el.h /2})` : undefined;
        const textFill = el.textColor ?? 'rgba(6,5,4,0.85)';
        const anchor = align === 'center' ? 'middle' : align === 'right' ? 'end' : 'start';
        const textX = align === 'center' ? el.x + el.w / 2 : align === 'right' ? el.x + el.w - pad : el.x + pad;
        // V1 vertical align (null = legacy top start).
        const vTop = el.y + pad + 8;
        const blockH = lines.length * lineHeight;
        const vMode = el.valign ?? 'top';
        const startY =
          vMode === 'center'
            ? Math.max(vTop, el.y + (el.h - blockH) / 2 + 8)
            : vMode === 'bottom'
              ? Math.max(vTop, el.y + el.h - pad - blockH + 8)
              : vTop;
        const showGhost = el.text === '' && selected && !editing;
        const ghostDown = (e: ReactPointerEvent<SVGTextElement>) => {
          e.stopPropagation();
          e.preventDefault();
          onGhostEdit?.(el);
        };
        return (
          <g transform={rot}>
            <rect x={el.x} y={el.y} width={el.w} height={el.h} rx={4} fill={el.color} fillOpacity={0.85} />
            {!editing &&
              lines.length > 0 &&
              lines.map((line, i) => (
                <text
                  key={i}
                  x={textX}
                  y={startY + i * lineHeight}
                  fontSize={fontSize}
                  fill={textFill}
                  textAnchor={anchor as any}
                  {...style}
                >
                  {line}
                </text>
              ))}
            {showGhost && (
              <text
                x={textX}
                y={vTop}
                fontSize={fontSize}
                fill={textFill}
                opacity={0.45}
                textAnchor={anchor as any}
                style={{ cursor: 'text' }}
                onPointerDown={ghostDown}
                {...style}
              >
                {t('whiteboard.canvas.addText')}
              </text>
            )}
          </g>
        );
      }
      case 'text': {
        const fontSize = el.fontSize;
        const align = el.align ?? 'left';
        const anchor = align === 'center' ? 'middle' : align === 'right' ? 'end' : 'start';
        const rot = el.rotation ? `rotate(${el.rotation}, ${el.x}, ${el.y})` : undefined;
        const style = svgTextStyle(el);
        const showGhost = el.text === '' && selected && !editing;
        if (editing) {
          return <g transform={rot} />;
        }
        const ghostDown = (e: ReactPointerEvent<SVGTextElement>) => {
          e.stopPropagation();
          e.preventDefault();
          onGhostEdit?.(el);
        };
        if (el.w) {
          const lines = wrapTextLines(listedLines(el.text, el).join('\n'), fontSize, el.w);
          const baseX = align === 'center' ? el.x + el.w / 2 : align === 'right' ? el.x + el.w : el.x;
          return (
            <g transform={rot}>
              <text x={baseX} y={el.y} fontSize={fontSize} fill={el.color} textAnchor={anchor as any} {...style}>
                {lines.map((line, i) => (
                  <tspan key={i} x={baseX} dy={i === 0 ? 0 : textLineHeight(fontSize)}>
                    {line}
                  </tspan>
                ))}
                {showGhost && (
                  <tspan
                    x={baseX}
                    dy={lines.length > 0 ? textLineHeight(fontSize) : 0}
                    opacity={0.45}
                    style={{ cursor: 'text' }}
                    onPointerDown={ghostDown as unknown as ReactPointerEventHandler<SVGTSpanElement>}
                  >
                    {t('whiteboard.canvas.addText')}
                  </tspan>
                )}
              </text>
            </g>
          );
        }
        return (
          <g transform={rot}>
            <text x={el.x} y={el.y} fontSize={fontSize} fill={el.color} textAnchor={anchor as any} {...style}>
              {showGhost ? (
                <tspan
                  opacity={0.45}
                  style={{ cursor: 'text' }}
                  onPointerDown={ghostDown as unknown as ReactPointerEventHandler<SVGTSpanElement>}
                >
                  {t('whiteboard.canvas.addText')}
                </tspan>
              ) : (
                listedLines(el.text, el).join('\n')
              )}
            </text>
          </g>
        );
      }
      case 'shape': {
        const pad = 8;
        const fontSize = el.fontSize ?? 12;
        const align = el.align ?? 'center';
        const innerW = Math.max(24, el.w - pad * 2);
        const labelLines = el.label ? wrapToWidth(listedLines(el.label, el).join('\n'), fontSize, innerW, 4) : [];
        const rot = el.rotation ? `rotate(${el.rotation}, ${el.x + el.w / 2}, ${el.y + el.h / 2})` : undefined;
        const isLightFill = el.fill && ["#e4e4e7","#6ea8fe","#f2b8c6","#34c38e","#5db69b","#a78bfa","#e8b955"].includes(el.color);
        const labelFill = el.labelColor ?? (isLightFill ? "#0f172a" : el.color);
        const anchor = align === 'left' ? 'start' : align === 'right' ? 'end' : 'middle';
        const textX = align === 'left' ? el.x + pad : align === 'right' ? el.x + el.w - pad : el.x + el.w / 2;
        const style = svgTextStyle(el);
        const showGhost = el.label === '' && selected && !editing;
        // V1 vertical align (null = legacy: first line centered).
        const step = fontSize + 2;
        const n = labelLines.length;
        const vMode = el.valign ?? null;
        const legacyY = el.y + el.h / 2;
        const firstY =
          vMode === 'top'
            ? el.y + pad + step / 2
            : vMode === 'bottom'
              ? el.y + el.h - pad - (n - 1) * step - step / 2
              : vMode === 'center'
                ? el.y + el.h / 2 - ((n - 1) * step) / 2
                : legacyY;
        const y0 = Math.max(firstY, el.y + pad + step / 2);
        const ghostDown = (e: ReactPointerEvent<SVGTextElement>) => {
          e.stopPropagation();
          e.preventDefault();
          onGhostEdit?.(el);
        };
        return (
          <g transform={rot}>
            <path
              d={shapePath(el)}
              fill={el.fill ? el.color : 'none'}
              fillOpacity={el.fill ? 0.15 : undefined}
              stroke={el.dash === 'none' ? 'none' : el.color}
              strokeWidth={el.strokeWidth}
              strokeDasharray={el.dash === 'dashed' ? '8 5' : undefined}
            />
            {labelLines.length > 0 && !editing && (
              <text
                className="wb-shape-label"
                x={textX}
                y={y0}
                textAnchor={anchor as any}
                dominantBaseline="middle"
                fontSize={fontSize}
                fill={labelFill}
                pointerEvents="none"
                {...style}
              >
                {labelLines.map((line, i) => (
                  <tspan key={i} x={textX} dy={i === 0 ? 0 : fontSize + 2}>
                    {line}
                  </tspan>
                ))}
              </text>
            )}
            {showGhost && (
              <text
                x={textX}
                y={vMode === 'top' ? el.y + pad + step / 2 : vMode === 'bottom' ? el.y + el.h - pad - step / 2 : legacyY}
                textAnchor={anchor as any}
                dominantBaseline="middle"
                fontSize={fontSize}
                fill={labelFill}
                opacity={0.45}
                style={{ cursor: 'text' }}
                onPointerDown={ghostDown}
                {...style}
              >
                {t('whiteboard.canvas.addText')}
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
            {!editing && el.label && (() => {
              const fontSize = el.fontSize ?? 11;
              const align = el.align ?? 'center';
              const anchor = align === 'left' ? 'start' : align === 'right' ? 'end' : 'middle';
              return (
                <text
                  className="wb-edge-label"
                  x={mid.x}
                  y={mid.y}
                  textAnchor={anchor as any}
                  fontSize={fontSize}
                  fill={el.color}
                  pointerEvents="none"
                  {...svgTextStyle(el)}
                >
                  {listedLines(el.label, el).join(' ')}
                </text>
              );
            })()}
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
            {!editing && el.label && (() => {
              const fontSize = el.fontSize ?? 12;
              const labelColor = (el as { labelColor?: string | null }).labelColor ?? '#f1f5f9';
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
                  <text x={0} y={0} fontSize={fontSize} fill={labelColor} {...svgTextStyle(el)}>
                    {truncateToWidth(listedLines(el.label, el).join(' '), fontSize, chipW - 12)}
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
        const accent = refEntityAccent(el.entity);
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
        const clipId = `wb-refclip-${el.id}`;
        return (
          <g style={missing ? { pointerEvents: 'none' } : undefined}>
            <defs>
              <clipPath id={clipId}>
                <rect x={x} y={y} width={w} height={h} rx={6} />
              </clipPath>
            </defs>
            <rect x={x} y={y} width={w} height={h} rx={6} fill={accent.softFill} stroke={accent.color} strokeWidth={1.5} />
            <g clipPath={`url(#${clipId})`}>
            {layout ? (
              <g>
                {renderBlock(layout.title, 't', 12, missing ? '#8a8a93' : accent.color, 600)}
                {renderBlock(layout.meta, 'm', 10, missing ? '#6b7280' : '#8a8a93')}
                {renderBlock(layout.sub, 's', 10, '#8a8a93')}
                {layout.labelRows.map((row, ri) => {
                  let lx = x + pad;
                  return (
                    <g key={`l${ri}`}>
                      {row.labels.map((label, li) => {
                        const cw = label.length * CHIP_CHAR_W + 12;
                        const chip = (
                          <g key={`${label}-${li}`}>
                            <rect x={lx} y={y + row.y - 9} width={cw} height={13} rx={3} fill={accent.chipFill} />
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
                  {truncateToWidth(missing ? t('whiteboard.canvas.refUntitled', { entity: el.entity }) : refData!.title, 12, w - pad * 2 - toggle.rightOff, 600)}
                </text>
                <text x={x + pad} y={y + pad + REF_LAYOUT.titleH + 10} fontSize={10} fill={missing ? '#6b7280' : '#8a8a93'}>
                  {missing ? t('whiteboard.canvas.refDeleted') : refData!.meta}
                </text>
              </g>
            )}
            {!missing && (
              <g>
                <rect x={btnX} y={btnY} width={toggle.w} height={toggle.h} rx={4} fill={accent.toggleFill} stroke={accent.color} strokeWidth={1} />
                <text x={btnCx} y={btnCy} fontSize={11} fill={accent.color} textAnchor="middle">
                  {isCollapsed ? '+' : '−'}
                </text>
              </g>
            )}
            </g>
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

  // WB-5/15: selection outline follows element rotation (was axis-aligned AABB).
  const selectionOutline = (() => {
    if (!selected || el.kind === 'edge' || el.kind === 'stroke') return null;
    const bounds = boundsProp ?? elementBounds(el);
    const rect = outline(bounds);
    const rot = (el as { rotation?: number }).rotation ?? 0;
    if (!rot || !ROTATABLE_KINDS.has(el.kind)) return rect;
    const c = rotationCenter(el, bounds);
    return <g transform={`rotate(${rot}, ${c.x}, ${c.y})`}>{rect}</g>;
  })();

  return withOffset(
    <g>
      {content}
      {selectionOutline}
    </g>,
  );
});

interface DraftStroke {
  tool: 'pen' | 'eraser';
  points: Array<[number, number]>;
}

export function WhiteboardCanvas({ board, tool, history, readOnly = false, readOnlyState = null, readOnlyProjectId, selectedIds: selectedIdsProp, onSelectedChange, onToolChange, onOpenShortcuts: onOpenShortcutsProp, registerDelete: registerDeleteProp, isMobile: isMobileProp, snapOn: snapOnProp, penColor: penColorProp, penWidth: penWidthProp, eraserWidth: eraserWidthProp, stickyColor: stickyColorProp, stickyTextColor: stickyTextColorProp, stickyFontSize: stickyFontSizeProp, stickyAlign: stickyAlignProp, textColor: textColorProp, textFontSize: textFontSizeProp, textAlign: textAlignProp, textFontFamily: textFontFamilyProp, textBold: textBoldProp, textStrike: textStrikeProp, textBullet: textBulletProp, shapeColor: shapeColorProp, shapeLabelColor: shapeLabelColorProp, shapeFontSize: shapeFontSizeProp, shapeAlign: shapeAlignProp, shapeType: shapeTypeProp, shapeLabel: shapeLabelProp, shapeFill: shapeFillProp, onNotice: onNoticeProp, edgeColor: edgeColorProp, edgeFontSize: edgeFontSizeProp, edgeAlign: edgeAlignProp, edgeLabel: edgeLabelProp, edgeArrowStyle: edgeArrowStyleProp, edgeDash: edgeDashProp, boundaryColor: boundaryColorProp, boundaryLabelColor: boundaryLabelColorProp, boundaryFontSize: boundaryFontSizeProp, boundaryAlign: boundaryAlignProp, boundaryLabel: boundaryLabelProp, panToId, hideChrome = false }: WhiteboardCanvasProps) {
  const { t } = useTranslation('extras');
  const proj = useProjectOptional(null);
  const { canEdit, dispatch, projectId, state } =
    proj ?? { canEdit: false, dispatch: noopDispatch, projectId: readOnlyProjectId ?? '', state: readOnlyState };
  const isReadOnly = readOnly || !canEdit;
  const navigate = useNavigate();

  const openRef = useCallback(
    (entity: WhiteboardRefEntity, entityId: string) => {
      navigate(entityDeepLink(projectId, entity, entityId));
    },
    [navigate, projectId],
  );
  const [spaceHeld, setSpaceHeld] = useState(false);
  const [internalSnapOn] = useState(true);
  const snapOn = snapOnProp ?? internalSnapOn;
  const snap = useCallback((v: number) => (snapOn ? snapToGrid(v) : v), [snapOn]);
  const [canvasSize, setCanvasSize] = useState({ w: 800, h: 600 });
  const panEnabled = tool === 'select' || tool === 'view' || spaceHeld;
  const view = useCanvasView(panEnabled);

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
  const placeStartRef = useRef<{ clientX: number; clientY: number } | null>(null);
  const [internalSelectedIds, setInternalSelectedIds] = useState<string[]>([]);
  const selectedIds = selectedIdsProp ?? internalSelectedIds;
  const setSelectedIds = (next: string[] | ((prev: string[]) => string[])) => {
    const value = typeof next === 'function' ? (next as (prev: string[]) => string[])(selectedIds) : next;
    if (onSelectedChange) onSelectedChange(value);
    else setInternalSelectedIds(value);
  };
  const [dragOffset, setDragOffset] = useState<DragOffset | null>(null);
  const dragRef = useRef<{ startWorld: Point; originals: Map<string, WhiteboardElement> } | null>(null);
  const panDragRef = useRef(false);
  const [edgeDraft, setEdgeDraft] = useState<EdgeDraft | null>(null);
  const edgeDraftRef = useRef<EdgeDraft | null>(null);
  const [marquee, setMarquee] = useState<{ x1: number; y1: number; x2: number; y2: number; shift: boolean } | null>(null);
  const marqueeRef = useRef<{ x1: number; y1: number; x2: number; y2: number; shift: boolean } | null>(null);
  const [boundaryDraft, setBoundaryDraft] = useState<{ x1: number; y1: number; x2: number; y2: number } | null>(null);
  // FigJam drag-to-place: live shape preview while dragging with the shape tool.
  const [shapeDraft, setShapeDraft] = useState<{ x1: number; y1: number; x2: number; y2: number } | null>(null);
  const [guides, setGuides] = useState<Guide[] | null>(null);
  const [refPending, setRefPending] = useState<Point | null>(null);
  const [collapsedRefs, setCollapsedRefs] = useState<ReadonlySet<string>>(() => new Set());
  const [clipboard, setClipboard] = useState<WhiteboardElement[] | null>(null);
  const [resizePreview, setResizePreview] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const resizeRef = useRef<{ startWorld: Point; startW: number; startH: number; startX: number; startY: number; corner: ResizeCorner; aspect: number } | null>(null);
  // FigJam-style right-click object menu (screen coords) — actions reuse the
  // floating-bar callbacks so menu and bar can never disagree.
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number } | null>(null);
  // S1: measured floatwrap width + requested center for fit-clamping.
  const floatWrapRef = useRef<HTMLDivElement | null>(null);
  const floatFxRef = useRef(0);
  const [barAdj, setBarAdj] = useState(0);
  // Touch long-press opens the same menu (no right button on touch).
  const longPressRef = useRef<{ timer: number; x: number; y: number } | null>(null);
  const cancelLongPress = () => {
    if (longPressRef.current) {
      window.clearTimeout(longPressRef.current.timer);
      longPressRef.current = null;
    }
  };
  const openCtxMenuAt = (clientX: number, clientY: number) => {
    if (isReadOnly) return;
    const svg = view.ref.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const pt = screenToWorld(view.view, clientX - rect.left, clientY - rect.top);
    const hit = elementsAtPoint(board.elements, pt, EDGE_TOUCH_TOLERANCE, refRects);
    if (hit && !selectedIds.includes(hit.id)) setSelectedIds([hit.id]);
    const hasSel = !!hit || selectedIds.length > 0;
    const hasClip = !!clipboard && clipboard.length > 0;
    if (!hasSel && !hasClip) return;
    setCtxMenu({ x: clientX, y: clientY });
  };
  // Single-click zone: element border/body vs inner text area (drives which bar shows).
  const [, setTextZoneId] = useState<string | null>(null);
  // Inline text editing overlay (double-click / Enter).
  const [editingText, setEditingText] = useState<{ id: string; value: string } | null>(null);
  // Open popup inside the floating bar: fill color grid, line controls,
  // font list, size list or stroke-width slider.
  interface BarPopState {
    kind: 'fill' | 'line' | 'font' | 'size' | 'align' | 'valign' | 'width' | 'shapeType' | 'border';
    field?: 'color' | 'textColor' | 'labelColor';
  }
  const [barPop, setBarPop] = useState<BarPopState | null>(null);
  // Mobile ⋮ bottom sheet: actions for the current selection.
  const [moreSheet, setMoreSheet] = useState(false);
  // FigJam rotate gesture: hover-near-corner drag (no persistent handle/button).
  const rotateDragRef = useRef<{ id: string; center: Point; startAng: number; startRot: number } | null>(null);
  const [rotateLive, setRotateLive] = useState<number | null>(null);
  const [hoverRotate, setHoverRotate] = useState(false);

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

  useEffect(() => {
    if (!panToId) return;
    const el = board.elements.find((e) => e.id === panToId);
    if (!el) return;
    const bounds = boundsFor(el);
    const canvasEl = view.ref.current;
    if (!canvasEl) return;
    const rect = canvasEl.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    const cx = bounds.x + bounds.w / 2;
    const cy = bounds.y + bounds.h / 2;
    view.setView((prev) => ({
      ...prev,
      x: rect.width / 2 - cx * prev.s,
      y: rect.height / 2 - cy * prev.s,
    }));
  }, [panToId, board.elements, boundsFor]);

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

  // Board-full feedback goes to the shell's global toast (top-right).
  const notifyAtCap = useCallback(() => {
    onNoticeProp?.(t('whiteboard.cap.atLimit'));
  }, [onNoticeProp, t]);

  const removeSelection = useCallback(() => {
    if (isReadOnly) return;
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
    // Silent delete — no toast. Undo via history (Ctrl+Z) still works.
    history.record();
    dispatch({ type: 'whiteboard/update', id: board.id, patch: { elements: next } });
    setSelectedIds([]);
    setDragOffset(null);
  }, [board.id, board.elements, dispatch, history, selectedIds, isReadOnly]);

  // Mobile trash button: shell calls the latest removeSelection through this ref.
  useEffect(() => {
    registerDeleteProp?.(removeSelection);
  }, [registerDeleteProp, removeSelection]);

  const reorderSelection = useCallback(
    (dir: 1 | -1) => {
      if (isReadOnly) return;
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
    [board.elements, board.id, dispatch, history, selectedIds, isReadOnly],
  );

  /** FigJam "Bring to front / Send to back": jumps the selection to an end. */
  const reorderToEdge = useCallback(
    (edge: 'front' | 'back') => {
      if (isReadOnly) return;
      if (selectedIds.length === 0) return;
      const sel = new Set(selectedIds);
      const moving = board.elements.filter((el) => sel.has(el.id) && !el.locked);
      if (moving.length === 0) return;
      const rest = board.elements.filter((el) => !moving.includes(el));
      const next = edge === 'front' ? [...rest, ...moving] : [...moving, ...rest];
      if (next.every((el, i) => el.id === board.elements[i]?.id)) return;
      history.record();
      dispatch({ type: 'whiteboard/update', id: board.id, patch: { elements: next } });
    },
    [board.elements, board.id, dispatch, history, selectedIds, isReadOnly],
  );

  /** Copies a deep link to this board (FigJam "Copy link to section"). Silent — no toast. */
  const copyBoardLink = useCallback(() => {
    if (isReadOnly) return;
    const url =
      typeof window === 'undefined'
        ? ''
        : `${window.location.origin}/project/${projectId}?tab=whiteboard&view=board&id=${board.id}`;
    try {
      void navigator.clipboard?.writeText(url);
    } catch {
      /* silent by design (D8: no transient notices) */
    }
  }, [board.id, isReadOnly, projectId]);

  /** Downloads the current selection (FigJam "Copy as PNG" / export selection). */
  const downloadSelection = useCallback(
    (kind: 'png' | 'svg') => {
      if (isReadOnly || selectedIds.length === 0) return;
      const elements = board.elements.filter((el) => selectedIds.includes(el.id));
      const sel = { ...board, elements };
      const refData = new Map(elements.map((el) => [el.id, refDataMap.get(el.id) ?? null] as const));
      try {
        if (kind === 'png') {
          downloadWhiteboardPng(sel, refData, {});
        } else {
          downloadWhiteboardSvg(sel, refData, {});
        }
      } catch {
        /* silent by design (D8: no transient notices) */
      }
    },
    [board, isReadOnly, refDataMap, selectedIds],
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

  /** Clones clipboard elements with fresh ids + remapped in-selection edges. */
  const cloneWithFreshIds = useCallback((source: WhiteboardElement[], offset: number): WhiteboardElement[] => {
    const idMap = new Map<string, string>();
    const pasted = source.map((el) => {
      const next = { ...el, id: newId() };
      idMap.set(el.id, next.id);
      return next;
    });
    return pasted.map((el) => {
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
  }, []);

  const applyPaste = useCallback(
    (source: WhiteboardElement[], offset: number) => {
      if (isReadOnly) return;
      if (source.length === 0) return;
      if (board.elements.length + source.length > MAX_ELEMENTS) {
        notifyAtCap();
        return;
      }
      const placed = cloneWithFreshIds(source, offset);
      history.record();
      dispatch({ type: 'whiteboard/update', id: board.id, patch: { elements: [...board.elements, ...placed] } });
      setSelectedIds(placed.map((el) => el.id));
      setClipboard(placed);
    },
    [board.elements, board.id, cloneWithFreshIds, dispatch, history, isReadOnly, notifyAtCap],
  );

  const pasteElements = useCallback(
    (offset: number) => {
      if (isReadOnly) return;
      if (!clipboard || clipboard.length === 0) return;
      applyPaste(clipboard, offset);
    },
    [applyPaste, clipboard, isReadOnly],
  );

  /** FigJam "Paste to replace": swaps the selection for the clipboard in one undo step. */
  const replaceSelection = useCallback(() => {
    if (isReadOnly) return;
    if (!clipboard || clipboard.length === 0 || selectedIds.length === 0) return;
    const sel = new Set(selectedIds);
    const lockedIds = new Set(board.elements.filter((el) => el.locked).map((el) => el.id));
    if (!board.elements.some((el) => sel.has(el.id) && !lockedIds.has(el.id))) return;
    const kept = board.elements.filter((el) => {
      if (lockedIds.has(el.id)) return true;
      if (sel.has(el.id)) return false;
      if (el.kind === 'edge' && ((el.sourceNodeId && sel.has(el.sourceNodeId) && !lockedIds.has(el.sourceNodeId)) || (el.targetNodeId && sel.has(el.targetNodeId) && !lockedIds.has(el.targetNodeId)))) {
        return false;
      }
      return true;
    });
    if (kept.length + clipboard.length > MAX_ELEMENTS) {
      notifyAtCap();
      return;
    }
    const placed = cloneWithFreshIds(clipboard, 0);
    setCollapsedRefs((prev) => {
      const keep = new Set<string>();
      for (const el of kept) if (el.kind === 'ref' && prev.has(el.id)) keep.add(el.id);
      return keep.size === prev.size ? prev : keep;
    });
    history.record();
    dispatch({ type: 'whiteboard/update', id: board.id, patch: { elements: [...kept, ...placed] } });
    setSelectedIds(placed.map((el) => el.id));
    setClipboard(placed);
  }, [board.elements, board.id, clipboard, cloneWithFreshIds, dispatch, history, isReadOnly, selectedIds, notifyAtCap]);

  /** Bulk-applies a patch to every selected, unlocked element that owns each field. */
  const applyBulkPatch = useCallback(
    (patch: Record<string, unknown>) => {
      if (isReadOnly || selectedIds.length === 0) return;
      const sel = new Set(selectedIds);
      const keys = Object.keys(patch);
      // Optional model fields may be absent on legacy elements — still writable.
      const optional: ReadonlySet<string> = OPTIONAL_PATCH_FIELDS;
      const next = board.elements.map((el) => {
        if (!sel.has(el.id) || el.locked) return el;
        const sub: Record<string, unknown> = {};
        for (const k of keys) {
          if (k in el || optional.has(k)) sub[k] = patch[k];
        }
        if (Object.keys(sub).length === 0) return el;
        return { ...el, ...sub };
      });
      if (next.every((el, i) => el === board.elements[i])) return;
      history.record();
      dispatch({ type: 'whiteboard/update', id: board.id, patch: { elements: next } });
    },
    [board.elements, board.id, dispatch, history, isReadOnly, selectedIds],
  );

  const unlockAll = useCallback(() => {
    if (isReadOnly) return;
    if (!board.elements.some((el) => el.locked)) return;
    history.record();
    dispatch({
      type: 'whiteboard/update',
      id: board.id,
      patch: { elements: board.elements.map((el) => (el.locked ? ({ ...el, locked: false } as WhiteboardElement) : el)) },
    });
  }, [board.elements, board.id, dispatch, history, isReadOnly]);

  const onDistribute = useCallback(
    (axis: 'x' | 'y') => () => {
      if (isReadOnly) return;
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
    [board.elements, board.id, dispatch, history, selectedIds, isReadOnly],
  );

  const onMatchSize = useCallback(
    (mode: MatchSizeMode) => () => {
      if (isReadOnly) return;
      const moves = matchSizeSelection(
        board.elements.map((el) => ({ id: el.id, ...elementBounds(el) })),
        selectedIds,
        mode,
      );
      if (moves.size === 0) return;
      const next = board.elements.map((el) => {
        const size = moves.get(el.id);
        if (size === undefined || el.locked) return el;
        if (el.kind === 'edge' || el.kind === 'stroke') return el;
        if (el.kind === 'text') return { ...el, w: Math.min(Math.max(20, size.w), 2000) };
        return { ...el, w: size.w, h: size.h };
      });
      history.record();
      dispatch({ type: 'whiteboard/update', id: board.id, patch: { elements: next } });
    },
    [board.elements, board.id, dispatch, history, selectedIds, isReadOnly],
  );

  const onAlign = useCallback(
    (mode: AlignMode) => () => {
      if (isReadOnly) return;
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
    [board.elements, board.id, dispatch, history, selectedIds, isReadOnly],
  );

  /** Icon-only floating-bar button with a custom tooltip (no native caption). */
  const barBtn = (tip: string, onClick: () => void, icon: ReactNode) => (
    <Tooltip content={tip} side="top">
      <button type="button" className="wb-selection-btn" aria-label={tip} onClick={onClick}>
        {icon}
      </button>
    </Tooltip>
  );

  /**
   * Mobile bottom panel: all property controls inline, wrapping to the next
   * row when they overflow (FigJam-style grid). The ⋮ actions button is
   * appended once at the end of the last bar (moreBtn). Desktop unchanged.
   * Children.toArray re-keys, so callers pass plain nodes without manual keys.
   */
  const maybeSplit = (...controls: ReactNode[]) => {
    return <>{Children.toArray(controls)}</>;
  };

  /** ⋮ button opening the actions sheet; rendered once at the end of the last bar. */
  const moreBtn = isMobileProp ? (
    <Tooltip content={t('whiteboard.toolbar.moreTools')} side="top">
      <button
        type="button"
        className="wb-selection-btn"
        aria-label={t('whiteboard.toolbar.moreTools')}
        aria-haspopup="dialog"
        aria-expanded={moreSheet}
        onClick={() => setMoreSheet((v) => !v)}
      >
        <DotsThreeVertical size={15} aria-hidden="true" />
      </button>
    </Tooltip>
  ) : null;

  interface SheetAction {
    id: string;
    icon: ReactNode;
    label: string;
    disabled: boolean;
    danger?: boolean;
    run: () => void;
  }

  /** Mobile ⋮ sheet: all selection actions, scrollable. */
  const renderMoreSheet = () => {
    if (!isMobileProp || !moreSheet) return null;
    const hasSel = selectedIds.length > 0;
    const hasClip = !!clipboard && clipboard.length > 0;
    const hasLocked = board.elements.some((el) => selectedIds.includes(el.id) && el.locked);
    const anyLocked = board.elements.some((el) => el.locked);
    const grouped = board.elements.some((el) => selectedIds.includes(el.id) && el.groupId);
    const runSheet = (fn: () => void) => () => {
      fn();
      setMoreSheet(false);
    };
    const duplicateSel = () => {
      const src = copiedElements();
      if (src.length === 0) return;
      setClipboard(src);
      applyPaste(src, 24);
    };
    const quick: SheetAction[] = [
      { id: 'duplicate', icon: <Copy size={20} aria-hidden="true" />, label: t('whiteboard.ctx.duplicate'), disabled: !hasSel || isReadOnly, run: duplicateSel },
      { id: 'group', icon: <SquaresFour size={20} aria-hidden="true" />, label: grouped ? t('whiteboard.canvas.ungroup') : t('whiteboard.canvas.group'), disabled: !hasSel || isReadOnly, run: grouped ? onUngroup : onGroup },
      { id: 'png', icon: <Image size={20} aria-hidden="true" />, label: t('whiteboard.export.pngSelection'), disabled: !hasSel, run: () => downloadSelection('png') },
      { id: 'link', icon: <Link size={20} aria-hidden="true" />, label: t('whiteboard.ctx.copyLink'), disabled: !hasSel, run: copyBoardLink },
    ];
    const rows: SheetAction[] = [
      { id: 'copy', icon: <Copy size={18} aria-hidden="true" />, label: t('whiteboard.ctx.copy'), disabled: !hasSel, run: copySelection },
      { id: 'cut', icon: <Scissors size={18} aria-hidden="true" />, label: t('whiteboard.ctx.cut'), disabled: !hasSel || isReadOnly, run: () => { copySelection(); removeSelection(); } },
      { id: 'paste', icon: <ClipboardText size={18} aria-hidden="true" />, label: t('whiteboard.ctx.paste'), disabled: !hasClip || isReadOnly, run: () => pasteElements(24) },
      { id: 'svg', icon: <DownloadSimple size={18} aria-hidden="true" />, label: t('whiteboard.export.svgSelection'), disabled: !hasSel, run: () => downloadSelection('svg') },
      { id: 'front', icon: <ArrowLineUp size={18} aria-hidden="true" />, label: t('whiteboard.ctx.bringFront'), disabled: !hasSel || isReadOnly, run: () => reorderToEdge('front') },
      { id: 'forward', icon: <ArrowUp size={18} aria-hidden="true" />, label: t('whiteboard.canvas.bringForward'), disabled: !hasSel || isReadOnly, run: () => reorderSelection(1) },
      { id: 'backward', icon: <ArrowDown size={18} aria-hidden="true" />, label: t('whiteboard.canvas.sendBackward'), disabled: !hasSel || isReadOnly, run: () => reorderSelection(-1) },
      { id: 'back', icon: <ArrowLineDown size={18} aria-hidden="true" />, label: t('whiteboard.ctx.sendBack'), disabled: !hasSel || isReadOnly, run: () => reorderToEdge('back') },
      { id: 'lock', icon: hasLocked ? <LockOpen size={18} aria-hidden="true" /> : <LockKey size={18} aria-hidden="true" />, label: hasLocked ? t('whiteboard.canvas.unlock') : t('whiteboard.canvas.lock'), disabled: !hasSel || isReadOnly, run: onToggleLock },
      { id: 'unlockAll', icon: <LockOpen size={18} aria-hidden="true" />, label: t('whiteboard.canvas.unlockAll'), disabled: !anyLocked || isReadOnly, run: unlockAll },
      { id: 'delete', icon: <Trash size={18} aria-hidden="true" />, label: t('whiteboard.canvas.deleteSelected'), disabled: !hasSel || isReadOnly, danger: true, run: removeSelection },
    ];
    return (
      <BottomSheet open title={t('whiteboard.toolbar.moreTools')} onClose={() => setMoreSheet(false)} hideHeader>
        <div className="wb-moresheet-grid" role="group" aria-label={t('whiteboard.toolbar.moreTools')}>
          {quick.map((a) => (
            <button key={a.id} type="button" className="wb-moresheet-cell" disabled={a.disabled} onClick={runSheet(a.run)}>
              {a.icon}
              <span className="wb-moresheet-cellname">{a.label}</span>
            </button>
          ))}
        </div>
        <div className="wb-moresheet-sep" role="separator" aria-hidden="true" />
        <div className="wb-moresheet-list" role="group" aria-label={t('whiteboard.ctx.menu')}>
          {rows.map((a) => (
            <button key={a.id} type="button" className={`wb-moresheet-row${a.danger ? ' wb-moresheet-danger' : ''}`} disabled={a.disabled} onClick={runSheet(a.run)}>
              {a.icon}
              <span className="wb-moresheet-rowname">{a.label}</span>
            </button>
          ))}
        </div>
      </BottomSheet>
    );
  };

  const onToggleLock = useCallback(() => {
    if (isReadOnly) return;
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
  }, [board.elements, board.id, dispatch, history, selectedIds, isReadOnly]);

  const onGroup = useCallback(() => {
    if (isReadOnly) return;
    const members = board.elements.filter((el) => selectedIds.includes(el.id) && !el.groupId && el.kind !== 'stroke');
    if (members.length < 2) return;
    const gid = newId();
    const next = board.elements.map((el) => (members.includes(el) ? ({ ...el, groupId: gid } as WhiteboardElement) : el));
    history.record();
    dispatch({ type: 'whiteboard/update', id: board.id, patch: { elements: next } });
  }, [board.elements, board.id, dispatch, history, selectedIds, isReadOnly]);

  const onUngroup = useCallback(() => {
    if (isReadOnly) return;
    const gids = new Set(
      board.elements.filter((el) => selectedIds.includes(el.id) && el.groupId).map((el) => el.groupId) as string[],
    );
    if (gids.size === 0) return;
    const next = board.elements.map((el) =>
      el.groupId && gids.has(el.groupId) ? ({ ...el, groupId: null } as WhiteboardElement) : el,
    );
    history.record();
    dispatch({ type: 'whiteboard/update', id: board.id, patch: { elements: next } });
  }, [board.elements, board.id, dispatch, history, selectedIds, isReadOnly]);

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
      if (mod && !e.shiftKey && e.key.toLowerCase() === 'v') {
        if (isReadOnly) return;
        e.preventDefault();
        pasteElements(24);
        return;
      }
      if (mod && e.key.toLowerCase() === 'd') {
        if (isReadOnly) return;
        if (selectedIds.length === 0) return;
        e.preventDefault();
        const src = copiedElements();
        setClipboard(src);
        applyPaste(src, 24);
        return;
      }
      if (mod && e.shiftKey && e.key.toLowerCase() === 'r') {
        if (isReadOnly) return;
        if (selectedIds.length === 0) return;
        e.preventDefault();
        replaceSelection();
        return;
      }
      if (mod && e.shiftKey && e.key.toLowerCase() === 'v') {
        if (isReadOnly) return;
        if (selectedIds.length === 0) return;
        e.preventDefault();
        replaceSelection();
        return;
      }
      if (mod && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 'x') {
        if (isReadOnly) return;
        if (selectedIds.length === 0) return;
        e.preventDefault();
        copySelection();
        removeSelection();
        return;
      }
      if (mod && !e.altKey && e.key.toLowerCase() === 'g') {
        if (isReadOnly) return;
        if (selectedIds.length === 0) return;
        const sel = new Set(selectedIds);
        const grouped = board.elements.some((el) => sel.has(el.id) && (el as { groupId?: string | null }).groupId);
        e.preventDefault();
        if (e.shiftKey) onUngroup();
        else if (grouped) onUngroup();
        else onGroup();
        return;
      }
      if (mod && !e.altKey && (e.code === 'BracketRight' || e.code === 'BracketLeft')) {
        if (isReadOnly) return;
        if (selectedIds.length === 0) return;
        e.preventDefault();
        const forward = e.code === 'BracketRight';
        if (e.shiftKey) reorderToEdge(forward ? 'front' : 'back');
        else reorderSelection(forward ? 1 : -1);
        return;
      }
      if (mod && !e.shiftKey && !e.altKey && (e.key === '=' || e.key === '+' || e.key === '-' || e.key === '_' || e.key === '0')) {
        if (isReadOnly) return;
        e.preventDefault();
        if (e.key === '0') view.resetView();
        else view.zoomAt(e.key === '=' || e.key === '+' ? 1.25 : 1 / 1.25);
        return;
      }
      if (mod && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 'b') {
        if (isReadOnly) return;
        if (selectedIds.length === 0) return;
        const rich = board.elements.filter((el) => selectedIds.includes(el.id) && !el.locked && TEXT_EDITABLE.has(el.kind));
        if (rich.length === 0) return;
        e.preventDefault();
        const allBold = rich.every((el) => (el as { bold?: boolean | null }).bold);
        applyBulkPatch({ bold: !allBold });
        return;
      }
      if (e.code === 'Space' || e.key === ' ') {
        // Let focused controls (buttons, menu items, dialog widgets) keep Space activation.
        const t = e.target as HTMLElement | null;
        if (t && t !== e.currentTarget && typeof t.closest === 'function' && t.closest('button, a, input, select, textarea, [contenteditable], [role="menu"], [role="dialog"], [role="listbox"], [role="option"]')) return;
        e.preventDefault();
        setSpaceHeld(true);
        return;
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (isReadOnly) return;
        if (selectedIds.length === 0) return;
        e.preventDefault();
        removeSelection();
        return;
      }
      if (e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        if (isReadOnly) return;
        if (selectedIds.length === 0) return;
        e.preventDefault();
        const step = e.shiftKey ? 10 : 1;
        let dx = 0;
        let dy = 0;
        if (e.key === 'ArrowLeft') dx = -step;
        if (e.key === 'ArrowRight') dx = step;
        if (e.key === 'ArrowUp') dy = -step;
        if (e.key === 'ArrowDown') dy = step;
        const sel = new Set(selectedIds);
        const moveIds = new Set(selectedIds);
        const groupIds = new Set(board.elements.filter((el) => sel.has(el.id) && (el as any).groupId).map((el) => (el as any).groupId as string));
        for (const el of board.elements) {
          if ((el as any).groupId && groupIds.has((el as any).groupId)) moveIds.add(el.id);
        }
        const next = board.elements.map((el) => {
          if ((el as any).locked) return el;
          if (!moveIds.has(el.id)) return el;
          if ((el as any).kind === 'stroke') {
            return { ...el, points: (el as any).points.map(([x, y]: [number, number]) => [x + dx, y + dy] as [number, number]) };
          }
          if ((el as any).kind === 'edge') {
            if ((el as any).sourceNodeId || (el as any).targetNodeId) return el;
            return { ...el, x1: (el as any).x1 + dx, y1: (el as any).y1 + dy, x2: (el as any).x2 + dx, y2: (el as any).y2 + dy };
          }
          return { ...el, x: (el as any).x + dx, y: (el as any).y + dy };
        });
        history.record();
        dispatch({ type: 'whiteboard/update', id: board.id, patch: { elements: next } });
        return;
      }
      if (e.key === 'Escape') {
        // Cancel removes a just-placed empty sticky/text (old popover-cancel
        // behavior, kept through the inspector migration).
        if (!isReadOnly && selectedIds.length === 1) {
          const sel = board.elements.find((el) => el.id === selectedIds[0]);
          const txt = sel ? (sel as unknown as { text?: unknown }).text : undefined;
          if (sel && (sel.kind === 'sticky' || sel.kind === 'text') && (txt ?? '') === '') {
            history.record();
            dispatch({ type: 'whiteboard/update', id: board.id, patch: { elements: board.elements.filter((el) => el.id !== sel.id) } });
          }
        }
        setSelectedIds([]);
        setDragOffset(null);
        setCtxMenu(null);
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
  }, [selectedIds, removeSelection, copySelection, pasteElements, copiedElements, applyPaste, replaceSelection, board.elements, isReadOnly]);

  useEffect(() => {
    if (tool !== 'select' && tool !== 'marquee') {
      setSelectedIds([]);
      setDragOffset(null);
      resizeRef.current = null;
      setResizePreview(null);
      setCtxMenu(null);
      setTextZoneId(null);
      setEditingText(null);
      setBarPop(null);
      setMoreSheet(false);
      rotateDragRef.current = null;
      setRotateLive(null);
      marqueeRef.current = null;
      setMarquee(null);
    }
    // G1: entering the ref tool opens the picker at the viewport center;
    // leaving any tool closes it (never lingers across a tool switch).
    if (tool === 'ref' && !isReadOnly) {
      const vp = worldViewportRect(view.view, canvasSize.w, canvasSize.h);
      const center = { x: vp.x + vp.w / 2, y: vp.y + vp.h / 2 };
      setRefPending((prev) => prev ?? center);
    } else {
      setRefPending(null);
    }
  }, [tool]);

  // Floating popups belong to the current selection — never linger across it.
  // (Outside-dismiss is owned by each portal popup via floating-ui useDismiss.)
  useEffect(() => {
    setBarPop(null);
    setMoreSheet(false);
    if (selectedIds.length !== 1) setTextZoneId(null);
    if (editingText && !selectedIds.includes(editingText.id)) setEditingText(null);
  }, [selectedIds, board.id, editingText]);

  // S1: keep the measured bar inside the canvas (12px margins). Runs every
  // render; the guarded setState prevents loops. jsdom reports width 0, in
  // which case the adjustment is 0 and legacy clamping stands.
  useLayoutEffect(() => {
    const el = floatWrapRef.current;
    if (!el) return;
    const w = el.offsetWidth;
    if (w <= 0) {
      setBarAdj((prev) => (prev === 0 ? prev : 0));
      return;
    }
    const fx = floatFxRef.current;
    const W = canvasSize.w;
    const M = 12;
    let cx = fx;
    if (W - M * 2 < w) cx = W / 2;
    else if (fx - w / 2 < M) cx = M + w / 2;
    else if (fx + w / 2 > W - M) cx = W - M - w / 2;
    const adj = cx - fx;
    setBarAdj((prev) => (prev === adj ? prev : adj));
  });

  const worldAt = (e: ReactPointerEvent<SVGSVGElement>): Point => {
    const rect = e.currentTarget.getBoundingClientRect();
    return screenToWorld(view.view, e.clientX - rect.left, e.clientY - rect.top);
  };

  /** Advances the in-progress edge draft (edge tool or FigJam side-port drag). */
  const updateEdgeDraft = (e: ReactPointerEvent<SVGSVGElement>) => {
    const d = edgeDraftRef.current;
    if (!d) return;
    const next = { ...d, cur: worldAt(e) };
    edgeDraftRef.current = next;
    setEdgeDraft(next);
  };

  const startDraw = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (isReadOnly) return;
    if (e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const pt = worldAt(e);
    const next: DraftStroke = { tool: tool as 'pen' | 'eraser', points: [[pt.x, pt.y]] };
    draftRef.current = next;
    setDraft(next);
  };

  const moveDraw = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (isReadOnly) return;
    const current = draftRef.current;
    if (!current) return;
    const pt = worldAt(e);
    const next = { ...current, points: [...current.points, [pt.x, pt.y] as [number, number]] };
    draftRef.current = next;
    setDraft(next);
  };

  const endDraw = () => {
    if (isReadOnly) {
      draftRef.current = null;
      setDraft(null);
      return;
    }
    const current = draftRef.current;
    draftRef.current = null;
    setDraft(null);
    if (!current || !shouldCommitStroke(current.points)) return;
    if (current.tool === 'eraser') {
      const eraserW = eraserWidthProp ?? ERASER_WIDTH;
      const result = eraseStrokes(
        board.elements,
        current.points.map(([x, y]) => ({ x, y })),
        eraserW,
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
    if (board.elements.length >= MAX_ELEMENTS) {
      notifyAtCap();
      return;
    }
    history.record();
    const strokeColor = current.tool === 'pen' ? (penColorProp ?? drawColor(current.tool)) : drawColor(current.tool);
    const strokeWidth = current.tool === 'pen' ? (penWidthProp ?? drawWidth(current.tool)) : drawWidth(current.tool);
    dispatch({
      type: 'whiteboard/update',
      id: board.id,
      patch: { elements: [...board.elements, buildStroke(current.tool, current.points, strokeColor, strokeWidth)] },
    });
  };

  const cancelDraw = () => {
    draftRef.current = null;
    setDraft(null);
  };

  const placeElement = () => {
    const start = placeStartRef.current;
    placeStartRef.current = null;
    if (isReadOnly) return;
    if (!start || tool !== 'text' && tool !== 'sticky' && tool !== 'shape') return;
    const rect = view.ref.current?.getBoundingClientRect();
    if (!rect) return;
    const pt = screenToWorld(view.view, start.clientX - rect.left, start.clientY - rect.top);
    // WB-6: newborn elements respect the snap toggle like drags do.
    const spt = { x: snap(pt.x), y: snap(pt.y) };
    let placed: WhiteboardElement;
    if (tool === 'sticky') {
      const base = buildSticky(spt.x, spt.y, stickyColorProp ?? STICKY_COLOR, stickyTextColorProp ?? null);
      placed = { ...base, fontSize: Math.max(4, Math.min(96, stickyFontSizeProp ?? 12)), align: (stickyAlignProp as WhiteboardElement['kind'] extends never ? never : string) ?? 'left' } as WhiteboardElement;
      (placed as WhiteboardSticky).fontSize = Math.max(4, Math.min(96, stickyFontSizeProp ?? 12));
      (placed as WhiteboardSticky).align = (stickyAlignProp ?? 'left') as any;
    } else if (tool === 'shape') {
      const base = buildShape(spt.x, spt.y, shapeColorProp ?? SHAPE_COLOR, (shapeTypeProp as WhiteboardShapeType) ?? 'rect', shapeLabelColorProp ?? null);
      const withDefaults = {
        ...base,
        label: shapeLabelProp ?? '',
        fill: shapeFillProp ?? false,
        fontSize: Math.max(4, Math.min(96, shapeFontSizeProp ?? 12)),
        align: (shapeAlignProp ?? 'center') as any,
      } as WhiteboardElement;
      placed = withDefaults;
    } else {
      const base = buildText(spt.x, spt.y, textColorProp ?? TEXT_COLOR);
      placed = {
        ...base,
        fontSize: Math.max(4, Math.min(96, textFontSizeProp ?? 16)),
        align: (textAlignProp ?? 'left') as any,
        fontFamily: (textFontFamilyProp ?? 'simple') as WhiteboardFontFamily,
        bold: textBoldProp ?? false,
        strikethrough: textStrikeProp ?? false,
        list: (textBulletProp ? 'bullet' : 'none') as 'none' | 'bullet',
      } as WhiteboardElement;
    }
    if (board.elements.length >= MAX_ELEMENTS) {
      notifyAtCap();
      return;
    }
    history.record();
    dispatch({ type: 'whiteboard/update', id: board.id, patch: { elements: [...board.elements, placed] } });
    setSelectedIds([placed.id]);
    if (onToolChange) onToolChange('select');
  };

  /** FigJam drag-to-place: commits the drag rect as a shape. Tiny drags count
   * as a click and fall back to the fixed-size placement at the press point. */
  const commitShapeDraft = (d: { x1: number; y1: number; x2: number; y2: number }) => {
    if (isReadOnly) return;
    const w = Math.abs(d.x2 - d.x1);
    const h = Math.abs(d.y2 - d.y1);
    if (Math.max(w, h) < 8) {
      placeElement();
      return;
    }
    // This was a real drag — the click anchor must not double-place.
    placeStartRef.current = null;
    // WB-6: newborn elements respect the snap toggle like drags do.
    const x = snap(Math.min(d.x1, d.x2));
    const y = snap(Math.min(d.y1, d.y2));
    const base = buildShape(x, y, shapeColorProp ?? SHAPE_COLOR, (shapeTypeProp as WhiteboardShapeType) ?? 'rect', shapeLabelColorProp ?? null);
    const placed = {
      ...base,
      w,
      h,
      label: shapeLabelProp ?? '',
      fill: shapeFillProp ?? false,
      fontSize: Math.max(4, Math.min(96, shapeFontSizeProp ?? 12)),
      align: (shapeAlignProp ?? 'center') as any,
    } as WhiteboardElement;
    if (board.elements.length >= MAX_ELEMENTS) {
      notifyAtCap();
      return;
    }
    history.record();
    dispatch({ type: 'whiteboard/update', id: board.id, patch: { elements: [...board.elements, placed] } });
    setSelectedIds([placed.id]);
    if (onToolChange) onToolChange('select');
  };

  const commitDrag = () => {
    dragRef.current = null;
    setGuides(null);
    const off = dragOffset;
    setDragOffset(null);
    if (isReadOnly) return;
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
    if (isReadOnly) return;
    if (!d) return;
    const fromEl = board.elements.find((el) => el.id === d.fromId);
    if (!fromEl) return;
    const target = elementsAtPoint(board.elements, d.cur, EDGE_TOUCH_TOLERANCE, refRects, NO_BOUNDARY);
    // WB-6: dropping on empty space/self is a silent no-op no more.
    if (!target || target.id === d.fromId) {
      return;
    }
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
      color: edgeColorProp ?? DEFAULT_EDGE_COLOR,
      width: DEFAULT_EDGE_WIDTH,
      arrowhead: true,
      label: edgeLabelProp ?? '',
      arrowStyle: (edgeArrowStyleProp as WhiteboardEdge['arrowStyle']) ?? 'solid',
      dash: (edgeDashProp as WhiteboardEdge['dash']) ?? 'solid',
      fontSize: Math.max(4, Math.min(96, edgeFontSizeProp ?? 11)),
      align: (edgeAlignProp ?? 'center') as any,
      sourceNodeId: fromEl.id,
      targetNodeId: target.id,
      sourcePort,
      targetPort,
    };
    if (board.elements.length >= MAX_ELEMENTS) {
      notifyAtCap();
      return;
    }
    history.record();
    dispatch({ type: 'whiteboard/update', id: board.id, patch: { elements: [...board.elements, edge] } });
    // WB-6: select the new edge so its label is one click away in the inspector.
    setSelectedIds([edge.id]);
    if (onToolChange) onToolChange('select');
  };

  const placeRef = (entity: WhiteboardRefEntity, entityId: string) => {
    const pt = refPending;
    setRefPending(null);
    if (isReadOnly) return;
    if (!pt) return;
    if (board.elements.length >= MAX_ELEMENTS) {
      notifyAtCap();
      return;
    }
    history.record();
    dispatch({
      type: 'whiteboard/update',
      id: board.id,
      patch: { elements: [...board.elements, buildRef(pt.x, pt.y, entity, entityId)] },
    });
  };

  /** Text content accessors (sticky/text → text, shape/edge/boundary → label). */
  const textOf = (el: WhiteboardElement): string | null => {
    if (el.kind === 'sticky' || el.kind === 'text') return el.text;
    if (el.kind === 'shape' || el.kind === 'edge' || el.kind === 'boundary') return el.label;
    return null;
  };
  const textFontOf = (el: WhiteboardElement): number => {
    if (el.kind === 'text') return el.fontSize;
    if (el.kind === 'edge') return el.fontSize ?? 11;
    if (el.kind === 'sticky' || el.kind === 'shape' || el.kind === 'boundary') return el.fontSize ?? 12;
    return 12;
  };
  /** FigJam split: inner text area (text bar + inline edit) vs border/body (element bar). */
  const hitTextArea = (el: WhiteboardElement, pt: Point): boolean => {
    const pad = 8;
    if (el.kind === 'sticky') {
      return pointInRect(pt, { x: el.x + pad, y: el.y + pad, w: Math.max(1, el.w - pad * 2), h: Math.max(1, el.h - pad * 2) });
    }
    if (el.kind === 'text') {
      return pointInRect(pt, boundsFor(el));
    }
    if (el.kind === 'shape') {
      if (!el.label) return false;
      const fontSize = el.fontSize ?? 12;
      const innerW = Math.max(24, el.w - pad * 2);
      const lines = wrapToWidth(el.label, fontSize, innerW, 4);
      const h = lines.length * (fontSize + 2);
      return pointInRect(pt, { x: el.x + el.w / 2 - innerW / 2, y: el.y + el.h / 2 - h / 2, w: innerW, h });
    }
    if (el.kind === 'edge') {
      if (!el.label) return false;
      const ep = derivedEdges.get(el.id) ?? { x1: el.x1, y1: el.y1, x2: el.x2, y2: el.y2 };
      const mid = pathMidpoint([
        { x: ep.x1, y: ep.y1 },
        { x: ep.x2, y: ep.y2 },
      ]);
      return Math.hypot(pt.x - mid.x, pt.y - mid.y) <= 16;
    }
    if (el.kind === 'boundary') {
      if (!el.label) return false;
      const chipW = Math.min(el.label.length * 7.5 + 12, Math.max(20, el.w - 12));
      return pointInRect(pt, { x: el.x + 2, y: el.y - 10, w: chipW + 8, h: 28 });
    }
    return false;
  };

  const startTextEdit = (el: WhiteboardElement) => {
    if (isReadOnly) return;
    if (!TEXT_EDITABLE.has(el.kind) || el.locked) return;
    const current = textOf(el);
    if (current === null) return;
    setEditingText({ id: el.id, value: current });
    setBarPop(null);
  };

  /** FigJam Add-text: clicking the ghost selects and opens inline editing. */
  const ghostEdit = (target: WhiteboardElement) => {
    if (isReadOnly || target.locked) return;
    setSelectedIds([target.id]);
    setTextZoneId(target.id);
    startTextEdit(target);
  };

  const commitTextEdit = () => {
    const draft = editingText;
    setEditingText(null);
    if (isReadOnly || !draft) return;
    const el = board.elements.find((e) => e.id === draft.id);
    const field = el && (el.kind === 'sticky' || el.kind === 'text' ? 'text' : 'label');
    if (!el || !field || (el as unknown as Record<string, unknown>)[field] === draft.value) {
      if (el) setTextZoneId(el.id);
      return;
    }
    history.record();
    dispatch({
      type: 'whiteboard/update',
      id: board.id,
      patch: { elements: board.elements.map((e) => (e.id === draft.id ? { ...e, [field]: draft.value } : e)) },
    });
    setTextZoneId(draft.id);
  };

  const handlePointerDown = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (e.button !== 0) return;
    const pt = worldAt(e);
    // Touch long-press opens the object menu (no right button on touch).
    if (e.pointerType === 'touch' && !isReadOnly) {
      cancelLongPress();
      const cx = e.clientX;
      const cy = e.clientY;
      longPressRef.current = {
        timer: window.setTimeout(() => {
          longPressRef.current = null;
          openCtxMenuAt(cx, cy);
        }, 550),
        x: cx,
        y: cy,
      };
    }
    // FigJam-style adornment hit tests (screen space). Corner/port handles can
    // float over empty canvas, so the pan guard below must not swallow them.
    const hitResizeCorner = (): ResizeCorner | null => {
      if (selectedIds.length !== 1 || isReadOnly) return null;
      const target = board.elements.find((el) => el.id === selectedIds[0] && RESIZEABLE_KINDS.has(el.kind) && !el.locked);
      if (!target) return null;
      const b = boundsFor(target);
      const off = dragOffset ?? { dx: 0, dy: 0 };
      const rdeg = (target as { rotation?: number }).rotation ?? 0;
      const rc = rotationCenter(target, b);
      const screenPt = worldToScreen(view.view, pt.x, pt.y);
      for (const corner of RESIZE_CORNERS) {
        const hp = resizeCornerPoint(b, rc, rdeg, corner);
        const screenHandle = worldToScreen(view.view, hp.x + off.dx, hp.y + off.dy);
        if (Math.hypot(screenPt.x - screenHandle.x, screenPt.y - screenHandle.y) <= CORNER_HIT) return corner;
      }
      return null;
    };
    if (
      tool === 'view' ||
      spaceHeld
    ) {
      setSelectedIds([]);
      setDragOffset(null);
      panDragRef.current = true;
      view.onPointerDown(e);
      return;
    }
    e.currentTarget.setPointerCapture(e.pointerId);
    // Hit-first for place/ref/boundary tools: clicking an existing element
    // selects it and switches to select. Select has its own shift-aware logic
    // below (keeps multi-selection for group drags, resize handles); edge
    // starts drafts from nodes in the edge branch below.
    if (tool !== 'pen' && tool !== 'eraser' && tool !== 'marquee' && tool !== 'select' && tool !== 'edge') {
      const hitAny = elementsAtPoint(board.elements, pt, EDGE_TOUCH_TOLERANCE, refRects);
      if (hitAny) {
        const alreadySelected = selectedIds.includes(hitAny.id);
        if (!alreadySelected || selectedIds.length !== 1) {
          setSelectedIds([hitAny.id]);
        }
        setTextZoneId(hitTextArea(hitAny, pt) ? hitAny.id : null);
        if (onToolChange) onToolChange('select');
        // prepare drag for select
        if (!readOnly) {
          dragRef.current = { startWorld: pt, originals: new Map(board.elements.map((el) => [el.id, el])) };
        }
        setDragOffset(null);
        return;
      }
    }
    if (tool === 'select') {
      // FigJam-style corner resize (screen space, before element hit test).
      const corner = hitResizeCorner();
      if (corner) {
        const target = board.elements.find((el) => el.id === selectedIds[0])!;
        const b = boundsFor(target);
        resizeRef.current = {
          startWorld: pt,
          startW: b.w,
          startH: b.h,
          startX: b.x,
          startY: b.y,
          corner,
          aspect: b.h === 0 ? 1 : b.w / b.h,
        };
        return;
      }
      // FigJam rotate gesture: zone beside the corners (shape/text only —
        // FigJam forbids sticky rotation).
      if (selectedIds.length === 1 && !isReadOnly && !editingText) {
        const target = board.elements.find((el) => el.id === selectedIds[0]);
        if (target && (target.kind === 'shape' || target.kind === 'text') && !target.locked) {
          const b = boundsFor(target);
          const off = dragOffset ?? { dx: 0, dy: 0 };
          const rdeg = (target as { rotation?: number }).rotation ?? 0;
          const rc = rotationCenter(target, b);
          const screenPt = worldToScreen(view.view, pt.x, pt.y);
          const rcScreen = worldToScreen(view.view, rc.x + off.dx, rc.y + off.dy);
          for (const c of RESIZE_CORNERS) {
            const hp = resizeCornerPoint(b, rc, rdeg, c);
            const sp = worldToScreen(view.view, hp.x + off.dx, hp.y + off.dy);
            if (inRotateZone(screenPt, sp, rcScreen)) {
              rotateDragRef.current = {
                id: target.id,
                center: { x: rc.x + off.dx, y: rc.y + off.dy },
                startAng: (Math.atan2(pt.y - (rc.y + off.dy), pt.x - (rc.x + off.dx)) * 180) / Math.PI,
                startRot: rdeg,
              };
              setHoverRotate(false);
              return;
            }
          }
        }
      }
      const hit = elementsAtPoint(board.elements, pt, EDGE_TOUCH_TOLERANCE, refRects);
      if (!hit) {
        // WB-7: empty-drag in select starts a marquee (pan via Space/view tool).
        // Viewers keep pan-on-empty for navigation.
        if (isReadOnly) {
          setSelectedIds([]);
          setTextZoneId(null);
          setDragOffset(null);
          panDragRef.current = true;
          view.onPointerDown(e);
          return;
        }
        const m = { x1: pt.x, y1: pt.y, x2: pt.x, y2: pt.y, shift: e.shiftKey };
        marqueeRef.current = m;
        setMarquee(m);
        return;
      }
      if (hit.kind === 'ref' && !e.shiftKey) {
        const b = boundsFor(hit);
        const t = REF_LAYOUT.toggle;
        // WB-8: 20px effective hit area (visual stays 14px).
        const pad = 3;
        if (pointInRect(pt, { x: b.x + b.w - t.rightOff - pad, y: b.y + t.topOff - pad, w: t.w + pad * 2, h: t.h + pad * 2 })) {
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
      // FigJam split: inner text area → text bar, border/body → element bar.
      setTextZoneId(!e.shiftKey && nextSel.length === 1 && hitTextArea(hit, pt) ? hit.id : null);
      if (!readOnly) {
        dragRef.current = { startWorld: pt, originals: new Map(board.elements.map((el) => [el.id, el])) };
      }
      setDragOffset(null);
      return;
    }
    if (tool === 'pen' || tool === 'eraser') {
      if (isReadOnly) return;
      startDraw(e);
      return;
    }
    if (isPlaceTool) {
      if (isReadOnly) return;
      e.currentTarget.setPointerCapture(e.pointerId);
      placeStartRef.current = { clientX: e.clientX, clientY: e.clientY };
      if (tool === 'shape') {
        // FigJam drag-to-place: the live preview scales until pointerup.
        cancelLongPress();
        setShapeDraft({ x1: pt.x, y1: pt.y, x2: pt.x, y2: pt.y });
      }
      return;
    }
    if (tool === 'edge') {
      if (isReadOnly) return;
      const hit = elementsAtPoint(board.elements, pt, EDGE_TOUCH_TOLERANCE, refRects, NO_BOUNDARY);
      if (!hit || hit.kind === 'edge') return;
      const d: EdgeDraft = { fromId: hit.id, fromBounds: boundsFor(hit), cur: pt };
      edgeDraftRef.current = d;
      setEdgeDraft(d);
      return;
    }
    if (tool === 'boundary') {
      if (isReadOnly) return;
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
      if (isReadOnly) return;
      setRefPending(pt);
      return;
    }
  };

  // FigJam rotate gesture commit — shared by the canvas ring-drag and the
  // mobile floating rotate handle (both feed rotateDragRef/rotateLive).
  const commitRotateDrag = () => {
    const r = rotateDragRef.current;
    const preview = rotateLive;
    rotateDragRef.current = null;
    setRotateLive(null);
    if (!r || isReadOnly) return;
    if (preview !== null && preview !== r.startRot) {
      history.record();
      dispatch({
        type: 'whiteboard/update',
        id: board.id,
        patch: {
          elements: board.elements.map((el) => (el.id === r.id ? { ...el, rotation: preview } : el)),
        },
      });
    }
  };

  const handlePointerMove = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (spaceHeld || panDragRef.current) {
      view.onPointerMove(e);
      return;
    }
    if (longPressRef.current) {
      const lp = longPressRef.current;
      if (Math.hypot(e.clientX - lp.x, e.clientY - lp.y) > 12) cancelLongPress();
    }
    // FigJam-style port draft (started from a side dot) updates regardless of tool.
    if (edgeDraftRef.current) {
      if (isReadOnly) return;
      updateEdgeDraft(e);
      return;
    }
    if (tool === 'select') {
      if (isReadOnly) {
        // suppress all mutating previews for viewer
        if (resizeRef.current) setResizePreview(null);
        if (rotateDragRef.current) {
          rotateDragRef.current = null;
          setRotateLive(null);
        }
        return;
      }
      const pt = worldAt(e);
      // FigJam rotate gesture: live degrees while dragging the ring.
      if (rotateDragRef.current) {
        const r = rotateDragRef.current;
        const ang = (Math.atan2(pt.y - r.center.y, pt.x - r.center.x) * 180) / Math.PI;
        let delta = ang - r.startAng;
        while (delta > 180) delta -= 360;
        while (delta < -180) delta += 360;
        setRotateLive(snapRotation(r.startRot + delta, e.shiftKey));
        return;
      }
      // Hover-only rotate affordance (no buttons pressed): cursor feedback.
      if (e.buttons === 0 && !dragRef.current && !marqueeRef.current && !resizeRef.current && selectedIds.length === 1 && !editingText) {
        const target = board.elements.find((el) => el.id === selectedIds[0]);
        let inRing = false;
        if (target && (target.kind === 'shape' || target.kind === 'text') && !target.locked) {
          const b = boundsFor(target);
          const rdeg = (target as { rotation?: number }).rotation ?? 0;
          const rc = rotationCenter(target, b);
          const screenPt = worldToScreen(view.view, pt.x, pt.y);
          const rcScreen = worldToScreen(view.view, rc.x, rc.y);
          for (const c of RESIZE_CORNERS) {
            const hp = resizeCornerPoint(b, rc, rdeg, c);
            const sp = worldToScreen(view.view, hp.x, hp.y);
            if (inRotateZone(screenPt, sp, rcScreen)) {
              inRing = true;
              break;
            }
          }
        }
        if (inRing !== hoverRotate) setHoverRotate(inRing);
      } else if (hoverRotate) {
        setHoverRotate(false);
      }
      if (resizeRef.current) {
        const r = resizeRef.current;
        const dx = pt.x - r.startWorld.x;
        const dy = pt.y - r.startWorld.y;
        // Fixed corner stays; the dragged corner follows the pointer (snapped).
        const fixedRight = r.corner === 'ne' || r.corner === 'se';
        const fixedBottom = r.corner === 'sw' || r.corner === 'se';
        let nw = fixedRight ? snap(r.startW + dx) : snap(r.startW - dx);
        let nh = fixedBottom ? snap(r.startH + dy) : snap(r.startH - dy);
        if (e.shiftKey) {
          // FigJam: Shift locks the aspect ratio around the fixed corner.
          const k = Math.max(nw / r.startW, nh / r.startH);
          nw = r.startW * k;
          nh = r.startH * k;
        }
        if (e.altKey) {
          // Alt resizes symmetrically around the center.
          const cx = r.startX + r.startW / 2;
          const cy = r.startY + r.startH / 2;
          nw = Math.max(RESIZE_MIN, nw);
          nh = Math.max(RESIZE_MIN, nh);
          setResizePreview({ x: cx - nw / 2, y: cy - nh / 2, w: nw, h: nh });
        } else {
          nw = Math.max(RESIZE_MIN, nw);
          nh = Math.max(RESIZE_MIN, nh);
          const nx = fixedRight ? r.startX : r.startX + r.startW - nw;
          const ny = fixedBottom ? r.startY : r.startY + r.startH - nh;
          setResizePreview({ x: nx, y: ny, w: nw, h: nh });
        }
        const target = selectedIds.length === 1 ? board.elements.find((el) => el.id === selectedIds[0]) : undefined;
        if (target?.kind === 'text') {
          const wrapW = Math.min(Math.max(RESIZE_MIN, nw), 2000);
          const nx = e.altKey ? r.startX + (r.startW - wrapW) / 2 : fixedRight ? r.startX : r.startX + r.startW - wrapW;
          setResizePreview({
            x: nx,
            y: r.startY,
            w: wrapW,
            h: wrapTextLines(target.text, target.fontSize, wrapW).length * textLineHeight(target.fontSize) + 2,
          });
        }
        return;
      }
      // WB-7: marquee started from select-tool empty-drag.
      if (marqueeRef.current) {
        const m = marqueeRef.current;
        const next = { ...m, x2: pt.x, y2: pt.y };
        marqueeRef.current = next;
        setMarquee(next);
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
      if (isReadOnly) return;
      moveDraw(e);
      return;
    }
    if (tool === 'edge') {
      if (isReadOnly) return;
      updateEdgeDraft(e);
      return;
    }
    if (tool === 'shape') {
      if (isReadOnly) return;
      if (!shapeDraft) return;
      const pt = worldAt(e);
      setShapeDraft({ ...shapeDraft, x2: snap(pt.x), y2: snap(pt.y) });
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
      if (isReadOnly) return;
      const d = boundaryDraft;
      if (!d) return;
      const pt = worldAt(e);
      const next = { ...d, x2: snap(pt.x), y2: snap(pt.y) };
      setBoundaryDraft(next);
      return;
    }
  };

  /** WB-7: shared marquee commit for the marquee tool and select-tool empty-drag. */
  const commitMarquee = () => {
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
  };

  const handlePointerUp = (_e: ReactPointerEvent<SVGSVGElement>) => {
    cancelLongPress();
    if (spaceHeld || panDragRef.current) {
      panDragRef.current = false;
      view.onPointerUp();
      return;
    }
    // FigJam-style port draft (started from a side dot) commits regardless of tool.
    if (edgeDraftRef.current) {
      commitEdge();
      return;
    }
    if (tool === 'marquee') {
      commitMarquee();
      return;
    }
    if (tool === 'select') {
      // WB-7: marquee started from empty-drag commits the same way.
      if (marqueeRef.current) {
        commitMarquee();
        return;
      }
      // FigJam rotate gesture commit.
      if (rotateDragRef.current) {
        commitRotateDrag();
        return;
      }
      if (resizeRef.current) {
        const preview = resizePreview;
        resizeRef.current = null;
        setResizePreview(null);
        if (isReadOnly) return;
        const targetId = selectedIds.length === 1 ? selectedIds[0] : null;
        if (preview && targetId) {
          history.record();
          const target = board.elements.find((el) => el.id === targetId);
          const patch = target?.kind === 'text' ? { x: preview.x, w: preview.w } : { x: preview.x, y: preview.y, w: preview.w, h: preview.h };
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
      if (isReadOnly) return;
      commitDrag();
      return;
    }
    if (tool === 'pen' || tool === 'eraser') {
      if (isReadOnly) return;
      endDraw();
      return;
    }
    if (isPlaceTool) {
      if (isReadOnly) {
        setShapeDraft(null);
        return;
      }
      if (tool === 'shape' && shapeDraft) {
        const d = shapeDraft;
        setShapeDraft(null);
        commitShapeDraft(d);
        return;
      }
      placeElement();
      return;
    }
    if (tool === 'edge') {
      if (isReadOnly) return;
      commitEdge();
      return;
    }
    if (tool === 'boundary') {
      const d = boundaryDraft;
      setBoundaryDraft(null);
      if (isReadOnly) return;
      if (!d) return;
      const x = Math.min(d.x1, d.x2);
      const y = Math.min(d.y1, d.y2);
      const w = Math.abs(d.x2 - d.x1);
      const h = Math.abs(d.y2 - d.y1);
      if (w < 40 || h < 40) {
        return;
      }
      if (board.elements.length >= MAX_ELEMENTS) {
        notifyAtCap();
        return;
      }
      history.record();
      const baseB = buildBoundary(x, y, w, h, boundaryColorProp ?? BOUNDARY_COLOR);
      const boundary = { ...baseB, label: boundaryLabelProp ?? '', labelColor: boundaryLabelColorProp ?? '#e4e4e7', fontSize: Math.max(4, Math.min(96, boundaryFontSizeProp ?? 12)), align: (boundaryAlignProp ?? 'left') as any } as typeof baseB;
      dispatch({ type: 'whiteboard/update', id: board.id, patch: { elements: [...board.elements, boundary] } });
      setSelectedIds([boundary.id]);
      if (onToolChange) onToolChange('select');
      return;
    }
  };

  const handlePointerCancel = (_e: ReactPointerEvent<SVGSVGElement>) => {
    cancelLongPress();
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
      rotateDragRef.current = null;
      setRotateLive(null);
      edgeDraftRef.current = null;
      setEdgeDraft(null);
      marqueeRef.current = null;
      setMarquee(null);
      return;
    }
    if (tool === 'pen' || tool === 'eraser') {
      cancelDraw();
      return;
    }
    if (isPlaceTool) {
      placeStartRef.current = null;
      setShapeDraft(null);
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
    if (isReadOnly) return;
    // FigJam: double-click selects; on text-capable kinds it also opens inline editing.
    setSelectedIds([hit.id]);
    if (TEXT_EDITABLE.has(hit.kind)) {
      setTextZoneId(hit.id);
      startTextEdit(hit);
    } else {
      setTextZoneId(null);
    }
  };

  /** FigJam right-click: selects the element under the cursor, then opens the object menu. */
  const handleContextMenu = (e: ReactMouseEvent<HTMLDivElement>) => {
    if (isReadOnly) return;
    e.preventDefault();
    openCtxMenuAt(e.clientX, e.clientY);
  };

  const ctxSections = (): Array<Array<{ id: string; label: string; shortcut?: string; danger?: boolean; disabled?: boolean; run: () => void }>> => {
    const hasSel = selectedIds.length > 0;
    const hasClip = !!clipboard && clipboard.length > 0;
    const hasLocked = board.elements.some((el) => selectedIds.includes(el.id) && el.locked);
    const hasGroup = board.elements.some((el) => selectedIds.includes(el.id) && el.groupId);
    const anyLocked = board.elements.some((el) => el.locked);
    return [
      [
        { id: 'copy', label: t('whiteboard.ctx.copy'), shortcut: 'Ctrl+C', disabled: !hasSel, run: copySelection },
        { id: 'cut', label: t('whiteboard.ctx.cut'), shortcut: 'Ctrl+X', disabled: !hasSel, run: () => { copySelection(); removeSelection(); } },
        { id: 'paste', label: t('whiteboard.ctx.paste'), shortcut: 'Ctrl+V', disabled: !hasClip, run: () => pasteElements(24) },
        { id: 'replace', label: t('whiteboard.ctx.pasteReplace'), shortcut: 'Ctrl+Shift+V', disabled: !hasSel || !hasClip, run: replaceSelection },
        {
          id: 'duplicate',
          label: t('whiteboard.ctx.duplicate'),
          shortcut: 'Ctrl+D',
          disabled: !hasSel,
          run: () => {
            const src = copiedElements();
            if (src.length === 0) return;
            setClipboard(src);
            applyPaste(src, 24);
          },
        },
      ],
      [
        { id: 'delete', label: t('whiteboard.canvas.deleteSelected'), shortcut: 'Del', danger: true, disabled: !hasSel, run: removeSelection },
      ],
      [
        { id: 'link', label: t('whiteboard.ctx.copyLink'), disabled: !hasSel, run: copyBoardLink },
        { id: 'png', label: t('whiteboard.export.pngSelection'), disabled: !hasSel, run: () => downloadSelection('png') },
        { id: 'svg', label: t('whiteboard.export.svgSelection'), disabled: !hasSel, run: () => downloadSelection('svg') },
      ],
      [
        { id: 'front', label: t('whiteboard.ctx.bringFront'), shortcut: 'Ctrl+Shift+]', disabled: !hasSel, run: () => reorderToEdge('front') },
        { id: 'forward', label: t('whiteboard.canvas.bringForward'), shortcut: 'Ctrl+]', disabled: !hasSel, run: () => reorderSelection(1) },
        { id: 'backward', label: t('whiteboard.canvas.sendBackward'), shortcut: 'Ctrl+[', disabled: !hasSel, run: () => reorderSelection(-1) },
        { id: 'back', label: t('whiteboard.ctx.sendBack'), shortcut: 'Ctrl+Shift+[', disabled: !hasSel, run: () => reorderToEdge('back') },
      ],
      [
        {
          id: 'group',
          label: hasGroup ? t('whiteboard.canvas.ungroup') : t('whiteboard.canvas.group'),
          shortcut: hasGroup ? 'Ctrl+Shift+G' : 'Ctrl+G',
          disabled: !hasSel,
          run: hasGroup ? onUngroup : onGroup,
        },
        {
          id: 'lock',
          label: hasLocked ? t('whiteboard.canvas.unlock') : t('whiteboard.canvas.lock'),
          disabled: !hasSel,
          run: onToggleLock,
        },
        { id: 'unlockAll', label: t('whiteboard.canvas.unlockAll'), disabled: !anyLocked, run: unlockAll },
      ],
    ];
  };

  const handleCanvasKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (isReadOnly) return;
    if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey) {
      if (e.target !== e.currentTarget) return;
      // FigJam: Enter edits the selected text, like double-click.
      if (tool === 'select' && selectedIds.length === 1) {
        const sel = board.elements.find((el) => el.id === selectedIds[0]);
        if (sel && TEXT_EDITABLE.has(sel.kind) && !sel.locked) {
          e.preventDefault();
          setTextZoneId(sel.id);
          startTextEdit(sel);
          return;
        }
      }
      const placeTools: WbTool[] = ['sticky', 'text', 'shape', 'boundary', 'ref'];
      if (!placeTools.includes(tool)) return;
      if (e.target !== e.currentTarget) return;
      e.preventDefault();
      const el = view.ref.current;      if (!el) return;
      const rect = el.getBoundingClientRect();
      const cx = rect.width / 2;
      const cy = rect.height / 2;
      const world = screenToWorld(view.view, cx, cy);
      if (tool === 'ref') {
        setRefPending(world);
        return;
      }
      if (board.elements.length >= MAX_ELEMENTS) {
        notifyAtCap();
        return;
      }
      let newEl: WhiteboardElement | null = null;
      if (tool === 'sticky')
        newEl = buildSticky(world.x - STICKY_W / 2, world.y - STICKY_H / 2, stickyColorProp ?? STICKY_COLOR, stickyTextColorProp ?? null) as WhiteboardElement;
      else if (tool === 'text') newEl = buildText(world.x, world.y, textColorProp ?? TEXT_COLOR) as WhiteboardElement;
      else if (tool === 'shape')
        newEl = buildShape(
          world.x - SHAPE_W / 2,
          world.y - SHAPE_H / 2,
          shapeColorProp ?? SHAPE_COLOR,
          (shapeTypeProp as unknown as WhiteboardShape['shapeType']) ?? 'rect',
          shapeLabelColorProp ?? null,
        ) as WhiteboardElement;
      else if (tool === 'boundary')
        newEl = {
          ...buildBoundary(world.x - 150, world.y - 100, 300, 200, boundaryColorProp ?? BOUNDARY_COLOR),
          label: boundaryLabelProp ?? '',
          labelColor: boundaryLabelColorProp ?? '#e4e4e7',
          fontSize: Math.max(4, Math.min(96, boundaryFontSizeProp ?? 12)),
          align: (boundaryAlignProp ?? 'left') as WhiteboardBoundary['align'],
        } as WhiteboardElement;
      if (!newEl) return;
      history.record();
      dispatch({ type: 'whiteboard/update', id: board.id, patch: { elements: [...board.elements, newEl] } });
      setSelectedIds([newEl.id]);
      onToolChange?.('select');
    }
  };

  return (
    <div
      className="wb-canvas"
      role="group"
      aria-label={t('whiteboard.canvas.label', { name: board.name, count: board.elements.length })}
      tabIndex={0}
      onKeyDown={handleCanvasKeyDown}
      onContextMenu={handleContextMenu}
    >
      <svg
        ref={view.ref}
        className={`wb-svg ${view.dragging ? 'dragging' : ''}`}
        style={{ cursor: view.dragging || spaceHeld ? 'grabbing' : hoverRotate || rotateLive !== null ? ROTATE_CURSOR : TOOL_CURSOR[tool] }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
        onDoubleClick={handleDoubleClick}
      >
        <g transform={`translate(${view.view.x} ${view.view.y}) scale(${view.view.s})`}>
          {visibleElements.map((el) => (
            <ElementView
              key={el.id}
              el={rotateDragRef.current?.id === el.id && rotateLive !== null ? ({ ...el, rotation: rotateLive } as WhiteboardElement) : el}
              selected={selectedSet.has(el.id)}
              editing={editingText?.id === el.id}
              onGhostEdit={ghostEdit}
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
                  <circle key={i} cx={p[0]} cy={p[1]} r={(eraserWidthProp ?? ERASER_WIDTH) / 2} fill="rgba(138,138,147,0.35)" />
                ))}
              </g>
            ) : (
              <polyline
                points={draft.points.map((p) => `${p[0]},${p[1]}`).join(' ')}
                fill="none"
                stroke={draft.tool === 'pen' ? (penColorProp ?? drawColor(draft.tool)) : drawColor(draft.tool)}
                strokeWidth={draft.tool === 'pen' ? (penWidthProp ?? drawWidth(draft.tool)) : drawWidth(draft.tool)}
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
          {shapeDraft &&
            (() => {
              const x = Math.min(shapeDraft.x1, shapeDraft.x2);
              const y = Math.min(shapeDraft.y1, shapeDraft.y2);
              const w = Math.abs(shapeDraft.x2 - shapeDraft.x1);
              const h = Math.abs(shapeDraft.y2 - shapeDraft.y1);
              const ghost = {
                kind: 'shape',
                shapeType: (shapeTypeProp as WhiteboardShapeType) ?? 'rect',
                x,
                y,
                w,
                h,
                color: shapeColorProp ?? SHAPE_COLOR,
                fill: shapeFillProp ?? false,
              } as WhiteboardShape;
              return (
                <path
                  d={shapePath(ghost)}
                  fill={ghost.fill ? ghost.color : 'none'}
                  fillOpacity={ghost.fill ? 0.15 : undefined}
                  stroke="var(--accent)"
                  strokeWidth={1.5}
                  strokeDasharray="6 4"
                  pointerEvents="none"
                  data-testid="wb-shape-draft"
                />
              );
            })()}
          {(resizeRef.current || null) && resizePreview && resizeRef.current && (
            <rect
              x={resizePreview.x}
              y={resizePreview.y}
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
            // FigJam-style adornments: 4 corner scale squares + 4 side port
            // dots, all in the element's rotated frame (single rotation —
            // points are unrotated here, the wrapper <g> applies the turn).
            const target = selectedIds.length === 1 ? (board.elements.find((el) => el.id === selectedIds[0]) ?? null) : null;
            if (!target || isReadOnly || editingText) return null;
            const canResize = RESIZEABLE_KINDS.has(target.kind) && !target.locked;
            const canConnect = CONNECTABLE_KINDS.has(target.kind) && !target.locked;
            if (!canResize && !canConnect) return null;
            const b = boundsFor(target);
            const off = dragOffset ?? { dx: 0, dy: 0 };
            const s = Math.max(0.3, view.view.s);
            const handleSize = 10 / s;
            const liveRot = rotateDragRef.current?.id === target.id ? rotateLive : null;
            const shownRot = liveRot ?? (target as { rotation?: number }).rotation ?? 0;
            const c = rotationCenter(target, b);
            const rotAttr = shownRot ? `rotate(${shownRot}, ${c.x}, ${c.y})` : undefined;
            const portR = PORT_R / s;
            const startPortDraft = (clientX: number, clientY: number) => {
              const svg = view.ref.current;
              if (!svg) return;
              const rect = svg.getBoundingClientRect();
              const p = screenToWorld(view.view, clientX - rect.left, clientY - rect.top);
              const d = { fromId: target.id, fromBounds: boundsFor(target), cur: p };
              edgeDraftRef.current = d;
              setEdgeDraft(d);
            };
            const portAt = (side: 'top' | 'right' | 'bottom' | 'left'): Point =>
              side === 'top'
                ? { x: b.x + b.w / 2, y: b.y }
                : side === 'right'
                  ? { x: b.x + b.w, y: b.y + b.h / 2 }
                  : side === 'bottom'
                    ? { x: b.x + b.w / 2, y: b.y + b.h }
                    : { x: b.x, y: b.y + b.h / 2 };
            const boxCorner = (corner: ResizeCorner): Point => ({
              x: corner === 'ne' || corner === 'se' ? b.x + b.w : b.x,
              y: corner === 'sw' || corner === 'se' ? b.y + b.h : b.y,
            });
            return (
              <g transform={`translate(${off.dx} ${off.dy})`}>
                <g transform={rotAttr}>
                  {canResize &&
                    RESIZE_CORNERS.map((corner) => {
                      const hp = boxCorner(corner);
                      const cursor = corner === 'nw' || corner === 'se' ? 'nwse-resize' : 'nesw-resize';
                      return (
                        <rect
                          key={corner}
                          x={hp.x - handleSize / 2}
                          y={hp.y - handleSize / 2}
                          width={handleSize}
                          height={handleSize}
                          fill="var(--bg-elevated)"
                          stroke="var(--accent)"
                          strokeWidth={1.5 / view.view.s}
                          style={{ cursor }}
                          pointerEvents="all"
                          onPointerDown={(e) => {
                            e.stopPropagation();
                            const svg = view.ref.current;
                            if (!svg) return;
                            svg.setPointerCapture?.(e.pointerId);
                            const rect = svg.getBoundingClientRect();
                            const pt = screenToWorld(view.view, e.clientX - rect.left, e.clientY - rect.top);
                            resizeRef.current = {
                              startWorld: pt,
                              startW: b.w,
                              startH: b.h,
                              startX: b.x,
                              startY: b.y,
                              corner,
                              aspect: b.h === 0 ? 1 : b.w / b.h,
                            };
                          }}
                          data-testid="wb-resize-handle"
                        />
                      );
                    })}
                  {canConnect &&
                    (['top', 'right', 'bottom', 'left'] as const).map((side) => {
                      const p = portAt(side);
                      return (
                        <g key={side}>
                          <circle
                            cx={p.x}
                            cy={p.y}
                            r={PORT_HIT / s}
                            fill="transparent"
                            pointerEvents="all"
                            style={{ cursor: 'crosshair' }}
                            onPointerDown={(e) => {
                              e.stopPropagation();
                              const svg = view.ref.current;
                              if (!svg) return;
                              try {
                                svg.setPointerCapture(e.pointerId);
                              } catch {
                                /* jsdom — moves still target the svg */
                              }
                              startPortDraft(e.clientX, e.clientY);
                            }}
                            data-testid="wb-port-handle"
                          >
                            <title>{t('whiteboard.canvas.edgeDropEmpty')}</title>
                          </circle>
                          <circle cx={p.x} cy={p.y} r={portR} fill="var(--accent)" pointerEvents="none" />
                        </g>
                      );
                    })}
                </g>
              </g>
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
      {!hideChrome && (
      <div className="erd-zoom" role="group" aria-label={t('whiteboard.canvas.zoomGroup')}>
        <Tooltip content={t('whiteboard.canvas.zoomIn')} side="top">
          <button
            type="button"
            className="erd-zoom-btn"
            aria-label={t('whiteboard.canvas.zoomIn')}
              onClick={() => view.zoomAt(1.25)}
          >
            <MagnifyingGlassPlus size={15} aria-hidden="true" />
          </button>
        </Tooltip>
        <Tooltip content={t('whiteboard.canvas.zoomOut')} side="top">
          <button
            type="button"
            className="erd-zoom-btn"
            aria-label={t('whiteboard.canvas.zoomOut')}
              onClick={() => view.zoomAt(1 / 1.25)}
          >
            <MagnifyingGlassMinus size={15} aria-hidden="true" />
          </button>
        </Tooltip>
        <Tooltip content={t('whiteboard.shortcuts.open')} side="top">
          <button
            type="button"
            className="erd-zoom-btn"
            aria-label={t('whiteboard.shortcuts.open')}
            aria-haspopup="dialog"
            onClick={() => onOpenShortcutsProp?.()}
          >
            <Keyboard size={15} aria-hidden="true" />
          </button>
        </Tooltip>
        <Tooltip content={t('whiteboard.canvas.resetView')} side="top">
          <button
            type="button"
            className="erd-zoom-btn"
            aria-label={t('whiteboard.canvas.resetView')}
            onClick={() => view.resetView()}
          >
            <CornersOut size={15} aria-hidden="true" />
          </button>
        </Tooltip>
      </div>
      )}
      {canEdit && !hideChrome && selectedIds.length > 0 && (() => {
        // WB-18: float the bar above the selection (below it when too close to the top).
        const sel = board.elements.filter((el) => selectedIds.includes(el.id));
        if (sel.length === 0) return null;
        const off = dragOffset ?? { dx: 0, dy: 0 };
        const b = unionBounds(
          sel.map((el) => {
            const r = boundsFor(el);
            return { x: r.x + off.dx, y: r.y + off.dy, w: r.w, h: r.h };
          }),
        );
        const topPt = worldToScreen(view.view, b.x + b.w / 2, b.y);
        const botPt = worldToScreen(view.view, b.x + b.w / 2, b.y + b.h);
        const GAP = 12;
        const below = topPt.y < 68;
        const fx = Math.min(Math.max(topPt.x, 120), Math.max(120, canvasSize.w - 120));
        const fy = below ? botPt.y + GAP : topPt.y - GAP;
        floatFxRef.current = fx;
        return (
        <div
          className="wb-floatwrap"
          ref={floatWrapRef}
          style={{ left: fx + barAdj, top: fy, transform: below ? 'translateX(-50%)' : 'translate(-50%,-100%)' }}
        >
          {selectedIds.length >= 2 && (
          <div
            className="wb-selection-bar"
            role="group"
            aria-label={t('whiteboard.canvas.alignTools')}
          >
            {maybeSplit(
              barBtn(t('whiteboard.canvas.alignLeft'), onAlign('left'), <AlignLeft size={15} aria-hidden="true" />),
              barBtn(t('whiteboard.canvas.alignCenterH'), onAlign('centerX'), <AlignCenterHorizontal size={15} aria-hidden="true" />),
              barBtn(t('whiteboard.canvas.alignRight'), onAlign('right'), <AlignRight size={15} aria-hidden="true" />),
              barBtn(t('whiteboard.canvas.alignTop'), onAlign('top'), <AlignTop size={15} aria-hidden="true" />),
              barBtn(t('whiteboard.canvas.alignMiddleV'), onAlign('middleY'), <AlignCenterVertical size={15} aria-hidden="true" />),
              barBtn(t('whiteboard.canvas.alignBottom'), onAlign('bottom'), <AlignBottom size={15} aria-hidden="true" />),
              ...(selectedIds.length >= 3
                ? [
                    barBtn(t('whiteboard.canvas.distributeH'), onDistribute('x'), <Columns size={15} aria-hidden="true" />),
                    barBtn(t('whiteboard.canvas.distributeV'), onDistribute('y'), <Rows size={15} aria-hidden="true" />),
                  ]
                : []),
              ...(selectedIds.length >= 2
                ? [
                    barBtn(t('whiteboard.canvas.matchWidth'), onMatchSize('width'), <ArrowsHorizontal size={15} aria-hidden="true" />),
                    barBtn(t('whiteboard.canvas.matchHeight'), onMatchSize('height'), <ArrowsVertical size={15} aria-hidden="true" />),
                  ]
                : []),
            )}
          </div>
          )}
          <div
            className="wb-selection-bar"
            role="group"
            aria-label={t('whiteboard.canvas.selectionActions')}
          >
            {selectedIds.length > 1 && (() => {
              const first = board.elements.find(
                (el): el is WhiteboardElement & { color: string } =>
                  selectedIds.includes(el.id) && !el.locked && 'color' in el && typeof (el as { color?: unknown }).color === 'string',
              );
              const cur = first?.color ?? '#e4e4e7';
              return (
                <ColorDropdown
                  value={cur}
                  open={barPop?.kind === 'fill'}
                  onToggle={() => setBarPop(barPop?.kind === 'fill' ? null : { kind: 'fill', field: 'color' })}
                  onClose={() => setBarPop(null)}
                  onPick={(c) => applyBulkPatch({ color: c })}
                  label={t('whiteboard.textbar.fill')}
                />
              );
            })()}
            {(() => {
              if (selectedIds.length !== 1) return null;
              const el = board.elements.find((e) => e.id === selectedIds[0]);
              if (!el || el.locked) return null;
              if (el.kind === 'ref') {
                const collapsed = collapsedRefs.has(el.id);
                return (
                  <>
                    <Tooltip content={collapsed ? t('whiteboard.canvas.expand') : t('whiteboard.canvas.collapse')} side="top">
                      <button
                        type="button"
                        className="wb-selection-btn"
                        aria-label={collapsed ? t('whiteboard.canvas.expand') : t('whiteboard.canvas.collapse')}
                        aria-pressed={collapsed}
                        onClick={() => toggleCollapse(el.id)}
                      >
                        {collapsed ? (
                          <CaretDown size={15} aria-hidden="true" />
                        ) : (
                          <CaretUp size={15} aria-hidden="true" />
                        )}
                      </button>
                    </Tooltip>
                    <Tooltip content={t('whiteboard.ctx.menu')} side="top">
                      <button
                        type="button"
                        className="wb-selection-btn"
                        aria-label={t('whiteboard.ctx.menu')}
                        aria-haspopup="menu"
                        onClick={(e) => {
                          const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
                          setCtxMenu({ x: r.left, y: r.bottom + 6 });
                        }}
                      >
                        <DotsThreeVertical size={15} aria-hidden="true" />
                      </button>
                    </Tooltip>
                  </>
                );
              }
              const rich = el as {
                fontFamily?: WhiteboardFontFamily | null;
                bold?: boolean | null;
                strikethrough?: boolean | null;
                list?: 'none' | 'bullet' | null;
                align?: WhiteboardAlign | null;
                valign?: WhiteboardValign | null;
              };
              const fs = textFontOf(el);
              const align: WhiteboardAlign = rich.align ?? (el.kind === 'shape' || el.kind === 'edge' ? 'center' : 'left');
              // Legacy look preserved when valign is null (sticky: top, shape: centered first line).
              const valign: WhiteboardValign = rich.valign ?? (el.kind === 'shape' ? 'center' : 'top');
              // Edge labels reuse the line color (edges own no labelColor field).
              const textField = (el.kind === 'sticky' ? 'textColor' : el.kind === 'text' || el.kind === 'edge' ? 'color' : 'labelColor') as 'color' | 'textColor' | 'labelColor';
              // V2 merged panel: text props join as soon as there is text or an edit is open.
              const isEditing = editingText?.id === el.id;
              const hasText =
                el.kind === 'sticky' || el.kind === 'text'
                  ? el.text !== ''
                  : el.kind === 'shape' || el.kind === 'edge' || el.kind === 'boundary'
                    ? el.label !== ''
                    : false;
              const showTextProps = el.kind === 'text' || hasText || isEditing;
              const togglePop = (kind: 'fill' | 'line' | 'font' | 'size' | 'align' | 'valign' | 'width' | 'shapeType' | 'border', field?: 'color' | 'textColor' | 'labelColor') => {
                setBarPop(barPop?.kind === kind ? null : { kind, field });
              };
              const colorDot = (field: 'color' | 'textColor' | 'labelColor', label: string) => {
                const cur = (el as unknown as Record<string, unknown>)[field];
                return (
                  <ColorDropdown
                    value={typeof cur === 'string' ? cur : null}
                    title={field === 'color' ? undefined : t('whiteboard.textbar.textColor')}
                    open={barPop?.kind === 'fill' && (barPop.field ?? 'color') === field}
                    onToggle={() => togglePop('fill', field)}
                    onClose={() => setBarPop(null)}
                    onPick={(c) => applyBulkPatch({ [field]: c })}
                    label={label}
                    glyph={field === 'color' ? 'dot' : 'letter'}
                  />
                );
              };
              const textControls = (withColor: boolean): ReactNode[] => [
                <FontDropdown
                  value={rich.fontFamily ?? 'simple'}
                  open={barPop?.kind === 'font'}
                  onToggle={() => togglePop('font')}
                  onClose={() => setBarPop(null)}
                  onPick={(f) => applyBulkPatch({ fontFamily: f })}
                />,
                <SizeDropdown
                  value={fs}
                  open={barPop?.kind === 'size'}
                  onToggle={() => togglePop('size')}
                  onClose={() => setBarPop(null)}
                  onPick={(s) => applyBulkPatch({ fontSize: s })}
                />,
                <TextStyleToggles
                  bold={!!rich.bold}
                  strikethrough={!!rich.strikethrough}
                  bullet={rich.list === 'bullet'}
                  onBold={() => applyBulkPatch({ bold: !rich.bold })}
                  onStrikethrough={() => applyBulkPatch({ strikethrough: !rich.strikethrough })}
                  onBullet={() => applyBulkPatch({ list: rich.list === 'bullet' ? 'none' : 'bullet' })}
                />,
                <AlignDropdown
                  value={align}
                  open={barPop?.kind === 'align'}
                  onToggle={() => togglePop('align')}
                  onClose={() => setBarPop(null)}
                  onChange={(a) => applyBulkPatch({ align: a })}
                />,
                ...((el.kind === 'sticky' || el.kind === 'shape'
                  ? [
                      <ValignDropdown
                        value={valign}
                        open={barPop?.kind === 'valign'}
                        onToggle={() => togglePop('valign')}
                        onClose={() => setBarPop(null)}
                        onChange={(v) => applyBulkPatch({ valign: v })}
                      />,
                    ]
                  : [])),
                ...(withColor ? [colorDot(textField, t('whiteboard.textbar.textColor'))] : []),
              ];
              const linePop = (label: string, edge: WhiteboardEdge) => (
                <DropdownShell
                  open={barPop?.kind === 'line'}
                  onToggle={() => togglePop('line')}
                  onClose={() => setBarPop(null)}
                  label={label}
                  popLabel={t('whiteboard.popover.lineStyle')}
                  button={
                    <>
                      <Minus size={15} aria-hidden="true" />
                      <DropCaret />
                    </>
                  }
                >
                  <WidthSlider
                    value={edge.width}
                    min={1}
                    max={20}
                    label={t('whiteboard.popover.lineWidth')}
                    onChange={(v) => applyBulkPatch({ width: v })}
                  />
                  <div className="fp-segmented" role="group" aria-label={t('whiteboard.popover.lineStyle')}>
                    {(['solid', 'dashed', 'dotted'] as const).map((d) => (
                      <button
                        key={d}
                        type="button"
                        role="radio"
                        aria-checked={(edge.dash ?? 'solid') === d}
                        className={`fp-seg${(edge.dash ?? 'solid') === d ? ' fp-seg-active' : ''}`}
                        onClick={() => applyBulkPatch({ dash: d })}
                      >
                        {d}
                      </button>
                    ))}
                  </div>
                  <div className="fp-segmented" role="group" aria-label={t('whiteboard.popover.arrowStyle')}>
                    {(['none', 'open', 'solid', 'diamond', 'circle'] as const).map((st) => (
                      <button
                        key={st}
                        type="button"
                        role="radio"
                        aria-checked={effectiveArrowStyle(edge) === st}
                        className={`fp-seg${effectiveArrowStyle(edge) === st ? ' fp-seg-active' : ''}`}
                        onClick={() => applyBulkPatch({ arrowStyle: st })}
                      >
                        {st}
                      </button>
                    ))}
                  </div>
                </DropdownShell>
              );
              const widthPop = (w: number, label: string, onPick: (v: number) => void) => (
                <DropdownShell
                  open={barPop?.kind === 'width'}
                  onToggle={() => togglePop('width')}
                  onClose={() => setBarPop(null)}
                  label={label}
                  popLabel={t('whiteboard.popover.lineWidth')}
                  button={
                    <>
                      <span className="wb-stripnum tabular" aria-hidden="true">
                        {Math.round(w)}
                      </span>
                      <DropCaret />
                    </>
                  }
                >
                  <WidthSlider value={w} min={1} max={20} label={t('whiteboard.popover.lineWidth')} onChange={onPick} />
                </DropdownShell>
              );
              const typePop = (shape: WhiteboardShape) => (
                <DropdownShell
                  open={barPop?.kind === 'shapeType'}
                  onToggle={() => togglePop('shapeType')}
                  onClose={() => setBarPop(null)}
                  label={t('whiteboard.popover.shapeType')}
                  popLabel={t('whiteboard.popover.shapeType')}
                  button={
                    <>
                      <ShapeThumb shapeType={shape.shapeType} size={15} />
                      <DropCaret />
                    </>
                  }
                >
                  <div className="wb-shapetype-scroll">
                    {SHAPE_LIBRARY_TABS.map((tb) => (
                      <div key={tb.id}>
                        <div className="wb-morerecent-head" role="presentation">
                          <span>{t(tb.labelKey)}</span>
                        </div>
                        <div className="wb-shapetype-grid" role="radiogroup" aria-label={t(tb.labelKey)}>
                          {tb.items.map((item) => (
                            <Tooltip key={item.id} content={item.name} side="top">
                              <button
                                type="button"
                                role="radio"
                                aria-checked={shape.shapeType === item.shapeType}
                                aria-label={item.name}
                                className={`wb-shape-cell${shape.shapeType === item.shapeType ? ' wb-shape-cell-active' : ''}`}
                                onClick={() => applyBulkPatch({ shapeType: item.shapeType })}
                              >
                                <ShapeThumb shapeType={item.shapeType} />
                              </button>
                            </Tooltip>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                  <label className="fp-check">
                    <input
                      type="checkbox"
                      checked={shape.fill}
                      onChange={(e) => applyBulkPatch({ fill: e.target.checked })}
                    />
                    {t('whiteboard.popover.filled')}
                  </label>
                </DropdownShell>
              );
              const borderPop = (shape: WhiteboardShape) => {
                const cur = shape.dash ?? 'solid';
                return (
                  <DropdownShell
                    open={barPop?.kind === 'border'}
                    onToggle={() => togglePop('border')}
                    onClose={() => setBarPop(null)}
                    label={t('whiteboard.popover.lineStyle')}
                    popLabel={t('whiteboard.popover.lineStyle')}
                    button={
                      <>
                        <Minus size={15} aria-hidden="true" />
                        <DropCaret />
                      </>
                    }
                  >
                    {(['solid', 'dashed', 'none'] as const).map((d) => (
                      <button
                        key={d}
                        type="button"
                        role="radio"
                        aria-checked={cur === d}
                        className={`wb-fontopt${cur === d ? ' wb-fontopt-active' : ''}`}
                        onClick={() => applyBulkPatch({ dash: d })}
                      >
                        <span className="wb-fontopt-name">{d}</span>
                      </button>
                    ))}
                  </DropdownShell>
                );
              };
              const duplicateSelection = () => {
                const src = copiedElements();
                if (src.length === 0) return;
                setClipboard(src);
                applyPaste(src, 24);
              };
              if (el.kind === 'sticky') {
                // No text and no edit: element props only (fill).
                if (!showTextProps) return colorDot('color', t('whiteboard.textbar.fill'));
                return maybeSplit(colorDot('color', t('whiteboard.textbar.fill')), ...textControls(true));
              }
              if (el.kind === 'text') return maybeSplit(...textControls(true));
              if (el.kind === 'shape') {
                if (!el.label && !isEditing) {
                  // Empty shape: type + color + border dropdowns (Image: shape props).
                  return maybeSplit(
                    typePop(el),
                    colorDot('color', t('whiteboard.textbar.fill')),
                    borderPop(el),
                    widthPop(el.strokeWidth, t('whiteboard.popover.lineWidth'), (v) => applyBulkPatch({ strokeWidth: v })),
                  );
                }
                // Shape with text, or Add-text being typed: type, duplicate, fill, full text controls.
                return maybeSplit(
                  typePop(el),
                  <Tooltip content={t('whiteboard.ctx.duplicate')} side="top">
                    <button
                      type="button"
                      className="wb-selection-btn"
                      aria-label={t('whiteboard.ctx.duplicate')}
                      onClick={duplicateSelection}
                    >
                      <Copy size={15} aria-hidden="true" />
                    </button>
                  </Tooltip>,
                  colorDot('color', t('whiteboard.textbar.fill')),
                  ...textControls(true),
                );
              }
              if (el.kind === 'edge') {
                if (!showTextProps) {
                  return maybeSplit(
                    colorDot('color', t('whiteboard.popover.shapeColor')),
                    linePop(t('whiteboard.popover.lineStyle'), el),
                  );
                }
                return maybeSplit(
                  colorDot('color', t('whiteboard.popover.shapeColor')),
                  linePop(t('whiteboard.popover.lineStyle'), el),
                  ...textControls(false),
                );
              }
              if (el.kind === 'boundary') {
                if (!showTextProps) return colorDot('color', t('whiteboard.popover.shapeColor'));
                return maybeSplit(colorDot('color', t('whiteboard.popover.shapeColor')), ...textControls(false));
              }
              if (el.kind === 'stroke') {
                return maybeSplit(
                  colorDot('color', t('whiteboard.popover.shapeColor')),
                  widthPop(el.width, t('whiteboard.popover.lineWidth'), (v) => applyBulkPatch({ width: v })),
                );
              }
              return null;
            })()}
            {selectedIds.length >= 1 && !isMobileProp && (
              <Tooltip content={t('whiteboard.ctx.menu')} side="top">
                <button
                  type="button"
                  className="wb-selection-btn"
                  aria-label={t('whiteboard.ctx.menu')}
                  aria-haspopup="menu"
                  onClick={(e) => {
                    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
                    setCtxMenu({ x: r.left, y: r.bottom + 6 });
                  }}
                >
                  <DotsThreeVertical size={15} aria-hidden="true" />
                </button>
              </Tooltip>
            )}
            {moreBtn}
            {/* Width/line/type/border popups render via portal DropdownShells above. */}
          </div>
        </div>
        );
      })()}
      {!hideChrome && board.elements.length > 0 && (
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
      <RefPicker
        open={refPending !== null}
        state={state}
        onPick={placeRef}
        onClose={() => setRefPending(null)}
        onCreateNew={(entity) => {
          const target = REF_CREATE_TARGET[entity];
          setRefPending(null);
          navigate(`/project/${projectId}?tab=${target.tab}&new=${target.fresh}`);
        }}
        onBrowse={(entity) => {
          const target = REF_CREATE_TARGET[entity];
          setRefPending(null);
          navigate(`/project/${projectId}?tab=${target.tab}`);
        }}
      />
      {editingText && (() => {
        const el = board.elements.find((e) => e.id === editingText.id);
        if (!el) return null;
        const b = boundsFor(el);
        const s = view.view.s;
        const toSX = (wx: number) => worldToScreen(view.view, wx, 0).x;
        const toSY = (wy: number) => worldToScreen(view.view, 0, wy).y;
        const fs = textFontOf(el) * s;
        const singleLine = el.kind === 'shape' || el.kind === 'edge' || el.kind === 'boundary';
        const editAlign = (el as { align?: string | null }).align ?? (el.kind === 'shape' || el.kind === 'edge' ? 'center' : 'left');
        const ink = el.kind === 'sticky'
          ? ((el.textColor ?? '') || 'rgba(6,5,4,0.85)')
          : el.kind === 'text' || el.kind === 'edge'
            ? String((el as unknown as Record<string, unknown>).color ?? '#e4e4e7')
            : el.kind === 'shape' || el.kind === 'boundary'
              ? (String((el as unknown as Record<string, unknown>).labelColor ?? '') || (el.kind === 'boundary' ? '#e4e4e7' : String((el as unknown as Record<string, unknown>).color ?? '#e4e4e7')))
              : '#e4e4e7';
        // Mirror the rendered label geometry (world units) so text doesn't jump
        // when editing starts. Alphabetic-baseline kinds offset by an ascent
        // estimate; middle-baseline kinds (shape) center the first line on y0.
        let boxLeftW = b.x;
        let boxTopW = b.y;
        let boxW = b.w;
        let boxH = Math.max(1, editingText.value.split('\n').length) * textLineHeight(textFontOf(el));
        let lineHW = textLineHeight(textFontOf(el));
        let rowsN = Math.max(1, editingText.value.split('\n').length);
        if (el.kind === 'shape') {
          const pad = 8;
          const fontSize = el.fontSize ?? 12;
          const innerW = Math.max(24, el.w - pad * 2);
          const step = fontSize + 2;
          const n = Math.max(1, wrapToWidth(listedLines(editingText.value, el).join('\n'), fontSize, innerW).length);
          const vMode = el.valign ?? null;
          const legacyY = el.y + el.h / 2;
          const firstY =
            vMode === 'top'
              ? el.y + pad + step / 2
              : vMode === 'bottom'
                ? el.y + el.h - pad - (n - 1) * step - step / 2
                : vMode === 'center'
                  ? el.y + el.h / 2 - ((n - 1) * step) / 2
                  : legacyY;
          const y0 = Math.max(firstY, el.y + pad + step / 2);
          boxLeftW = el.x + pad;
          boxTopW = y0 - step / 2;
          boxW = innerW;
          boxH = n * step;
          lineHW = step;
          rowsN = n;
        } else if (el.kind === 'sticky') {
          const pad = 8;
          const fontSize = el.fontSize ?? 12;
          const lineHeight = textLineHeight(fontSize);
          const innerW = Math.max(24, el.w - pad * 2);
          const n = Math.max(1, wrapTextLines(editingText.value, fontSize, innerW).length);
          const vTop = el.y + pad + 8;
          const blockH = n * lineHeight;
          const vMode = el.valign ?? 'top';
          const startY =
            vMode === 'center'
              ? Math.max(vTop, el.y + (el.h - blockH) / 2 + 8)
              : vMode === 'bottom'
                ? Math.max(vTop, el.y + el.h - pad - blockH + 8)
                : vTop;
          boxLeftW = el.x + pad;
          boxTopW = startY - fontSize * 0.8;
          boxW = innerW;
          boxH = n * lineHeight;
          lineHW = lineHeight;
          rowsN = n;
        } else if (el.kind === 'text' && el.w) {
          const fontSize = el.fontSize;
          const lineHeight = textLineHeight(fontSize);
          const n = Math.max(1, wrapTextLines(editingText.value, fontSize, el.w).length);
          boxLeftW = el.x;
          boxTopW = el.y - fontSize * 0.8;
          boxW = el.w;
          boxH = n * lineHeight;
          lineHW = lineHeight;
          rowsN = n;
        } else if (el.kind === 'edge') {
          const edge = el as WhiteboardEdge;
          const fontSize = edge.fontSize ?? 11;
          const lineHeight = textLineHeight(fontSize);
          const ep = shiftEndpoints(derivedEdges.get(edge.id) ?? null, dragOffset, selectedSet, edge)
            ?? { x1: edge.x1, y1: edge.y1, x2: edge.x2, y2: edge.y2 };
          const path = edge.sourcePort && edge.targetPort
            ? orthogonalPath({ x1: ep.x1, y1: ep.y1, x2: ep.x2, y2: ep.y2 }, edge.sourcePort, edge.targetPort)
            : null;
          const mid = pathMidpoint(path ?? [{ x: ep.x1, y: ep.y1 }, { x: ep.x2, y: ep.y2 }]);
          const estW = Math.max(80, Math.min(b.w, editingText.value.replace(/\n/g, ' ').length * fontSize * 0.62 + 16));
          boxLeftW = mid.x - estW / 2;
          boxTopW = mid.y - lineHeight / 2;
          boxW = estW;
          boxH = lineHeight;
          lineHW = lineHeight;
          rowsN = 1;
        } else if (el.kind === 'boundary') {
          const fontSize = el.fontSize ?? 12;
          const lineHeight = textLineHeight(fontSize);
          const chipW = Math.min(editingText.value.length * 7.5 + 12, Math.max(20, el.w - 12));
          boxLeftW = el.x + 6;
          boxTopW = el.y + 6 - fontSize * 0.8;
          boxW = Math.max(40, chipW);
          boxH = lineHeight;
          lineHW = lineHeight;
          rowsN = 1;
        }
        return (
          <textarea
            className="wb-textedit"
            aria-label={singleLine ? t('whiteboard.popover.label') : el.kind === 'sticky' ? t('whiteboard.popover.stickyTextLabel') : t('whiteboard.popover.textLabel')}
            autoFocus
            rows={rowsN}
            value={editingText.value}
            maxLength={el.kind === 'text' ? 1000 : el.kind === 'sticky' ? 500 : 200}
            onChange={(e) => setEditingText({ id: editingText.id, value: e.target.value })}
            onBlur={commitTextEdit}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === 'Escape') {
                e.preventDefault();
                setEditingText(null);
              } else if (e.key === 'Enter' && (singleLine || (!e.shiftKey && !e.ctrlKey && !e.metaKey))) {
                e.preventDefault();
                commitTextEdit();
              }
            }}
            style={{
              left: toSX(boxLeftW),
              top: toSY(boxTopW),
              width: Math.max(80, boxW * s),
              height: Math.max(lineHW * s, boxH * s),
              lineHeight: `${lineHW * s}px`,
              fontSize: fs,
              color: ink,
              // FigJam Add-text: no box or border, just the caret in place.
              background: 'transparent',
              border: 'none',
              boxShadow: 'none',
              padding: 0,
              textAlign: editAlign as 'left' | 'center' | 'right',
              ...svgTextStyle(el),
            }}
          />
        );
      })()}
      {ctxMenu && (
        <WhiteboardContextMenu
          x={ctxMenu.x}
          y={ctxMenu.y}
          sections={ctxSections()}
          onClose={() => setCtxMenu(null)}
        />
      )}
      {renderMoreSheet()}
      {isMobileProp && tool === 'select' && selectedIds.length === 1 && !isReadOnly && !editingText && !dragOffset && !marquee && !resizePreview && (() => {
        const target = board.elements.find((el) => el.id === selectedIds[0]);
        if (!target || (target.kind !== 'shape' && target.kind !== 'text') || target.locked) return null;
        const b = boundsFor(target);
        const rc = rotationCenter(target, b);
        const sp = worldToScreen(view.view, rc.x, b.y);
        const x = Math.min(Math.max(sp.x, 28), Math.max(28, canvasSize.w - 28));
        const y = Math.max(sp.y - 56, 28);
        const worldFromClient = (clientX: number, clientY: number) => {
          const rect = view.ref.current?.getBoundingClientRect();
          return screenToWorld(view.view, clientX - (rect?.left ?? 0), clientY - (rect?.top ?? 0));
        };
        const beginRotate = (e: ReactPointerEvent<HTMLButtonElement>) => {
          if (!e.isPrimary) return;
          e.stopPropagation();
          e.preventDefault();
          try {
            e.currentTarget.setPointerCapture(e.pointerId);
          } catch {
            /* jsdom — moves still bubble from the button */
          }
          const pt = worldFromClient(e.clientX, e.clientY);
          rotateDragRef.current = {
            id: target.id,
            center: { x: rc.x, y: rc.y },
            startAng: (Math.atan2(pt.y - rc.y, pt.x - rc.x) * 180) / Math.PI,
            startRot: (target as { rotation?: number }).rotation ?? 0,
          };
        };
        const moveRotate = (e: ReactPointerEvent<HTMLButtonElement>) => {
          const r = rotateDragRef.current;
          if (!r || r.id !== target.id) return;
          const pt = worldFromClient(e.clientX, e.clientY);
          const ang = (Math.atan2(pt.y - r.center.y, pt.x - r.center.x) * 180) / Math.PI;
          let delta = ang - r.startAng;
          while (delta > 180) delta -= 360;
          while (delta < -180) delta += 360;
          setRotateLive(snapRotation(r.startRot + delta, false));
        };
        // Keyboard/AT fallback: Enter/Space nudges +15°.
        const keyRotate = (e: ReactKeyboardEvent<HTMLButtonElement>) => {
          if (e.key !== 'Enter' && e.key !== ' ') return;
          e.preventDefault();
          const cur = (target as { rotation?: number }).rotation ?? 0;
          history.record();
          dispatch({
            type: 'whiteboard/update',
            id: board.id,
            patch: {
              elements: board.elements.map((el) => (el.id === target.id ? { ...el, rotation: snapRotation(cur + 15, false) } : el)),
            },
          });
        };
        return (
          <button
            type="button"
            className="wb-rotate-fab"
            style={{ left: x, top: y }}
            aria-label={t('whiteboard.canvas.rotate')}
            onPointerDown={beginRotate}
            onPointerMove={moveRotate}
            onPointerUp={commitRotateDrag}
            onPointerCancel={commitRotateDrag}
            onKeyDown={keyRotate}
            onContextMenu={(e) => e.preventDefault()}
          >
            <ArrowClockwise size={20} aria-hidden="true" />
          </button>
        );
      })()}
    </div>
  );
}