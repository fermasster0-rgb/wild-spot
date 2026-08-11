// ============================================================================
// Bergseen für Österreich
//
// Aufruf:  node scripts/import-lakes.mjs
//          node scripts/import-lakes.mjs --dry     (nur zählen, nichts schreiben)
//
// Wie das funktioniert:
//   1. Alle Seen Österreichs aus OpenStreetMap holen (natural=water + water=lake).
//   2. Für jeden die Seehöhe bestimmen — OpenStreetMap hat sie fast nie, also
//      kommt sie aus dem Copernicus-Geländemodell über Open-Meteo. Das geht in
//      Stapeln zu 100 Punkten, sonst wären es tausende Einzelanfragen.
//   3. Nur die ab MINDESTHOEHE behalten und als kind 'mountain_lake' speichern.
//
// Warum eine Mindesthöhe das richtige Kriterium ist:
// "Bekannt" oder "unbekannt" lässt sich nicht messen. Die Höhe schon — und
// sie trifft das Gemeinte erstaunlich gut. Über 900 m liegen fast nur noch
// Seen, zu denen man laufen muss. Die großen Namen des Landes (Wörthersee,
// Attersee, Neusiedler See) liegen alle darunter und fallen von selbst weg.
//
// Datenquelle: OpenStreetMap (ODbL) und Open-Meteo (Copernicus DEM).
// ============================================================================

import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DRY_RUN = process.argv.includes('--dry');

const MINDESTHOEHE = 900;        // Meter
const HOEHEN_STAPEL = 100;       // Punkte pro Anfrage an Open-Meteo

// Open-Meteo lässt etwa 600 Koordinaten pro Minute zu. Bei 100 pro Anfrage
// heißt das: eine Anfrage alle 12 Sekunden. Schneller quittiert der Dienst
// mit "429 — zu viele Anfragen".
const HOEHEN_PAUSE_MS = 12000;

const ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
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
// 1. Seen aus OpenStreetMap
// ---------------------------------------------------------------------------

async function seenHolen() {
  // Genau Österreich, nicht das umgebende Rechteck: ein Rechteck um Österreich
  // reicht bis Südtirol, ins Engadin und nach Bayern. Beim ersten Lauf landeten
  // so das "Laghetto Cima Careser" und der "Lej da la Pischa" in der Datenbank
  // — schöne Seen, aber keine österreichischen.
  //
  // water=lake schließt Klärbecken, Löschteiche und Speicher weitgehend aus.
  // "out center" liefert bei Flächen den Mittelpunkt.
  const query =
    '[out:json][timeout:600];' +
    'area["ISO3166-1"="AT"][admin_level=2]->.at;' +
    'nwr["natural"="water"]["water"="lake"](area.at);' +
    'out center tags;';

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
      return (json.elements ?? []).map((el) => ({
        osm_type: el.type,
        osm_id: el.id,
        name: el.tags?.name ?? null,
        // ele steht selten dran, aber wenn, dann ist es genauer als das Modell.
        ele_osm: el.tags?.ele ? Math.round(parseFloat(el.tags.ele)) : null,
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

// ---------------------------------------------------------------------------
// 2. Höhen bestimmen
// ---------------------------------------------------------------------------

async function hoehenErgaenzen(seen) {
  const offen = seen.filter((s) => s.ele_osm == null);
  console.log(`Höhen holen für ${offen.length} Seen (${seen.length - offen.length} stehen schon in OSM) ...`);

  const stapelAnzahl = Math.ceil(offen.length / HOEHEN_STAPEL);
  console.log(`(${stapelAnzahl} Anfragen im Abstand von ${HOEHEN_PAUSE_MS / 1000}s — ` +
              `dauert etwa ${Math.ceil(stapelAnzahl * HOEHEN_PAUSE_MS / 60000)} Minuten)\n`);

  for (let i = 0; i < offen.length; i += HOEHEN_STAPEL) {
    const stapel = offen.slice(i, i + HOEHEN_STAPEL);
    const lats = stapel.map((s) => s.lat.toFixed(5)).join(',');
    const lngs = stapel.map((s) => s.lng.toFixed(5)).join(',');

    // Bei Überlastung warten und denselben Stapel nochmal versuchen —
    // überspringen hieße, diese Seen stillschweigend zu verlieren.
    for (let versuch = 1; versuch <= 4; versuch++) {
      try {
        const res = await fetch(
          `https://api.open-meteo.com/v1/elevation?latitude=${lats}&longitude=${lngs}`
        );

        if (res.status === 429) {
          if (versuch === 4) {
            console.log(`\n   Stapel ab ${i}: dauerhaft ausgelastet — übersprungen`);
            break;
          }
          const wart = versuch * 30;
          process.stdout.write(`\r   Stapel ab ${i}: ausgelastet, warte ${wart}s ...        `);
          await sleep(wart * 1000);
          continue;
        }
        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const json = await res.json();
        const werte = json.elevation ?? [];
        stapel.forEach((s, n) => {
          if (typeof werte[n] === 'number') s.ele_modell = Math.round(werte[n]);
        });
        break;

      } catch (err) {
        if (versuch === 4) {
          console.log(`\n   Stapel ab ${i} fehlgeschlagen (${err.message}) — übersprungen`);
          break;
        }
        await sleep(versuch * 10000);
      }
    }

    const fertig = Math.min(i + HOEHEN_STAPEL, offen.length);
    process.stdout.write(`\r   ${fertig} / ${offen.length}                                 `);
    if (fertig < offen.length) await sleep(HOEHEN_PAUSE_MS);
  }
  console.log('');

  const ohne = offen.filter((s) => s.ele_modell == null).length;
  if (ohne) {
    console.log(`\nACHTUNG: ${ohne} Seen ohne Höhe — die fehlen im Ergebnis.`);
    console.log('Skript später nochmal starten, dann werden sie nachgeholt.');
  }
}

// ---------------------------------------------------------------------------
// 3. Speichern
// ---------------------------------------------------------------------------

async function speichern(client, seen) {
  const CHUNK = 400;
  let neu = 0;

  for (let i = 0; i < seen.length; i += CHUNK) {
    const teil = seen.slice(i, i + CHUNK);
    const platzhalter = [];
    const werte = [];

    teil.forEach((s, n) => {
      const b = n * 6;
      platzhalter.push(
        `($${b+1}::text, $${b+2}::bigint, $${b+3}::text, ` +
        `ST_Point($${b+4}::float8, $${b+5}::float8)::geography, $${b+6}::int)`
      );
      werte.push(s.osm_type, s.osm_id, s.name, s.lng, s.lat, s.hoehe);
    });

    const res = await client.query(
      `insert into public.water_points (source, kind, osm_type, osm_id, name, location, elevation_m)
       select 'osm', 'mountain_lake', v.osm_type, v.osm_id, v.name, v.location, v.elevation_m
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

console.log('Bergseen Österreich aus OpenStreetMap');
console.log(DRY_RUN ? '(Testlauf — es wird nichts gespeichert)\n' : '');

const client = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});
if (!DRY_RUN) await client.connect();

try {
  console.log('Seen aus OpenStreetMap holen ...');
  const alle = await seenHolen();
  console.log(`${alle.length} Seen gefunden.\n`);

  await hoehenErgaenzen(alle);

  // Wo OSM eine Höhe hat, gewinnt die — sie ist gemessen, nicht modelliert.
  for (const s of alle) s.hoehe = s.ele_osm ?? s.ele_modell ?? null;

  const bergseen = alle.filter((s) => s.hoehe != null && s.hoehe >= MINDESTHOEHE);
  const benannt = bergseen.filter((s) => s.name);

  console.log(`\n${bergseen.length} davon liegen über ${MINDESTHOEHE} m — das sind die Bergseen.`);
  console.log(`Davon ${benannt.length} mit Namen, ${bergseen.length - benannt.length} ohne.\n`);

  // Die zehn höchsten als Stichprobe — so sieht man sofort, ob es plausibel ist.
  const hoechste = [...bergseen].sort((a, b) => b.hoehe - a.hoehe).slice(0, 10);
  console.log('Die zehn höchstgelegenen:');
  console.table(hoechste.map((s) => ({ Name: s.name ?? '(ohne Namen)', Meter: s.hoehe })));

  if (!DRY_RUN) {
    const neu = await speichern(client, bergseen);
    console.log(`\n${neu} Bergseen gespeichert.`);

    const r = await client.query(
      `select count(*)::int as anzahl,
              min(elevation_m) as tiefster,
              max(elevation_m) as hoechster
       from public.water_points where kind = 'mountain_lake'`
    );
    console.table(r.rows);
  }
} catch (err) {
  console.error(`\nFEHLER: ${err.message}`);
  process.exitCode = 1;
} finally {
  if (!DRY_RUN) await client.end().catch(() => {});
}
