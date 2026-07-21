import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ErrorBoundary from './ErrorBoundary';

/**
 * Release-Resilienz: wirft eine Komponente zur Laufzeit, darf der Kunde KEINEN
 * weißen Bildschirm sehen. Die ErrorBoundary fängt den Fehler, zeigt eine
 * freundliche deutsche Fallback-UI mit Wiederherstellung („neu laden") und
 * kapselt den Fehler (Rest der App stürzt nicht mit ab). Kein echter Reload im
 * Test — über onReset/onError injizierbar.
 */

// Komponente, die beim Rendern wirft.
function Boom() {
  throw new Error('kaboom');
}

// React loggt gefangene Fehler zusätzlich über console.error — im Test stummschalten.
let errSpy;
beforeEach(() => {
  errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  errSpy.mockRestore();
});

describe('ErrorBoundary', () => {
  it('rendert Kinder unverändert, wenn kein Fehler auftritt', () => {
    render(
      <ErrorBoundary>
        <div>alles gut</div>
      </ErrorBoundary>,
    );
    expect(screen.getByText('alles gut')).toBeInTheDocument();
  });

  it('fängt einen Render-Fehler und zeigt die Fallback-UI statt eines Absturzes', () => {
    render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>,
    );
    // Freundliche Fallback-UI als Alert
    const alert = screen.getByRole('alert');
    expect(alert).toBeInTheDocument();
    expect(screen.getByText(/Fehler/i)).toBeInTheDocument();
    // Wiederherstellungs-Aktion vorhanden
    expect(screen.getByRole('button', { name: /neu laden/i })).toBeInTheDocument();
  });

  it('ruft onReset beim Klick auf „neu laden" (kein echter window.reload)', () => {
    const onReset = vi.fn();
    render(
      <ErrorBoundary onReset={onReset}>
        <Boom />
      </ErrorBoundary>,
    );
    fireEvent.click(screen.getByRole('button', { name: /neu laden/i }));
    expect(onReset).toHaveBeenCalledTimes(1);
  });

  it('meldet den gefangenen Fehler über onError (für Logging)', () => {
    const onError = vi.fn();
    render(
      <ErrorBoundary onError={onError}>
        <Boom />
      </ErrorBoundary>,
    );
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError.mock.calls[0][0]).toBeInstanceOf(Error);
    expect(onError.mock.calls[0][0].message).toBe('kaboom');
  });

  it('verweist auf das Impressum (Kontakt/Hilfe), router-unabhängig', () => {
    render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>,
    );
    const link = screen.getByRole('link', { name: /impressum/i });
    expect(link).toHaveAttribute('href', expect.stringContaining('/impressum'));
  });
});
