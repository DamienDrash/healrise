export default {
  routes: [
    {
      method: 'POST',
      path: '/mail/webhook',
      handler: 'mail-webhook.handle',
      config: {
        // Kein Auth-Kontext: Authentizität kommt aus der Postal-RSA-Signatur
        // (X-Postal-Signature), nicht aus JWT. Analog zum Stripe-Webhook.
        auth: false,
        policies: [],
      },
    },
  ],
};
