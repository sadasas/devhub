#!/usr/bin/env node
// One-off backfill (M19/M20): assign startDate + dueDate to every task of the
// devhub project (05fca064), including done tasks. Not committed by design.
import { Pool } from 'pg';

const PROJECT_ID = '05fca064-6464-4570-ac1d-4155411a0c52';
const PROJECT_START = '2026-08-10';
const TODAY = new Date().toISOString().slice(0, 10);
const DONE_END = TODAY;
const TODO_END = addDays(TODAY, 14);

function addDays(iso, days) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function dayIndex(iso) {
  return Math.floor(Date.parse(`${iso}T00:00:00Z`) / 86_400_000);
}

function durationDays(task) {
  if (typeof task.estimate === 'number' && task.estimate > 0) {
    return Math.max(1, Math.ceil(task.estimate / 8));
  }
  return 3;
}

function spread(n, start, end) {
  const span = dayIndex(end) - dayIndex(start);
  return (i) => (n <= 1 ? start : addDays(start, Math.floor((i * span) / (n - 1))));
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const res = await pool.query('SELECT data, version FROM projects WHERE id = $1', [PROJECT_ID]);
if (res.rows.length === 0) throw new Error('project not found');
const data = res.rows[0].data;
const version = res.rows[0].version;

const done = data.tasks.filter((t) => t.status === 'done');
const todo = data.tasks.filter((t) => t.status !== 'done');
const doneAt = spread(done.length, PROJECT_START, DONE_END);
const todoAt = spread(todo.length, TODAY, TODO_END);

let doneIdx = 0;
let todoIdx = 0;
for (const task of data.tasks) {
  const isDone = task.status === 'done';
  const idx = isDone ? doneIdx++ : todoIdx++;
  const start = isDone ? doneAt(idx) : todoAt(idx);
  task.startDate = start;
  task.dueDate = addDays(start, durationDays(task));
}

await pool.query('UPDATE projects SET data = $1, version = version + 1 WHERE id = $2', [JSON.stringify(data), PROJECT_ID]);
await pool.end();

console.log(
  JSON.stringify(
    {
      project: PROJECT_ID,
      tasks: data.tasks.length,
      done: done.length,
      todo: todo.length,
      version: `${version} -> ${version + 1}`,
      doneRange: [doneAt(0), doneAt(done.length - 1)],
      todoRange: [todoAt(0), todoAt(todo.length - 1)],
    },
    null,
    2,
  ),
);