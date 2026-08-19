import { describe, expect, it } from 'vitest';
import type { WhiteboardElement } from '../../lib/types';
import { serializeWhiteboard } from './export';

function sticky(x: number, y: number, id = 's1'): WhiteboardElement {
  return { id, kind: 'sticky', x, y, w: 100, h: 60, color: '#e8b955', text: 'hi' };
}

describe('serializeWhiteboard', () => {
  it('produces a viewBox covering element bounds plus a 32px margin', () => {
    const svg = serializeWhiteboard([sticky(0, 0), sticky(100, 50, 's2')]);
    expect(svg).toMatch(/^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" viewBox="-32 -32 \d+ \d+" width="\d+" height="\d+"/);
    expect(svg).toContain('viewBox="-32 -32 264 174"');
    expect(svg).toContain('width="264"');
    expect(svg).toContain('height="174"');
  });

  it('renders each element kind into SVG primitives', () => {
    const elements: WhiteboardElement[] = [
      { id: 'st', kind: 'stroke', tool: 'pen', color: '#e4e4e7', width: 2, thinning: 2, points: [[0, 0], [10, 10]] },
      { id: 'sh', kind: 'shape', shapeType: 'rect', x: 0, y: 100, w: 100, h: 60, color: '#6ea8fe', fill: false, strokeWidth: 2, label: 'Decide' },
      { id: 'tx', kind: 'text', x: 0, y: 200, color: '#e4e4e7', fontSize: 16, text: 'note', w: 200 },
      { id: 'e1', kind: 'edge', x1: 0, y1: 0, x2: 100, y2: 0, color: '#8b5cf6', width: 2, arrowhead: true, arrowStyle: 'solid', label: 'Yes', sourceNodeId: null, targetNodeId: null },
      { id: 'bd', kind: 'boundary', x: 0, y: 0, w: 300, h: 200, color: '#6ea8fe', label: 'System' },
    ];
    const svg = serializeWhiteboard(elements);
    expect(svg).toContain('<polyline');
    expect(svg).toContain('d="M 0 100');
    expect(svg).toContain('Decide');
    expect(svg).toContain('<tspan x="0" dy="0">note</tspan>');
    expect(svg).toContain('stroke-dasharray="6 4"');
    expect(svg).toContain('>Yes</text>');
    expect(svg).toContain('points="-8,-4 0,0 -8,4"');
  });

  it('renders boundaries behind other elements', () => {
    const elements: WhiteboardElement[] = [
      sticky(0, 0),
      { id: 'bd', kind: 'boundary', x: -20, y: -20, w: 300, h: 200, color: '#6ea8fe', label: 'System' },
    ];
    const svg = serializeWhiteboard(elements);
    const boundaryIdx = svg.indexOf('stroke-dasharray');
    const stickyIdx = svg.indexOf('>hi</text>');
    expect(boundaryIdx).toBeGreaterThan(-1);
    expect(stickyIdx).toBeGreaterThan(boundaryIdx);
  });

  it('serializes an edge with an orthogonal path when ports are present', () => {
    const elements: WhiteboardElement[] = [
      { id: 'a', kind: 'sticky', x: 0, y: 0, w: 100, h: 60, color: '#e8b955', text: 'A' },
      { id: 'b', kind: 'sticky', x: 200, y: 0, w: 100, h: 60, color: '#e8b955', text: 'B' },
      {
        id: 'e1',
        kind: 'edge',
        x1: 100,
        y1: 30,
        x2: 200,
        y2: 80,
        color: '#8b5cf6',
        width: 2,
        arrowhead: true,
        arrowStyle: 'solid',
        label: '',
        sourceNodeId: 'a',
        targetNodeId: 'b',
        sourcePort: 'right',
        targetPort: 'left',
      },
    ];
    const svg = serializeWhiteboard(elements);
    const m = svg.match(/<polyline points="([^"]+)"/);
    expect(m).not.toBeNull();
    expect(m![1]!.split(' ').length).toBeGreaterThanOrEqual(4);
  });

  it('renders a ref card collapsed when no ref data is provided', () => {
    const elements: WhiteboardElement[] = [
      { id: 'r1', kind: 'ref', entity: 'tasks', entityId: '11111111-1111-4111-8111-111111111111', x: 0, y: 0 },
    ];
    const svg = serializeWhiteboard(elements);
    expect(svg).toContain('untitled tasks');
    expect(svg).toContain('Deleted');
  });

  it('renders an expanded ref card when ref data is provided', () => {
    const elements: WhiteboardElement[] = [
      { id: 'r1', kind: 'ref', entity: 'tasks', entityId: '11111111-1111-4111-8111-111111111111', x: 0, y: 0 },
    ];
    const svg = serializeWhiteboard(elements, new Map([['r1', { title: 'Ship it', meta: 'In Progress · High', sub: undefined, labels: ['backend'], hours: undefined, counts: [], description: 'do the thing' }]]));
    expect(svg).toContain('Ship it');
    expect(svg).toContain('backend');
    expect(svg).toContain('do the thing');
    expect(svg).not.toContain('untitled tasks');
  });

  it('escapes XML-sensitive characters in labels and text', () => {
    const elements: WhiteboardElement[] = [
      { id: 'tx', kind: 'text', x: 0, y: 0, color: '#e4e4e7', fontSize: 16, text: 'a < b && c > d', w: null },
    ];
    const svg = serializeWhiteboard(elements);
    expect(svg).toContain('a &lt; b &amp;&amp; c &gt; d');
    expect(svg).not.toContain('< b &&');
  });

  it('stays a valid empty document for a board with no elements', () => {
    const svg = serializeWhiteboard([]);
    expect(svg).toContain('viewBox="-32 -32 64 64"');
    expect(svg.endsWith('</svg>')).toBe(true);
  });
});