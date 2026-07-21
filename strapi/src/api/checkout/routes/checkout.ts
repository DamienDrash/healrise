export default {
  routes: [
    {
      method: 'POST',
      path: '/checkout/session',
      handler: 'checkout.createSession',
      config: { policies: [] },
    },
  ],
};
