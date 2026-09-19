import { test, expect } from '../helpers/fixture';
import { ownerContext, getTeamId, createProject, deleteProject, uniqueName, addEntity } from '../helpers/api';
import { waitForSaved } from '../helpers/wait';

// Serial + per-test cleanup: the Free workspace fits 3 projects, so the four
// journeys below must never hold more than one project at a time.
test.describe.serial('whiteboard canvas journeys', () => {
  test('draw → save → reload keeps elements', async ({ page }) => {
    const ctx = await ownerContext();
    const teamId = await getTeamId(ctx);
    const projectId = await createProject(ctx, teamId, uniqueName('E2E-WB-Draw'));
    const boardName = uniqueName('E2E-Board');

    await page.goto(`/project/${projectId}?tab=whiteboard`);
    await expect(page.getByRole('heading', { name: 'No whiteboards yet' })).toBeVisible();

    await page.getByRole('button', { name: 'New board' }).first().click();
    await expect(page.getByRole('heading', { name: 'New whiteboard' })).toBeVisible();
    await page.getByLabel('Name').fill(boardName);
    await page.getByRole('button', { name: 'Create board' }).click();

    await page.locator('.wb-card-main').click();
    const canvas = page.locator('svg.wb-svg');
    await expect(canvas).toBeVisible();
    await expect(
      page.getByRole('group', { name: new RegExp(`${boardName} — 0 elements`) }),
    ).toBeVisible();

    const box = (await canvas.boundingBox())!;
    const startX = box.x + box.width / 2 - 100;
    const startY = box.y + box.height / 2;

    await page.getByRole('button', { name: 'Pen — P' }).click();
    await page.mouse.move(startX, startY);
    await page.mouse.down();
    for (let i = 1; i <= 8; i += 1) {
      await page.mouse.move(startX + i * 8, startY + i * 5);
    }
    await page.mouse.up();
    await expect(
      page.getByRole('group', { name: new RegExp(`${boardName} — 1 elements`) }),
    ).toBeVisible();

    await page.getByRole('button', { name: 'Sticky note — N' }).click();
    await page.mouse.click(box.x + box.width / 2 + 120, box.y + box.height / 2 + 100);
    await expect(
      page.getByRole('group', { name: new RegExp(`${boardName} — 2 elements`) }),
    ).toBeVisible();

    await waitForSaved(page, projectId);

    await page.reload();
    await expect(canvas).toBeVisible();
    await expect(
      page.getByRole('group', { name: new RegExp(`${boardName} — 2 elements`) }),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Back to boards' }).click();
    const card = page.locator('.wb-card', { hasText: boardName });
    await expect(card).toBeVisible();
    await expect(card.getByText(/2 elements/)).toBeVisible();

    await card.locator('.wb-card-main').click();
    await expect(canvas).toBeVisible();
    await expect(
      page.getByRole('group', { name: new RegExp(`${boardName} — 2 elements`) }),
    ).toBeVisible();

    await deleteProject(ctx, projectId);
  });

  test('dragging a node keeps the locked edge ports attached', async ({ page }) => {
    const ctx = await ownerContext();
    const teamId = await getTeamId(ctx);
    const projectId = await createProject(ctx, teamId, uniqueName('E2E-WB-Drag'));
    const boardName = uniqueName('E2E-Board');

    const idA = crypto.randomUUID();
    const idB = crypto.randomUUID();
    const idE = crypto.randomUUID();
    const { entity: board } = await addEntity<{ id: string }>(ctx, projectId, 'whiteboards', {
      id: crypto.randomUUID(),
      name: boardName,
      description: '',
      elements: [
        { id: idA, kind: 'sticky', x: 0, y: 0, w: 100, h: 60, color: '#e8b955', text: 'A' },
        { id: idB, kind: 'sticky', x: 200, y: 0, w: 100, h: 60, color: '#e8b955', text: 'B' },
        {
          id: idE,
          kind: 'edge',
          sourceNodeId: idA,
          targetNodeId: idB,
          sourcePort: 'right',
          targetPort: 'left',
          x1: 100,
          y1: 30,
          x2: 200,
          y2: 30,
          arrowhead: true,
          color: '#8b5cf6',
          width: 2,
        },
      ],
    });

    await page.goto(`/project/${projectId}?tab=whiteboard&id=${board.id}`);
    const canvas = page.locator('svg.wb-svg');
    await expect(canvas).toBeVisible();
    await expect(
      page.getByRole('group', { name: new RegExp(`${boardName} — 3 elements`) }),
    ).toBeVisible();

    const box = (await canvas.boundingBox())!;
    const bCenterX = box.x + 16 + 250;
    const bCenterY = box.y + 16 + 30;

    await page.mouse.move(bCenterX, bCenterY);
    await page.mouse.down();
    for (let i = 1; i <= 5; i += 1) {
      await page.mouse.move(bCenterX + i * 12, bCenterY + i * 24);
    }
    await page.mouse.up();

    const polyline = page.locator('svg.wb-svg polyline');
    await expect(polyline).toHaveCount(1);
    await expect(polyline).toHaveAttribute('points', '100,30 232,30 232,158 256,158');

    await waitForSaved(page, projectId);

    await page.reload();
    await expect(canvas).toBeVisible();
    const reloaded = page.locator('svg.wb-svg polyline');
    await expect(reloaded).toHaveCount(1);
    await expect(reloaded).toHaveAttribute('points', '100,30 232,30 232,158 256,158');

    await deleteProject(ctx, projectId);
  });

  test('figjam chrome: corner handles, port dots, shape strip and object menu', async ({ page }) => {
    const ctx = await ownerContext();
    const teamId = await getTeamId(ctx);
    const projectId = await createProject(ctx, teamId, uniqueName('E2E-WB-Figjam'));
    const boardName = uniqueName('E2E-Board');

    const { entity: board } = await addEntity<{ id: string }>(ctx, projectId, 'whiteboards', {
      id: crypto.randomUUID(),
      name: boardName,
      description: '',
      elements: [
        { id: crypto.randomUUID(), kind: 'sticky', x: 0, y: 0, w: 100, h: 60, color: '#e8b955', text: 'A' },
      ],
    });

    await page.goto(`/project/${projectId}?tab=whiteboard&id=${board.id}`);
    const canvas = page.locator('svg.wb-svg');
    await expect(canvas).toBeVisible();

    // Default tool is select: clicking the sticky selects it with FigJam adornments.
    const box = (await canvas.boundingBox())!;
    await page.mouse.click(box.x + 16 + 50, box.y + 16 + 30);
    await expect(page.locator('[data-testid="wb-resize-handle"]')).toHaveCount(4);
    await expect(page.locator('[data-testid="wb-port-handle"]')).toHaveCount(4);

    // Shape primer strip (7 FigJam-identical) + More shapes library panel.
    await page.getByRole('button', { name: 'Shape — S' }).click();
    const menu = page.getByRole('menu', { name: 'Shape type' });
    await expect(menu).toBeVisible();
    await expect(menu.getByRole('menuitemradio')).toHaveCount(7);
    await page.getByRole('button', { name: 'More shapes' }).click();
    await expect(page.getByRole('dialog', { name: 'More shapes' })).toBeVisible();

    // Right-click object menu re-selects and offers FigJam actions.
    await page.keyboard.press('Escape');
    await page.mouse.click(box.x + 16 + 50, box.y + 16 + 30, { button: 'right' });
    const ctxMenu = page.getByRole('menu', { name: 'Object actions' });
    await expect(ctxMenu).toBeVisible();
    await expect(ctxMenu.getByRole('menuitem', { name: 'Copy Ctrl+C' })).toBeVisible();
    await expect(ctxMenu.getByRole('menuitem', { name: 'Paste to replace Ctrl+Shift+V' })).toBeVisible();

    await deleteProject(ctx, projectId);
  });

  test('labels an edge via popover and copy/paste duplicates the selection', async ({ page }) => {
    const ctx = await ownerContext();
    const teamId = await getTeamId(ctx);
    const projectId = await createProject(ctx, teamId, uniqueName('E2E-WB-Paste'));
    const boardName = uniqueName('E2E-Board');

    const idA = crypto.randomUUID();
    const idB = crypto.randomUUID();
    const { entity: board } = await addEntity<{ id: string }>(ctx, projectId, 'whiteboards', {
      id: crypto.randomUUID(),
      name: boardName,
      description: '',
      elements: [
        { id: idA, kind: 'sticky', x: 0, y: 0, w: 100, h: 60, color: '#e8b955', text: 'A' },
        { id: idB, kind: 'sticky', x: 200, y: 0, w: 100, h: 60, color: '#e8b955', text: 'B' },
      ],
});
    await page.goto(`/project/${projectId}?tab=whiteboard&id=${board.id}`);
    const canvas = page.locator('svg.wb-svg');
    await expect(canvas).toBeVisible();
    await expect(
      page.getByRole('group', { name: new RegExp(`${boardName} — 2 elements`) }),
    ).toBeVisible();

    const box = (await canvas.boundingBox())!;
    const aX = box.x + 16 + 50;
    const aY = box.y + 16 + 30;
    const bX = box.x + 16 + 250;
    const bY = box.y + 16 + 30;

    await page.getByRole('button', { name: 'Edge — L' }).click();
    await page.mouse.move(aX, aY);
    await page.mouse.down();
    await page.mouse.move(bX, bY, { steps: 5 });
    await page.mouse.up();
    await expect(
      page.getByRole('group', { name: new RegExp(`${boardName} — 3 elements`) }),
    ).toBeVisible();

    // Edge polylines only — the selection halo is a second polyline per selected edge.
    const edgeLines = page.locator('svg.wb-svg polyline:not([stroke-opacity])');
    await expect(edgeLines).toHaveCount(1);
    await edgeLines.first().dblclick({ force: true });
    const editor = page.getByRole('textbox', { name: 'Label' });
    await expect(editor).toBeVisible();
    await editor.fill('Yes');
    await editor.press('Enter');
    await expect(page.locator('svg.wb-svg .wb-edge-label', { hasText: 'Yes' })).toBeVisible();

    const box2 = (await canvas.boundingBox())!;
    // Back to select, clear the edge selection/text bar on empty canvas,
    // then marquee all three (edge included) clear of the corner panels.
    await page.getByRole('button', { name: 'Select — V' }).click();
    await page.mouse.click(box2.x + 16 + 400, box2.y + 16 + 200);
    await page.getByRole('button', { name: 'Select area — M' }).click();
    // Marquee below the top-left corner panel, ending clear of both corner
    // panels; rect still overlaps both stickies and the edge (svg y 16..76/30).
    await page.mouse.move(box2.x + 16 + 60, box2.y + 16 + 90);
    await page.mouse.down();
    await page.mouse.move(box2.x + 16 + 340, box2.y + 16 + 20, { steps: 8 });
    await page.mouse.up();
    await expect(page.locator('[data-testid="wb-selection"]')).toHaveCount(2);
    await expect(page.getByRole('group', { name: 'Selection actions' })).toBeVisible();

    // Focus the canvas first: shortcuts are canvas-scoped like FigJam.
    // NOTE: headless-shell swallows the Ctrl+V letter keydown (Ctrl+X works),
    // so paste goes through the object menu here; keyboard paste is unit-tested.
    await canvas.press('Control+c');
    // Right-click empty canvas below the stickies (clear of inspector/chat overlays).
    await page.mouse.click(box2.x + 16 + 150, box2.y + 16 + 200, { button: 'right' });
    await page.getByRole('menu', { name: 'Object actions' }).getByRole('menuitem', { name: 'Paste Ctrl+V' }).click();
    await expect(
      page.getByRole('group', { name: new RegExp(`${boardName} — 6 elements`) }),
    ).toBeVisible();
    await expect(page.locator('svg.wb-svg .wb-edge-label', { hasText: 'Yes' })).toHaveCount(2);

    await waitForSaved(page, projectId);

    await page.reload();
    await expect(canvas).toBeVisible();
    await expect(
      page.getByRole('group', { name: new RegExp(`${boardName} — 6 elements`) }),
    ).toBeVisible();
    await expect(page.locator('svg.wb-svg polyline:not([stroke-opacity])')).toHaveCount(2);
    await expect(page.locator('svg.wb-svg .wb-edge-label', { hasText: 'Yes' })).toHaveCount(2);

    await deleteProject(ctx, projectId);
  });
});