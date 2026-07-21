// Test-first für die Betriebsskripte scripts/smoke.sh und scripts/healthcheck.sh.
// Beide werden gegen einen lokalen Mock-HTTP-Server gefahren; die zu prüfende
// „neue Skriptlogik" ist die Env-Parametrisierung (BASE/HEALTH_URL/RESTART_CMD),
// die den echten Host aus dem Test heraushält. Kein Netzzugriff nach außen,
// kein echtes systemctl. Ausführen: npm run test:scripts  (node --test scripts/tests/*.test.mjs)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { mkdtempSync, existsSync, rmSync, writeFileSync, chmodSync } from 'node:fs';
import { tmpdir } from 'node:os';

const HERE = dirname(fileURLToPath(import.meta.url));
const SMOKE = join(HERE, '..', 'smoke.sh');
const HEALTH = join(HERE, '..', 'healthcheck.sh');

// Mock-Server, der alle vom Smoke geprüften Endpunkte bedient. `broken` schaltet
// gezielt einen Endpunkt auf Fehler, um den FAIL-Pfad zu prüfen.
function startMock({ broken = null } = {}) {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const url = req.url;
      const send = (code, body, type = 'text/html') => {
        res.writeHead(code, { 'Content-Type': type });
        res.end(body);
      };
      if (url === '/_health') {
        if (broken === 'health') return send(500, 'down');
        res.writeHead(204); return res.end();
      }
      if (url === '/healrise/app/api/programs') {
        // Fachliche Entscheidung (Befund 2, 14.07.26): /api/programs ist auth-gated —
        // `api::program.program.find` steht nur in AUTHENTICATED_ACTIONS (strapi/src/index.ts),
        // die App ruft die Route ausschließlich mit Bearer-JWT auf (app/src/api/client.js).
        // Anonymer Zugriff MUSS daher 403 sein; 403 belegt „Route verdrahtet + Auth-Gate aktiv"
        // (eine fehlende Route wäre 404). `broken:'api'` simuliert ABGESENKTEN Schutz
        // (Endpoint öffentlich 200) — der Smoke muss das als Regression rot melden.
        if (broken === 'api') return send(200, JSON.stringify({ data: [{ id: 1 }] }), 'application/json');
        return send(403, JSON.stringify({ data: null, error: { status: 403, name: 'ForbiddenError' } }), 'application/json');
      }
      if (url === '/healrise/app/cms/admin') {
        // Realer P0-Ausfall B-02 (14.07.26): fehlendes strapi/dist/build/index.html
        // ⇒ Strapi liefert /admin mit ENOENT → HTTP 404 (nicht 500). Genau diese
        // Signatur muss der Smoke rot erkennen.
        if (broken === 'admin') return send(404, 'Not Found');
        // Reale Strapi-5-Shape hinter dem Subpfad-Proxy: der Admin-Pfad steckt in
        // PUBLIC_URL (…/healrise/app/cms), daher bettet Strapi die Assets als
        // ROOT-RELATIVE Pfade OHNE Host ein. Eine absolute Test-URL würde den
        // realen Bug maskieren; smoke.sh MUSS relativ gegen BASE auflösen.
        return send(200, `<!doctype html><title>strapi</title><script type="module" src="/healrise/app/cms/admin/app.js"></script>`);
      }
      if (url === '/healrise/app/cms/admin/app.js') {
        if (broken === 'asset') return send(500, 'err');
        return send(200, 'console.log(1)', 'application/javascript');
      }
      if (url === '/healrise/app/' || url === '/healrise/app/index.html') return send(200, '<h1>HEALRISE</h1>');
      if (url === '/healrise/app/sw.js') return send(200, 'self.addEventListener', 'application/javascript');
      if (url === '/healrise/' || url === '/healrise/index.html') return send(200, '<h1>HEALRISE</h1>');
      send(404, 'nope');
    });
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

function run(script, env) {
  return new Promise((resolve) => {
    execFile('bash', [script], { env: { ...process.env, ...env } }, (err, stdout, stderr) => {
      resolve({ code: err ? (err.code ?? 1) : 0, stdout, stderr });
    });
  });
}

test('smoke.sh: alle Endpunkte gesund → Exit 0', async () => {
  const server = await startMock();
  const port = server.address().port;
  try {
    const { code, stdout } = await run(SMOKE, {
      BASE: `http://127.0.0.1:${port}`,
      HEALTH_URL: `http://127.0.0.1:${port}/_health`,
    });
    assert.equal(code, 0, `smoke sollte grün sein:\n${stdout}`);
  } finally {
    server.close();
  }
});

// Spezifischer RED→GREEN-Regressionstest für den realen P0 (B-02, 14.07.26):
// Strapi bettet die Admin-Assets hinter dem PUBLIC_URL-Subpfad als root-relative
// Pfade (…/cms/admin/app.js, KEIN Host) ein. Der frühere smoke.sh lud diesen Pfad
// unverändert per curl (kein Schema/Host) → Transport-Fehler → smoke blieb ROT,
// obwohl das Admin gesund ist. smoke.sh MUSS relative Asset-URLs gegen BASE
// auflösen. Dieser Test ist RED vor dem Fix und GREEN danach.
test('smoke.sh: root-relatives Admin-Asset (reale Strapi-Shape) → Exit 0', async () => {
  const server = await startMock();
  const port = server.address().port;
  try {
    const { code, stdout } = await run(SMOKE, {
      BASE: `http://127.0.0.1:${port}`,
      HEALTH_URL: `http://127.0.0.1:${port}/_health`,
    });
    assert.equal(code, 0, `smoke muss relative Admin-Assets gegen BASE auflösen:\n${stdout}`);
  } finally {
    server.close();
  }
});

// Guard für den realen Ausfall selbst: fehlt dist/build/index.html, antwortet
// /admin mit 404 — der Smoke muss das zuverlässig rot melden (nicht als 200 durchwinken).
test('smoke.sh: reales Admin-404 (fehlendes dist/build/index.html) → Exit 1', async () => {
  const server = await startMock({ broken: 'admin' });
  const port = server.address().port;
  try {
    const { code } = await run(SMOKE, {
      BASE: `http://127.0.0.1:${port}`,
      HEALTH_URL: `http://127.0.0.1:${port}/_health`,
    });
    assert.equal(code, 1, 'fehlendes Admin-Build (404) muss den Smoke rot machen');
  } finally {
    server.close();
  }
});

for (const broken of ['api', 'admin', 'asset', 'health']) {
  test(`smoke.sh: defekter Endpunkt (${broken}) → Exit 1`, async () => {
    const server = await startMock({ broken });
    const port = server.address().port;
    try {
      const { code } = await run(SMOKE, {
        BASE: `http://127.0.0.1:${port}`,
        HEALTH_URL: `http://127.0.0.1:${port}/_health`,
      });
      assert.equal(code, 1, `smoke sollte bei defektem ${broken} fehlschlagen`);
    } finally {
      server.close();
    }
  });
}

// Schreibt einen Test-Restart-Hook, der NUR eine Marker-Datei anlegt (kein echtes
// systemctl). healthcheck.sh ruft ihn als Executable auf: `"$RESTART_HOOK" "$HEALRISE_UNIT"`.
// So bleibt der reale Dienst im Test unangetastet und das argv-Interface wird geprüft.
function writeHook(dir, marker) {
  const hook = join(dir, 'restart-hook.sh');
  writeFileSync(hook, `#!/usr/bin/env bash\ntouch ${JSON.stringify(marker)}\n`);
  chmodSync(hook, 0o755);
  return hook;
}

test('healthcheck.sh: gesund → Exit 0, kein Restart', async () => {
  const server = await startMock();
  const port = server.address().port;
  const dir = mkdtempSync(join(tmpdir(), 'hc-'));
  const marker = join(dir, 'restarted');
  try {
    const { code } = await run(HEALTH, {
      HEALTH_URL: `http://127.0.0.1:${port}/_health`,
      // Safety-Netz: falls der alte eval-Pfad noch aktiv wäre, würde er nur `true`
      // ausführen — nie ein echtes systemctl gegen den Prod-Dienst.
      RESTART_CMD: 'true',
      RESTART_HOOK: writeHook(dir, marker),
      HEALRISE_UNIT: 'healrise-strapi.service',
    });
    assert.equal(code, 0);
    assert.equal(existsSync(marker), false, 'kein Restart bei gesundem Dienst');
  } finally {
    server.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

test('healthcheck.sh: krank → Restart-Hook (argv) ausgeführt', async () => {
  const server = await startMock({ broken: 'health' });
  const port = server.address().port;
  const dir = mkdtempSync(join(tmpdir(), 'hc-'));
  const marker = join(dir, 'restarted');
  try {
    const { code } = await run(HEALTH, {
      HEALTH_URL: `http://127.0.0.1:${port}/_health`,
      RESTART_CMD: 'true', // Safety-Netz gegen alten eval-Default (echtes systemctl)
      RESTART_HOOK: writeHook(dir, marker),
      HEALRISE_UNIT: 'healrise-strapi.service',
    });
    assert.equal(code, 0, 'healthcheck endet nach erfolgreichem Restart mit 0');
    assert.equal(existsSync(marker), true, 'Restart-Hook muss laufen');
  } finally {
    server.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

// Regression (Security B-07): das Restart-Ziel darf NIE als Shell interpretiert
// werden. Der alte `eval "$RESTART_CMD"` würde eine angehängte Payload ausführen;
// das argv-Interface (RESTART_HOOK/HEALRISE_UNIT) darf das nicht.
test('healthcheck.sh: kein eval — injizierte Payload im Restart-Ziel läuft NICHT', async () => {
  const server = await startMock({ broken: 'health' });
  const port = server.address().port;
  const dir = mkdtempSync(join(tmpdir(), 'hc-'));
  const injected = join(dir, 'INJECTED');
  const benign = join(dir, 'restarted');
  try {
    const { code } = await run(HEALTH, {
      HEALTH_URL: `http://127.0.0.1:${port}/_health`,
      // Payload, die NUR ein eval ausführen würde (führendes `true` hält den
      // alten Default-Pfad vom echten systemctl fern):
      RESTART_CMD: `true; touch ${injected}`,
      // Neues, injektionsresistentes Interface: das Ziel wird als argv übergeben.
      RESTART_HOOK: writeHook(dir, benign),
      HEALRISE_UNIT: 'healrise-strapi.service',
    });
    assert.equal(code, 0, 'healthcheck endet nach Restart mit 0');
    assert.equal(existsSync(injected), false, 'injizierte Payload darf NICHT ausgeführt werden (kein eval)');
  } finally {
    server.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
