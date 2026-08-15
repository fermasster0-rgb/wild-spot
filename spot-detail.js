// ============================================================================
// Spot-Detail — die Seitenleiste rechts (KONZEPT.md, Screen 2 und 4)
//
// Was hier passiert, wenn man einen Spot auf der Karte antippt:
//   1. Die Leiste geht sofort auf und zeigt Name und Koordinaten.
//      Der Rest kommt nach — so wartet man nie vor einer leeren Fläche.
//   2. Nachgeladen werden drei Dinge auf einmal: die vollen Angaben zum Spot,
//      alle Kommentare mit Namen der Verfasser und die eigene Bewertung.
//   3. Angezeigt wird nur, was auch wirklich ausgefüllt ist. Ein Spot, bei dem
//      nur der Name steht, sieht dann aufgeräumt aus statt kaputt.
//
// Die Auswahlmöglichkeiten (Bach, Quelle, Schotter …) stehen nicht doppelt
// hier drin: sie werden aus GRUPPEN in spot-form.js gelesen. Eine neue
// Auswahl dort ergänzen reicht, das Detail zeigt sie automatisch mit an.
// ============================================================================

'use strict';

// ============================================================================
// 1. WAS ANGEZEIGT WIRD
//
// Die Reihenfolge hier ist die Reihenfolge in der Leiste. sym ist das Zeichen
// links, wert() macht aus dem Datenbankwert lesbaren Text.
// ============================================================================

// Aus GRUPPEN eine Nachschlagetabelle bauen: Feldname → Felddefinition.
const FELD_DEF = {};
for (const g of GRUPPEN) {
  for (const f of g.felder) FELD_DEF[f.name] = f;
}

// Den Text zu einem gespeicherten Wert finden ('quelle' → 'Quelle').
function auswahlText(feldName, wert) {
  const def = FELD_DEF[feldName];
  if (!def || !def.werte) return String(wert);
  const treffer = def.werte.find(([w]) => w === wert);
  return treffer ? treffer[1] : String(wert);
}

function meter(n) {
  // 1940 → "1.940 m". Der Punkt macht vierstellige Höhen auf einen Blick
  // lesbar. Bewusst de-DE statt de-AT: Österreich trennt mit einem schmalen
  // Leerzeichen, das sieht bei Höhenangaben nach einem Tippfehler aus.
  return Number(n).toLocaleString('de-DE') + ' m';
}

// Hat der Spot eine fertig gerechnete Wanderroute? Entscheidet an mehreren
// Stellen darüber, ob die geschätzte Gehzeit noch gezeigt wird.
function gemesseneRoute(spot) {
  return Array.isArray(spot?.route_line) && spot.route_line.length > 1
         && Number.isFinite(spot.route_minutes);
}

function gehzeit(min) {
  const m = Number(min);
  if (m < 60) return m + ' min';
  const std = Math.floor(m / 60);
  const rest = m % 60;
  return rest ? `${std} h ${rest} min` : `${std} h`;
}

const ANZEIGE = [
  {
    titel: 'Wasser',
    felder: [
      { name: 'water_nearby', sym: '💧', label: 'Wasser in der Nähe',
        wert: (v) => (v ? 'ja' : 'nein'), ton: (v) => (v ? 'gut' : null) },
      { name: 'water_type', sym: '🚰', label: 'Art' },
      { name: 'water_distance_m', sym: '📏', label: 'Entfernung', wert: meter },
      { name: 'water_reliable', sym: '🔁', label: 'Verlässlichkeit',
        ton: (v) => (v === 'unsicher' ? 'warn' : null) },
    ],
  },
  {
    titel: 'Lage',
    felder: [
      { name: 'elevation_m', sym: '⛰️', label: 'Seehöhe', wert: meter },
      { name: 'above_treeline', sym: '🌲', label: 'Über der Baumgrenze',
        wert: (v) => (v ? 'ja' : 'nein') },
      { name: 'has_lake', sym: '🏞️', label: 'See am Spot',
        wert: (v) => (v ? 'ja' : 'nein'), ton: (v) => (v ? 'gut' : null) },
      { name: 'ground_type', sym: '🪨', label: 'Untergrund' },
      { name: 'flat_tent_spots', sym: '⛺', label: 'Platz für' },
      { name: 'exposure', sym: '💨', label: 'Wind',
        ton: (v) => (v === 'exponiert' ? 'warn' : v === 'geschuetzt' ? 'gut' : null) },
    ],
  },
  {
    titel: 'Ressourcen',
    felder: [
      { name: 'firewood_available', sym: '🪵', label: 'Brennholz' },
      { name: 'fire_allowed', sym: '🔥', label: 'Feuer',
        ton: (v) => (v === 'verboten' ? 'warn' : v === 'erlaubt' ? 'gut' : null) },
      { name: 'shelter_nearby', sym: '🏚️', label: 'Unterstand' },
    ],
  },
  {
    titel: 'Fischen',
    felder: [
      { name: 'fishing', sym: '🎣', label: 'Fischen',
        ton: (v) => (v === 'verboten' ? 'warn' : v === 'mit_lizenz' ? 'gut' : null) },
      { name: 'fish_species', sym: '🐟', label: 'Fischarten',
        wert: (v) => v.map((s) => auswahlText('fish_species', s)).join(', ') },
      { name: 'fishing_note', sym: '🎟️', label: 'Karte', wert: (v) => v },
    ],
  },
  {
    titel: 'Praktisches',
    felder: [
      { name: 'access', sym: '🚶', label: 'Anreise' },
      // Die geschätzte Gehzeit verschwindet, sobald die Route gemessen ist:
      // Sie steht dann weiter oben als echte Zahl, und zwei verschiedene
      // Gehzeiten in einem Fenster wären die schlechteste aller Antworten.
      { name: 'hike_minutes', sym: '⏱️', label: 'Gehzeit (geschätzt)', wert: gehzeit,
        nurWenn: (spot) => !gemesseneRoute(spot) },
      { name: 'mobile_signal', sym: '📶', label: 'Handyempfang',
        ton: (v) => (v === 'keiner' ? 'warn' : null) },
      { name: 'discreet', sym: '👁️', label: 'Einsehbarkeit',
        ton: (v) => (v === 'einsehbar' ? 'warn' : v === 'sehr' ? 'gut' : null) },
      { name: 'legal_status', sym: '⚖️', label: 'Rechtlich',
        ton: (v) => (v === 'verboten' ? 'warn' : v === 'erlaubt' ? 'gut' : null) },
      { name: 'season', sym: '🗓️', label: 'Jahreszeit',
        wert: (v) => v.map((s) => auswahlText('season', s)).join(', ') },
    ],
  },
];

// Die Spalten, die geholt werden. location fehlt bewusst: als Geo-Typ käme sie
// nur als unlesbarer Hex-Text zurück. Die Koordinaten stehen ohnehin schon im
// angetippten Kartenpunkt.
const SPALTEN = [
  'id', 'name', 'description', 'created_by', 'created_at',
  'avg_stars', 'rating_count',
  // Der Parkplatz und die dazu gerechnete Wanderroute (route.js). Sie stehen
  // hier statt in ANZEIGE, weil sie keine Merkmalszeile bekommen, sondern
  // einen eigenen Block mit Linie auf der Karte.
  'parking_lat', 'parking_lng',
  'route_line', 'route_minutes', 'route_distance_m',
  'route_ascent_m', 'route_descent_m', 'route_status', 'route_updated_at',
  ...ANZEIGE.flatMap((g) => g.felder.map((f) => f.name)),
].join(',');

// ============================================================================
// 2. DIE BAUSTEINE DER SEITE
// ============================================================================

const detailEl     = document.getElementById('detail');
const detailName   = document.getElementById('detail-name');
const detailKoord  = document.getElementById('detail-koord');
const detailKoerper = document.getElementById('detail-koerper');

// Welcher Spot gerade offen ist. Dient auch dazu, Antworten zu verwerfen, die
// zu spät kommen: wer schnell zwei Spots antippt, soll nicht den ersten
// Inhalt im zweiten Fenster sehen.
let offenerSpot = null;   // { id, lat, lng }

function detailSchliessen() {
  detailEl.hidden = true;
  document.body.classList.remove('detail-offen');
  offenerSpot = null;

  // Die Wanderroute gehört zu diesem einen Spot — sie darf nicht auf der
  // Karte liegen bleiben, wenn die Leiste zu ist.
  if (typeof window.routeAusblenden === 'function') window.routeAusblenden();

  // Teilen-Knopf weg, Adresszeile wieder aufräumen.
  if (typeof window.teilenAbmelden === 'function') window.teilenAbmelden();
}

document.getElementById('detail-zu').onclick = detailSchliessen;

document.addEventListener('keydown', (e) => {
  // Nur schließen, wenn nicht gerade etwas darüber liegt — sonst würde ein
  // Escape im Spot-Formular oder im großen Bild auch die Leiste dahinter
  // zumachen. Escape schließt immer nur die oberste Ebene.
  if (e.key === 'Escape' && !detailEl.hidden &&
      document.getElementById('spot-hg').hidden &&
      document.getElementById('login-hg').hidden &&
      !document.querySelector('.foto-gross')) {
    detailSchliessen();
  }
});

async function koordinatenKopieren() {
  if (!offenerSpot) return;
  const text = `${offenerSpot.lat.toFixed(5)}, ${offenerSpot.lng.toFixed(5)}`;
  try {
    await navigator.clipboard.writeText(text);
    status('Koordinaten kopiert: ' + text, { dauer: 2000 });
  } catch {
    status('Kopieren hat nicht geklappt — der Browser erlaubt es hier nicht.',
           { warnung: true, dauer: 3000 });
  }
}

detailKoord.onclick = koordinatenKopieren;

// ============================================================================
// 3. ÖFFNEN
// ============================================================================

async function spotDetailOeffnen(id, name, lat, lng) {
  offenerSpot = { id, lat, lng };

  detailName.textContent = name;
  detailKoord.textContent = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
  detailKoerper.innerHTML = '<p class="detail-leer">Wird geladen …</p>';
  detailEl.hidden = false;
  document.body.classList.add('detail-offen');
  detailKoerper.scrollTop = 0;

  // Die Route des vorher offenen Spots sofort von der Karte nehmen. Sonst
  // führt sie ein paar Zehntelsekunden lang scheinbar zu diesem hier.
  if (typeof window.routeAusblenden === 'function') window.routeAusblenden();

  // Ab jetzt zeigt der Teilen-Knopf im Kopf auf diesen Spot. Das geschieht
  // sofort und nicht erst nach dem Laden: Der Link steht schon fest, sobald
  // die ID bekannt ist.
  if (typeof window.teilenAnmelden === 'function') window.teilenAnmelden(id);

  // Das Herz zeigt ab jetzt auf diesen Spot. Wie beim Teilen sofort und nicht
  // erst nach dem Laden — der Knopf muss vom ersten Moment an stimmen.
  merkenAnmelden(id);

  freilegen(lat, lng);

  const auth = window.WILDCAMP_AUTH;

  try {
    // Alles gleichzeitig holen — nacheinander wäre es viermal so lang.
    // Die eigene Bewertung gibt es nur, wenn überhaupt jemand angemeldet ist.
    const [spotAntwort, kommentare, fotos, meineSterne] = await Promise.all([
      auth.client.from('spots_with_rating').select(SPALTEN).eq('id', id).single(),
      kommentareHolen(id),
      fotosHolen(id),
      auth.nutzer ? meineBewertungHolen(id, auth.nutzer.id) : Promise.resolve(null),
    ]);

    // Zwischenzeitlich ein anderer Spot angetippt? Dann ist das hier veraltet.
    if (!offenerSpot || offenerSpot.id !== id) return;

    if (spotAntwort.error) throw spotAntwort.error;

    zeichnen(spotAntwort.data, kommentare, meineSterne, fotos);
  } catch (err) {
    if (!offenerSpot || offenerSpot.id !== id) return;
    detailKoerper.innerHTML =
      '<p class="detail-leer">Die Angaben konnten nicht geladen werden.<br>' +
      escapeHtml(err.message || String(err)) + '</p>';
  }
}
window.spotDetailOeffnen = spotDetailOeffnen;

// ----------------------------------------------------------------------------
// Das Herz im Kopf der Leiste
//
// Die Merkliste selbst liegt in screens.js — hier wird nur der Knopf bedient.
// Deshalb die Prüfung auf window.WILDSPOT_MERKEN: Läuft die App einmal ohne
// diese Datei, fehlt eben das Herz, und alles andere geht weiter.
// ----------------------------------------------------------------------------

const merkenKnopf = document.getElementById('detail-merken');

function merkenAnmelden(spotId) {
  if (!merkenKnopf || !window.WILDSPOT_MERKEN) return;

  merkenKnopf.hidden = false;
  merkenKnopf.dataset.merken = spotId;
  merkenKnopf.setAttribute('aria-pressed', String(window.WILDSPOT_MERKEN.hat(spotId)));
}

if (merkenKnopf) {
  merkenKnopf.addEventListener('click', () => {
    const id = merkenKnopf.dataset.merken;
    if (id && window.WILDSPOT_MERKEN) window.WILDSPOT_MERKEN.umschalten(id);
  });
}

// Den Spot ins Sichtbare schieben, falls die Leiste genau darüber liegt.
// Nur dann — eine Karte, die bei jedem Antippen wegspringt, nervt.
function freilegen(lat, lng) {
  const p = karte.project([lng, lat]);
  const schmal = window.innerWidth <= 760;

  if (schmal) {
    // Am Handy deckt das Blatt die unteren drei Viertel ab.
    const grenze = window.innerHeight * 0.24;
    if (p.y > grenze) karte.easeTo({ center: [lng, lat], offset: [0, -window.innerHeight * 0.26], duration: 400 });
  } else {
    const grenze = window.innerWidth - 404;
    if (p.x > grenze) karte.easeTo({ center: [lng, lat], offset: [-200, 0], duration: 400 });
  }
}

// ============================================================================
// 4. DATEN HOLEN
// ============================================================================

async function kommentareHolen(spotId) {
  const auth = window.WILDCAMP_AUTH;

  // Mit dem Namen des Verfassers in einem Rutsch. Die Verknüpfung von
  // comments.user_id auf profiles.id steht im Schema, deshalb kann die
  // Datenbank das mitliefern.
  const { data, error } = await auth.client
    .from('comments')
    .select('id, body, visited_on, created_at, user_id, profiles(username)')
    .eq('spot_id', spotId)
    .order('visited_on', { ascending: false });

  if (!error) return data || [];

  // Klappt die Verknüpfung nicht, lieber Kommentare ohne Namen als gar keine.
  const ohne = await auth.client
    .from('comments')
    .select('id, body, visited_on, created_at, user_id')
    .eq('spot_id', spotId)
    .order('visited_on', { ascending: false });

  if (ohne.error) throw ohne.error;
  return ohne.data || [];
}

async function fotosHolen(spotId) {
  const { data, error } = await window.WILDCAMP_AUTH.client
    .from('spot_photos')
    .select('id, storage_path, uploaded_by, sort_order')
    .eq('spot_id', spotId)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });

  if (error) return [];   // ohne Fotos ist die Seite immer noch brauchbar
  return data || [];
}

// Aus dem gespeicherten Pfad die Adresse machen, unter der das Bild im Netz
// liegt. Der Eimer ist öffentlich, deshalb braucht das keinen Schlüssel.
function fotoAdresse(pfad) {
  return window.WILDCAMP_AUTH.client.storage
    .from('spot-photos')
    .getPublicUrl(pfad).data.publicUrl;
}

async function meineBewertungHolen(spotId, nutzerId) {
  const { data, error } = await window.WILDCAMP_AUTH.client
    .from('ratings')
    .select('stars')
    .eq('spot_id', spotId)
    .eq('user_id', nutzerId)
    .maybeSingle();

  if (error) return null;          // kein Grund, deshalb die ganze Seite zu kippen
  return data ? data.stars : null;
}

// ============================================================================
// 5. ZEICHNEN
// ============================================================================

function zeichnen(spot, kommentare, meineSterne, fotos = []) {
  const teile = [];
  const angemeldet = !!window.WILDCAMP_AUTH.nutzer;

  // Wer den Spot angelegt hat, darf ihn ändern — Admins ebenfalls, die
  // Datenbank erlaubt beiden dasselbe (Migration 013). Steht schon hier oben,
  // weil der Parkplatz-Knopf weit vor dem Bereich "Dein Spot" gebraucht wird.
  const meiner = angemeldet && spot.created_by === window.WILDCAMP_AUTH.nutzer.id;
  const darfAendern = meiner || (angemeldet && window.WILDCAMP_AUTH.nutzer.istAdmin === true);

  // ------------------------------------------------------------- Fotos -----
  // Ganz nach oben: ein Bild sagt über einen Zeltplatz mehr als jede Liste.
  if (fotos.length) {
    const ich = window.WILDCAMP_AUTH.nutzer;
    teile.push('<div class="galerie">');
    for (const f of fotos) {
      const adresse = escapeHtml(fotoAdresse(f.storage_path));
      const meins = ich && f.uploaded_by === ich.id;

      teile.push(
        '<div class="foto-feld">',
        `<button type="button" class="foto" data-gross="${adresse}">` +
        `<img src="${adresse}" alt="Foto vom Spot" loading="lazy">` +
        '</button>',
        // Das eigene Bild kann man wieder entfernen — bei fremden fehlt
        // der Knopf, und die Datenbank würde es ohnehin nicht zulassen.
        meins ? `<button type="button" class="foto-weg" data-foto="${f.id}" ` +
                `data-pfad="${escapeHtml(f.storage_path)}" title="Foto löschen">×</button>` : '',
        '</div>'
      );
    }
    teile.push('</div>');
  }

  // ---------------------------------------------------------- Bewertung -----
  const schnitt = Number(spot.avg_stars) || 0;
  const anzahl = Number(spot.rating_count) || 0;

  teile.push('<div class="schnitt">');
  if (anzahl > 0) {
    teile.push(
      `<span class="zahl">${schnitt.toFixed(1)}</span>`,
      `<span><span class="sterne">${sterne(schnitt)}</span><br>` +
      `<span class="anzahl">${anzahl} ${anzahl === 1 ? 'Bewertung' : 'Bewertungen'}</span></span>`
    );
  } else {
    teile.push(
      `<span class="sterne">${sterne(0)}</span>`,
      '<span class="anzahl">Noch niemand hat bewertet</span>'
    );
  }
  teile.push('</div>');

  // ---------------------------------------------------------- Hinkommen -----
  // Direkt unter der Bewertung: Ist der Spot gut? — und gleich danach: Wie
  // komme ich hin?
  teile.push('<h3>Hinkommen</h3>');
  teile.push(hinkommenHtml(offenerSpot.lat, offenerSpot.lng));

  // ------------------------------------------------------- Wanderroute -----
  // Gleich hinter den beiden Links: die eigene Route vom Parkplatz zum Spot,
  // gerechnet über OpenStreetMap-Wanderwege. Sie braucht nichts nachzuladen —
  // Linie, Gehzeit und Höhenmeter stehen schon im geholten Spot.
  if (typeof window.routeHtml === 'function') {
    teile.push(window.routeHtml(spot, darfAendern));
  }

  // ------------------------------------------------------- Bedingungen -----
  // Gleich nach dem Hinkommen: Wie kalt wird die Nacht, regnet es, wann wird
  // es dunkel. Der Block erscheint sofort leer und füllt sich nach — die
  // Detailansicht soll nicht auf einen fremden Server warten.
  if (typeof window.wetterPlatzhalter === 'function') {
    teile.push(window.wetterPlatzhalter());
  }

  // -------------------------------------------------------- Beschreibung -----
  if (spot.description) {
    teile.push('<h3>Beschreibung</h3>');
    teile.push(`<p class="detail-text">${escapeHtml(spot.description)}</p>`);
  }

  // ----------------------------------------------------------- Merkmale -----
  for (const gruppe of ANZEIGE) {
    const zeilen = [];

    for (const feld of gruppe.felder) {
      const roh = spot[feld.name];

      // Nicht ausgefüllt wird gar nicht erst gezeigt. false und 0 sind aber
      // echte Angaben — deshalb wird hier auf null und undefined geprüft und
      // nicht einfach auf "wahr oder unwahr".
      if (roh === null || roh === undefined) continue;
      if (Array.isArray(roh) && roh.length === 0) continue;

      // Manche Angaben sind nur so lange interessant, wie es nichts Besseres
      // gibt — die geschätzte Gehzeit etwa, solange die Route nicht gemessen ist.
      if (feld.nurWenn && !feld.nurWenn(spot)) continue;

      const text = feld.wert ? feld.wert(roh) : auswahlText(feld.name, roh);
      const ton = feld.ton ? feld.ton(roh) : null;

      // Kurze Werte stehen rechts in derselben Zeile. Lange — eine Liste von
      // Fischarten, ein Hinweis wie "Tageskarte im Gasthof am Seeufer" —
      // rutschen darunter, sonst quetschen sie das Merkmal an den Rand.
      const lang = text.length > 26;

      zeilen.push(
        `<div class="merkmal${lang ? ' lang' : ''}">` +
        `<span class="sym">${feld.sym}</span>` +
        `<span class="was">${feld.label}</span>` +
        `<span class="wert${ton ? ' ' + ton : ''}">${escapeHtml(text)}</span>` +
        '</div>'
      );
    }

    if (zeilen.length) {
      teile.push(`<h3>${gruppe.titel}</h3>`);
      teile.push('<div class="merkmale">' + zeilen.join('') + '</div>');
    }
  }

  // ------------------------------------------------------ Fotos ergänzen -----
  // Der Knopf steht bewusst weit oben, gleich nach den Merkmalen: wer gerade
  // von einem Spot zurückkommt, hat die Bilder noch im Kopf.
  if (angemeldet) {
    teile.push('<h3>Foto hinzufügen</h3>');
    teile.push(
      '<input type="file" id="foto-datei" accept="image/*" multiple hidden>',
      '<button type="button" class="zweit" id="foto-knopf">📷 Fotos auswählen</button>',
      '<p class="detail-leer" id="foto-stand">Mehrere auf einmal gehen auch. ' +
      'Die Bilder sieht jeder — auch ohne Konto.</p>'
    );
  }

  // --------------------------------------------------- Eigene Bewertung -----
  teile.push('<h3>Deine Bewertung</h3>');
  teile.push('<div class="detail-meldung" id="detail-meldung"></div>');

  if (!angemeldet) {
    teile.push(
      '<p class="detail-leer">Zum Bewerten, Kommentieren und für eigene Fotos ' +
      'brauchst du ein Konto — Ansehen geht ohne.</p>',
      '<button type="button" class="zweit" data-anmelden>Anmelden oder Konto anlegen</button>'
    );
  } else {
    teile.push('<div class="meine-sterne" id="meine-sterne">');
    for (let i = 1; i <= 5; i++) {
      const an = meineSterne && i <= meineSterne ? ' an' : '';
      teile.push(`<button type="button" class="stern${an}" data-stern="${i}" ` +
                 `title="${i} von 5" aria-label="${i} von 5 Sternen">★</button>`);
    }
    teile.push('</div>');
    teile.push(meineSterne
      ? `<p class="detail-leer">Du hast <b>${meineSterne} von 5</b> vergeben — ` +
        'ein anderer Stern ändert das. ' +
        '<button class="detail-flach" id="sterne-weg">zurücknehmen</button></p>'
      : '<p class="detail-leer">Noch nicht bewertet — tipp auf einen Stern.</p>');
  }

  // --------------------------------------------------------- Kommentare -----
  teile.push(`<h3>Kommentare${kommentare.length ? ' (' + kommentare.length + ')' : ''}</h3>`);

  if (kommentare.length === 0) {
    teile.push('<p class="detail-leer">Noch keine. Warst du da? ' +
               'Schreib, wie es war — mit Datum, damit andere es einordnen können.</p>');
  } else {
    for (const k of kommentare) {
      teile.push(kommentarHtml(k));
    }
  }

  // ---------------------------------------------------- Neuer Kommentar -----
  if (angemeldet) {
    const heute = new Date().toISOString().slice(0, 10);
    teile.push(
      '<h3>Warst du da?</h3>',
      '<form id="kommentar-form">',
      '<label for="kommentar-datum">Wann warst du da? <span class="pflicht">*</span></label>',
      `<input type="date" id="kommentar-datum" max="${heute}" required>`,
      '<label for="kommentar-text">Wie war es?</label>',
      '<textarea id="kommentar-text" rows="3" maxlength="2000" required ' +
      'placeholder="Wasser da? Boden trocken? Ruhig gewesen?"></textarea>',
      '<button type="submit" class="haupt" id="kommentar-senden">Kommentar speichern</button>',
      '</form>'
    );
  }

  // ------------------------------------------------------- Der eigene Spot -----
  // Ganz unten, hinter allem anderen: Bearbeiten und Löschen sind selten und
  // gewichtig. Wer den Spot nicht angelegt hat, sieht hier gar nichts — die
  // Datenbank würde beides ohnehin ablehnen.
  if (meiner) {
    teile.push(
      '<h3>Dein Spot</h3>',
      '<button type="button" class="zweit" id="spot-bearbeiten">Spot bearbeiten</button>',
      '<button type="button" class="gefahr" id="spot-loeschen">Spot löschen</button>',

      // Die Rückfrage steht im Panel statt in einem Browserfenster: sie kann
      // erklären, was genau verschwindet, statt nur "OK / Abbrechen".
      '<div class="loeschfrage" id="loeschfrage" hidden>',
      '<p><b>Diesen Spot wirklich löschen?</b></p>',
      '<p>Bewertungen, Kommentare und Fotos verschwinden mit. ' +
      'Das lässt sich nicht rückgängig machen.</p>',
      '<div class="loeschfrage-knoepfe">',
      '<button type="button" class="zweit" id="loeschen-nein">Abbrechen</button>',
      '<button type="button" class="gefahr" id="loeschen-ja">Endgültig löschen</button>',
      '</div>',
      '</div>'
    );
  }

  detailKoerper.innerHTML = teile.join('');

  verdrahten(spot, meineSterne, fotos.length, meiner);

  // Erst jetzt, wo der Platzhalter im Dokument steht, die Vorhersage holen.
  // Die Seehöhe kommt mit, damit das Wettermodell auf die richtige Höhe
  // rechnet (Wirkung ist klein, siehe wetter.js).
  if (typeof window.wetterLaden === 'function' && offenerSpot) {
    window.wetterLaden(offenerSpot.lat, offenerSpot.lng, Number(spot.elevation_m));
  }

  // Die Route auf die Karte legen — Linie und Parkplatz. Sie verschwindet
  // wieder, sobald die Leiste zugeht.
  if (typeof window.routeZeichnen === 'function') window.routeZeichnen(spot);
}

// Die zwei Wege zum Spot. Sie beantworten zwei verschiedene Fragen: Google
// Maps bringt einen mit dem Auto samt Verkehrslage bis zum Ausgangspunkt,
// Komoot plant von dort den Weg zu Fuß über markierte Wanderwege.
//
// Beides sind bewusst nur Links, die die jeweilige App öffnen — und nicht
// Routen, die hier auf der Karte gezeichnet werden:
//
//   · Googles Nutzungsbedingungen verbieten es, eine Google-Route auf einer
//     fremden Karte darzustellen. Unsere Karte kommt von basemap.at.
//   · Komoot hat für Außenstehende gar keine offene Schnittstelle, nur
//     Partnerverträge mit Geräteherstellern.
//
// Ein Link ist dagegen bei beiden ausdrücklich vorgesehen, kostet nichts und
// braucht keinen Schlüssel. Eine eigene Wanderroute direkt auf dieser Karte
// ist trotzdem möglich — dafür braucht es einen Routendienst auf
// OpenStreetMap-Basis (siehe KONZEPT.md, Abschnitt 9).
function hinkommenHtml(lat, lng) {
  const ziel = `${lat.toFixed(6)},${lng.toFixed(6)}`;

  // Das offizielle Adressmuster von Google Maps. Am Handy öffnet sich damit
  // die App, am Rechner die Webseite — in beiden Fällen mit gesetztem Ziel.
  const google = 'https://www.google.com/maps/dir/?api=1' +
                 `&destination=${encodeURIComponent(ziel)}&travelmode=driving`;

  // Komoots Tourenplaner, auf diese Stelle der Karte zentriert.
  const komoot = `https://www.komoot.com/plan/@${ziel},14z`;

  return (
    '<div class="hinweg">' +
    `<a class="weg-knopf" href="${google}" target="_blank" rel="noopener">` +
    '<span class="sym">🚗</span><span class="was">Anfahrt<small>Google Maps</small></span></a>' +
    `<a class="weg-knopf" href="${komoot}" target="_blank" rel="noopener">` +
    '<span class="sym">🥾</span><span class="was">Wanderweg<small>Komoot</small></span></a>' +
    '</div>' +
    '<p class="detail-leer">Das Ziel ist der Spot selbst — mit dem Auto kommt ' +
    'man je nach Lage nur in die Nähe. ' +
    '<button type="button" class="detail-flach" id="koord-kopieren">Koordinaten kopieren</button></p>'
  );
}

function kommentarHtml(k) {
  const nutzer = window.WILDCAMP_AUTH.nutzer;
  const name = k.profiles && k.profiles.username ? k.profiles.username : 'Jemand';
  const eigener = nutzer && k.user_id === nutzer.id;

  return (
    `<div class="kommentar" data-id="${k.id}">` +
    '<div class="zeile">' +
    `<span class="wer">${escapeHtml(name)}</span>` +
    `<span class="wann">war da am ${datumText(k.visited_on)}</span>` +
    (eigener ? '<button class="weg" data-loeschen>löschen</button>' : '') +
    '</div>' +
    `<p class="body">${escapeHtml(k.body)}</p>` +
    '</div>'
  );
}

function datumText(iso) {
  // "2026-07-28" → "28. Juli 2026". Der Monat ausgeschrieben, weil bei einem
  // Zustandsbericht die Jahreszeit die eigentliche Information ist.
  const d = new Date(iso + 'T12:00:00');
  if (isNaN(d)) return iso;
  return d.toLocaleDateString('de-AT', { day: 'numeric', month: 'long', year: 'numeric' });
}

// ============================================================================
// 6. DIE KNÖPFE ZUM LEBEN ERWECKEN
//
// Der Inhalt wird bei jedem Öffnen neu gebaut, deshalb werden die Ereignisse
// hier jedes Mal frisch gesetzt.
// ============================================================================

function detailMeldung(text, art = 'info') {
  const el = document.getElementById('detail-meldung');
  if (!el) return;
  el.textContent = text || '';
  el.className = 'detail-meldung' + (text ? ' sichtbar ' + art : '');
}

function verdrahten(spot, meineSterne, anzahlFotos, meiner) {
  const auth = window.WILDCAMP_AUTH;
  const sterneBox = document.getElementById('meine-sterne');

  // Die Knöpfe im Routen-Block: Route ins Bild holen, Parkplatz setzen oder
  // wieder entfernen. Sie sind nach jedem Neuzeichnen frische Elemente.
  if (typeof window.routeVerdrahten === 'function') window.routeVerdrahten(spot);

  // Den eigenen Spot bearbeiten oder löschen.
  if (meiner) {
    const frage = document.getElementById('loeschfrage');

    document.getElementById('spot-bearbeiten').onclick = () => {
      window.spotBearbeiten(spot, offenerSpot.lat, offenerSpot.lng);
    };

    document.getElementById('spot-loeschen').onclick = () => {
      frage.hidden = false;
      frage.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    };

    document.getElementById('loeschen-nein').onclick = () => { frage.hidden = true; };
    document.getElementById('loeschen-ja').onclick = () => spotLoeschen(spot.id, spot.name);
  }

  // Der Kopierknopf unter „Hinkommen" — dieselbe Handlung wie ein Klick auf
  // die Koordinaten im Kopf, aber dort findet sie niemand von selbst.
  const koordKnopf = document.getElementById('koord-kopieren');
  if (koordKnopf) koordKnopf.onclick = koordinatenKopieren;

  // Für Besucher ohne Konto: der Weg zur Anmeldung.
  for (const b of detailKoerper.querySelectorAll('[data-anmelden]')) {
    b.onclick = () => auth.anmeldenZeigen();
  }

  // Ein Foto groß ansehen — und eigene wieder entfernen.
  for (const b of detailKoerper.querySelectorAll('.foto')) {
    b.onclick = () => grossAnsehen(b.dataset.gross);
  }
  for (const b of detailKoerper.querySelectorAll('.foto-weg')) {
    b.onclick = () => {
      b.disabled = true;
      fotoLoeschen(b.dataset.foto, b.dataset.pfad);
    };
  }

  // Fotos aussuchen und hochladen.
  const fotoKnopf = document.getElementById('foto-knopf');
  if (fotoKnopf) {
    const dateiFeld = document.getElementById('foto-datei');
    fotoKnopf.onclick = () => dateiFeld.click();
    dateiFeld.onchange = () => {
      if (dateiFeld.files.length) fotosHochladen(spot.id, [...dateiFeld.files], anzahlFotos);
    };
  }

  // Ohne Konto gibt es weder Sterne noch Kommentarfeld — dann ist hier Schluss.
  if (!sterneBox) return;

  // Beim Darüberfahren die Sterne bis zum Zeiger einfärben — man sieht, was
  // man gleich vergibt, bevor man tippt.
  for (const b of sterneBox.querySelectorAll('button')) {
    const wert = Number(b.dataset.stern);

    b.onmouseenter = () => {
      for (const x of sterneBox.querySelectorAll('button')) {
        x.classList.toggle('bis-hier', Number(x.dataset.stern) <= wert);
      }
    };
    b.onclick = () => bewerten(spot.id, wert);
  }
  sterneBox.onmouseleave = () => {
    for (const x of sterneBox.querySelectorAll('button')) x.classList.remove('bis-hier');
  };

  const weg = document.getElementById('sterne-weg');
  if (weg) weg.onclick = () => bewertungZuruecknehmen(spot.id);

  // Kommentar abschicken.
  document.getElementById('kommentar-form').onsubmit = async (e) => {
    e.preventDefault();

    const datum = document.getElementById('kommentar-datum').value;
    const text = document.getElementById('kommentar-text').value.trim();
    const knopf = document.getElementById('kommentar-senden');

    if (!datum) {
      detailMeldung('Bitte trag ein, wann du dort warst.', 'fehler');
      return;
    }
    if (datum > new Date().toISOString().slice(0, 10)) {
      detailMeldung('Das Datum liegt in der Zukunft.', 'fehler');
      return;
    }
    if (!text) {
      detailMeldung('Schreib noch kurz, wie es war.', 'fehler');
      return;
    }

    knopf.disabled = true;
    detailMeldung('Wird gespeichert …');

    try {
      const { error } = await auth.client.from('comments').insert({
        spot_id: spot.id,
        user_id: auth.nutzer.id,
        body: text,
        visited_on: datum,
      });
      if (error) throw error;

      detailMeldung('');
      status('Kommentar gespeichert.', { dauer: 3000 });
      neuLaden();
    } catch (err) {
      detailMeldung(fehlerText(err), 'fehler');
    } finally {
      knopf.disabled = false;
    }
  };

  // Eigene Kommentare löschen.
  for (const b of detailKoerper.querySelectorAll('[data-loeschen]')) {
    b.onclick = async () => {
      const id = b.closest('.kommentar').dataset.id;
      b.disabled = true;
      try {
        const { error } = await auth.client.from('comments').delete().eq('id', id);
        if (error) throw error;
        status('Kommentar gelöscht.', { dauer: 2500 });
        neuLaden();
      } catch (err) {
        b.disabled = false;
        detailMeldung(fehlerText(err), 'fehler');
      }
    };
  }
}

// ============================================================================
// 7. FOTOS
//
// Ein Handyfoto ist heute 8 bis 12 MB groß. Ungefragt hochgeladen wäre das
// dreierlei ärgerlich: es dauert ewig, es frisst das Datenvolumen unterwegs,
// und der kostenlose Speicher wäre nach 100 Bildern voll.
//
// Deshalb wird jedes Bild vorher im Browser verkleinert — auf 1600 Pixel an
// der langen Seite. Das reicht für jeden Bildschirm und macht aus 8 MB etwa
// 300 KB. Hochgeladen wird also ein Dreißigstel.
// ============================================================================

const FOTO_KANTE = 1600;
const FOTO_GUETE = 0.82;

async function verkleinern(datei) {
  // createImageBitmap dreht das Bild anhand der EXIF-Angabe gleich richtig
  // herum. Ohne das läge jedes Hochkant-Foto vom Handy auf der Seite.
  const bild = await createImageBitmap(datei, { imageOrientation: 'from-image' });

  const faktor = Math.min(1, FOTO_KANTE / Math.max(bild.width, bild.height));
  const breite = Math.round(bild.width * faktor);
  const hoehe = Math.round(bild.height * faktor);

  const flaeche = document.createElement('canvas');
  flaeche.width = breite;
  flaeche.height = hoehe;
  flaeche.getContext('2d').drawImage(bild, 0, 0, breite, hoehe);
  bild.close();

  const blob = await new Promise((fertig) =>
    flaeche.toBlob(fertig, 'image/jpeg', FOTO_GUETE));

  if (!blob) throw new Error('Das Bild konnte nicht umgewandelt werden.');
  return blob;
}

// Ein einzelnes Bild verkleinern, ablegen und eintragen. Steht für sich,
// damit auch das Anlegen-Formular es benutzen kann: Wer einen Spot aus einem
// Foto anlegt, soll das Bild nicht danach noch einmal aussuchen müssen.
async function einFotoHochladen(spotId, datei, platz) {
  const auth = window.WILDCAMP_AUTH;

  if (!datei.type.startsWith('image/')) {
    throw new Error(`„${datei.name}" ist kein Bild.`);
  }

  const klein = await verkleinern(datei);

  // Pfad nach der Konvention aus schema.sql: eigene Nutzer-ID zuerst.
  // Genau darauf baut die Regel auf, die fremde Ordner verbietet.
  const pfad = `${auth.nutzer.id}/${spotId}/${crypto.randomUUID()}.jpg`;

  const hoch = await auth.client.storage
    .from('spot-photos')
    .upload(pfad, klein, { contentType: 'image/jpeg', upsert: false });
  if (hoch.error) throw hoch.error;

  // Erst wenn die Datei liegt, kommt der Eintrag in die Tabelle. Anders
  // herum stünde bei einem Abbruch ein Eintrag ohne Bild dahinter.
  const { error } = await auth.client.from('spot_photos').insert({
    spot_id: spotId,
    uploaded_by: auth.nutzer.id,
    storage_path: pfad,
    sort_order: platz,
  });
  if (error) {
    // Der Eintrag ging schief — dann soll auch die Datei nicht liegen
    // bleiben, sonst sammelt sich unsichtbarer Müll im Speicher an.
    await auth.client.storage.from('spot-photos').remove([pfad]).catch(() => {});
    throw error;
  }
}
window.einFotoHochladen = einFotoHochladen;

async function fotosHochladen(spotId, dateien, schonDa) {
  const auth = window.WILDCAMP_AUTH;
  if (!auth.nutzer) { auth.anmeldenZeigen(); return; }

  const knopf = document.getElementById('foto-knopf');
  const stand = document.getElementById('foto-stand');
  knopf.disabled = true;

  let fertig = 0;

  try {
    for (const datei of dateien) {
      fertig++;
      stand.textContent = dateien.length > 1
        ? `Bild ${fertig} von ${dateien.length} wird hochgeladen …`
        : 'Bild wird hochgeladen …';

      await einFotoHochladen(spotId, datei, schonDa + fertig);
    }

    status(dateien.length > 1 ? `${dateien.length} Fotos hinzugefügt.` : 'Foto hinzugefügt.',
           { dauer: 3000 });
    neuLaden();

  } catch (err) {
    knopf.disabled = false;
    stand.textContent = '';
    detailMeldung(fotoFehlerText(err), 'fehler');
  }
}

function fotoFehlerText(err) {
  const m = (err && err.message ? err.message : String(err)).toLowerCase();

  if (m.includes('exceeded the maximum allowed size') || m.includes('payload too large')) {
    return 'Das Bild ist selbst verkleinert noch zu groß. Versuch ein anderes.';
  }
  if (m.includes('mime type') || m.includes('invalid_mime')) {
    return 'Dieses Bildformat wird nicht angenommen. JPG, PNG oder WebP gehen.';
  }
  if (m.includes('row-level security') || m.includes('violates row-level')) {
    return 'Der Speicher hat das abgelehnt. Melde dich einmal ab und wieder an.';
  }
  if (m.includes('bucket not found')) {
    return 'Der Fotospeicher fehlt. In der Datenbank muss db/008-fotos.sql laufen.';
  }
  return fehlerText(err);
}

async function fotoLoeschen(fotoId, pfad) {
  const auth = window.WILDCAMP_AUTH;
  try {
    // Zuerst die Datei, dann der Eintrag. Bleibt die Datei liegen, sieht man
    // sie nirgends mehr — ein verwaister Eintrag wäre dagegen ein Loch in
    // der Galerie.
    const weg = await auth.client.storage.from('spot-photos').remove([pfad]);
    if (weg.error) throw weg.error;

    const { error } = await auth.client.from('spot_photos').delete().eq('id', fotoId);
    if (error) throw error;

    status('Foto gelöscht.', { dauer: 2500 });
    neuLaden();
  } catch (err) {
    detailMeldung(fotoFehlerText(err), 'fehler');
  }
}

// Ein Bild bildschirmfüllend ansehen. Irgendwohin tippen schließt es wieder.
function grossAnsehen(adresse) {
  const hg = document.createElement('div');
  hg.className = 'foto-gross';
  hg.innerHTML = `<img src="${escapeHtml(adresse)}" alt="Foto vom Spot">`;

  const zu = () => {
    hg.remove();
    document.removeEventListener('keydown', beiTaste);
  };
  const beiTaste = (e) => { if (e.key === 'Escape') zu(); };

  hg.onclick = zu;
  document.addEventListener('keydown', beiTaste);
  document.body.appendChild(hg);
}

// ============================================================================
// 8. BEWERTEN
// ============================================================================

async function bewerten(spotId, sterneZahl) {
  const auth = window.WILDCAMP_AUTH;
  if (!auth.nutzer) { auth.anmeldenZeigen(); return; }

  // Sofort einfärben, ohne auf den Server zu warten. Geht es schief, wird
  // beim Neuladen ohnehin der echte Stand gezeigt.
  const box = document.getElementById('meine-sterne');
  for (const x of box.querySelectorAll('button')) {
    x.classList.toggle('an', Number(x.dataset.stern) <= sterneZahl);
  }
  detailMeldung('Wird gespeichert …');

  try {
    // upsert statt insert: wer schon bewertet hat, ändert seine Bewertung.
    // Die Regel unique(spot_id, user_id) im Schema macht das möglich.
    const { error } = await auth.client
      .from('ratings')
      .upsert(
        { spot_id: spotId, user_id: auth.nutzer.id, stars: sterneZahl },
        { onConflict: 'spot_id,user_id' }
      );
    if (error) throw error;

    detailMeldung('');
    status(`${sterneZahl} ${sterneZahl === 1 ? 'Stern' : 'Sterne'} vergeben.`, { dauer: 2500 });
    neuLaden();
    spotsLaden();   // die Farbe des Punktes auf der Karte hängt am Schnitt
  } catch (err) {
    detailMeldung(fehlerText(err), 'fehler');
  }
}

async function bewertungZuruecknehmen(spotId) {
  const auth = window.WILDCAMP_AUTH;
  try {
    const { error } = await auth.client
      .from('ratings')
      .delete()
      .eq('spot_id', spotId)
      .eq('user_id', auth.nutzer.id);
    if (error) throw error;

    status('Bewertung zurückgenommen.', { dauer: 2500 });
    neuLaden();
    spotsLaden();
  } catch (err) {
    detailMeldung(fehlerText(err), 'fehler');
  }
}

// ============================================================================
// 9. DEN EIGENEN SPOT LÖSCHEN
//
// In der Datenbank hängt alles am Spot: Bewertungen, Kommentare und die
// Foto-Einträge verschwinden automatisch mit ihm (so steht es im Schema).
//
// Was NICHT automatisch geht, sind die Bilddateien selbst — die liegen im
// Speicher und nicht in einer Tabelle. Die müssen von Hand weg, sonst bleibt
// unsichtbarer Ballast liegen und der Platz füllt sich mit Bildern, die zu
// nichts mehr gehören.
// ============================================================================

async function spotLoeschen(spotId, name) {
  const auth = window.WILDCAMP_AUTH;
  const knopf = document.getElementById('loeschen-ja');

  knopf.disabled = true;
  detailMeldung('Wird gelöscht …');

  try {
    // Erst die Bilddateien, solange die Einträge dazu noch existieren.
    const fotos = await fotosHolen(spotId);

    // Löschen darf man im Speicher nur den eigenen Ordner. Bei fremden Fotos
    // am eigenen Spot bleibt die Datei deshalb liegen — erreichbar ist sie
    // danach über nichts mehr, weil ihr Eintrag mit dem Spot verschwindet.
    const meineBilder = fotos
      .filter((f) => f.uploaded_by === auth.nutzer.id)
      .map((f) => f.storage_path);

    if (meineBilder.length) {
      await auth.client.storage.from('spot-photos').remove(meineBilder);
    }

    const { error } = await auth.client.from('spots').delete().eq('id', spotId);
    if (error) throw error;

    detailSchliessen();
    status(`Spot „${name}" gelöscht.`, { dauer: 4000 });
    spotsLaden();

  } catch (err) {
    knopf.disabled = false;
    detailMeldung(fehlerText(err), 'fehler');
  }
}

// Nach dem Bearbeiten zeigt die Leiste sonst weiter den alten Stand.
window.spotDetailAktualisieren = (id, name) => {
  if (!offenerSpot || offenerSpot.id !== id) return;
  detailName.textContent = name;
  neuLaden();
};

// Nach jeder Änderung alles frisch holen — dann stimmen Schnitt, Anzahl und
// Kommentarliste garantiert mit der Datenbank überein.
function neuLaden() {
  if (!offenerSpot) return;
  spotDetailOeffnen(offenerSpot.id, detailName.textContent, offenerSpot.lat, offenerSpot.lng);
}

function fehlerText(err) {
  const m = (err && err.message ? err.message : String(err)).toLowerCase();

  if (m.includes('row-level security') || m.includes('violates row-level')) {
    return 'Die Datenbank hat das abgelehnt. Melde dich einmal ab und wieder an.';
  }
  if (m.includes('comments_body_check')) {
    return 'Der Kommentar ist zu lang — höchstens 2.000 Zeichen.';
  }
  if (m.includes('duplicate key') && m.includes('ratings')) {
    return 'Du hast diesen Spot schon bewertet. Lade die Seite einmal neu.';
  }
  if (m.includes('failed to fetch') || m.includes('network')) {
    return 'Keine Verbindung zum Server. Internet prüfen.';
  }
  return err && err.message ? err.message : 'Unbekannter Fehler.';
}

// Meldet sich jemand an oder ab, während ein Spot offen ist, wird die Leiste
// neu gezeichnet. Der Spot bleibt in beiden Fällen sichtbar — nur die Knöpfe
// zum Bewerten, Kommentieren und für Fotos kommen dazu oder fallen weg.
window.WILDCAMP_AUTH.beiWechsel.push(() => {
  if (!detailEl.hidden) neuLaden();
});
