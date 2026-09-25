import { mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test, expect } from '../helpers/fixture';
import { ownerContext, getTeamId, createProject, addEntity, uniqueName } from '../helpers/api';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SHOTS = path.join(HERE, '..', 'shots');

// Deterministic sequence fixture (fixed ids/coords — comparable across runs).
function seqElements() {
  const p = (i: number, label: string, color: string) => ({
    id: `00000000-0000-4000-8000-00000000000${i}`,
    kind: 'shape',
    shapeType: 'rect',
    x: 80 + (i - 1) * 200,
    y: 80,
    w: 150,
    h: 56,
    color,
    label,
  });
  const cx = (i: number) => 80 + (i - 1) * 200 + 75;
  const lifeline = (i: number) => ({
    id: `10000000-0000-4000-8000-00000000000${i}`,
    kind: 'edge',
    x1: cx(i),
    y1: 136,
    x2: cx(i),
    y2: 400,
    color: '#8b5cf6',
    width: 2,
    arrowhead: false,
    arrowStyle: 'none',
    dash: 'dashed',
    label: '',
  });
  const msg = (n: number, x1: number, y: number, x2: number, label: string, dash = 'solid', color = '#2563eb') => ({
    id: `20000000-0000-4000-8000-0000000000${String(n).padStart(2, '0')}`,
    kind: 'edge',
    x1,
    y1: y,
    x2,
    y2: y,
    color,
    width: 2,
    arrowhead: true,
    arrowStyle: 'solid',
    dash,
    label,
  });
  return [
    p(1, 'Browser', '#2563eb'),
    p(2, 'API', '#e8b955'),
    p(3, 'DB', '#0f766e'),
    lifeline(1),
    lifeline(2),
    lifeline(3),
    msg(1, cx(1), 180, cx(2), 'GET /items'),
    msg(2, cx(2), 220, cx(3), 'query'),
    msg(3, cx(3), 260, cx(2), 'rows', 'dotted', '#8b5cf6'),
    msg(4, cx(2), 300, cx(1), '200 ok', 'dotted', '#8b5cf6'),
  ];
}

test('capture board screenshot', async ({ page }) => {
  const envProject = process.env.BOARD_SHOT_PROJECT_ID;
  const envBoard = process.env.BOARD_SHOT_BOARD_ID;
  const fixtureFile = process.env.BOARD_SHOT_FIXTURE;
  let projectId = envProject ?? '';
  let boardId = envBoard ?? '';
  if ((!projectId || !boardId) && !fixtureFile) {
    const ctx = await ownerContext();
    const teamId = await getTeamId(ctx);
    projectId = await createProject(ctx, teamId, uniqueName('Shot-Seq'));
    const { entity: board } = await addEntity<{ id: string }>(ctx, projectId, 'whiteboards', {
      id: crypto.randomUUID(),
      name: 'Shot sequence',
      description: '',
      elements: seqElements(),
    });
    boardId = board.id;
    console.log(`SHOT created project=${projectId} board=${boardId}`);
  }
  if (fixtureFile) {
    // Deterministic layout output (e.g. layout_board JSON): fresh project + board.
    const elements = JSON.parse(readFileSync(fixtureFile, 'utf8')).elements as unknown[];
    const ctx = await ownerContext();
    const teamId = await getTeamId(ctx);
    projectId = await createProject(ctx, teamId, uniqueName('Shot-Layout'));
    const { entity: board } = await addEntity<{ id: string }>(ctx, projectId, 'whiteboards', {
      id: crypto.randomUUID(),
      name: 'Shot layout',
      description: '',
      elements,
    });
    boardId = board.id;
    console.log(`SHOT created from fixture project=${projectId} board=${boardId}`);
  }

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`/project/${projectId}?tab=whiteboard&id=${boardId}`);
  await expect(page.locator('svg.wb-svg')).toBeVisible();
  await page.waitForTimeout(1000);
  const zoomOut = Number(process.env.BOARD_SHOT_ZOOMOUT ?? 0);
  for (let i = 0; i < zoomOut; i += 1) {
    await page.getByRole('button', { name: 'Zoom out' }).click();
    await page.waitForTimeout(300);
  }
  mkdirSync(SHOTS, { recursive: true });
  const out = path.join(SHOTS, `board-${boardId}.png`);
  await page.screenshot({ path: out, animations: 'disabled' });
  console.log(`SHOT saved ${out}`);
});
