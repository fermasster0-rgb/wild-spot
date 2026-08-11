// ============================================================================
// Anmeldung
//
// Ohne Login funktioniert die Karte trotzdem — Wasserstellen und Unterkünfte
// stammen aus OpenStreetMap und sind öffentlich. Erst die Spots gehören
// Nutzern, deshalb braucht es dafür ein Konto.
//
// Die Sitzung merkt sich supabase-js selbst im Browser. Wer einmal angemeldet
// ist, bleibt es auch nach dem Schließen des Fensters — bis er auf Abmelden
// drückt.
// ============================================================================

'use strict';

const cfgAuth = window.WILDCAMP_CONFIG || {};

// supabase-js kommt als fertiges Paket vom CDN und liegt unter window.supabase.
// createClient daraus, sonst überschreiben wir das Paket mit unserem Client.
const sb = window.supabase.createClient(cfgAuth.supabaseUrl, cfgAuth.supabaseAnonKey);

// Damit die Karte auf An- und Abmelden reagieren kann.
window.WILDCAMP_AUTH = {
  client: sb,
  nutzer: null,      // { id, email, username } oder null
  beiWechsel: [],    // Funktionen, die bei jedem Wechsel aufgerufen werden
};

function wechselMelden() {
  for (const f of window.WILDCAMP_AUTH.beiWechsel) {
    try { f(window.WILDCAMP_AUTH.nutzer); } catch (e) { console.error(e); }
  }
}

// ============================================================================
// Die Elemente
// ============================================================================

// Das Konto lebt in der Einstellungen-Tafel hinter dem Zahnrad oben rechts.
// Auf der Karte selbst steht dafür nichts mehr — nur der grüne Punkt am
// Zahnrad zeigt, dass jemand angemeldet ist.
const knopfAnmelden  = document.getElementById('knopf-anmelden');
const kontoAus       = document.getElementById('konto-aus');
const kontoAn        = document.getElementById('konto-an');
const kontoAmpel     = document.getElementById('konto-ampel');
const kontoUsername  = document.getElementById('konto-username');
const overlay        = document.getElementById('login-hg');
const formular       = document.getElementById('login-form');
const feldMail       = document.getElementById('login-mail');
const feldPasswort   = document.getElementById('login-passwort');
const knopfAbsenden  = document.getElementById('login-absenden');
const knopfWechsel   = document.getElementById('login-wechsel');
const knopfGoogle    = document.getElementById('login-google');
const knopfSchliessen= document.getElementById('login-schliessen');
const titel          = document.getElementById('login-titel');
const meldung        = document.getElementById('login-meldung');
const kontoName      = document.getElementById('konto-name');
const knopfAbmelden  = document.getElementById('knopf-abmelden');

let modus = 'anmelden';   // oder 'registrieren'

// ============================================================================
// Overlay auf und zu
// ============================================================================

function overlayZeigen() {
  overlay.hidden = false;
  meldungSetzen('');
  feldMail.focus();
}

function overlaySchliessen() {
  overlay.hidden = true;
}

function meldungSetzen(text, art = 'info') {
  meldung.textContent = text || '';
  meldung.className = 'login-meldung' + (text ? ' sichtbar ' + art : '');
}

function modusSetzen(neu) {
  modus = neu;
  const registrieren = modus === 'registrieren';
  titel.textContent = registrieren ? 'Konto anlegen' : 'Anmelden';
  knopfAbsenden.textContent = registrieren ? 'Konto anlegen' : 'Anmelden';
  knopfWechsel.textContent = registrieren
    ? 'Ich habe schon ein Konto — anmelden'
    : 'Noch kein Konto? Eins anlegen';
  feldPasswort.setAttribute('autocomplete', registrieren ? 'new-password' : 'current-password');
  meldungSetzen('');
}

knopfWechsel.onclick = () => modusSetzen(modus === 'anmelden' ? 'registrieren' : 'anmelden');
knopfSchliessen.onclick = overlaySchliessen;

// Klick auf den dunklen Hintergrund schließt ebenfalls.
overlay.onclick = (e) => { if (e.target === overlay) overlaySchliessen(); };

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !overlay.hidden) overlaySchliessen();
});

// ============================================================================
// Anmelden und Registrieren
// ============================================================================

formular.onsubmit = async (e) => {
  e.preventDefault();

  const mail = feldMail.value.trim();
  const passwort = feldPasswort.value;

  if (!mail || !passwort) {
    meldungSetzen('Bitte E-Mail und Passwort ausfüllen.', 'fehler');
    return;
  }
  if (modus === 'registrieren' && passwort.length < 8) {
    meldungSetzen('Das Passwort braucht mindestens 8 Zeichen.', 'fehler');
    return;
  }

  knopfAbsenden.disabled = true;
  meldungSetzen(modus === 'registrieren' ? 'Konto wird angelegt …' : 'Anmelden …');

  try {
    if (modus === 'registrieren') {
      const { data, error } = await sb.auth.signUp({ email: mail, password: passwort });
      if (error) throw error;

      // Steht keine Sitzung in der Antwort, verlangt Supabase eine Bestätigung
      // per E-Mail. Dann ist man noch nicht angemeldet.
      if (!data.session) {
        meldungSetzen(
          'Fast fertig — wir haben dir eine E-Mail geschickt. ' +
          'Klick auf den Link darin, danach kannst du dich hier anmelden. ' +
          '(Schau notfalls im Spam-Ordner.)', 'info');
        modusSetzen('anmelden');
        return;
      }
    } else {
      const { error } = await sb.auth.signInWithPassword({ email: mail, password: passwort });
      if (error) throw error;
    }

    overlaySchliessen();
    feldPasswort.value = '';

  } catch (err) {
    meldungSetzen(fehlerText(err), 'fehler');
  } finally {
    knopfAbsenden.disabled = false;
  }
};

// Die Meldungen von Supabase sind englisch und technisch. Hier die Fälle,
// die tatsächlich vorkommen, auf Deutsch.
function fehlerText(err) {
  const m = (err && err.message ? err.message : String(err)).toLowerCase();

  if (m.includes('invalid login credentials')) {
    return 'E-Mail oder Passwort stimmt nicht.';
  }
  if (m.includes('email not confirmed')) {
    return 'Diese Adresse ist noch nicht bestätigt. Schau in dein Postfach — ' +
           'dort liegt eine Mail mit einem Bestätigungslink.';
  }
  if (m.includes('user already registered') || m.includes('already been registered')) {
    return 'Zu dieser Adresse gibt es schon ein Konto. Melde dich einfach an.';
  }
  if (m.includes('password should be at least')) {
    return 'Das Passwort ist zu kurz.';
  }
  if (m.includes('email address') && m.includes('invalid')) {
    return 'Diese E-Mail-Adresse akzeptiert Supabase nicht. Nimm eine echte Adresse.';
  }
  if (m.includes('rate limit') || m.includes('too many')) {
    return 'Zu viele Versuche hintereinander. Warte ein paar Minuten.';
  }
  if (m.includes('failed to fetch') || m.includes('network')) {
    return 'Keine Verbindung zum Server. Internet prüfen.';
  }
  return err && err.message ? err.message : 'Unbekannter Fehler.';
}

// ============================================================================
// Anmelden mit Google
//
// Der Knopf erscheint nur, wenn googleLogin in config.js auf true steht —
// vorher ist der Provider im Supabase-Dashboard nicht eingerichtet und Google
// würde nur eine Fehlerseite zeigen.
// ============================================================================

// Nur Google zulassen ergibt ohne eingerichteten Google-Provider keinen Sinn —
// dann käme niemand mehr herein.
const nurGoogle = cfgAuth.nurGoogle && cfgAuth.googleLogin;

if (cfgAuth.googleLogin) {
  // Knopf und das "oder" darüber sind im HTML versteckt und kommen nur hier
  // zum Vorschein.
  document.getElementById('login-trenner').hidden = nurGoogle;
  knopfGoogle.hidden = false;
  knopfGoogle.onclick = async () => {
    meldungSetzen('Google wird geöffnet …');
    const { error } = await sb.auth.signInWithOAuth({
      provider: 'google',
      // Nach dem Klick bei Google kommt der Browser hierher zurück.
      options: { redirectTo: window.location.origin + window.location.pathname },
    });
    if (error) meldungSetzen(fehlerText(error), 'fehler');
  };
}

if (nurGoogle) {
  // E-Mail und Passwort verschwinden komplett. Der Google-Knopf wandert nach
  // oben, damit er nicht als Nebensache dasteht.
  formular.hidden = true;
  knopfWechsel.hidden = true;
  titel.textContent = 'Anmelden';
  document.querySelector('#login-hg .unter').textContent =
    'Die Karte mit Wasser, Bergseen und Unterkünften siehst du auch ohne Konto. ' +
    'Für eigene Spots brauchst du eins — die Anmeldung läuft über Google, ' +
    'damit jede Adresse echt ist.';
  knopfGoogle.parentNode.insertBefore(knopfGoogle, formular);
  knopfGoogle.style.marginTop = '0';
}

// ============================================================================
// Abmelden
// ============================================================================

knopfAbmelden.onclick = async () => {
  await sb.auth.signOut();
};

knopfAnmelden.onclick = () => {
  modusSetzen('anmelden');
  overlayZeigen();
};

// ============================================================================
// Auf Anmeldung und Abmeldung reagieren
//
// onAuthStateChange feuert auch beim Laden der Seite, wenn noch eine gültige
// Sitzung im Browser liegt. Deshalb braucht es keinen eigenen Startcode.
// ============================================================================

sb.auth.onAuthStateChange(async (ereignis, session) => {
  if (session && session.user) {
    const username = await profilnameHolen(session.user);
    window.WILDCAMP_AUTH.nutzer = {
      id: session.user.id,
      email: session.user.email,
      username,
    };
    kontoUsername.textContent = username;
    kontoName.textContent = session.user.email;
    kontoAus.hidden = true;
    kontoAn.hidden = false;
    kontoAmpel.hidden = false;
  } else {
    window.WILDCAMP_AUTH.nutzer = null;
    kontoAus.hidden = false;
    kontoAn.hidden = true;
    kontoAmpel.hidden = true;
  }
  wechselMelden();
});

// Den Anzeigenamen aus der Tabelle profiles holen. Die legt ein Trigger in der
// Datenbank automatisch an, sobald sich jemand registriert.
async function profilnameHolen(user) {
  const { data, error } = await sb
    .from('profiles')
    .select('username')
    .eq('id', user.id)
    .maybeSingle();

  if (error || !data) {
    // Kein Profil gefunden — als Notnagel der Teil vor dem @.
    return (user.email || 'Konto').split('@')[0];
  }
  return data.username;
}

// Die Karte kann hierüber das Anmeldefenster öffnen, etwa wenn jemand ohne
// Konto einen Spot anlegen will.
window.WILDCAMP_AUTH.anmeldenZeigen = () => {
  modusSetzen('anmelden');
  overlayZeigen();
};
