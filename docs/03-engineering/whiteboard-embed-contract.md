# Kontrak Agen: kind `embed` (SVG AI di Whiteboard)

| Field | Value |
|---|---|
| **Status** | Active (eksperimen) |
| **Untuk** | Agen MCP eksternal yang membuat wireframe via `patch_whiteboard` / `create_whiteboard` |

## 1. Format elemen

```json
{ "kind": "embed", "x": 0, "y": 0, "w": 360, "h": 520,
  "title": "Login form",
  "svg": "<rect .../><text .../>..." }
```

- `w/h`: 20..2000. Koordinat `x/y` posisi di kanvas; isi SVG berkoordinat
  lokal `0..w` / `0..h` (renderer membungkus dengan viewport pas).
- `title` wajib bermakna (tampil di panel Layers + fallback + export).
- Panjang `svg` tak dibatasi, tapi **max 20 embed per board**
  (`LIMITS.WHITEBOARD_EMBEDS_PER_BOARD`) — pecah wireframe besar ke
  beberapa embed / board.

## 2. Kontrak grouping (wajib untuk wireframe multi-widget)

Bungkus tiap widget dalam `<g data-component="nama">`:

```svg
<g data-component="card">...</g>
<g data-component="input-email">...</g>
<g data-component="submit">...</g>
```

Atribut `data-*` dipertahankan sanitizer. Grup dipakai `splitSvgComponents`
untuk pecah/edit per komponen dan `reverseCompileComponent` untuk
compile-balik ke elemen natif (rect/circle/ellipse/line/text).

## 3. Sanitizer (allowlist, tanpa kecuali)

Kirim fragment (tanpa outer `<svg>`; outer tunggal di-unwrap otomatis).
Hanya tag ini yang lolos: `g rect circle ellipse line polyline polygon path
text tspan defs linearGradient radialGradient stop clipPath` (+ nested `svg`).

**Pasti dibuang**: `script style foreignObject image use a animate* set
iframe embed object video audio`, atribut `on*`, `href`/`xlink:href`,
`style` inline, nilai `javascript:`, `url(...)` selain `url(#lokal)`.
Komentar/DOCTYPE juga dibuang.

Hard-fail (tidak disimpan) bila tak ada konten renderable tersisa —
respons tool menyebut elemen + alasan; perbaiki dan kirim ulang.

**Namespacing id**: atribut `id` dan referensi `url(#id)` ditulis ulang
per elemen (`e<8hex>-...`) saat tulis + render — dua embed ber-id internal
sama tidak saling memangsa. Idempoten (save berulang tidak menumpuk).

## 4. Aturan layout

- `embed` **bebas validator showcase** (orphan/spacing/containment tidak
  berlaku). Yang berlaku: koordinat finite ±100.000.
- `validate_whiteboard` hanya cek finite/out-of-bounds untuk embed —
  gunakan untuk cek tabrakan manual bila perlu.
- Loop kerja: `list_whiteboards` → `patch_whiteboard` → `validate_whiteboard`
  → perbaiki dari diagnostics → verifikasi baca ulang.

## 6. Aturan hidup di momen kerja (bukan cuma di dokumen ini)
Agar user/agen lain otomatis tahu kontrak grouping:

- `validate_whiteboard`: embed tanpa grup muncul sebagai warning `grouping`
  (advisory — tidak memblokir create/update).
- Respons `create/patch/update_whiteboard`: field `groupingHints` bila ada
  embed tanpa grup.
- Editor: klik kanan 1 embed tanpa grup → item menu nonaktif berisi tips
  (`whiteboard.ctx.embedGroupingHint`, EN+ID).

## 5. Golden sample (login form, 360x520)

Lihat `app/src/features/whiteboard/svg-components.test.ts`
(`LOGIN_FORM_SVG`): card + header + input-email + submit, 4 grup,
seluruhnya reverse-compile ke elemen natif. Tiru pola ini
(rect ber-`rx` untuk kartu/input, `text` untuk label, satu `rect` biru
untuk tombol primer).
