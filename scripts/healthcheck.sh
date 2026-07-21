#!/usr/bin/env bash
# HEALRISE Strapi Healthcheck (via healrise-strapi-health.timer, als root).
# /_health ist Strapis eingebauter Liveness-Endpoint (204, ohne Auth/DB-Zugriff);
# hängt der Prozess (Restart=always greift nur bei Crash), wird hier restartet.
set -u
# HEALTH_URL/HEALRISE_UNIT sind überschreibbar (Tests fahren gegen Mock + Marker
# statt echtem systemctl); Defaults = Strapi-Liveness bzw. der Prod-Dienst.
HEALTH_URL="${HEALTH_URL:-http://127.0.0.1:9130/_health}"
HEALRISE_UNIT="${HEALRISE_UNIT:-healrise-strapi.service}"
# RESTART_HOOK: optionaler Pfad zu einem Executable, das anstelle von `systemctl`
# aufgerufen wird (Tests injizieren hier einen Marker-Writer). Kein `eval` mehr:
# das Restart-Ziel wird ausschließlich als argv übergeben — Shell-Metazeichen im
# Unit-Namen können so keine Kommandos einschleusen (Security B-07).
RESTART_HOOK="${RESTART_HOOK:-}"
# HEALTH_ALERT_CMD (2.4/L-01): optionaler Pfad zu einem Executable, das bei einem
# Healthcheck-Fail als Alarmweg aufgerufen wird (z. B. curl an einen Webhook/ntfy,
# von der systemd-Unit gesetzt). Best effort, blockiert den Restart nicht; keine
# Secrets/URLs hier im Skript — die stecken im Alarm-Kommando/Env des Betreibers.
# Aufruf ausschließlich als argv (kein eval): keine Shell-Injection.
HEALTH_ALERT_CMD="${HEALTH_ALERT_CMD:-}"

if curl -fsS -m 10 -o /dev/null "$HEALTH_URL"; then
  exit 0
fi
MSG="healrise-strapi: /_health fehlgeschlagen — restarte $HEALRISE_UNIT"
echo "$MSG" | systemd-cat -t healrise-health -p warning

# Alarm (best effort) VOR dem Restart auslösen, damit der Ausfall nicht unbemerkt bleibt.
if [[ -n "$HEALTH_ALERT_CMD" ]]; then
  "$HEALTH_ALERT_CMD" "$MSG" || true
fi

if [[ -n "$RESTART_HOOK" ]]; then
  "$RESTART_HOOK" "$HEALRISE_UNIT"
else
  systemctl restart "$HEALRISE_UNIT"
fi
