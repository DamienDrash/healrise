/**
 * Strapi-Fehlermeldungen → deutsche Texte (Review F34: englische
 * Server-Meldungen wurden roh in die deutsche UI durchgereicht).
 */
const MESSAGE_MAP = {
  'Invalid identifier or password': 'E-Mail oder Passwort ist falsch.',
  'Email or Username are already taken': 'E-Mail oder Benutzername ist bereits vergeben.',
  'Email already taken': 'Diese E-Mail-Adresse ist bereits registriert.',
  'Username already taken': 'Dieser Benutzername ist bereits vergeben.',
  'Your account email is not confirmed': 'Bitte bestätige zuerst deine E-Mail-Adresse.',
  'Your account has been blocked by an administrator': 'Dein Konto wurde gesperrt. Bitte kontaktiere den Support.',
  'Too many attempts, please try again in a minute.': 'Zu viele Versuche — bitte warte eine Minute.',
  'The provided current password is invalid': 'Das aktuelle Passwort ist falsch.',
  'Your new password must be different than your current password': 'Das neue Passwort muss sich vom aktuellen unterscheiden.',
  'Incorrect code provided': 'Der Code ist ungültig oder abgelaufen.',
  'This email does not exist': 'Zu dieser E-Mail-Adresse existiert kein Konto.',
};

const PATTERN_MAP = [
  [/password.*(at least|too short)|too short.*password/i, 'Das Passwort ist zu kurz.'],
  [/email.*(valid|format)/i, 'Bitte gib eine gültige E-Mail-Adresse ein.'],
  [/username.*(at least|too short)/i, 'Der Benutzername ist zu kurz.'],
];

export function toGermanError(err, fallback = 'Etwas ist schiefgelaufen. Bitte versuche es erneut.') {
  if (!err?.response) {
    // Netzwerkfehler (offline, Server nicht erreichbar)
    return 'Keine Verbindung zum Server. Prüfe deine Internetverbindung.';
  }
  const apiError = err.response.data?.error;
  const messages = [
    apiError?.message,
    ...(apiError?.details?.errors?.map(d => d.message) ?? []),
  ].filter(Boolean);

  for (const msg of messages) {
    // Bereits deutsche Meldungen (eigene Endpoints) direkt durchreichen
    if (MESSAGE_MAP[msg]) return MESSAGE_MAP[msg];
    if (/[äöüß]|bereits|ungültig|Zeichen/.test(msg)) return msg;
    for (const [pattern, text] of PATTERN_MAP) {
      if (pattern.test(msg)) return text;
    }
  }
  return fallback;
}
