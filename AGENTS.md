# DevHub Agent Sync Protocol

Aturan ini berlaku ketika MCP server `devhub` terkonfigurasi (lihat `opencode.json`) dan dapat
dijangkau. Jika tidak terjangkau, catat sebagai pending, lanjutkan kerja utama, dan coba lagi di
akhir sesi — sinkronisasi tidak boleh memblokir pekerjaan.

## Resolusi project target (berjenjang)

1. User menyebut project di sesi → pakai itu.
2. Env var `DEVHUB_PROJECT_ID` terisi → pakai itu.
3. Tidak keduanya → tanya user sekali di awal sesi kerja, lalu konsisten sampai sesi berakhir.

Jangan pernah menebak `projectId` atau menulisnya langsung ke file mana pun.

## Sinkronisasi wajib

| Kejadian | Tool DevHub | Moment |
| --- | --- | --- |
| Keputusan arsitektural/tradeoff difinalisasi (struktur, dependensi, pola, hosting, keamanan) | `add_decision` | Saat keputusan fix |
| Rencana kerja bertahap disusun / mulai implementasi | `create_task` | Awal sesi kerja |
| Pekerjaan selesai dan terverifikasi (lint/test/build hijau atau sudah di-commit) | `update_task` status `done` | Sebelum menutup sesi |
| Flowchart / diagram arsitektur / alur dirancang atau berubah | `create_whiteboard` / `update_whiteboard` | Saat desain dibuat |

Detail eksekusi tiap tool (payload, contoh, batasan) ada di skill `.opencode/skills/devhub-sync/SKILL.md`.

## Aturan perilaku

- Hanya keputusan selevel ADR yang dicatat — pilihan gaya/kosmetik kecil tidak.
- Satu keputusan = satu panggilan; jangan batch menumpuk di akhir proyek.
- Task dibuat granular per unit kerja yang bisa diverifikasi, bukan satu task raksasa.
- Setelah sinkron, verifikasi dengan `project_state` bila ragu (ingat: default hanya 200 baris
  per koleksi — pakai `limit: 0` untuk melihat semua).
