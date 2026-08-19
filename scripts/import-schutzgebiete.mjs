// ============================================================================
// Holt die Schutzgebiete Österreichs aus OpenStreetMap und schreibt sie als
// Flächen in die Tabelle protected_areas (Migration 027).
//
// Aufruf:  node scripts/import-schutzgebiete.mjs
//          node scripts/import-schutzgebiete.mjs --dry   (nur zählen)
//
// Läuft auf DIESEM PC, nicht in der App — wie die anderen Importe auch.
//
// ----------------------------------------------------------------------------
// Warum das aufwendiger ist als die Wasserstellen
//
// Eine Quelle ist ein Punkt: Overpass liefert lat/lon, fertig. Ein Schutzgebiet
// ist eine Fläche, und Flächen stehen in OpenStreetMap auf zwei Arten:
//
//   • als "way"      — ein geschlossener Linienzug. Einfach.
//   • als "relation" — ein Multipolygon aus vielen Teilstücken, die erst
//                      aneinandergesetzt werden müssen. Genau so sind die
//                      großen Gebiete erfasst: ein Nationalpark hat Löcher
//                      (Ortschaften) und getrennte Teile.
//
// Deshalb "out geom" statt "out center", und deshalb der Ringbau weiter unten.
//
// ----------------------------------------------------------------------------
// Was geholt wird
//
// Nationalparks, Naturschutzgebiete und Natura-2000-Gebiete. NICHT dabei:
// Landschaftsschutzgebiete. Die decken in manchen Bundesländern halbe Bezirke
// ab und sagen über das Zelten wenig aus — eine Karte, auf der alles rot ist,
// warnt vor nichts.
//
// Datenquelle: OpenStreetMap, Lizenz ODbL.
// ============================================================================

import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DRY_RUN = process.argv.includes('--dry');

// --nur=nationalpark holt nur diese eine Sorte.
//
// Der Grund dafür ist ein Fehler aus dem ersten Lauf: Overpass antwortet bei
// Andrang mit 429 oder 504. Fällt dabei ausgerechnet die Nationalpark-Abfrage
// aus, kommen dieselben Gebiete kurz darauf über die Naturschutz-Abfrage
// herein — und stehen dann als 'naturschutz' in der Datenbank. Die Umrisse
// stimmen, die Einstufung ist zu mild.
//
// Genau dann will man nachholen, ohne wieder achthundert Gebiete zu ziehen.
const NUR = (process.argv.find((a) => a.startsWith('--nur=')) || '').split('=')[1] || null;

const AREA = 'area["ISO3166-1"="AT"][admin_level=2]->.at;';

// Die Filter sind bewusst getrennt statt in einer Abfrage: So lässt sich jede
// Sorte einzeln zählen, und wenn eine ausfällt, stehen die anderen trotzdem.
const SORTEN = [
  {
    art: 'nationalpark',
    label: 'Nationalparks',
    filter: '["boundary"="protected_area"]["protect_class"="2"]',
  },
  {
    art: 'nationalpark',
    label: 'Nationalparks',
    // Nachgesehen am 2026-08-19: Alle sechs österreichischen Nationalparks
    // tragen boundary=national_park zusammen mit protect_class=2 — Hohe
    // Tauern, Donau-Auen, Kalkalpen, Thayatal, Neusiedler See-Seewinkel und
    // Gesäuse. Die Sorte darüber (protected_area + protect_class=2) findet
    // sie NICHT; sie liefert in Österreich ein slowenisches Waldreservat.
    //
    // Vier von ihnen sind type=boundary statt type=multipolygon. Für den
    // Ringbau weiter unten macht das keinen Unterschied — er setzt die
    // Teilstücke ohnehin selbst zusammen.
    filter: '["boundary"="national_park"]',
  },
  {
    art: 'naturschutz',
    label: 'Naturschutzgebiete',
    filter: '["boundary"="protected_area"]["protect_class"~"^(1|1a|1b|3|4)$"]',
  },
  {
    art: 'naturschutz',
    label: 'Naturschutzgebiete (leisure)',
    filter: '["leisure"="nature_reserve"]',
  },
  {
    art: 'natura2000',
    label: 'Natura-2000-Gebiete',
    filter: '["boundary"="protected_area"]["protection_title"~"Natura",i]',
  },
];

const ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
];

const MAX_VERSUCHE = 4;
const schlafen = (ms) => new Promise((r) => setTimeout(r, ms));

function envLaden() {
  const raw = readFileSync(resolve(projectRoot, '.env.local'), 'utf8');
  for (const zeile of raw.split(/\r?\n/)) {
    const m = zeile.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

// ----------------------------------------------------------------------------
// Aus OSM-Teilstücken geschlossene Ringe bauen
//
// Eine Relation liefert ihre Grenze als Haufen einzelner Linien, in beliebiger
// Reihenfolge und Richtung. Erst aneinandergesetzt ergeben sie den Umriss.
// Dieser Ringbau ist der Kern des Skripts — ohne ihn wären die großen Gebiete
// eine Ansammlung loser Striche.
// ----------------------------------------------------------------------------
function ringeBauen(teile) {
  const offen = teile
    .filter((t) => Array.isArray(t) && t.length >= 2)
    .map((t) => t.slice());
  const ringe = [];

  while (offen.length) {
    let kette = offen.pop();

    let gewachsen = true;
    while (gewachsen) {
      gewachsen = false;
      const anfang = kette[0];
      const ende = kette[kette.length - 1];
      if (gleich(anfang, ende)) break;   // Ring ist zu

      for (let i = 0; i < offen.length; i++) {
        const t = offen[i];
        if (gleich(ende, t[0]))                       { kette = kette.concat(t.slice(1)); }
        else if (gleich(ende, t[t.length - 1]))       { kette = kette.concat(t.slice(0, -1).reverse()); }
        else if (gleich(anfang, t[t.length - 1]))     { kette = t.slice(0, -1).concat(kette); }
        else if (gleich(anfang, t[0]))                { kette = t.slice(1).reverse().concat(kette); }
        else continue;

        offen.splice(i, 1);
        gewachsen = true;
        break;
      }
    }

    // Nur geschlossene Ringe sind eine Fläche. Ein offener Linienzug ist in
    // OSM meist ein Erfassungsfehler — der wird stillschweigend übergangen,
    // sonst bricht ein einziges kaputtes Gebiet den ganzen Import ab.
    if (kette.length >= 4 && gleich(kette[0], kette[kette.length - 1])) {
      ringe.push(kette);
    }
  }

  return ringe;
}

function gleich(a, b) {
  return a && b && Math.abs(a[0] - b[0]) < 1e-9 && Math.abs(a[1] - b[1]) < 1e-9;
}

// Aus einem Overpass-Element WKT für PostGIS machen.
function zuWkt(el) {
  let ringe = [];

  if (el.type === 'way' && Array.isArray(el.geometry)) {
    const punkte = el.geometry.filter((p) => p).map((p) => [p.lon, p.lat]);
    if (punkte.length >= 4 && gleich(punkte[0], punkte[punkte.length - 1])) {
      ringe = [punkte];
    } else if (punkte.length >= 3) {
      // Nicht geschlossen: von Hand schließen. Bei einem Umriss ist das die
      // offensichtliche Absicht.
      ringe = [[...punkte, punkte[0]]];
    }
  } else if (el.type === 'relation' && Array.isArray(el.members)) {
    // Nur die äußeren Grenzen. Innere Löcher (Ortschaften mitten im Park)
    // werden weggelassen: Sie wären beim Zeichnen ein Genauigkeitsgewinn und
    // beim Warnen ein Verlust — lieber einmal zu viel gewarnt.
    const aussen = el.members
      .filter((m) => m.type === 'way' && m.role !== 'inner' && Array.isArray(m.geometry))
      .map((m) => m.geometry.map((p) => [p.lon, p.lat]));
    ringe = ringeBauen(aussen);
  }

  if (!ringe.length) return null;

  const polygone = ringe.map((r) =>
    '((' + r.map(([x, y]) => `${x.toFixed(6)} ${y.toFixed(6)}`).join(',') + '))');

  return `MULTIPOLYGON(${polygone.join(',')})`;
}

async function sorteHolen({ art, label, filter }) {
  // "out geom" und NICHT "out geom tags".
  //
  // Das sieht nach einer Kleinigkeit aus und war der Grund, warum kein
  // einziger Nationalpark ankam: In Overpass ist "tags" ein eigener
  // Ausgabemodus — er liefert die Merkmale eines Objekts und sonst nichts.
  // Bei einem Way schadet das nicht, dessen Punkte kommen trotzdem. Bei einer
  // Relation unterdrückt es die Teilstücke, also genau die Geometrie, aus der
  // der Ringbau die Fläche zusammensetzt.
  //
  // Die Abfrage lieferte also brav elf Relationen — darunter Hohe Tauern,
  // Donau-Auen und Kalkalpen —, und jede einzelne fiel danach still durch,
  // weil zuWkt() nichts zum Zusammensetzen fand. In der Datenbank landeten
  // nur die fünf Ways: kleine Teilzonen ohne Namen.
  //
  // "out geom" allein liefert Geometrie UND Merkmale.
  const abfrage = `[out:json][timeout:900];${AREA}(way${filter}(area.at);relation${filter}(area.at););out geom;`;

  for (let versuch = 1; versuch <= MAX_VERSUCHE; versuch++) {
    const endpoint = ENDPOINTS[(versuch - 1) % ENDPOINTS.length];
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'wildcamp-at/0.1 (Hobbyprojekt, Oesterreich)',
        },
        body: 'data=' + encodeURIComponent(abfrage),
      });

      if (res.status === 429 || res.status === 504) {
        if (versuch === MAX_VERSUCHE) throw new Error(`Overpass ausgelastet (${res.status})`);
        const warten = versuch * 25;
        console.log(`   Overpass ausgelastet (${res.status}), warte ${warten}s ...`);
        await schlafen(warten * 1000);
        continue;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);

      const json = await res.json();
      const gebiete = [];

      for (const el of json.elements ?? []) {
        const wkt = zuWkt(el);
        if (!wkt) continue;
        gebiete.push({
          osm_type: el.type,
          osm_id: el.id,
          name: el.tags?.name ?? null,
          art,
          wkt,
        });
      }

      return gebiete;
    } catch (err) {
      if (versuch === MAX_VERSUCHE) throw new Error(`${label}: ${err.message}`);
      await schlafen(versuch * 10000);
    }
  }
  return [];
}

// ============================================================================

envLaden();

console.log('\nSchutzgebiete aus OpenStreetMap holen\n');

const alle = new Map();   // osm_type/osm_id → Gebiet (die erste Sorte gewinnt)

let ausgefallen = 0;

for (const sorte of SORTEN) {
  if (NUR && sorte.art !== NUR) continue;
  process.stdout.write(`   ${sorte.label} ... `);
  try {
    const gebiete = await sorteHolen(sorte);
    let neu = 0;
    for (const g of gebiete) {
      const schluessel = `${g.osm_type}/${g.osm_id}`;
      // Die Reihenfolge in SORTEN ist die Rangfolge: Ein Gebiet, das schon als
      // Nationalpark drin ist, wird nicht zum Naturschutzgebiet herabgestuft.
      if (!alle.has(schluessel)) { alle.set(schluessel, g); neu++; }
    }
    console.log(`${gebiete.length} gefunden, ${neu} neu`);
  } catch (err) {
    console.log(`FEHLER — ${err.message}`);
    ausgefallen++;
  }
  await schlafen(3000);   // Overpass nicht überrennen
}

console.log(`\n   Zusammen: ${alle.size} Gebiete\n`);

// Ein Ausfall ist keine Kleinigkeit, sondern führt zu falschen Einstufungen
// (siehe --nur weiter oben). Deshalb steht er am Ende noch einmal deutlich da
// und nicht nur mitten im Ablauf, wo er wegscrollt.
if (ausgefallen) {
  console.log(`   ACHTUNG: ${ausgefallen} Abfrage(n) sind ausgefallen.`);
  console.log('   Die betroffenen Gebiete können jetzt zu mild eingestuft sein.');
  console.log('   Nachholen mit: node scripts/import-schutzgebiete.mjs --nur=<art>\n');
}

if (DRY_RUN) {
  console.log('   --dry: nichts geschrieben.\n');
  process.exit(0);
}

if (!alle.size) {
  console.log('   Nichts zu schreiben.\n');
  process.exit(0);
}

const client = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});
await client.connect();

let geschrieben = 0, uebersprungen = 0;

for (const g of alle.values()) {
  try {
    await client.query(
      `insert into public.protected_areas (osm_type, osm_id, name, art, flaeche, geholt_am)
       values ($1, $2, $3, $4, st_makevalid(st_geomfromtext($5, 4326))::geography, now())
       on conflict (osm_type, osm_id) do update
         set name = excluded.name,
             art = excluded.art,
             flaeche = excluded.flaeche,
             geholt_am = now()`,
      [g.osm_type, g.osm_id, g.name, g.art, g.wkt]);
    geschrieben++;
    if (geschrieben % 50 === 0) process.stdout.write(`   ${geschrieben} geschrieben ...\r`);
  } catch (err) {
    // Eine kaputte Geometrie soll den Lauf nicht beenden — die anderen
    // tausend Gebiete sind mehr wert als dieses eine.
    uebersprungen++;
  }
}

const zahl = await client.query('select art, count(*) from public.protected_areas group by art order by art');

console.log(`\n   ${geschrieben} geschrieben, ${uebersprungen} übersprungen (kaputte Geometrie)\n`);
console.log('   In der Datenbank:');
for (const z of zahl.rows) console.log(`     ${z.art.padEnd(14)} ${z.count}`);
console.log('');

await client.end();
