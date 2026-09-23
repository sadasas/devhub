---
title: Kebijakan Privasi
description: Data apa yang dikumpulkan DevHub, mengapa, dan hak Anda. Dokumen kanonis versi 2026-09-23-v4, berlaku 2026-08-13.
---

> **Dokumen legal kanonis — versi `2026-09-23-v4`, terakhir diperbarui 2026-09-23, berlaku 2026-08-13.**
> Halaman ini adalah satu-satunya sumber kebenaran. Terjemahan bahasa Indonesia dari [Privacy Policy](/privacy/) — jika ada perbedaan, versi Inggris yang berlaku.
> Rute aplikasi `/privacy` mengarah ke sini.

## 1. Gambaran Umum

DevHub ("Layanan", "kami") menyediakan alat manajemen proyek untuk proyek pemrograman. Kebijakan Privasi ini menjelaskan data apa yang kami kumpulkan, mengapa kami mengumpulkannya, bagaimana data digunakan, dan hak apa yang Anda miliki atas data tersebut.

Layanan ini dioperasikan oleh pemilik proyek DevHub ("Operator"), berdomisili di Indonesia. Filosofi kami adalah **pengumpulan data minimal dan kepemilikan data maksimal oleh pengguna**.

## 2. Data yang Kami Kumpulkan

### 2.1 Data akun (wajib untuk menggunakan Layanan)

| Data | Tujuan | Dasar hukum |
|---|---|---|
| Alamat email | Identifikasi akun, login, komunikasi pemulihan akun di masa depan | Pelaksanaan kontrak / kepentingan sah |
| Kata sandi (di-hash) | Autentikasi; tidak pernah disimpan plaintext | Pelaksanaan kontrak / keamanan |
| Nama tampilan, bio, avatar (opsional) | Personalisasi profil | Persetujuan (Anda yang memberikan) |
| Tautan login sosial (akun Google/GitHub, email terverifikasi) | Login sosial, hanya bila Anda memilihnya | Persetujuan / pelaksanaan kontrak |

### 2.2 Data proyek (Anda yang memberikan)

Seluruh konten yang Anda buat di dalam Layanan: proyek, task, issue, test case, entri tech stack, definisi skema, decision, milestone, statistik, dan catatan apa pun yang Anda masukkan. Data ini milik Anda dan disimpan untuk menyediakan Layanan kepada Anda.

### 2.3 Data billing (Pakasir)

Pembayaran diproses oleh **Pakasir** (prosesor pembayaran QRIS/virtual-account). Yang kami simpan, per pembelian workspace:

- **Catatan order:** ID order, nominal (IDR), status pembayaran (`pending`/`completed`/`cancelled`), nama paket, durasi, dan timestamp. Harga dan durasi yang tampil saat checkout bersifat final untuk order tersebut.
- **Log verifikasi pembayaran:** hasil verifikasi tiap order, tanpa data sensitif (token login, cookie, dan API key tidak pernah disimpan).
- **Paket Anda:** paket aktif dan tanggal berakhir. Perpanjangan bersifat manual — setiap pembayaran berhasil memperpanjang masa berlaku dari yang lebih akhir antara masa berlaku lama atau waktu pembayaran, sehingga bayar lebih awal tidak membuang hari.

Yang secara eksplisit **tidak kami simpan**: nomor virtual-account, payload/QR image, nomor kartu, atau kredensial instrumen pembayaran apa pun. Itu hanya tampil di halaman pembayaran Pakasir (`app.pakasir.com`) dan tidak pernah menyentuh sistem kami. Batalkan order pending kapan saja dari halaman Billing.

Harga dapat berubah dari waktu ke waktu; nominal yang ditagihkan adalah nominal yang tampil dan tercatat saat checkout. Paket yang dipensiunkan tetap berfungsi hingga tanggal berakhirnya tetapi tidak dapat dibeli lagi.

### 2.4 Data teknis (otomatis)

| Data | Tujuan |
|---|---|
| Alamat IP (di log server) | Keamanan, pencegahan penyalahgunaan |
| Info request dasar (halaman dikunjungi, berhasil/gagal, waktu muat) | Operasional, debugging, performa |
| Cookie sesi | Menjaga Anda tetap login |

### 2.5 Yang TIDAK kami kumpulkan secara default

- Tanpa cookie iklan, tracking pixel, fingerprinting, atau profiling perilaku.
- Data Anda tidak dijual atau disewakan kepada siapa pun.
- Cookie Google Analytics (`_ga` / `_ga_XXXX`) bersifat **non-necessary** dan hanya disetelah persetujuan Anda via footer **Pengaturan Cookie** (lihat §4).

### 2.6 Integrasi proyek (opsional, dikonfigurasi oleh Anda)

Integrasi proyek mati secara default dan hanya berjalan setelah owner/admin menghubungkannya di Project settings → Integrations.

- **Sinkron Google Calendar.** Saat terhubung, task bertanggal awal/tenggat menjadi event sehari penuh di kalender sekunder bernama “DevHub - \<project\>” di akun Google Anda; suntingan dan penghapusan tersinkron otomatis. Yang diterima Google per task tersinkron: judul, tanggal, deskripsi, prioritas, label, status, dan tautan kembali ke task. DevHub meminta scope least-privilege `calendar.app.created`: hanya dapat membuat dan mengelola kalender serta event buatannya — tidak dapat membaca kalender Anda yang lain. Token koneksi disimpan terenkripsi dan diperbarui otomatis. Putuskan di Project settings (atau cabut via izin akun Google) untuk menghentikan sinkronisasi; event yang sudah dibuat tetap ada di kalender Anda. Penanganan data di sisi Google mengikuti [kebijakan API Google](https://developers.google.com/terms/api-services-user-data-policy).
- **GitHub App.** Saat terhubung, GitHub App mengirim event webhook (push, pull request, review, check) untuk repositori tertaut; DevHub menempelkan tautan (repo, referensi PR/commit/branch, judul, status, state CI/review) ke task yang cocok dan memposting komentar linkback saat PR pertama kali menautkan task. Akses memakai token instalasi berumur pendek (~1 jam, diperbarui saat dipakai) — kata sandi GitHub Anda tidak pernah disimpan. Memutuskan koneksi menghapus pemetaan repo; tautan task dipertahankan sebagai riwayat. Uninstall App di GitHub juga menghentikan pengiriman. Penanganan data di sisi GitHub mengikuti [kebijakan GitHub](https://docs.github.com/en/site-policy/privacy-policies/github-privacy-statement).

## 3. Cara Data Digunakan

- Untuk mengoperasikan, mengamankan, dan meningkatkan Layanan.
- Untuk memproses langganan workspace (membuat order pending, mengonfirmasi ke Pakasir, mengaktifkan paket, menyimpan log verifikasi).
- Untuk merespons penyalahgunaan atau proses hukum (terbatas, lihat §7).
- Kami **tidak** menggunakan data proyek Anda untuk melatih model AI, dan tidak membagikannya ke penyedia AI. Integrasi MCP opsional hanya terhubung bila Anda mengonfigurasinya, memakai otorisasi milik Anda sendiri.

## 4. Cookie & Sesi

| Cookie | Kategori | Tujuan | Durasi |
|---|---|---|---|
| `devhub_session` | Necessary | Menjaga Anda tetap login (aman, HttpOnly) | 24 jam, diperbarui saat login |
| `devhub_oauth_state_<provider>` | Necessary | Pembantu login sosial Google/GitHub berumur pendek | 10 menit |
| `_ga`, `_ga_XXXX` | Non-necessary (analitik, Google) | Hanya disetelah persetujuan | Hingga 2 tahun |

Kami memakai satu cookie login necessary plus pembantu login sosial berumur pendek. Cookie analitik bersifat opt-in. Anda boleh memblokir cookie, tetapi tidak akan bisa login. Untuk mencabut persetujuan cookie non-necessary, buka footer **Pengaturan Cookie** dan matikan analitik — cookie `_ga` yang sudah ada berhenti dipakai dan kedaluwarsa sendiri; Anda juga bisa menghapusnya di browser.

## 5. Penyimpanan Data & Transfer Internasional

- Layanan berjalan di infrastruktur cloud terkelola (database, hosting aplikasi, dan CDN). Tergantung region penyedia, data Anda dapat disimpan atau diproses **di luar Indonesia** untuk hosting, backup, dan content delivery.
- Kata sandi disimpan ter-hash (tidak pernah plaintext); koneksi dienkripsi dengan HTTPS.
- Meski kami mengambil langkah teknis dan organisasional yang wajar, **tidak ada transmisi atau penyimpanan yang 100% aman**; Layanan ini dioperasikan tim kecil, bukan perusahaan besar.

## 6. Retensi & Penghapusan Data

| Data | Retensi |
|---|---|
| Data akun + proyek | Hingga Anda menghapus akun atau meminta penghapusan |
| Catatan billing | Disimpan sebagai catatan keuangan/operasional selama akun ada dan sebagaimana diwajibkan hukum Indonesia; dianonimkan atau dihapus atas permintaan penghapusan akun terverifikasi sejauh diizinkan hukum |
| Log server | 14 hari, lalu dihapus otomatis |
| Token & pemetaan integrasi | Dihapus saat disconnect (riwayat event/tautan seperti dijelaskan di §2.6) |
| Backup | Retensi bergulir (salinan lama digantikan sesuai jadwal) |

**Hak Anda (ditangani dalam 3×24 jam untuk verifikasi + konfirmasi tindakan):**
- **Akses/ekspor:** ekspor proyek apa pun sebagai JSON kapan saja (Project → Export); minta salinan data akun via email.
- **Koreksi:** perbaiki data profil di aplikasi (Profile) atau minta koreksi via email.
- **Penghapusan:** hapus proyek kapan saja. Penghapusan akun penuh: minta via `privacy@devhub.nrawangbatin.my.id`; kami akan menghapus akun dan seluruh data terkait dalam 30 hari, termasuk dari backup pada siklus retensi berikutnya sejauh layak secara teknis.
- **Cabut persetujuan:** cabut persetujuan analitik via footer **Pengaturan Cookie**; cabut akses aplikasi sosial/OAuth via Profile → Authorized Apps; cabut token akses agen untuk menghentikan akses agen AI segera.

Setelah langganan kedaluwarsa, workspace kembali ke limit Free. Selama **7 hari setelah kedaluwarsa (masa tenggang)** konten over-kuota tetap dapat diakses **read-only** (tidak bisa menambah proyek/member melebihi kuota Free); perpanjangan menumpuk dari yang lebih akhir antara sekarang atau masa berlaku lama, sehingga Anda tidak kehilangan hari berbayar. Pindah ke paket lebih kecil berlaku saat kedaluwarsa; upgrade dan perpanjangan paket yang sama berlaku instan.

## 7. Pengungkapan Hukum

Kami hanya mengungkapkan data ke pihak ketiga bila diwajibkan hukum atau permintaan hukum yang mengikat menurut hukum Indonesia, dan akan memberi tahu Anda sejauh diizinkan hukum. Konfirmasi pembayaran dengan Pakasir (`app.pakasir.com`) hanya mencakup ID order dan nominal — tidak pernah konten proyek Anda. Integrasi proyek (§2.6) hanya mengirim metadata task/repo yang dijelaskan di sana ke Google/GitHub — tidak pernah kata sandi atau konten proyek yang tidak terkait.

## 8. Anak-anak

Layanan ini tidak ditujukan untuk anak di bawah 16 tahun. Jika Anda yakin seorang anak memberikan data, hubungi kami dan kami akan menghapusnya.

## 9. Kontak & Keluhan

- Dukungan umum dan billing: **support@devhub.nrawangbatin.my.id**
- Pertanyaan perlindungan data / privasi: **privacy@devhub.nrawangbatin.my.id**
- Target respons: verifikasi dan konfirmasi tindakan dalam **3×24 jam** pada hari kerja.
- Hukum yang berlaku adalah hukum **Indonesia**. Jika Anda berdomisili di EU/EEA, Anda juga dapat mengajukan keluhan ke otoritas pengawas setempat; kami akan kooperatif dalam proses apa pun.

## 10. Perubahan Kebijakan Ini

Kami dapat memperbarui kebijakan ini; tanggal "Last updated" dan "Version" di atas selalu mencerminkan versi berjalan. Perubahan material akan diumumkan di layanan. Penggunaan berkelanjutan setelah perubahan berarti penerimaan.

*Akhir Kebijakan Privasi.*
