// ============================================================================
// Einen Spot anlegen
//
// Die Position ist immer die Kartenmitte — das Fadenkreuz. Wer den Spot
// woanders haben will, schiebt vorher die Karte.
//
// Die Felder unten sind 1:1 die Liste aus KONZEPT.md, Abschnitt 3. Sie stehen
// hier als Daten, nicht als HTML: eine neue Auswahlmöglichkeit ist damit eine
// Zeile hier plus eine Zeile im CHECK der Datenbank — sonst nichts.
//
// Alles außer dem Namen ist freiwillig. Leere Felder werden gar nicht erst
// mitgeschickt, damit in der Datenbank NULL steht und nicht ein erfundener
// Wert.
// ============================================================================

'use strict';

// ============================================================================
// 1. DIE FELDER
//
// typ 'auswahl' → Klappliste, 'janein' → Ja/Nein/keine Angabe,
// 'zahl' → Zahlenfeld, 'mehrfach' → Kästchen zum Ankreuzen,
// 'text' → einzeilige Eingabe
// ============================================================================

const GRUPPEN = [
  {
    titel: 'Wasser',
    felder: [
      { name: 'water_nearby', label: 'Wasser in der Nähe?', typ: 'janein' },
      { name: 'water_type', label: 'Was für Wasser?', typ: 'auswahl', werte: [
        ['bach', 'Bach'], ['quelle', 'Quelle'], ['see', 'See'],
        ['brunnen', 'Brunnen'], ['huette', 'Hütte'], ['keins', 'keins'],
      ]},
      { name: 'water_distance_m', label: 'Entfernung in Metern (geschätzt)',
        typ: 'zahl', min: 0, max: 20000 },
      { name: 'water_reliable', label: 'Wie verlässlich?', typ: 'auswahl', werte: [
        ['ganzjaehrig', 'ganzjährig'], ['fruehjahr_sommer', 'nur Frühjahr–Sommer'],
        ['unsicher', 'unsicher'],
      ]},
    ],
  },
  {
    titel: 'Lage',
    felder: [
      { name: 'elevation_m', label: 'Seehöhe in Metern', typ: 'zahl', min: 0, max: 4000,
        hinweis: 'Wird automatisch vorgeschlagen — du kannst ihn überschreiben.' },
      { name: 'above_treeline', label: 'Über der Baumgrenze?', typ: 'janein' },
      { name: 'has_lake', label: 'See direkt am Spot?', typ: 'janein' },
      { name: 'ground_type', label: 'Untergrund', typ: 'auswahl', werte: [
        ['wiese', 'Wiese'], ['schotter', 'Schotter'], ['waldboden', 'Waldboden'],
        ['fels', 'Fels'], ['moor', 'Moor'],
      ]},
      { name: 'flat_tent_spots', label: 'Platz für wie viele Zelte?', typ: 'auswahl', werte: [
        ['1', '1 Zelt'], ['2-3', '2–3 Zelte'], ['4+', '4 und mehr'],
      ]},
      { name: 'exposure', label: 'Wind', typ: 'auswahl', werte: [
        ['geschuetzt', 'windgeschützt'], ['halb', 'halb geschützt'], ['exponiert', 'exponiert'],
      ]},
    ],
  },
  {
    titel: 'Ressourcen',
    felder: [
      { name: 'firewood_available', label: 'Brennholz', typ: 'auswahl', werte: [
        ['viel', 'viel'], ['etwas', 'etwas'], ['keins', 'keins'],
      ]},
      { name: 'fire_allowed', label: 'Feuer', typ: 'auswahl', werte: [
        ['unklar', 'unklar'], ['erlaubt', 'erlaubt'], ['verboten', 'verboten'],
      ], standard: 'unklar',
        hinweis: 'Feuer ist in Österreich im Wald grundsätzlich verboten. ' +
                 'Bei Waldbrandgefahr gilt das überall — im Zweifel: kein Feuer.',
        hinweisArt: 'warn' },
      { name: 'shelter_nearby', label: 'Unterstand in der Nähe', typ: 'auswahl', werte: [
        ['biwakschachtel', 'Biwakschachtel'], ['huette', 'Hütte'],
        ['felsueberhang', 'Felsüberhang'], ['nichts', 'nichts'],
      ]},
    ],
  },
  {
    titel: 'Fischen',
    felder: [
      { name: 'fishing', label: 'Kann man hier fischen?', typ: 'auswahl', werte: [
        ['mit_lizenz', 'ja, mit Lizenz'],
        ['verboten', 'nein, verboten'],
        ['unklar', 'unklar'],
      ], standard: 'unklar',
        hinweis: 'In Österreich gibt es kein frei befischbares Gewässer. Du brauchst ' +
                 'immer die staatliche Fischerkarte UND die Erlaubnis des ' +
                 'Bewirtschafters. Ohne beides ist es Fischwilderei — ' +
                 'strafbar, nicht bloß eine Verwaltungsstrafe.',
        hinweisArt: 'warn' },

      { name: 'fish_species', label: 'Was schwimmt drin?', typ: 'mehrfach', werte: [
        ['bachforelle', 'Bachforelle'], ['regenbogenforelle', 'Regenbogenforelle'],
        ['seeforelle', 'Seeforelle'], ['saibling', 'Saibling'],
        ['aesche', 'Äsche'], ['huchen', 'Huchen'],
        ['renke', 'Renke'], ['hecht', 'Hecht'],
        ['barsch', 'Barsch'], ['karpfen', 'Karpfen'],
        ['schleie', 'Schleie'], ['aitel', 'Aitel'],
      ]},

      { name: 'fishing_note', label: 'Wo bekommt man die Karte?', typ: 'text', max: 300,
        platzhalter: 'z. B. Tageskarte im Gasthof am Seeufer, 25 €',
        hinweis: 'Die nützlichste Angabe für alle nach dir — ohne sie sucht ' +
                 'jeder von vorne.' },
    ],
  },
  {
    titel: 'Praktisches',
    felder: [
      { name: 'access', label: 'Anreise', typ: 'auswahl', werte: [
        ['auto', 'Auto direkt hin'], ['kurze_wanderung', 'kurze Wanderung'],
        ['lange_wanderung', 'lange Wanderung'],
      ]},
      { name: 'hike_minutes', label: 'Gehzeit in Minuten', typ: 'zahl', min: 0, max: 1440 },
      { name: 'mobile_signal', label: 'Handyempfang', typ: 'auswahl', werte: [
        ['gut', 'gut'], ['schwach', 'schwach'], ['keiner', 'keiner'],
      ]},
      { name: 'discreet', label: 'Einsehbarkeit', typ: 'auswahl', werte: [
        ['sehr', 'sehr diskret'], ['mittel', 'mittel'], ['einsehbar', 'einsehbar'],
      ]},
      { name: 'legal_status', label: 'Rechtlicher Status', typ: 'auswahl', werte: [
        ['unklar', 'unklar'], ['erlaubt', 'erlaubt'], ['geduldet', 'geduldet'],
        ['verboten', 'verboten'],
      ], standard: 'unklar',
        hinweis: 'Das ist deine Einschätzung, keine Rechtsauskunft. ' +
                 'Im Zweifel bleibt es bei „unklar".' },
      { name: 'season', label: 'Wann geht das?', typ: 'mehrfach', werte: [
        ['fruehling', 'Frühling'], ['sommer', 'Sommer'],
        ['herbst', 'Herbst'], ['winter', 'Winter'],
      ]},
    ],
  },
];

// ============================================================================
// 2. DIE FELDER BAUEN
// ============================================================================

// Alle Felder, die genau einen Wert tragen — Klapplisten, Zahlen, Textzeilen.
// Sie werden überall gleich behandelt: einsammeln, füllen, leeren.
const EINZELFELDER =
  'select[data-feld], input[data-feld][type="number"], input[data-feld][type="text"]';

// Die Felder mit Kästchen zum Ankreuzen, aus der Liste oben gelesen.
const MEHRFACH_FELDER = GRUPPEN
  .flatMap((g) => g.felder)
  .filter((f) => f.typ === 'mehrfach')
  .map((f) => f.name);

const spotHg         = document.getElementById('spot-hg');
const spotForm       = document.getElementById('spot-form');
const spotGruppen    = document.getElementById('spot-gruppen');
const spotPosition   = document.getElementById('spot-position');
const spotMeldung    = document.getElementById('spot-meldung');
const spotSpeichern  = document.getElementById('spot-speichern');
const spotName       = document.getElementById('spot-name');
const spotBeschreib  = document.getElementById('spot-beschreibung');
const spotTitel      = document.getElementById('spot-titel');
const knopfAnlegen   = document.getElementById('knopf-spot-anlegen');
const ausFotoKasten  = document.getElementById('aus-foto');
const ortFotoKnopf   = document.getElementById('ort-foto-knopf');
const ortFotoDatei   = document.getElementById('ort-foto-datei');
const ortFotoStand   = document.getElementById('ort-foto-stand');

for (const gruppe of GRUPPEN) {
  const details = document.createElement('details');
  const summary = document.createElement('summary');
  summary.textContent = gruppe.titel;
  details.appendChild(summary);

  const inhalt = document.createElement('div');

  for (const feld of gruppe.felder) {
    const label = document.createElement('label');
    label.textContent = feld.label;
    label.htmlFor = 'f-' + feld.name;
    inhalt.appendChild(label);

    if (feld.typ === 'mehrfach') {
      // Kästchen zum Ankreuzen, mehrere gleichzeitig möglich.
      label.removeAttribute('for');
      const box = document.createElement('div');
      box.className = 'kaestchen';
      for (const [wert, text] of feld.werte) {
        const l = document.createElement('label');
        const i = document.createElement('input');
        i.type = 'checkbox';
        i.value = wert;
        i.dataset.feld = feld.name;
        l.appendChild(i);
        l.appendChild(document.createTextNode(text));
        box.appendChild(l);
      }
      inhalt.appendChild(box);

    } else if (feld.typ === 'zahl') {
      const i = document.createElement('input');
      i.type = 'number';
      i.id = 'f-' + feld.name;
      i.dataset.feld = feld.name;
      i.min = feld.min;
      i.max = feld.max;
      i.inputMode = 'numeric';
      inhalt.appendChild(i);

    } else if (feld.typ === 'text') {
      const i = document.createElement('input');
      i.type = 'text';
      i.id = 'f-' + feld.name;
      i.dataset.feld = feld.name;
      if (feld.max) i.maxLength = feld.max;
      if (feld.platzhalter) i.placeholder = feld.platzhalter;
      inhalt.appendChild(i);

    } else {
      // Klappliste. Der erste Eintrag ist immer "keine Angabe" — nur so kann
      // man ein Feld bewusst leer lassen.
      const s = document.createElement('select');
      s.id = 'f-' + feld.name;
      s.dataset.feld = feld.name;

      const leer = document.createElement('option');
      leer.value = '';
      leer.textContent = 'keine Angabe';
      s.appendChild(leer);

      const werte = feld.typ === 'janein'
        ? [['true', 'Ja'], ['false', 'Nein']]
        : feld.werte;

      for (const [wert, text] of werte) {
        const o = document.createElement('option');
        o.value = wert;
        o.textContent = text;
        s.appendChild(o);
      }
      if (feld.standard) s.value = feld.standard;
      inhalt.appendChild(s);
    }

    if (feld.hinweis) {
      const p = document.createElement('p');
      p.className = 'feld-hinweis' + (feld.hinweisArt === 'warn' ? ' warn' : '');
      p.textContent = feld.hinweis;
      p.id = 'hinweis-' + feld.name;
      inhalt.appendChild(p);
    }
  }

  details.appendChild(inhalt);
  spotGruppen.appendChild(details);
}

// ============================================================================
// 3. FENSTER ÖFFNEN UND SCHLIESSEN
// ============================================================================

let spotKoordinaten = null;   // { lat, lng } — festgehalten beim Öffnen

// Ist eine ID gesetzt, wird ein bestehender Spot bearbeitet statt ein neuer
// angelegt. Dasselbe Formular, nur ein anderes Ziel beim Speichern.
let bearbeiteId = null;

// Das Foto, aus dem die Position kam. Es wird nach dem Speichern gleich als
// erstes Bild des Spots abgelegt — wer es schon ausgesucht hat, soll es nicht
// hinterher noch einmal suchen müssen.
let fotoVomOrt = null;

function spotMeldungSetzen(text, art = 'info') {
  spotMeldung.textContent = text || '';
  spotMeldung.className = 'login-meldung' + (text ? ' sichtbar ' + art : '');
}

knopfAnlegen.onclick = () => {
  // Ohne Konto geht es nicht weiter — die Datenbank hängt jeden Spot an einen
  // Nutzer. Statt einer Fehlermeldung gleich das Anmeldefenster.
  if (!window.WILDCAMP_AUTH.nutzer) {
    window.WILDCAMP_AUTH.anmeldenZeigen();
    return;
  }

  const c = karte.getCenter();

  bearbeiteId = null;
  spotTitel.textContent = 'Neuer Spot';
  spotSpeichern.textContent = 'Spot speichern';
  spotFormularLeeren();
  ortAusFotoZuruecksetzen();
  ausFotoKasten.hidden = false;
  spotPosition.textContent =
    `Position: ${c.lat.toFixed(5)}, ${c.lng.toFixed(5)} — das Fadenkreuz auf der Karte.`;

  spotKoordinaten = { lat: c.lat, lng: c.lng };
  spotMeldungSetzen('');
  spotHg.hidden = false;
  spotName.focus();

  hoeheVorschlagen(c.lat, c.lng);
};

// ============================================================================
// 3b. EINEN BESTEHENDEN SPOT BEARBEITEN
//
// Aufgerufen aus der Detail-Leiste. Die Werte kommen von dort mit — der Spot
// ist zum Anzeigen ohnehin schon geladen, ein zweites Mal holen wäre unnötig.
//
// Die Position bleibt, wie sie ist: Sie wurde einmal am Fadenkreuz gesetzt,
// und ein Spot, der beim Bearbeiten heimlich zur aktuellen Kartenmitte
// wandert, wäre die unangenehmste Überraschung, die diese App bieten könnte.
// ============================================================================

function spotBearbeiten(spot, lat, lng) {
  if (!window.WILDCAMP_AUTH.nutzer) {
    window.WILDCAMP_AUTH.anmeldenZeigen();
    return;
  }

  bearbeiteId = spot.id;
  spotTitel.textContent = 'Spot bearbeiten';
  spotSpeichern.textContent = 'Änderungen speichern';
  spotPosition.textContent =
    `Position: ${lat.toFixed(5)}, ${lng.toFixed(5)} — bleibt unverändert.`;
  spotKoordinaten = null;   // beim Bearbeiten wird die Position nicht angefasst

  // Der Weg über das Foto setzt eine Position — beim Bearbeiten gibt es
  // deshalb nichts zu holen, und der Kasten verschwindet.
  ortAusFotoZuruecksetzen();
  ausFotoKasten.hidden = true;

  spotFormularLeeren();
  spotName.value = spot.name || '';
  spotBeschreib.value = spot.description || '';

  // Klapplisten, Zahlen und Textzeilen aus dem Spot füllen.
  for (const el of spotForm.querySelectorAll(EINZELFELDER)) {
    const wert = spot[el.dataset.feld];
    el.value = (wert === null || wert === undefined) ? '' : String(wert);
  }

  // Die Mehrfachauswahlen sind Listen — Jahreszeiten, Fischarten.
  for (const feld of MEHRFACH_FELDER) {
    const liste = Array.isArray(spot[feld]) ? spot[feld] : [];
    for (const el of spotForm.querySelectorAll(`input[type="checkbox"][data-feld="${feld}"]`)) {
      el.checked = liste.includes(el.value);
    }
  }

  // Gruppen aufklappen, in denen etwas steht — sonst sucht man seine eigenen
  // Angaben hinter vier zugeklappten Überschriften.
  for (const d of spotForm.querySelectorAll('details')) {
    const gefuellt = [...d.querySelectorAll('select[data-feld], input[data-feld]')]
      .some((el) => (el.type === 'checkbox' ? el.checked : el.value !== ''));
    d.open = gefuellt;
  }

  // Beim Bearbeiten keine Seehöhe nachschlagen: der eingetragene Wert ist die
  // Angabe des Nutzers und darf nicht stillschweigend überschrieben werden.
  const hinweis = document.getElementById('hinweis-elevation_m');
  if (hinweis) {
    hinweis.textContent = 'Beim Anlegen automatisch ermittelt — du kannst ihn ändern.';
    hinweis.classList.remove('warn');
  }

  spotMeldungSetzen('');
  spotHg.hidden = false;
  spotName.focus();
}
window.spotBearbeiten = spotBearbeiten;

// Beim Schließen endet auch der Bearbeiten-Modus. Ohne das könnte ein danach
// angelegter "neuer" Spot in Wahrheit den zuletzt bearbeiteten überschreiben.
function spotFensterSchliessen() {
  spotHg.hidden = true;
  bearbeiteId = null;
  fotoVomOrt = null;   // sonst hinge das Bild am nächsten Spot
}

document.getElementById('spot-schliessen').onclick = spotFensterSchliessen;
spotHg.onclick = (e) => { if (e.target === spotHg) spotFensterSchliessen(); };
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !spotHg.hidden) spotFensterSchliessen();
});

// Der Knopf heißt anders, je nachdem ob jemand angemeldet ist.
function spotKnopfAnpassen(nutzer) {
  knopfAnlegen.innerHTML = nutzer
    ? '<span class="plus">+</span> Spot hier anlegen'
    : '<span class="plus">+</span> Spot anlegen — anmelden';
}
window.spotKnopfAnpassen = spotKnopfAnpassen;

// Falls die Anmeldung schon durch war, bevor diese Datei geladen wurde.
spotKnopfAnpassen(window.WILDCAMP_AUTH.nutzer);

// ============================================================================
// 3c. DEN ORT AUS EINEM FOTO ÜBERNEHMEN
//
// Der bequemste Weg, einen Spot anzulegen: Man kommt zurück, hat das Bild vom
// Zeltplatz im Handy — und die Kamera hat die Koordinaten längst hineingelegt.
// Statt die Karte mühsam an die richtige Stelle zu schieben, sucht man das
// Foto aus, und alles Weitere passiert von selbst.
//
// Das Bild wird dabei nicht hochgeladen, sondern nur im Browser gelesen
// (siehe foto-ort.js). Erst wenn der Spot gespeichert ist, wandert es mit.
// ============================================================================

function ortFotoStandSetzen(text, art = '') {
  ortFotoStand.textContent = text;
  ortFotoStand.className = 'hinweis-klein' + (art ? ' ' + art : '');
}

// Der Knopf sagt immer, was er gerade tut: Solange kein Bild angenommen wurde,
// lädt er zum ersten ein — danach bietet er den Wechsel an.
function ortFotoKnopfBeschriften() {
  ortFotoKnopf.textContent = fotoVomOrt
    ? '📍 Anderes Foto wählen'
    : '📍 Ort aus einem Foto übernehmen';
}

function ortAusFotoZuruecksetzen() {
  fotoVomOrt = null;
  ortFotoDatei.value = '';
  ortFotoKnopf.disabled = false;
  ortFotoKnopfBeschriften();
  ortFotoStandSetzen(
    'Fast jedes Handyfoto weiß, wo es aufgenommen wurde. Das Bild bleibt ' +
    'dabei auf deinem Gerät — und wird gleich als erstes Foto des Spots ' +
    'gespeichert.'
  );
}

ortFotoKnopf.onclick = () => ortFotoDatei.click();

ortFotoDatei.onchange = async () => {
  const datei = ortFotoDatei.files[0];
  if (!datei) return;

  ortFotoKnopf.disabled = true;
  ortFotoStandSetzen('Bild wird gelesen …');

  const ort = await window.ortAusFoto(datei);

  if (!ort) {
    // Häufigster Grund: Der Ortungsdienst war beim Fotografieren aus, oder das
    // Bild ging vorher durch WhatsApp — das entfernt die Koordinaten.
    //
    // Wichtig: Ein Bild ohne Ort wirft nichts um. Wer vorher schon ein
    // brauchbares Foto gewählt hatte, behält dessen Position und Bild — sonst
    // würde ein Fehlgriff die halbe Eingabe löschen.
    ortFotoDatei.value = '';
    ortFotoKnopf.disabled = false;
    ortFotoKnopfBeschriften();
    ortFotoStandSetzen(
      'In diesem Bild steckt kein Ort. Das passiert, wenn beim Fotografieren ' +
      'die Ortung aus war oder das Bild über WhatsApp verschickt wurde. ' +
      (fotoVomOrt
        ? 'Es bleibt beim vorher gewählten Foto.'
        : 'Schieb die Karte einfach von Hand an die richtige Stelle.'),
      'warn'
    );
    return;
  }

  // Position übernehmen und die Karte mitnehmen, damit man sieht, wohin es
  // geht. Das Fenster bleibt offen — es liegt ja über der Karte.
  spotKoordinaten = { lat: ort.lat, lng: ort.lng };
  fotoVomOrt = datei;

  karte.flyTo({ center: [ort.lng, ort.lat], zoom: Math.max(karte.getZoom(), 14), duration: 900 });

  spotPosition.textContent =
    `Position: ${ort.lat.toFixed(5)}, ${ort.lng.toFixed(5)} — aus dem Foto übernommen.`;

  // Ein Foto aus dem Italienurlaub soll nicht wortlos einen Spot bei Rom
  // anlegen. Der Rahmen ist derselbe, den auch die Karte benutzt (app.js).
  const [westen, sueden, osten, norden] = OESTERREICH;
  const drin = ort.lat >= sueden && ort.lat <= norden &&
               ort.lng >= westen && ort.lng <= osten;

  ortFotoKnopfBeschriften();
  ortFotoKnopf.disabled = false;

  if (drin) {
    ortFotoStandSetzen(
      `Ort gefunden: ${ort.lat.toFixed(5)}, ${ort.lng.toFixed(5)}. ` +
      'Das Bild wird beim Speichern gleich mit abgelegt.',
      'gut'
    );
  } else {
    ortFotoStandSetzen(
      `Ort gefunden: ${ort.lat.toFixed(5)}, ${ort.lng.toFixed(5)} — der liegt ` +
      'außerhalb Österreichs. Stimmt das Foto? Sonst wähl ein anderes.',
      'warn'
    );
  }

  // Die Seehöhe gehört zur neuen Position, nicht zur alten Kartenmitte.
  hoeheVorschlagen(ort.lat, ort.lng);
};

// ============================================================================
// 4. SEEHÖHE AUTOMATISCH VORSCHLAGEN
//
// Kleiner Aufwand, fühlt sich magisch an (KONZEPT.md, Abschnitt 5). Klappt es
// nicht, bleibt das Feld einfach leer — es ist ja freiwillig.
// ============================================================================

async function hoeheVorschlagen(lat, lng) {
  const feld = document.getElementById('f-elevation_m');
  const hinweis = document.getElementById('hinweis-elevation_m');
  if (!feld) return;

  feld.value = '';
  hinweis.textContent = 'Seehöhe wird geholt …';
  hinweis.classList.remove('warn');

  try {
    // Open-Meteo liefert die Höhe aus dem Copernicus-Geländemodell, ohne
    // Anmeldung und mit erlaubtem Zugriff aus dem Browser. Andere
    // Höhendienste blocken Anfragen von Webseiten.
    const res = await fetch(
      `https://api.open-meteo.com/v1/elevation?latitude=${lat.toFixed(6)}&longitude=${lng.toFixed(6)}`,
      { signal: AbortSignal.timeout(8000) }
    );
    if (!res.ok) throw new Error('HTTP ' + res.status);

    const json = await res.json();
    const meter = json?.elevation?.[0];
    if (meter == null) throw new Error('keine Höhe geliefert');

    const gerundet = Math.round(meter);
    feld.value = gerundet;

    // Die Baumgrenze liegt in den Alpen zwischen 1.800 und 2.200 m — in den
    // Niederen Tauern bilden Zirbenwälder die Waldgrenze, und die reicht gut
    // über 1.800 m hinauf. Die frühere Schwelle von 1.800 m war deshalb die
    // Untergrenze der Spanne, nicht die Grenze selbst, und hat "über der
    // Baumgrenze" zu oft vorgeschlagen.
    //
    // Das ist keine Kleinigkeit: In der Steiermark hängt am "oberhalb der
    // Baumgrenze" die Frage, ob Zelten dort überhaupt erlaubt ist.
    // Ab 2.000 m wird deshalb vorgeschlagen, dazwischen nur gefragt.
    if (gerundet >= 2000) {
      const baum = document.getElementById('f-above_treeline');
      if (baum && !baum.value) baum.value = 'true';
      hinweis.textContent =
        `${gerundet} m — vermutlich über der Baumgrenze. Ist unten schon gesetzt, ` +
        'korrigier es, falls es nicht stimmt.';
      hinweis.classList.add('warn');
    } else if (gerundet >= 1800) {
      hinweis.textContent =
        `${gerundet} m — hier verläuft je nach Gebirge die Baumgrenze. ` +
        'Standen dort noch Zirben oder Latschen? Dann trag unten "unter der ' +
        'Baumgrenze" ein.';
      hinweis.classList.add('warn');
    } else {
      hinweis.textContent = `${gerundet} m automatisch ermittelt — überschreibbar.`;
    }
  } catch {
    hinweis.textContent = 'Seehöhe konnte nicht automatisch ermittelt werden — ' +
                          'kannst du von Hand eintragen.';
  }
}

// ============================================================================
// 5. SPEICHERN
// ============================================================================

spotForm.onsubmit = async (e) => {
  e.preventDefault();

  const nutzer = window.WILDCAMP_AUTH.nutzer;
  const aendern = !!bearbeiteId;
  if (!nutzer) return;
  if (!aendern && !spotKoordinaten) return;

  const name = spotName.value.trim();
  if (name.length < 3) {
    spotMeldungSetzen('Der Name braucht mindestens 3 Zeichen.', 'fehler');
    return;
  }

  const spot = { name };

  // Beim Anlegen kommen Ersteller und Position dazu. Beim Bearbeiten bleiben
  // beide unangetastet — die Position gehört zum Spot, nicht zur Kartenmitte
  // von gerade eben.
  if (!aendern) {
    spot.created_by = nutzer.id;
    // Position als WKT — das ist die Schreibweise, die PostGIS direkt
    // versteht. Reihenfolge: erst Länge, dann Breite.
    spot.location = `SRID=4326;POINT(${spotKoordinaten.lng} ${spotKoordinaten.lat})`;
  }

  // Beim Bearbeiten muss jedes Feld mitgeschickt werden, auch die leeren:
  // Wer eine Angabe wieder auf "keine Angabe" stellt, will sie loswerden.
  // Beim Anlegen bleiben leere Felder dagegen weg, damit in der Datenbank
  // NULL steht statt eines erfundenen Werts. Das Ergebnis ist dasselbe,
  // aber nur so lässt sich eine Angabe auch wieder entfernen.
  spot.description = spotBeschreib.value.trim() || (aendern ? null : undefined);
  if (spot.description === undefined) delete spot.description;

  for (const el of spotForm.querySelectorAll(EINZELFELDER)) {
    const wert = el.value.trim();

    if (wert === '') {
      if (aendern) spot[el.dataset.feld] = null;
      continue;
    }

    if (wert === 'true' || wert === 'false') spot[el.dataset.feld] = (wert === 'true');
    else if (el.type === 'number')           spot[el.dataset.feld] = Number(wert);
    else                                     spot[el.dataset.feld] = wert;
  }

  // Alle Mehrfachauswahlen als Listen — Jahreszeiten, Fischarten, und was
  // später dazukommt. Die Felder werden aus GRUPPEN gelesen, damit eine neue
  // Auswahl dort automatisch mitgespeichert wird.
  for (const feld of MEHRFACH_FELDER) {
    const gewaehlt = [...spotForm.querySelectorAll(
      `input[type="checkbox"][data-feld="${feld}"]`)]
      .filter((i) => i.checked).map((i) => i.value);

    if (gewaehlt.length) spot[feld] = gewaehlt;
    else if (aendern)    spot[feld] = null;
  }

  spotSpeichern.disabled = true;
  spotMeldungSetzen(aendern ? 'Änderungen werden gespeichert …' : 'Wird gespeichert …');

  try {
    const client = window.WILDCAMP_AUTH.client;

    // Beim Anlegen kommt die neue ID zurück — sie wird gebraucht, falls noch
    // ein Foto mitgespeichert werden soll.
    const { data, error } = aendern
      ? await client.from('spots').update(spot).eq('id', bearbeiteId)
      : await client.from('spots').insert(spot).select('id').single();
    if (error) throw error;

    // Das Foto, aus dem die Position kam, gleich als erstes Bild ablegen.
    // Geht das schief, ist der Spot trotzdem gespeichert — deshalb nur eine
    // Meldung und kein Abbruch. Das Bild lässt sich in der Detail-Leiste
    // jederzeit nachreichen.
    let fotoFehlte = false;
    if (!aendern && fotoVomOrt && data && data.id) {
      spotMeldungSetzen('Spot gespeichert — das Foto wird noch abgelegt …');
      try {
        await window.einFotoHochladen(data.id, fotoVomOrt, 1);
      } catch {
        fotoFehlte = true;
      }
    }

    const geaendert = bearbeiteId;
    spotHg.hidden = true;
    spotMeldungSetzen('');
    bearbeiteId = null;
    spotFormularLeeren();
    ortAusFotoZuruecksetzen();

    status(
      aendern      ? `Spot „${name}" geändert.`
      : fotoFehlte ? `Spot „${name}" gespeichert — das Foto ging nicht durch, ` +
                     'du kannst es beim Spot nachreichen.'
                   : `Spot „${name}" gespeichert.`,
      { dauer: fotoFehlte ? 6000 : 4000, warnung: fotoFehlte }
    );
    spotsLaden();

    // Die Detail-Leiste zeigt sonst weiter den alten Stand.
    if (aendern && typeof window.spotDetailAktualisieren === 'function') {
      window.spotDetailAktualisieren(geaendert, name);
    }

  } catch (err) {
    spotMeldungSetzen(spotFehlerText(err), 'fehler');
  } finally {
    spotSpeichern.disabled = false;
  }
};

function spotFormularLeeren() {
  spotName.value = '';
  spotBeschreib.value = '';
  for (const el of spotForm.querySelectorAll(EINZELFELDER)) {
    const feld = GRUPPEN.flatMap((g) => g.felder).find((f) => f.name === el.dataset.feld);
    el.value = feld && feld.standard ? feld.standard : '';
  }
  for (const el of spotForm.querySelectorAll('input[type="checkbox"]')) el.checked = false;
  for (const d of spotForm.querySelectorAll('details')) d.open = false;
}

function spotFehlerText(err) {
  const m = (err && err.message ? err.message : String(err)).toLowerCase();

  if (m.includes('row-level security') || m.includes('violates row-level')) {
    return 'Die Datenbank hat das abgelehnt. Melde dich einmal ab und wieder an.';
  }
  if (m.includes('spots_name_check')) {
    return 'Der Name muss zwischen 3 und 80 Zeichen lang sein.';
  }
  if (m.includes('violates check constraint')) {
    return 'Eine der Angaben passt nicht zu den erlaubten Werten. ' +
           'Technische Meldung: ' + err.message;
  }
  if (m.includes('foreign key') && m.includes('created_by')) {
    return 'Zu deinem Konto fehlt noch ein Profil. Melde dich einmal ab und wieder an.';
  }
  if (m.includes('failed to fetch') || m.includes('network')) {
    return 'Keine Verbindung zum Server. Internet prüfen.';
  }
  return err && err.message ? err.message : 'Unbekannter Fehler.';
}
