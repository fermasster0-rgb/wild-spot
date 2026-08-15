// ============================================================================
// Die Wanderrouten rechnen: Parkplatz → Spot
//
// Aufruf aus dem Projektordner:
//     node scripts/routen-rechnen.mjs          nur die offenen
//     node scripts/routen-rechnen.mjs --alle   alle noch einmal
//     node scripts/routen-rechnen.mjs --probe  nur zeigen, nichts speichern
//
// ----------------------------------------------------------------------------
// Was es tut
//
// Es sucht alle Spots, bei denen ein Parkplatz eingetragen ist, und lässt
// OpenRouteService dazwischen den Fußweg rechnen — Profil "foot-hiking", also
// über Wanderwege, Steige und Forststraßen aus OpenStreetMap. Zurück kommen
// Linie, Gehzeit, Strecke und Höhenmeter. Das landet in den route_*-Spalten
// (Migration 015) und wird in der App angezeigt.
//
// Mitgeschrieben wird auch hike_minutes: die von Hand geschätzte Gehzeit wird
// durch die gemessene ersetzt. Genau darum geht es bei der ganzen Sache.
//
// ----------------------------------------------------------------------------
// Warum das ein Skript ist und nicht im Browser läuft
//
// Der Schlüssel. Alles, was im Ordner web/ liegt, ist im Netz für jeden
// lesbar — ein Schlüssel dort wäre verschenkt. Hier kommt er aus .env.local,
// die in .gitignore steht und GitHub nie sieht.
//
// Dazu kommt das Kontingent: Der Gratis-Zugang erlaubt 2.000 Anfragen am Tag
// und 40 in der Minute. Eine Wanderroute ändert sich nie — sie einmal zu
// rechnen und zu speichern reicht, und das Kontingent bleibt für die neuen
// Spots übrig.
//
// ----------------------------------------------------------------------------
// Wann es laufen muss
//
// Immer dann, wenn jemand einen Parkplatz neu gesetzt oder verschoben hat.
// Verschieben löscht die alte Route automatisch (der Trigger aus Migration
// 015) — der Spot taucht dadurch beim nächsten Lauf von selbst wieder hier
// auf. Man kann das Skript also bedenkenlos regelmäßig laufen lassen; ohne
// offene Spots ist es nach zwei Sekunden fertig und ruft niemanden an.
// ============================================================================

import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const ALLE  = process.argv.includes('--alle');
const PROBE = process.argv.includes('--probe');

// Der Gratis-Zugang erlaubt 40 Anfragen in der Minute. 1,7 Sekunden Abstand
// bleiben mit Sicherheitsabstand darunter — schneller bringt nichts, weil
// dann Absagen zurückkommen und alles doppelt gerechnet werden müsste.
const PAUSE_MS = 1700;

const ORS = 'https://api.openrouteservice.org/v2/directions/foot-hiking/geojson';

// ----------------------------------------------------------------------------
// .env.local einlesen — dieselben fünf Zeilen wie in db/run-sql.mjs.
// ----------------------------------------------------------------------------
function loadEnv() {
  const path = resolve(projectRoot, '.env.local');
  let raw;
  try {
    raw = readFileSync(path, 'utf8');
  } catch {
    console.error('\nEs fehlt die Datei .env.local im Projektordner.\n');
    process.exit(1);
  }
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

const schlaf = (ms) => new Promise((r) => setTimeout(r, ms));

function dauerText(minuten) {
  const m = Math.round(minuten);
  if (m < 60) return `${m} min`;
  return `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')} min`;
}

// ----------------------------------------------------------------------------
// Eine Route holen.
//
// Rückgabe entweder { status: 'ok', ... } oder { status: 'kein_weg' } oder
// { status: 'fehler', grund }. Ein Fehler ist nie schlimm: Der Spot behält
// den Vermerk und wird beim nächsten Lauf erneut versucht.
// ----------------------------------------------------------------------------
async function routeHolen(vonLat, vonLng, nachLat, nachLng, schluessel) {
  let antwort;
  try {
    antwort = await fetch(ORS, {
      method: 'POST',
      headers: {
        'Authorization': schluessel,
        'Content-Type': 'application/json',
        // OpenRouteService bittet ausdrücklich darum, sich zu erkennen zu geben.
        'User-Agent': 'wild-spot (https://fermasster0-rgb.github.io/wild-spot/)',
      },
      body: JSON.stringify({
        // Reihenfolge bei GeoJSON immer: erst Länge, dann Breite.
        coordinates: [[vonLng, vonLat], [nachLng, nachLat]],
        // Ohne das gäbe es keine Höhenmeter — und die sind am Berg die
        // aussagekräftigere Zahl als die Strecke.
        elevation: true,
        // Abbiegehinweise brauchen wir nicht; sie machen die Antwort nur groß.
        instructions: false,
      }),
      signal: AbortSignal.timeout(30000),
    });
  } catch (e) {
    return { status: 'fehler', grund: 'nicht erreichbar (' + (e.message || e) + ')' };
  }

  let json = null;
  try { json = await antwort.json(); } catch { /* gleich behandelt */ }

  if (!antwort.ok) {
    const code = json?.error?.code;
    const text = json?.error?.message || json?.error || `HTTP ${antwort.status}`;

    // 2009 = keine Route gefunden, 2010 = kein Weg in der Nähe des Punktes.
    // Beides ist eine echte Antwort und kein Ausfall: Es gibt dort schlicht
    // keinen Weg, und ein zweiter Versuch morgen ändert daran nichts.
    if (code === 2009 || code === 2010) return { status: 'kein_weg', grund: text };

    // 403/429 heißt fast immer: Kontingent aufgebraucht. Dann hat es keinen
    // Sinn, die restlichen Spots auch noch durchzuprobieren.
    if (antwort.status === 403 || antwort.status === 429) {
      return { status: 'fehler', grund: text, abbrechen: true };
    }
    return { status: 'fehler', grund: text };
  }

  const f = json?.features?.[0];
  const koordinaten = f?.geometry?.coordinates;
  const summe = f?.properties?.summary;

  if (!Array.isArray(koordinaten) || koordinaten.length < 2 || !summe) {
    return { status: 'kein_weg', grund: 'leere Antwort' };
  }

  // Sicherung gegen einen verrutschten Parkplatz: Wer sich beim Setzen um ein
  // Tal vertut, bekommt sonst eine Route über 80 Kilometer angezeigt, als
  // wäre sie eine Angabe. Über einen Tagesmarsch hinaus ist das keine
  // Zubringerstrecke mehr, sondern ein Fehler — und die Datenbank ließe
  // solche Werte ohnehin nicht durch.
  if (summe.duration > 24 * 3600 || summe.distance > 200000) {
    return {
      status: 'kein_weg',
      grund: `unplausibel weit (${Math.round(summe.distance / 1000)} km) — ` +
             'sitzt der Parkplatz richtig?',
    };
  }

  // Die Linie kürzen: fünf Nachkommastellen sind gut ein Meter — genauer muss
  // eine Wanderlinie auf einer Karte nicht sein. Die Höhe je Punkt fliegt
  // raus, sie wird nirgends gezeichnet; auf- und abwärts stehen als Summe
  // ohnehin daneben. Zusammen macht das aus 40 KB etwa 10.
  const linie = [];
  for (const p of koordinaten) {
    const lng = Number(p[0].toFixed(5));
    const lat = Number(p[1].toFixed(5));
    const letzter = linie[linie.length - 1];
    if (!letzter || letzter[0] !== lng || letzter[1] !== lat) linie.push([lng, lat]);
  }

  return {
    status: 'ok',
    linie,
    minuten: Math.round(summe.duration / 60),
    meter: Math.round(summe.distance),
    // ascent/descent gibt es nur, weil oben elevation: true steht.
    aufwaerts: Math.round(f.properties.ascent ?? 0),
    abwaerts: Math.round(f.properties.descent ?? 0),
  };
}

// ============================================================================

loadEnv();

const schluessel = process.env.ORS_API_KEY;
if (!schluessel) {
  console.error(
    '\nEs fehlt der Schlüssel für OpenRouteService.\n\n' +
    'Trag ihn in .env.local ein:\n\n  ORS_API_KEY=…\n\n' +
    'Einen bekommst du gratis auf openrouteservice.org/dev — ohne Kreditkarte.\n'
  );
  process.exit(1);
}

const client = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

try {
  await client.connect();

  // Ohne --alle nur, was noch offen ist: nie gerechnet, oder beim letzten Mal
  // am Dienst gescheitert. 'kein_weg' bleibt bewusst außen vor — dort gibt es
  // keinen Weg, und das ändert sich nicht von einem Tag auf den anderen.
  const { rows } = await client.query(`
    select
      id, name,
      parking_lat, parking_lng,
      st_y(location::geometry) as lat,
      st_x(location::geometry) as lng,
      hike_minutes, route_status
    from public.spots
    where parking_lat is not null
      and parking_lng is not null
      ${ALLE ? '' : "and (route_status is null or route_status = 'fehler')"}
    order by created_at
  `);

  if (!rows.length) {
    console.log('\nNichts zu tun — für alle Spots mit Parkplatz liegt eine Route vor.');
    console.log('(Alles noch einmal rechnen: --alle)\n');
    process.exit(0);
  }

  console.log(`\n${rows.length} ${rows.length === 1 ? 'Spot' : 'Spots'} zu rechnen` +
              (PROBE ? ' — Probelauf, es wird nichts gespeichert' : '') + '\n');

  let ok = 0, ohneWeg = 0, fehler = 0;

  for (const [i, s] of rows.entries()) {
    process.stdout.write(`[${i + 1}/${rows.length}] ${s.name} … `);

    const e = await routeHolen(
      Number(s.parking_lat), Number(s.parking_lng),
      Number(s.lat), Number(s.lng),
      schluessel
    );

    if (e.status === 'ok') {
      ok++;
      const km = (e.meter / 1000).toFixed(1).replace('.', ',');
      console.log(`${dauerText(e.minuten)} · ${km} km · ↗ ${e.aufwaerts} m ` +
                  `· ↘ ${e.abwaerts} m (${e.linie.length} Punkte)`);

      if (!PROBE) {
        await client.query(`
          update public.spots set
            route_line       = $2::jsonb,
            route_minutes    = $3,
            route_distance_m = $4,
            route_ascent_m   = $5,
            route_descent_m  = $6,
            route_status     = 'ok',
            route_updated_at = now(),
            -- Die gemessene Gehzeit ersetzt die geschätzte. Über 24 Stunden
            -- lässt die Tabelle nicht zu; so eine Route wäre ohnehin ein
            -- Zeichen dafür, dass der Parkplatz falsch sitzt.
            hike_minutes     = least($3, 1440)
          where id = $1
        `, [s.id, JSON.stringify(e.linie), e.minuten, e.meter, e.aufwaerts, e.abwaerts]);
      }

    } else if (e.status === 'kein_weg') {
      ohneWeg++;
      console.log(`kein Weg gefunden — ${e.grund}`);
      if (!PROBE) {
        await client.query(
          `update public.spots
              set route_status = 'kein_weg', route_updated_at = now()
            where id = $1`, [s.id]);
      }

    } else {
      fehler++;
      console.log(`FEHLER — ${e.grund}`);
      if (!PROBE) {
        await client.query(
          `update public.spots
              set route_status = 'fehler', route_updated_at = now()
            where id = $1`, [s.id]);
      }
      if (e.abbrechen) {
        console.log('\nDas Kontingent für heute scheint aufgebraucht. ' +
                    'Der Rest kommt beim nächsten Lauf dran.');
        break;
      }
    }

    // Nach dem letzten Spot muss niemand mehr warten.
    if (i < rows.length - 1) await schlaf(PAUSE_MS);
  }

  console.log('\n============================================================');
  console.log(`  ${ok} gerechnet · ${ohneWeg} ohne Weg · ${fehler} fehlgeschlagen`);
  if (PROBE) console.log('  Probelauf — in der Datenbank steht unverändert das Alte.');
  console.log('============================================================\n');

} catch (err) {
  console.error(`\nFEHLER: ${err.message}`);
  process.exitCode = 1;
} finally {
  await client.end().catch(() => {});
}
