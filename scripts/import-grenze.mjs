// ============================================================================
// Holt den Umriss Österreichs und macht daraus die Maske für die Karte.
//
// Aufruf (einmalig, muss nie wiederholt werden):
//     node scripts/import-grenze.mjs
//
// Ergebnis: web/oesterreich-maske.geojson
//
// ----------------------------------------------------------------------------
// Wozu das gut ist
//
// basemap.at liefert nur für Österreich Kacheln — aber nicht sauber an der
// Staatsgrenze abgeschnitten, sondern in Quadraten. Bei "Standard" fällt das
// nicht auf, weil die Flächen außerhalb durchsichtig sind. "Gelände" und
// "Satellit" malen dagegen bis zum Rand des Quadrats weiter: man sieht ein
// helles Rechteck, das über Österreich hinaussteht.
//
// Dagegen hilft eine Maske: eine Fläche, die alles außerhalb Österreichs
// abdeckt. Sie wird über die Karte gelegt und hat dieselbe Farbe wie der
// Hintergrund — dadurch endet jede Grundkarte exakt an der Landesgrenze.
//
// ----------------------------------------------------------------------------
// Der Trick mit dem Loch
//
// Ein Polygon in GeoJSON kann Löcher haben. Die Maske ist deshalb ein einziges
// Riesenpolygon über die ganze Welt — und Österreich ist das Loch darin.
// Durch das Loch sieht man die Karte, überall sonst liegt die Hintergrundfarbe.
//
// Wichtig ist die Umlaufrichtung: der äußere Rand gegen den Uhrzeigersinn,
// jedes Loch im Uhrzeigersinn. Stimmt das nicht, füllt die Karte am Ende
// genau das Gegenteil — nämlich nur Österreich. Deshalb wird sie unten
// ausgerechnet und notfalls umgedreht.
// ============================================================================

import { writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ZIEL = resolve(projectRoot, 'web/oesterreich-maske.geojson');

// Nominatim ist der Suchdienst von OpenStreetMap. Er kann den Umriss eines
// Landes direkt als GeoJSON liefern — und auf Wunsch vereinfacht.
//
// polygon_threshold steuert, wie grob: 0 wäre jeder einzelne Punkt der echten
// Grenze (mehrere Megabyte, die Karte würde ruckeln), 0.01 ein grobes Vieleck,
// bei dem man das Zickzack sieht. 0.0015 ist der Kompromiss — beim
// Hineinzoomen sauber, aber klein genug.
const QUELLE = 'https://nominatim.openstreetmap.org/search'
  + '?country=Austria&format=json&polygon_geojson=1&polygon_threshold=0.0015&limit=1';

// Nominatim verlangt eine Kennung mit Kontaktmöglichkeit — ohne die sperrt
// der Dienst die Anfrage.
const KOPF = { 'User-Agent': 'wildcamp-at/1.0 (Kartenprojekt, Kontakt via GitHub)' };

// Die Welt als Rechteck. 85° statt 90°, weil die Kartendarstellung (Mercator)
// die Pole ins Unendliche zieht und darüber hinaus nichts mehr zeichnen kann.
const WELT = [[-180, -85], [180, -85], [180, 85], [-180, 85], [-180, -85]];

// Die doppelte Fläche eines Rings, mit Vorzeichen. Positiv heißt gegen den
// Uhrzeigersinn, negativ im Uhrzeigersinn. (Gauß'sche Trapezformel — man
// braucht sie hier nur für das Vorzeichen, nicht für den echten Flächenwert.)
function flaeche(ring) {
  let summe = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    summe += (ring[j][0] - ring[i][0]) * (ring[j][1] + ring[i][1]);
  }
  return summe;
}

function imUhrzeigersinn(ring) {
  return flaeche(ring) > 0 ? ring : [...ring].reverse();
}

function gegenUhrzeigersinn(ring) {
  return flaeche(ring) < 0 ? ring : [...ring].reverse();
}

console.log('Hole den Umriss Österreichs von OpenStreetMap ...');

const antwort = await fetch(QUELLE, { headers: KOPF });
if (!antwort.ok) {
  console.error(`FEHLER: Nominatim antwortet mit ${antwort.status}.`);
  process.exit(1);
}

const treffer = await antwort.json();
const geo = treffer?.[0]?.geojson;

if (!geo) {
  console.error('FEHLER: Nominatim hat keinen Umriss geliefert.');
  process.exit(1);
}

// Österreich kommt als MultiPolygon (das Land hat ein paar Exklaven und
// Inseln in Grenzflüssen). Ein einzelnes Polygon wäre auch möglich —
// beides wird hier auf dieselbe Form gebracht.
const teile = geo.type === 'MultiPolygon' ? geo.coordinates
            : geo.type === 'Polygon'      ? [geo.coordinates]
            : null;

if (!teile) {
  console.error(`FEHLER: Unerwartete Form "${geo.type}".`);
  process.exit(1);
}

// Aus jedem Teil nur den äußeren Rand nehmen. Innere Ringe wären Löcher IM
// Land — die gibt es bei Österreich nicht, und sie würden hier ohnehin nur
// stören.
const loecher = teile.map((polygon) => imUhrzeigersinn(polygon[0]));

const punkte = loecher.reduce((n, r) => n + r.length, 0);

const maske = {
  type: 'FeatureCollection',
  features: [{
    type: 'Feature',
    properties: {},
    geometry: {
      type: 'Polygon',
      // Erst der äußere Rand (die Welt), dann die Löcher (Österreich).
      coordinates: [gegenUhrzeigersinn(WELT), ...loecher],
    },
  }],
};

writeFileSync(ZIEL, JSON.stringify(maske));

const groesse = Math.round(JSON.stringify(maske).length / 1024);
console.log(`\nFertig: web/oesterreich-maske.geojson`);
console.log(`  ${loecher.length} Teilflächen, ${punkte} Punkte, ${groesse} KB`);
console.log('\nQuelle: OpenStreetMap-Mitwirkende (ODbL)');
