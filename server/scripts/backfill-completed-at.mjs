#!/usr/bin/env node
// One-off backfill (M22): set completedAt = updatedAt (proxy) for every DONE
// task that lacks completedAt in the devhub project (05fca064). Idempotent.
// Dry-run by default: add --apply to write. Not committed by design.
import { Pool } from 'pg';

const PROJECT_ID = '05fca064-6464-4570-ac1d-4155411a0c52';
const APPLY = process.argv.includes('--apply');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const res = await pool.query('SELECT data, version FROM projects WHERE id = $1', [PROJECT_ID]);
if (res.rows.length === 0) throw new Error('project not found');
const data = res.rows[0].data;
const version = res.rows[0].version;

let updated = 0;
let skippedInvalid = 0;
for (const task of data.tasks) {
  if (task.status !== 'done' || task.completedAt) continue;
  const at = task.updatedAt && !Number.isNaN(Date.parse(task.updatedAt)) ? task.updatedAt : new Date().toISOString();
  if (task.createdAt && Date.parse(at) < Date.parse(task.createdAt)) {
    skippedInvalid++;
    continue;
  }
  task.completedAt = at;
  updated++;
}

if (!APPLY) {
  console.log(
    JSON.stringify({ mode: 'dry-run', project: PROJECT_ID, wouldUpdate: updated, skippedInvalid }, null, 2),
  );
  await pool.end();
  process.exit(0);
}

await pool.query('UPDATE projects SET data = $1, version = version + 1 WHERE id = $2', [
  JSON.stringify(data),
  PROJECT_ID,
]);
await pool.end();

console.log(
  JSON.stringify(
    {
      mode: 'applied',
      project: PROJECT_ID,
      updated,
      skippedInvalid,
      version: `${version} -> ${version + 1}`,
    },
    null,
    2,
  ),
);