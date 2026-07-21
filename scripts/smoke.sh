#!/usr/bin/env bash
# HEALRISE Live-Smoke: prüft die öffentlich erreichbaren Endpunkte über Caddy.
# Nutzung: scripts/smoke.sh   (Exit 0 = alles grün)
set -uo pipefail

# BASE/HEALTH_URL sind überschreibbar (Tests fahren gegen einen lokalen Mock);
# Defaults = echter Prod-Host über Caddy bzw. Strapi-Liveness auf localhost.
BASE="${BASE:-https://services.frigew.ski}"
HEALTH_URL="${HEALTH_URL:-http://127.0.0.1:9130/_health}"
FAIL=0

check() { # check <beschreibung> <erwartet> <url> [grep-muster]
  local desc="$1" want="$2" url="$3" pattern="${4:-}"
  local tmp code
  tmp=$(mktemp)
  # Kein `-f`: der HTTP-Code wird unten explizit gegen $want geprüft; `-f` würde
  # bei erwarteten 4xx (z. B. dem auth-gated 403 von /api/programs) selbst als
  # Fehler abbrechen und den echten Code verschlucken. Nur echte Transport-/
  # Timeout-Fehler (curl-Exit ≠ 0) fallen weiter auf "ERR".
  code=$(curl -sS -m 15 -o "$tmp" -w '%{http_code}' "$url" 2>/dev/null) || code="ERR"
  if [[ "$code" != "$want" ]]; then
    echo "FAIL  $desc — HTTP $code (erwartet $want)  $url"; FAIL=1
  elif [[ -n "$pattern" ]] && ! grep -q "$pattern" "$tmp"; then
    echo "FAIL  $desc — Muster »$pattern« fehlt  $url"; FAIL=1
  else
    echo "ok    $desc"
  fi
  rm -f "$tmp"
}

# Strapi direkt (localhost): Liveness
code=$(curl -fsS -m 10 -o /dev/null -w '%{http_code}' "$HEALTH_URL" 2>/dev/null) || code="ERR"
[[ "$code" == "204" ]] && echo "ok    Strapi /_health (204)" || { echo "FAIL  Strapi /_health — $code"; FAIL=1; }

# API über Caddy: /api/programs ist auth-gated — `api::program.program.find` steht
# nur in AUTHENTICATED_ACTIONS (strapi/src/index.ts), die App ruft die Route stets
# mit Bearer-JWT auf (app/src/api/client.js). Anonymer Zugriff MUSS 403 liefern; das
# belegt „Route verdrahtet + Auth-Gate aktiv" (eine fehlende Route wäre 404). Ein 200
# hier bedeutete abgesenkten Schutz (Inhalte öffentlich lesbar) und ist ein FAIL.
check "API /api/programs (403, auth-gated)"  403 "$BASE/healrise/app/api/programs" 'ForbiddenError'
# Admin-Panel über Caddy
check "Admin-HTML /cms/admin (200)"          200 "$BASE/healrise/app/cms/admin" "strapi"
# Erstes Admin-Asset aus dem HTML extrahieren und laden
asset=$(curl -fsS -m 15 "$BASE/healrise/app/cms/admin" | grep -oE 'src="[^"]+\.js"' | head -1 | cut -d'"' -f2)
if [[ -n "${asset:-}" ]]; then
  # Strapi bettet die Admin-Assets hinter dem PUBLIC_URL-Subpfad als root-relative
  # Pfade ein (…/cms/admin/xxx.js, ohne Host). Solche Pfade müssen gegen BASE
  # aufgelöst werden — sonst curlt der Smoke einen schemalosen Pfad und meldet
  # fälschlich ERR (blieb rot, obwohl das Admin gesund ist). Absolute URLs
  # (Tests/Mocks) bleiben unverändert.
  case "$asset" in
    http://*|https://*) asset_url="$asset" ;;
    /*)                 asset_url="${BASE}${asset}" ;;
    *)                  asset_url="${BASE}/healrise/app/cms/admin/${asset}" ;;
  esac
  check "Admin-Asset $asset (200)" 200 "$asset_url"
else
  echo "FAIL  Admin-Asset — kein <script src> im Admin-HTML gefunden"; FAIL=1
fi
# PWA + Landing + SW
check "PWA /healrise/app/ (200)"             200 "$BASE/healrise/app/" "HEALRISE"
check "PWA sw.js (200)"                      200 "$BASE/healrise/app/sw.js"
check "Landing /healrise/ (200)"             200 "$BASE/healrise/" "HEALRISE"

exit $FAIL
