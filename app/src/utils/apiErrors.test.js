import { describe, it, expect } from 'vitest';
import { toGermanError } from './apiErrors';

const apiErr = (message, details) => ({
  response: { data: { error: { message, details } } },
});

describe('toGermanError (Review F34)', () => {
  it('übersetzt bekannte Strapi-Meldungen', () => {
    expect(toGermanError(apiErr('Invalid identifier or password')))
      .toBe('E-Mail oder Passwort ist falsch.');
    expect(toGermanError(apiErr('Email or Username are already taken')))
      .toBe('E-Mail oder Benutzername ist bereits vergeben.');
    expect(toGermanError(apiErr('The provided current password is invalid')))
      .toBe('Das aktuelle Passwort ist falsch.');
  });

  it('nutzt details.errors, wenn message generisch ist', () => {
    const err = apiErr('ValidationError', { errors: [{ message: 'password must be at least 6 characters' }] });
    expect(toGermanError(err)).toBe('Das Passwort ist zu kurz.');
  });

  it('reicht bereits deutsche Meldungen durch', () => {
    expect(toGermanError(apiErr('Dieser Benutzername ist bereits vergeben.')))
      .toBe('Dieser Benutzername ist bereits vergeben.');
  });

  it('Netzwerkfehler → Verbindungshinweis', () => {
    expect(toGermanError(new Error('Network Error'))).toMatch(/Verbindung/);
  });

  it('unbekannte Meldung → Fallback', () => {
    expect(toGermanError(apiErr('Some unknown error'), 'Fallback!')).toBe('Fallback!');
  });
});
