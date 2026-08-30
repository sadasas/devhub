import {
  computeStackGraph,
  STACK_CATEGORIES,
  STACK_NODE_RADIUS,
} from "../../lib/stack-graph";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CornersOut, MagnifyingGlassMinus, MagnifyingGlassPlus } from "@phosphor-icons/react";
import { useTranslation } from "react-i18next";
import type { TechEntry, TechEntryCategory, TechStatus } from "../../lib/types";

const STATUS_COLOR: Record<TechStatus, string> = {
  current: "var(--status-success)",
  updateAvailable: "var(--status-warn)",
  majorUpgrade: "var(--status-danger)",
};

const CATEGORY_COLOR: Record<TechEntryCategory, string> = {
  frontend: "var(--status-info)",
  backend: "var(--accent)",
  database: "var(--status-warn)",
  tooling: "var(--text-muted)",
};

const MAX_LABEL = 14;
const MIN_ZOOM = 0.3;
const MAX_ZOOM = 3;

function shortName(name: string): string {
  return name.length > MAX_LABEL ? `${name.slice(0, MAX_LABEL - 1)}…` : name;
}

interface StackGraphProps {
  entries: TechEntry[];
  onOpen: (id: string) => void;
}

export function StackGraph({ entries, onOpen }: StackGraphProps) {
  const { t } = useTranslation("project");
  const { hubs, nodes } = useMemo(() => computeStackGraph(entries), [entries]);
  const canvasRef = useRef<HTMLDivElement>(null);
  const dragStartRef = useRef<{ pointerX: number; pointerY: number; x: number; y: number } | null>(null);
  const [view, setView] = useState({ x: 16, y: 16, s: 1 });
  const [dragging, setDragging] = useState(false);

  const categoryCount = (category: TechEntryCategory) =>
    nodes.filter((n) => n.hub === category).length;

  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const cx = e.clientX - rect.left;
      const cy = e.clientY - rect.top;
      setView((v) => {
        const s = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, v.s * (e.deltaY < 0 ? 1.12 : 0.89)));
        const k = s / v.s;
        return { x: cx - (cx - v.x) * k, y: cy - (cy - v.y) * k, s };
      });
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
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

  const onPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    dragStartRef.current = { pointerX: e.clientX, pointerY: e.clientY, x: view.x, y: view.y };
    setDragging(true);
  };

  const onPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const start = dragStartRef.current;
    if (!start) return;
    setView((v) => ({ ...v, x: start.x + (e.clientX - start.pointerX), y: start.y + (e.clientY - start.pointerY) }));
  };

  const endDrag = () => {
    dragStartRef.current = null;
    setDragging(false);
  };

  const PAN_STEP = 40;

  const handleCanvasKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "ArrowLeft" || e.key === "ArrowRight" || e.key === "ArrowUp" || e.key === "ArrowDown") {
        e.preventDefault();
        const dir = e.key === "ArrowLeft" ? -1 : e.key === "ArrowRight" ? 1 : 0;
        const vert = e.key === "ArrowUp" ? -1 : e.key === "ArrowDown" ? 1 : 0;
        setView((v) => ({ ...v, x: v.x - dir * PAN_STEP, y: v.y - vert * PAN_STEP }));
      } else if (e.key === "+" || e.key === "=") {
        e.preventDefault();
        zoomAt(1.2);
      } else if (e.key === "-" || e.key === "_") {
        e.preventDefault();
        zoomAt(1 / 1.2);
      } else if (e.key === "0") {
        e.preventDefault();
        setView({ x: 16, y: 16, s: 1 });
      }
    },
    [zoomAt],
  );

  return (
    <div className="stack-graph-wrap">
      <div ref={canvasRef} className={`erd-canvas ${dragging ? "dragging" : ""}`}>
        <svg
          width="100%"
          height="100%"
          role="group"
          aria-label={t("stack.graph.ariaLabel", { count: entries.length })}
          tabIndex={0}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          onKeyDown={handleCanvasKeyDown}
        >
          <g transform={`translate(${view.x},${view.y}) scale(${view.s})`}>
            {nodes.map((node) => {
              const hub = hubs.find((h) => h.category === node.hub);
              if (!hub) return null;
              return (
                <line
                  key={`edge-${node.entry.id}`}
                  x1={hub.x}
                  y1={hub.y}
                  x2={node.x}
                  y2={node.y}
                  className="stack-graph-edge"
                  aria-hidden="true"
                />
              );
            })}

            {hubs.map((hub) => (
              <g key={hub.category} className="stack-graph-hub">
                <circle
                  cx={hub.x}
                  cy={hub.y}
                  r={20}
                  fill={CATEGORY_COLOR[hub.category]}
                  opacity="0.35"
                  aria-hidden="true"
                />
                <circle
                  cx={hub.x}
                  cy={hub.y}
                  r={4.5}
                  fill={CATEGORY_COLOR[hub.category]}
                  aria-hidden="true"
                />
                <text x={hub.x} y={hub.y + 40} textAnchor="middle" className="stack-graph-hub-label">
                  {t(`stack.category.${hub.category}`)}
                </text>
                <text x={hub.x} y={hub.y + 55} textAnchor="middle" className="stack-graph-hub-count">
                  {categoryCount(hub.category)}
                </text>
              </g>
            ))}

            {nodes.map((node) => (
              <g
                key={node.entry.id}
                role="button"
                tabIndex={0}
                aria-label={t("stack.graph.nodeAria", { name: node.entry.name })}
                className="stack-graph-node"
                onClick={() => onOpen(node.entry.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onOpen(node.entry.id);
                  }
                }}
              >
                <title>
                  {t("stack.graph.nodeTitle", {
                    name: node.entry.name,
                    version: node.entry.version,
                    status: t(`stack.statusBadge.${node.entry.status}`),
                  })}
                  {node.entry.notes ? `\n${node.entry.notes}` : ""}
                </title>
                <circle
                  cx={node.x}
                  cy={node.y}
                  r={STACK_NODE_RADIUS}
                  fill={STATUS_COLOR[node.entry.status]}
                  opacity="0.9"
                />
                <circle
                  cx={node.x}
                  cy={node.y}
                  r={STACK_NODE_RADIUS}
                  fill="none"
                  className="stack-graph-node-ring"
                />
                <text
                  x={node.x}
                  y={node.y + STACK_NODE_RADIUS + 14}
                  textAnchor="middle"
                  className="stack-graph-node-label"
                >
                  {shortName(node.entry.name)}
                </text>
              </g>
            ))}
          </g>
        </svg>

        <div className="erd-zoom">
          <button
            type="button"
            className="btn btn-secondary btn-sm btn-icon"
            aria-label={t("schema.erd.zoomIn")}
            title={t("schema.erd.zoomIn")}
            onClick={() => zoomAt(1.2)}
          >
            <MagnifyingGlassPlus size={13} aria-hidden="true" />
          </button>
          <button
            type="button"
            className="btn btn-secondary btn-sm btn-icon"
            aria-label={t("schema.erd.zoomOut")}
            title={t("schema.erd.zoomOut")}
            onClick={() => zoomAt(1 / 1.2)}
          >
            <MagnifyingGlassMinus size={13} aria-hidden="true" />
          </button>
          <button
            type="button"
            className="btn btn-secondary btn-sm btn-icon"
            aria-label={t("schema.erd.resetView")}
            title={t("schema.erd.resetView")}
            onClick={() => setView({ x: 16, y: 16, s: 1 })}
          >
            <CornersOut size={13} aria-hidden="true" />
          </button>
        </div>
        <div className="erd-hint">{t("schema.erd.hint")}</div>
      </div>

      <div className="stack-graph-legend">
        <div className="chart-legend">
          {Object.keys(STATUS_COLOR).map((key) => {
            const status = key as TechStatus;
            return (
              <div key={status} className="legend-row">
                <span className="legend-dot" style={{ background: STATUS_COLOR[status] }} />
                <span>{t(`stack.statusBadge.${status}`)}</span>
                <span className="legend-count">
                  {entries.filter((e) => e.status === status).length}
                </span>
              </div>
            );
          })}
        </div>
        <div className="chart-legend">
          {STACK_CATEGORIES.map((category) => (
            <div key={category} className="legend-row">
              <span className="legend-dot" style={{ background: CATEGORY_COLOR[category] }} />
              <span>{t(`stack.category.${category}`)}</span>
              <span className="legend-count">{categoryCount(category)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
