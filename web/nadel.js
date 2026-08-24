// ============================================================================
// Die Nadel — gedrückt halten, und die Karte zeigt die Stelle
//
// Bis 2026-08-24 stand ein Fadenkreuz fest in der Bildmitte, und unten war ein
// Knopf "Spot hier anlegen". Man legte also einen Spot an, indem man die Karte
// so lange schob, bis die richtige Stelle unter dem Kreuz lag. Das ist die
// Bedienung einer Karte, die sich nicht antippen lässt — unsere lässt sich.
//
// Jetzt hält man auf der Stelle gedrückt. Es kommt eine Nadel, wie man sie von
// jeder Karten-App kennt, mit den Koordinaten und dem Knopf zum Anlegen.
//
// Sie bleibt nicht liegen: Ein Tippen daneben, ein Verschieben der Karte oder
// das Anlegen selbst nimmt sie wieder weg. Sie ist ein Zeigen, kein Eintrag.
//
// ----------------------------------------------------------------------------
// Warum das Gedrückthalten von Hand erkannt wird
//
// MapLibre kennt ein 'contextmenu'-Ereignis, das am Rechner beim Rechtsklick
// feuert. Auf dem Handy kommt es je nach Browser beim langen Drücken — oder
// eben nicht, und bei manchen kommt stattdessen das Auswahl-Menü des Systems.
// Darauf kann man eine Hauptfunktion nicht bauen. Deshalb misst diese Datei
// selbst: Finger unten, 500 ms gewartet, kaum bewegt → Nadel.
//
// Die Bewegungsschwelle ist der wichtige Teil. Ohne sie käme die Nadel bei
// jedem Verschieben der Karte, denn Schieben beginnt genauso: Finger unten,
// eine Weile nichts. Erst wenn der Finger nach 500 ms noch fast an derselben
// Stelle ist, war es ein Halten und kein Ziehen.
// ============================================================================

'use strict';

const NADEL_DAUER   = 500;   // ms, bis aus Drücken ein Halten wird
const NADEL_WACKELN = 10;    // px, die der Finger dabei wandern darf

let nadel        = null;     // der Marker, solange einer steht
let nadelPopup   = null;
let druckUhr     = null;     // der laufende Zeitmesser
let druckStart   = null;     // { x, y } — wo der Finger aufsetzte
let geradeGesetzt = false;   // unterdrückt den Klick direkt nach dem Halten
let ziel         = null;     // fremder Zweck für die Nadel, siehe Abschnitt 4

const leinwand = karte.getCanvasContainer();

// ----------------------------------------------------------------------------
// 1. Halten erkennen
//
// Maus und Finger laufen durch dieselben drei Schritte. Sie getrennt zu
// behandeln hieße, dieselbe Logik zweimal zu pflegen.
// ----------------------------------------------------------------------------

function punktAus(e) {
  const t = e.touches ? e.touches[0] : e;
  return { x: t.clientX, y: t.clientY };
}

function druckBeginnt(e) {
  // Zwei Finger heißt zoomen, nicht zeigen.
  if (e.touches && e.touches.length > 1) return abbrechen();

  druckStart = punktAus(e);
  const start = druckStart;

  druckUhr = setTimeout(() => {
    druckUhr = null;
    nadelSetzenAusBildpunkt(start);
  }, NADEL_DAUER);
}

function druckBewegt(e) {
  if (!druckUhr || !druckStart) return;

  const jetzt = punktAus(e);
  const weit = Math.hypot(jetzt.x - druckStart.x, jetzt.y - druckStart.y);

  // Die Karte wird geschoben — dann war es kein Halten.
  if (weit > NADEL_WACKELN) abbrechen();
}

function abbrechen() {
  if (druckUhr) clearTimeout(druckUhr);
  druckUhr = null;
  druckStart = null;
}

leinwand.addEventListener('mousedown',  druckBeginnt);
leinwand.addEventListener('mousemove',  druckBewegt);
leinwand.addEventListener('mouseup',    abbrechen);
leinwand.addEventListener('mouseleave', abbrechen);

// passive: Wir halten das Scrollen nicht auf, wir schauen nur zu.
leinwand.addEventListener('touchstart',  druckBeginnt, { passive: true });
leinwand.addEventListener('touchmove',   druckBewegt,  { passive: true });
leinwand.addEventListener('touchend',    abbrechen);
leinwand.addEventListener('touchcancel', abbrechen);

// Am Rechner ist der Rechtsklick der gewohnte Weg zu genau dieser Nadel.
karte.on('contextmenu', (e) => {
  abbrechen();
  nadelSetzen(e.lngLat.lat, e.lngLat.lng);
});

// ----------------------------------------------------------------------------
// 2. Die Nadel setzen
// ----------------------------------------------------------------------------

function nadelSetzenAusBildpunkt(punkt) {
  // Von der Ecke der Karte aus rechnen, nicht von der Fensterecke: Auf breiten
  // Fenstern beginnt die Karte erst hinter der Seitenspalte.
  //
  // Gemessen wird am äußeren Kartenfeld, nicht an der Leinwand darin: Die
  // Leinwand meldet je nach Browser die Höhe 0, weil die eigentliche canvas
  // absolut in ihr liegt. Die Ecke stimmt dann zwar, aber auf eine Zahl, die
  // in manchen Browsern 0 ist, will man nichts stützen.
  const kasten = karte.getContainer().getBoundingClientRect();
  const ort = karte.unproject([punkt.x - kasten.left, punkt.y - kasten.top]);
  nadelSetzen(ort.lat, ort.lng);
}

function nadelSetzen(lat, lng) {
  nadelWeg();

  // Ein kurzes Klopfen bestätigt, dass das Halten angekommen ist — dieselbe
  // Rückmeldung, die das Handy beim langen Drücken sonst auch gibt. Nicht
  // jedes Gerät kann es, deshalb nur, wenn es da ist.
  if (navigator.vibrate) navigator.vibrate(12);

  const el = document.createElement('div');
  el.className = 'nadel';
  el.innerHTML =
    '<svg viewBox="0 0 24 34" aria-hidden="true">' +
    // Die vertraute Tropfenform: oben rund, unten spitz. Die Spitze sitzt bei
    // y=34 und damit genau auf dem gemeinten Punkt (siehe anchor unten).
    '<path class="koerper" d="M12 1a11 11 0 0 0-11 11c0 7.5 11 21 11 21s11-13.5 11-21A11 11 0 0 0 12 1Z"/>' +
    '<circle class="auge" cx="12" cy="12" r="4"/>' +
    '</svg>';

  nadelPopup = new maplibregl.Popup({
    offset: 40,            // über der Nadel, nicht in ihr
    closeButton: false,    // sie geht ohnehin bei jedem Tippen daneben weg
    closeOnClick: false,   // sonst nimmt der eigene Klick sie sofort mit
    className: 'nadel-blase',
  }).setDOMContent(blaseBauen(lat, lng));

  nadel = new maplibregl.Marker({ element: el, anchor: 'bottom' })
    .setLngLat([lng, lat])
    .setPopup(nadelPopup)
    .addTo(karte);

  nadel.togglePopup();

  // Der Fingerabdruck erzeugt nach dem Loslassen noch einen Klick. Ohne diese
  // Sperre nähme der die eben gesetzte Nadel sofort wieder weg.
  geradeGesetzt = true;
  setTimeout(() => { geradeGesetzt = false; }, 350);
}

function blaseBauen(lat, lng) {
  const kasten = document.createElement('div');

  const koord = document.createElement('div');
  koord.className = 'nadel-koord';
  koord.textContent = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
  koord.title = 'Anklicken zum Kopieren';
  koord.onclick = async () => {
    try {
      await navigator.clipboard.writeText(`${lat.toFixed(5)}, ${lng.toFixed(5)}`);
      status('Koordinaten kopiert', { dauer: 1800 });
    } catch {
      status('Kopieren hat der Browser hier nicht erlaubt.', { warnung: true, dauer: 3000 });
    }
  };

  const knopf = document.createElement('button');
  knopf.className = 'nadel-knopf';

  if (ziel) {
    // Ein anderer Teil der App wartet gerade auf eine Stelle — zum Beispiel
    // die Route auf den Parkplatz. Dann heißt der Knopf, was dort ansteht.
    knopf.textContent = ziel.text;
    knopf.onclick = () => {
      const merk = { lat, lng };
      const fertig = ziel.gewaehlt;
      zielAus();
      nadelWeg();
      fertig(merk.lat, merk.lng);
    };
  } else {
    knopf.innerHTML = '<span class="plus">+</span> Spot anlegen';
    knopf.onclick = () => {
      const merk = { lat, lng };
      nadelWeg();
      window.WILDSPOT_SPOT_ANLEGEN(merk.lat, merk.lng);
    };
  }

  kasten.append(koord, knopf);
  return kasten;
}

// ----------------------------------------------------------------------------
// 3. Die Nadel wieder wegnehmen
//
// Sie soll nicht liegen bleiben. Alles, was ein "ich meine jetzt etwas
// anderes" ist, nimmt sie mit.
// ----------------------------------------------------------------------------

function nadelWeg() {
  if (nadelPopup) { nadelPopup.remove(); nadelPopup = null; }
  if (nadel)      { nadel.remove();      nadel = null; }
}

karte.on('click', () => {
  if (geradeGesetzt) return;
  nadelWeg();
});

// Wer die Karte verschiebt oder zoomt, sucht eine andere Stelle.
karte.on('dragstart', nadelWeg);
karte.on('zoomstart', nadelWeg);

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') nadelWeg();
});

// ----------------------------------------------------------------------------
// 4. Die Nadel für einen fremden Zweck ausleihen
//
// Nicht jede Stelle, die man zeigt, wird ein Spot. Die Route fragt nach dem
// Parkplatz, und dafür wäre eine zweite Geste zum Zeigen eine Zumutung — man
// hat gerade erst gelernt, dass man auf dieser Karte gedrückt hält.
//
// Wer die Nadel ausleiht, sagt nur, wie ihr Knopf heißen soll und was mit der
// Stelle geschehen soll. Alles andere — Halten erkennen, Nadel setzen,
// Koordinaten zeigen — bleibt hier und muss nicht zweimal existieren.
// ----------------------------------------------------------------------------

function zielSetzen(auftrag) {
  ziel = auftrag;      // { text, gewaehlt(lat, lng) }
  nadelWeg();          // eine Nadel von vorhin meinte noch etwas anderes
}

function zielAus() {
  ziel = null;
}

window.WILDSPOT_NADEL = {
  weg: nadelWeg,
  ziel: zielSetzen,
  zielAus,
};
