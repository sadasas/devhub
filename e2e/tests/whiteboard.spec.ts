import { test, expect } from '../helpers/fixture';
import { ownerContext, getTeamId, createProject, uniqueName, addEntity } from '../helpers/api';
import { waitForSaved } from '../helpers/wait';

test.describe('whiteboard canvas journeys', () => {
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

    await page.getByRole('button', { name: 'Pen — 2' }).click();
    await page.mouse.move(startX, startY);
    await page.mouse.down();
    for (let i = 1; i <= 8; i += 1) {
      await page.mouse.move(startX + i * 8, startY + i * 5);
    }
    await page.mouse.up();
    await expect(
      page.getByRole('group', { name: new RegExp(`${boardName} — 1 elements`) }),
    ).toBeVisible();

    await page.getByRole('button', { name: 'Sticky note — 5' }).click();
    await page.mouse.click(box.x + box.width / 2 + 120, box.y + box.height / 2 + 100);
    await expect(page.getByRole('dialog', { name: 'Edit sticky' })).toBeVisible();
    await page.getByRole('button', { name: 'Finish editing' }).click();
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
    const card = page.locator('.wb-card-main', { hasText: boardName });
    await expect(card).toBeVisible();
    await expect(card.getByText('2 elements')).toBeVisible();

    await card.click();
    await expect(canvas).toBeVisible();
    await expect(
      page.getByRole('group', { name: new RegExp(`${boardName} — 2 elements`) }),
    ).toBeVisible();
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

    await page.getByRole('button', { name: 'Edge — 7' }).click();
    await page.mouse.move(aX, aY);
    await page.mouse.down();
    await page.mouse.move(bX, bY, { steps: 5 });
    await page.mouse.up();
    await expect(
      page.getByRole('group', { name: new RegExp(`${boardName} — 3 elements`) }),
    ).toBeVisible();

    const polyline = page.locator('svg.wb-svg polyline');
    await expect(polyline).toHaveCount(1);
    await polyline.dblclick({ force: true });
    const popover = page.getByRole('dialog', { name: 'Edit edge' });
    await expect(popover).toBeVisible();
    await popover.getByLabel('Label').fill('Yes');
    await popover.getByRole('button', { name: 'Finish editing' }).click();
    await expect(page.locator('svg.wb-svg .wb-edge-label', { hasText: 'Yes' })).toBeVisible();

    const box2 = (await canvas.boundingBox())!;
    await page.getByRole('button', { name: 'Select area — 9' }).click();
    await page.mouse.move(box2.x + 16 + 20, box2.y + 16 + 10);
    await page.mouse.down();
    await page.mouse.move(box2.x + 16 + 290, box2.y + 16 + 60, { steps: 8 });
    await page.mouse.up();
    await expect(page.locator('[data-testid="wb-selection"]')).toHaveCount(2);
    await expect(page.getByRole('group', { name: 'Selection actions' })).toBeVisible();

    await page.keyboard.press('Control+c');
    await page.keyboard.press('Control+v');
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
    await expect(page.locator('svg.wb-svg polyline')).toHaveCount(2);
    await expect(page.locator('svg.wb-svg .wb-edge-label', { hasText: 'Yes' })).toHaveCount(2);
  });
});