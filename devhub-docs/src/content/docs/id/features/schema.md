---
title: Skema database
description: Tabel, kolom, dan relasi dengan ERD visual, versioning skema, dan diff visual yang aman.
---

Review diff skema dengan aman. Definisikan tabel, kolom, dan relasi dengan ERD visual (SVG, pan & zoom), lalu versikan skema dan bandingkan versi sebelum apa pun mencapai produksi.

## Yang didapat

- **CRUD Tabel / Kolom / Relasi** dengan warna header per tabel.
- **ERD visual** — rel kanvas (Tables / Refs / Versions / DBML) dengan highlight alur relasi.
- **Versioning skema** — simpan versi bernama dari seluruh skema.
- **Diff skema** — bandingkan dua versi: tabel, kolom, dan relasi yang ditambah atau dihapus.

## Bekerja dengan agen

MCP tools: `add_table`, `add_relation`, `delete_relation` (columns, indexes, cardinality, `onDelete`). Lihat [Integrasi MCP](/id/mcp/) untuk auth dan daftar tool lengkap.

Bagian dari [Fitur](/id/features/). Terkait: [Keputusan](/id/features/decisions/) tentang alasan skema berbentuk demikian, [Dokumentasi API](/id/features/api-docs/) untuk endpoint di depannya.
