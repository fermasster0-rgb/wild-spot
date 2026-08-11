// ============================================================================
// Zugangsdaten für die Web-Karte
//
// Diese beiden Werte holst du dir im Supabase-Dashboard:
//   Project Settings  →  API Keys
//
// Der anon-Schlüssel (auch "publishable key") DARF öffentlich sein — genau
// dafür ist er gemacht. Was er sehen darf, entscheidet Row Level Security
// in der Datenbank, nicht die Geheimhaltung des Schlüssels.
//
// NIEMALS hier eintragen: der service_role- bzw. secret-Schlüssel.
// Der umgeht alle Sicherheitsregeln und gehört ausschließlich in .env.local.
// ============================================================================

window.WILDCAMP_CONFIG = {
  // Steht im Dashboard unter "Project URL".
  supabaseUrl: 'https://aokovrrxvglxpccezjjr.supabase.co',

  // Der publishable key. Eingetragen am 2026-08-04.
  supabaseAnonKey: 'sb_publishable_tDlU187EJTfaneZ0PgyWvw_3q0b2cs7',

  // Anmelden mit Google. Auf true stellen, sobald der Google-Provider im
  // Supabase-Dashboard eingerichtet ist (Anleitung: web/README.md).
  // Vorher würde der Knopf nur eine Fehlerseite öffnen.
  googleLogin: false,

  // Nur Google zulassen und die Anmeldung per E-Mail und Passwort ausblenden.
  // Dann kommt niemand mit einer erfundenen Adresse herein: Google hat jedes
  // Konto bereits geprüft.
  //
  // WICHTIG: Das hier blendet die Felder nur aus. Wirklich dicht ist es erst,
  // wenn im Supabase-Dashboard unter Authentication → Sign In / Providers der
  // Punkt "Email" ausgeschaltet ist — sonst könnte jemand die Schnittstelle
  // direkt ansprechen. Beides gehört zusammen.
  nurGoogle: false,
};
