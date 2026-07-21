import client from './client';

/**
 * Erstellt eine Stripe-Checkout-Session (Plan E6). `consentImmediateDelivery`
 * dokumentiert die Zustimmung zur sofortigen Bereitstellung inkl. Erlöschen
 * des Widerrufsrechts (§ 356 Abs. 5 BGB) — ohne sie lehnt der Server ab.
 */
export async function createCheckoutSession(plan, consentImmediateDelivery) {
  const { data } = await client.post('/api/checkout/session', {
    plan,
    consent_immediate_delivery: consentImmediateDelivery,
  });
  return data?.data; // { url, id }
}
