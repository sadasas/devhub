#!/usr/bin/env bash
# DevHub backup harian — pg_dump custom format ke OFFSITE (bukan disk Suga 1GB).
# Cron: 02:00 UTC setiap hari dari host eksternal (laptop/VPS/CI), BUKAN dari container Suga.
# Env yang dibutuhkan (jangan commit nilai asli):
#   DATABASE_URL  — Neon DIRECT string (bukan pooled/PgBouncer; advisory lock migrasi pecah di pooling)
#   BACKUP_DIR    — mount offsite (mis. /mnt/offsite/devhub, B2/S3 via rclone). WAJIB offsite.
# Opsional:
#   NTFY_SERVER   — default https://ntfy.sh
#   NTFY_TOPIC    — default devhub-alerts
#   PRUNE_AFTER   — "1" untuk panggil prune-backups.sh setelah sukses (default 1)
# Contoh cron (02:00 UTC):
#   0 2 * * * DATABASE_URL='postgresql://...' BACKUP_DIR=/mnt/offsite/devhub /opt/devhub/ops/backup.sh >>/var/log/devhub-backup.log 2>&1
set -euo pipefail

DATE_UTC="$(date -u +%F)"
BACKUP_DIR="${BACKUP_DIR:-}"
NTFY_SERVER="${NTFY_SERVER:-https://ntfy.sh}"
NTFY_TOPIC="${NTFY_TOPIC:-devhub-alerts}"
PRUNE_AFTER="${PRUNE_AFTER:-1}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

log() { printf '%s [backup] %s\n' "$(date -u +%FT%TZ)" "$*"; }
notify() {
  # $1 = title, $2 = message, $3 = tags (opsional, mis. warning,rotating_light)
  local title="$1" msg="$2" tags="${3:-}"
  if [ -z "${NTFY_TOPIC:-}" ]; then return 0; fi
  if [ -n "$tags" ]; then
    curl -sS --max-time 15 -H "Title: ${title}" -H "Tags: ${tags}" \
      -d "$msg" "${NTFY_SERVER}/${NTFY_TOPIC}" >/dev/null || log "WARN: ntfy notify gagal (non-fatal)"
  else
    curl -sS --max-time 15 -H "Title: ${title}" \
      -d "$msg" "${NTFY_SERVER}/${NTFY_TOPIC}" >/dev/null || log "WARN: ntfy notify gagal (non-fatal)"
  fi
}
fail() {
  local msg="$1"
  log "ERROR: ${msg}"
  notify "DevHub backup FAILED ${DATE_UTC}" "${msg} (host: $(hostname), dir: ${BACKUP_DIR:-unset})" "rotating_light"
  exit 1
}

[ -n "${DATABASE_URL:-}" ] || fail "DATABASE_URL kosong — set Neon direct string di cron env (jangan commit)."
[ -n "$BACKUP_DIR" ] || fail "BACKUP_DIR kosong — arahkan ke offsite (mis. /mnt/offsite/devhub), JANGAN ke disk Suga 1GB."
command -v pg_dump >/dev/null || fail "pg_dump tidak ditemukan di PATH."
command -v pg_restore >/dev/null || fail "pg_restore tidak ditemukan di PATH (untuk verifikasi)."
command -v curl >/dev/null || fail "curl tidak ditemukan di PATH (untuk ntfy)."

mkdir -p "$BACKUP_DIR" || fail "tidak bisa mkdir -p ${BACKUP_DIR}"

FILE="${BACKUP_DIR}/devhub_${DATE_UTC}.dump"
TMP="${FILE}.tmp.$$"

log "mulai pg_dump -Fc ke ${TMP}"
if ! pg_dump --no-owner --no-privileges -Fc "$DATABASE_URL" > "$TMP"; then
  rm -f "$TMP"
  fail "pg_dump exit non-zero"
fi

if [ ! -s "$TMP" ]; then
  rm -f "$TMP"
  fail "dump kosong (0 byte)"
fi

if ! pg_restore --list "$TMP" >/dev/null; then
  rm -f "$TMP"
  fail "pg_restore --list gagal parse dump (file korup)"
fi

mv -f "$TMP" "$FILE"
SIZE="$(wc -c < "$FILE" | tr -d ' ')"
log "OK tersimpan ${FILE} (${SIZE} byte)"

if [ "$PRUNE_AFTER" = "1" ] && [ -x "${SCRIPT_DIR}/prune-backups.sh" ]; then
  log "jalankan prune retensi (Dailyx14/weeklyx8/monthlyx12)"
  if ! BACKUP_DIR="$BACKUP_DIR" NTFY_TOPIC="$NTFY_TOPIC" NTFY_SERVER="$NTFY_SERVER" "${SCRIPT_DIR}/prune-backups.sh"; then
    log "WARN: prune gagal (non-fatal, backup tetap OK)"
  fi
fi

log "selesai OK"
