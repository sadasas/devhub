import {
  computeStackGraph,
  STACK_CATEGORIES,
  STACK_NODE_RADIUS,
  STACK_VIEWBOX,
} from '../../lib/stack-graph';
import { TECH_CATEGORY, TECH_STATUS } from '../../lib/labels';
import type { TechEntry, TechEntryCategory, TechStatus } from '../../lib/types';

const STATUS_COLOR: Record<TechStatus, string> = {
  current: 'var(--status-success)',
  updateAvailable: 'var(--status-warn)',
  majorUpgrade: 'var(--status-danger)',
};

const CATEGORY_COLOR: Record<TechEntryCategory, string> = {
  frontend: 'var(--status-info)',
  backend: 'var(--accent)',
  database: 'var(--status-warn)',
  tooling: 'var(--text-muted)',
};

const MAX_LABEL = 14;

function shortName(name: string): string {
  return name.length > MAX_LABEL ? `${name.slice(0, MAX_LABEL - 1)}…` : name;
}

interface StackGraphProps {
  entries: TechEntry[];
  onOpen: (id: string) => void;
}

export function StackGraph({ entries, onOpen }: StackGraphProps) {
  const { hubs, nodes } = computeStackGraph(entries);

  const categoryCount = (category: TechEntryCategory) =>
    nodes.filter((n) => n.hub === category).length;

  return (
    <div className="stack-graph-wrap">
      <svg
        viewBox={`0 0 ${STACK_VIEWBOX.width} ${STACK_VIEWBOX.height}`}
        className="stack-graph"
        role="img"
        aria-label={`Tech stack graph — ${entries.length} ${entries.length === 1 ? 'entry' : 'entries'}`}
      >
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
              {TECH_CATEGORY[hub.category].label}
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
            aria-label={`Edit ${node.entry.name}`}
            className="stack-graph-node"
            onClick={() => onOpen(node.entry.id)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onOpen(node.entry.id);
              }
            }}
          >
            <title>{`${node.entry.name} v${node.entry.version} · ${TECH_STATUS[node.entry.status].label}${node.entry.notes ? `\n${node.entry.notes}` : ''}`}</title>
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
      </svg>

      <div className="stack-graph-legend">
        <div className="chart-legend">
          {Object.keys(STATUS_COLOR).map((key) => {
            const status = key as TechStatus;
            return (
              <div key={status} className="legend-row">
                <span className="legend-dot" style={{ background: STATUS_COLOR[status] }} />
                <span>{TECH_STATUS[status].label}</span>
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
              <span>{TECH_CATEGORY[category].label}</span>
              <span className="legend-count">{categoryCount(category)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}