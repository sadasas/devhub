#!/usr/bin/env bash
# DevHub prune retensi: Daily x14 / weekly x8 / monthly x12.
# Aturan per file devhub_YYYY-MM-DD.dump di BACKUP_DIR (offsite):
#   - umur <= 14 hari            -> KEEP (daily)
#   - tanggal 01 + umur <= 365h  -> KEEP (monthly x12)
#   - hari Minggu + umur <= 56h  -> KEEP (weekly x8)
#   - selain itu                 -> DELETE
# Env:
#   BACKUP_DIR   (wajib) — direktori offsite yang sama dengan backup.sh
#   DRY_RUN=1    — hanya list, tidak hapus
#   NTFY_SERVER / NTFY_TOPIC — opsional, untuk alert bila prune error fatal
# Contoh:
#   BACKUP_DIR=/mnt/offsite/devhub ./ops/prune-backups.sh
#   BACKUP_DIR=/mnt/offsite/devhub DRY_RUN=1 ./ops/prune-backups.sh
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-}"
DRY_RUN="${DRY_RUN:-0}"
NTFY_SERVER="${NTFY_SERVER:-https://ntfy.sh}"
NTFY_TOPIC="${NTFY_TOPIC:-devhub-alerts}"
KEEP_DAILY=14
KEEP_WEEKLY_DAYS=56
KEEP_MONTHLY_DAYS=365

log() { printf '%s [prune] %s\n' "$(date -u +%FT%TZ)" "$*"; }

[ -n "$BACKUP_DIR" ] || { log "ERROR: BACKUP_DIR kosong"; exit 2; }
[ -d "$BACKUP_DIR" ] || { log "ERROR: BACKUP_DIR bukan direktori: ${BACKUP_DIR}"; exit 2; }
command -v date >/dev/null || { log "ERROR: date tidak ditemukan"; exit 2; }

NOW="$(date -u +%s)"
kept=0
deleted=0

while IFS= read -r -d '' f; do
  base="$(basename "$f" .dump)"
  datestr="${base#devhub_}"
  if ! [[ "$datestr" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}$ ]]; then
    log "SKIP (nama tak dikenal): $f"
    continue
  fi
  epoch="$(date -u -d "$datestr" +%s 2>/dev/null || echo "")"
  if [ -z "$epoch" ]; then
    log "SKIP (tanggal invalid): $f"
    continue
  fi
  age_days=$(( (NOW - epoch) / 86400 ))
  # File masa depan (jam skew) dianggap daily -> keep
  if [ "$age_days" -lt 0 ]; then age_days=0; fi
  dow="$(date -u -d "$datestr" +%u)"
  dom="$(date -u -d "$datestr" +%d)"
  keep_reason=""
  if [ "$age_days" -le "$KEEP_DAILY" ]; then
    keep_reason="daily(${age_days}h<=${KEEP_DAILY})"
  elif [ "$dom" = "01" ] && [ "$age_days" -le "$KEEP_MONTHLY_DAYS" ]; then
    keep_reason="monthly(01,${age_days}h<=${KEEP_MONTHLY_DAYS})"
  elif [ "$dow" = "7" ] && [ "$age_days" -le "$KEEP_WEEKLY_DAYS" ]; then
    keep_reason="weekly(Sun,${age_days}h<=${KEEP_WEEKLY_DAYS})"
  fi
  if [ -n "$keep_reason" ]; then
    log "KEEP ${keep_reason}: $(basename "$f")"
    kept=$((kept + 1))
  else
    if [ "$DRY_RUN" = "1" ]; then
      log "WOULD-DELETE (umur ${age_days}h): $(basename "$f")"
    else
      log "DELETE (umur ${age_days}h): $(basename "$f")"
      rm -f "$f"
    fi
    deleted=$((deleted + 1))
  fi
done < <(find "$BACKUP_DIR" -maxdepth 1 -name 'devhub_*.dump' -print0)

log "selesai: kept=${kept} deleted=${deleted} dry_run=${DRY_RUN}"
