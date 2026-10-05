---
title: Keputusan (ADR)
description: Architecture Decision Record dengan konteks, opsi, dan konsekuensi — tetap searchable lama setelah meeting.
---

Putuskan lewat ADR, bukan thread. Setiap keputusan mencatat konteksnya, opsi yang dipertimbangkan, keputusan itu sendiri, dan konsekuensinya — tetap searchable lama setelah meeting selesai.

## Lifecycle

`proposed → accepted | rejected | superseded`.

## Apa yang dicatat

Hanya keputusan level ADR: struktur, dependensi, pola, hosting, keamanan. Pilihan kosmetik atau gaya kecil tidak perlu ADR.

## Bekerja dengan agen

MCP tool: `add_decision` (title, context, options, decision, consequences, status, date). Lihat [Integrasi MCP](/id/mcp/) untuk auth dan daftar tool lengkap.

Bagian dari [Fitur](/id/features/). Terkait: [Skema database](/id/features/schema/) dan [Dokumentasi API](/id/features/api-docs/) — artefak yang dijelaskan oleh keputusan.
