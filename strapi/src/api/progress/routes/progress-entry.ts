export default {
  routes: [
    {
      method: 'GET',
      path: '/progress',
      handler: 'progress-entry.find',
      config: { policies: [] },
    },
    {
      method: 'PUT',
      path: '/progress/:slug',
      handler: 'progress-entry.toggle',
      config: { policies: [] },
    },
  ],
};
