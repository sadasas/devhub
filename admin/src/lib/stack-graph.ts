import type { TechEntry, TechEntryCategory } from './types';

export interface StackGraphPoint {
  x: number;
  y: number;
}

export interface StackGraphHub extends StackGraphPoint {
  category: TechEntryCategory;
}

export interface StackGraphNode extends StackGraphPoint {
  entry: TechEntry;
  hub: TechEntryCategory;
}

export interface StackGraphLayout {
  hubs: StackGraphHub[];
  nodes: StackGraphNode[];
}

export const STACK_VIEWBOX = { width: 1000, height: 600 };

export const STACK_NODE_RADIUS = 17;

const HUB_POS: Record<TechEntryCategory, StackGraphPoint> = {
  frontend: { x: 235, y: 170 },
  backend: { x: 765, y: 170 },
  database: { x: 235, y: 430 },
  tooling: { x: 765, y: 430 },
};

export const STACK_CATEGORIES = Object.keys(HUB_POS) as TechEntryCategory[];

export function computeStackGraph(entries: TechEntry[]): StackGraphLayout {
  const hubs = STACK_CATEGORIES.map((category) => ({
    category,
    x: HUB_POS[category].x,
    y: HUB_POS[category].y,
  }));
  const nodes: StackGraphNode[] = [];

  for (const category of STACK_CATEGORIES) {
    const list = entries
      .filter((e) => e.category === category)
      .sort((a, b) => a.name.localeCompare(b.name));
    const count = list.length;
    if (count === 0) continue;

    const { x, y } = HUB_POS[category];
    const ring = Math.min(140, 80 + count * 16);

    list.forEach((entry, i) => {
      if (count === 1) {
        nodes.push({ entry, hub: category, x, y: y + ring });
        return;
      }
      const angle = -Math.PI / 2 + (i / count) * Math.PI * 2;
      nodes.push({
        entry,
        hub: category,
        x: x + Math.cos(angle) * ring,
        y: y + Math.sin(angle) * ring,
      });
    });
  }

  return { hubs, nodes };
}