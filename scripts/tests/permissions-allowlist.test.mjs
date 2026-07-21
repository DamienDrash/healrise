// Guardrail für die Permission-Allowlists (Audit D-06, Security).
// Sperrt die im Bootstrap (strapi/src/index.ts) vergebenen Rollen-Permissions
// gegen versehentliche Rechte-Ausweitung: exakte erwartete Mengen + Invarianten
// (public nur auth-Flows; authenticated ohne generische user.update/role/permission).
// Statisches Parsen der Quelle, kein Strapi-Lauf/DB. Ausführen: npm run test:scripts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { readFileSync } from 'node:fs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const INDEX = join(ROOT, 'strapi', 'src', 'index.ts');
const src = readFileSync(INDEX, 'utf8');

/** Liest ein `const NAME = [ '...', ... ];`-String-Array aus der Quelle. */
function parseActionArray(name) {
  const m = src.match(new RegExp(`const ${name} = \\[([\\s\\S]*?)\\];`));
  assert.ok(m, `Array ${name} nicht in index.ts gefunden`);
  return [...m[1].matchAll(/'([^']+)'/g)].map((x) => x[1]);
}

const AUTHENTICATED = parseActionArray('AUTHENTICATED_ACTIONS');
const PUBLIC = parseActionArray('PUBLIC_ACTIONS');

// Verbotene Aktionen für die authenticated-Rolle (Rechte-Ausweitung / Self-Upgrade).
// Exakte Aktionen (kein Substring — `user.updateMe` ist die sichere Whitelist-Route
// und darf NICHT mit dem generischen `user.update` verwechselt werden).
const FORBIDDEN_EXACT = [
  'plugin::users-permissions.user.update',   // generisches Update → plan-Self-Upgrade
  'plugin::users-permissions.user.create',
  'plugin::users-permissions.user.destroy',
];
// Verbotene Präfixe (Rollen-/Rechteverwaltung).
const FORBIDDEN_PREFIX = [
  'plugin::users-permissions.role.',
  'plugin::users-permissions.permission.',
];

function hasDangerous(actions) {
  return actions.some(
    (a) => FORBIDDEN_EXACT.includes(a) || FORBIDDEN_PREFIX.some((p) => a.startsWith(p)),
  );
}

test('AUTHENTICATED_ACTIONS entspricht exakt der erwarteten Allowlist', () => {
  const expected = [
    'plugin::users-permissions.user.me',
    'plugin::users-permissions.user.updateMe',
    'plugin::users-permissions.auth.changePassword',
    'plugin::users-permissions.auth.logout',
    'api::program.program.find',
    'api::program.program.findOne',
    'api::progress.progress-entry.find',
    'api::progress.progress-entry.toggle',
    'api::checkout.checkout.createSession',
    'plugin::users-permissions.user.setHealthConsent',
    'plugin::users-permissions.user.deleteMe',
    'plugin::users-permissions.user.billingPortal',
    'plugin::users-permissions.user.exportMe',
  ];
  assert.deepEqual([...AUTHENTICATED].sort(), [...expected].sort());
});

// Explizit geprüfte Nicht-Auth-Public-Reads: reine Read-Only-Freigaben ohne
// personenbezogene/sensible Daten, die bewusst ohne Login erreichbar sein MÜSSEN.
// api::legal.legal.find (R-01): Pflicht-Rechtstexte (Impressum/Datenschutz/AGB/
// Widerruf) müssen für jeden ohne Anmeldung abrufbar sein (Goldstandard R6–R10).
const PUBLIC_NONAUTH_ALLOWLIST = [
  'api::legal.legal.find',
];

test('PUBLIC_ACTIONS entspricht exakt der erwarteten Allowlist (Auth-Flows + geprüfte Public-Reads)', () => {
  const expected = [
    'plugin::users-permissions.auth.callback',
    'plugin::users-permissions.auth.register',
    'plugin::users-permissions.auth.forgotPassword',
    'plugin::users-permissions.auth.resetPassword',
    'plugin::users-permissions.auth.emailConfirmation',
    ...PUBLIC_NONAUTH_ALLOWLIST,
  ];
  assert.deepEqual([...PUBLIC].sort(), [...expected].sort());
});

test('Invariante: public sind nur auth.*-Aktionen ODER geprüfte Read-Only-Reads', () => {
  for (const a of PUBLIC) {
    const ok = /^plugin::users-permissions\.auth\./.test(a) || PUBLIC_NONAUTH_ALLOWLIST.includes(a);
    assert.ok(ok, `nicht-auth public permission ohne Freigabe: ${a}`);
  }
  // Read-Only-Guard: die geprüften Public-Reads dürfen ausschließlich .find/.findOne sein
  for (const a of PUBLIC_NONAUTH_ALLOWLIST) {
    assert.match(a, /\.(find|findOne)$/, `nur lesende Public-Reads erlaubt: ${a}`);
  }
});

test('Invariante: authenticated enthält KEINE rechte-ausweitenden Aktionen', () => {
  assert.equal(hasDangerous(AUTHENTICATED), false, 'gefährliche Aktion in AUTHENTICATED_ACTIONS');
});

test('Guardrail ist nicht vakuum: erkennt eine injizierte gefährliche Aktion', () => {
  // Selbstprüfung — beweist, dass die Invariante echte Eskalation fangen würde.
  assert.equal(hasDangerous(['plugin::users-permissions.user.update']), true);
  assert.equal(hasDangerous(['api::program.program.find']), false);
});

test('D-06: 3 Default-Public-Permissions (connect/refresh/sendEmailConfirmation) sind NICHT im Bootstrap', () => {
  // Bewusst nicht bootstrap-verwaltet — bestätigt als akzeptierte Strapi-Defaults
  // (siehe docs/production-readiness-audit.md, D-06). Guard hält sie aus dem Code fern.
  for (const a of ['auth.connect', 'auth.refresh', 'auth.sendEmailConfirmation']) {
    assert.ok(!PUBLIC.some((p) => p.includes(a)), `${a} sollte nicht im Bootstrap-PUBLIC_ACTIONS stehen`);
  }
});
