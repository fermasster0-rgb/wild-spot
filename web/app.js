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
// basemap.at ist die offizielle österreichische Verwaltungskarte: kostenlos,
// ohne Anmeldung, ohne Schlüssel. OpenTopoMap liefert Höhenlinien und Wege.
// ============================================================================

const GRUNDKARTEN = [
  {
    id: 'standard',
    label: 'Standard',
    url: 'https://mapsneu.wien.gv.at/basemap/geolandbasemap/normal/google3857/{z}/{y}/{x}.png',
    maxzoom: 19,
  },
  {
    id: 'gelaende',
    label: 'Gelände',
    // Schummerung des Geländes. Man sieht auf einen Blick, wo es flach ist —
    // die wichtigste Information bei der Suche nach einem Zeltplatz.
    url: 'https://mapsneu.wien.gv.at/basemap/bmapgelaende/grau/google3857/{z}/{y}/{x}.jpeg',
    maxzoom: 19,
    beschriftung: true,
  },
  {
    id: 'ortho',
    label: 'Satellit',
    // Luftbild mit 30 cm Auflösung. Baumgrenze, Wasser und Wiesen sind hier
    // direkt erkennbar.
    url: 'https://mapsneu.wien.gv.at/basemap/bmaporthofoto30cm/normal/google3857/{z}/{y}/{x}.jpeg',
    maxzoom: 19,
    beschriftung: true,
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
const OSM_EBENEN = ['wasser', 'unterstand', 'seen', 'wasserfall'];

// Diese beiden sind schon in der Österreich-Übersicht zu sehen. Sie sind
// selten (1.417 Seen, 1.777 Wasserfälle) und man sucht gezielt nach ihnen —
// anders als bei 16.000 Trinkbrunnen, die erst beim Hineinzoomen erscheinen.
const WEITSICHT_EBENEN = ['seen', 'wasserfall'];

// Dieselben Ebenen, als Arten für die Datenbankabfrage.
const WEITSICHT_ARTEN = Object.entries(ARTEN)
  .filter(([, a]) => WEITSICHT_EBENEN.includes(a.gruppe))
  .map(([kind]) => kind);

// Ab diesem Zoom werden Punkte geladen. Weiter draußen wären es zu viele,
// und man könnte sie ohnehin nicht auseinanderhalten.
const ZOOM_SCHWELLE = 11;

// Österreich: West, Süd, Ost, Nord
const OESTERREICH = [9.5, 46.3, 17.2, 49.1];

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
    layout: { visibility: g.id === 'standard' ? 'visible' : 'none' },
  });
}

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
    cluster: !WEITSICHT_EBENEN.includes(gruppe),
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

const karte = new maplibregl.Map({
  container: 'karte',
  style: {
    version: 8,
    sources,
    // Eine ruhige dunkle Fläche unter allem. Sie ist überall dort zu sehen,
    // wo basemap.at aufhört — also außerhalb Österreichs.
    layers: [
      { id: 'hintergrund', type: 'background', paint: { 'background-color': '#141812' } },
      ...rasterLayers,
      // Direkt über den Grundkarten, aber unter allen Datenpunkten: die
      // Wasserstellen und Spots sollen ja nicht verdeckt werden. Die Farbe
      // ist dieselbe wie beim Hintergrund darunter, damit man die Kante
      // zwischen beiden nirgends sieht.
      {
        id: 'maske',
        type: 'fill',
        source: 'maske',
        paint: { 'fill-color': '#141812', 'fill-antialias': true },
      },
    ],
  },
  // Startansicht: ganz Österreich, passend zur Fenstergröße. Deshalb bounds
  // statt fixem Zoom — auf einem Handy sieht das sonst völlig anders aus.
  bounds: [[OESTERREICH[0], OESTERREICH[1]], [OESTERREICH[2], OESTERREICH[3]]],
  fitBoundsOptions: { padding: 24 },
  // minZoom und maxBounds werden nicht hier festgelegt, sondern unten in
  // begrenzungSetzen() ausgerechnet — sie hängen von der Fenstergröße ab.
  maxZoom: 19,
  attributionControl: false,   // steht bei uns fest in der Fußzeile
});

karte.dragRotate.disable();
karte.touchZoomRotate.disableRotation();

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
  spot:       '#4d9e35',
};

// Für Spots zusätzlich nach Bewertung, damit man ein Urteil auf der Karte
// sieht, ohne den Spot zu öffnen.
const SPOT_FARBEN = {
  'spot':         '#4d9e35',   // noch nicht bewertet — das Grün der App
  'spot-mittel':  '#c08a1e',
  'spot-schwach': '#a85a2a',
};

// Das Zeichen wird zweimal übereinander gezeichnet: zuerst dick in Weiß,
// dann dünner in seiner Farbe. Der weiße Rand darunter ist der Grund, warum
// ein Symbol ohne Kreis auf einem Luftbild oder im Wald überhaupt lesbar
// bleibt — ohne ihn verschwindet ein blauer Strich im blauen Bach.
function symbolLaden(name, quelleKlasse, farbe) {
  const vorlage = document.querySelector('.sym.' + (quelleKlasse || name));
  if (!vorlage) return;

  const inhalt = vorlage.innerHTML;
  const gefuellt = (quelleKlasse || name) === 'wasser';   // der Tropfen ist eine Fläche

  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" ` +
    `width="${SYMBOL_GROESSE}" height="${SYMBOL_GROESSE}">` +
      // Unterlage: derselbe Umriss, nur dick und weiß. Kräftig genug, dass
      // das Zeichen auch auf einer bunten Wanderkarte noch heraussticht —
      // es hat keinen farbigen Kreis mehr, der ihm Gewicht gibt.
      `<g fill="${gefuellt ? '#ffffff' : 'none'}" stroke="#ffffff" stroke-width="6.5" ` +
      `stroke-linecap="round" stroke-linejoin="round">${inhalt}</g>` +
      // Darüber das eigentliche Zeichen.
      `<g fill="${gefuellt ? farbe : 'none'}" stroke="${gefuellt ? 'none' : farbe}" ` +
      `stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">${inhalt}</g>` +
    `</svg>`;

  const bild = new Image(SYMBOL_GROESSE, SYMBOL_GROESSE);
  bild.onload = () => {
    // pixelRatio 2 heißt: das Bild ist doppelt so fein wie seine Anzeige.
    // Auf einem Handybildschirm bleibt es dadurch scharf.
    if (!karte.hasImage('sym-' + name)) karte.addImage('sym-' + name, bild, { pixelRatio: 2 });
  };
  bild.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
}

// Bei den Spots hängt das Zeichen von der Bewertung ab, sonst ist es fest.
function symbolAusdruck(gruppe) {
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
      'icon-size': ['interpolate', ['linear'], ['zoom'],
        5,  gross ? 0.36 : 0.28,
        9,  gross ? 0.52 : 0.44,
        13, gross ? 0.72 : 0.62,
        16, gross ? 0.86 : 0.74,
      ],
      // Ohne diese beiden lässt MapLibre Symbole weg, sobald sie sich
      // berühren — in den Alpen wäre dann die Hälfte unsichtbar.
      'icon-allow-overlap': true,
      'icon-ignore-placement': true,
    },
  };
}

karte.on('load', () => {
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

// Der Saum rundherum, in Grad. Knapp gehalten: er ist nur dafür da, dass ein
// Grenzort wie Bregenz nicht am äußersten Bildrand klebt.
const SAUM_LNG = 0.35;
const SAUM_LAT = 0.25;

function begrenzungSetzen() {
  // Alte Fesseln lösen, sonst kann die Karte beim Einpassen nicht frei
  // arbeiten und das Ergebnis wäre von der vorigen Grenze verfälscht.
  karte.setMaxBounds(null);
  karte.setMinZoom(3);

  karte.fitBounds(AT_ECKEN, { padding: 20, animate: false });

  // Ein Hauch Spielraum nach unten, sonst fühlt sich die Karte am Anschlag
  // wie eingerastet an und ruckelt beim Zoomen mit zwei Fingern.
  karte.setMinZoom(karte.getZoom() - 0.15);

  const b = karte.getBounds();
  const dx = (b.getEast() - b.getWest()) * 0.02;
  const dy = (b.getNorth() - b.getSouth()) * 0.02;

  karte.setMaxBounds([
    [b.getWest() - dx, b.getSouth() - dy],
    [b.getEast() + dx, b.getNorth() + dy],
  ]);
}

// Die Mitte zurückholen, sobald sie das Land verlässt. Läuft bei jeder
// Bewegung mit — dadurch fühlt es sich wie ein Anschlag an und nicht wie ein
// Zurückspringen hinterher.
function mitteHalten() {
  const c = karte.getCenter();

  const lng = Math.min(Math.max(c.lng, OESTERREICH[0] - SAUM_LNG), OESTERREICH[2] + SAUM_LNG);
  const lat = Math.min(Math.max(c.lat, OESTERREICH[1] - SAUM_LAT), OESTERREICH[3] + SAUM_LAT);

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

  b.onclick = () => {
    aktiveGrundkarte = g.id;
    for (const x of GRUNDKARTEN) {
      karte.setLayoutProperty('grund-' + x.id, 'visibility', x.id === g.id ? 'visible' : 'none');
    }
    // Beschriftung nur dort, wo der Hintergrund selbst keine hat.
    karte.setLayoutProperty('beschriftung', 'visibility', g.beschriftung ? 'visible' : 'none');
    for (const btn of grundKnoepfe.children) {
      btn.setAttribute('aria-pressed', String(btn === b));
    }
  };
  grundKnoepfe.appendChild(b);
}

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

// Welche Ebenen an sind. Das Gerät merkt sich die Einstellung: wer die
// Trinkbrunnen abgeschaltet hat, will sie beim nächsten Öffnen nicht wieder
// vor sich haben. Beim allerersten Start setzt die Einführung sie anhand der
// Frage "Wonach suchst du?".
const EBENEN_SCHLUESSEL = 'wildspot-ebenen';

const EBENEN_STANDARD = {
  wasser: true, unterstand: false, seen: true, wasserfall: true, spots: true,
};

const ebenen = (() => {
  try {
    const gemerkt = JSON.parse(localStorage.getItem(EBENEN_SCHLUESSEL) || 'null');
    // Nur bekannte Namen übernehmen — sonst bliebe eine Ebene, die es später
    // nicht mehr gibt, für immer im Speicher stehen.
    if (gemerkt) {
      const sauber = { ...EBENEN_STANDARD };
      for (const k of Object.keys(EBENEN_STANDARD)) {
        if (typeof gemerkt[k] === 'boolean') sauber[k] = gemerkt[k];
      }
      return sauber;
    }
  } catch { /* kaputter Eintrag — dann eben die Voreinstellung */ }
  return { ...EBENEN_STANDARD };
})();

function ebenenMerken() {
  try {
    localStorage.setItem(EBENEN_SCHLUESSEL, JSON.stringify(ebenen));
  } catch { /* privater Modus, kein Speicher — nicht schlimm */ }
}

function ebenenAnwenden() {
  if (!karte.isStyleLoaded() && !karte.getLayer('wasser-punkt')) return;
  for (const [gruppe, an] of Object.entries(ebenen)) {
    const v = an ? 'visible' : 'none';
    for (const suffix of ['-punkt', '-cluster', '-symbol']) {
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
    ebenenMerken();
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
          kind: z.kind,
          name: z.name || '',
          elevation_m: z.elevation_m ?? null,
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
    };

    const teile = [];
    for (const gruppe of ['seen', 'wasserfall', 'wasser', 'unterstand']) {
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

    karte.getSource('spots').setData({
      type: 'FeatureCollection',
      features: (data || []).map((s) => ({
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
        },
      })),
    });
  } catch (err) {
    status('Spots konnten nicht geladen werden.<br><span class="meta">' +
           String(err.message) + '</span>', { warnung: true, dauer: 6000 });
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

function escapeHtml(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
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
