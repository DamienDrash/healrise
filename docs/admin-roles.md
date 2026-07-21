# HEALRISE — Reduzierte Strapi-Admin-Rolle für Damien (P4.3 / L-03/L-04)

**Ziel:** Damien loggt sich ins CMS ein und sieht **nur „Kunden" (App-Nutzer +
ihre Käufe) und „Produkte" (Programme)** — kein Super-Admin, keine Settings,
keine Media Library, kein Content-Type Builder.

Diese Anleitung trennt sauber, **was automatisch/programmatisch** passiert und
**was Damien bzw. der Betreiber einmalig im Admin-Panel klicken muss**.

---

## 1. Was automatisch passiert (programmatisch, kein Login nötig)

Beim Strapi-Start legt der Bootstrap die Rolle **„HEALRISE Betrieb"** idempotent
an und weist ihr einen eng begrenzten Scope zu:

| Bereich | Content-Type | Rechte |
|---|---|---|
| Kunden | `plugin::users-permissions.user` | lesen, bearbeiten (**kein** Löschen) |
| Kunden | `api::purchase.purchase` | nur lesen (Käufe sind Belege) |
| Produkte | `api::program.program` | anlegen, lesen, bearbeiten, löschen, **veröffentlichen** |

Quelle der Wahrheit + Selbstschutz: `strapi/src/admin-role-scope.ts`
(`BETRIEB_ROLE`, `SCOPED_PERMISSIONS`, `validateAdminRoleScope`). Der Seed
(`applyBetriebAdminRole`) ist **best effort**: schlägt der Admin-Role-Service
fehl oder fehlt er, wird der Start **nicht** abgebrochen (nur geloggt). Guard:
`scripts/tests/admin-role-scope.test.mjs`.

**Warum die Menüs damit verschwinden:** Die Admin-Navigation ist
permission-gesteuert. Ohne `admin::…`-Settings-Permissions ist **Settings**
weg, ohne `plugin::upload`-Permissions die **Media Library**, und der
**Content-Type Builder** ist in Produktion (`NODE_ENV=production`) ohnehin
deaktiviert. Der Content-Manager zeigt nur Content-Types mit `read`-Permission —
also genau Kunden + Produkte.

### CE/EE-Hinweis (wichtig)
Die zugrunde liegenden Services (`admin::role` → `create`/`assignPermissions`)
liegen in der **Community Edition** und werden hier programmatisch genutzt — das
Anlegen der Rolle umgeht die UI-Sperre für RBAC-Rollenverwaltung. Das
**Rollen-Management im Admin-UI** (Rollen anklicken/bearbeiten) ist ein
Enterprise-Feature; für HEALRISE brauchen wir es nicht, weil der Scope im Code
gepflegt wird. **Nach dem ersten Deploy einmal live verifizieren** (siehe §3),
dass die Einschränkung greift; falls die CE-Durchsetzung im konkreten Build
nicht ausreicht, ist die eingebaute **Editor**-Rolle der Fallback (nicht
Super-Admin, blendet Settings/Admin-Verwaltung aus — sieht aber alle
Content-Types + Media Library).

---

## 2. ⛔ Betreiber-Blocker (GUI, einmalig) — Damien einladen & Rolle zuweisen

Das Anlegen/Einladen eines **Admin-Nutzers** ist bewusst **kein** Code-Schritt
(kein Passwort/keine Einladung im Repo). Das macht der bestehende **Super-Admin**
einmalig im Panel:

1. Als Super-Admin einloggen: `https://services.frigew.ski/healrise/app/cms/admin`.
2. **Settings → Administration Panel → Users → „Invite new user"**.
3. Damiens E-Mail eintragen, als **Rolle „HEALRISE Betrieb"** auswählen (NICHT
   „Super Admin"). Speichern.
   - Ohne konfigurierten SMTP-Versand (P3.1) zeigt Strapi einen **Einladungslink**
     direkt an — diesen Link an Damien weitergeben (er setzt sein Passwort).
4. Damien meldet sich über den Link an und vergibt sein Passwort.

---

## 3. Verifikation (einmalig nach dem Zuweisen)

Als **Damien** einloggen und prüfen:

- Linke Navigation zeigt **nur** „Content Manager" mit Kunden + Produkten.
- **Settings**, **Media Library** und **Content-Type Builder** sind **nicht**
  sichtbar.
- „Produkte/Programme" lassen sich anlegen/bearbeiten/veröffentlichen; „Kunden/
  Käufe" sind nur lesbar; „Kunden/Nutzer" lesbar + editierbar, **nicht** löschbar.

Greift die Einschränkung im Build nicht wie erwartet, Damien stattdessen die
eingebaute **Editor**-Rolle zuweisen (Fallback, s. §1) und diesen Punkt als
offen dokumentieren.

---

## 4. Scope ändern

Nicht im Admin-UI klicken — den Scope in `strapi/src/admin-role-scope.ts`
(`SCOPED_PERMISSIONS`) anpassen, `npm run test:scripts` grün halten, deployen.
Der Seed weist den geänderten Scope beim nächsten Start automatisch (idempotent,
diff-basiert) zu.
