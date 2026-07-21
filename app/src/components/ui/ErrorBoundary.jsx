import { Component } from 'react';

/**
 * Release-Resilienz: fängt Render-/Lifecycle-Fehler im Komponentenbaum, damit
 * ein einzelner Fehler nicht die ganze App auf einen weißen Bildschirm wirft.
 * Zeigt stattdessen eine freundliche deutsche Fallback-UI mit Wiederherstellung.
 *
 * - `onError(error, info)`: optionaler Logging-Hook (Default: console.error,
 *   ohne PII/Secrets — nur die technische Fehlermeldung).
 * - `onReset()`: optionale Wiederherstellungs-Aktion (Default: window.location
 *   .reload()). Als Prop injizierbar, damit Tests ohne echten Reload laufen.
 *
 * Bewusst als Klassenkomponente — nur so greifen getDerivedStateFromError /
 * componentDidCatch (React hat dafür (noch) keinen Hook).
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
    this.handleReset = this.handleReset.bind(this);
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    if (this.props.onError) {
      this.props.onError(error, info);
    } else {
      // Kein PII/Secret-Logging — nur die technische Meldung.
      console.error('HEALRISE UI-Fehler:', error);
    }
  }

  handleReset() {
    if (this.props.onReset) {
      this.props.onReset();
    } else if (typeof window !== 'undefined' && window.location) {
      window.location.reload();
    }
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div
        role="alert"
        style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '1rem',
          padding: '2rem 1.25rem',
          textAlign: 'center',
          background: 'var(--cream, #f6f3ef)',
          color: 'var(--text, #1e2321)',
          fontFamily: "'Poppins',sans-serif",
        }}
      >
        <h1 style={{ fontSize: '1.4rem', margin: 0 }}>Es ist ein Fehler aufgetreten</h1>
        <p style={{ maxWidth: '32rem', fontSize: '0.9rem', lineHeight: 1.5, opacity: 0.85 }}>
          Die App ist auf ein unerwartetes Problem gestoßen. Bitte lade die Seite neu — deine
          Daten sind sicher gespeichert.
        </p>
        <button
          onClick={this.handleReset}
          style={{
            fontFamily: "'Poppins',sans-serif",
            fontWeight: 600,
            fontSize: '0.8rem',
            padding: '0.6rem 1.4rem',
            background: 'var(--gold, #b8935f)',
            color: '#fff',
            border: 'none',
            borderRadius: '10px',
            cursor: 'pointer',
          }}
        >
          Seite neu laden
        </button>
        <p style={{ fontSize: '0.78rem', opacity: 0.7 }}>
          Besteht das Problem weiter, erreichst du uns über das{' '}
          <a href="/healrise/app/impressum" style={{ color: 'var(--gold, #b8935f)' }}>
            Impressum
          </a>
          .
        </p>
      </div>
    );
  }
}
