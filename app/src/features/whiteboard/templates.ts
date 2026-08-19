import { newId } from '../../lib/utils';
import type { WhiteboardElement } from '../../lib/types';

export interface WhiteboardTemplate {
  id: string;
  name: string;
  description: string;
  build: () => WhiteboardElement[];
}

const C = {
  primary: '#e4e4e7',
  accent: '#34c38e',
  info: '#6ea8fe',
  warn: '#e8b955',
  violet: '#a78bfa',
  pink: '#f2b8c6',
};

const id = () => newId();
const text = (x: number, y: number, str: string, fontSize = 14, color = C.primary): WhiteboardElement => ({
  id: id(), kind: 'text', x, y, color, fontSize, text: str,
});
const sticky = (x: number, y: number, str: string, w = 200, h = 60, color = C.warn): WhiteboardElement => ({
  id: id(), kind: 'sticky', x, y, w, h, color, text: str,
});
const shape = (x: number, y: number, label: string, w = 190, h = 56, color = C.info, shapeType: 'rect' | 'roundedRect' | 'diamond' = 'rect'): WhiteboardElement => ({
  id: id(), kind: 'shape', shapeType, x, y, w, h, color, fill: true, strokeWidth: 2, label,
});
const boundary = (x: number, y: number, label: string, w: number, h: number, color = C.info): WhiteboardElement => ({
  id: id(), kind: 'boundary', x, y, w, h, color, label,
});
const edge = (x1: number, y1: number, x2: number, y2: number, label = '', color = C.accent): WhiteboardElement => ({
  id: id(), kind: 'edge', x1, y1, x2, y2, color, width: 2, arrowhead: true, label, arrowStyle: 'solid',
  sourceNodeId: null, targetNodeId: null,
});

function kanban(): WhiteboardElement[] {
  const els: WhiteboardElement[] = [];
  const cols = ['Todo', 'In Progress', 'Review', 'Done'];
  const colColor = [C.info, C.warn, C.violet, C.accent];
  cols.forEach((label, i) => {
    const x = 40 + i * 280;
    els.push(boundary(x, 80, label, 250, 430, colColor[i]!));
    for (let c = 0; c < 3; c += 1) {
      els.push(sticky(x + 25, 140 + c * 100, c === 0 && i === 0 ? 'Card 1' : '', 200, 70));
    }
  });
  return els;
}

function ciCd(): WhiteboardElement[] {
  const nodes: Array<[string, string, number]> = [
    ['Commit', 'rect', 60],
    ['Build', 'rect', 340],
    ['Test', 'rect', 620],
    ['Approved?', 'diamond', 900],
    ['Deploy', 'rect', 1180],
  ];
  const els: WhiteboardElement[] = [boundary(30, 60, 'CI/CD Pipeline', 1400, 200)];
  nodes.forEach(([label, kind, x], i) => {
    const st = kind === 'diamond' ? C.warn : kind === 'rect' && i === 0 ? C.pink : C.info;
    els.push(shape(x, 132, label, 190, 56, st, kind as 'rect' | 'diamond'));
    if (i < nodes.length - 1) {
      const labels = ['lint · build', 'unit · e2e', '', 'approval gate'];
      els.push(edge(x + 190, 160, x + 190 + 90, 160, labels[i] ?? ''));
    }
  });
  els.push(sticky(60, 220, 'Commit → Build → Test → Approval → Deploy', 600, 40));
  return els;
}

function roadmap(): WhiteboardElement[] {
  const els: WhiteboardElement[] = [boundary(30, 60, 'Roadmap 2026', 1360, 320)];
  els.push(edge(80, 200, 1300, 200, '', C.primary));
  const quarters = ['Q1', 'Q2', 'Q3', 'Q4'];
  quarters.forEach((q, i) => {
    const x = 120 + i * 320;
    els.push(shape(x, 178, q, 40, 44, C.warn, 'diamond'));
    els.push(text(x - 10, 130, `Milestone ${q}`, 13));
    els.push(sticky(x - 90, 250, '', 180, 90));
  });
  return els;
}

function releaseTrain(): WhiteboardElement[] {
  const els: WhiteboardElement[] = [];
  const phases = ['Planned', 'Developing', 'Testing', 'Released'];
  const releases = ['v2.1', 'v2.2', 'v3.0'];
  const phaseColor = [C.info, C.warn, C.violet, C.accent];
  phases.forEach((label, i) => {
    els.push(boundary(220 + i * 260, 80, label, 240, 430, phaseColor[i]!));
  });
  releases.forEach((rel, r) => {
    const y = 150 + r * 130;
    els.push(text(60, y + 20, rel, 14, C.primary));
    els.push(shape(240, y - 10, rel, 180, 44, C.info));
    if (r === 0) {
      els.push(sticky(520, y - 10, '', 200, 44));
      els.push(sticky(1040, y - 10, 'v2.1 released', 200, 44, C.accent));
    }
    if (r === 1) els.push(sticky(1040, y - 10, 'v2.2 released', 200, 44, C.accent));
  });
  return els;
}

function gitflow(): WhiteboardElement[] {
  const els: WhiteboardElement[] = [boundary(30, 60, 'Gitflow', 1300, 420)];
  els.push(shape(70, 150, 'main', 150, 50, C.info, 'roundedRect'));
  els.push(shape(70, 270, 'develop', 150, 50, C.info, 'roundedRect'));
  els.push(shape(420, 90, 'feature/a', 160, 50, C.violet, 'roundedRect'));
  els.push(shape(760, 90, 'feature/b', 160, 50, C.violet, 'roundedRect'));
  els.push(shape(420, 340, 'hotfix', 160, 50, C.pink, 'roundedRect'));
  els.push(edge(220, 175, 220, 295, 'release', C.primary));
  els.push(edge(220, 295, 420, 140, '', C.violet));
  els.push(edge(220, 295, 760, 140, '', C.violet));
  els.push(edge(220, 175, 420, 365, '', C.pink));
  return els;
}

export const WHITEBOARD_TEMPLATES: WhiteboardTemplate[] = [
  { id: 'blank', name: 'Blank', description: 'Empty canvas — start from scratch', build: () => [] },
  { id: 'kanban', name: 'Kanban', description: 'Todo / In Progress / Review / Done columns', build: kanban },
  { id: 'ci-cd', name: 'CI/CD pipeline', description: 'Commit → Build → Test → Approval → Deploy', build: ciCd },
  { id: 'roadmap', name: 'Roadmap', description: 'Timeline with milestone markers', build: roadmap },
  { id: 'release-train', name: 'Release train', description: 'Releases × phases matrix', build: releaseTrain },
  { id: 'gitflow', name: 'Gitflow', description: 'Branching model (main / develop / feature / hotfix)', build: gitflow },
];