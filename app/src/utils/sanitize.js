import DOMPurify from 'dompurify';

/**
 * Säubert CMS-HTML vor dem Rendern (Review F1: XSS über kompromittiertes
 * CMS bzw. Redakteurs-Konto → JWT-Diebstahl). Whitelist statt Blacklist.
 */
export function sanitizeHtml(html) {
  if (!html) return '';
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [
      'p', 'br', 'strong', 'em', 'u', 's', 'a', 'ul', 'ol', 'li',
      'h1', 'h2', 'h3', 'h4', 'blockquote', 'img', 'hr',
      'table', 'thead', 'tbody', 'tr', 'th', 'td', 'figure', 'figcaption',
    ],
    ALLOWED_ATTR: ['href', 'src', 'alt', 'title', 'target', 'rel'],
    ALLOW_DATA_ATTR: false,
  });
}
