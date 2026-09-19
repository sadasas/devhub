import { describe, expect, it } from 'vitest';
import {
  LIBRARY_ITEM_BY_ID,
  pushShapeRecent,
  readShapeRecent,
  SHAPE_LIBRARY_COUNT,
  SHAPE_LIBRARY_TABS,
} from './libraries';

describe('shape libraries registry', () => {
  it('exposes 8 tabs with unique stable ids', () => {
    expect(SHAPE_LIBRARY_TABS.map((t) => t.id)).toEqual([
      'basic',
      'flowchart',
      'bpmn',
      'uml',
      'erd',
      'dataflow',
      'network',
      'k8s',
    ]);
    expect(LIBRARY_ITEM_BY_ID.size).toBe(SHAPE_LIBRARY_COUNT);
    expect(SHAPE_LIBRARY_COUNT).toBe(100);
  });

  it('holds 35 basic + 8 flowchart + 10 bpmn + 10 uml + 7 erd + 5 dataflow + 13 network + 12 k8s', () => {
    const counts = Object.fromEntries(SHAPE_LIBRARY_TABS.map((t) => [t.id, t.items.length]));
    expect(counts).toEqual({
      basic: 35,
      flowchart: 8,
      bpmn: 10,
      uml: 10,
      erd: 7,
      dataflow: 5,
      network: 13,
      k8s: 12,
    });
  });

  it('covers the 7 primer geometries with the basic tab', () => {
    const basic = SHAPE_LIBRARY_TABS.find((t) => t.id === 'basic')!;
    const types = new Set(basic.items.map((i) => i.shapeType));
    for (const st of ['rect', 'ellipse', 'diamond', 'triangleUp', 'triangleDown', 'capsule', 'cylinder'] as const) {
      expect(types.has(st)).toBe(true);
    }
  });

  it('every item resolves and ids stay derivable from names', () => {
    for (const tab of SHAPE_LIBRARY_TABS) {
      for (const item of tab.items) {
        expect(LIBRARY_ITEM_BY_ID.get(item.id)).toBe(item);
        expect(item.id).toBe(`${tab.id}:${item.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`);
        expect(item.name.length).toBeGreaterThan(0);
      }
    }
  });

  it('tracks recent picks newest-first without duplicates', () => {
    localStorage.clear();
    expect(readShapeRecent()).toEqual([]);
    pushShapeRecent('basic:rectangle');
    pushShapeRecent('bpmn:task-marker');
    pushShapeRecent('basic:rectangle');
    expect(readShapeRecent()).toEqual(['basic:rectangle', 'bpmn:task-marker']);
    pushShapeRecent('nope:missing');
    expect(readShapeRecent()).toEqual(['basic:rectangle', 'bpmn:task-marker']);
  });
});
