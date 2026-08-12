import { describe, expect, it } from 'vitest';
import { computeStackGraph, STACK_CATEGORIES } from './stack-graph';
import type { TechEntry, TechEntryCategory } from './types';

function entry(id: string, name: string, category: TechEntryCategory): TechEntry {
  return {
    id,
    name,
    version: '1.0.0',
    category,
    status: 'current',
    notes: '',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

describe('computeStackGraph', () => {
  it('returns one hub per category', () => {
    const { hubs } = computeStackGraph([]);
    expect(hubs.map((h) => h.category)).toEqual(STACK_CATEGORIES);
  });

  it('skips empty categories and keeps every entry', () => {
    const entries = [
      entry('a', 'React', 'frontend'),
      entry('b', 'Express', 'backend'),
      entry('c', 'PostgreSQL', 'database'),
    ];
    const { nodes } = computeStackGraph(entries);
    expect(nodes).toHaveLength(3);
  });

  it('places a single entry below its hub', () => {
    const entries = [entry('a', 'React', 'frontend')];
    const { hubs, nodes } = computeStackGraph(entries);
    const hub = hubs.find((h) => h.category === 'frontend');
    const node = nodes[0];
    expect(node).toBeDefined();
    expect(hub).toBeDefined();
    expect(node!.x).toBe(hub!.x);
    expect(node!.y).toBeGreaterThan(hub!.y);
  });

  it('sorts entries by name within a category', () => {
    const entries = [
      entry('b', 'Zod', 'backend'),
      entry('a', 'Express', 'backend'),
      entry('c', 'bcryptjs', 'backend'),
    ];
    const { nodes } = computeStackGraph(entries);
    expect(nodes.map((n) => n.entry.name)).toEqual(['bcryptjs', 'Express', 'Zod']);
  });

  it('spreads multiple entries around the hub ring', () => {
    const entries = ['a', 'b', 'c', 'd'].map((id) => entry(id, `Tech ${id}`, 'tooling'));
    const { hubs, nodes } = computeStackGraph(entries);
    const hub = hubs.find((h) => h.category === 'tooling');
    for (const node of nodes) {
      const dx = node.x - hub!.x;
      const dy = node.y - hub!.y;
      const dist = Math.hypot(dx, dy);
      expect(dist).toBeGreaterThan(0);
      expect(dist).toBeLessThanOrEqual(140);
    }
  });

  it('places all entries of each category under its own hub', () => {
    const entries = [
      entry('a', 'React', 'frontend'),
      entry('b', 'PostgreSQL', 'database'),
    ];
    const { hubs, nodes } = computeStackGraph(entries);
    for (const node of nodes) {
      const hub = hubs.find((h) => h.category === node.hub)!;
      const dx = node.x - hub.x;
      const dy = node.y - hub.y;
      expect(Math.hypot(dx, dy)).toBeGreaterThan(0);
    }
  });
});