# Agent Rules

## Mulai Sesi

Setiap sesi dimulai, baca konteks proyek sebelum kerja utama:
1. `docs/01-project/` — pemahaman proyek
2. `docs/02-architecture/` — arsitektur & design decisions
3. `docs/03-engineering/` — standar engineering
4. `docs/05-operations/` — operasional
5. `docs/06-compliance/` — kepatuhan
6. File audit di root `docs/` (`04-audit-*.md`)

Jika folder tidak ditemukan, skip dan lanjutkan kerja utama.

## Skill

Cek direktori skill proyek (mis. `.opencode/skills/`, `skills/`) di awal sesi.
Bila tugas cocok dengan deskripsi sebuah skill, muat dan ikuti skill itu —
jangan mengandalkan ingatan pola dari sesi lain.

## Kepatuhan Token & Guard

- Sumber tunggal nilai visual = dokumen token proyek (mis. `design-tokens.md`).
- Standar/atribut baru wajib disertai guard otomatis di PR yang sama;
  tanpa guard = temuan review.
- Pola/ritme/urutan baru langsung dicatat ke dokumen token di PR yang sama.

## Verifikasi Visual & Anti-Berdalih

Aturan ini berlaku untuk semua pekerjaan UI di proyek apa pun.
Istilah generik: "dokumen token" = sumber tunggal nilai visual proyek
(mis. `design-tokens.md`); "guard" = linter/penjaga otomatis proyek;
`file:line` = referensi lokasi kode.

1. **Screenshot pengguna adalah kebenaran + klaim wajib bukti render.**
   Bila kesimpulan dari kode bertentangan dengan screenshot, screenshot
   menang — audit ulang, jangan berdalih. Kata "sama/persis/sudah" untuk UI
   hanya sah dengan render + screenshot pasangan sebanding (skenario SAMA
   × locale SAMA) yang disandingkan dengan acuan. Hasil `tsc`/`build`/
   guard bukan bukti visual.
2. **Copy-diff sel-per-sel, tanpa kata setara tanpa angka.** Setiap node
   teks acuan wajib disandingkan dengan string implementasi: nilai kedua
   sisi + `file:line` sumbernya. Struktur sama tanpa copy-diff, atau klaim
   "identik/konsisten/sama" tanpa nilai terukur kedua sisi, = belum
   terverifikasi.
3. **Periksa rantai render penuh, bukan kelas elemen saja.** Setiap klaim
   visual wajib menelusuri: kelas/gaya elemen + SEMUA pembungkus ke atas
   sampai kontainer halaman (mekanisme layout yang dipakai, collapse vs
   gap, padding kontainer, breakpoint/media query yang aktif).
4. **Dilarang asumsi kode lama benar.** Setiap key i18n / token / class yang
   dipakai ulang wajib dibaca nilainya di situs definisi dan dikutip
   (`file:line` + nilai aktual).
5. **Pasangan tak sebanding wajib ditolak.** Beda skenario atau beda locale
   tidak boleh dibandingkan. Nyatakan eksplisit perbandingannya tidak valid
   dan tunjukkan pasangan yang valid sebelum analisis.
6. **Pola yang dipakai ulang wajib cek berdampingan.** Setiap reuse pola
   (header, tampilan baca, toggle, kartu) harus dibandingkan render
   semua pemakainya; bila belum dicek, nyatakan terbuka sebagai utang.
7. **Akui dulu, jelaskan kemudian.** Saat bukti pengguna bertentangan dengan
   klaim agen, kalimat pertama wajib: benar/salah + bukti. Dilarang uraian
   penjelasan sebelum pengakuan; dilarang spekulasi tanpa bukti
   ("mungkin beda zoom/resolusi"). Kegagalan audit = data, bukan aib —
   tapi kegagalan yang sama dua kali = pelanggaran.
8. **Matriks verifikasi sebelum tutup.** Todo visual hanya boleh `completed`
   dengan matriks tercentang: skenario × locale (+ desktop/mobile bila acuan
   punya keduanya). Sel kosong = tulis sebagai utang eksplisit.
9. **Laporan salah menyebut yang dilewati.** Setiap pengakuan salah wajib
   menyebut file/rentang pemeriksaan yang dilompati, bukan sekadar
   "kurang teliti".
10. **Standar lahir tertulis atau tidak lahir.** Pola/ritme/urutan baru
    langsung dicatat ke dokumen token di PR yang sama — "nanti" = tidak
    pernah.
11. **Mode cepat wajib lapor utang.** Bila pengguna minta "tanpa tes/build",
    akhiri dengan daftar eksplisit apa yang belum diverifikasi
    (lint/tipe/tes/visual) + risiko terbesarnya. Jangan biarkan
    "cepat" dibaca sebagai "aman".
