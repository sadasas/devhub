## v0.29.1 - 29 Aug - Timeline Fix

Release ini fokus ke **stabilitas** dan _kebersihan_ UI. Gunakan `` `code` `` untuk `taskDueChip`.

### Added
- Timeline thick `8px` + dot `28px` bulat
- Date di kiri `February 02` stacked
- Klik decision di Konteks Teknis langsung buka modal

### Fixed
1. Dot oval jadi bulat 50%
2. Duplikat date di card dihapus
3. Badge `releases.taskStatus.done` tampil `Done`

> Note: breaking change untuk `Decision.milestoneId` — data lama `null` fallback empty, tidak butuh migrasi.

### Docs
Lihat [Dribbble Timeline](https://dribbble.com/shots/19318766-Tailwind-css-Timeline) untuk referensi.

```ts
// contoh migrasi
const linked = decisions.filter(d => d.milestoneId === milestone.id)
```

Link jahat harus jadi teks plain: [evil](javascript:alert(1))
