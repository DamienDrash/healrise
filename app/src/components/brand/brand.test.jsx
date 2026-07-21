import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import HealriseMark from './HealriseMark';
import HealriseLogo from './HealriseLogo';
import Botanical from './Botanical';

describe('HealriseMark (Bildmarke)', () => {
  it('ist standardmäßig dekorativ (aria-hidden)', () => {
    const { container } = render(<HealriseMark />);
    const svg = container.querySelector('svg');
    expect(svg).toHaveAttribute('aria-hidden', 'true');
    expect(svg).not.toHaveAttribute('role');
  });

  it('ist als eigenständiges Bild zugänglich (decorative=false)', () => {
    render(<HealriseMark decorative={false} />);
    expect(screen.getByRole('img', { name: 'HEALRISE' })).toBeInTheDocument();
  });

  it('respektiert die size-Prop', () => {
    const { container } = render(<HealriseMark size={72} />);
    const svg = container.querySelector('svg');
    expect(svg).toHaveAttribute('width', '72');
    expect(svg).toHaveAttribute('height', '72');
  });

  it('framed-Variante zeichnet die Ivory-Kachel, plain nicht', () => {
    const framed = render(<HealriseMark variant="framed" />).container;
    const plain = render(<HealriseMark variant="plain" />).container;
    expect(framed.querySelectorAll('rect').length).toBeGreaterThan(0);
    expect(plain.querySelectorAll('rect').length).toBe(0);
  });

  it('mehrere Instanzen kollidieren nicht (eindeutige Gradient-IDs)', () => {
    const { container } = render(
      <>
        <HealriseMark />
        <HealriseMark />
      </>,
    );
    const ids = [...container.querySelectorAll('linearGradient')].map(g => g.id);
    expect(ids.length).toBe(4); // 2 Instanzen × (Copper + Petal)
    expect(new Set(ids).size).toBe(4);
  });
});

describe('HealriseLogo (Wort-Bild-Marke)', () => {
  it('Wortmarke ist echter Text (Screenreader-lesbar)', () => {
    render(<HealriseLogo />);
    expect(screen.getByText('HEALRISE')).toBeInTheDocument();
  });

  it('full-Variante zeigt die Tagline', () => {
    render(<HealriseLogo variant="full" />);
    expect(screen.getByText('Support · Renew · Rise')).toBeInTheDocument();
  });

  it('horizontal-Variante zeigt standardmäßig keine Tagline', () => {
    render(<HealriseLogo variant="horizontal" />);
    expect(screen.queryByText('Support · Renew · Rise')).not.toBeInTheDocument();
  });
});

describe('Botanical (dekorative Botanik)', () => {
  it.each(['sprig', 'spray'])('%s-Variante ist aria-hidden', (variant) => {
    const { container } = render(<Botanical variant={variant} />);
    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
  });

  it('färbt über currentColor (Aufrufer steuert via color)', () => {
    const { container } = render(<Botanical variant="spray" />);
    expect(container.innerHTML).toContain('currentColor');
  });
});

/**
 * CI-Konsistenz-Guard: Farbwerte der Alt-CI (Gold/Braun-Palette, Sonnen-Motiv)
 * dürfen in Quellcode & Konfiguration nicht mehr auftauchen. Neue Farben gehören
 * als Token in index.css (siehe docs/branding.md).
 */
describe('CI-Konsistenz (keine Alt-Palette)', () => {
  const BANNED = [
    /#A9896D/i, /#8a6f55/i, /#c9ab8a/i, /#2c2218/i, /#eae8e5/i,
    /#9a8778/i, /#6b5a4a/i, /#CF8A72/i, /#EDBEAC/i, /#c0392b/i, /#27ae60/i,
    /rgba\(\s*169\s*,\s*137\s*,\s*109/, /rgba\(\s*44\s*,\s*34\s*,\s*24/,
    /rgba\(\s*138\s*,\s*111\s*,\s*85/, /rgba\(\s*192\s*,\s*57\s*,\s*43/,
    /rgba\(\s*39\s*,\s*174\s*,\s*96/,
  ];
  const APP_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

  function collect(dir, out = []) {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name);
      if (statSync(p).isDirectory()) collect(p, out);
      // Guard-Tests enthalten die verbotenen Werte selbst → ausnehmen
      else if (/\.(jsx?|css)$/.test(name) && !['brand.test.jsx', 'landing.test.js'].includes(name)) out.push(p);
    }
    return out;
  }

  const files = [
    ...collect(join(APP_ROOT, 'src')),
    join(APP_ROOT, 'index.html'),
    join(APP_ROOT, 'vite.config.js'),
  ];

  it.each(files.map(f => [f.slice(APP_ROOT.length + 1)]))('%s ist frei von Alt-Farben', (rel) => {
    const content = readFileSync(join(APP_ROOT, rel), 'utf8');
    const hits = BANNED.filter(re => re.test(content));
    expect(hits, `Alt-CI-Farbe gefunden: ${hits.join(', ')}`).toEqual([]);
  });
});
