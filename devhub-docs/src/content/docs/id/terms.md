---
title: Syarat Layanan
description: Aturan penggunaan DevHub — akun, penggunaan wajar, paket, billing, refund. Dokumen kanonis versi 2026-09-23-v4, berlaku 2026-08-13.
---

> **Dokumen legal kanonis — versi `2026-09-23-v4`, terakhir diperbarui 2026-09-23, berlaku 2026-08-13.**
> Halaman ini adalah satu-satunya sumber kebenaran. Terjemahan bahasa Indonesia dari [Terms of Service](/terms/) — jika ada perbedaan, versi Inggris yang berlaku.
> Rute aplikasi `/terms` mengarah ke sini.

## 1. Perjanjian

Syarat Layanan ("Syarat") ini mengatur penggunaan DevHub ("Layanan") oleh Anda. Dengan mendaftar akun atau menggunakan Layanan, Anda menyetujui Syarat ini. Jika tidak setuju, jangan gunakan Layanan.

Layanan ini dioperasikan oleh pemilik proyek DevHub ("Operator"), berdomisili di Indonesia.

## 2. Layanan

DevHub adalah aplikasi web untuk mengelola proyek pemrograman: task, issue, test case, tech stack, skema, decision, rilis, dan statistik. Layanan disediakan untuk penggunaan personal dan tim kecil.

Kami dapat mengubah, menangguhkan, atau menghentikan bagian mana pun dari Layanan (termasuk fitur atau seluruh Layanan) kapan saja. Paket workspace berbayar dijelaskan di §5; harga ditampilkan sebelum Anda membayar.

## 3. Akun Anda

- Anda wajib memberikan alamat email yang valid dan informasi registrasi yang akurat.
- Anda bertanggung jawab menjaga kerahasiaan kredensial dan atas seluruh aktivitas di akun Anda.
- Anda harus berusia minimal 16 tahun (atau usia minimum di yurisdiksi Anda) untuk menggunakan Layanan.
- Satu orang memelihara satu akun; membuat akun untuk menghindari pembatasan dilarang.

## 4. Penggunaan Wajar

Anda setuju untuk TIDAK:

- Menggunakan Layanan untuk tujuan melawan hukum atau melanggar hukum yang berlaku.
- Mencoba mengakses akun atau data pengguna lain, atau melewati keamanan atau autentikasi.
- Mengunggah kode berbahaya, mencoba menjatuhkan Layanan, atau melakukan serangan denial-of-service.
- Melakukan scraping, mirroring, atau menjual kembali Layanan atau datanya tanpa izin tertulis.
- Menggunakan Layanan untuk menyimpan konten ilegal (mis. materi pelecehan seksual anak, distribusi malware).

Kami dapat menangguhkan atau menghentikan akun yang melanggar Syarat ini, dengan atau tanpa pemberitahuan.

## 5. Paket, Billing & Refund (Pakasir)

- **Paket:** Free (2 member / 3 proyek) dan paket workspace berbayar (mis. Pro member & proyek unlimited). Limit, durasi, dan harga ditampilkan sebelum checkout.
- **Pembayaran** diproses oleh **Pakasir** (QRIS/virtual-account). Checkout membuat order pending dan mengarahkan Anda ke halaman pembayaran Pakasir. Kami hanya menyimpan ID order, nominal, dan status plus log verifikasi; **nomor virtual-account dan payload QR tidak pernah disimpan**.
- **Aktivasi:** setiap pembayaran dikonfirmasi langsung ke Pakasir sebelum paket aktif. Konfirmasi yang gagal tidak pernah mengaktifkan paket, dan notifikasi ganda tidak pernah mengaktifkan dua kali.
- **Perpanjangan bersifat manual** — tanpa auto-charge. Setiap pembayaran berhasil memperpanjang masa berlaku dari yang lebih akhir antara masa berlaku lama atau waktu pembayaran, sehingga bayar lebih awal tidak membuang hari.
- **Batalkan order pending** kapan saja dari halaman Billing (pembayar atau admin tim). Pembayaran completed tidak bisa "dibatalkan" — lihat refund.
- **Refund:** **tidak ada refund setelah aktivasi**, kecuali (a) tagihan ganda untuk workspace/periode yang sama, atau (b) pembayaran yang tidak pernah aktif dalam **24 jam** meski tagihan completed. Klaim ke **support@devhub.nrawangbatin.my.id** dengan ID order Anda; duplikat/kegagalan terverifikasi di-refund atau dikredit. Penyalahgunaan chargeback dapat berujung penangguhan.
- **Kedaluwarsa & tenggang:** saat kedaluwarsa workspace kembali ke limit Free. Selama **7 hari setelah kedaluwarsa** konten over-kuota tetap **read-only** (data lama tetap terlihat; menambah proyek/member melebihi kuota Free dijeda). Perpanjang kapan saja tanpa kehilangan hari berbayar. Pindah ke paket lebih kecil berlaku saat kedaluwarsa; upgrade dan perpanjangan paket yang sama berlaku instan. Paket yang dipensiunkan tetap berfungsi hingga tanggal berakhirnya tetapi tidak dapat dibeli lagi.
- **Sengketa tagihan:** hubungi support terlebih dahulu; kami merespons dalam 3×24 jam pada hari kerja.

## 6. Data Anda

- **Anda pemilik** data proyek yang Anda buat. Kami tidak mengklaim kepemilikan.
- Anda memberi kami lisensi terbatas untuk menyimpan, memproses, dan menampilkan data Anda semata-mata untuk mengoperasikan Layanan bagi Anda, termasuk hosting di luar Indonesia sebagaimana dijelaskan di Kebijakan Privasi.
- Anda bertanggung jawab atas konten yang Anda simpan dan memastikan Anda berhak menyimpannya.
- Layanan ini **bukan backup yang dijamin**. Anda bertanggung jawab mencadangkan data penting (Layanan menyediakan ekspor JSON untuk ini).

## 7. Kekayaan Intelektual

Layanan itu sendiri (perangkat lunak, desain, dokumentasi, branding) adalah milik Operator dan dilindungi hukum kekayaan intelektual yang berlaku. Anda tidak boleh menyalin, memodifikasi, atau me-reverse-engineer Layanan melebihi yang diizinkan hukum, kecuali kode dasarnya dirilis di bawah lisensi open-source (lihat §11).

## 8. Integrasi Pihak Ketiga

Layanan dapat terintegrasi dengan layanan pihak ketiga hanya bila **Anda** mengonfigurasinya:

- **Agen coding AI** (via MCP) dengan otorisasi **milik Anda**, dapat dicabut via Profile → Authorized Apps. Anda bertanggung jawab atas apa yang Anda bagikan melaluinya.
- **Pakasir** untuk pembayaran (§5) dan **Google/GitHub** untuk login sosial opsional. Syarat dan kebijakan privasi mereka berlaku untuk halaman/layanan mereka.
- **Sinkron Google Calendar** (opsional, per proyek): menyinkronkan judul, tanggal, deskripsi, dan status task ke kalender buatan DevHub di akun Google Anda dalam scope least-privilege `calendar.app.created`. Putuskan kapan saja di Project settings; syarat dan kebijakan privasi Google berlaku untuk sisi mereka.
- **GitHub App** (opsional, per proyek): membaca metadata PR/commit/check/review di repo tertaut dan memposting komentar linkback saat PR pertama kali menautkan task; tautan task dipertahankan sebagai riwayat setelah disconnect. Syarat dan pernyataan privasi GitHub berlaku untuk sisi mereka.

## 9. Penafian Garansi

LAYANAN DISEDIAKAN "SEBAGAIMANA ADANYA" DAN "SEBAGAIMANA TERSEDIA", TANPA GARANSI APA PUN, TERSURAT MAUPUN TERSIRAT, TERMASUK GARANSI TERSIRAT KELAYAKAN JUAL, KESESUAIAN UNTUK TUJUAN TERTENTU, DAN NON-PELANGGARAN. KAMI TIDAK MENJAMIN LAYANAN AKAN TANPA GANGGUAN, BEBAS ERROR, ATAU AMAN.

## 10. Batasan Tanggung Jawab

SEJAUH DIIZINKAN HUKUM, OPERATOR TIDAK BERTANGGUNG JAWAB ATAS KERUGIAN TIDAK LANGSUNG, INSIDENTAL, KHUSUS, KONSEKUENSIAL, ATAU PUNITIF, MAUPUN ATAS KEHILANGAN DATA, KEUNTUNGAN, ATAU PENDAPATAN, YANG TIMBUL DARI PENGGUNAAN LAYANAN OLEH ANDA, MESKI TELAH DIBERITAHU KEMUNGKINANNYA. TOTAL TANGGUNG JAWAB OPERATOR UNTUK SELURUH KLAIM TERKAIT LAYANAN TIDAK MELEBIHI JUMLAH YANG ANDA BAYAR UNTUK LAYANAN DALAM 12 BULAN SEBELUM KLAIM, ATAU USD 10 JIKA ANDA TIDAK MEMBAYAR APA PUN.

## 11. Pengakhiran

- Anda dapat berhenti menggunakan Layanan kapan saja dan menghapus akun (lihat Kebijakan Privasi §6; permintaan privasi ke **privacy@devhub.nrawangbatin.my.id**).
- Kami dapat menangguhkan atau mengakhiri akses Anda atas pelanggaran Syarat ini atau alasan keamanan.
- Saat pengakhiran, data Anda ditangani sesuai Kebijakan Privasi (penghapusan atas permintaan; backup mengikuti siklus retensi). Akses berbayar aktif berjalan hingga tanggal berakhirnya kecuali di-refund menurut §5.

## 12. Open Source & Lisensi

Kode sumber Layanan dapat dirilis di bawah lisensi open-source. Jika dan ketika itu terjadi, lisensi mengatur penggunaan *kode* oleh Anda; Syarat ini tetap mengatur penggunaan *Layanan hosted* oleh Anda.

## 13. Hukum yang Berlaku & Sengketa

Syarat ini diatur oleh hukum **Indonesia**, tanpa memperhatikan aturan konflik hukum. Sengketa pertama-tama diupayakan diselesaikan secara musyawarah melalui **support@devhub.nrawangbatin.my.id** (respons dalam 3×24 jam pada hari kerja). Bila tindakan hukum tak terhindarkan, **Pengadilan Negeri** yang berwenang di Indonesia yang berjurisdiksi.

## 14. Perubahan Syarat Ini

Kami dapat memperbarui Syarat ini; tanggal "Last updated" dan "Version" mencerminkan versi berjalan. Perubahan material akan diumumkan. Penggunaan berkelanjutan setelah perubahan berarti penerimaan atas Syarat baru.

## 15. Kontak

- Pertanyaan umum dan billing: **support@devhub.nrawangbatin.my.id**
- Pertanyaan privasi: **privacy@devhub.nrawangbatin.my.id**

*Akhir Syarat Layanan.*
