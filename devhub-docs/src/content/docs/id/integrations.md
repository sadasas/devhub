---
title: Integrasi Proyek
description: Hubungkan Google Calendar dan GitHub ke proyek DevHub — fungsi masing-masing, data yang diakses, dan cara mengelolanya.
---

Integrasi proyek menghubungkan sebuah proyek ke aplikasi eksternal. Semuanya **mati secara default** dan hanya berjalan setelah owner/admin menghubungkannya di **Project settings → Integrations**. Panel di aplikasi hanya mendaftar fitur yang dipakai; halaman ini adalah panduan lengkapnya.

## Google Calendar

### Fungsinya

- Task bertanggal awal/tenggat menjadi **event sehari penuh** di kalender sekunder bernama `DevHub - <project>` di akun Google Anda.
- Tersinkron per task: judul (prefix `[Done]` bila selesai), tanggal, deskripsi, prioritas, label, status, dan tautan kembali ke task. Task tanpa tanggal dilewati.
- Suntikan dan penghapusan tersinkron otomatis.
- **Toggle sinkronisasi** menjeda sync tanpa memutuskan koneksi.

### Izin & data

- Scope OAuth least-privilege `calendar.app.created`: DevHub hanya dapat membuat dan mengelola kalender serta event buatannya — tidak dapat membaca kalender Anda yang lain.
- Token koneksi disimpan terenkripsi dan diperbarui otomatis.

### Kelola & troubleshooting

- **Disconnect** menghentikan sinkronisasi; event yang sudah dibuat tetap ada di kalender Anda.
- Koneksi **kedaluwarsa** menampilkan banner — gunakan **Reconnect**.
- Anda juga bisa mencabut akses via [izin akun Google](https://myaccount.google.com/permissions).
- Bila sync gagal setelah perubahan scope, sambungkan ulang agar token baru membawa scope terkini.

Detail di [Kebijakan Privasi](/id/privacy/) dan [Syarat Layanan](/id/terms/).

## GitHub

### Fungsinya

- **Penautan otomatis:** pull request, commit, dan branch tertaut ke task bila membawa kunci task.
- **Format DEV key** (di nama branch, judul/body PR, pesan commit): `DEV-XXXXXXXX` (8 hex, case-insensitive, ala Linear), UUID task penuh, atau short id 8-hex.
- **Komentar linkback:** PR pertama yang menautkan task mendapat komentar `🔗 Linked to DevHub task(s)`.
- **Status review & CI** tersinkron ke task tertaut (badge di task).
- **Automasi status**, terpisah untuk “On PR opened” dan “On PR merged”: `Auto` memindahkan `todo → In Progress` saat dibuka dan `→ Done` saat merge; `Suggest` menautkan plus menampilkan banner saran; `Off` hanya menautkan.
- **Retry failed sync** mengulang antrean webhook yang gagal.
- Satu repositori per proyek.

### Izin & data

- GitHub App mengirim event webhook (`push`, `pull_request`, review, check) untuk repo tertaut; DevHub membaca metadata PR/commit/check/review via webhook dan API.
- Akses memakai token instalasi berumur pendek (~1 jam, diperbarui saat dipakai) — kata sandi GitHub Anda tidak pernah disimpan.
- Tersimpan: pemetaan repo plus tautan task (repo, referensi, judul, status, state CI/review).

### Kelola

- Hanya owner/admin yang dapat menghubungkan atau mengubah pemetaan; editor hanya baca.
- **Menghubungkan:** tekan Connect → install App di organisasi GitHub Anda → pilih satu repositori → Connect repository.
- **Disconnect** menghapus pemetaan; tautan task dipertahankan sebagai riwayat. Uninstall atau suspend App di GitHub juga menghentikan pengiriman.

Detail di [Kebijakan Privasi](/id/privacy/) dan [Syarat Layanan](/id/terms/).
