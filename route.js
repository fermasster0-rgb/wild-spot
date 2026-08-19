// ============================================================================
// Die Wanderroute vom Parkplatz zum Spot
//
// ----------------------------------------------------------------------------
// Was das löst
//
// "Gehzeit: 45 min" war bisher die Schätzung dessen, der den Spot eingetragen
// hat. Für alle anderen ist so eine Zahl fast wertlos: 45 Minuten flach am
// Bach entlang sind etwas völlig anderes als 45 Minuten mit 400 Höhenmetern.
//
// Steht bei einem Spot ein Parkplatz, rechnet OpenRouteService dazwischen die
// Route über echte Wanderwege aus OpenStreetMap — dieselbe Datengrundlage,
// aus der auch Komoot seine Touren baut. Heraus kommen Linie, Gehzeit,
// Strecke und Höhenmeter. Gemessen statt geschätzt.
//
// ----------------------------------------------------------------------------
// Warum hier nichts gerechnet wird
//
// Diese Datei zeigt nur an, was in der Datenbank steht. Gerechnet wird
// woanders, nämlich in scripts/routen-rechnen.mjs. Zwei Gründe:
//
//   · Der Schlüssel für OpenRouteService müsste sonst im Browser liegen und
//     wäre damit für jeden lesbar, der die Seite öffnet. So bleibt er in
//     .env.local und geht nie ins Netz.
//   · Gratis sind 2.000 Anfragen am Tag. Würde jeder Besucher bei jedem
//     Antippen rechnen lassen, wäre das an einem guten Tag aufgebraucht —
//     obwohl sich eine Wanderroute nie ändert. Einmal rechnen genügt.
//
// Ohne Netz funktioniert die Route deshalb nebenbei mit: Sie kommt mit den
// Spot-Angaben aus der Datenbank und braucht keinen fremden Server mehr.
// ============================================================================

'use strict';

(() => {
  // Kräftiges Rotorange. Es muss sich von allem auf der Karte abheben:
  // Wasser ist blau, die eigene Position grün, die Wanderwege von basemap.at
  // sind selbst schon rot gestrichelt — eine durchgezogene, breite Linie in
  // dieser Farbe ist trotzdem eindeutig als "unsere" zu erkennen.
  const FARBE = '#e2603c';

  const LEER = { type: 'FeatureCollection', features: [] };

  // Welcher Spot gerade gezeichnet ist — damit der Parkplatz-Modus weiß,
  // wohin er speichern soll.
  let gezeichnet = null;

  // ==========================================================================
  // 1. DIE EBENEN AUF DER KARTE
  //
  // Sie entstehen erst, wenn zum ersten Mal eine Route gebraucht wird. Wer nie
  // einen Spot antippt, bekommt sie nie — das hält den Start leicht.
  // ==========================================================================

  function ebenenSicherstellen() {
    if (karte.getSource('route')) return true;
    if (!karte.isStyleLoaded()) return false;

    karte.addSource('route', { type: 'geojson', data: LEER });

    // Alles unter die Zelt-Symbole: Der Spot selbst muss oben bleiben, sonst
    // liegt die Linie über dem Pin, den sie erklärt.
    const vor = karte.getLayer('spots-symbol') ? 'spots-symbol' : undefined;

    // Erst ein dunkler Saum, dann die Linie darauf. Ohne den Saum verschwindet
    // die Route auf hellen Flächen der Karte — Schotter, Fels, Schneefeld.
    karte.addLayer({
      id: 'route-saum',
      type: 'line',
      source: 'route',
      filter: ['==', ['geometry-type'], 'LineString'],
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': 'rgba(0, 0, 0, 0.45)',
        'line-width': ['interpolate', ['linear'], ['zoom'], 10, 5, 14, 8, 17, 12],
      },
    }, vor);

    karte.addLayer({
      id: 'route-linie',
      type: 'line',
      source: 'route',
      filter: ['==', ['geometry-type'], 'LineString'],
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': FARBE,
        'line-width': ['interpolate', ['linear'], ['zoom'], 10, 2.5, 14, 4.5, 17, 7],
      },
    }, vor);

    // Der Parkplatz als Punkt. Bewusst ein Kreis und kein "P": Buchstaben auf
    // der Karte bräuchten eine Schriftart von einem fremden Server, und genau
    // das vermeidet diese App überall.
    karte.addLayer({
      id: 'route-parkplatz',
      type: 'circle',
      source: 'route',
      filter: ['==', ['geometry-type'], 'Point'],
      paint: {
        'circle-color': FARBE,
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 10, 4, 14, 7, 17, 10],
        'circle-stroke-width': 2.5,
        'circle-stroke-color': '#ffffff',
      },
    }, vor);

    return true;
  }

  // ==========================================================================
  // 2. ZEICHNEN UND WEGRÄUMEN
  // ==========================================================================

  // Nimmt den ganzen Spot, wie er aus der Datenbank kommt.
  window.routeZeichnen = function routeZeichnen(spot) {
    gezeichnet = spot || null;

    if (!ebenenSicherstellen()) {
      // Der Kartenstil steht noch nicht — gleich noch einmal versuchen.
      karte.once('idle', () => { if (gezeichnet === spot) window.routeZeichnen(spot); });
      return;
    }

    const merkmale = [];

    if (Array.isArray(spot?.route_line) && spot.route_line.length > 1) {
      merkmale.push({
        type: 'Feature',
        geometry: { type: 'LineString', coordinates: spot.route_line },
        properties: {},
      });
    }

    if (Number.isFinite(spot?.parking_lat) && Number.isFinite(spot?.parking_lng)) {
      merkmale.push({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [spot.parking_lng, spot.parking_lat] },
        properties: {},
      });
    }

    karte.getSource('route').setData({ type: 'FeatureCollection', features: merkmale });
  };

  window.routeAusblenden = function routeAusblenden() {
    gezeichnet = null;
    if (karte.getSource('route')) karte.getSource('route').setData(LEER);
  };

  // Die ganze Route ins Bild holen. Nur auf Knopfdruck: eine Karte, die von
  // selbst wegspringt, sobald man einen Spot antippt, verliert einen jedes Mal.
  function insBildHolen() {
    const linie = gezeichnet?.route_line;
    if (!Array.isArray(linie) || linie.length < 2) return;

    let [w, s, o, n] = [180, 90, -180, -90];
    for (const [lng, lat] of linie) {
      w = Math.min(w, lng); o = Math.max(o, lng);
      s = Math.min(s, lat); n = Math.max(n, lat);
    }

    // Rechts liegt am großen Bildschirm die Detail-Leiste, unten am Handy das
    // Blatt. Der Rand hält die Route aus beiden heraus.
    const schmal = window.innerWidth <= 760;
    karte.fitBounds([[w, s], [o, n]], {
      padding: schmal
        ? { top: 60, bottom: Math.round(window.innerHeight * 0.62), left: 40, right: 40 }
        : { top: 70, bottom: 70, left: 70, right: 440 },
      duration: 700,
      maxZoom: 16,
    });
  }

  // ==========================================================================
  // 3. DER BLOCK IN DER DETAIL-LEISTE
  // ==========================================================================

  function dauer(minuten) {
    const m = Math.round(Number(minuten));
    if (!Number.isFinite(m)) return '–';
    if (m < 60) return m + ' min';
    const std = Math.floor(m / 60);
    const rest = m % 60;
    return rest ? `${std} h ${rest} min` : `${std} h`;
  }

  function strecke(meter) {
    const m = Number(meter);
    if (!Number.isFinite(m)) return '–';
    if (m < 1000) return Math.round(m) + ' m';
    return (m / 1000).toFixed(1).replace('.', ',') + ' km';
  }

  function datum(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('de-AT');
  }

  // Gibt den fertigen HTML-Block zurück — oder einen leeren Text, wenn es für
  // diesen Betrachter nichts zu zeigen gibt. Alles steckt schon im Spot,
  // nichts muss nachgeladen werden.
  // ==========================================================================
  // Die Route mitnehmen — als GPX
  //
  // GPX ist das Format, das jedes Wandergerät liest: Garmin, Suunto, Komoot,
  // OsmAnd. Es ist schlichtes XML, deshalb wird es hier von Hand gebaut statt
  // mit einer Bibliothek — die wäre größer als die Datei, die sie erzeugt.
  //
  // Geschrieben wird eine Route (<rte>) und keine aufgezeichnete Spur
  // (<trk>): Es ist ein Weg, den man vor sich hat, nicht einer, den man
  // gegangen ist. Dazu zwei Wegpunkte, damit Anfang und Ziel benannt sind.
  // ==========================================================================

  function gpxBauen(spot) {
    const linie = spot.route_line || [];
    const name = String(spot.name || 'Spot');

    // & < > " müssen in XML maskiert werden, sonst zerfällt die Datei am
    // ersten Spotnamen mit einem Kaufmanns-Und.
    const x = (s) => String(s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');

    const punkte = linie
      .map(([lng, lat]) => `    <rtept lat="${Number(lat).toFixed(6)}" lon="${Number(lng).toFixed(6)}"/>`)
      .join('\n');

    return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Wild Spot" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata>
    <name>${x(name)}</name>
    <desc>Vom Parkplatz zum Spot. Gehzeit etwa ${Math.round(Number(spot.route_minutes) || 0)} Minuten.</desc>
  </metadata>
  <wpt lat="${Number(spot.parking_lat).toFixed(6)}" lon="${Number(spot.parking_lng).toFixed(6)}">
    <name>Parkplatz</name>
  </wpt>
  <wpt lat="${Number(spot.lat ?? linie[linie.length - 1]?.[1]).toFixed(6)}" lon="${Number(spot.lng ?? linie[linie.length - 1]?.[0]).toFixed(6)}">
    <name>${x(name)}</name>
  </wpt>
  <rte>
    <name>${x(name)}</name>
${punkte}
  </rte>
</gpx>
`;
  }

  function gpxMitnehmen(spot) {
    // Ohne Plus führt der Knopf dorthin, wo man es bekommt.
    if (window.WILDSPOT_PLUS && !window.WILDSPOT_PLUS.hat()) {
      window.WILDSPOT_PLUS.schranke('Die Route als GPX');
      return;
    }

    if (!Array.isArray(spot?.route_line) || spot.route_line.length < 2) return;

    const datei = new Blob([gpxBauen(spot)], { type: 'application/gpx+xml' });
    const adresse = URL.createObjectURL(datei);

    // Ein Dateiname, den man im Downloads-Ordner wiedererkennt.
    const sauber = String(spot.name || 'route')
      .replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '').toLowerCase();

    const a = document.createElement('a');
    a.href = adresse;
    a.download = `wild-spot-${sauber || 'route'}.gpx`;
    document.body.appendChild(a);
    a.click();
    a.remove();

    // Die Adresse wieder freigeben — sonst bleibt die Datei im Speicher des
    // Browsers liegen, solange die Seite offen ist.
    setTimeout(() => URL.revokeObjectURL(adresse), 4000);
  }

  window.routeHtml = function routeHtml(spot, darfAendern) {
    const hatParkplatz = Number.isFinite(spot?.parking_lat) && Number.isFinite(spot?.parking_lng);
    const hatRoute = Array.isArray(spot?.route_line) && spot.route_line.length > 1
                     && Number.isFinite(spot?.route_minutes);

    // Kein Parkplatz und keine Rechte: dann gehört hier gar keine Überschrift
    // hin. Eine leere Rubrik sieht kaputt aus.
    if (!hatParkplatz && !darfAendern) return '';

    const teile = ['<h3>Wanderroute</h3>', '<div class="route">'];

    if (hatRoute) {
      const auf = Number(spot.route_ascent_m);
      const ab = Number(spot.route_descent_m);

      teile.push(
        '<div class="route-zahlen">',
        `<div><b>${dauer(spot.route_minutes)}</b><span>Gehzeit</span></div>`,
        `<div><b>${strecke(spot.route_distance_m)}</b><span>Strecke</span></div>`,
        Number.isFinite(auf) ? `<div><b>↗ ${Math.round(auf)} m</b><span>bergauf</span></div>` : '',
        Number.isFinite(ab) ? `<div><b>↘ ${Math.round(ab)} m</b><span>bergab</span></div>` : '',
        '</div>',
        '<button type="button" class="zweit" id="route-zeigen">Route auf der Karte ansehen</button>',
        // Die Route mitnehmen — für Uhr, Garmin oder eine andere App. Der
        // Knopf steht auch ohne Plus da und führt dann zur Plus-Seite: Ein
        // Knopf, den man nicht sieht, verkauft nichts.
        '<button type="button" class="zweit" id="route-gpx">' +
        '<span class="gpx-gold" aria-hidden="true">' +
        '<svg viewBox="0 0 24 24" style="width:15px;height:15px;fill:none;' +
        'stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round">' +
        '<path d="M12 3.5l1.9 4.6 4.6 1.9-4.6 1.9L12 16.5l-1.9-4.6L5.5 10l4.6-1.9z"/></svg>' +
        '</span>Als GPX mitnehmen</button>',
        '<p class="route-quelle">Gemessen über Wanderwege aus OpenStreetMap ' +
        '(OpenRouteService, Profil <i>foot-hiking</i>)' +
        (datum(spot.route_updated_at) ? ' am ' + datum(spot.route_updated_at) : '') +
        '. Die Gehzeit gilt für gemütliches Tempo ohne Pausen — mit schwerem ' +
        'Rucksack dauert es länger.</p>'
      );

    } else if (spot?.route_status === 'kein_weg') {
      teile.push(
        '<p class="detail-leer">Vom eingetragenen Parkplatz führt kein ' +
        'bekannter Weg zum Spot. Entweder liegt der Parkplatz zu weit von ' +
        'jedem Wanderweg entfernt, oder das letzte Stück steht in ' +
        'OpenStreetMap noch nicht drin.</p>'
      );

    } else if (hatParkplatz) {
      teile.push(
        '<p class="detail-leer">Der Parkplatz ist eingetragen — die Route ' +
        'wird beim nächsten Rechenlauf ergänzt und erscheint dann hier.</p>'
      );

    } else {
      teile.push(
        '<p class="detail-leer">Für diesen Spot ist noch kein Parkplatz ' +
        'eingetragen. Setz ihn dorthin, wo du das Auto abstellst — daraus ' +
        'wird die echte Gehzeit samt Höhenmetern gerechnet.</p>'
      );
    }

    if (darfAendern) {
      teile.push(
        '<div class="route-knoepfe">',
        `<button type="button" class="zweit" id="park-setzen">${
          hatParkplatz ? 'Parkplatz verschieben' : 'Parkplatz setzen'}</button>`,
        hatParkplatz
          ? '<button type="button" class="detail-flach" id="park-weg">entfernen</button>'
          : '',
        '</div>'
      );
    }

    teile.push('</div>');
    return teile.join('');
  };

  // ==========================================================================
  // 4. DEN PARKPLATZ SETZEN
  //
  // Über das Fadenkreuz, genau wie beim Anlegen eines Spots. Ein Antippen der
  // Karte wäre die kürzere Geste, würde aber mit den Spots und den
  // OSM-Punkten in Streit geraten, die alle schon auf Klicks hören.
  //
  // Solange der Modus läuft, verschwindet die Detail-Leiste. Sie deckt am
  // Handy fast die ganze Karte ab — das Fadenkreuz läge darunter.
  // ==========================================================================

  let leiste = null;

  function leisteBauen() {
    if (leiste) return leiste;

    leiste = document.createElement('div');
    leiste.className = 'park-leiste';
    leiste.hidden = true;
    leiste.innerHTML =
      '<p class="park-text">Schieb die Karte, bis das Fadenkreuz auf dem ' +
      '<b>Parkplatz</b> liegt — dort, wo dein Auto stehen bleibt.</p>' +
      '<p class="park-koord" id="park-koord"></p>' +
      '<div class="park-knoepfe">' +
      '<button type="button" class="zweit" id="park-ab">Abbrechen</button>' +
      '<button type="button" class="haupt" id="park-ok">Hier ist der Parkplatz</button>' +
      '</div>';

    // Sie gehört in die Leiste unten links, zu den anderen Kartenknöpfen —
    // dort stapelt sie sich über der Fußzeile, statt sie zu verdecken.
    (document.querySelector('.unten') || document.body).prepend(leiste);
    return leiste;
  }

  function koordSchreiben() {
    const el = document.getElementById('park-koord');
    if (!el) return;
    const c = karte.getCenter();
    el.textContent = `${c.lat.toFixed(5)}, ${c.lng.toFixed(5)}`;
  }

  function modusBeenden() {
    if (leiste) leiste.hidden = true;
    document.body.classList.remove('parkplatz-modus');
    karte.off('move', koordSchreiben);
  }

  function modusStarten(spot) {
    leisteBauen();
    leiste.hidden = false;
    document.body.classList.add('parkplatz-modus');

    koordSchreiben();
    karte.on('move', koordSchreiben);

    // Weit genug herauszoomen, dass Spot und möglicher Parkplatz zusammen ins
    // Bild passen: Ein Parkplatz liegt selten näher als ein paar hundert Meter.
    if (karte.getZoom() > 15) karte.easeTo({ zoom: 14.5, duration: 500 });

    document.getElementById('park-ab').onclick = modusBeenden;
    document.getElementById('park-ok').onclick = () => {
      const c = karte.getCenter();
      speichern(spot, c.lat, c.lng);
    };
  }

  async function speichern(spot, lat, lng) {
    const knopf = document.getElementById('park-ok');
    if (knopf) knopf.disabled = true;

    try {
      const { error } = await window.WILDCAMP_AUTH.client
        .from('spots')
        .update({
          // Sechs Nachkommastellen sind gut zehn Zentimeter — mehr als genug
          // und deutlich weniger als die Genauigkeit jedes Handy-GPS.
          parking_lat: lat === null ? null : Number(lat.toFixed(6)),
          parking_lng: lng === null ? null : Number(lng.toFixed(6)),
        })
        .eq('id', spot.id);
      if (error) throw error;

      modusBeenden();

      status(lat === null
        ? 'Parkplatz entfernt.'
        : 'Parkplatz gespeichert. Die Wanderroute wird beim nächsten ' +
          'Rechenlauf ergänzt.', { dauer: 5000 });

      // Die Leiste zeigt sonst weiter den alten Stand — samt alter Route, die
      // seit dem Verschieben nicht mehr stimmt.
      if (typeof window.spotDetailAktualisieren === 'function') {
        window.spotDetailAktualisieren(spot.id, spot.name);
      }
    } catch (err) {
      const text = /row-level security/i.test(String(err.message))
        ? 'Das darfst du nicht — den Parkplatz setzt, wer den Spot angelegt hat.'
        : 'Der Parkplatz konnte nicht gespeichert werden: ' + (err.message || err);
      status(text, { warnung: true, dauer: 6000 });
      if (knopf) knopf.disabled = false;
    }
  }

  // Wird nach jedem Neuzeichnen der Detail-Leiste aufgerufen: die Knöpfe im
  // Block sind dann frische Elemente und brauchen ihre Handgriffe wieder.
  window.routeVerdrahten = function routeVerdrahten(spot) {
    const zeigen = document.getElementById('route-zeigen');
    if (zeigen) zeigen.onclick = insBildHolen;

    const gpx = document.getElementById('route-gpx');
    if (gpx) gpx.onclick = () => gpxMitnehmen(spot);

    const setzen = document.getElementById('park-setzen');
    if (setzen) setzen.onclick = () => modusStarten(spot);

    const weg = document.getElementById('park-weg');
    if (weg) weg.onclick = () => speichern(spot, null, null);
  };

  // Escape bricht den Modus ab — dieselbe Erwartung wie überall sonst in der
  // App. Der Handler steht vor dem der Detail-Leiste, damit nicht beides
  // gleichzeitig zugeht.
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && document.body.classList.contains('parkplatz-modus')) {
      e.stopPropagation();
      modusBeenden();
    }
  }, true);
})();
