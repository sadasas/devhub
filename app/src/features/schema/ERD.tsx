import { useEffect, useMemo, useRef, useState } from 'react';
import { CornersOut, Graph, MagnifyingGlassMinus, MagnifyingGlassPlus } from '@phosphor-icons/react';
import type { Column, Relation, Table } from '../../lib/types';
import type { State } from '../../lib/types';
import { relationLabel } from '../../lib/utils';
import { Button } from '../../components/Button';

const TABLE_W = 208;
const HEADER_H = 30;
const ROW_H = 20;
const GAP = 48;
const COLS = 4;
const MIN_ZOOM = 0.3;
const MAX_ZOOM = 3;

interface ErLayout {
  table: Table;
  x: number;
  y: number;
  h: number;
}

function layoutTables(tables: Table[]): ErLayout[] {
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
      out.push({ table: t, x: 16 + ci * (TABLE_W + GAP), y, h: rowHeights[ri]! });
    });
    y += rowHeights[ri]! + GAP;
  });
  return out;
}

function truncate(s: string, max: number): string {
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

interface ERDProps {
  state: State;
  onDeleteRelation: (relation: Relation) => void;
  onNewTable: () => void;
}

export function ERD({ state, onDeleteRelation, onNewTable }: ERDProps) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const dragStartRef = useRef<{ pointerX: number; pointerY: number; x: number; y: number } | null>(null);
  const [view, setView] = useState({ x: 16, y: 16, s: 1 });
  const [dragging, setDragging] = useState(false);

  const layout = useMemo(() => layoutTables(state.tables), [state.tables]);

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
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  const zoomAt = (factor: number) => {
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
  };

  const columnY = (table: Table, column: Column) => {
    const idx = table.columns.indexOf(column);
    return HEADER_H + idx * ROW_H + ROW_H / 2;
  };

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

  return (
    <div ref={canvasRef} className={`erd-canvas ${dragging ? 'dragging' : ''}`}>
      <svg
        width="100%"
        height="100%"
        role="img"
        aria-label={`Entity relationship diagram with ${state.tables.length} tables and ${state.relations.length} relations`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        <g transform={`translate(${view.x},${view.y}) scale(${view.s})`}>
          {state.relations.map((rel) => {
            const ft = layout.find((l) => l.table.id === rel.fromTableId);
            const tt = layout.find((l) => l.table.id === rel.toTableId);
            const fc = ft?.table.columns.find((c) => c.id === rel.fromColumnId);
            const tc = tt?.table.columns.find((c) => c.id === rel.toColumnId);
            if (!ft || !tt || !fc || !tc) return null;
            const fx = ft.x + TABLE_W;
            const fy = ft.y + columnY(ft.table, fc);
            const tx = tt.x;
            const ty = tt.y + columnY(tt.table, tc);
            const mx = (fx + tx) / 2;
            const pts = `${fx},${fy} ${mx},${fy} ${mx},${ty} ${tx},${ty}`;
            return (
              <g
                key={rel.id}
                className="erd-rel"
                role="button"
                tabIndex={0}
                aria-label={`Relation ${ft.table.name}.${fc.name} to ${tt.table.name}.${tc.name}, click to delete`}
                onClick={() => onDeleteRelation(rel)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onDeleteRelation(rel);
                  }
                }}
              >
                <title>
                  {relationLabel(ft.table.name, fc.name, tt.table.name, tc.name)} · {rel.cardinality} · on delete:{' '}
                  {rel.onDelete} — click to delete
                </title>
                <polyline points={pts} fill="none" strokeWidth={1.5} />
                <text x={mx} y={(fy + ty) / 2 - 6} className="erd-cardinality" textAnchor="middle">
                  {rel.cardinality}
                </text>
              </g>
            );
          })}
          {layout.map((l) => {
            const t = l.table;
            return (
              <g key={t.id} transform={`translate(${l.x},${l.y})`}>
                <rect width={TABLE_W} height={l.h} rx={8} className="erd-table-body" />
                <rect width={TABLE_W} height={HEADER_H} rx={8} className="erd-table-header" />
                <rect y={HEADER_H - 8} width={TABLE_W} height={8} className="erd-table-header" />
                <text x={12} y={20} className="erd-table-title">
                  {truncate(t.name, 24)}
                </text>
                {t.columns.map((c) => (
                  <g key={c.id} transform={`translate(0,${HEADER_H + t.columns.indexOf(c) * ROW_H})`}>
                    {c.primaryKey && <circle cx={10} cy={ROW_H / 2} r={2.5} className="erd-pk" />}
                    <text x={22} y={14} className="erd-col-name">
                      {truncate(c.name, 20)}
                    </text>
                    <text x={TABLE_W - 10} y={14} className="erd-col-type" textAnchor="end">
                      {truncate(c.type || '—', 16)}
                    </text>
                  </g>
                ))}
              </g>
            );
          })}
        </g>
      </svg>
      {state.tables.length === 0 && (
        <div className="erd-empty">
          <div className="empty-state">
            <Graph size={22} aria-hidden="true" />
            <p className="empty-state-title">No tables yet</p>
            <p className="empty-state-desc">Create your first table to start drawing the ERD.</p>
            <Button size="sm" onClick={onNewTable}>
              New table
            </Button>
          </div>
        </div>
      )}
      <div className="erd-zoom">
        <Button
          variant="secondary"
          size="sm"
          aria-label="Zoom in"
          title="Zoom in"
          onClick={() => zoomAt(1.2)}
        >
          <MagnifyingGlassPlus size={13} aria-hidden="true" />
        </Button>
        <Button
          variant="secondary"
          size="sm"
          aria-label="Zoom out"
          title="Zoom out"
          onClick={() => zoomAt(1 / 1.2)}
        >
          <MagnifyingGlassMinus size={13} aria-hidden="true" />
        </Button>
        <Button
          variant="secondary"
          size="sm"
          aria-label="Reset view"
          title="Reset view"
          onClick={() => setView({ x: 16, y: 16, s: 1 })}
        >
          <CornersOut size={13} aria-hidden="true" />
        </Button>
      </div>
      <div className="erd-hint">Scroll to zoom · drag to pan</div>
    </div>
  );
}
