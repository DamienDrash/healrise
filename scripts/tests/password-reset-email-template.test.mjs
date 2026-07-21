// P3.1 / M-01: Guard für das Passwort-Reset-Mail-TEMPLATE (Betreff/Body/Absender).
// Strapis Default ist englischer Dummy-Text ("We heard that you lost your
// password…") mit Absender "Administration Panel <no-reply@strapi.io>". Dieser
// Slice ersetzt das Template idempotent im Plugin-Store (key 'email' →
// reset_password.options) durch ein sauberes deutsches Template mit korrekter
// M-01-Absender-Auflösung (DEFAULT_ > EMAIL_DEFAULT_ > SMTP_) und dem
// <%= URL %>?code=<%= TOKEN %>-Link, den der forgotPassword-Controller templatet.
// Rein lokal/gestubbt: KEIN Strapi-Lauf, KEIN Mailversand, keine echten Adressen.
// Ausführen: npm run test:scripts
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  buildPasswordResetEmailTemplate,
  resolveResetSender,
  applyPasswordResetEmailTemplate,
} from '../../strapi/src/password-reset-email-template.ts';

function makeEnv(vars = {}) {
  return (key, def) => (key in vars ? vars[key] : def);
}

/** Mock-Plugin-Store, der die 'email'-Settings hält und set()-Aufrufe protokolliert. */
function makeStrapi(email = undefined) {
  const state = { email };
  const sets = [];
  return {
    _state: state,
    _sets: sets,
    log: { info() {} },
    store: () => ({
      get: async ({ key }) => state[key],
      set: async ({ key, value }) => {
        state[key] = value;
        sets.push({ key, value });
      },
    }),
  };
}

test('buildPasswordResetEmailTemplate: deutsches, dummy-freies Template mit Reset-Link', () => {
  const t = buildPasswordResetEmailTemplate();
  assert.match(t.object, /HEALRISE/);
  assert.match(t.object, /[Pp]asswort/);
  // Pflicht: der vom Controller getemplatete Link-Platzhalter
  assert.match(t.message, /<%= URL %>\?code=<%= TOKEN %>/);
  // Deutsch, kein englischer Strapi-Dummy
  assert.match(t.message, /[Pp]asswort/);
  assert.doesNotMatch(t.message, /lost your password|Sorry about that|Administration Panel/i);
  // Sicherheitshinweis "war ich das nicht" gehört in eine saubere Reset-Mail
  assert.match(t.message, /ignorier|nicht war|unverändert/i);
});

test('resolveResetSender: M-01-Vorrang DEFAULT_ > EMAIL_DEFAULT_ > SMTP_', () => {
  assert.deepEqual(
    resolveResetSender(makeEnv({ DEFAULT_FROM: 'a@h.de', DEFAULT_REPLY_TO: 'r@h.de', EMAIL_DEFAULT_FROM: 'b@h.de', SMTP_FROM: 'c@h.de' })),
    { from: 'a@h.de', replyTo: 'r@h.de' },
  );
  assert.deepEqual(
    resolveResetSender(makeEnv({ EMAIL_DEFAULT_FROM: 'b@h.de', SMTP_FROM: 'c@h.de' })),
    { from: 'b@h.de', replyTo: 'b@h.de' },
  );
  assert.deepEqual(
    resolveResetSender(makeEnv({ SMTP_FROM: 'c@h.de', SMTP_REPLY_TO: 's@h.de' })),
    { from: 'c@h.de', replyTo: 's@h.de' },
  );
});

test('applyPasswordResetEmailTemplate: schreibt Template + M-01-Absender in den Store', async () => {
  const strapi = makeStrapi();
  await applyPasswordResetEmailTemplate(
    strapi,
    makeEnv({ DEFAULT_FROM: 'no-reply@healrise.de', DEFAULT_REPLY_TO: 'support@healrise.de' }),
  );
  const opts = strapi._state.email.reset_password.options;
  assert.equal(opts.from.email, 'no-reply@healrise.de');
  assert.equal(opts.response_email, 'support@healrise.de');
  assert.match(opts.object, /HEALRISE/);
  assert.match(opts.message, /<%= URL %>\?code=<%= TOKEN %>/);
  assert.doesNotMatch(opts.message, /no-reply@strapi\.io|Administration Panel/);
});

test('applyPasswordResetEmailTemplate: erhält email_confirmation + andere Keys', async () => {
  const strapi = makeStrapi({
    reset_password: { display: 'x', icon: 'sync', options: { from: { name: 'Administration Panel', email: 'no-reply@strapi.io' }, response_email: '', object: 'Reset password', message: 'lost your password' } },
    email_confirmation: { display: 'y', options: { object: 'Account confirmation', message: 'confirm <%= URL %>' } },
  });
  await applyPasswordResetEmailTemplate(strapi, makeEnv({ DEFAULT_FROM: 'no-reply@healrise.de' }));
  // email_confirmation unangetastet
  assert.deepEqual(strapi._state.email.email_confirmation.options.object, 'Account confirmation');
  // reset_password ersetzt (kein Dummy mehr)
  assert.doesNotMatch(strapi._state.email.reset_password.options.message, /lost your password/);
});

test('applyPasswordResetEmailTemplate ist idempotent: kein erneutes set bei gleichem Wert', async () => {
  const env = makeEnv({ DEFAULT_FROM: 'no-reply@healrise.de', DEFAULT_REPLY_TO: 'support@healrise.de' });
  const strapi = makeStrapi();
  await applyPasswordResetEmailTemplate(strapi, env);
  assert.equal(strapi._sets.length, 1, 'erster Lauf schreibt einmal');
  await applyPasswordResetEmailTemplate(strapi, env);
  assert.equal(strapi._sets.length, 1, 'unveränderter Wert → kein zweiter Store-Write');
});

test('GUARDRAIL: Template enthält keine Secrets/Passwörter im Klartext', () => {
  const t = buildPasswordResetEmailTemplate();
  // nur der Token-PLATZHALTER, nie ein echtes Token/Secret
  assert.doesNotMatch(t.message, /password\s*=\s*\S/i);
  assert.match(t.message, /<%= TOKEN %>/);
});
