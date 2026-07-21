# HEALRISE — Caddy-Konfiguration (Betreiber-/Deploy-Übersicht)

HEALRISE läuft **path-scoped** auf der **geteilten** Caddy-Site
`services.frigew.ski` (neben fitness, athletik-movement, hermes, pubtender, …).
Alle HEALRISE-Direktiven liegen unter `/healrise/…` und dürfen die
Nachbarprojekte **nicht** berühren. Es gibt **kein** dediziertes HEALRISE-Site-
bzw. `:1337`-Setup — Strapi läuft lokal auf **127.0.0.1:9130** hinter dem Proxy.

Dieses Repo hält die HEALRISE-Caddy-Bausteine **versioniert** unter
`deploy/caddy/*.caddy`. Sie werden **nicht** automatisch angewandt (Deploy-Gate,
Damien-Go) — der/die Betreiber:in fügt sie in den geteilten `/etc/caddy/Caddyfile`
ein, `caddy validate`, dann `sudo systemctl reload caddy`.

## Bausteine & Reihenfolge

Innerhalb des `services.frigew.ski { … }`-Blocks in **dieser** Reihenfolge
(spezifischere Pfade zuerst — sonst fängt der SPA-`file_server` `/cms` + `/api` ab):

| # | Datei | Zweck |
|---|---|---|
| 1 | `deploy/caddy/healrise-cms-proxy.caddy` | **Reverse-Proxy** `/healrise/app/cms/*` (Admin/content-manager) und `/healrise/app/api/*` (API) → `127.0.0.1:9130` |
| 2 | `deploy/caddy/healrise-postal-webhook.caddy` | Postal-Webhook `/healrise/app/api/mail/webhook` (Teilmenge von #1 — nur nötig, falls #1 nicht eingesetzt wird) |
| 3 | `deploy/caddy/healrise-security-headers.caddy` | HSTS/CSP/X-* — in die `/healrise/app/*`- und `/healrise/*`-Handles |
| 4 | `deploy/caddy/healrise-cache-headers.caddy` | Cache-Control + SPA-`file_server` (`/healrise/app/*`, `/healrise/*`) — **muss NACH #1** stehen |
| — | `deploy/caddy/healrise-access-log.caddy` | Access-Log für `/healrise*` (Rotation, nachbar-sicher) |

## Proxy-Fakten (aus dem Repo belegt)

- **Port:** `127.0.0.1:9130` (`strapi/.env` `PORT=9130`, systemd-Unit) — **nicht** der Strapi-Default 1337.
- **`PUBLIC_URL=https://services.frigew.ski/healrise/app/cms`** (`strapi/.env`): Strapi
  erzeugt seine Admin-Asset-URLs mit diesem Präfix. Deshalb strippt die **CMS-Route**
  exakt `/healrise/app/cms` (→ Strapi sieht `/admin`, `/content-manager`), die
  **API-Route** nur `/healrise/app` (→ Strapi-API unter `/api`).
- Belegt durch `scripts/smoke.sh`: `/healrise/app/cms/admin` → 200 (HTML + Asset),
  `/healrise/app/api/programs` → 403 (auth-gated).

```caddyfile
# In services.frigew.ski { … }, VOR den /healrise/app/*- und /healrise/*-Handles:
handle /healrise/app/cms/* {
	uri strip_prefix /healrise/app/cms
	reverse_proxy 127.0.0.1:9130
}
handle /healrise/app/api/* {
	uri strip_prefix /healrise/app
	reverse_proxy 127.0.0.1:9130
}
```

## Lokale Prüfung

- `caddy fmt deploy/caddy/healrise-cms-proxy.caddy` — Formatierung.
- `caddy validate` gegen den zusammengesetzten `/etc/caddy/Caddyfile` (Betreiber).
- Guards: `scripts/tests/cms-proxy-caddy.test.mjs`, `postal-webhook-caddy.test.mjs`,
  `security-headers.test.mjs`, `p42-cache-headers-artifact.test.mjs`,
  `monitoring-readiness.test.mjs` — `npm run test:scripts`.

## ⛔ Betreiber-Blocker (Damien-Go)

Einfügen in den geteilten `/etc/caddy/Caddyfile` (Backup zuerst), `caddy validate`,
`sudo systemctl reload caddy`, dann `scripts/smoke.sh`. Keine automatische
Live-Änderung aus diesem Repo.
