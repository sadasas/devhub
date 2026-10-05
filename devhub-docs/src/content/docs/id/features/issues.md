---
title: Isu
description: Triase bug dengan severity, lifecycle, langkah reproduksi, dan tautan ke tugas yang memperbaikinya.
---

Triase bug sebelum standup. Setiap isu membawa severity, status lifecycle, langkah reproduksi, dan tautan ke tugas yang memperbaikinya.

## Severity & lifecycle

- **Severity:** Critical, High, Medium, Low.
- **Lifecycle:** `open → reproduced → fixing → resolved | wontfix`.

## Langkah reproduksi

Tulis apa yang dilakukan, apa yang diharapkan, dan apa yang terjadi — agar siapa pun (atau agen apa pun) bisa mereproduksi bug tanpa tanya balik.

## Menautkan ke tugas

Tautkan isu ke tugas yang memperbaikinya. Tautan terlihat di kedua sisi, dan status review/CI dari pull request [GitHub](/id/integrations/) tersinkron ke tugas tertaut.

## Bekerja dengan agen

MCP tools: `add_issue` / `update_issue` (severity, status, reproduction, `linkedTaskId`). Lihat [Integrasi MCP](/id/mcp/) untuk auth dan daftar tool lengkap.

Bagian dari [Fitur](/id/features/). Lanjut: [Test case](/id/features/testing/) untuk membuktikan perbaikan, [Milestone](/id/features/milestones/) untuk merilisnya.
