/**
 * Live-CMS-Claims-Check (Roadmap 0.6 / Audit R-03).
 *
 * Prüft die SICHTBAREN Texte der veröffentlichten Programme gegen die ❌-Liste
 * aus docs/claims-richtlinie.md. Ein einziger Therapie-/OP-/Symptom-Claim kann
 * die App zum Medizinprodukt machen (MDR) — deshalb hart, mit Exit-Code.
 *
 *   node scripts/claims-check.mjs        # dumpt Live-DB (published) und prüft
 *
 * Datenquelle: die published-Zeilen der Tabelle `programs` direkt aus Postgres.
 * Das ist die autoritative Fassung des öffentlichen Contents — die REST-API
 * strippt `body` für höhere Pläne und verlangt Auth, würde also premium-Bodies
 * verbergen. Rein lesend (SELECT), keine Schreib-/Löschoperation.
 *
 * Die Detektor-Logik `findClaimViolations` ist rein und wird per node --test
 * gegen Fixtures geprüft (scripts/tests/claims-check.test.mjs, via `npm run test:scripts`).
 */

// Nur SICHTBARE Felder werden gescannt. Interne Keys/Slugs (z. B.
// category=narbenpflege, dessen sichtbares Label „Hautpflege" ist) bleiben außen vor.
export const VISIBLE_FIELDS = ['title', 'description', 'body'];

// ❌-Liste (Kern-Set aus docs/claims-richtlinie.md, gespiegelt aus dem
// Landing-Claim-Guard app/src/test/landing.test.js). Fokus: Heil-/Therapie-,
// Symptom- und OP-/Recovery-Formulierungen — die für CMS-Content relevanten.
export const BANNED = [
  [/Heilung/i, 'Heilversprechen'],
  [/\bheilt\b/i, 'Heilversprechen'],
  [/lindert/i, 'Therapie-Claim'],
  [/therapier/i, 'Therapie-Claim'],
  [/Therapie/i, 'Therapie-Claim'],
  [/behandel/i, 'Therapie-Claim'],
  [/\bOP\b/, 'medizinischer Kontext (OP)'],
  [/Post-OP/i, 'medizinischer Kontext'],
  [/\bOperation/i, 'medizinischer Kontext'], // Wortgrenze: „Kooperation" bleibt erlaubt
  [/\bRecovery\b/i, 'medizinischer Kontext (Recovery)'],
  [/Genesung/i, 'medizinischer Kontext'],
  [/Symptom/i, 'Krankheits-/Symptombezug'],
  [/Schmerz/i, 'Krankheits-/Symptombezug'],
  [/Arthrose/i, 'Krankheits-/Symptombezug'],
  [/Verspannung/i, 'Krankheits-/Symptombezug'],
  [/medizinisch wirksam/i, 'medizinischer Claim'],
  [/Narbe/i, 'Wund-/Narbenbezug — sichtbares Label ist „Hautpflege"'],
];

import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

// Verzeichnis dieses Skripts — stabil, egal aus welchem cwd gestartet wird.
const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
// strapi/ ist die einzige Stelle mit `pg` in node_modules (kein Root-Dep).
const STRAPI_DIR = resolve(SCRIPT_DIR, '..', 'strapi');

/**
 * Lädt den `pg`-Treiber portabel: an strapi/ verankert, damit
 * `node scripts/claims-check.mjs` aus dem Repo-Root nicht mit
 * ERR_MODULE_NOT_FOUND scheitert (pg liegt nur in strapi/node_modules).
 * @returns {{ Client: new (cfg: any) => any }}
 */
export function loadPg() {
  const require = createRequire(resolve(STRAPI_DIR, 'package.json'));
  return require('pg');
}

/**
 * @param {Array<Record<string, any>>} programs  Programm-Datensätze (published)
 * @returns {Array<{slug:string, field:string, match:string, why:string}>}
 */
export function findClaimViolations(programs) {
  const out = [];
  for (const p of programs ?? []) {
    for (const field of VISIBLE_FIELDS) {
      const val = p?.[field];
      if (typeof val !== 'string' || !val) continue;
      for (const [re, why] of BANNED) {
        const m = val.match(re);
        if (m) out.push({ slug: p.slug ?? '(ohne slug)', field, match: m[0], why });
      }
    }
  }
  return out;
}

// ── CLI: nur ausführen, wenn direkt gestartet (nicht beim Test-Import) ───────
import { pathToFileURL } from 'node:url';
if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const { readFileSync } = await import('node:fs');
  const pg = loadPg();

  for (const line of readFileSync(resolve(STRAPI_DIR, '.env'), 'utf8').split('\n')) {
    const m = line.match(/^(DATABASE_[A-Z_]+)=(.*)$/);
    if (m) process.env[m[1]] ??= m[2].replace(/^['"]|['"]$/g, '');
  }

  const client = new pg.Client({
    host: process.env.DATABASE_HOST,
    port: Number(process.env.DATABASE_PORT),
    user: process.env.DATABASE_USERNAME,
    password: process.env.DATABASE_PASSWORD,
    database: process.env.DATABASE_NAME,
  });
  await client.connect();
  const { rows } = await client.query(
    'SELECT slug, title, description, body FROM programs WHERE published_at IS NOT NULL ORDER BY slug',
  );
  await client.end();

  const violations = findClaimViolations(rows);
  console.log(`Live-CMS-Claims-Check: ${rows.length} published Programme geprüft.`);
  if (violations.length === 0) {
    console.log('0 Treffer gegen die ❌-Liste (docs/claims-richtlinie.md). ✅');
    process.exit(0);
  }
  console.error(`${violations.length} Treffer:`);
  for (const v of violations) {
    console.error(`  ✗ ${v.slug} [${v.field}]: „${v.match}" — ${v.why}`);
  }
  process.exit(1);
}
