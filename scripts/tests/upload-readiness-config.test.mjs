// D-04: Upload-Plugin-Readiness. Das Strapi-Upload-Plugin muss ein explizites,
// gebundenes sizeLimit haben (env-gesteuert, sicherer Default), damit Uploads
// nicht effektiv unbeschränkt sind. Zusätzlich darf die Doku kein externes
// Object-Storage/CDN als aktiv behaupten, ohne Provider/Config. Rein statisch/
// unit, kein Netz/DB, keine Secrets. Ausführen: npm run test:scripts
import { test } from 'node:test';
import assert from 'node:assert/strict';

import pluginsConfig from '../../strapi/config/plugins.ts';
import { validateUploadConfig } from '../../strapi/src/upload-config.ts';

function makeEnv(vars = {}) {
  const env = (key, def) => (key in vars ? vars[key] : def);
  env.int = (key, def) => (key in vars ? parseInt(vars[key], 10) : def);
  env.bool = (key, def) => (key in vars ? vars[key] === true || vars[key] === 'true' : def);
  return env;
}

const DEFAULT = 5 * 1024 * 1024;

// ── plugins.ts: Upload hat ein env-gesteuertes, gebundenes sizeLimit ──
test('plugins.ts: upload.config.sizeLimit kommt aus Env mit sicherem Default', () => {
  const cfg = pluginsConfig({ env: makeEnv({}) });
  assert.ok(cfg.upload?.config, 'upload-Plugin-Konfiguration fehlt (D-04)');
  assert.equal(cfg.upload.config.sizeLimit, DEFAULT);
  const overridden = pluginsConfig({ env: makeEnv({ UPLOAD_SIZE_LIMIT_BYTES: '1048576' }) });
  assert.equal(overridden.upload.config.sizeLimit, 1048576);
});

test('plugins.ts: bestehende users-permissions- und email-Konfiguration bleibt erhalten', () => {
  const cfg = pluginsConfig({ env: makeEnv({ JWT_SECRET: 'x' }) });
  assert.equal(cfg['users-permissions'].config.jwtSecret, 'x');
  assert.equal(cfg.email.config.provider, 'nodemailer');
});

// ── validateUploadConfig ──
test('Default (unset) ist ready mit Warnung, gebundenes sizeLimit', () => {
  const r = validateUploadConfig(makeEnv({}));
  assert.equal(r.ready, true);
  assert.equal(r.sizeLimit, DEFAULT);
  assert.ok(r.warnings.some((w) => w.includes('UPLOAD_SIZE_LIMIT_BYTES')));
});

test('ungültiges/negatives sizeLimit ist ein Blocker', () => {
  assert.equal(validateUploadConfig(makeEnv({ UPLOAD_SIZE_LIMIT_BYTES: 'abc' })).ready, false);
  assert.equal(validateUploadConfig(makeEnv({ UPLOAD_SIZE_LIMIT_BYTES: '0' })).ready, false);
});

test('über sicherem Maximum (unbounded-Risiko) ist ein Blocker', () => {
  const huge = String(200 * 1024 * 1024);
  const r = validateUploadConfig(makeEnv({ UPLOAD_SIZE_LIMIT_BYTES: huge }));
  assert.equal(r.ready, false);
  assert.ok(r.blockers.some((b) => b.includes('UPLOAD_SIZE_LIMIT_BYTES')));
});

test('externer Provider ohne Object-Storage-Config ist ein Blocker', () => {
  const r = validateUploadConfig(makeEnv({ UPLOAD_PROVIDER: 'aws-s3' }));
  assert.equal(r.ready, false);
  assert.ok(r.blockers.some((b) => /UPLOAD_PROVIDER|Object-Storage/i.test(b)));
});

test('Doku behauptet Object-Storage, aber Provider=local → Blocker', () => {
  const r = validateUploadConfig(makeEnv({}), { docsClaimObjectStorage: true });
  assert.equal(r.ready, false);
  assert.ok(r.blockers.some((b) => /Object-Storage|CDN/i.test(b)));
});

test('GUARDRAIL: keine Secret-Werte im Output', () => {
  const r = validateUploadConfig(makeEnv({ UPLOAD_PROVIDER: 'aws-s3', UPLOAD_SECRET_ACCESS_KEY: 'leak-me-123' }));
  const blob = [...r.blockers, ...r.warnings].join('\n');
  assert.ok(!blob.includes('leak-me-123'), 'Secret geleakt');
});
