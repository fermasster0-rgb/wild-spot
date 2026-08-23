// ============================================================================
// Die recherchierten Spots in die Karte einspielen
//
// Aufruf:  node scripts/spots-importieren.mjs
//          node scripts/spots-importieren.mjs --probe     (nichts schreiben)
//
// Das ist die letzte Meile der Recherche-Strecke. Vorher liefen:
//     1. kandidaten-<land>.json   von Hand recherchiert
//     2. koordinaten-holen.mjs    echte Koordinaten aus Wikipedia
//     3. koordinaten-uebernehmen  Vorschläge übernehmen, Sinnprüfung
//     4. orte-verorten.mjs        gegen echte Fotostandorte gegenprüfen
//     5. fotos-pruefen.mjs        Bild und Seehöhe holen -> spots-europa.json
// Und hier kommt das Ergebnis endlich auf die Karte.
//
// Wiederholbar. Jeder Spot trägt einen import_key ("nordics:<Name>", siehe
// Migration 032); ein zweiter Lauf legt ihn nicht noch einmal an, sondern
// frischt ihn auf. Nur so lässt sich ein Text nachbessern oder ein Land
// nachschieben, ohne die Karte zu verdoppeln.
//
// ------------------------------------------------------------- die Fotos ---
//
// Die Bilder liegen auf Wikimedia Commons und werden NICHT von dort verlinkt,
// sondern in unseren eigenen Speicher kopiert. Zwei Gründe: Ein fremder Server
// darf jederzeit abschalten oder umbenennen, und ein Bild, das erst beim
// Anzeigen von woanders geladen wird, ist offline nicht da — genau dann, wenn
// die App gebraucht wird.
//
// Vor dem Hochladen wird jedes Bild auf 1600 Pixel verkleinert. Das ist
// dieselbe Grenze, die die App im Browser anlegt, und sie hält den Speicher
// klein: aus 8 MB werden rund 300 KB.
//
// Frei heißt nicht bedingungslos. CC BY und CC BY-SA verlangen den Namen des
// Fotografen, die Lizenz und einen Weg zur Quelle. Alle drei landen in
// spot_photos (Migration 031) und stehen unter dem Bild.
//
// ----------------------------------------------------------- die Rechte ----
//
// Geschrieben wird direkt auf der Datenbank (DATABASE_URL), nicht über die
// Schnittstelle — sonst würden die Trigger aus 023 und 032 greifen. Der
// Speicher geht aber nur über die Schnittstelle, deshalb meldet sich das
// Skript zusätzlich am Dienstkonto an. Die Bilder liegen damit im Ordner
// dieses Kontos, so wie es die Speicherregel aus Migration 008 verlangt.
// ============================================================================

import { readFileSync, writeFileSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import pg from 'pg';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PROBE = process.argv.includes('--probe');

const UA = 'WildSpot/1.0 (https://fermasster0-rgb.github.io/wild-spot/)';
const BREITE_PX = 1600;
const QUALITAET = 82;
const EIMER = 'spot-photos';

// Woher ein Spot stammt. Das steckt im import_key und ist an ihm ablesbar:
//     nordics:Kvalvika – Bucht hinter dem Ryten
//     oesterreich:Zeltwiese am Zeinissee
//
// Norwegen und Schweden liefen als erste Gruppe zusammen unter "nordics" —
// das bleibt so. Würde man sie jetzt umbenennen, fänden sich die 87 bereits
// eingespielten Spots beim nächsten Lauf nicht wieder und stünden ein zweites
// Mal auf der Karte.
const GRUPPE = { Norwegen: 'nordics', Schweden: 'nordics' };

function herkunft(land) {
  return GRUPPE[land]
      ?? (land ?? 'unbekannt').toLowerCase()
           .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
           .replace(/[^a-z0-9]+/g, '-');
}

// Eingabe. spots-europa.json ist der neue Name aus fotos-pruefen.mjs; solange
// es die Datei nicht gibt, bleibt die alte gültig.
const QUELLEN = ['scripts/spots-europa.json', 'scripts/spots-nordics.json'];


// ---------------------------------------------------------------------------
// .env.local einlesen — bewusst ohne Zusatzpaket, wie in db/run-sql.mjs.
// ---------------------------------------------------------------------------
function ladeEnv() {
  const raw = readFileSync(resolve(projectRoot, '.env.local'), 'utf8');
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

function ladeConfig() {
  // config.js ist für den Browser geschrieben. Statt es auszuwerten, werden
  // die zwei Werte herausgelesen — das ist ehrlicher als ein eval.
  const raw = readFileSync(resolve(projectRoot, 'web/config.js'), 'utf8');
  const hol = (feld) => raw.match(new RegExp(feld + `:\\s*'([^']+)'`))?.[1];
  return { url: hol('supabaseUrl'), anonKey: hol('supabaseAnonKey') };
}


// ---------------------------------------------------------------------------
// Am Dienstkonto anmelden. Gebraucht wird nur der Zugang zum Bildspeicher.
// ---------------------------------------------------------------------------
async function anmelden({ url, anonKey }) {
  const r = await fetch(`${url}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: anonKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: process.env.WILDSPOT_MAIL,
      password: process.env.WILDSPOT_PASSWORT,
    }),
  });
  if (!r.ok) throw new Error(`Anmeldung fehlgeschlagen (${r.status}): ${await r.text()}`);
  const d = await r.json();
  return { token: d.access_token, nutzerId: d.user.id };
}


// ---------------------------------------------------------------------------
// Ein Bild holen, verkleinern, hochladen. Gibt den Speicherpfad zurück.
// ---------------------------------------------------------------------------
async function fotoUebernehmen(foto, { url, anonKey, token, nutzerId, spotId, arbeitsordner }) {
  const antwort = await fetch(foto.url, { headers: { 'User-Agent': UA } });
  if (!antwort.ok) throw new Error(`Bild nicht ladbar (${antwort.status})`);
  const roh = Buffer.from(await antwort.arrayBuffer());

  const eingang = resolve(arbeitsordner, 'roh');
  const ausgang = resolve(arbeitsordner, 'klein.jpg');
  writeFileSync(eingang, roh);

  // -auto-orient zuerst: manche Bilder tragen die Drehung nur im EXIF-Block,
  // und der fällt beim Verkleinern weg. Ohne diesen Schritt liegt das Bild
  // hinterher auf der Seite.
  // -strip wirft den Rest des EXIF-Blocks weg — er wird nicht gebraucht und
  // ist bei manchen Bildern größer als das Bild selbst.
  execFileSync(magick(), [
    eingang,
    '-auto-orient',
    '-resize', `${BREITE_PX}x${BREITE_PX}>`,
    '-strip',
    '-quality', String(QUALITAET),
    ausgang,
  ], { stdio: 'pipe' });

  const klein = readFileSync(ausgang);

  // Der Pfad muss mit der eigenen Nutzer-ID beginnen — darauf baut die
  // Speicherregel aus Migration 008 auf.
  const pfad = `${nutzerId}/${spotId}/wikimedia.jpg`;
  const hoch = await fetch(`${url}/storage/v1/object/${EIMER}/${pfad}`, {
    method: 'POST',
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'image/jpeg',
      'x-upsert': 'true',
    },
    body: klein,
  });
  if (!hoch.ok) throw new Error(`Hochladen fehlgeschlagen (${hoch.status}): ${await hoch.text()}`);

  return { pfad, bytes: klein.length };
}

let magickPfad = null;
function magick() {
  if (magickPfad) return magickPfad;
  const kandidaten = [
    'magick',
    'C:\\Program Files\\ImageMagick-7.1.2-Q16-HDRI\\magick.exe',
  ];
  for (const k of kandidaten) {
    try { execFileSync(k, ['-version'], { stdio: 'pipe' }); return (magickPfad = k); } catch {}
  }
  throw new Error('ImageMagick nicht gefunden (magick.exe). Ohne das geht das Verkleinern nicht.');
}


// ---------------------------------------------------------------------------
// Beschreibung zusammensetzen
//
// In der Datei stehen drei Texte: was der Platz ist, wie bekannt er ist, und
// welche Regel dort gilt. In der App gibt es dafür ein Feld. Die Reihenfolge
// ist Absicht — die Regel steht zuletzt, weil sie das ist, woran man sich
// beim Weggehen erinnern soll.
// ---------------------------------------------------------------------------
function beschreibung(s) {
  const teile = [s.text];
  if (s.bekannt) teile.push(`Wie bekannt: ${s.bekannt}`);
  if (s.regel) teile.push(`Regel vor Ort: ${s.regel}`);
  const text = teile.filter(Boolean).join('\n\n');
  return text.length > 2000 ? text.slice(0, 1997) + '…' : text;
}


// ---------------------------------------------------------------------------
// Los geht's
// ---------------------------------------------------------------------------
ladeEnv();

const quelle = QUELLEN.map((q) => resolve(projectRoot, q)).find(existsSync);
if (!quelle) {
  console.error('\nKeine Spot-Datei gefunden. Erwartet wird eine von:\n  ' + QUELLEN.join('\n  ') + '\n');
  process.exit(1);
}
const spots = JSON.parse(readFileSync(quelle, 'utf8'));
console.log(`\nQuelle: ${quelle.replace(projectRoot + '\\', '').replace(projectRoot + '/', '')}  (${spots.length} Spots)`);
if (PROBE) console.log('PROBELAUF — es wird nichts geschrieben.\n');

const config = ladeConfig();
const konto = PROBE ? { token: null, nutzerId: null } : await anmelden(config);

const db = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});
await db.connect();

// Das Dienstkonto ist der Eigentümer der eingespielten Spots. Beim Probelauf
// wird es nur nachgeschlagen.
const dienst = konto.nutzerId
  ?? (await db.query(`select id from profiles where username = 'claude-dienst'`)).rows[0]?.id;
if (!dienst) throw new Error('Dienstkonto claude-dienst nicht gefunden.');

const arbeitsordner = resolve(tmpdir(), 'wildspot-import');
mkdirSync(arbeitsordner, { recursive: true });

const bericht = [];
let neu = 0, aufgefrischt = 0, fotosNeu = 0, fehler = 0;

for (const [i, s] of spots.entries()) {
  const key = `${herkunft(s.land)}:${s.name}`;
  const zeile = `[${String(i + 1).padStart(2, ' ')}/${spots.length}] ${s.land ?? ''} ${s.name}`;

  try {
    if (PROBE) {
      const da = await db.query(`select id from spots where import_key = $1`, [key]);
      console.log(`${zeile}  ->  ${da.rows.length ? 'wäre aufgefrischt' : 'wäre neu'}`);
      continue;
    }

    // ---------------------------------------------------------- der Spot ---
    const { rows } = await db.query(
      `insert into spots (
         created_by, import_key, name, description,
         location,
         water_nearby, water_type, water_distance_m, water_reliable,
         above_treeline, elevation_m, has_lake, ground_type, exposure,
         firewood_available, fire_allowed, shelter_nearby,
         access, hike_minutes, mobile_signal, discreet, legal_status, season,
         parking_lat, parking_lng
       ) values (
         $1, $2, $3, $4,
         st_setsrid(st_makepoint($6, $5), 4326)::geography,
         $7, $8, $9, $10,
         $11, $12, $13, $14, $15,
         $16, $17, $18,
         $19, $20, $21, $22, $23, $24,
         $25, $26
       )
       on conflict (import_key) where import_key is not null do update set
         name              = excluded.name,
         description       = excluded.description,
         location          = excluded.location,
         water_nearby      = excluded.water_nearby,
         water_type        = excluded.water_type,
         water_distance_m  = excluded.water_distance_m,
         water_reliable    = excluded.water_reliable,
         above_treeline    = excluded.above_treeline,
         elevation_m       = excluded.elevation_m,
         has_lake          = excluded.has_lake,
         ground_type       = excluded.ground_type,
         exposure          = excluded.exposure,
         firewood_available= excluded.firewood_available,
         fire_allowed      = excluded.fire_allowed,
         shelter_nearby    = excluded.shelter_nearby,
         access            = excluded.access,
         hike_minutes      = excluded.hike_minutes,
         mobile_signal     = excluded.mobile_signal,
         discreet          = excluded.discreet,
         legal_status      = excluded.legal_status,
         season            = excluded.season,
         parking_lat       = excluded.parking_lat,
         parking_lng       = excluded.parking_lng,
         updated_at        = now()
       returning id, (xmax = 0) as ist_neu`,
      [
        dienst, key, s.name, beschreibung(s),
        s.lat, s.lng,
        s.water_nearby ?? null, s.water_type ?? null, s.water_distance_m ?? null, s.water_reliable ?? null,
        s.above_treeline ?? null, s.elevation_m ?? null, s.has_lake ?? null, s.ground_type ?? null, s.exposure ?? null,
        s.firewood_available ?? null, s.fire_allowed ?? 'unklar', s.shelter_nearby ?? null,
        s.access ?? null, s.hike_minutes ?? null, s.mobile_signal ?? null, s.discreet ?? null,
        s.legal_status ?? 'unklar', s.season?.length ? s.season : null,
        s.parking_lat ?? null, s.parking_lng ?? null,
      ],
    );

    const spotId = rows[0].id;
    const istNeu = rows[0].ist_neu;
    istNeu ? neu++ : aufgefrischt++;

    // ---------------------------------------------------------- das Foto ---
    // Nur einmal. Ein zweiter Lauf soll nicht jedes Bild noch einmal von
    // Wikimedia holen — das dauert und ändert nichts.
    let fotoInfo = 'Foto lag schon da';
    const schonDa = await db.query(
      `select 1 from spot_photos where spot_id = $1 and quelle_url is not null`, [spotId]);

    if (!schonDa.rows.length && s.foto?.url) {
      const { pfad, bytes } = await fotoUebernehmen(s.foto, {
        ...config, ...konto, spotId, arbeitsordner,
      });
      await db.query(
        `insert into spot_photos (spot_id, uploaded_by, storage_path, sort_order, autor, lizenz, quelle_url)
         values ($1, $2, $3, 0, $4, $5, $6)`,
        [spotId, dienst, pfad, s.foto.autor ?? null, s.foto.lizenz ?? null, s.foto.seite ?? null],
      );
      fotosNeu++;
      fotoInfo = `Foto ${Math.round(bytes / 1024)} KB`;
    }

    console.log(`${zeile}  ->  ${istNeu ? 'neu' : 'aufgefrischt'}, ${fotoInfo}`);
    bericht.push(`${istNeu ? 'neu  ' : 'frisch'}  ${s.land ?? ''}  ${s.name}  (${s.lat}, ${s.lng}, ${s.elevation_m ?? '?'} m)`);
  } catch (e) {
    fehler++;
    console.log(`${zeile}  ->  FEHLER: ${e.message}`);
    bericht.push(`FEHLER  ${s.name}  ${e.message}`);
  }
}

rmSync(arbeitsordner, { recursive: true, force: true });

if (!PROBE) {
  const gesamt = await db.query(`select count(*)::int n from spots`);
  console.log(
    `\nFertig. ${neu} neu, ${aufgefrischt} aufgefrischt, ${fotosNeu} Fotos übernommen` +
    (fehler ? `, ${fehler} Fehler` : '') +
    `.\nAuf der Karte stehen jetzt ${gesamt.rows[0].n} Spots.`,
  );
  writeFileSync(resolve(projectRoot, 'scripts/import-bericht.txt'), bericht.join('\n') + '\n');
  console.log('Bericht: scripts/import-bericht.txt');
  console.log('\nAls Nächstes:  node scripts/routen-rechnen.mjs   (Wanderwege Parkplatz -> Spot)');
}

await db.end();
