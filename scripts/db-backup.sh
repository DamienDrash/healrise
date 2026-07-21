#!/usr/bin/env bash
# HEALRISE DB-Backup (Audit O-01) — VERSIONIERTES ARTEFAKT, per Default DRY-RUN.
#
# Erstellt einen pg_dump der Strapi-Postgres-DB. Verbindungsdaten kommen
# AUSSCHLIESSLICH aus der Umgebung (keine hartkodierten Passwörter/URLs). Das
# Passwort wird nur über PGPASSWORD an pg_dump gereicht und NIE ausgegeben.
#
# Sicherheit:
#   - DRY-RUN per Default: druckt nur den geplanten Befehl (ohne Secret).
#     Echtes Dump nur mit  BACKUP_RUN=1.
#   - Kein Cron/Timer wird hier aktiviert (Betreiber-Schritt, s. launch-checklist).
#   - Off-Site-Kopie nur als optionaler, env-gesteuerter Stub (nicht live).
#
# Env (Defaults aus strapi/.env übernehmen — NICHT hier setzen):
#   DATABASE_HOST (127.0.0.1) DATABASE_PORT (5432) DATABASE_NAME (healrise)
#   DATABASE_USERNAME (healrise) DATABASE_PASSWORD (→ PGPASSWORD, nie geloggt)
#   BACKUP_DIR (strapi/backups)  BACKUP_KEEP (7, Rotation)  BACKUP_RUN (0=dry-run)
#   BACKUP_OFFSITE_CMD (optional; z. B. "rclone copy {file} remote:healrise")
#
# Nutzung:
#   scripts/db-backup.sh              # Dry-Run: zeigt Plan
#   BACKUP_RUN=1 scripts/db-backup.sh # echtes Dump (Betreiber, mit gesetztem Env)
set -euo pipefail
cd "$(dirname "$0")/.."

DB_HOST="${DATABASE_HOST:-127.0.0.1}"
DB_PORT="${DATABASE_PORT:-5432}"
DB_NAME="${DATABASE_NAME:-healrise}"
DB_USER="${DATABASE_USERNAME:-healrise}"
BACKUP_DIR="${BACKUP_DIR:-strapi/backups}"
BACKUP_KEEP="${BACKUP_KEEP:-7}"
BACKUP_RUN="${BACKUP_RUN:-0}"

TS="$(date -u +%Y%m%dT%H%M%SZ)"
OUT="${BACKUP_DIR}/healrise-${DB_NAME}-${TS}.dump"

# pg_dump-Argumente (Custom-Format, komprimiert). Passwort NUR via PGPASSWORD.
DUMP_ARGS=(-h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -F c -f "$OUT")

echo "HEALRISE DB-Backup"
echo "  Ziel-Datei : ${OUT}"
echo "  Rotation   : behalte ${BACKUP_KEEP} neueste in ${BACKUP_DIR}"
echo "  Off-Site   : ${BACKUP_OFFSITE_CMD:+konfiguriert (env)}${BACKUP_OFFSITE_CMD:-nicht gesetzt (Betreiber-Schritt)}"

if [[ "$BACKUP_RUN" != "1" ]]; then
  echo "  Modus      : DRY-RUN (kein Dump). Für echtes Dump: BACKUP_RUN=1"
  echo "  Befehl     : PGPASSWORD=*** pg_dump ${DUMP_ARGS[*]}"
  exit 0
fi

if [[ -z "${DATABASE_PASSWORD:-}" ]]; then
  echo "FEHLER: DATABASE_PASSWORD nicht gesetzt (aus strapi/.env exportieren)." >&2
  exit 1
fi

mkdir -p "$BACKUP_DIR"
PGPASSWORD="$DATABASE_PASSWORD" pg_dump "${DUMP_ARGS[@]}"
echo "  ✓ Dump geschrieben: ${OUT}"

# Rotation: nur die BACKUP_KEEP neuesten .dump behalten.
mapfile -t OLD < <(ls -1t "${BACKUP_DIR}"/healrise-*.dump 2>/dev/null | tail -n +"$((BACKUP_KEEP + 1))")
for f in "${OLD[@]:-}"; do [[ -n "$f" ]] && rm -f "$f" && echo "  rotiert (gelöscht): $f"; done

# Off-Site: optionaler, env-gesteuerter Stub. Nur wenn Betreiber es gesetzt hat.
if [[ -n "${BACKUP_OFFSITE_CMD:-}" ]]; then
  echo "  Off-Site: ${BACKUP_OFFSITE_CMD//\{file\}/$OUT}"
  # Bewusst NICHT automatisch ausgeführt — Betreiber aktiviert Off-Site separat.
fi
