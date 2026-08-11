// ============================================================================
// Holt Wasserstellen und Unterstände für ganz Österreich aus OpenStreetMap
// und schreibt sie in die Tabelle water_points.
//
// Aufruf:  node scripts/import-water.mjs
//          node scripts/import-water.mjs --dry     (nur zählen, nichts schreiben)
//
// Läuft auf DIESEM PC, nicht in der App. Die App fragt später nur noch die
// eigene Datenbank ab — Overpass live abzufragen wäre langsam, unzuverlässig
// und gegen die Nutzungsregeln.
//
// Alle paar Monate erneut laufen lassen, dann sind die Daten wieder aktuell.
// Doppelte Einträge kann es nicht geben, dafür sorgt die Sperre in der
// Datenbank (source + osm_type + osm_id + kind).
//
// Datenquelle: OpenStreetMap, Lizenz ODbL.
// In der App muss sichtbar "© OpenStreetMap-Mitwirkende" stehen.
// ============================================================================

import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DRY_RUN = process.argv.includes('--dry');

// Genau das Staatsgebiet Österreichs — nicht das Rechteck darum herum.
//
// Bis zum 2026-08-04 stand hier eine Bounding Box. Die reicht aber bis
// Eichstätt in Bayern, in den Böhmerwald und nach Südtirol: in der Datenbank
// landeten dadurch Bootsrastplätze an der Altmühl und tschechische Notlager
// als "österreichische Trekkingplätze". Der Flächen-Filter kostet Overpass
// etwas mehr Zeit und ist das wert.
const AREA = 'area["ISO3166-1"="AT"][admin_level=2]->.at;';

// Welche OSM-Objekte geholt werden. kind muss zum CHECK in der Datenbank passen.
const CATEGORIES = [
  // ------------------------------------------------------------- Wasser -----
  { kind: 'spring',         label: 'Quellen',              filter: '["natural"="spring"]' },
  { kind: 'drinking_water', label: 'Trinkbrunnen',         filter: '["amenity"="drinking_water"]' },
  { kind: 'well',           label: 'Brunnen',              filter: '["man_made"="water_well"]' },
  { kind: 'water_tap',      label: 'Wasserhähne',          filter: '["man_made"="water_tap"]' },

  // -------------------------------------------------------- Unterkünfte -----
  { kind: 'alpine_hut',     label: 'Berghütten',           filter: '["tourism"="alpine_hut"]' },
  { kind: 'wilderness_hut', label: 'Selbstversorgerhütten',filter: '["tourism"="wilderness_hut"]' },
  { kind: 'chalet',         label: 'Almhütten/Chalets',    filter: '["tourism"="chalet"]' },
  // Die beiden Ausschlüsse verhindern, dass ein Trekkingplatz gleich zweimal
  // auf der Karte landet — einmal hier und einmal als backcountry_camp.
  { kind: 'camp_site',      label: 'Campingplätze',
    filter: '["tourism"="camp_site"]["backcountry"!="yes"]["camp_site"!="basic"]' },

  // Trekking- und Biwakplätze: offiziell erlaubtes Zelten abseits der Straße.
  // In OSM entweder über backcountry=yes oder den eigenen Typ gekennzeichnet.
  { kind: 'backcountry_camp', label: 'Trekking-/Biwakplätze',
    filter: '["tourism"="camp_site"]["backcountry"="yes"]' },
  { kind: 'backcountry_camp', label: 'Zeltplätze (wild)',
    filter: '["tourism"="camp_site"]["camp_site"="basic"]' },

  // amenity=shelter ist in OSM überwiegend das Wartehäuschen an der
  // Bushaltestelle. Deshalb NUR die Bauarten holen, unter denen man
  // tatsächlich übernachten oder sich unterstellen kann.
  { kind: 'shelter',        label: 'Biwaks/Schutzdächer',
    filter: '["amenity"="shelter"]["shelter_type"~"^(basic_hut|lean_to|weather_shelter|rock_shelter)$"]' },

  // Bewusst NICHT dabei: natural=water (Seen und Teiche).
  // Das wären zehntausende Flächen, und Gewässer zeichnet die Karte von
  // basemap.at ohnehin. Für "wo hole ich Wasser" sind Quellen entscheidend.
  // Falls doch gewünscht, hier ergänzen:
  // { kind: 'water', label: 'Seen', filter: '["natural"="water"]' },
];

const ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
];

const MAX_ATTEMPTS = 4;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function loadEnv() {
  const raw = readFileSync(resolve(projectRoot, '.env.local'), 'utf8');
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

// Eine Kategorie bei Overpass abfragen, mit Wiederholung bei Überlastung.
async function fetchCategory({ kind, label, filter }) {
  // nwr = nodes, ways und relations. "out center" liefert bei Flächen den
  // Mittelpunkt, damit alles als einzelner Punkt gespeichert werden kann.
  const query = `[out:json][timeout:600];${AREA}nwr${filter}(area.at);out center tags;`;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const endpoint = ENDPOINTS[(attempt - 1) % ENDPOINTS.length];
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'wildcamp-at/0.1 (Hobbyprojekt, Oesterreich)',
        },
        body: 'data=' + encodeURIComponent(query),
      });

      if (res.status === 429 || res.status === 504) {
        if (attempt === MAX_ATTEMPTS) {
          throw new Error(`Overpass dauerhaft ausgelastet (${res.status})`);
        }
        const wait = attempt * 20;
        console.log(`   Overpass ist gerade ausgelastet (${res.status}), warte ${wait}s ...`);
        await sleep(wait * 1000);
        continue;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);

      const json = await res.json();
      return (json.elements ?? []).map((el) => ({
        kind,
        osm_type: el.type,
        osm_id: el.id,
        name: el.tags?.name ?? null,
        lat: el.lat ?? el.center?.lat,
        lng: el.lon ?? el.center?.lon,
      })).filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng));

    } catch (err) {
      if (attempt === MAX_ATTEMPTS) throw new Error(`${label}: ${err.message}`);
      console.log(`   Versuch ${attempt} fehlgeschlagen (${err.message}), neuer Versuch ...`);
      await sleep(attempt * 10000);
    }
  }
  // Hierher kommt man nicht — oben wird bei erschöpften Versuchen geworfen.
  // Wichtig so: ein leeres Ergebnis darf niemals wie "gibt es nicht" aussehen.
  throw new Error(`${label}: unerwartet ohne Ergebnis`);
}

// In Blöcken einfügen. Vorhandene Einträge werden übersprungen, nicht doppelt.
async function insertBatch(client, rows) {
  const CHUNK = 500;
  let inserted = 0;

  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK);
    const values = [];
    const params = [];

    chunk.forEach((p, n) => {
      const b = n * 6;
      // ST_Point erwartet erst die Länge, dann die Breite — nicht verwechseln.
      // Die ::-Angaben sagen Postgres, welcher Datentyp gemeint ist; ohne sie
      // hält es alles für Text und beschwert sich über osm_id.
      values.push(
        `($${b+1}::text, $${b+2}::text, $${b+3}::bigint, $${b+4}::text, ` +
        `ST_Point($${b+5}::float8, $${b+6}::float8)::geography)`
      );
      params.push(p.kind, p.osm_type, p.osm_id, p.name, p.lng, p.lat);
    });

    // Vorhandene Einträge bekommen ein frisches imported_at. Daran erkennt
    // das Aufräumen am Ende, was in diesem Lauf bestätigt wurde und was nicht
    // mehr in OpenStreetMap steht (oder gar nicht in Österreich liegt).
    const res = await client.query(
      `insert into public.water_points (source, kind, osm_type, osm_id, name, location)
       select 'osm', v.kind, v.osm_type, v.osm_id, v.name, v.location
       from (values ${values.join(',')}) as v(kind, osm_type, osm_id, name, location)
       on conflict (source, osm_type, osm_id, kind) do update
         set imported_at = now(),
             name        = excluded.name`,
      params
    );
    inserted += res.rowCount;
  }
  return inserted;
}

// ---------------------------------------------------------------------------

loadEnv();

console.log('Import Wasserstellen Österreich aus OpenStreetMap');
console.log(DRY_RUN ? '(Testlauf — es wird nichts gespeichert)\n' : '');

const client = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});
if (!DRY_RUN) await client.connect();

let gesamtGefunden = 0;
let gesamtNeu = 0;
const fehlgeschlagen = [];

// Zeitpunkt vor dem ersten Schreiben. Alles, was danach kein frisches
// imported_at hat, stand in diesem Lauf nicht mehr in den OSM-Ergebnissen.
const laufStart = new Date();

// Welche Arten sauber durchgelaufen sind. Nur bei denen darf am Ende
// aufgeräumt werden — sonst würde eine überlastete Overpass-Antwort dazu
// führen, dass eine ganze Kategorie gelöscht wird.
const geglueckt = new Set();
const gescheitert = new Set();

try {
  for (const cat of CATEGORIES) {
    process.stdout.write(`${cat.label.padEnd(24)} `);

    // Scheitert eine Kategorie, laufen die übrigen trotzdem weiter. Am Ende
    // steht, was nachzuholen ist — der Import ist ja beliebig wiederholbar.
    let points;
    try {
      points = await fetchCategory(cat);
    } catch (err) {
      console.log(`ÜBERSPRUNGEN — ${err.message}`);
      fehlgeschlagen.push(cat.label);
      gescheitert.add(cat.kind);
      continue;
    }
    geglueckt.add(cat.kind);

    gesamtGefunden += points.length;

    if (DRY_RUN) {
      console.log(`${String(points.length).padStart(6)} gefunden`);
    } else {
      const neu = await insertBatch(client, points);
      gesamtNeu += neu;
      console.log(`${String(points.length).padStart(6)} gefunden, ${String(neu).padStart(6)} neu`);
    }

    // Höflichkeit gegenüber einem kostenlosen Dienst.
    await sleep(3000);
  }

  console.log(`\nGesamt: ${gesamtGefunden} Objekte aus OpenStreetMap`);
  if (fehlgeschlagen.length) {
    console.log(`\nNICHT geholt: ${fehlgeschlagen.join(', ')}`);
    console.log('Skript später nochmal starten — schon vorhandene Einträge werden übersprungen.');
  }
  if (!DRY_RUN) {
    console.log(`Neu oder aufgefrischt: ${gesamtNeu}`);

    // Aufräumen: alles wegwerfen, was dieser Lauf nicht bestätigt hat.
    // Das erwischt Punkte, die aus OpenStreetMap verschwunden sind — und
    // seit der Umstellung auf den Flächen-Filter vor allem die, die nie in
    // Österreich lagen.
    const aufraeumbar = [...geglueckt].filter((k) => !gescheitert.has(k));

    if (aufraeumbar.length) {
      const weg = await client.query(
        `delete from public.water_points
          where source = 'osm'
            and kind = any($1::text[])
            and imported_at < $2
          returning kind`,
        [aufraeumbar, laufStart]
      );

      if (weg.rowCount) {
        const nachArt = {};
        for (const z of weg.rows) nachArt[z.kind] = (nachArt[z.kind] || 0) + 1;
        console.log(`\nAufgeräumt: ${weg.rowCount} Punkte entfernt, die nicht mehr ` +
                    'in den OSM-Ergebnissen für Österreich stehen.');
        console.table(Object.entries(nachArt).map(([kind, anzahl]) => ({ kind, anzahl })));
      }
    }
    if (gescheitert.size) {
      console.log(`\nNicht aufgeräumt (Abfrage fehlgeschlagen): ${[...gescheitert].join(', ')}`);
    }

    console.log('\nStand jetzt:');
    const r = await client.query(
      `select kind, count(*)::int as anzahl from public.water_points
       group by kind order by anzahl desc`
    );
    console.table(r.rows);
  }
} catch (err) {
  console.error(`\nFEHLER: ${err.message}`);
  process.exitCode = 1;
} finally {
  if (!DRY_RUN) await client.end().catch(() => {});
}
