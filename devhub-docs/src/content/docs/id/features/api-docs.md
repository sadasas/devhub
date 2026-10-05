---
title: Dokumentasi API
description: Collection dan endpoint dengan header, param, body, respons — plus impor/ekspor OpenAPI 3.0.3.
---

Dokumentasi API yang bisa dibaca tim. Collection dan endpoint terdokumentasi dan searchable, dengan pratinjau docs read-only.

## Yang didokumentasikan

Per endpoint: HTTP method, path, deskripsi, header, param (path / query / header), request body, dan contoh respons.

## OpenAPI

Impor dan ekspor OpenAPI 3.0.3 (YAML/JSON) agar inventaris tetap sinkron dengan implementasi.

## Bekerja dengan agen

MCP tools: `add_api_collection`, `add_api_endpoint`, `update_api_endpoint`. Bila sebuah fitur mengekspos HTTP endpoint, dokumentasikan segera setelah route di-commit — sebelum tugas ditandai selesai. Lihat [Integrasi MCP](/id/mcp/).

Bagian dari [Fitur](/id/features/). Terkait: [Skema database](/id/features/schema/) di balik endpoint, [Keputusan](/id/features/decisions/) di balik desainnya.
