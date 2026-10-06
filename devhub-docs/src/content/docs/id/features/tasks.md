---
title: Tugas & papan
description: Papan Kanban dengan tampilan milestone dan kalender, dependensi, estimasi, dan tenggat.
---

Tugas yang diikuti seluruh tim. Seret kartu melintasi papan, lalu lihat semua tenggat dalam satu kalender.

## Tampilan

- **By Status** — Kanban: Todo / In Progress / Review / Done, drag-and-drop HTML5.
- **By Milestone** — tugas dikelompokkan di bawah [milestone](/id/features/milestones/)-nya.
- **Calendar** — tanggal mulai dan tenggat dalam grid bulan, dengan chip overdue.

## Field pelacakan

Estimasi vs aktual, prioritas, label, dependensi tugas (`blockedBy`), assignee, dan tanggal mulai/tenggat. Tugas bertanggal bisa tersinkron ke Google Calendar — lihat [Integrasi proyek](/id/integrations/).

## Bekerja dengan agen

MCP tools: `create_task`, `update_task` (status, priority, estimate, labels, dates, assignee). Loop agen tipikal: `project_state` → `plan_project` → `create_task × n` → implementasi → `update_task`. Lihat [Integrasi MCP](/id/mcp/).

Bagian dari [Fitur](/id/features/). Terkait: [Isu](/id/features/issues/) yang diperbaiki tugas, [Test case](/id/features/testing/) yang menempel pada tugas.
