#!/usr/bin/env bash
# HEALRISE Secrets-Hardening (Audit O-03, Roadmap P2.5): normalisiert die
# Berechtigungen der Strapi-Secrets-Datei auf 600 (nur Owner darf lesen/schreiben).
# Liest oder verändert NIEMALS den Inhalt und ändert den Owner nicht. Idempotent.
# Teil des unterstützten Deploy-Pfads (scripts/deploy.sh).
# Nutzung: scripts/harden-env.sh   (ENV_FILE überschreibt den Pfad, z. B. für Tests)
set -euo pipefail
cd "$(dirname "$0")/.."

ENV_FILE="${ENV_FILE:-strapi/.env}"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "harden-env: $ENV_FILE nicht gefunden — übersprungen."
  exit 0
fi

mode="$(stat -c '%a' "$ENV_FILE")"
if [[ "$mode" != "600" ]]; then
  echo "harden-env: $ENV_FILE Modus $mode → 600 (O-03)"
  chmod 600 "$ENV_FILE"
else
  echo "harden-env: $ENV_FILE bereits 600 (O-03)"
fi
