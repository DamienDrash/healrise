import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Landing-Page (landing/ → dist/, ausgeliefert unter /healrise/):
 * Smoke-Tests + Claim-Guard nach docs/claims-richtlinie.md.
 * Ein einziger Therapie-/OP-Claim kann die App zum Medizinprodukt machen (MDR),
 * daher wird die Landing-Quelle hart gegen die ❌-Liste geprüft.
 */
const LANDING = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'landing');
const html = readFileSync(join(LANDING, 'index.html'), 'utf8');
const css = readFileSync(join(LANDING, 'styles.css'), 'utf8');
const js = readFileSync(join(LANDING, 'landing.js'), 'utf8');

describe('Landing-Smoke: Grundgerüst', () => {
  it('ist deutschsprachig und trägt den Markennamen', () => {
    expect(html).toContain('<html lang="de">');
    expect(html).toContain('<title>HEALRISE');
    expect(html).toContain('Support · Renew · Rise');
  });

  it('enthält alle Kernsektionen', () => {
    for (const anchor of ['id="top"', 'class="trust"', 'id="so-funktionierts"', 'id="programme"', 'class="app-promo', 'id="ueber-uns"', 'id="faq"', 'id="newsletter"', '<footer']) {
      expect(html, `Sektion fehlt: ${anchor}`).toContain(anchor);
    }
  });

  it('verlinkt App und Rechtsseiten korrekt', () => {
    expect(html).toContain('href="/healrise/app/"');
    for (const legal of ['impressum', 'datenschutz', 'agb', 'widerruf']) {
      expect(html, `Rechtslink fehlt: ${legal}`).toContain(`href="/healrise/app/${legal}"`);
    }
  });

  it('zeigt die vier Programme mit Preisen (Parität zur App)', () => {
    for (const name of ['Freebie', 'HEALRISE 7', 'HEALRISE 14', 'HEALRISE Premium']) {
      expect(html).toContain(name);
    }
    for (const price of ['<sup>€</sup>0', '<sup>€</sup>69', '<sup>€</sup>169', '<sup>€</sup>399']) {
      expect(html).toContain(price);
    }
  });

  it('lädt keine externen Ressourcen (self-hosted only)', () => {
    for (const [label, content] of [['index.html', html], ['styles.css', css], ['landing.js', js]]) {
      // XML-Namespace-URIs (w3.org) sind Bezeichner, keine Netz-Requests
      const external = content.replace(/https?:\/\/www\.w3\.org\S*/g, '');
      expect(external, `externe URL in ${label}`).not.toMatch(/https?:\/\//);
    }
  });

  it('referenzierte lokale Assets existieren', () => {
    for (const asset of ['fonts/fonts.css', 'assets/favicon.svg', 'styles.css', 'landing.js']) {
      expect(existsSync(join(LANDING, asset)), `Asset fehlt: ${asset}`).toBe(true);
    }
  });

  it('Barrierearm: Skip-Link, Landmark-Labels, beschriftete Formularfelder', () => {
    expect(html).toContain('class="skip-link"');
    expect(html).toContain('aria-label="Hauptnavigation"');
    expect(html).toMatch(/<label[^>]*for="nl-email"/);
    expect(css).toContain(':focus-visible');
    expect(css).toContain('prefers-reduced-motion');
  });

  it('trägt den Wellness-Disclaimer (ersetzt keine ärztliche Beratung)', () => {
    expect(html).toContain('ersetzt keine ärztliche Beratung');
  });
});

describe('Landing-Claim-Guard (docs/claims-richtlinie.md, ❌-Liste)', () => {
  const BANNED = [
    [/Heilung/i, 'Heilversprechen'],
    [/\bheilt\b/i, 'Heilversprechen'],
    [/lindert/i, 'Therapie-Claim'],
    [/therapier/i, 'Therapie-Claim'],
    [/Therapie/i, 'Therapie-Claim'],
    [/\bOP\b/, 'medizinischer Kontext (OP)'],
    [/Post-OP/i, 'medizinischer Kontext'],
    [/\bOperation/i, 'medizinischer Kontext'], // Wortgrenze: „Kooperation" bleibt erlaubt
    [/\bRecovery\b/i, 'medizinischer Kontext (Recovery)'],
    [/Genesung/i, 'medizinischer Kontext'],
    [/Symptom/i, 'Krankheits-/Symptombezug'],
    [/Schmerz/i, 'Krankheits-/Symptombezug'],
    [/medizinisch/i, 'medizinischer Claim'],
    [/DSGVO/i, 'Datenschutz-Garantie (nicht bewerben)'],
    [/Experten/i, 'nicht belegbare Expertenprüfung'],
    [/App\s*Store/i, 'nicht vorhandene Store-Verfügbarkeit'],
    [/Google\s*Play/i, 'nicht vorhandene Store-Verfügbarkeit'],
    [/Play\s*Store/i, 'nicht vorhandene Store-Verfügbarkeit'],
    [/Anna Keller/i, 'erfundene Person aus dem Referenz-Mockup'],
    [/Narbe/i, 'Wund-/Narbenbezug — sichtbares Label ist „Hautpflege" (interne Keys/Slugs bleiben)'],
  ];

  it.each(BANNED.map(([re, why]) => [String(re), why, re]))('%s verboten (%s)', (_label, _why, re) => {
    for (const [file, content] of [['index.html', html], ['styles.css', css], ['landing.js', js]]) {
      const m = content.match(re);
      expect(m, `${file}: „${m?.[0]}" verstößt gegen die Claims-Richtlinie`).toBeNull();
    }
  });

  it('Alt-CI-Palette kommt nicht vor', () => {
    const OLD = [/#A9896D/i, /#8a6f55/i, /#c9ab8a/i, /#2c2218/i, /#eae8e5/i, /#9a8778/i, /#CF8A72/i, /#EDBEAC/i];
    for (const content of [html, css, js]) {
      for (const re of OLD) expect(content).not.toMatch(re);
    }
  });
});
