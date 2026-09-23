import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeEach, describe, expect, it } from 'vitest';
import { pool } from '../src/db/pool.js';
import { resetDb } from './setup.js';
import { createProject, register } from './helpers.js';

const MIGRATION_FILE = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  'src',
  'db',
  'migrations',
  '044_whiteboard_light_canvas.sql',
);

const uid = () => crypto.randomUUID();

/** Board legacy: warna terang didesain untuk kanvas gelap. */
function legacyBoard() {
  return {
    id: uid(),
    name: 'Legacy',
    description: '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    elements: [
      { id: uid(), kind: 'text', x: 0, y: 0, color: '#e4e4e7', fontSize: 16, text: 'hi', w: 200 },
      { id: uid(), kind: 'edge', x1: 0, y1: 0, x2: 10, y2: 0, color: '#e4e4e7', width: 2, arrowhead: false, label: '', arrowStyle: 'solid' },
      { id: uid(), kind: 'shape', shapeType: 'rect', x: 0, y: 0, w: 100, h: 60, color: '#6ea8fe', fill: true, strokeWidth: 2, label: 'Box', labelColor: null },
      { id: uid(), kind: 'shape', shapeType: 'rect', x: 0, y: 0, w: 100, h: 60, color: '#1a1a1a', fill: true, strokeWidth: 2, label: 'Dark', labelColor: '#e4e4e7' },
      { id: uid(), kind: 'boundary', x: 0, y: 0, w: 300, h: 200, color: '#6ea8fe', label: 'Area', labelColor: '#e4e4e7' },
      { id: uid(), kind: 'sticky', x: 0, y: 0, w: 100, h: 60, color: '#e8b955', text: 'amber', textColor: '#e4e4e7' },
      { id: uid(), kind: 'sticky', x: 0, y: 0, w: 100, h: 60, color: '#1a1a1a', text: 'dark', textColor: '#e4e4e7' },
      { id: uid(), kind: 'stroke', tool: 'pen', color: '#e4e4e7', width: 2, thinning: 2, points: [[0, 0], [5, 5]] },
    ],
  };
}

describe('044_whiteboard_light_canvas', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('me-rewrite warna terang legacy ke padanan gelap (idempoten, niat user utuh)', async () => {
    const cookie = await register('mig044@gmail.com');
    const projectId = await createProject(cookie, 'Mig 044');
    await pool.query(`UPDATE projects SET data = jsonb_build_object('whiteboards', $2::jsonb) WHERE id = $1`, [
      projectId,
      JSON.stringify([legacyBoard()]),
    ]);

    const sql = await readFile(MIGRATION_FILE, 'utf8');
    await pool.query(sql);
    // Run ulang = no-op (idempoten).
    await pool.query(sql);

    const { rows } = await pool.query<{ data: { whiteboards: Array<{ elements: Array<Record<string, unknown>> }> } }>(
      'SELECT data FROM projects WHERE id = $1',
      [projectId],
    );
    const els = rows[0]!.data.whiteboards[0]!.elements;
    const byKind = (kind: string) => els.filter((e) => e['kind'] === kind);

    // Ink terang → gelap.
    expect(byKind('text')[0]!['color']).toBe('#374151');
    expect(byKind('edge')[0]!['color']).toBe('#374151');
    expect(byKind('stroke')[0]!['color']).toBe('#374151');
    // Shape fill terang → gelap + label null diterangkan.
    const filled = byKind('shape')[0]!;
    expect(filled['color']).toBe('#2563eb');
    expect(filled['labelColor']).toBe('#f8fafc');
    // Fill gelap custom + label terang = niat user → label TETAP terang.
    const darkFill = byKind('shape')[1]!;
    expect(darkFill['color']).toBe('#1a1a1a');
    expect(darkFill['labelColor']).toBe('#e4e4e7');
    // Boundary: stroke + label terang → gelap.
    const boundary = els.find((e) => e['kind'] === 'boundary')!;
    expect(boundary['color']).toBe('#2563eb');
    expect(boundary['labelColor']).toBe('#374151');
    // Sticky amber (fill terbaca) utuh; teks terang di atasnya digelapkan.
    const amber = byKind('sticky')[0]!;
    expect(amber['color']).toBe('#e8b955');
    expect(amber['textColor']).toBe('#374151');
    // Sticky fill gelap + teks terang = niat user → utuh.
    const darkSticky = byKind('sticky')[1]!;
    expect(darkSticky['color']).toBe('#1a1a1a');
    expect(darkSticky['textColor']).toBe('#e4e4e7');
    // Urutan + jumlah elemen utuh.
    expect(els).toHaveLength(8);
  });
});
