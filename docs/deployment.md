# HEALRISE — Deployment (Ist-Zustand, verifiziert 13.07.2026)

Öffentliche Struktur unter `https://services.frigew.ski` (Reverse Proxy: **Caddy**,
`/etc/caddy/Caddyfile`, systemd-Dienst `caddy`):

| Pfad | Inhalt | Quelle |
|------|--------|--------|
| `/healrise/` | Landing-Page (statisch) | `dist/` |
| `/healrise/app/` | PWA (React-Build) | `app/dist/` |
| `/healrise/app/api/*` | Strapi REST-API | Proxy → `127.0.0.1:9130/api/*` |
| `/healrise/app/cms/*` | Strapi Admin (Login: `/healrise/app/cms/admin`) | Proxy → `127.0.0.1:9130/*` |

## Caddy-Regeln (Auszug aus /etc/caddy/Caddyfile)

Reihenfolge/Spezifität beachten: API- und CMS-Handler stehen **vor** den SPA-Handlern.

```caddy
handle /healrise/app/api/* {
	uri strip_prefix /healrise/app
	reverse_proxy 127.0.0.1:9130
}
handle /healrise/app/cms/* {
	uri strip_prefix /healrise/app/cms
	reverse_proxy 127.0.0.1:9130
}
handle /healrise/app/cms {
	redir /healrise/app/cms/admin 308
}
# danach: sw.js (no-cache), SPA-Fallback app/dist, Landing dist/
```

Änderungen an der Caddyfile immer mit Backup + `caddy validate --config /etc/caddy/Caddyfile`,
erst dann `sudo systemctl reload caddy`. Rollback = Backup zurückkopieren + reload.

### Access-Logs (2.4 / L-01)

Versioniertes, pfad-scopedes Artefakt: `deploy/caddy/healrise-access-log.caddy` — ein
`log`-Block, der **nur** `/healrise*` in `/var/log/caddy/healrise-access.log` protokolliert
(Nicht-healrise-Requests via `log_skip` ausgenommen → Nachbarprojekte bleiben draußen),
mit eingebauter Rotation (`roll_size`/`roll_keep`/`roll_keep_for` = 30 Tage). Client-IPs sind
personenbezogen → in der Verarbeitungsdoku (Art. 30 DSGVO) führen. Einbau in den geteilten
Caddyfile: Block einfügen → `caddy validate` → `sudo systemctl reload caddy` → mit einem
`/healrise`-Request in der Logdatei prüfen.

Wichtig (Review I5): `strapi/config/server.ts` setzt `url: env('PUBLIC_URL')` und `proxy: true` —
`PUBLIC_URL=https://services.frigew.ski/healrise/app/cms` muss in `strapi/.env` stehen, sonst
generiert Strapi falsche absolute URLs (Admin-Assets, Mail-Links, Uploads).

Bekannte Falle (Review I2): Der Service-Worker-Scope der PWA ist `/healrise/app/` — `/healrise/app/cms`
steht deshalb in der `navigateFallbackDenylist` der PWA-Konfiguration. Beim Ändern von Pfaden beides anpassen.

**Entscheidung CMS-Route (Audit B-03, 13.07.2026):** öffentlich erreichbar, geschützt durch
Strapi-Admin-Login (kein Fallback-Secret). Zusätzlicher IP-/Rate-Limit-Schutz: Roadmap P4.

## Prozessmanagement (systemd)

Strapi läuft als systemd-Dienst **`healrise-strapi.service`** (User `claude`,
`NODE_ENV=production`, `Restart=always`, enabled → reboot-fest). Unit-Quellen liegen
versioniert in `deploy/systemd/`; Installation:

```bash
sudo cp deploy/systemd/healrise-strapi.service \
        deploy/systemd/healrise-strapi-health.service \
        deploy/systemd/healrise-strapi-health.timer /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now healrise-strapi.service healrise-strapi-health.timer
```

- **Logs:** `journalctl -u healrise-strapi` (stdout/stderr → journald).
- **Healthcheck:** `healrise-strapi-health.timer` curlt alle 5 min `http://127.0.0.1:9130/_health`
  (Strapi-Liveness, 204) und restartet den Dienst bei Fehlschlag (`scripts/healthcheck.sh`).
- **Alerting (2.4 / L-01):** Bei einem Healthcheck-Fail ruft `scripts/healthcheck.sh` — zusätzlich
  zum Restart — einen env-konfigurierbaren Alarmweg auf. Dafür in
  `deploy/systemd/healrise-strapi-health.service` `Environment=HEALTH_ALERT_CMD=/pfad/zu/alert.sh`
  setzen (z. B. `curl` an einen Webhook/ntfy). Best effort (blockiert den Restart nicht), Aufruf nur
  als argv (keine Shell-Injection); **keine Secrets im Skript** — die stecken im Alarm-Kommando/Env.
  Ohne gesetztes `HEALTH_ALERT_CMD` verhält sich der Healthcheck wie bisher (Log + Restart).
- `SEED_DEMO` darf in der Unit **nie** gesetzt werden (legt Testuser mit bekanntem Passwort an).

## Deploy

Standardweg (baut alles ohne root, restartet Strapi, wartet auf Health, führt Live-Smoke aus):

```bash
scripts/deploy.sh
```

Einzelschritte (falls nur ein Teil deployt wird):

1. PWA: `npm run build` → `app/dist/`
2. Landing: `npm run build:landing` → `dist/`
3. Strapi inkl. Admin-Panel: `cd strapi && NODE_ENV=production NODE_OPTIONS=--max-old-space-size=8192 npm run build`
   (Admin-Build braucht >4 GB Heap; OOM mit Node-Default am 13.07.2026 verifiziert),
   dann `sudo systemctl restart healrise-strapi`
4. Live-Smoke: `scripts/smoke.sh` (API, Admin-HTML, Admin-Asset, PWA, sw.js, Landing)

Alle Builds laufen als User `claude` — nie als root bauen/deployen (Ownership-Falle, Audit B-04).

`scripts/deploy.sh` normalisiert vor dem Restart die Secrets-Datei `strapi/.env` per
`scripts/harden-env.sh` auf Modus `600` (nur Owner `claude` liest/schreibt; Inhalt wird nie
gelesen oder verändert). Invariante: `stat -c '%U:%G %a' strapi/.env` = `claude:claude 600`
(Audit O-03).

## Backup & Restore (O-01)

Der DB-Backup läuft als systemd-Timer **`healrise-backup.timer`** (+ `healrise-backup.service`,
Unit-Quellen in `deploy/systemd/`) täglich 03:10 Europe/Berlin und ruft `scripts/db-backup.sh`
(`BACKUP_RUN=1`) auf: `pg_dump` (Custom-Format) der Strapi-DB, Rotation (`BACKUP_KEEP`, Default 30 Tage)
und optionale Off-Site-Kopie über `BACKUP_OFFSITE_CMD`. Alle DB-Zugangsdaten kommen aus der
Umgebung (`DATABASE_*`); das Passwort wird nie geloggt.

```bash
sudo cp deploy/systemd/healrise-backup.service deploy/systemd/healrise-backup.timer /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now healrise-backup.timer
systemctl status healrise-backup.timer          # nächster Lauf
```

- **Dry-Run (kein Dump):** `scripts/db-backup.sh` (ohne `BACKUP_RUN=1`) zeigt nur den geplanten Befehl.
- **Restore-Drill:** `scripts/db-restore-drill.sh <dump>` spielt in eine **explizite Test-DB**
  (`RESTORE_TARGET_DB`) ein; die Live-DB ist ohne `RESTORE_ALLOW_LIVE=1` hart blockiert.

## Betriebs-Checks

```bash
systemctl status healrise-strapi          # Dienststatus
journalctl -u healrise-strapi -n 50       # letzte Logs
curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:9130/_health   # 204 = ok
scripts/smoke.sh                          # kompletter Live-Smoke über Caddy
```
