import client from './client';

export async function login(identifier, password) {
  const { data } = await client.post('/api/auth/local', { identifier, password });
  return data; // { jwt, user }
}

export async function register(username, email, password, healthConsent = false) {
  const { data } = await client.post('/api/auth/local/register', {
    username,
    email,
    password,
    // Art.-9-Opt-in wird serverseitig protokolliert (health_consent_at)
    health_consent: healthConsent === true,
  });
  return data;
}

// Art.-9-Consent setzen/widerrufen; Widerruf löscht serverseitige Fortschrittsdaten
export async function setHealthConsent(consent) {
  const { data } = await client.put('/api/users/me/health-consent', { consent });
  return data;
}

export async function getMe() {
  const { data } = await client.get('/api/users/me?populate=role');
  return data;
}

// Eigener Whitelist-Endpoint (nur username) — das generische PUT /users/:id
// bleibt serverseitig gesperrt, sonst wäre plan selbst änderbar (Review B3/F3).
export async function updateMe(fields) {
  const { data } = await client.put('/api/users/me', fields);
  return data;
}

// Kontolöschung (P1.2, R-02): authentifiziertes DELETE /api/users/me. Löscht
// serverseitig Fortschrittsdaten, entkoppelt aufbewahrungspflichtige Käufe und
// löscht dann den User. Bei Fehlern bleibt die Session bestehen (Aufrufer).
export async function deleteAccount() {
  const { data } = await client.delete('/api/users/me/delete');
  return data;
}

// Stripe Customer/Billing-Portal (P3.3, M-02): erstellt serverseitig eine
// Portal-Session und liefert die URL. Nur nach einem Kauf verfügbar (sonst 400).
export async function getBillingPortalUrl() {
  const { data } = await client.post('/api/users/me/billing-portal');
  return data?.data?.url ?? null;
}

// DSGVO-Selbstauskunft (Art. 15/20): lädt alle zum Konto gespeicherten Daten
// (Account/Käufe/Fortschritt) als JSON. Reiner Fetch — den Datei-Download löst
// der Aufrufer aus (so bleibt die Logik lokal ohne Browser-Download testbar).
export async function exportMyData() {
  const { data } = await client.get('/api/users/me/export');
  return data;
}

// Passwort-vergessen-Flow (Review F33) — Strapi-Standard-Endpoints.
export async function forgotPassword(email) {
  const { data } = await client.post('/api/auth/forgot-password', { email });
  return data;
}

export async function resetPassword(code, password, passwordConfirmation) {
  const { data } = await client.post('/api/auth/reset-password', {
    code,
    password,
    passwordConfirmation,
  });
  return data; // { jwt, user }
}

// Validiert das aktuelle Passwort serverseitig (Review F5).
export async function changePassword(currentPassword, password) {
  const { data } = await client.post('/api/auth/change-password', {
    currentPassword,
    password,
    passwordConfirmation: password,
  });
  return data; // { jwt, user }
}
