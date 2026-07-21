#!/usr/bin/env bash
# HEALRISE DB-Restore-Drill (Audit O-01) — VERSIONIERTES ARTEFAKT, per Default DRY-RUN.
#
# Spielt einen pg_dump in eine EXPLIZITE TEST-DB ein, um das Restore-Verfahren zu
# üben. Die Live-DB ist hart geschützt: ein Restore gegen DATABASE_NAME wird
# verweigert, außer der Betreiber setzt bewusst RESTORE_ALLOW_LIVE=1.
# Verbindungsdaten NUR aus Env; Passwort nur via PGPASSWORD, nie geloggt.
#
# Sicherheit:
#   - DRY-RUN per Default: druckt nur den geplanten Befehl. Echt nur RESTORE_RUN=1.
#   - Ziel muss RESTORE_TARGET_DB sein und darf NICHT die Live-DB (DATABASE_NAME)
#     sein — sonst Abbruch (außer RESTORE_ALLOW_LIVE=1, dringend abgeraten).
#
# Env:
#   DATABASE_HOST DATABASE_PORT DATABASE_NAME(=live, geschützt) DATABASE_USERNAME
#   DATABASE_PASSWORD (→ PGPASSWORD)  RESTORE_TARGET_DB (Pflicht: Test-DB)
#   RESTORE_RUN (0=dry-run)  RESTORE_ALLOW_LIVE (0; NUR bewusst 1 setzen)
#
# Nutzung:
#   RESTORE_TARGET_DB=healrise_restore_test scripts/db-restore-drill.sh <dump-datei>
set -euo pipefail
cd "$(dirname "$0")/.."

DUMP_FILE="${1:-}"
DB_HOST="${DATABASE_HOST:-127.0.0.1}"
DB_PORT="${DATABASE_PORT:-5432}"
DB_USER="${DATABASE_USERNAME:-healrise}"
LIVE_DB="${DATABASE_NAME:-healrise}"
TARGET_DB="${RESTORE_TARGET_DB:-}"
RESTORE_RUN="${RESTORE_RUN:-0}"
RESTORE_ALLOW_LIVE="${RESTORE_ALLOW_LIVE:-0}"

if [[ -z "$DUMP_FILE" ]]; then
  echo "FEHLER: Dump-Datei als 1. Argument erforderlich." >&2
  exit 2
fi
if [[ -z "$TARGET_DB" ]]; then
  echo "FEHLER: RESTORE_TARGET_DB (Test-DB) muss gesetzt sein — nie implizit gegen Live." >&2
  exit 2
fi

# HART: Live-DB schützen.
if [[ "$TARGET_DB" == "$LIVE_DB" && "$RESTORE_ALLOW_LIVE" != "1" ]]; then
  echo "BLOCKIERT: RESTORE_TARGET_DB == Live-DB ('${LIVE_DB}'). Restore-Drill nur gegen eine" >&2
  echo "separate Test-DB. Nur bewusst und mit Backup: RESTORE_ALLOW_LIVE=1 setzen." >&2
  exit 3
fi

RESTORE_ARGS=(-h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$TARGET_DB" --clean --if-exists "$DUMP_FILE")

echo "HEALRISE DB-Restore-Drill"
echo "  Quelle : ${DUMP_FILE}"
echo "  Ziel   : ${TARGET_DB} (Live geschützt: ${LIVE_DB})"

if [[ "$RESTORE_RUN" != "1" ]]; then
  echo "  Modus  : DRY-RUN (kein Restore). Für echten Drill: RESTORE_RUN=1"
  echo "  Befehl : PGPASSWORD=*** pg_restore ${RESTORE_ARGS[*]}"
  exit 0
fi

if [[ ! -f "$DUMP_FILE" ]]; then echo "FEHLER: Dump-Datei fehlt: $DUMP_FILE" >&2; exit 2; fi
if [[ -z "${DATABASE_PASSWORD:-}" ]]; then echo "FEHLER: DATABASE_PASSWORD nicht gesetzt." >&2; exit 1; fi

PGPASSWORD="$DATABASE_PASSWORD" pg_restore "${RESTORE_ARGS[@]}"
echo "  ✓ Restore-Drill nach ${TARGET_DB} abgeschlossen."
