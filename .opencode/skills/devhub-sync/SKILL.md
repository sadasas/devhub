---
name: devhub-sync
description: Sinkronisasi otomatis kerja AI ke DevHub via MCP. Gunakan setiap membuat keputusan arsitektural, menyusun/menyelesaikan task, atau merancang flowchart/diagram ketika MCP server `devhub` terkonfigurasi di opencode.json.
metadata:
  author: devhub
  version: "1.0.0"
---

# DevHub Sync

Eksekusi aturan sinkronisasi dari `AGENTS.md`. Berlaku hanya jika MCP `devhub` terjangkau;
jika tidak, catat pending dan lanjutkan kerja utama.

## 1. Resolusi projectId

1. User menyebut project di sesi → pakai.
2. Cek env: jalankan `echo $env:DEVHUB_PROJECT_ID` (PowerShell) atau `echo $DEVHUB_PROJECT_ID`
   (bash). Terisi → pakai.
3. Tidak ada → tanya user sekali, lalu konsisten sampai sesi berakhir.

Jangan pernah menebak UUID atau menulisnya ke file mana pun.

## 2. add_decision — keputusan selevel ADR

**Kapan**: struktur/komponen baru, dependensi ditambah/diganti, pola desain dipilih, hosting/
keamanan/performance tradeoff difinalisasi. **Bukan**: penamaan lokal, urutan properti CSS,
pilihan kosmetik.

```
add_decision {
  projectId: "<PROJECT_ID>",
  title: "Ringkas keputusan (mis. 'Pakai pointer events untuk drag touch')",
  status: "accepted",            // proposed | accepted | rejected | superseded
  date: "YYYY-MM-DD",            // default hari ini
  context: "Masalah & kendala yang memaksa keputusan",
  options: ["Opsi A — plus/minus", "Opsi B — plus/minus"],
  decision: "Yang dipilih dan alasan utamanya",
  consequences: "Dampak positif/negatif yang diterima"
}
```

Satu keputusan = satu panggilan, dilakukan saat keputusan fix (jangan menumpuk di akhir proyek).

## 3. create_task / update_task — unit kerja

**create_task** di awal kerja terencana (granular per unit yang bisa diverifikasi):

```
create_task {
  projectId: "<PROJECT_ID>",
  title: "Area singkat: apa yang dikerjakan",
  status: "todo" | "inProgress",
  priority: "low|medium|high|urgent",
  labels: ["area"], estimate: <jam>
}
```

**update_task** saat pekerjaan selesai & terverifikasi (lint/test/build hijau atau committed):

```
update_task { projectId, taskId, status: "done" }
```

`completedAt` dan `actualHours` terisi otomatis saat status pindah ke `done`.

## 4. create_whiteboard / update_whiteboard — diagram & flowchart

Saat merancang arsitektur/alur, simpan sebagai board (bukan sekadar teks di chat):

```
create_whiteboard {
  projectId: "<PROJECT_ID>",
  name: "Nama diagram",
  description: "Tujuan diagram",
  elements: [
    { kind: "text",   x: 0,   y: 0,   color: "#e4e4e7", fontSize: 16, text: "Judul" },
    { kind: "shape",  shapeType: "rect", x: 40, y: 60, w: 140, h: 64,
      color: "#6ea8fe", fill: false, strokeWidth: 2, label: "Komponen A" },
    { kind: "edge",   x1: 180, y1: 92, x2: 300, y2: 92, color: "#8b5cf6",
      width: 2, arrowhead: true, arrowStyle: "solid", dash: "solid", label: "memanggil" },
    { kind: "sticky", x: 320, y: 60, w: 200, h: 120, color: "#e8b955", text: "catatan" },
    { kind: "boundary", x: 20, y: 30, w: 480, h: 220, color: "#6ea8fe", label: "Bounded context" },
    { kind: "ref", entity: "tasks", entityId: "<task-uuid>", x: 40, y: 300 }
  ]
}
```

- `id` elemen opsional — server yang mengisi. Maks 1000 elemen per board.
- `ref` menampilkan kartu live task/issue; butuh UUID entitas yang valid.
- Mengubah board yang ada → `update_whiteboard { projectId, whiteboardId, elements }`
  (elements direplace seluruhnya, bukan patch).

## 5. Verifikasi & kesalahan umum

- Verifikasi hasil dengan `project_state { projectId, limit: 0 }` — **default cap 200 baris per
  koleksi**; item baru bisa terpotong bila koleksi besar.
- `409 Project changed since it was loaded` → state berubah sejak load terakhir; panggil ulang
  `project_state` lalu ulangi mutasi.
- `401` → key salah/kadaluarsa (`DEVHUB_MCP_KEY`); `Cannot connect` → server mati; keduanya
  non-blocking: catat pending, coba lagi di akhir sesi.
