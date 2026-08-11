// ============================================================================
// Wasserfälle für Österreich
//
// Aufruf:  node scripts/import-waterfalls.mjs
//          node scripts/import-waterfalls.mjs --dry     (nur zählen)
//
// Ein Wasserfall ist für diese App zweierlei: verlässliches Wasser und ein
// Grund, überhaupt dorthin zu gehen. Genau wie beim Bergsee — deshalb bekommt
// er eine eigene Ebene und verschwindet nicht zwischen 16.000 Trinkbrunnen.
//
// In OpenStreetMap steht er als waterway=waterfall.
//
// Die Seehöhe steht dort fast nie dabei. Sie kommt deshalb aus dem
// Copernicus-Geländemodell über Open-Meteo, in Stapeln zu 100 Punkten.
//
// Datenquelle: OpenStreetMap (ODbL) und Open-Meteo (Copernicus DEM).
// ============================================================================

import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DRY_RUN = process.argv.includes('--dry');

const HOEHEN_STAPEL = 100;
// Open-Meteo lässt etwa 600 Koordinaten pro Minute zu. Schneller quittiert
// der Dienst mit "429 — zu viele Anfragen".
const HOEHEN_PAUSE_MS = 12000;

const ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
];
const MAX_ATTEMPTS = 5;
const CHUNK = 500;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function loadEnv() {
  const raw = readFileSync(resolve(projectRoot, '.env.local'), 'utf8');
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

// ---------------------------------------------------------------------------
// 1. Wasserfälle aus OpenStreetMap
// ---------------------------------------------------------------------------

async function wasserfaelleHolen() {
  // Genau Österreich, nicht das umgebende Rechteck — sonst kämen die
  // Wasserfälle Südtirols und Bayerns mit.
  const query =
    '[out:json][timeout:600];' +
    'area["ISO3166-1"="AT"][admin_level=2]->.at;' +
    'nwr["waterway"="waterfall"](area.at);' +
    'out center tags;';

  for (let versuch = 1; versuch <= MAX_ATTEMPTS; versuch++) {
    const endpoint = ENDPOINTS[(versuch - 1) % ENDPOINTS.length];
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'wildcamp-at/1.0 (Hobbyprojekt, Oesterreich)',
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
        // Steht die Höhe in OSM, ist sie besser als jedes Modell.
        ele_osm: el.tags?.ele ? Math.round(parseFloat(el.tags.ele)) : null,
        // Fallhöhe, falls jemand sie eingetragen hat — die ist für einen
        // Wasserfall die interessantere Zahl als die Seehöhe.
        hoehe_fall: el.tags?.height ? Math.round(parseFloat(el.tags.height)) : null,
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
// 2. Seehöhen ergänzen
// ---------------------------------------------------------------------------

async function hoehenErgaenzen(punkte) {
  const offen = punkte.filter((p) => p.ele_osm == null);
  if (!offen.length) return;

  const stapelAnzahl = Math.ceil(offen.length / HOEHEN_STAPEL);
  console.log(`Höhen holen für ${offen.length} Wasserfälle ` +
              `(${punkte.length - offen.length} stehen schon in OSM) ...`);
  console.log(`(${stapelAnzahl} Anfragen im Abstand von ${HOEHEN_PAUSE_MS / 1000}s — ` +
              `dauert etwa ${Math.ceil(stapelAnzahl * HOEHEN_PAUSE_MS / 60000)} Minuten)\n`);

  for (let i = 0; i < offen.length; i += HOEHEN_STAPEL) {
    const stapel = offen.slice(i, i + HOEHEN_STAPEL);
    const lats = stapel.map((s) => s.lat.toFixed(5)).join(',');
    const lngs = stapel.map((s) => s.lng.toFixed(5)).join(',');

    for (let versuch = 1; versuch <= MAX_ATTEMPTS; versuch++) {
      try {
        const res = await fetch(
          `https://api.open-meteo.com/v1/elevation?latitude=${lats}&longitude=${lngs}`
        );
        if (res.status === 429) {
          console.log('   Open-Meteo bremst, warte 60s ...');
          await sleep(60000);
          continue;
        }
        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const json = await res.json();
        const hoehen = json.elevation ?? [];
        stapel.forEach((s, n) => {
          if (Number.isFinite(hoehen[n])) s.ele_modell = Math.round(hoehen[n]);
        });
        break;

      } catch (err) {
        if (versuch === MAX_ATTEMPTS) {
          console.log(`   Höhen für einen Stapel nicht bekommen (${err.message}) — bleibt leer.`);
          break;
        }
        await sleep(versuch * 8000);
      }
    }

    const fertig = Math.min(i + HOEHEN_STAPEL, offen.length);
    process.stdout.write(`\r   ${fertig} von ${offen.length}`);

    if (fertig < offen.length) await sleep(HOEHEN_PAUSE_MS);
  }
  console.log('');
}

// ---------------------------------------------------------------------------
// 3. Speichern
// ---------------------------------------------------------------------------

async function speichern(punkte) {
  let geschrieben = 0;

  for (let i = 0; i < punkte.length; i += CHUNK) {
    const teil = punkte.slice(i, i + CHUNK);
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
       select 'osm', 'waterfall', v.osm_type, v.osm_id, v.name, v.location, v.elevation_m
       from (values ${platzhalter.join(',')}) as v(osm_type, osm_id, name, location, elevation_m)
       on conflict (source, osm_type, osm_id, kind) do update
         set elevation_m = excluded.elevation_m,
             name        = excluded.name`,
      werte
    );
    geschrieben += res.rowCount;
  }
  return geschrieben;
}

// ---------------------------------------------------------------------------

loadEnv();

console.log('Wasserfälle Österreich aus OpenStreetMap');
console.log(DRY_RUN ? '(Testlauf — es wird nichts gespeichert)\n' : '');

const client = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});
if (!DRY_RUN) await client.connect();

try {
  console.log('Wasserfälle aus OpenStreetMap holen ...');
  const alle = await wasserfaelleHolen();
  console.log(`${alle.length} gefunden.\n`);

  await hoehenErgaenzen(alle);

  // Wo OSM eine Höhe hat, gewinnt die — sie ist eingetragen, nicht modelliert.
  for (const s of alle) s.hoehe = s.ele_osm ?? s.ele_modell ?? null;

  const benannt = alle.filter((s) => s.name);
  const mitFallhoehe = alle.filter((s) => s.hoehe_fall);

  console.log(`\n${benannt.length} haben einen Namen, ${mitFallhoehe.length} eine Fallhöhe.`);

  if (benannt.length) {
    const hoechste = [...benannt].sort((a, b) => (b.hoehe ?? 0) - (a.hoehe ?? 0)).slice(0, 5);
    console.log('\nDie höchstgelegenen mit Namen:');
    for (const s of hoechste) {
      console.log(`   ${s.name} — ${s.hoehe ?? '?'} m`);
    }
  }

  if (DRY_RUN) {
    console.log('\nTestlauf beendet, nichts gespeichert.');
  } else {
    console.log('\nWird gespeichert ...');
    const n = await speichern(alle);
    console.log(`${n} Wasserfälle gespeichert.`);

    const { rows } = await client.query(
      "select count(*)::int as anzahl from public.water_points where kind = 'waterfall'"
    );
    console.log(`\nIn der Datenbank stehen jetzt ${rows[0].anzahl} Wasserfälle.`);
  }

} catch (err) {
  console.error('\nFEHLER:', err.message);
  process.exitCode = 1;
} finally {
  if (!DRY_RUN) await client.end().catch(() => {});
}
