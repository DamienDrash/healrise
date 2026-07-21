#!/usr/bin/env bash
# HEALRISE Deploy: baut alle drei Teilprojekte ohne root, restartet Strapi,
# wartet auf Health und führt den Live-Smoke aus. Bricht beim ersten Fehler ab.
# Nutzung: scripts/deploy.sh   (als User claude, nie als root)
#
# Alle Seiteneffekte sind über opt-in-Env übersteuerbar (Defaults = echtes
# Prod-Verhalten). Das hält Tests aus dem realen Build/systemctl/Netz heraus,
# ohne den produktiven Pfad zu ändern. argv-Hooks statt eval (kein Shell-
# Injection-Vektor, konsistent mit healthcheck.sh / B-07).
set -euo pipefail
cd "$(dirname "$0")/.."

if [[ "$(id -u)" == "0" ]]; then
  echo "Nicht als root deployen (Ownership-Falle B-04)."; exit 1
fi

# --- Übersteuerbare Konfiguration (Defaults = Produktion) ---
ENV_FILE="${ENV_FILE:-strapi/.env}"                       # Secrets-Datei (Preflight + harden)
HEALTH_URL="${HEALTH_URL:-http://127.0.0.1:9130/_health}" # Strapi-Liveness
HEALTH_RETRIES="${HEALTH_RETRIES:-30}"                     # Versuche im Health-Wait
HEALTH_SLEEP="${HEALTH_SLEEP:-2}"                          # Pause je Versuch (s)
HARDEN_CMD="${HARDEN_CMD:-scripts/harden-env.sh}"         # argv: .env-Hardening
SMOKE_CMD="${SMOKE_CMD:-scripts/smoke.sh}"                 # argv: Live-Smoke
RESTART_HOOK="${RESTART_HOOK:-}"                           # argv-Ziel statt sudo systemctl (Tests)
SKIP_BUILD="${DEPLOY_SKIP_BUILD:-0}"                       # 1 = Builds überspringen (Tests)
LOCK="${DEPLOY_LOCK:-/tmp/healrise-deploy.lock}"          # Concurrency-Lock

# --- Concurrency-Lock: verhindert überlappende Deploys (halbfertiger Build +
# gleichzeitiger Restart = kaputter Live-Zustand). Der Lock wird beim Prozessende
# automatisch freigegeben. ---
exec 9>"$LOCK"
if ! flock -n 9; then
  echo "Ein Deploy läuft bereits ($LOCK) — abgebrochen."; exit 1
fi

# --- Preflight: ohne Secrets-Datei bootet Strapi (fehlendes JWT_SECRET) in eine
# Restart-Schleife. Lieber hier hart abbrechen als kaputt live gehen. ---
if [[ ! -f "$ENV_FILE" ]]; then
  echo "Secrets-Datei $ENV_FILE fehlt — Deploy abgebrochen (JWT_SECRET u. a. erforderlich)."; exit 1
fi

if [[ "$SKIP_BUILD" != "1" ]]; then
  echo "== Build: PWA (app/dist) =="
  npm run build

  echo "== Build: Landing (dist/) =="
  npm run build:landing

  echo "== Build: Strapi inkl. Admin-Panel (strapi/dist) =="
  # Admin-Build braucht >4 GB Heap (OOM mit Node-Default am 13.07.2026 verifiziert)
  (cd strapi && NODE_ENV=production NODE_OPTIONS=--max-old-space-size=8192 npm run build)
fi

echo "== Hardening: strapi/.env auf 600 (O-03) =="
ENV_FILE="$ENV_FILE" "$HARDEN_CMD"

echo "== Restart: healrise-strapi =="
if [[ -n "$RESTART_HOOK" ]]; then
  "$RESTART_HOOK" healrise-strapi.service
else
  sudo systemctl restart healrise-strapi.service
fi

echo "== Warte auf /_health =="
for ((i = 1; i <= HEALTH_RETRIES; i++)); do
  if curl -fsS -m 5 -o /dev/null "$HEALTH_URL"; then break; fi
  [[ $i == "$HEALTH_RETRIES" ]] && { echo "Strapi wird nicht healthy — journalctl -u healrise-strapi"; exit 1; }
  sleep "$HEALTH_SLEEP"
done

echo "== Live-Smoke =="
"$SMOKE_CMD"
echo "Deploy ok."
