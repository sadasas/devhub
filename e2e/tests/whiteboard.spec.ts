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

    const line = page.locator('svg.wb-svg line');
    await expect(line).toHaveCount(1);
    await expect(line).toHaveAttribute('x1', '100');
    await expect(line).toHaveAttribute('y1', '30');
    await expect(line).toHaveAttribute('x2', '260');
    await expect(line).toHaveAttribute('y2', '150');

    await waitForSaved(page, projectId);

    await page.reload();
    await expect(canvas).toBeVisible();
    const reloaded = page.locator('svg.wb-svg line');
    await expect(reloaded).toHaveCount(1);
    await expect(reloaded).toHaveAttribute('x1', '100');
    await expect(reloaded).toHaveAttribute('y1', '30');
    await expect(reloaded).toHaveAttribute('x2', '260');
    await expect(reloaded).toHaveAttribute('y2', '150');
  });
});