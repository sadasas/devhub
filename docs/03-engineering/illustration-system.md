# Illustration System — DevHub

| Field | Value |
|---|---|
| **Document status** | Active |
| **Owner** | Project Owner |
| **Last updated** | 2026-10-01 |
| **Applies to** | `app/src/components/DoodleIllustration.tsx` dan komponen ilustrasi apa pun yang dibuat kemudian |
| **Related documents** | [Design Tokens](design-tokens.md#8-color-palette) · `EmptyState.tsx` · `tourSteps.ts` |

> Sistem ilustrasi adalah sumber tunggal kebenaran gaya gambar di dalam
> produk. Gaya di luar dokumen ini = **temuan review**, sama seperti token
> visual di luar `design-tokens.md`. Aturan main: ilustrasi mendukung copy,
> bukan tempelan dekorasi.

---

## 1. Istilah

| Istilah | Arti | Contoh |
|---|---|---|
| `spot illustration` / `spot` | Gambar kecil mandiri untuk **satu konsep tunggal** di dalam app | empty/error/success states |
| `tour spot` | Spot per **topik onboarding** (bukan per state) | `tour-team`, `tour-plan` |
| Bukan ilustrasi produk | Hero (landing), collage (marketing), ikon 16–22px | Tidak diatur di sini |

Keputusan industri yang diadopsi: nada mengikuti konteks (playful untuk
onboarding, tenang untuk cleared, empatik untuk error); visual di produk
tidak boleh murni dekoratif (cf. Atlassian in-product illustration).

---

## 2. Kontrak visual (wajib)

1. **Adegan objek, tanpa wajah.** Dilarang: mata, mulut, blush, anggota
   badan kartun. Status/topik dibaca dari **objek** (kotak, steker, gembok,
   magnifier, neraca), bukan emosi karakter.
2. **Bahasa tangan, bukan geometri sempurna.** Garis goyang (`Q`/`C`,
   bukan `L` lurus), `stroke-linecap/linejoin: round`, sudut overshoot,
   komposisi asimetris miring 2–4°, blob latar organik (elips/path, bukan
   `rect` sempurna).
3. **Satu spot = satu adegan ≥3 elemen**: blob latar + objek utama + ≥2
   aksen kecil (sparkle `+`, selotip sudut, scribble, garis putus).
   Spot 1 elemen akan dibaca sebagai ikon besar — tolak.
4. **Lebar stroke 1.2–2.4** (CR): ~1.6 untuk render 140px, ~2 untuk render
   ≤64px agar terbaca kecil. Ground shadow `ellipse opacity 0.08` tunggal.
5. **Tanpa animasi** (lolos `prefers-reduced-motion` by default),
   **tanpa teks** di dalam SVG (copy milik i18n, bukan gambar).
6. Kanvas `viewBox 0 0 160 160`; scaling via prop `size` (basis 160).

---

## 3. Palet

| Peran | Nilai | Catatan |
|---|---|---|
| Tinta | `#1c1c1f` | Garis utama |
| Kertas | `#fff` | Objek utama; **karya tetap, tidak ikut tema** (§8) |
| Aksen netral/sukses | `var(--accent)` | Sage produk; theme-aware |
| Aksen makna | `var(--status-danger/warn/info)` | Retak, warning, konektor |
| Tint blob | `var(--card-*-soft)` / `var(--bg-inset)` via prop `tone` | Lihat tabel tone |
| Dilarang | `#e8a0a0` blush + hex di luar file | Test menegaskan ketidakhadiran blush |

| Tone | Pakai untuk |
|---|---|
| `neutral` | kosong umum (`empty`), onboarding netral |
| `soft-blue` | pencarian/hasil (`not-found`) |
| `soft-cream` | error/akses (`offline`, `locked`, `broken`) |
| `soft-mint` | cadangan hangat (belum dipakai) |

Hex ilustrasi hidup di `HEX_FILE_ALLOWLIST`
(`app/scripts/guard-css-classes.mjs`) — file `DoodleIllustration.tsx`
dikecualikan sebagai karya brand. **Jangan tambah hex di file lain.**

---

## 4. Taksonomi varian

| Prefix | Arti | Daftar |
|---|---|---|
| Tanpa prefix = **state** | Kondisi sistem/data | `empty`, `offline`, `not-found`, `locked`, `broken`, `success`, `receipt`, `calendar`, `bug`, `checklist`, `layers`, `scales`, `flag`, `nodes`, `layout`, `idcard`, `envelope`, `bubble`, `key`, `chart`, `canvas`, `camera`, `table`, `clock`, `box`, `memory`, `pending`, `paid`, `cancelled` |
| `tour-` = **topik** | Langkah onboarding | `tour-welcome`, `tour-team`, `tour-project`, `tour-plan`, `tour-issues`, `tour-tests`, `tour-build`, `tour-schema`, `tour-decide`, `tour-releases`, `tour-api`, `tour-collab`, `tour-overview` |

### 4a. Kapan pakai varian state

| Kondisi (`classifyError` / event) | Doodle | Lokasi mapping |
|---|---|---|
| First-use kosong, filter kosong tanpa query, generik | `empty` + `neutral` | Prop `doodle` per `EmptyState` |
| `offline` (status 0), `rateLimited` (429) | `offline` + `soft-cream` | `doodleByKind` di `DataErrorState.tsx` |
| `server` (5xx), gagal-load versi | `broken` + `soft-cream` | `DataErrorState` / `ERDCanvasPanel` |
| `notFound` (404), search tanpa hasil (ada query) | `not-found` + `soft-blue` | `DataErrorState` / halaman notFound |
| `forbidden` (401/403), `business` (PLAN_LIMIT), no-access | `locked` + `soft-cream` | `DataErrorState` / settings-no-access |
| Momen selebrasi nyata | `success` | Hanya bila ada layar perayaan (saat ini: finish tour) |
| Area uang kosong (billing) | `receipt` + `soft-cream` | `PaymentHistoryPage` |
| Hero status detail pembayaran (pending/lunas/batal) | `pending`/`paid`/`cancelled` + `soft-cream`/`soft-mint`/`soft-cream`, size 104 | `BillingRedirectPage` (jam pasir, struk+stempel, struk sobek — keputusan owner 2026-10-05; 64→104 keputusan owner 2026-10-06 agar bobot visual menyamai ikon lingkaran wireframe) |
| Area tanggal kosong (kalender/timeline) | `calendar` + `neutral` | `DueCalendar`, `BoardTimeline` |
| Issues / tests / stack / decisions kosong | `bug` / `checklist` / `layers` / `scales` + `neutral` | `IssuesPage`, `TestsPage`, `StackPage`, `DecisionsPage` |
| Releases / API / templates kosong | `flag` / `nodes` / `layout` + `neutral` | `ReleasesListView`, `ReleasesFlowView`, `ApiPage` ×2, `ApiDocsView`, `TemplatesPage` |
| Members / invites / chat / keys kosong | `idcard` / `envelope` / `bubble` / `key` + `neutral` | `DashboardMembersTab`, `InvitesPage`, `ChatPanel`, `KeysPage` |
| Overview / whiteboard / snapshot / tabel / versi / arsip kosong | `chart` / `canvas` / `camera` / `table` / `clock` / `box` + `neutral` | `OverviewPage`, `WhiteboardList`, `SchemaPage` ×3, `ERDCanvasPanel`, `ERD`, `DashboardPage` arsip |
| Panel brand auth (4 halaman) | `AuthHeroArt` fluid + `neutral` | `AuthPage`, `ResetPasswordPage`, `VerifyEmailPage`, `CheckEmailPage` (`.auth-brand-art` max 460px, sembunyi ≤860px) |

### 4b. Kapan pakai `tour-*`

Satu varian per langkah tur, dipetakan via field `doodle` di `TourStepDef`
(`tourSteps.ts`) — data-driven, bukan rantai `if`. Ukuran render: 104–120
modal, 64 popover/strip. `tour-*` HANYA untuk tur/welcome — hero halaman
memakai varian state domain (§4a) meski motifnya mirip (`flag` vs
`tour-releases`, `nodes` vs `tour-api`, `chart` vs `tour-overview`).

### 4b1. Aturan tier anti-pincang

Hero (page-level, 140) = varian domain sesuai konsep halaman; mini/inline
(52/64) = generik `empty`/`not-found`; error dinamis = `DataErrorState`
+ `classifyError()`. Varian khusus baru hanya bila (a) slot hero,
(b) metafora tak ambigu, (c) area bernilai tinggi — jika tidak, pakai
generik agar tidak ada area yang terasa dianaktirikan.

### 4c. Ukuran render baku

| Size | Konteks |
|---|---|
| 140 | `EmptyState` (default komponen) |
| 200 | Brand hero panel auth — satu-satunya pengecualian tangga, butuh keputusan owner per kasus |
| fluid | `AuthHeroArt` — komposisi brand besar (mockup board + chip melayang), viewBox bebas, max-width CSS. Bukan spot: tanpa wajah/teks/foto, INK/PAPER/vars saja |
| 120 / 104 | Modal (finish / welcome) |
| 64 | Strip, header popover |
| 52 | Header kecil (cadangan) |

Angka di luar daftar = temuan review.

---

## 5. Kontrak komponen

```tsx
// app/src/components/DoodleIllustration.tsx
export type DoodleVariant = /* state */ | /* tour-* */;
interface Props {
  variant: DoodleVariant; // wajib ada di taksonomi §4
  tone?: DoodleTone;      // default 'neutral'
  size?: number;          // default 160; pakai tabel §4c
  style?: CSSProperties;
  'aria-hidden'?: boolean; // default true (dekoratif)
}
```

- A11y: `role="img"` + `aria-label={variant}` (untuk test + AT bila
  ditampilkan), `aria-hidden` default true karena copy disandang teks.
- `EmptyState`: prop `doodle`/`doodleTone` opsional; **`icon` wajib
  dipertahankan** sebagai fallback.
- `DataErrorState`: dilarang memilih doodle manual — selalu lewat
  `doodleByKind`/`doodleToneByKind`.
- Dilarang menambah prop visual baru (warna/ukuran bebas) tanpa ADR.

---

## 6. Anti-pola (dilarang eksplisit)

1. Wajah/mata/blush/pose kartun simetris (preseden: maskot pra-2026-10).
2. Spot 1 elemen (otomatis jadi ikon besar).
3. Doodle di konteks mikro: baris teks, teks inline (`noResults`,
   `ss-empty`), overlay sempit, kolom kanban kosong, form auth, popover
   tur selain head — konteks ini milik **ikon + teks**.
4. Teks, `foreignObject`, `image`, `use`, `animate*`, `on*`, `href`,
   `style` inline, `javascript:` di dalam SVG.
5. Varian `success` untuk kondisi netral/gagal; varian state untuk topik
   onboarding dan sebaliknya.

---

## 7. Checklist varian baru (wajib berurutan)

1. Nama ikut taksonomi §4 (`tour-<topik>` atau state yang belum ada).
2. Gambar di `DoodleIllustration.tsx` mengikuti pasal §2–§3
   (blob + objek + aksen, tanpa wajah).
3. Entri di `DoodleIllustration.test.tsx`: render + **assert tanpa blush**
   (`not.toContain('#e8a0a0')`) + skala size.
4. Mapping test bila terikat state/step (`DataErrorState`,
   `TOUR_STEPS`, atau pemakaian per halaman).
5. Screenshot before/after **light + dark, 360px + desktop**.
6. `npm run guard:css` hijau (hex baru hanya di file allowlist).
7. Satu baris decision log di `design-tokens.md`.

---

## 8. Verifikasi per PR ilustrasi

- `npx tsc --noEmit` bersih (tipe union menangkap salah ketik varian).
- `vitest` file komponen + pemakaian hijau.
- Klaim visual menyebut nilai terukur kedua sisi + `file:line`;
  screenshot menang atas kesimpulan dari kode.
