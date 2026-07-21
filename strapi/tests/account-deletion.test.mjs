/**
 * Unit-Tests für die Konto-Löschlogik (P1.2, Finding R-02).
 *   node --test strapi/tests/account-deletion.test.mjs
 *
 * Reine Orchestrierungslogik ohne laufendes Strapi: `deleteAccount(strapi, userId)`
 * bekommt ein Mock-`strapi` und wird auf Reihenfolge, Entkopplung statt Löschung
 * der aufbewahrungspflichtigen Käufe und Transaktions-Klammer geprüft.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { deleteAccount, makeDeleteMeController } from '../src/extensions/users-permissions/account-deletion.ts';

/**
 * Baut ein Mock-strapi, das jeden DB-Aufruf mit Reihenfolge protokolliert und
 * die Strapi-5-Transaktionssemantik nachbildet: der Callback läuft in einer
 * Klammer, ein Fehler löst Rollback aus und wird weitergeworfen (kein Commit).
 * `failOn: { uid, op }` injiziert einen Fehler in genau diesen DB-Schritt.
 */
function makeStrapi(opts = {}) {
  const { failOn } = opts;
  const calls = [];
  const rec = (uid, op) => async (args) => {
    calls.push({ uid, op, args });
    if (failOn && failOn.uid === uid && failOn.op === op) {
      throw new Error(`injected failure: ${uid}.${op}`);
    }
  };
  const query = (uid) => ({
    deleteMany: rec(uid, 'deleteMany'),
    updateMany: rec(uid, 'updateMany'),
    delete: rec(uid, 'delete'),
    create: rec(uid, 'create'),
  });
  const strapi = {
    calls,
    db: {
      query,
      transaction: async (cb) => {
        calls.push({ op: 'transaction:begin' });
        try {
          const r = await cb({ trx: {} });
          calls.push({ op: 'transaction:commit' });
          calls.push({ op: 'transaction:end' });
          return r;
        } catch (e) {
          calls.push({ op: 'transaction:rollback' });
          throw e; // wie Strapi 5: Rollback, dann Fehler weiterwerfen
        }
      },
    },
  };
  return strapi;
}

/** Minimaler Koa-artiger ctx-Mock ohne Prod-Daten. */
function makeCtx({ user } = {}) {
  return {
    state: { user },
    status: undefined,
    body: undefined,
    _unauthorized: false,
    unauthorized() { this._unauthorized = true; this.status = 401; },
  };
}

const PROGRESS = 'api::progress.progress-entry';
const PURCHASE = 'api::purchase.purchase';
const USER = 'plugin::users-permissions.user';

test('ohne userId wird abgebrochen (kein DB-Zugriff)', async () => {
  const strapi = makeStrapi();
  await assert.rejects(() => deleteAccount(strapi, undefined));
  assert.equal(strapi.calls.length, 0, 'kein DB-Aufruf ohne userId');
});

test('eigene Fortschrittsdaten werden vollständig gelöscht', async () => {
  const strapi = makeStrapi();
  await deleteAccount(strapi, 42);
  const del = strapi.calls.find((c) => c.uid === PROGRESS && c.op === 'deleteMany');
  assert.ok(del, 'progress deleteMany aufgerufen');
  assert.deepEqual(del.args, { where: { user: 42 } });
});

test('Käufe werden entkoppelt (user → null), NICHT gelöscht (Aufbewahrungspflicht)', async () => {
  const strapi = makeStrapi();
  await deleteAccount(strapi, 42);
  const upd = strapi.calls.find((c) => c.uid === PURCHASE && c.op === 'updateMany');
  assert.ok(upd, 'purchase updateMany aufgerufen');
  assert.deepEqual(upd.args, { where: { user: 42 }, data: { user: null } });
  // Niemals löschen: kein delete/deleteMany auf Käufen.
  assert.ok(!strapi.calls.some((c) => c.uid === PURCHASE && (c.op === 'delete' || c.op === 'deleteMany')),
    'keine Löschung aufbewahrungspflichtiger Käufe');
});

test('der User selbst wird zuletzt gelöscht', async () => {
  const strapi = makeStrapi();
  await deleteAccount(strapi, 42);
  const del = strapi.calls.find((c) => c.uid === USER && c.op === 'delete');
  assert.ok(del, 'user delete aufgerufen');
  assert.deepEqual(del.args, { where: { id: 42 } });
});

test('Reihenfolge: Progress löschen + Käufe entkoppeln vor User-Löschung', async () => {
  const strapi = makeStrapi();
  await deleteAccount(strapi, 42);
  const idx = (uid, op) => strapi.calls.findIndex((c) => c.uid === uid && c.op === op);
  const userDel = idx(USER, 'delete');
  assert.ok(idx(PROGRESS, 'deleteMany') < userDel, 'Progress vor User');
  assert.ok(idx(PURCHASE, 'updateMany') < userDel, 'Käufe entkoppeln vor User');
});

test('alles läuft atomar in einer Transaktion', async () => {
  const strapi = makeStrapi();
  await deleteAccount(strapi, 42);
  const begin = strapi.calls.findIndex((c) => c.op === 'transaction:begin');
  const end = strapi.calls.findIndex((c) => c.op === 'transaction:end');
  assert.ok(begin === 0, 'Transaktion umschließt die Operationen (Beginn zuerst)');
  const userDel = strapi.calls.findIndex((c) => c.uid === USER && c.op === 'delete');
  assert.ok(begin < userDel && userDel < end, 'User-Löschung innerhalb der Transaktion');
});

// ── Controller-/HTTP-Vertrag (P1.2 AC): DELETE /api/users/me ────────────────

test('Controller: erfolgreiche Löschung → HTTP 204 mit leerem Body', async () => {
  const strapi = makeStrapi();
  const handler = makeDeleteMeController(strapi);
  const ctx = makeCtx({ user: { id: 42 } });

  await handler(ctx);

  assert.equal(ctx.status, 204, 'Status 204 No Content');
  assert.ok(ctx.body == null, 'leerer Body');
  // Nebenwirkung tatsächlich ausgeführt (User gelöscht).
  assert.ok(strapi.calls.some((c) => c.uid === USER && c.op === 'delete'), 'User wurde gelöscht');
});

test('Controller: ohne Authentifizierung → unauthorized(), keine Löschung, kein 204', async () => {
  const strapi = makeStrapi();
  const handler = makeDeleteMeController(strapi);
  const ctx = makeCtx({ user: undefined });

  await handler(ctx);

  assert.equal(ctx._unauthorized, true, 'ctx.unauthorized() aufgerufen (401/403)');
  assert.notEqual(ctx.status, 204, 'kein 204 ohne Auth');
  assert.equal(strapi.calls.length, 0, 'kein DB-Zugriff ohne Auth');
});

test('Controller: Fehler in abhängigem DB-Schritt → propagiert, kein Folgeschritt, Rollback, kein 204', async () => {
  // Injektion: das Entkoppeln der Käufe schlägt fehl (Schritt 2 von 3).
  const strapi = makeStrapi({ failOn: { uid: PURCHASE, op: 'updateMany' } });
  const handler = makeDeleteMeController(strapi);
  const ctx = makeCtx({ user: { id: 42 } });

  await assert.rejects(() => handler(ctx), /injected failure/, 'Fehler propagiert (non-2xx)');
  assert.notEqual(ctx.status, 204, 'kein 204 bei Fehler');
  assert.ok(!strapi.calls.some((c) => c.uid === USER && c.op === 'delete'), 'Folgeschritt (User-Löschung) NICHT ausgeführt');
  assert.ok(strapi.calls.some((c) => c.op === 'transaction:rollback'), 'Transaktion zurückgerollt');
  assert.ok(!strapi.calls.some((c) => c.op === 'transaction:commit'), 'kein Commit bei Fehler');
});
