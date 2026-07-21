import { Link } from 'react-router-dom';
import { useLegal } from '../hooks/useLegal';
import { sanitizeHtml } from '../utils/sanitize';

/**
 * Pflichtseiten (Plan E7, Goldstandard R6–R10). Öffentlich erreichbar (ohne
 * Login), max. 2 Klicks von jeder Seite. Alle [PLATZHALTER: …] müssen vor dem
 * Launch mit echten Daten gefüllt und die Texte anwaltlich geprüft werden —
 * siehe docs/launch-checklist.md. Dies ist keine Rechtsberatung.
 *
 * R-01: Die Texte kommen aus dem Strapi-Single-Type `legal` (Damien pflegt sie
 * im Admin). Ist ein Feld leer oder Strapi nicht erreichbar, greift der
 * eingebaute Platzhalter-Fallback (die JSX-Kinder von <LegalBody>).
 */

/**
 * Rendert den Strapi-gepflegten Rechtstext (sanitisiert) für `field`; solange
 * nichts geladen ist oder das Feld leer bleibt, wird der Fallback (children)
 * gezeigt. Kein Flash von leerem Inhalt: der Fallback ist sofort sichtbar.
 */
function LegalBody({ field, children }) {
  const content = useLegal();
  const html = content?.[field];
  if (html) {
    return <div dangerouslySetInnerHTML={{ __html: sanitizeHtml(html) }} />;
  }
  return children;
}

function LegalLayout({ title, children }) {
  return (
    <div style={{ minHeight: '100dvh', background: 'var(--cream)' }}>
      <div style={{ maxWidth: '680px', margin: '0 auto', padding: '2rem 1.25rem 3rem' }}>
        <Link
          to="/"
          style={{ fontFamily: "'Poppins', sans-serif", fontSize: '0.72rem', color: 'var(--text-muted)', textDecoration: 'none' }}
        >
          ← Zurück zu HEALRISE
        </Link>
        <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.5rem', fontWeight: 600, color: 'var(--text)', margin: '1.25rem 0 1.5rem' }}>
          {title}
        </h1>
        <div className="legal-body" style={{ fontFamily: "'Lora', serif", fontSize: '0.9rem', color: 'var(--text)', lineHeight: 1.75 }}>
          {children}
        </div>
        <style>{`
          .legal-body h2 { font-family: 'Playfair Display', serif; font-size: 1.1rem; margin: 1.75rem 0 0.6rem; }
          .legal-body h3 { font-family: 'Playfair Display', serif; font-size: 0.98rem; margin: 1.25rem 0 0.5rem; }
          .legal-body p { margin-bottom: 0.9rem; }
          .legal-body ul { padding-left: 1.4rem; margin-bottom: 0.9rem; }
          .legal-body li { margin-bottom: 0.35rem; }
          .legal-body .placeholder { background: rgba(178,59,46,0.08); color: var(--danger); padding: 0 0.3rem; border-radius: 4px; font-family: 'Poppins', sans-serif; font-size: 0.8rem; }
          .legal-body a { color: var(--gold); }
        `}</style>
        <p style={{ marginTop: '2.5rem', fontFamily: "'Poppins', sans-serif", fontSize: '0.62rem', color: 'var(--text-subtle)', textAlign: 'center' }}>
          <Link to="/impressum" style={{ color: 'var(--text-subtle)' }}>Impressum</Link>
          {' · '}
          <Link to="/datenschutz" style={{ color: 'var(--text-subtle)' }}>Datenschutz</Link>
          {' · '}
          <Link to="/agb" style={{ color: 'var(--text-subtle)' }}>AGB</Link>
          {' · '}
          <Link to="/widerruf" style={{ color: 'var(--text-subtle)' }}>Widerruf</Link>
        </p>
      </div>
    </div>
  );
}

const PH = ({ children }) => <span className="placeholder">[PLATZHALTER: {children}]</span>;

export function Impressum() {
  return (
    <LegalLayout title="Impressum">
      <LegalBody field="impressum">
      <h2>Angaben gemäß § 5 DDG</h2>
      <p>
        <PH>Vollständiger Name / Firma inkl. Rechtsform</PH><br />
        <PH>Straße und Hausnummer</PH><br />
        <PH>PLZ und Ort</PH>
      </p>
      <h2>Kontakt</h2>
      <p>
        E-Mail: <a href="mailto:hello@healrise.de">hello@healrise.de</a><br />
        Telefon: <PH>Telefonnummer (schneller Kontaktweg erforderlich)</PH>
      </p>
      <h2>Umsatzsteuer</h2>
      <p>
        <PH>USt-IdNr. gemäß § 27a UStG — oder Hinweis auf Kleinunternehmerregelung § 19 UStG</PH>
      </p>
      <h2>Verantwortlich für den Inhalt</h2>
      <p><PH>Name und Anschrift der inhaltlich verantwortlichen Person</PH></p>
      <h2>Streitbeilegung</h2>
      <p>
        Wir sind nicht bereit und nicht verpflichtet, an Streitbeilegungsverfahren vor einer
        Verbraucherschlichtungsstelle teilzunehmen.
      </p>
      </LegalBody>
    </LegalLayout>
  );
}

export function Datenschutz() {
  return (
    <LegalLayout title="Datenschutzerklärung">
      <LegalBody field="datenschutz">
      <p>
        Diese Datenschutzerklärung informiert dich über die Verarbeitung personenbezogener
        Daten bei der Nutzung von HEALRISE (Web-App und Website).
      </p>

      <h2>1. Verantwortlicher</h2>
      <p><PH>Name, Anschrift, E-Mail des Verantwortlichen (identisch mit Impressum)</PH></p>

      <h2>2. Welche Daten wir verarbeiten</h2>
      <h3>Konto</h3>
      <p>
        Bei der Registrierung verarbeiten wir Benutzername, E-Mail-Adresse und Passwort
        (verschlüsselt gespeichert). Rechtsgrundlage: Art. 6 Abs. 1 lit. b DSGVO (Vertragserfüllung).
      </p>
      <h3>Fortschrittsdaten (Gesundheitsdaten)</h3>
      <p>
        Wenn du das Programm-Tracking aktivierst, speichern wir, welche Programminhalte du
        wann als erledigt markiert hast. Diese Daten können Rückschlüsse auf deinen
        Gesundheitszustand zulassen und gelten daher als Gesundheitsdaten (Art. 4 Nr. 15 DSGVO).
        Wir verarbeiten sie ausschließlich auf Grundlage deiner <strong>ausdrücklichen
        Einwilligung</strong> (Art. 9 Abs. 2 lit. a DSGVO), die du bei der Registrierung oder
        später im Konto erteilst. Du kannst die Einwilligung jederzeit im Konto widerrufen —
        dabei werden alle serverseitig gespeicherten Fortschrittsdaten gelöscht.
      </p>
      <h3>Zahlungsabwicklung (Stripe)</h3>
      <p>
        Käufe werden über Stripe abgewickelt (Stripe Payments Europe, Ltd., Irland; ggf.
        Übermittlung an Stripe, Inc., USA). Dabei verarbeitet Stripe Name, E-Mail-Adresse,
        Zahlungsdaten und IP-Adresse. Rechtsgrundlagen: Art. 6 Abs. 1 lit. b DSGVO
        (Zahlungsabwicklung) und lit. f (Betrugsprävention). Die Übermittlung in die USA ist
        durch die Zertifizierung von Stripe unter dem EU-US Data Privacy Framework sowie
        Standardvertragsklauseln abgesichert. Details:{' '}
        <a href="https://stripe.com/de/privacy" target="_blank" rel="noreferrer">Stripe-Datenschutzerklärung</a>.
        Stripe wird erst beim Kaufvorgang eingebunden, nicht beim bloßen Besuch der App.
      </p>
      <h3>Hosting / Server-Logs</h3>
      <p>
        <PH>Hosting-Anbieter mit Anschrift, AVV-Hinweis (Art. 28 DSGVO), Log-Speicherdauer</PH>
      </p>

      <h2>3. Lokale Speicherung (kein Tracking, keine Cookies zu Werbezwecken)</h2>
      <p>
        HEALRISE nutzt den lokalen Speicher deines Geräts (localStorage) ausschließlich für
        technisch notwendige Zwecke: Anmelde-Token, Offline-Kopie deiner Inhalte und deines
        Fortschritts sowie App-Einstellungen (§ 25 Abs. 2 Nr. 2 TDDDG — daher kein
        Cookie-Banner). Beim Abmelden werden Fortschrittsdaten lokal gelöscht. Wir setzen
        keine Analyse-, Tracking- oder Marketing-Dienste ein.
      </p>

      <h2>4. Speicherdauer</h2>
      <p>
        Kontodaten speichern wir bis zur Löschung deines Kontos; Fortschrittsdaten bis zum
        Widerruf deiner Einwilligung oder der Kontolöschung; Kaufbelege gemäß gesetzlicher
        Aufbewahrungspflichten (§ 147 AO: 10 Jahre).
      </p>
      <p>
        Du kannst dein Konto jederzeit selbst löschen (Recht auf Löschung, Art. 17 DSGVO):
        in der App unter „Konto“ → Bereich „Gefahrenzone“ → „Konto löschen“; zur
        Bestätigung tippst du das Wort „LÖSCHEN“ ein. Dabei werden dein Nutzerkonto und
        deine Fortschrittsdaten unwiderruflich gelöscht. Deine Kaufbelege werden dabei
        von deinem Konto entkoppelt und anonymisiert weiter aufbewahrt, weil wir sie aus
        steuer- und handelsrechtlicher Aufbewahrungspflicht (§ 147 AO: 10 Jahre) nicht
        vorzeitig löschen dürfen.
      </p>

      <h2>5. Deine Rechte</h2>
      <p>
        Du hast das Recht auf Auskunft (Art. 15), Berichtigung (Art. 16), Löschung (Art. 17),
        Einschränkung (Art. 18), Datenübertragbarkeit (Art. 20) und Widerspruch (Art. 21) sowie
        das Recht, erteilte Einwilligungen jederzeit mit Wirkung für die Zukunft zu widerrufen
        (Art. 7 Abs. 3). Du kannst dich zudem bei einer Datenschutz-Aufsichtsbehörde beschweren
        (Art. 77). Kontakt: <a href="mailto:hello@healrise.de">hello@healrise.de</a>
      </p>

      <p><PH>Diese Vorlage vor Launch anwaltlich prüfen lassen bzw. mit Generator mit Haftungsübernahme abgleichen</PH></p>
      </LegalBody>
    </LegalLayout>
  );
}

export function AGB() {
  return (
    <LegalLayout title="Allgemeine Geschäftsbedingungen">
      <LegalBody field="agb">
      <h2>1. Geltungsbereich</h2>
      <p>
        Diese AGB gelten für alle Verträge zwischen <PH>Firma/Name</PH> („HEALRISE", „wir")
        und Verbraucherinnen und Verbrauchern über die Nutzung der HEALRISE-Web-App und den
        Erwerb digitaler Inhalte.
      </p>
      <h2>2. Leistungsbeschreibung</h2>
      <p>
        HEALRISE stellt digitale Wohlfühl-Programme (Guides, Übungen, Ernährungsideen,
        Mindset-Impulse) bereit. Die Inhalte dienen dem allgemeinen Wohlbefinden und ersetzen
        keine ärztliche Beratung, Diagnose oder Behandlung.
      </p>
      <h2>3. Vertragsschluss und Preise</h2>
      <p>
        Der Kauf einer Programm-Stufe erfolgt als Einmalkauf über den Button
        „Zahlungspflichtig bestellen". Alle Preise sind Gesamtpreise inkl. gesetzlicher
        Umsatzsteuer. Die Zahlungsabwicklung erfolgt über Stripe. Nach Zahlungseingang wird
        die gekaufte Stufe unmittelbar im Konto freigeschaltet.
      </p>
      <h2>4. Widerrufsrecht</h2>
      <p>
        Es gilt das gesetzliche Widerrufsrecht für Verbraucher — Details in der{' '}
        <Link to="/widerruf">Widerrufsbelehrung</Link>. Bei digitalen Inhalten erlischt das
        Widerrufsrecht, wenn du der sofortigen Bereitstellung ausdrücklich zugestimmt und
        deine Kenntnis vom Erlöschen des Widerrufsrechts bestätigt hast (§ 356 Abs. 5 BGB).
      </p>
      <h2>5. Nutzungsrechte</h2>
      <p>
        Mit dem Kauf erhältst du ein einfaches, nicht übertragbares Recht, die Inhalte für
        persönliche, nicht-kommerzielle Zwecke zu nutzen. Weitergabe, Vervielfältigung oder
        öffentliche Zugänglichmachung sind untersagt.
      </p>
      <h2>6. Verfügbarkeit</h2>
      <p>
        Wir bemühen uns um eine hohe Verfügbarkeit der App, schulden aber keine
        ununterbrochene Erreichbarkeit. Wartungsfenster werden nach Möglichkeit angekündigt.
      </p>
      <h2>7. Gesundheitshinweis</h2>
      <p>
        Die Inhalte richten sich an gesunde Erwachsene und dienen dem allgemeinen
        Wohlbefinden. Bei gesundheitlichen Beschwerden, nach Operationen oder in der
        Schwangerschaft konsultiere vor der Nutzung bitte deine Ärztin oder deinen Arzt.
      </p>
      <h2>8. Schlussbestimmungen</h2>
      <p>
        Es gilt deutsches Recht unter Ausschluss des UN-Kaufrechts; gesetzliche
        Verbraucherschutzvorschriften deines Aufenthaltsstaats bleiben unberührt.
        <PH>Ggf. Gerichtsstand/Salvatorische Klausel ergänzen; anwaltlich prüfen lassen</PH>
      </p>
      </LegalBody>
    </LegalLayout>
  );
}

export function Widerruf() {
  return (
    <LegalLayout title="Widerrufsbelehrung">
      <LegalBody field="widerruf">
      <h2>Widerrufsrecht</h2>
      <p>
        Du hast das Recht, binnen vierzehn Tagen ohne Angabe von Gründen diesen Vertrag zu
        widerrufen. Die Widerrufsfrist beträgt vierzehn Tage ab dem Tag des Vertragsschlusses.
      </p>
      <p>
        Um dein Widerrufsrecht auszuüben, musst du uns (<PH>Firma/Name, Anschrift</PH>,
        E-Mail: <a href="mailto:hello@healrise.de">hello@healrise.de</a>) mittels einer
        eindeutigen Erklärung (z. B. E-Mail oder Brief) über deinen Entschluss informieren.
        Zur Wahrung der Frist reicht es aus, dass du die Mitteilung vor Ablauf der
        Widerrufsfrist absendest.
      </p>
      <h2>Folgen des Widerrufs</h2>
      <p>
        Wenn du diesen Vertrag widerrufst, erstatten wir dir alle Zahlungen, die wir von dir
        erhalten haben, unverzüglich und spätestens binnen vierzehn Tagen ab dem Tag, an dem
        die Mitteilung über deinen Widerruf bei uns eingegangen ist. Für die Rückzahlung
        verwenden wir dasselbe Zahlungsmittel, das du bei der ursprünglichen Transaktion
        eingesetzt hast.
      </p>
      <h2>Vorzeitiges Erlöschen bei digitalen Inhalten</h2>
      <p>
        Das Widerrufsrecht erlischt bei Verträgen über die Lieferung nicht auf einem
        körperlichen Datenträger befindlicher digitaler Inhalte, wenn wir mit der Ausführung
        des Vertrags begonnen haben, nachdem du (1) ausdrücklich zugestimmt hast, dass wir
        vor Ablauf der Widerrufsfrist mit der Ausführung beginnen, und (2) deine Kenntnis
        davon bestätigt hast, dass du durch deine Zustimmung dein Widerrufsrecht verlierst
        (§ 356 Abs. 5 BGB). Diese Zustimmung erteilst du im Bestellvorgang über die
        entsprechende Checkbox.
      </p>
      <h2>Muster-Widerrufsformular</h2>
      <p>
        (Wenn du den Vertrag widerrufen willst, kannst du dieses Formular ausfüllen und
        zurücksenden — es ist nicht vorgeschrieben.)
      </p>
      <ul>
        <li>An: <PH>Firma/Name, Anschrift</PH>, E-Mail: hello@healrise.de</li>
        <li>Hiermit widerrufe(n) ich/wir den von mir/uns abgeschlossenen Vertrag über den Kauf der folgenden digitalen Inhalte: …</li>
        <li>Bestellt am: … / Name und Anschrift des/der Verbraucher(s): …</li>
        <li>Datum, Unterschrift (nur bei Mitteilung auf Papier)</li>
      </ul>
      </LegalBody>
    </LegalLayout>
  );
}
