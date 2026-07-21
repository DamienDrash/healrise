/**
 * Erweiterung von users-permissions (Review B3/F3/F5):
 * `PUT /api/users/me` mit striktem Feld-Whitelisting (nur `username`).
 * Das generische `user.update` (PUT /api/users/:id) bleibt bewusst
 * deaktiviert — es würde Selbst-Upgrades über das `plan`-Feld erlauben.
 * Passwortänderung läuft über den eingebauten, `currentPassword`
 * validierenden Endpoint POST /api/auth/change-password.
 */
// Konto-Löschlogik als eigenständiges, unit-getestetes Modul (P1.2, R-02).
import { makeDeleteMeController } from './account-deletion';
// Stripe Customer/Billing-Portal (P3.3, M-02) — eigenständig, unit-getestet.
import { makeBillingPortalController } from '../../api/stripe-webhook/billing-portal';
// DSGVO-Selbstauskunft (Art. 15/20) — eigenständig, unit-getestet.
import { makeExportMeController } from './user-data-export';

export default (plugin: any) => {
  plugin.controllers.user.updateMe = async (ctx: any) => {
    const user = ctx.state.user;
    if (!user) return ctx.unauthorized();

    const body = ctx.request.body || {};
    const username = typeof body.username === 'string' ? body.username.trim() : '';
    if (username.length < 3) {
      return ctx.badRequest('Der Benutzername muss mindestens 3 Zeichen haben.');
    }

    const taken = await strapi.db.query('plugin::users-permissions.user').findOne({
      where: { username, id: { $ne: user.id } },
    });
    if (taken) return ctx.badRequest('Dieser Benutzername ist bereits vergeben.');

    // Whitelist: ausschließlich username — plan/email/role sind hier unveränderbar.
    const updated: any = await strapi.entityService.update(
      'plugin::users-permissions.user',
      user.id,
      { data: { username } as any }
    );

    ctx.body = {
      id: updated.id,
      username: updated.username,
      email: updated.email,
      plan: updated.plan,
    };
  };

  /**
   * Art.-9-Einwilligung (Goldstandard R1–R3, Plan T7.2):
   * separater, protokollierter Opt-in für Fortschritts-/Gesundheitsdaten.
   * Widerruf löscht alle serverseitigen Fortschrittsdaten (T7.2.3).
   */
  plugin.controllers.user.setHealthConsent = async (ctx: any) => {
    const user = ctx.state.user;
    if (!user) return ctx.unauthorized();

    const consent = Boolean(ctx.request.body?.consent);
    const data: any = { health_consent_at: consent ? new Date() : null };

    if (!consent) {
      // Widerruf: serverseitige Fortschrittsdaten vollständig löschen
      await strapi.db.query('api::progress.progress-entry').deleteMany({
        where: { user: user.id },
      });
    }

    await strapi.entityService.update('plugin::users-permissions.user', user.id, { data });
    ctx.body = { data: { health_consent: consent } };
  };

  /**
   * Kontolöschung (P1.2, Finding R-02 / GDPR Art. 17): authentifiziertes DELETE /api/users/me/delete.
   * Löscht atomar die eigenen Fortschrittsdaten, entkoppelt aufbewahrungs-
   * pflichtige Käufe (user → null, keine Löschung) und löscht dann den User.
   * Erfolg antwortet mit HTTP 204 (No Content). Orchestrierung + HTTP-Vertrag
   * liegen in `account-deletion.js` (unit-getestet).
   */
  plugin.controllers.user.deleteMe = makeDeleteMeController(strapi);

  // P3.3/M-02: POST /api/users/me/billing-portal → Stripe-Billing-Portal-URL.
  plugin.controllers.user.billingPortal = makeBillingPortalController(strapi);

  // DSGVO-Selbstauskunft (Art. 15/20): GET /users/me/export
  plugin.controllers.user.exportMe = makeExportMeController(strapi);

  // Register um optionalen Consent erweitern: das Original läuft unverändert,
  // danach wird der protokollierte Zeitpunkt gesetzt (Opt-in, nie vorangekreuzt).
  // Achtung: `controllers.auth` ist (anders als `controllers.user`) eine
  // FACTORY — deshalb die Factory wrappen, nicht die Methode.
  const originalAuthFactory = plugin.controllers.auth;
  plugin.controllers.auth = (context: any) => {
    const controller = typeof originalAuthFactory === 'function'
      ? originalAuthFactory(context)
      : originalAuthFactory;
    const originalRegister = controller.register.bind(controller);

    controller.register = async (ctx: any) => {
      const wantsConsent = ctx.request.body?.health_consent === true;
      // Custom-Feld entfernen — die strikte Register-Validierung von Strapi
      // (allowedFields) lehnt unbekannte Felder sonst mit 400 ab.
      if (ctx.request.body && 'health_consent' in ctx.request.body) {
        delete ctx.request.body.health_consent;
      }
      await originalRegister(ctx);
      if (wantsConsent && ctx.response.status === 200) {
        const createdId = ctx.response.body?.user?.id;
        if (createdId) {
          await strapi.entityService.update('plugin::users-permissions.user', createdId, {
            data: { health_consent_at: new Date() } as any,
          });
        }
      }
    };

    return controller;
  };

  // Vor den bestehenden Routen einfügen, damit PUT /users/me nicht von
  // PUT /users/:id (user.update) verschluckt wird.
  plugin.routes['content-api'].routes.unshift(
    {
      method: 'PUT',
      path: '/users/me',
      handler: 'user.updateMe',
      config: { prefix: '' },
    },
    {
      method: 'PUT',
      path: '/users/me/health-consent',
      handler: 'user.setHealthConsent',
      config: { prefix: '' },
    },
    {
      // GDPR Art. 17: Selbst-Kontolöschung. Eigener Pfad /users/me/delete (statt
      // /users/:id) — es gibt keinen id-Parameter, die Löschung trifft immer nur
      // ctx.state.user; fremde Konten sind so ausgeschlossen.
      method: 'DELETE',
      path: '/users/me/delete',
      handler: 'user.deleteMe',
      config: { prefix: '' },
    },
    {
      method: 'POST',
      path: '/users/me/billing-portal',
      handler: 'user.billingPortal',
      config: { prefix: '' },
    },
    {
      method: 'GET',
      path: '/users/me/export',
      handler: 'user.exportMe',
      config: { prefix: '' },
    }
  );

  return plugin;
};
