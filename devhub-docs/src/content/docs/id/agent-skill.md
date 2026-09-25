---
title: Skill Agen AI (Whiteboard)
description: Pasang SKILL.md whiteboard DevHub agar agen AI memvalidasi layout, menambal board, dan menulis embed SVG-AI dengan benar.
---

MCP server DevHub mengekspos tools whiteboard, tetapi skema tool saja tidak mengajarkan *alur kerja* ke agen: validasi sebelum menulis, patch vs replace keseluruhan, dan kontrak SVG `embed`. Skill **`devhub-whiteboard`** mengemas pengetahuan itu sebagai file `SKILL.md` yang dimuat otomatis oleh agen.

## Instalasi

Salin file skill dari repo DevHub (`skills/devhub-whiteboard/SKILL.md`) ke direktori skills agen Anda:

| Agen | Tujuan |
|---|---|
| opencode | `.opencode/skills/devhub-whiteboard/SKILL.md` (proyek) atau `~/.config/opencode/skills/` (global) |
| Claude Code | `~/.claude/skills/devhub-whiteboard/SKILL.md` |
| Cursor / VS Code | `.cursor/skills/devhub-whiteboard/SKILL.md` (atau direktori skills yang dikonfigurasi) |

Tanpa build — `SKILL.md` adalah Markdown biasa dengan frontmatter. Agen memakainya saat permintaan Anda cocok dengan `description`-nya ("draw on the whiteboard", "create a wireframe", "validate board layout", …).

## Isi skill (berbahasa Inggris)

- **Alur wajib:** `list_whiteboards` → `validate_whiteboard` (dry-run) → `create_whiteboard` / `patch_whiteboard`.
- **Tool yang tepat:** `patch_whiteboard` untuk edit granular; `update_whiteboard` mengganti seluruh array elemen.
- **Cheat-sheet elemen:** 8 kind (`stroke`, `sticky`, `text`, `shape`, `edge`, `boundary`, `ref`, `embed`) beserta field wajibnya.
- **Kontrak `embed`:** fragmen SVG, grouping `<g data-component="name">` per widget, allowlist sanitizer, maks 20 embed per board.
- **Batas & jebakan:** 1000 elemen/board, 50 board/proyek, gap ≥30px, enum `fill` (`solid`/`transparent`/`none`), scope OAuth.

## Prasyarat

Skill mengasumsikan MCP server sudah terhubung — lihat [Integrasi MCP](/id/mcp) untuk setup OAuth dan scope (`mcp` untuk akses penuh). Setiap panggilan whiteboard butuh `projectId` dari header halaman proyek.

## Cakupan

`devhub-whiteboard` hanya mencakup whiteboard. Skill untuk tools DevHub lainnya (task, issue, skema, dokumen API) akan menyusul dengan pola yang sama.
