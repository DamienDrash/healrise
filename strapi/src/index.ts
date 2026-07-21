// @ts-nocheck
import type { Core } from '@strapi/strapi';
import { applyPasswordResetUrl } from './password-reset-url';
import { applyPasswordResetEmailTemplate } from './password-reset-email-template';
import { stripeKeyEnvironmentWarnings } from './stripe-config';
import { applyBetriebAdminRole } from './admin-role-scope';

/**
 * Permission-Actions im Strapi-5-Format (Review B11 — das alte
 * `plugin.controllers.controller.action`-Format erzeugte wirkungslose Zeilen).
 * Es gibt keine `enabled`-Spalte mehr: Existenz der Zeile = freigeschaltet.
 */
const AUTHENTICATED_ACTIONS = [
  'plugin::users-permissions.user.me',
  'plugin::users-permissions.user.updateMe',        // Custom-Route PUT /users/me (Whitelist: username)
  'plugin::users-permissions.auth.changePassword',  // validiert currentPassword serverseitig
  'plugin::users-permissions.auth.logout',
  'api::program.program.find',
  'api::program.program.findOne',
  'api::progress.progress-entry.find',
  'api::progress.progress-entry.toggle',
  'api::checkout.checkout.createSession',
  'plugin::users-permissions.user.setHealthConsent',
  'plugin::users-permissions.user.deleteMe',         // Custom-Route DELETE /users/me (Kontolöschung, R-02)
  'plugin::users-permissions.user.billingPortal',    // Custom-Route POST /users/me/billing-portal (P3.3, M-02)
  'plugin::users-permissions.user.exportMe',         // Custom-Route GET /users/me/export (DSGVO-Auskunft Art. 15/20)
];

const PUBLIC_ACTIONS = [
  'plugin::users-permissions.auth.callback',
  'plugin::users-permissions.auth.register',
  'plugin::users-permissions.auth.forgotPassword',
  'plugin::users-permissions.auth.resetPassword',
  'plugin::users-permissions.auth.emailConfirmation',
  'api::legal.legal.find',  // R-01: Pflicht-Rechtstexte ohne Login erreichbar
];

async function setPermissions(strapi: Core.Strapi) {
  // Wirkungslose Alt-Zeilen im v4-Format entfernen (einmalige Bereinigung).
  await strapi.db.query('plugin::users-permissions.permission').deleteMany({
    where: { action: { $contains: '.controllers.' } },
  });

  const roles = await strapi.db
    .query('plugin::users-permissions.role')
    .findMany({ where: { type: { $in: ['authenticated', 'public'] } } });

  for (const role of roles) {
    const actions = role.type === 'authenticated' ? AUTHENTICATED_ACTIONS : PUBLIC_ACTIONS;
    const existing = await strapi.db
      .query('plugin::users-permissions.permission')
      .findMany({ where: { role: role.id } });
    const existingActions = new Set(existing.map((p) => p.action));

    for (const action of actions) {
      if (!existingActions.has(action)) {
        await strapi.db
          .query('plugin::users-permissions.permission')
          .create({ data: { action, role: role.id } });
      }
    }
  }
}

/**
 * Seeds laufen nur noch mit SEED_DEMO=true (Review B5) — nie in Produktion
 * einen Testuser mit bekanntem Passwort anlegen.
 */
async function seedTestUser(strapi: Core.Strapi) {
  const existing = await strapi.db
    .query('plugin::users-permissions.user')
    .findMany({ where: { username: 'Testuser' } });
  if (existing.length > 0) return;

  const authRole = await strapi.db
    .query('plugin::users-permissions.role')
    .findOne({ where: { type: 'authenticated' } });

  await strapi.plugins['users-permissions'].services.user.add({
    username: 'Testuser',
    email: 'test@healrise.de',
    password: process.env.SEED_USER_PASSWORD || 'Test2026!',
    provider: 'local',
    confirmed: true,
    blocked: false,
    plan: 'healrise14',
    health_consent_at: new Date(), // Demo-User: Tracking-Consent liegt vor
    role: authRole.id,
  });
  strapi.log.info('Seed: Testuser angelegt (plan: healrise14)');
}

async function seedDemoContent(strapi: Core.Strapi) {
  const count = await strapi.db.query('api::program.program').count();
  if (count > 0) return;

  // Formulierungen bewusst wellness-orientiert halten (Goldstandard R19/R20):
  // keine Heil-/Linderungs-Claims, kein Krankheits-/Therapiebezug.
  const programs = [
    { title: 'Willkommen bei HEALRISE', slug: 'willkommen', description: 'Dein Start in deine Auszeit.', body: '<p>Herzlich willkommen. Nimm dir diese Zeit für dich – Schritt für Schritt zu mehr Wohlbefinden.</p>', plan_required: 'freebie', category: 'allgemein', content_type: 'guide', day: 1, week: 1, order: 1, is_featured: true },
    { title: '7 Wohlfühl-Basics für Woche 1', slug: 'freebie-7-tipps', description: 'Die wichtigsten Basics für deinen Start.', body: '<p><strong>1:</strong> Gönn dir Ruhe – dein Körper arbeitet für dich.<br><strong>2:</strong> Iss bunt und frisch: Omega-3, Vitamin C, Zink.<br><strong>3:</strong> Sanfte Kühlung tut gut – Kühlpads aus dem Kühlschrank.<br><strong>4:</strong> Starte sanft: tiefe Atemzüge, kleine Spaziergänge.<br><strong>5:</strong> Denk an deine Darmflora – probiotische Lebensmittel.<br><strong>6:</strong> Hautpflege mit Geduld angehen.<br><strong>7:</strong> Selfcare ist kein Luxus: Wärme, Musik, Ruhe.</p>', plan_required: 'freebie', category: 'allgemein', content_type: 'tipp', day: 1, week: 1, order: 2, is_featured: true },
    { title: 'Ernährung in Woche 1', slug: 'ernaehrung-woche-1', description: 'Ideen für nährstoffreiche Tage.', body: '<h2>Dein Ernährungsplan Tag 1–7</h2><p><strong>Morgens:</strong> Zitronenwasser, Haferbrei mit Beeren und Leinöl</p><p><strong>Mittags:</strong> Gemüsesuppe oder bunte Bowl, reich an Vitaminen</p><p><strong>Abends:</strong> Leichte Kost, Kräutertee (Kamille, Brennnessel)</p><h3>Womit du sparsam sein solltest</h3><ul><li>Alkohol</li><li>Stark verarbeitete Lebensmittel</li><li>Zucker</li></ul>', plan_required: 'healrise7', category: 'ernaehrung', content_type: 'guide', day: 1, week: 1, order: 3, duration_minutes: 10 },
    { title: 'Deine Supplements in Woche 1', slug: 'supplements-woche-1', description: 'Ein einfaches Basis-Setup.', body: '<h2>Das minimale Start-Setup</h2><ol><li><strong>Vitamin C + Zink:</strong> Beliebte Begleiter für dein Immunsystem. 2x täglich zur Mahlzeit.</li><li><strong>Probiotikum:</strong> Unterstützung für deine Darmflora. Täglich auf nüchternen Magen.</li><li><strong>Omega-3 (Algenöl):</strong> Fester Bestandteil vieler Wohlfühl-Routinen. 2g täglich.</li></ol><p><em>Sprich Nahrungsergänzung immer mit deiner Ärztin oder deinem Arzt ab.</em></p>', plan_required: 'healrise7', category: 'supplements', content_type: 'guide', day: 2, week: 1, order: 1 },
    { title: 'Sanfte Bewegung Tag 3', slug: 'bewegung-tag-3', description: 'Erste leichte Mobilisation.', body: '<h2>5-Minuten Routine</h2><p>Sanft und in deinem Tempo.</p><ul><li>3x tief in den Brustkorb atmen</li><li>Schultern sanft nach hinten rollen (3 Wiederholungen)</li><li>10 Minuten langsam durch die Wohnung gehen</li><li>Beine hochlagern und entspannen</li></ul><p><em>Höre auf deinen Körper. Unwohlsein = Pause.</em></p>', plan_required: 'healrise7', category: 'bewegung', content_type: 'uebung', day: 3, week: 1, order: 1, duration_minutes: 5 },
    { title: 'Selfcare Ritual: Morgenroutine', slug: 'selfcare-morgenroutine', description: 'Starte den Tag mit Fürsorge.', body: '<h2>Dein Morgenritual</h2><p>Diese Routine dauert 15 Minuten und setzt deinen Fokus für den Tag.</p><ol><li>Warmes Wasser mit Zitrone (trinken, bevor du isst)</li><li>3 bewusste Atemzüge am offenen Fenster</li><li>Affirmation: <em>"Ich bin gut zu mir. Ich nehme mir Zeit."</em></li><li>Leichtes Eincremen von Beinen und Armen</li><li>Kleines, nährstoffreiches Frühstück</li></ol>', plan_required: 'healrise14', category: 'selfcare', content_type: 'guide', day: 4, week: 1, order: 1, duration_minutes: 15 },
    { title: 'Mindset: Ruhe als Ritual', slug: 'mindset-recovery-ritual', description: 'Dein mentaler Kompass für deine Auszeit.', body: '<h2>Ruhe ist keine Pause</h2><p>Viele Frauen fühlen sich schuldig, wenn sie ruhen. Das ist unnötig.</p><p><strong>Dir Zeit zu nehmen ist aktives Handeln.</strong></p><h3>3 Gedanken für deine Auszeit</h3><ol><li>"Ich vertraue meinem Körper."</li><li>"Ruhe ist Produktivität."</li><li>"Ich verdiene Fürsorge."</li></ol><p>Schreibe diese Sätze auf und lies sie morgens laut vor.</p>', plan_required: 'healrise14', category: 'mindset', content_type: 'guide', day: 5, week: 1, order: 1 },
    { title: 'Hautpflege ab Woche 2', slug: 'narbenpflege-woche-2', description: 'Sanfte Pflege-Routinen ab Woche 2.', body: '<h2>Der richtige Zeitpunkt</h2><p>Beginne mit intensiverer Hautpflege erst, wenn du dich bereit fühlst – im Zweifel frag deine Ärztin oder deinen Arzt.</p><h3>Beliebte Begleiter</h3><ul><li>Wildrosenöl (bio, kaltgepresst)</li><li>Sanfte, rückfettende Pflege</li><li>Leichte Kreisbewegungen – sanft, kein Druck</li></ul><p>Täglich 2x für 5 Minuten.</p>', plan_required: 'healrise14', category: 'narbenpflege', content_type: 'guide', day: 14, week: 2, order: 1 },
    { title: '6-Wochen Programm: Überblick', slug: 'premium-ueberblick', description: 'Dein vollständiger Wohlfühl-Plan.', body: '<h2>Dein 6-Wochen-Weg</h2><table><tr><th>Woche</th><th>Fokus</th></tr><tr><td>1–2</td><td>Ruhe, Basics, sanfte Routinen</td></tr><tr><td>3–4</td><td>Aufbau, Mobilisation, Pflege</td></tr><tr><td>5–6</td><td>Energie, Körpervertrauen, Alltag</td></tr></table><p>Jede Woche enthält Tages-Guides, Ernährungsideen und Mindset-Impulse.</p>', plan_required: 'premium', category: 'allgemein', content_type: 'guide', week: 1, order: 0, is_featured: true },
  ];

  for (const p of programs) {
    await strapi.entityService.create('api::program.program', {
      data: { ...p, publishedAt: new Date() },
    });
  }
  strapi.log.info(`Seed: ${programs.length} Demo-Programme angelegt`);
}

/**
 * R-01: Platzhalter-Rechtstexte in den Single-Type `legal` seeden, damit die App
 * von Anfang an Strapi-gepflegte Inhalte lädt und Damien sie später im Admin
 * austauschen kann. Idempotent: existiert bereits ein Legal-Eintrag, wird NICHTS
 * überschrieben (redaktionelle Änderungen bleiben erhalten). Läuft in jeder
 * Umgebung (nicht an SEED_DEMO gebunden), da die Pflichtseiten immer erreichbar
 * sein müssen. Die Platzhalter tragen [PLATZHALTER: …]-Marker und ersetzen keine
 * Rechtsberatung — vor Launch mit echten Daten füllen und anwaltlich prüfen.
 */
async function seedLegalContent(strapi: Core.Strapi) {
  const existing = await strapi.db.query('api::legal.legal').findOne({});
  if (existing) return;

  const P = (label: string) =>
    `<p><span class="placeholder">[PLATZHALTER: ${label}]</span></p>`;

  const data = {
    impressum:
      '<h2>Angaben gemäß § 5 DDG</h2>' +
      P('Vollständiger Name / Firma inkl. Rechtsform, Straße, PLZ und Ort') +
      '<h2>Kontakt</h2>' +
      '<p>E-Mail: hello@healrise.de<br>Telefon: ' +
      '<span class="placeholder">[PLATZHALTER: Telefonnummer]</span></p>' +
      '<h2>Umsatzsteuer</h2>' +
      P('USt-IdNr. gemäß § 27a UStG oder Hinweis auf Kleinunternehmerregelung § 19 UStG') +
      '<h2>Verantwortlich für den Inhalt</h2>' +
      P('Name und Anschrift der inhaltlich verantwortlichen Person'),
    datenschutz:
      '<p>Diese Datenschutzerklärung informiert über die Verarbeitung personenbezogener Daten bei der Nutzung von HEALRISE.</p>' +
      '<h2>1. Verantwortlicher</h2>' +
      P('Name, Anschrift, E-Mail des Verantwortlichen (identisch mit Impressum)') +
      '<h2>2. Deine Rechte</h2>' +
      '<p>Auskunft, Berichtigung, Löschung, Einschränkung, Datenübertragbarkeit und Widerspruch (Art. 15–21 DSGVO).</p>' +
      P('Vor Launch anwaltlich prüfen bzw. mit Generator mit Haftungsübernahme abgleichen'),
    agb:
      '<h2>1. Geltungsbereich</h2>' +
      '<p>Diese AGB gelten für Verträge zwischen ' +
      '<span class="placeholder">[PLATZHALTER: Firma/Name]</span>' +
      ' und Verbraucherinnen und Verbrauchern über die HEALRISE-Web-App.</p>' +
      '<h2>2. Widerrufsrecht</h2>' +
      '<p>Es gilt das gesetzliche Widerrufsrecht; Details in der Widerrufsbelehrung.</p>' +
      P('Gerichtsstand/Salvatorische Klausel ergänzen; anwaltlich prüfen lassen'),
    widerruf:
      '<h2>Widerrufsrecht</h2>' +
      '<p>Du hast das Recht, binnen vierzehn Tagen ohne Angabe von Gründen diesen Vertrag zu widerrufen.</p>' +
      '<p>Um dein Widerrufsrecht auszuüben, musst du uns (' +
      '<span class="placeholder">[PLATZHALTER: Firma/Name, Anschrift]</span>' +
      ', E-Mail: hello@healrise.de) mittels einer eindeutigen Erklärung informieren.</p>',
  };

  await strapi.entityService.create('api::legal.legal', {
    data: { ...data, publishedAt: new Date() },
  });
  strapi.log.info('Seed: Rechtstexte-Platzhalter (R-01) angelegt');
}

export default {
  register({ strapi }: { strapi: Core.Strapi }) {},

  async bootstrap({ strapi }: { strapi: Core.Strapi }) {
    await setPermissions(strapi);

    // P3.1: Reset-Passwort-Link env-gesteuert auf die App-Reset-Seite zeigen
    // lassen (statt null/Admin-URL). Idempotent, kein Mailversand.
    await applyPasswordResetUrl(strapi);

    // P3.1/M-01: Reset-Mail-Template auf ein sauberes deutsches statt Strapis
    // englischem Dummy setzen (Absender via M-01-Env-Kette). Idempotent, kein Versand.
    await applyPasswordResetEmailTemplate(strapi);

    // P3.2: Stripe-Key ↔ Umgebung prüfen und bei Fehlkonfiguration laut warnen
    // (Test-Keys in Prod / Live-Keys in Dev) — keine Secret-Werte im Log.
    for (const w of stripeKeyEnvironmentWarnings((k) => process.env[k], process.env.NODE_ENV)) {
      strapi.log.warn(`⚠ Stripe-Umgebung: ${w}`);
    }

    // R-01: Platzhalter-Rechtstexte immer bereitstellen (idempotent, überschreibt
    // keine redaktionellen Änderungen) — die Pflichtseiten müssen erreichbar sein.
    await seedLegalContent(strapi);

    // P4.3/L-03/L-04: reduzierte Admin-Rolle „HEALRISE Betrieb" (nur Kunden +
    // Produkte, kein Super-Admin) idempotent bereitstellen. Best effort — legt
    // KEINE Admin-Nutzer an; Damien einladen/zuweisen bleibt GUI-/Betreiber-
    // Schritt (docs/admin-roles.md). Wirft nie.
    await applyBetriebAdminRole(strapi);

    if (process.env.SEED_DEMO === 'true') {
      await seedTestUser(strapi);
      await seedDemoContent(strapi);
    }
  },
};
