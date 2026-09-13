---
title: Peta Jalan
description: Dari mana DevHub berasal dan ke mana arahnya — fase, milestone, penundaan.
---

DevHub adalah workspace memori teknis SaaS: task, issue, skema + ERD, ADR, dokumen API, whiteboard, dan agen AI via MCP. Halaman ini ringkasan publiknya.

## Gambaran fase

| Fase | Nama | Tujuan | Status |
|---|---|---|---|
| 0 | Planning & Dokumentasi | Suite dokumen penuh + scope terkunci | Selesai |
| 1 | V1 Build | Aplikasi berjalan (board, issue, stack, skema, ADR, rilis, stats, MCP) | Selesai |
| 2 | Public Deploy | Hosting multi-user + hardening + legal | Selesai |
| 3 | Kolaborasi & beyond | Teams, realtime, billing, docs site | Berjalan |

## Sorotan yang sudah rilis

- **Teams & roles** — workspace dengan owner/admin/editor/viewer, invite email (kedaluwarsa 7 hari), sidebar per-team.
- **API stabil** — edit per item dengan penyimpanan kolaboratif yang aman dan kompatibel ke belakang.
- **Realtime** — perubahan tampil live untuk semua yang melihat, plus info siapa online.
- **Whiteboard** — kanvas brainstorming + flowchart terpadu dengan kartu ref entity live, template, ekspor PNG/SVG/PDF.
- **Calendar & dates** — tanggal mulai, tenggat, dan pelacakan penyelesaian dengan view board dan grid bulanan.
- **Billing (Pakasir)** — paket fleksibel, perpanjangan manual yang menumpuk, tenggang read-only 7 hari. Lihat [Billing](/id/billing/).
- **MCP untuk agen** — OAuth 2.1 PKCE, ~20 tools, mutasi tercatat di activity log. Lihat [MCP](/id/mcp/).

## Sedang berjalan

- **Docs site publik** — situs ini (Inggris + Indonesia): legal, MCP, roadmap, status, billing.
- **App trim** — `/privacy`, `/terms`, `/docs` redirect langsung ke situs ini.
- **API traceability MVP** — tautan endpoint ↔ task/issue/test.

## Sengaja ditunda

PWA/offline, sync multi-device, integrasi Git CLI, chat AI di aplikasi (by design — AI tinggal di klien MCP), request runner untuk dokumen API. Setiap penundaan dicatat beserta rasionalnya.

*Terakhir diperbarui 2026-09-13.*
