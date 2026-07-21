export default {
  routes: [
    {
      method: 'POST',
      path: '/stripe/webhook',
      handler: 'stripe-webhook.handle',
      config: {
        // Kein Auth-Kontext: Authentizität wird über die Stripe-Signatur
        // geprüft (Goldstandard T9), nicht über JWT.
        auth: false,
        policies: [],
      },
    },
  ],
};
