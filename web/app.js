// ============================================================================
// Wild Spot — die Karte
//
// Was diese Datei macht, in vier Sätzen:
//   1. Sie zeigt Österreich mit vier umschaltbaren Kartenhintergründen.
//   2. Sie holt die Wasserstellen aus deiner Supabase-Datenbank — aber immer
//      nur die im sichtbaren Ausschnitt, nie alle 55.000.
//   3. Sie findet auf Knopfdruck deine eigene Position.
//   4. Sie zeigt unten die Koordinaten der Kartenmitte. Genau dort wird
//      später ein neuer Spot angelegt.
//
// Die Zugangsdaten stehen in config.js.
// ============================================================================

'use strict';

// ============================================================================
// 1. KARTENHINTERGRÜNDE
//
// Vier Karten, drei Quellen — alle kostenlos, keine mit Anmeldung oder
// Schlüssel:
//
//   Standard   Maptoolkit, weltweit, als Vektorstil (siehe gleich darunter)
//   Gelände    basemap.at, die amtliche österreichische Karte, als Relief
//   Satellit   basemap.at, Luftbild mit 30 cm Auflösung
//   Wandern    OpenTopoMap, Höhenlinien und Wanderwege
// ============================================================================

// Die Standardkarte ist als einzige keine Rasterkarte, sondern ein fertiger
// Vektorstil von Maptoolkit. Der Unterschied ist größer, als er klingt:
//
//   Raster    fertig gemalte Bildkacheln. Jede Zoomstufe ist ein neuer Satz
//             Bilder, die geladen werden müssen. Dazwischen sieht man
//             Unschärfe, und der amtliche Stil von basemap.at ist außerdem
//             weiß-grau — beim Hinauszoomen wurde daraus eine bleiche Fläche.
//
//   Vektor    Punkte und Linien, die der Browser selbst zeichnet. Weniger
//             Daten, jede Zwischenstufe scharf, und die Farben kommen aus dem
//             Stil statt aus dem Bild. Dieser hier ist grün, hat Relief,
//             Höhenlinien, Wälder und Hütten — und bleibt grün, egal wie weit
//             man hinauszoomt.
//
// Maptoolkit ist kostenlos nutzbar (Community License, kommerziell bis 1 Mio €
// Umsatz), braucht keinen Schlüssel und keine Anmeldung. Verlangt wird eine
// sichtbare Nennung — sie steht in der Fußzeile.
const MAPTOOLKIT_STIL = 'https://styles.maptoolkit.org/summer.json';

const GRUNDKARTEN = [
  {
    id: 'standard',
    label: 'Standard',
    // Kein url: dieser Stil IST der Kartenstil, nicht eine Ebene darin.
    vektor: true,
    // Ein gemaltes Vorschaubild statt einer geladenen Kachel — von einem
    // Vektorstil gibt es keine einzelne Kachel, die man zeigen könnte.
    vorschau: 'data:image/svg+xml;utf8,' + encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64">
         <rect width="64" height="64" fill="#eef3e2"/>
         <path d="M0 44 L14 30 L26 40 L40 22 L52 34 L64 26 L64 64 L0 64Z" fill="#cfe0b4"/>
         <path d="M0 52 L18 40 L30 48 L46 34 L64 44 L64 64 L0 64Z" fill="#b7d196"/>
         <path d="M8 20 q10 -8 20 0 t20 2" stroke="#a9c48a" stroke-width="1.5" fill="none"/>
         <circle cx="46" cy="14" r="5" fill="#9fd0e8"/>
       </svg>`),
    maxzoom: 20,
  },
  {
    id: 'gelaende',
    label: 'Gelände',
    // Schummerung des Geländes. Man sieht auf einen Blick, wo es flach ist —
    // die wichtigste Information bei der Suche nach einem Zeltplatz.
    url: 'https://mapsneu.wien.gv.at/basemap/bmapgelaende/grau/google3857/{z}/{y}/{x}.jpeg',
    maxzoom: 19,
    beschriftung: true,
    // Diese Kacheln sind deckend und stehen als helles Rechteck über die
    // Grenze hinaus — hier braucht es die Maske. Das Ausland ist dadurch
    // beim Hineinzoomen dunkel. Anders geht es nicht: ein Luftbild lässt
    // sich nicht entlang einer Landesgrenze abschneiden.
    maske: true,
  },
  {
    id: 'ortho',
    label: 'Satellit',
    // Luftbild mit 30 cm Auflösung. Baumgrenze, Wasser und Wiesen sind hier
    // direkt erkennbar.
    url: 'https://mapsneu.wien.gv.at/basemap/bmaporthofoto30cm/normal/google3857/{z}/{y}/{x}.jpeg',
    maxzoom: 19,
    beschriftung: true,
    maske: true,
  },
  {
    id: 'topo',
    label: 'Wandern',
    // OpenTopoMap: Höhenlinien, Wanderwege, Hütten.
    url: 'https://a.tile.opentopomap.org/{z}/{x}/{y}.png',
    maxzoom: 17,
  },
];

// ============================================================================
// 2. DIE ARTEN VON PUNKTEN
//
// Die Schlüssel entsprechen der Spalte "kind" in der Tabelle water_points.
// gruppe steuert, welcher der beiden Schalter oben den Punkt ein- und
// ausblendet.
// ============================================================================

const ARTEN = {
  // Wasser
  spring:           { label: 'Quelle',               gruppe: 'wasser',     farbe: '#4aa3df' },
  drinking_water:   { label: 'Trinkbrunnen',         gruppe: 'wasser',     farbe: '#63c7f0' },
  well:             { label: 'Brunnen',              gruppe: 'wasser',     farbe: '#2f7fb8' },
  water_tap:        { label: 'Wasserhahn',           gruppe: 'wasser',     farbe: '#8ad4f5' },
  water:            { label: 'Gewässer',             gruppe: 'wasser',     farbe: '#3a90cc' },

  // Bergseen bekommen eine eigene Ebene: sie sind selten, oft der schönste
  // Platz weit und breit — und ein anderer Grund hinzugehen als ein Brunnen.
  mountain_lake:    { label: 'Bergsee',               gruppe: 'seen',       farbe: '#38e1d0' },

  // Wasserfälle aus demselben Grund: verlässliches Wasser und ein Ziel für
  // sich. Zwischen 16.000 Trinkbrunnen würden die 1.777 untergehen.
  //
  // Das Blau ist bewusst kräftig und nicht türkis: Bergseen und Wasserfälle
  // liegen beide schon in der Übersicht auf der Karte, oft nebeneinander.
  // Zwei ähnliche Türkistöne wären bei 3 Pixeln nicht auseinanderzuhalten.
  waterfall:        { label: 'Wasserfall',            gruppe: 'wasserfall', farbe: '#1f6fd0' },

  // Gipfel sind keine Wasserstelle und kein Schlafplatz, sondern ein Ziel.
  // Sie liegen trotzdem in derselben Tabelle (kind 'peak', siehe db/020) —
  // die heißt nur historisch water_points und enthält längst alles, was aus
  // OpenStreetMap kommt.
  peak:             { label: 'Gipfel',               gruppe: 'gipfel',     farbe: '#6b7280' },

  // Unterkünfte und Unterstände
  alpine_hut:       { label: 'Berghütte',            gruppe: 'unterstand', farbe: '#e0a860' },
  wilderness_hut:   { label: 'Selbstversorgerhütte', gruppe: 'unterstand', farbe: '#a86a2a' },
  chalet:           { label: 'Almhütte / Chalet',    gruppe: 'unterstand', farbe: '#d99a55' },
  shelter:          { label: 'Biwak / Schutzdach',   gruppe: 'unterstand', farbe: '#c98a3f' },
  camp_site:        { label: 'Campingplatz',         gruppe: 'unterstand', farbe: '#b07030' },
  backcountry_camp: { label: 'Trekking-/Biwakplatz', gruppe: 'unterstand', farbe: '#f0c070' },
};

// Die Ebenen aus OpenStreetMap. Jede hat eine eigene Datenquelle, damit die
// Schalter oben unabhängig voneinander funktionieren. Die Reihenfolge hier
// bestimmt auch, welche Punkte auf der Karte oben liegen — Ziele wie Seen und
// Wasserfälle über den Trinkbrunnen.
const OSM_EBENEN = ['wasser', 'unterstand', 'seen', 'wasserfall', 'gipfel'];

// Diese beiden sind schon in der Österreich-Übersicht zu sehen. Sie sind
// selten (1.417 Seen, 1.777 Wasserfälle) und man sucht gezielt nach ihnen —
// anders als bei 16.000 Trinkbrunnen, die erst beim Hineinzoomen erscheinen.
const WEITSICHT_EBENEN = ['seen', 'wasserfall'];

// Ebenen, deren Punkte NIE zu einer Blase zusammengefasst werden. Bei den
// Gipfeln ist das wichtiger als bei allem anderen: Ein Gipfel ist ein Ziel
// mit Namen und Höhe, und wer ihn sammeln will, muss ihn einzeln antippen
// können. Eine graue Blase mit „37" darin ist genau das Gegenteil.
//
// Sie laden trotzdem erst ab ZOOM_SCHWELLE — anders als Seen und Wasserfälle
// gibt es 14.560 von ihnen, das wäre in der Österreich-Übersicht ein Teppich.
const OHNE_CLUSTER = [...WEITSICHT_EBENEN, 'gipfel'];

// Dieselben Ebenen, als Arten für die Datenbankabfrage.
const WEITSICHT_ARTEN = Object.entries(ARTEN)
  .filter(([, a]) => WEITSICHT_EBENEN.includes(a.gruppe))
  .map(([kind]) => kind);

// Ab diesem Zoom werden Punkte geladen. Weiter draußen wären es zu viele,
// und man könnte sie ohnehin nicht auseinanderhalten.
const ZOOM_SCHWELLE = 11;

// Österreich: West, Süd, Ost, Nord
const OESTERREICH = [9.5, 46.3, 17.2, 49.1];

// So weit darf man hinaus. Die Spots liegen vorerst alle in Österreich, aber
// die Karte darum herum zu sehen hilft beim Einordnen — und wenn das Projekt
// später über die Grenze wächst, muss hier nichts mehr geändert werden.
const EUROPA = [-13, 33, 43, 71];

// Ab diesem Zoom blenden sich Gelände und Satellit ein — die amtlichen Karten
// von basemap.at, die es nur für Österreich gibt. Weiter draußen wären sie ein
// helles Rechteck mitten im Kontinent, deshalb liegen sie dort auf null.
// Darunter (und überall sonst) liegt die Standardkarte.
const AT_KARTE_AB = 7.4;

const cfg = window.WILDCAMP_CONFIG || {};

// ============================================================================
// 3. STATUSMELDUNGEN
// ============================================================================

const statusEl = document.getElementById('status');
let statusTimer = null;

function status(html, { warnung = false, dauer = 0 } = {}) {
  clearTimeout(statusTimer);
  if (!html) {
    statusEl.classList.remove('sichtbar');
    return;
  }
  statusEl.innerHTML = html;
  statusEl.classList.toggle('warnung', warnung);
  statusEl.classList.add('sichtbar');
  if (dauer) statusTimer = setTimeout(() => statusEl.classList.remove('sichtbar'), dauer);
}

// ============================================================================
// 4. KARTE AUFBAUEN
//
// Alle vier Hintergründe liegen von Anfang an im Style, aber nur einer ist
// sichtbar. Umschalten heißt dann nur noch "visibility" ändern — die Karte
// muss nicht neu gebaut werden und die Wasserstellen bleiben liegen.
// ============================================================================

const sources = {};
const rasterLayers = [];

for (const g of GRUNDKARTEN) {
  // Die Standardkarte hat keine eigene Ebene — sie ist der Stil, in den alles
  // andere hineingelegt wird. Siehe MAPTOOLKIT_STIL weiter oben.
  if (g.vektor) continue;

  sources['grund-' + g.id] = {
    type: 'raster',
    tiles: [g.url],
    tileSize: 256,
    maxzoom: g.maxzoom,
    // basemap.at hat nur Kacheln für Österreich. Ohne diese Angabe würde die
    // Karte auch außerhalb Kacheln anfordern und lauter 404 einsammeln.
    ...(g.id === 'topo' ? {} : { bounds: OESTERREICH }),
    attribution: g.id === 'topo'
      ? '© OpenStreetMap-Mitwirkende, SRTM | © OpenTopoMap (CC-BY-SA)'
      : '© basemap.at',
  };
  rasterLayers.push({
    id: 'grund-' + g.id,
    type: 'raster',
    source: 'grund-' + g.id,
    // Beim Start ist die Standardkarte dran, und die ist der Stil selbst —
    // also ist hier zunächst keine dieser Ebenen sichtbar.
    layout: { visibility: 'none' },
    // Weit draußen ausgeblendet: dort ist die Europakarte dran. basemap.at
    // liefert außerhalb Österreichs teils weiße Kacheln, die als Rechteck
    // über dem Kontinent lägen — so verschwinden sie einfach.
    paint: {
      'raster-opacity': ['interpolate', ['linear'], ['zoom'],
        AT_KARTE_AB - 0.4, 0, AT_KARTE_AB + 0.8, 1],
    },
  });
}

// Eine eigene Karte für alles außerhalb Österreichs braucht es nicht mehr.
// Früher lag hier CARTO Voyager darunter — eine beige-weiße Weltkarte, die
// genau das Problem war: Beim Hinauszoomen wurde aus dem Land eine bleiche
// Fläche. Der Maptoolkit-Stil deckt die ganze Welt ab und bleibt dabei grün,
// also ist die zweite Karte ersatzlos weg. Das spart auch einen ganzen Satz
// Kachelanfragen bei jedem Zoomen.

// Geländeschummerung und Luftbild haben von Haus aus keine Ortsnamen — auf
// einem grauen Relief weiß man dann nicht, wo man ist. basemap.at liefert
// dafür eine durchsichtige Ebene mit Beschriftung, Grenzen und Wegen, die
// über den Hintergrund gelegt wird.
sources['beschriftung'] = {
  type: 'raster',
  tiles: ['https://mapsneu.wien.gv.at/basemap/bmapoverlay/normal/google3857/{z}/{y}/{x}.png'],
  tileSize: 256,
  maxzoom: 19,
  bounds: OESTERREICH,
  attribution: '© basemap.at',
};
rasterLayers.push({
  id: 'beschriftung',
  type: 'raster',
  source: 'beschriftung',
  layout: { visibility: 'none' },
  paint: { 'raster-opacity': 0.9 },
});

// Die Maske: eine Fläche über die ganze Welt, in die Österreich als Loch
// geschnitten ist. Sie liegt über den Grundkarten und hat exakt die Farbe des
// Hintergrunds — dadurch endet jede Karte sauber an der Landesgrenze.
//
// Nötig ist das, weil basemap.at seine Kacheln nicht an der Grenze
// abschneidet, sondern in Quadraten liefert. Bei "Standard" sieht man das
// nicht, dort sind die Flächen außerhalb durchsichtig. "Gelände" und
// "Satellit" malen dagegen bis zum Rand des Quadrats weiter und stehen als
// helles Rechteck über das Land hinaus.
//
// Die Datei kommt von OpenStreetMap und wird einmalig erzeugt:
//     node scripts/import-grenze.mjs
sources['maske'] = {
  type: 'geojson',
  data: 'oesterreich-maske.geojson',
};

// Zwei getrennte Datenquellen, damit die beiden Schalter oben unabhängig
// voneinander funktionieren. cluster fasst dicht beieinanderliegende Punkte
// zusammen — sonst wäre Wien ein einziger blauer Fleck.
for (const gruppe of OSM_EBENEN) {
  sources[gruppe] = {
    type: 'geojson',
    data: { type: 'FeatureCollection', features: [] },
    // Bergseen und Wasserfälle werden nie zusammengefasst: es gibt nur ein
    // paar tausend im ganzen Land, und jeder einzelne ist ein möglicher Grund
    // hinzugehen. Zu einer Blase mit "37" verschmolzen wäre genau das weg.
    // Bei 16.000 Trinkbrunnen ist das anders.
    cluster: !OHNE_CLUSTER.includes(gruppe),
    clusterRadius: 45,
    clusterMaxZoom: 13,
  };
}

// Die Spots bekommen eine eigene Quelle — ohne Zusammenfassen zu Clustern.
// Sie sind das Wichtigste auf der Karte und sollen einzeln sichtbar bleiben,
// auch wenn zwei nah beieinander liegen.
sources['spots'] = {
  type: 'geojson',
  data: { type: 'FeatureCollection', features: [] },
};

// Die Farbe unter allem. Sie steht im Stilblatt (--karte-grund) und wechselt
// dort mit Tag und Nacht — hier wird sie nur ausgelesen. Zwei Stellen fuer
// dieselbe Farbe waeren zwei Stellen, an denen man sie vergessen kann.
function kartenGrund() {
  const wert = getComputedStyle(document.documentElement)
    .getPropertyValue('--karte-grund').trim();
  return wert || '#141812';
}

// Die Karte startet direkt mit dem fremden Vektorstil. Alles Eigene — die
// anderen drei Grundkarten, die Maske, die Wasserstellen, die Spots — kommt
// erst dazu, wenn er geladen ist (weiter unten in karte.on('load')).
//
// Früher stand hier ein selbstgebauter Stil mit allen Ebenen darin. Das ging,
// solange alle vier Karten Rasterkacheln waren; ein Vektorstil bringt aber
// eigene Schriften, Symbole und hundert Ebenen mit, die man nicht sinnvoll
// von Hand nachbaut.
const karte = new maplibregl.Map({
  container: 'karte',
  style: MAPTOOLKIT_STIL,
  // Startansicht: ganz Österreich, passend zur Fenstergröße. Deshalb bounds
  // statt fixem Zoom — auf einem Handy sieht das sonst völlig anders aus.
  bounds: [[OESTERREICH[0], OESTERREICH[1]], [OESTERREICH[2], OESTERREICH[3]]],
  fitBoundsOptions: { padding: 24 },
  // minZoom und maxBounds werden nicht hier festgelegt, sondern unten in
  // begrenzungSetzen() ausgerechnet — sie hängen von der Fenstergröße ab.
  maxZoom: 19,
  attributionControl: false,   // steht bei uns fest in der Fußzeile
});

// Die Ebenen, die zum Maptoolkit-Stil gehören. Sie werden beim Umschalten auf
// eine andere Grundkarte gemeinsam ausgeblendet — deshalb muss man wissen,
// welche das sind. Gefüllt wird die Liste in karte.on('load'), vor allem
// anderen: Was danach dazukommt, ist unseres und darf nicht mit verschwinden.
let stilEbenen = [];

// Der Grund unter allem, für den Fall, dass eine der anderen Karten gewählt
// ist und der Maptoolkit-Stil dann unsichtbar. Er muss ganz unten liegen,
// also VOR der ersten fremden Ebene eingefügt werden.
function grundEbeneEinhaengen() {
  if (karte.getLayer('hintergrund')) return;
  karte.addLayer(
    { id: 'hintergrund', type: 'background', paint: { 'background-color': kartenGrund() } },
    stilEbenen[0],
  );
}

// Alles Eigene in den fremden Stil einhängen. Die Reihenfolge ist die
// Zeichenreihenfolge: zuerst die Grundkarten, dann die Maske, dann (im
// load-Handler weiter unten) die Punkte.
function eigenesEinhaengen() {
  for (const [name, quelle] of Object.entries(sources)) {
    if (!karte.getSource(name)) karte.addSource(name, quelle);
  }

  for (const ebene of rasterLayers) {
    if (!karte.getLayer(ebene.id)) karte.addLayer(ebene);
  }

  // Direkt über den Grundkarten, aber unter allen Datenpunkten: die
  // Wasserstellen und Spots sollen ja nicht verdeckt werden. Die Farbe ist
  // dieselbe wie beim Hintergrund darunter, damit man die Kante zwischen
  // beiden nirgends sieht.
  if (!karte.getLayer('maske')) {
    karte.addLayer({
      id: 'maske',
      type: 'fill',
      source: 'maske',
      // Beim Start ist "Standard" gewählt — dort ist sie nicht nötig.
      layout: { visibility: 'none' },
      paint: {
        'fill-color': kartenGrund(),
        'fill-antialias': true,
        'fill-opacity': ['interpolate', ['linear'], ['zoom'],
          AT_KARTE_AB - 0.4, 0, AT_KARTE_AB + 0.8, 1],
      },
    });
  }
}

karte.dragRotate.disable();
karte.touchZoomRotate.disableRotation();

// Damit die Verwaltung (admin.js) von einer Liste aus zu einem Spot springen
// kann. Bewusst nur die Karte selbst, keine internen Hilfsfunktionen.
window.WILDCAMP_KARTE = karte;

// Wechselt jemand zwischen Tag und Nacht, muss die Flaeche unter der Karte
// mitwechseln — sonst steht ein dunkles Rechteck um das helle Oesterreich.
window.addEventListener('wildspot-thema', () => {
  const farbe = kartenGrund();
  try {
    if (karte.getLayer('hintergrund')) karte.setPaintProperty('hintergrund', 'background-color', farbe);
    if (karte.getLayer('maske'))       karte.setPaintProperty('maske', 'fill-color', farbe);
  } catch (e) { /* Karte noch nicht fertig — dann greift der naechste Aufruf */ }
});

// Farbe je nach Art. "match" ist die Wenn-Dann-Liste von MapLibre.
function farbAusdruck(gruppe) {
  const paare = [];
  for (const [key, a] of Object.entries(ARTEN)) {
    if (a.gruppe === gruppe) paare.push(key, a.farbe);
  }
  return ['match', ['get', 'kind'], ...paare, '#888888'];
}

// ============================================================================
// 4a. DIE SYMBOLE FÜR DIE KARTE
//
// Auf der Karte sollen dieselben Zeichen stehen wie in der Legende — ein Zelt
// bleibt ein Zelt. Damit die beiden nie auseinanderlaufen, werden sie nicht
// zweimal gezeichnet, sondern aus der Legende im HTML ausgelesen und für die
// Karte umgefärbt: dort sind sie weiß und sitzen auf dem farbigen Punkt.
//
// Weiß auf Farbe statt farbig auf der Karte, weil ein dünner farbiger Strich
// auf einem Luftbild oder einer grünen Wiese verschwindet. Der Punkt darunter
// bleibt außerdem erhalten — er trägt bei den Spots die Bewertungsfarbe.
// ============================================================================

const SYMBOL_GROESSE = 40;   // Kantenlänge in Bildpunkten, doppelt aufgelöst

// Die Leitfarbe je Ebene. Auf der Karte trägt das Zeichen sie selbst — es
// gibt keinen farbigen Kreis mehr darunter, der das übernehmen könnte.
// Etwas kräftiger als in der Legende: dort steht es auf Dunkel, hier auf
// einer hellen Karte.
const SYMBOL_FARBE = {
  wasser:     '#1f79bd',
  unterstand: '#a1621f',
  seen:       '#12a596',
  wasserfall: '#1a5fc0',
  gipfel:     '#5c6472',
  spot:       '#4d9e35',
};

// Gipfel gibt es in zwei Ausführungen: schiefergrau, solange man nicht oben
// war — und golden, sobald er gesammelt ist. Das ist der ganze Reiz am
// Sammeln: Man sieht auf der Karte, wo man schon überall gestanden hat, ohne
// eine Liste zu öffnen.
const GIPFEL_FARBEN = {
  'gipfel':           '#5c6472',
  'gipfel-gesammelt': '#d9a520',
};

// Für Spots zusätzlich nach Bewertung, damit man ein Urteil auf der Karte
// sieht, ohne den Spot zu öffnen.
//
// Das Grün ist bewusst kräftiger und kälter als das der App-Oberfläche: Die
// Karte selbst ist voller Grün — Wald, Wiese, Almen — und zwar in gedämpften,
// gelblichen Tönen. Ein Spot in ähnlichem Grün verschwindet darin. Dieses
// hier ist so gesättigt, wie Landschaft nie ist, und sticht dadurch heraus.
const SPOT_FARBEN = {
  'spot':         '#00a63c',   // noch nicht bewertet oder gut
  'spot-mittel':  '#e09a12',
  'spot-schwach': '#cc5a28',
};

// Das Zeichen wird zweimal übereinander gezeichnet: zuerst dick in Weiß,
// dann dünner in seiner Farbe. Der weiße Rand darunter ist der Grund, warum
// ein Symbol ohne Kreis auf einem Luftbild oder im Wald überhaupt lesbar
// bleibt — ohne ihn verschwindet ein blauer Strich im blauen Bach.
function symbolLaden(name, quelleKlasse, farbe) {
  const klasse = quelleKlasse || name;
  const vorlage = document.querySelector('.sym.' + klasse);
  if (!vorlage) return;

  const inhalt = vorlage.innerHTML;
  const gefuellt = klasse === 'wasser';   // der Tropfen ist eine Fläche

  // Spots bekommen mehr Weiß um sich herum und einen kräftigeren Strich. Sie
  // sind das Wichtigste auf der Karte und liegen oft mitten im Wald — genau
  // dort, wo ein grünes Zeichen sonst untergeht.
  const spot = klasse === 'spot';
  const halo = spot ? 8 : 6.5;
  const strich = spot ? 3.1 : 2.6;

  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" ` +
    `width="${SYMBOL_GROESSE}" height="${SYMBOL_GROESSE}">` +
      // Unterlage: derselbe Umriss, nur dick und weiß. Kräftig genug, dass
      // das Zeichen auch auf einer bunten Wanderkarte noch heraussticht —
      // es hat keinen farbigen Kreis mehr, der ihm Gewicht gibt.
      `<g fill="${gefuellt ? '#ffffff' : 'none'}" stroke="#ffffff" stroke-width="${halo}" ` +
      `stroke-linecap="round" stroke-linejoin="round">${inhalt}</g>` +
      // Darüber das eigentliche Zeichen.
      `<g fill="${gefuellt ? farbe : 'none'}" stroke="${gefuellt ? 'none' : farbe}" ` +
      `stroke-width="${strich}" stroke-linecap="round" stroke-linejoin="round">${inhalt}</g>` +
    `</svg>`;

  const bild = new Image(SYMBOL_GROESSE, SYMBOL_GROESSE);
  bild.onload = () => {
    // pixelRatio 2 heißt: das Bild ist doppelt so fein wie seine Anzeige.
    // Auf einem Handybildschirm bleibt es dadurch scharf.
    if (!karte.hasImage('sym-' + name)) karte.addImage('sym-' + name, bild, { pixelRatio: 2 });
  };
  bild.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
}

// Bei den Spots hängt das Zeichen von der Bewertung ab, bei den Gipfeln
// davon, ob man schon oben war. Sonst ist es fest.
function symbolAusdruck(gruppe) {
  if (gruppe === 'gipfel') {
    return ['case',
      ['==', ['get', 'gesammelt'], true], 'sym-gipfel-gesammelt',
      'sym-gipfel',
    ];
  }

  if (gruppe !== 'spot') return 'sym-' + gruppe;

  return ['case',
    ['==', ['get', 'rating_count'], 0], 'sym-spot',
    ['<', ['get', 'avg_stars'], 2.5], 'sym-spot-schwach',
    ['<', ['get', 'avg_stars'], 4], 'sym-spot-mittel',
    'sym-spot',
  ];
}

// gruppe bestimmt, welches Zeichen genommen wird; quelle, an welchen Punkten
// es hängt. Bei den Spots heißen die beiden unterschiedlich ("spot" ist das
// Zelt, "spots" die Datenquelle) — deshalb sind es zwei Angaben.
function symbolLayer(gruppe, quelle) {
  const q = quelle || gruppe;
  const gross = gruppe === 'spot';   // Spots sind das Wichtigste auf der Karte

  return {
    id: q + '-symbol',
    type: 'symbol',
    source: q,
    filter: ['!', ['has', 'point_count']],
    layout: {
      'icon-image': symbolAusdruck(gruppe),
      // Von der Übersicht bis ganz nah durchgehend sichtbar, nur kleiner.
      // Bei Zoom 5 liegt ganz Österreich im Bild — dort wären volle Symbole
      // ein Teppich, aber ganz verschwinden sollen sie auch nicht.
      // Spots sind durchgehend deutlich größer als die OSM-Zeichen. Sie sind
      // der Grund, warum es die App gibt — ein Trinkbrunnen ist Beiwerk.
      'icon-size': ['interpolate', ['linear'], ['zoom'],
        5,  gross ? 0.50 : 0.28,
        9,  gross ? 0.70 : 0.44,
        13, gross ? 0.95 : 0.62,
        16, gross ? 1.15 : 0.74,
      ],
      // Ohne diese beiden lässt MapLibre Symbole weg, sobald sie sich
      // berühren — in den Alpen wäre dann die Hälfte unsichtbar.
      'icon-allow-overlap': true,
      'icon-ignore-placement': true,
    },
  };
}

karte.on('load', () => {
  // Zuerst merken, was zum fremden Stil gehört — danach ist alles Neue
  // unseres. Der Hintergrund des Stils zählt mit dazu: Wird auf Satellit
  // umgeschaltet, soll auch sein Grün verschwinden.
  stilEbenen = karte.getStyle().layers.map((l) => l.id);

  grundEbeneEinhaengen();
  eigenesEinhaengen();

  // Die drei OSM-Ebenen kommen UNTER die Maske ("vor der Ebene maske"
  // einfügen heißt: darunter zeichnen). Der Import aus OpenStreetMap ging
  // über ein Rechteck um Österreich, deshalb liegen ein paar hundert
  // Brunnen und Hütten knapp jenseits der Grenze. Über der Maske würden sie
  // im Schwarzen schweben; darunter sind sie einfach weg.
  //
  // Die Spots und die eigene Position bleiben dagegen oben — sie sollen
  // immer sichtbar sein.
  for (const gruppe of OSM_EBENEN) {
    // Cluster: je mehr Punkte, desto größer. Bewusst ohne Zahl darin —
    // das würde eine Schriftart von einem fremden Server brauchen.
    karte.addLayer({
      id: gruppe + '-cluster',
      type: 'circle',
      source: gruppe,
      filter: ['has', 'point_count'],
      paint: {
        'circle-color': {
          wasser: '#2f7fb8', unterstand: '#a86a2a',
          seen: '#1f9e93', wasserfall: '#3f9fb8',
          gipfel: '#5c6472',
        }[gruppe],
        'circle-opacity': 0.75,
        'circle-radius': ['step', ['get', 'point_count'], 13, 10, 17, 50, 22, 200, 28],
        'circle-stroke-width': 2,
        'circle-stroke-color': 'rgba(255,255,255,0.6)',
      },
    }, 'maske');

    // Die Punkte sind das Zeichen selbst — kein Kreis mehr darunter. Das
    // hält die Karte ruhiger, weil nichts doppelt gezeichnet wird, und man
    // erkennt schon von weitem, was da liegt.
    karte.addLayer(symbolLayer(gruppe), 'maske');
  }

  // Die Spots liegen über allem anderen — sie sind der Kern der App. Ihr
  // Zelt ist etwas größer als die übrigen Zeichen und trägt die Farbe der
  // Bewertung: grün wenn gut oder noch nicht bewertet, gelb bei mittelmäßig,
  // braun bei schwach.
  karte.addLayer(symbolLayer('spot', 'spots'));

  // Die Zeichen werden aus der Legende gebaut. Das geht erst hier: vorher
  // steht der Kartenstil noch nicht, und addImage bräuchte ihn.
  for (const gruppe of OSM_EBENEN) symbolLaden(gruppe, gruppe, SYMBOL_FARBE[gruppe]);
  for (const [name, farbe] of Object.entries(SPOT_FARBEN)) symbolLaden(name, 'spot', farbe);
  for (const [name, farbe] of Object.entries(GIPFEL_FARBEN)) symbolLaden(name, 'gipfel', farbe);

  // Die eigene Position: erst der Genauigkeitskreis, dann der Punkt darauf.
  karte.addSource('ich', { type: 'geojson', data: leer() });
  karte.addLayer({
    id: 'ich-genauigkeit',
    type: 'fill',
    source: 'ich',
    filter: ['==', ['geometry-type'], 'Polygon'],
    paint: { 'fill-color': '#7bb661', 'fill-opacity': 0.18 },
  });
  karte.addLayer({
    id: 'ich-punkt',
    type: 'circle',
    source: 'ich',
    filter: ['==', ['geometry-type'], 'Point'],
    paint: {
      'circle-color': '#7bb661',
      'circle-radius': 7,
      'circle-stroke-width': 3,
      'circle-stroke-color': '#ffffff',
    },
  });

  // Startansicht setzen und die Karte gleichzeitig einsperren. Beim Erzeugen
  // der Karte steht die endgültige Fenstergröße noch nicht fest — ohne das
  // bliebe Österreich vor allem am Handy kleiner als der Platz hergibt.
  begrenzungSetzen();

  ebenenAnwenden();
  punkteLaden();
  spotsLaden();
  mitteAnzeigen();
});

function leer() {
  return { type: 'FeatureCollection', features: [] };
}

// ============================================================================
// 4b. DIE KARTE EINSPERREN
//
// Ohne Begrenzung kann man aus Österreich hinausschieben und landet in einer
// dunklen Fläche — außerhalb gibt es keine Kacheln von basemap.at. Am Handy
// passiert das schnell, weil ein Wisch dort viel weiter trägt.
//
// Eine feste Grenze in Grad einzutragen funktioniert aber nicht: wie viel
// Fläche ins Bild passt, hängt vom Seitenverhältnis ab. Auf einem hohen,
// schmalen Handy ist der sichtbare Ausschnitt bei gleicher Breite viermal so
// hoch wie auf einem Laptop — eine Grenze, die am PC passt, würde am Handy
// die Startansicht zusammenquetschen.
//
// Drei Fesseln, die zusammenarbeiten:
//
//   1. minZoom — ausgerechnet, indem Österreich einmal eingepasst wird.
//      Weiter hinaus als "ganz Österreich" braucht niemand.
//
//   2. maxBounds — die Fläche, die bei genau diesem minZoom zu sehen ist.
//      Sie MUSS so groß sein: gibt man MapLibre ein kleineres Rechteck, dann
//      zentriert es nicht etwa, sondern zoomt hinein, bis das Rechteck den
//      Bildschirm füllt. Auf einem hohen, schmalen Handy bliebe von
//      Österreich dann ein senkrechter Streifen übrig statt des ganzen
//      Landes. Genau daran ist der erste Versuch gescheitert.
//
//   3. Weil dieses Rechteck am Handy sehr hoch ausfällt (bei "ganz
//      Österreich" sieht man zwangsläufig viel Nord und Süd mit), käme man
//      beim Hineinzoomen damit trotzdem bis zur Nordsee. Deshalb wird
//      zusätzlich die KARTENMITTE im Land gehalten. Sie ist der Punkt, um
//      den sich alles dreht — bleibt sie in Österreich, kann das Land nie
//      ganz aus dem Bild wandern.
// ============================================================================

const AT_ECKEN = [[OESTERREICH[0], OESTERREICH[1]], [OESTERREICH[2], OESTERREICH[3]]];
const EU_ECKEN = [[EUROPA[0], EUROPA[1]], [EUROPA[2], EUROPA[3]]];

function begrenzungSetzen() {
  // Alte Fesseln lösen, sonst kann die Karte beim Einpassen nicht frei
  // arbeiten und das Ergebnis wäre von der vorigen Grenze verfälscht.
  karte.setMaxBounds(null);
  karte.setMinZoom(2);

  // Wie weit muss man heraus, damit Europa ins Bild passt? Das ist die
  // Grenze nach außen.
  karte.fitBounds(EU_ECKEN, { padding: 10, animate: false });
  const europaZoom = karte.getZoom();

  // Die Fläche, die man bei diesem Zoom sieht, wird zur erlaubten. Sie MUSS
  // so bestimmt werden und nicht als festes Rechteck: gibt man MapLibre
  // Grenzen, die kleiner sind als der Bildschirm, zoomt es hinein statt zu
  // zentrieren — auf einem hohen Handy bliebe von Europa ein Streifen übrig.
  const b = karte.getBounds();
  const dx = (b.getEast() - b.getWest()) * 0.02;
  const dy = (b.getNorth() - b.getSouth()) * 0.02;

  // Ein Hauch Spielraum, sonst fühlt sich die Karte am Anschlag wie
  // eingerastet an und ruckelt beim Zoomen mit zwei Fingern.
  karte.setMinZoom(europaZoom - 0.15);

  karte.setMaxBounds([
    [b.getWest() - dx, b.getSouth() - dy],
    [b.getEast() + dx, b.getNorth() + dy],
  ]);

  // Die Startansicht bleibt Österreich — dort liegen die Spots. Europa ist
  // da, wenn man es sehen will, drängt sich aber nicht auf.
  karte.fitBounds(AT_ECKEN, { padding: 20, animate: false });
}

// Die Mitte zurückholen, sobald sie Europa verlässt. Läuft bei jeder Bewegung
// mit — dadurch fühlt es sich wie ein Anschlag an und nicht wie ein
// Zurückspringen hinterher.
//
// Nötig ist das, weil die erlaubte Fläche oben aus der Bildschirmgröße
// gerechnet wird und dabei nach oben und unten großzügiger ausfällt als
// Europa. Ohne diese zweite Fessel käme man beim Hineinzoomen bis Grönland.
function mitteHalten() {
  const c = karte.getCenter();

  const lng = Math.min(Math.max(c.lng, EUROPA[0]), EUROPA[2]);
  const lat = Math.min(Math.max(c.lat, EUROPA[1]), EUROPA[3]);

  // Nur eingreifen, wenn es wirklich nötig ist. Sonst würde jede Bewegung
  // ein neues Setzen auslösen und die Karte zittern.
  if (lng !== c.lng || lat !== c.lat) {
    karte.setCenter([lng, lat]);
  }
}

karte.on('move', mitteHalten);

// Beim Drehen des Handys ändert sich das Seitenverhältnis komplett — dann
// muss die Grenze neu ausgerechnet werden, sonst passt Österreich plötzlich
// nicht mehr ins Bild. Kurz abwarten: der Browser meldet die neue Größe
// manchmal, bevor sie wirklich steht.
let dreh = null;
window.addEventListener('resize', () => {
  clearTimeout(dreh);
  dreh = setTimeout(() => {
    // Die aktuelle Ansicht merken und danach wiederherstellen — sonst würde
    // jedes Drehen zurück auf ganz Österreich springen.
    const mitte = karte.getCenter();
    const zoom = karte.getZoom();

    begrenzungSetzen();

    karte.jumpTo({ center: mitte, zoom: Math.max(zoom, karte.getMinZoom()) });
  }, 250);
});

// ============================================================================
// 5. GRUNDKARTE UMSCHALTEN
// ============================================================================

const grundKnoepfe = document.getElementById('grund-knoepfe');
let aktiveGrundkarte = 'standard';

// Für die Vorschau wird aus jedem Kartendienst eine einzelne Kachel geholt —
// dieselbe Bergflanke bei Zell am See. Dort sieht man den Unterschied
// zwischen den vier Stilen sofort: Wege, Relief, Wald, Höhenlinien.
//
// Zoom 13 und nicht weiter draußen, weil erst hier jeder Stil sein eigenes
// Gesicht zeigt. Bei Zoom 10 färbt OpenTopoMap die Höhenlagen kräftig rot
// ein — das sieht neben den anderen dreien aus wie ein Fehler, obwohl es
// keiner ist.
//
// Die Platzhalter in der Kachel-Adresse werden einfach ersetzt. Das klappt
// für beide Schreibweisen — basemap.at nummeriert {z}/{y}/{x}, OpenTopoMap
// {z}/{x}/{y}, und weil hier nach Namen ersetzt wird, ist das egal.
const VORSCHAU = { z: 13, x: 4386, y: 2868 };

function vorschauAdresse(g) {
  // Von einem Vektorstil gibt es keine Kachel zum Herzeigen — der bringt sein
  // Vorschaubild selbst mit.
  if (g.vorschau) return g.vorschau;
  return g.url
    .replace('{z}', VORSCHAU.z)
    .replace('{x}', VORSCHAU.x)
    .replace('{y}', VORSCHAU.y);
}

for (const g of GRUNDKARTEN) {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'stil';
  b.setAttribute('aria-pressed', String(g.id === aktiveGrundkarte));

  const bild = document.createElement('img');
  bild.src = vorschauAdresse(g);
  bild.alt = '';           // rein dekorativ, der Name steht daneben
  bild.loading = 'lazy';
  b.appendChild(bild);

  const name = document.createElement('span');
  name.textContent = g.label;
  b.appendChild(name);

  b.dataset.grund = g.id;
  b.onclick = () => grundkarteSetzen(g.id);
  grundKnoepfe.appendChild(b);
}

// Den Kartenstil umschalten. Ausgelagert, weil nicht nur der Knopf das tut:
// Beim Verlassen Österreichs schaltet die Karte selbst um (siehe unten).
function grundkarteSetzen(id) {
  const g = GRUNDKARTEN.find((x) => x.id === id);
  if (!g) return;
  aktiveGrundkarte = g.id;

  for (const x of GRUNDKARTEN) {
    if (x.vektor) continue;      // die hat keine eigene Ebene, siehe unten
    karte.setLayoutProperty('grund-' + x.id, 'visibility', x.id === g.id ? 'visible' : 'none');
  }

  // Die Standardkarte ist nicht eine Ebene, sondern der ganze Stil darunter.
  // Ein- und ausgeschaltet wird sie deshalb als Gruppe. Sie einfach liegen zu
  // lassen wäre verlockend — die anderen Karten decken sie ja ab —, aber
  // hinter dem Luftbild würde sie weiter Kacheln nachladen, und am Rand
  // Österreichs blitzte sie unter der Maske hervor.
  const stilAn = g.vektor ? 'visible' : 'none';
  for (const ebene of stilEbenen) {
    try { karte.setLayoutProperty(ebene, 'visibility', stilAn); } catch (e) { /* Ebene weg */ }
  }
  // Beschriftung nur dort, wo der Hintergrund selbst keine hat.
  karte.setLayoutProperty('beschriftung', 'visibility', g.beschriftung ? 'visible' : 'none');

  // Die Maske nur dort, wo sie gebraucht wird. Bei "Standard" sind die
  // Kacheln außerhalb Österreichs durchsichtig und bei "Wandern" deckt
  // OpenTopoMap ohnehin ganz Europa ab — dort würde die Maske nur den
  // Kontinent verstecken, den man gerade sehen will.
  karte.setLayoutProperty('maske', 'visibility', g.maske ? 'visible' : 'none');

  for (const btn of grundKnoepfe.children) {
    btn.setAttribute('aria-pressed', String(btn.dataset.grund === g.id));
  }
}

// ----------------------------------------------------------------------------
// Außerhalb Österreichs auf die Wanderkarte wechseln
//
// Spots lassen sich in ganz Europa setzen. Drei der vier Kartenstile kommen
// aber von basemap.at und enden an der Staatsgrenze — bei Gelände und
// Satellit liegt außerhalb die Maske, also eine dunkle Fläche. Wer dort einen
// Spot eintragen will, sähe schlicht nichts.
//
// Deshalb schaltet die Karte selbst auf "Wandern" (OpenTopoMap), sobald die
// Mitte Österreich verlässt. Zurück schaltet sie NICHT von allein: Wer sich
// bewusst für einen Stil entscheidet, soll ihn behalten, und ein Hin und Her
// an der Grenze wäre unerträglich.
// ----------------------------------------------------------------------------

// Liegt die Kartenmitte außerhalb Österreichs?
//
// Zwei Wege, die beide nicht taugen, und der dritte, der es tut:
//
//   1. Das Rechteck OESTERREICH — viel zu grob. Der Triglav in Slowenien
//      liegt auf 46,38° und damit mitten in diesem Rechteck, obwohl er
//      hundert Kilometer hinter der Grenze steht.
//
//   2. Die gezeichnete Maske abfragen (queryRenderedFeatures). Klingt
//      elegant, ist aber unzuverlässig: Die Maske ist ein Polygon über die
//      halbe Welt, und die Abfrage findet es nur dort, wo gerade
//      Geometrie in der Kachel liegt. In Norwegen traf sie, in Slowenien
//      nicht — ausprobiert und verworfen.
//
//   3. Selbst rechnen. Die Grenze liegt ohnehin schon als Datei vor: In
//      oesterreich-maske.geojson ist Ring 0 das Weltrechteck, alles danach
//      sind die Löcher — und die Löcher SIND Österreich, mitsamt Exklave.
//      Ein Strahlentest gegen diese Ringe ist exakt und kostet nichts.
// ----------------------------------------------------------------------------

let atRinge = null;

fetch('oesterreich-maske.geojson')
  .then((r) => r.json())
  .then((g) => {
    const geo = g.geometry ?? g.features?.[0]?.geometry;
    atRinge = geo.coordinates.slice(1);     // ohne das Weltrechteck
  })
  .catch(() => { atRinge = null; });

// Strahlentest: Wie oft kreuzt ein Strahl nach rechts den Rand? Ungerade
// heißt innen. Das Standardverfahren, in acht Zeilen.
function punktImRing(lng, lat, ring) {
  let drin = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if ((yi > lat) !== (yj > lat)
        && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) {
      drin = !drin;
    }
  }
  return drin;
}

function mitteAusserhalbOesterreichs() {
  // Solange die Grenze nicht geladen ist, lieber nichts umschalten.
  if (!atRinge) return false;
  const c = karte.getCenter();
  return !atRinge.some((ring) => punktImRing(c.lng, c.lat, ring));
}

function grundkarteNachLageAnpassen() {
  const g = GRUNDKARTEN.find((x) => x.id === aktiveGrundkarte);
  if (!g?.maske) return;            // Standard und Wandern zeigen überall etwas
  if (!mitteAusserhalbOesterreichs()) return;

  grundkarteSetzen('topo');
  status('Außerhalb Österreichs auf <b>Wandern</b> gewechselt — '
    + 'Gelände und Satellit gibt es nur fürs Inland.', { dauer: 5000 });
}

karte.on('moveend', grundkarteNachLageAnpassen);

// ============================================================================
// 5b. DIE ZWEI TAFELN OBEN
//
// Immer nur eine offen. Ein Klick daneben, ein Klick auf die Karte oder
// Escape schließt sie wieder — man soll nie suchen müssen, wie man etwas
// wieder loswird.
// ============================================================================

const TAFELN = [
  { knopf: 'knopf-ebenen', tafel: 'tafel-ebenen' },
  { knopf: 'knopf-einstellungen', tafel: 'tafel-einstellungen' },
];

function tafelnSchliessen(ausser = null) {
  for (const t of TAFELN) {
    if (t.tafel === ausser) continue;
    document.getElementById(t.tafel).hidden = true;
    document.getElementById(t.knopf).setAttribute('aria-expanded', 'false');
  }
}

for (const t of TAFELN) {
  const knopf = document.getElementById(t.knopf);
  const tafel = document.getElementById(t.tafel);

  knopf.onclick = (e) => {
    e.stopPropagation();
    const auf = tafel.hidden;
    tafelnSchliessen();
    tafel.hidden = !auf;
    knopf.setAttribute('aria-expanded', String(auf));
  };

  // Klicks in der Tafel selbst dürfen sie nicht schließen.
  tafel.onclick = (e) => e.stopPropagation();
}

document.addEventListener('click', () => tafelnSchliessen());
karte.on('click', () => tafelnSchliessen());

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') tafelnSchliessen();
});

// ============================================================================
// 6. DATENEBENEN AN UND AUS
// ============================================================================

// Welche Ebenen an sind. Beim Öffnen ist immer nur "Spots" eingeschaltet —
// die Karte startet aufgeräumt, und man holt sich dazu, was man gerade
// braucht. Mit allen fünf Ebenen an ist Österreich ein Punkteteppich, unter
// dem die Spots verschwinden, und die sind der Grund für die App.
//
// Bewusst wird der Stand NICHT über das Schließen hinaus gemerkt: "beim
// Start nur Spots" ist eine Zusage, die sonst nur beim allerersten Mal
// stimmen würde. Innerhalb einer Sitzung bleibt natürlich alles so, wie man
// es eingestellt hat.
const ebenen = {
  wasser: false, unterstand: false, seen: false, wasserfall: false,
  gipfel: false, spots: true,
};

function ebenenAnwenden() {
  // Erst wenn die Ebenen überhaupt existieren. Hier stand vorher eine Abfrage
  // auf "wasser-punkt" — diese Ebene ist beim Umstieg auf Symbole
  // weggefallen, und dadurch brach die Funktion jedes Mal ab: die Karte
  // zeigte alles an, egal was eingestellt war.
  if (!karte.getLayer('wasser-symbol')) return;

  for (const [gruppe, an] of Object.entries(ebenen)) {
    const v = an ? 'visible' : 'none';
    for (const suffix of ['-cluster', '-symbol']) {
      if (karte.getLayer(gruppe + suffix)) {
        karte.setLayoutProperty(gruppe + suffix, 'visibility', v);
      }
    }
  }
}

for (const gruppe of [...OSM_EBENEN, 'spots']) {
  const knopf = document.getElementById('knopf-' + gruppe);
  // Den Schalter auf den gemerkten Stand bringen — das HTML kennt nur die
  // Voreinstellung.
  knopf.setAttribute('aria-pressed', String(ebenen[gruppe]));

  knopf.onclick = () => {
    ebenen[gruppe] = !ebenen[gruppe];
    knopf.setAttribute('aria-pressed', String(ebenen[gruppe]));
    ebenenAnwenden();
    if (!ebenen[gruppe]) return;
    if (gruppe === 'spots') spotsLaden(); else punkteLaden();
  };
}

// ============================================================================
// 7. PUNKTE AUS DER DATENBANK HOLEN
//
// Aufgerufen wird die Datenbankfunktion water_points_in_bbox — sie liefert
// nur, was im sichtbaren Rechteck liegt. Das ist der Grund, warum die Karte
// auch bei 55.000 Wasserstellen flüssig bleibt.
// ============================================================================

let letzteBbox = null;      // die zuletzt geladene Fläche, mit Puffer
let ladeTimer = null;
let laeuft = false;

function bboxEnthaelt(gross, klein) {
  return gross && klein &&
    gross[0] <= klein[0] && gross[1] <= klein[1] &&
    gross[2] >= klein[2] && gross[3] >= klein[3];
}

// Es gibt rund 1.400 Bergseen und 1.800 Wasserfälle, aber 17.000
// Trinkbrunnen. Die beiden ersten sind deshalb von Anfang an da — auch in der
// Österreich-Übersicht, wo man ja gerade nach ihnen sucht. Alles andere kommt
// erst beim Hineinzoomen.
//
// Früher stand hier zusätzlich eine untere Zoom-Schwelle, damit in der
// Weltansicht nicht das ganze Land abgefragt wird. Die ist weggefallen:
// seit die Karte auf Österreich begrenzt ist, gibt es keine Ansicht mehr,
// die größer wäre als das Land. Die Schwelle hat stattdessen Schaden
// angerichtet — auf einem 390 Pixel breiten Handy landet der Zoom, bei dem
// Österreich genau hineinpasst, bei 4,9999. Damit blieb die Ebene leer,
// obwohl die Karte fertig eingepasst war.
// (Die Liste der Arten dafür steht oben als WEITSICHT_ARTEN.)

let letzterModus = null;   // 'alles' oder 'nur-seen' — Wechsel erzwingt Neuladen

// Supabase liefert pro Abfrage höchstens 1.000 Zeilen. Bei 1.400 Bergseen
// fehlten dadurch stillschweigend 400 Stück. Deshalb wird seitenweise geholt,
// bis nichts mehr kommt.
//
// Wichtig: über limit und offset in der Adresse, NICHT über den Range-Kopf.
// Den beachtet Supabase bei Datenbankfunktionen nicht — man bekommt dann
// stumm immer wieder dieselben ersten 1.000 Zeilen.
const SEITE = 1000;
const HOECHSTENS = 6000;   // Notbremse: mehr Punkte braucht keine Kartenansicht

async function punkteAbfragen(bbox, kinds) {
  const alle = [];

  for (let offset = 0; offset < HOECHSTENS; offset += SEITE) {
    const res = await fetch(
      `${cfg.supabaseUrl}/rest/v1/rpc/water_points_in_bbox?limit=${SEITE}&offset=${offset}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': cfg.supabaseAnonKey,
          'Authorization': 'Bearer ' + cfg.supabaseAnonKey,
        },
        body: JSON.stringify({
          min_lat: bbox[1], min_lng: bbox[0],
          max_lat: bbox[3], max_lng: bbox[2],
          kinds,
        }),
      }
    );

    if (!res.ok) {
      throw new Error('Antwort ' + res.status + ': ' + (await res.text()).slice(0, 200));
    }

    const teil = await res.json();
    alle.push(...teil);

    // Weniger als eine volle Seite heißt: das war alles.
    if (teil.length < SEITE) break;
  }
  return alle;
}

// Ist dieser Gipfel schon gesammelt? Die Antwort kennt gipfel.js — diese
// Datei fragt nur nach und kommt auch ohne die Antwort zurecht (dann ist eben
// kein Gipfel golden).
function gipfelGesammelt(id) {
  return !!(window.WILDSPOT_GIPFEL && window.WILDSPOT_GIPFEL.hat &&
            window.WILDSPOT_GIPFEL.hat(id));
}

// Nach dem Sammeln eines Gipfels muss die Karte ihre Punkte neu einfärben.
// Der einfachste verlässliche Weg: den gemerkten Ausschnitt vergessen und
// neu laden.
window.WILDCAMP_PUNKTE_NEU = () => {
  letzteBbox = null;
  punkteLaden();
};

async function punkteLaden() {
  if (!cfg.supabaseAnonKey) return;                 // Schlüssel fehlt noch
  if (!karte.getSource('wasser')) return;           // Karte noch nicht fertig

  const zoom = karte.getZoom();

  // Weit draußen nur die Bergseen holen — sonst kämen zehntausende Brunnen.
  const modus = zoom < ZOOM_SCHWELLE ? 'nur-seen' : 'alles';

  const b = karte.getBounds();
  const sicht = [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()];

  // Schon geladen? Dann nichts tun. Das verhindert eine Abfrage bei jedem
  // kleinen Verschieben der Karte. Beim Moduswechsel muss aber neu geladen
  // werden, auch wenn der Ausschnitt derselbe ist.
  if (modus === letzterModus && bboxEnthaelt(letzteBbox, sicht)) return;
  if (laeuft) return;

  // Mit Puffer laden, damit kurzes Weiterschieben keine neue Abfrage auslöst.
  const dx = (sicht[2] - sicht[0]) * 0.3;
  const dy = (sicht[3] - sicht[1]) * 0.3;
  const lade = [sicht[0] - dx, sicht[1] - dy, sicht[2] + dx, sicht[3] + dy];

  laeuft = true;
  status(modus === 'nur-seen'
    ? 'Bergseen und Wasserfälle werden geladen …'
    : 'Karte wird geladen …');

  try {
    const zeilen = await punkteAbfragen(lade, modus === 'nur-seen' ? WEITSICHT_ARTEN : null);

    // Für jede Ebene ein leerer Topf, in den die Punkte einsortiert werden.
    const nach = Object.fromEntries(OSM_EBENEN.map((g) => [g, []]));

    for (const z of zeilen) {
      const art = ARTEN[z.kind];
      if (!art) continue;
      nach[art.gruppe].push({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [z.lng, z.lat] },
        properties: {
          id: z.id,
          kind: z.kind,
          name: z.name || '',
          elevation_m: z.elevation_m ?? null,
          // Nur bei Gipfeln von Bedeutung: gesammelt oder nicht. Die Antwort
          // steht in gipfel.js, nicht in der Datenbankabfrage — sonst müsste
          // jede Kartenbewegung die eigene Sammlung mitschleppen.
          gesammelt: z.kind === 'peak' && gipfelGesammelt(z.id),
        },
      });
    }

    for (const gruppe of OSM_EBENEN) {
      karte.getSource(gruppe).setData({ type: 'FeatureCollection', features: nach[gruppe] });
    }

    letzteBbox = lade;
    letzterModus = modus;

    // Wie die Ebenen in der Meldung heißen sollen, in dieser Reihenfolge.
    const NAMEN = {
      seen: 'Bergseen', wasserfall: 'Wasserfälle',
      wasser: 'Wasserstellen', unterstand: 'Unterkünfte',
      gipfel: 'Gipfel',
    };

    const teile = [];
    for (const gruppe of ['seen', 'wasserfall', 'gipfel', 'wasser', 'unterstand']) {
      if (nach[gruppe].length) teile.push(`${nach[gruppe].length} ${NAMEN[gruppe]}`);
    }

    if (modus === 'nur-seen') {
      status(teile.length
        ? teile.join(' und ') + '. Näher heranzoomen für Wasser und Unterkünfte.'
        : 'Näher heranzoomen, dann erscheinen Wasserstellen und Unterkünfte.',
        { dauer: 2500 });
    } else {
      status(teile.length
        ? teile.join(', ') + ' in diesem Ausschnitt.'
        : 'In diesem Ausschnitt ist nichts eingetragen.', { dauer: 2500 });
    }

  } catch (err) {
    letzteBbox = null;
    letzterModus = null;
    status('Die Karte konnte nicht geladen werden.<br><span class="meta">' +
           String(err.message) + '</span>', { warnung: true, dauer: 8000 });
  } finally {
    laeuft = false;
  }
}

// Nach dem Bewegen kurz warten — sonst würde jede Zwischenposition abgefragt.
karte.on('moveend', () => {
  clearTimeout(ladeTimer);
  ladeTimer = setTimeout(() => { punkteLaden(); spotsLaden(); }, 350);
});

// ============================================================================
// 7b. DIE SPOTS
//
// Die Spots sind für jeden sichtbar, auch ohne Konto (Migration 007). Eine
// Karte, auf der ohne Anmeldung nichts steht, gibt niemandem einen Grund,
// sich anzumelden. Angelegt, bewertet und kommentiert wird weiterhin nur
// mit Konto — das regeln die Schreibregeln in der Datenbank.
//
// Es gibt keine Zoom-Schwelle: Spots sind selten und wertvoll, die sollen
// auch in der Österreich-Übersicht zu sehen sein.
// ============================================================================

const auth = window.WILDCAMP_AUTH;
let spotsLaeuft = false;

// ----------------------------------------------------------------------------
// Die Spots für unterwegs mitnehmen
//
// Der Service Worker hebt Kartenkacheln auf, aber nicht die Spots: Die werden
// über einen Aufruf geholt, der technisch als "schreibend" gilt (rpc), und den
// darf der Browser nicht aufheben. Ohne das hier wäre am Berg zwar die Karte
// da, aber keine einzige Fahne darauf — also genau das, was fehlt.
//
// Deshalb bleibt jeder einmal geladene Spot hier liegen, nach Nummer vereinigt.
// Neuere Angaben überschreiben ältere.
// ----------------------------------------------------------------------------
const SPOT_SPEICHER = 'wildspot-spots-offline';
const SPOT_SPEICHER_MAX = 2000;

function spotsMerken(features) {
  try {
    const bekannt = new Map(spotsAusSpeicher().map((f) => [f.properties.id, f]));
    for (const f of features) bekannt.set(f.properties.id, f);

    // Wird es zu viel, fliegt das Älteste zuerst raus.
    let alle = [...bekannt.values()];
    if (alle.length > SPOT_SPEICHER_MAX) alle = alle.slice(-SPOT_SPEICHER_MAX);

    localStorage.setItem(SPOT_SPEICHER, JSON.stringify(alle));
  } catch { /* voller Speicher ist kein Grund, die App anzuhalten */ }
}

function spotsAusSpeicher() {
  try {
    const roh = localStorage.getItem(SPOT_SPEICHER);
    const alle = roh ? JSON.parse(roh) : [];
    return Array.isArray(alle) ? alle : [];
  } catch {
    return [];
  }
}

async function spotsLaden() {
  if (!karte.getSource('spots')) return;
  if (spotsLaeuft) return;

  const b = karte.getBounds();
  spotsLaeuft = true;

  try {
    const { data, error } = await auth.client.rpc('spots_in_bbox', {
      min_lat: b.getSouth(), min_lng: b.getWest(),
      max_lat: b.getNorth(), max_lng: b.getEast(),
    });
    if (error) throw error;

    const features = (data || []).map((s) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [s.lng, s.lat] },
      properties: {
        id: s.id,
        name: s.name,
        avg_stars: Number(s.avg_stars) || 0,
        rating_count: Number(s.rating_count) || 0,
        water_nearby: s.water_nearby,
        above_treeline: s.above_treeline,
        elevation_m: s.elevation_m,
        // Alles ab hier hängt am Punkt, damit die Filterchips (screens.js)
        // ohne neue Abfrage arbeiten können: Sie blenden Punkte aus, statt
        // sie neu zu holen — das geht sofort und auch ohne Netz.
        //
        // Seit den über zwanzig Filtern (db/021) sind es entsprechend mehr
        // Felder. Ein Feld, das hier fehlt, ist für die Karte nicht
        // vorhanden — der zugehörige Chip würde dann ALLE Punkte ausblenden.
        has_lake: s.has_lake,
        hike_minutes: s.hike_minutes,
        fire_allowed: s.fire_allowed,
        discreet: s.discreet,
        water_type: s.water_type,
        water_reliable: s.water_reliable,
        exposure: s.exposure,
        access: s.access,
        ground_type: s.ground_type,
        flat_tent_spots: s.flat_tent_spots,
        shelter_nearby: s.shelter_nearby,
        firewood_available: s.firewood_available,
        mobile_signal: s.mobile_signal,
        legal_status: s.legal_status,
        season: s.season || [],
        // Fertig gerechnet statt als Datum: Ein Kartenausdruck kann keine
        // Zeichenkette in ein Datum verwandeln.
        frisch: !!(s.created_at &&
                   (Date.now() - new Date(s.created_at).getTime()) < 30 * 86400000),
      },
    }));

    karte.getSource('spots').setData({ type: 'FeatureCollection', features });
    spotsMerken(features);
  } catch (err) {
    // Kein Netz: die vom letzten Mal zeigen. Eine Karte mit den Spots von
    // gestern ist am Berg unendlich viel mehr wert als eine leere.
    const gemerkt = spotsAusSpeicher();

    if (gemerkt.length) {
      karte.getSource('spots').setData({
        type: 'FeatureCollection', features: gemerkt,
      });
      // Der Balken "Kein Netz" steht schon oben (offline.js) — hier genügt
      // eine kurze Erklärung, warum trotzdem Spots zu sehen sind.
      if (!navigator.onLine) {
        status('Spots vom letzten Mal — ohne Netz kann nichts nachgeladen werden.',
               { dauer: 5000 });
      } else {
        status('Spots konnten nicht geladen werden.<br><span class="meta">' +
               String(err.message) + '</span>', { warnung: true, dauer: 6000 });
      }
    } else {
      status('Spots konnten nicht geladen werden.<br><span class="meta">' +
             String(err.message) + '</span>', { warnung: true, dauer: 6000 });
    }
  } finally {
    spotsLaeuft = false;
  }
}

// Bei An- und Abmeldung sofort neu laden statt auf die nächste Bewegung warten.
auth.beiWechsel.push((nutzer) => {
  spotsLaden();
  // spot-form.js wird nach dieser Datei geladen. Beim allerersten Ereignis
  // kann die Funktion deshalb noch fehlen — dann holt sie es selbst nach.
  if (typeof spotKnopfAnpassen === 'function') spotKnopfAnpassen(nutzer);
});

// ============================================================================
// 8. POPUP BEIM ANTIPPEN
// ============================================================================

for (const gruppe of OSM_EBENEN) {
  karte.on('click', gruppe + '-symbol', (e) => {
    const f = e.features[0];
    const art = ARTEN[f.properties.kind] || { label: f.properties.kind };

    // Ein Gipfel bekommt kein Popup, sondern ein eigenes Blatt: Dort steht
    // die Höhe, der Rang im Land, wer schon oben war — und der Knopf, mit
    // dem man ihn sammelt. In eine Sprechblase passt das nicht.
    if (f.properties.kind === 'peak' && window.WILDSPOT_GIPFEL) {
      window.WILDSPOT_GIPFEL.oeffnen(f.properties.id, f.properties.name);
      return;
    }

    const [lng, lat] = f.geometry.coordinates;
    const name = f.properties.name;
    const hoehe = f.properties.elevation_m;

    new maplibregl.Popup({ offset: 12, closeButton: true })
      .setLngLat(f.geometry.coordinates)
      .setHTML(
        `<b>${name ? escapeHtml(name) : art.label}</b>` +
        `<div class="meta">${name ? art.label : ''}` +
        (hoehe ? `${name ? ' · ' : ''}${hoehe} m` : '') + `</div>` +
        `<div class="meta">${lat.toFixed(5)}, ${lng.toFixed(5)}</div>` +
        `<div class="meta" style="margin-top:6px">` +
        `<a href="https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=17/${lat}/${lng}" ` +
        `target="_blank" rel="noopener">in OpenStreetMap ansehen</a></div>`
      )
      .addTo(karte);
  });

  // Cluster antippen zoomt hinein, bis die einzelnen Punkte auseinanderfallen.
  karte.on('click', gruppe + '-cluster', (e) => {
    karte.easeTo({ center: e.lngLat, zoom: Math.min(karte.getZoom() + 2.5, 19) });
  });

  for (const suffix of ['-symbol', '-cluster']) {
    karte.on('mouseenter', gruppe + suffix, () => karte.getCanvas().style.cursor = 'pointer');
    karte.on('mouseleave', gruppe + suffix, () => karte.getCanvas().style.cursor = '');
  }
}

// Macht Nutzertext für HTML unschädlich. Wird von allen Teilen der App
// verwendet, sobald etwas in innerHTML landet — Spot-Namen, Beschreibungen,
// Kommentare.
//
// Das einfache Anführungszeichen MUSS mit in die Liste. Vorher fehlte es, und
// das war eine echte Lücke: In suche.js wird ein Attribut mit einfachen
// Anführungszeichen begrenzt (data-ziel='…'). Ein Spot mit einem ' im Namen
// konnte daraus ausbrechen und eigene Attribute anhängen — etwa
// onmouseover='…'. Damit hätte jeder, der einen Spot anlegen darf, fremden
// Besuchern Code unterschieben können, Admins eingeschlossen.
// Nachgewiesen und behoben am 2026-08-12.
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

// Ein Spot bekommt kein Popup, sondern die Leiste rechts: dort ist Platz für
// alle Angaben, die Bewertungen und die Kommentare (siehe spot-detail.js).
karte.on('click', 'spots-symbol', (e) => {
  const p = e.features[0].properties;
  const [lng, lat] = e.features[0].geometry.coordinates;

  if (typeof window.spotDetailOeffnen === 'function') {
    window.spotDetailOeffnen(p.id, p.name, lat, lng);
  }
});

karte.on('mouseenter', 'spots-symbol', () => karte.getCanvas().style.cursor = 'pointer');
karte.on('mouseleave', 'spots-symbol', () => karte.getCanvas().style.cursor = '');

function sterne(schnitt) {
  const voll = Math.round(Number(schnitt) || 0);
  return '<span style="color:#e8c34a">' + '★'.repeat(voll) + '</span>' +
         '<span style="color:#5a614f">' + '★'.repeat(5 - voll) + '</span>';
}

// ============================================================================
// 9. MEINE POSITION
// ============================================================================

const knopfPosition = document.getElementById('knopf-position');

knopfPosition.onclick = () => {
  if (!navigator.geolocation) {
    status('Dieser Browser kennt keine Standortbestimmung.', { warnung: true, dauer: 5000 });
    return;
  }

  knopfPosition.disabled = true;
  status('Position wird gesucht …');

  navigator.geolocation.getCurrentPosition(
    (pos) => {
      knopfPosition.disabled = false;
      const { latitude: lat, longitude: lng, accuracy } = pos.coords;

      karte.getSource('ich').setData({
        type: 'FeatureCollection',
        features: [
          kreis(lng, lat, accuracy),
          { type: 'Feature', geometry: { type: 'Point', coordinates: [lng, lat] }, properties: {} },
        ],
      });

      karte.flyTo({ center: [lng, lat], zoom: Math.max(karte.getZoom(), 14) });
      status(`Du bist hier — auf etwa ${Math.round(accuracy)} m genau.`, { dauer: 4000 });
    },
    (err) => {
      knopfPosition.disabled = false;
      const texte = {
        1: 'Der Standort wurde blockiert. Im Browser rechts in der Adresszeile die Standortfreigabe erlauben.',
        2: 'Der Standort ist gerade nicht ermittelbar.',
        3: 'Die Standortsuche hat zu lange gedauert.',
      };
      status(texte[err.code] || err.message, { warnung: true, dauer: 7000 });
    },
    { enableHighAccuracy: true, timeout: 12000, maximumAge: 30000 }
  );
};

// Ein Kreis mit Radius in Metern, als Vieleck aus 64 Ecken.
function kreis(lng, lat, meter) {
  const punkte = [];
  const gradProMeterBreite = 1 / 111320;
  const gradProMeterLaenge = 1 / (111320 * Math.cos(lat * Math.PI / 180));
  for (let i = 0; i <= 64; i++) {
    const w = (i / 64) * 2 * Math.PI;
    punkte.push([
      lng + Math.cos(w) * meter * gradProMeterLaenge,
      lat + Math.sin(w) * meter * gradProMeterBreite,
    ]);
  }
  return { type: 'Feature', geometry: { type: 'Polygon', coordinates: [punkte] }, properties: {} };
}

// ============================================================================
// 10. KOORDINATEN DER KARTENMITTE
//
// Das Fadenkreuz zeigt genau hierher. Beim Anlegen eines Spots wird das
// später die Position des neuen Platzes sein.
// ============================================================================

const mitteEl = document.getElementById('mitte');

function mitteAnzeigen() {
  const c = karte.getCenter();
  mitteEl.textContent = `${c.lat.toFixed(5)}, ${c.lng.toFixed(5)}  ·  Zoom ${karte.getZoom().toFixed(1)}`;
  mitteEl.dataset.koord = `${c.lat.toFixed(5)}, ${c.lng.toFixed(5)}`;
}

karte.on('move', mitteAnzeigen);

mitteEl.onclick = async () => {
  try {
    await navigator.clipboard.writeText(mitteEl.dataset.koord);
    status('Koordinaten kopiert: ' + mitteEl.dataset.koord, { dauer: 2000 });
  } catch {
    status('Kopieren hat nicht geklappt — der Browser erlaubt es hier nicht.', { warnung: true, dauer: 3000 });
  }
};

// ============================================================================
// 11. RECHTSHINWEIS BEIM ERSTEN START
// ============================================================================

const HINWEIS_SCHLUESSEL = 'wildcamp-hinweis-gelesen';
const hinweisHg = document.getElementById('hinweis-hg');

if (localStorage.getItem(HINWEIS_SCHLUESSEL) !== 'ja') {
  hinweisHg.hidden = false;
}
document.getElementById('hinweis-ok').onclick = () => {
  localStorage.setItem(HINWEIS_SCHLUESSEL, 'ja');
  hinweisHg.hidden = true;
};

// Aus den Einstellungen heraus noch einmal nachlesen. Beim Wildcampen sind
// die Regeln der Punkt, an dem man sich am ehesten unsicher ist — deshalb
// darf der Hinweis nicht nach dem ersten Wegklicken für immer verschwinden.
document.getElementById('knopf-hinweis-nochmal').onclick = () => {
  tafelnSchliessen();
  hinweisHg.hidden = false;
};

// ============================================================================
// 12. HINWEIS, WENN DER SCHLÜSSEL NOCH FEHLT
// ============================================================================

if (!cfg.supabaseAnonKey) {
  status(
    '<b>Die Karte läuft, die Wasserstellen fehlen noch.</b><br>' +
    'Dafür fehlt der anon-Schlüssel in <code>web/config.js</code> — ' +
    'zu finden im Supabase-Dashboard unter <i>Project Settings → API Keys</i>.',
    { warnung: true }
  );
}
