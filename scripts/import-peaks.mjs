// ============================================================================
// Gipfel für Österreich
//
// Aufruf:  node scripts/import-peaks.mjs
//          node scripts/import-peaks.mjs --dry     (nur zählen, nichts schreiben)
//
// Wie das funktioniert:
//   1. Alle Gipfel Österreichs aus OpenStreetMap holen (natural=peak).
//   2. Nur die behalten, die einen Namen UND eine Höhe haben.
//   3. Als kind 'peak' in water_points speichern — derselben Tabelle, in der
//      schon Bergseen, Wasserfälle und Hütten liegen (siehe db/020).
//
// Warum Name und Höhe Pflicht sind:
// Ein Gipfel ist hier zum Sammeln da. "Unbenannter Punkt, 1.204 m" kann man
// nicht sammeln — man erzählt niemandem, dass man oben war. Und ohne Höhe
// fehlt die Zahl, um die es beim Sammeln geht.
//
// Anders als bei den Seen braucht es hier KEINE Höhenabfrage bei Open-Meteo:
// Bei Gipfeln steht das ele-Tag in OpenStreetMap fast immer dran — es ist die
// Angabe, wegen der ein Gipfel überhaupt eingetragen wird. Das spart die
// halbe Stunde Wartezeit, die der Seen-Import braucht.
//
// Datenquelle: OpenStreetMap (ODbL).
// ============================================================================

import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DRY_RUN = process.argv.includes('--dry');

// Alles darunter ist ein Hügel und kein Ziel. In Wien und im Burgenland
// stehen sonst Erhebungen von 240 Metern in derselben Liste wie der
// Großglockner. Wer die trotzdem will, setzt hier 0.
const MINDESTHOEHE = 500;

// Die Reihenfolge ist Erfahrung vom 2026-08-16: overpass-api.de und
// kumi.systems antworteten auf diese Abfrage stundenlang mit "504 — zu
// beschäftigt", private.coffee dagegen in Sekunden.
const ENDPOINTS = [
  'https://overpass.private.coffee/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass-api.de/api/interpreter',
];
const MAX_ATTEMPTS = 5;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function loadEnv() {
  const raw = readFileSync(resolve(projectRoot, '.env.local'), 'utf8');
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

// ---------------------------------------------------------------------------
// 1. Gipfel aus OpenStreetMap
// ---------------------------------------------------------------------------

async function gipfelHolen() {
  // Genau Österreich, nicht das umgebende Rechteck — sonst landen Südtirol,
  // das Engadin und Bayern mit in der Datenbank. Dieselbe Begründung wie beim
  // Seen-Import.
  //
  // natural=peak sind Knoten. "out tags" reicht deshalb, ein center wird nicht
  // gebraucht.
  // 3600016239 ist Österreich: die OSM-Relation 16239 als Fläche (3.600.000.000
  // plus Relations-Nummer). Die Fläche direkt zu benennen ist deutlich
  // billiger, als sie über ["ISO3166-1"="AT"] erst suchen zu lassen — beim
  // Suchweg antwortete Overpass nur noch mit 504.
  const query =
    '[out:json][timeout:900];' +
    'node["natural"="peak"]["name"](area:3600016239);' +
    // "out body" und nicht "out tags": Letzteres liefert die Tags OHNE
    // Koordinaten. Beim ersten Lauf kamen so 20.000 Gipfel zurück, von denen
    // keiner eine Position hatte — und das Skript meldete stillschweigend
    // "0 gefunden".
    'out body;';

  for (let versuch = 1; versuch <= MAX_ATTEMPTS; versuch++) {
    const endpoint = ENDPOINTS[(versuch - 1) % ENDPOINTS.length];
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
        if (versuch === MAX_ATTEMPTS) throw new Error(`Overpass dauerhaft ausgelastet (${res.status})`);
        const wart = versuch * 25;
        console.log(`   Overpass ist ausgelastet (${res.status}), warte ${wart}s ...`);
        await sleep(wart * 1000);
        continue;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);

      const json = await res.json();

      // Overpass antwortet bei Überlastung manchmal mit 200 und einer leeren
      // Liste statt mit einem Fehler. Ohne diese Prüfung sähe der Lauf
      // erfolgreich aus und die Karte bliebe still ohne Gipfel.
      if (!json.elements || json.elements.length === 0) {
        throw new Error('leere Antwort — vermutlich überlastet');
      }

      return (json.elements ?? []).map((el) => ({
        osm_type: el.type,
        osm_id: el.id,
        name: el.tags?.name ?? null,
        hoehe: hoeheLesen(el.tags?.ele),
        lat: el.lat ?? el.center?.lat,
        lng: el.lon ?? el.center?.lon,
      })).filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng));

    } catch (err) {
      if (versuch === MAX_ATTEMPTS) throw err;
      console.log(`   Versuch ${versuch} fehlgeschlagen (${err.message}), neuer Versuch ...`);
      await sleep(versuch * 12000);
    }
  }
}

// Das ele-Tag ist Freitext. In der Praxis steht dort "2.230", "2230 m",
// "2230.5" oder auch "ca. 1900". Alles, was danach keine Zahl zwischen 100 und
// 4000 ergibt, fliegt raus — lieber ein Gipfel weniger als eine falsche Höhe
// in einer Bestenliste.
function hoeheLesen(roh) {
  if (!roh) return null;
  const text = String(roh).replace(/\s*m\s*$/i, '').replace(/\./g, '').replace(',', '.');
  const zahl = parseFloat(text);
  if (!Number.isFinite(zahl)) return null;
  const gerundet = Math.round(zahl);
  if (gerundet < 100 || gerundet > 4000) return null;
  return gerundet;
}

// ---------------------------------------------------------------------------
// 2. Speichern
// ---------------------------------------------------------------------------

async function speichern(client, gipfel) {
  const CHUNK = 400;
  let neu = 0;

  for (let i = 0; i < gipfel.length; i += CHUNK) {
    const teil = gipfel.slice(i, i + CHUNK);
    const platzhalter = [];
    const werte = [];

    teil.forEach((g, n) => {
      const b = n * 6;
      platzhalter.push(
        `($${b+1}::text, $${b+2}::bigint, $${b+3}::text, ` +
        `ST_Point($${b+4}::float8, $${b+5}::float8)::geography, $${b+6}::int)`
      );
      werte.push(g.osm_type, g.osm_id, g.name, g.lng, g.lat, g.hoehe);
    });

    const res = await client.query(
      `insert into public.water_points (source, kind, osm_type, osm_id, name, location, elevation_m)
       select 'osm', 'peak', v.osm_type, v.osm_id, v.name, v.location, v.elevation_m
       from (values ${platzhalter.join(',')}) as v(osm_type, osm_id, name, location, elevation_m)
       on conflict (source, osm_type, osm_id, kind) do update
         set elevation_m = excluded.elevation_m,
             name        = excluded.name`,
      werte
    );
    neu += res.rowCount;
  }
  return neu;
}

// ---------------------------------------------------------------------------

loadEnv();

console.log('Gipfel Österreich aus OpenStreetMap');
console.log(DRY_RUN ? '(Testlauf — es wird nichts gespeichert)\n' : '');

const client = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});
if (!DRY_RUN) await client.connect();

try {
  console.log('Gipfel aus OpenStreetMap holen ...');
  const alle = await gipfelHolen();
  console.log(`${alle.length} benannte Gipfel gefunden.`);

  const mitHoehe = alle.filter((g) => g.hoehe != null);
  console.log(`${mitHoehe.length} davon mit brauchbarer Höhenangabe.`);

  const behalten = mitHoehe.filter((g) => g.hoehe >= MINDESTHOEHE);
  console.log(`${behalten.length} davon über ${MINDESTHOEHE} m — die kommen in die Karte.\n`);

  const hoechste = [...behalten].sort((a, b) => b.hoehe - a.hoehe).slice(0, 10);
  console.log('Die zehn höchsten:');
  console.table(hoechste.map((g) => ({ Name: g.name, Meter: g.hoehe })));

  if (!DRY_RUN) {
    const neu = await speichern(client, behalten);
    console.log(`\n${neu} Gipfel gespeichert.`);

    const r = await client.query(
      `select count(*)::int as anzahl,
              min(elevation_m) as niedrigster,
              max(elevation_m) as hoechster
       from public.water_points where kind = 'peak'`
    );
    console.table(r.rows);
  }
} catch (err) {
  console.error(`\nFEHLER: ${err.message}`);
  process.exitCode = 1;
} finally {
  if (!DRY_RUN) await client.end().catch(() => {});
}
