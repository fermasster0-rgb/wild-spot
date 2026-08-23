// ============================================================================
// Spots, die im Wasser liegen, ans Ufer holen
//
// Aufruf:  node scripts/ufer-pruefen.mjs                (nur prüfen, melden)
//          node scripts/ufer-pruefen.mjs --uebernehmen  (auch verschieben)
//
// Warum das nötig ist:
// Die Koordinaten der Kandidaten stammen zum großen Teil aus Wikipedia. Dort
// steht bei einer Bucht oder einem See die Koordinate DES GEWÄSSERS — also
// ein Punkt mitten auf der Wasserfläche. Für einen Artikel ist das richtig,
// für einen Zeltplatz ist es Unsinn: Auf der Karte schwimmt das Zeltsymbol
// dann 200 m vor dem Strand, an dem man tatsächlich stünde.
//
// Aufgefallen ist es bei Kvalvika auf den Lofoten. Die Bucht war richtig, der
// Punkt lag im Meer.
//
// Wie geprüft wird:
// Nicht über Overpass oder Nominatim — beide sind für hundert Abfragen am
// Stück nicht gedacht und haben genau daran den Dienst verweigert. Stattdessen
// über die Karte selbst: OpenTopoMap zeichnet Wasser in genau einem Farbton
// (#A3DDE8). Ein Blick auf das Pixel unter dem Spot beantwortet die Frage
// eindeutig — und dieselbe Kachel sagt auch gleich, wo das Ufer ist.
//
// Ein Haken daran hat zwei Anläufe gekostet: Auf der Karte stehen Ortsnamen
// MITTEN IM WASSER, und ein Buchstabe ist nicht blau. Wer nur die Farbe eines
// Bildpunktes prüft, hält den Schriftzug "Kvalvika" für den Strand von
// Kvalvika — genau das ist passiert, zweimal. Auch eine Mehrheitsprobe über
// die Nachbarschaft half nicht: Die Schrift ist dafür zu fett.
//
// Gelöst mit dem Werkzeug, das für genau solche Löcher gemacht ist: Aus der
// Karte wird zuerst eine reine Schwarz-Weiß-Maske (Wasser weiß, Land schwarz),
// und die wird morphologisch geschlossen. Das füllt jedes schwarze Loch im
// Wasser, das kleiner ist als der Schließradius — Schrift, Wegsymbole,
// Tiefenangaben. Was danach noch schwarz ist, ist wirklich Land.
//
// Verschoben wird zum nächstgelegenen Landpixel, plus ein paar Meter weiter
// hinein, damit der Punkt nicht auf der Uferlinie balanciert. Die Seehöhe wird
// für die neue Stelle frisch geholt.
//
// Bewusst zurückhaltend: Wer weiter als GRENZE_M vom Ufer entfernt liegt, wird
// nur gemeldet, nicht verschoben. Bei so einem Abstand stimmt vermutlich mehr
// nicht als nur ein paar Meter, und das gehört angesehen statt automatisch
// zurechtgerückt.
//
// Für genau diese Nacharbeit gibt es zwei Schalter:
//     --grenze 900          die Meldeschwelle für diesen Lauf hochsetzen
//     --nur "Kvalvika"      nur Spots prüfen, deren Name das enthält
// Zusammen lässt sich ein gemeldeter Fall gezielt nachziehen, ohne dass alle
// achtzig anderen noch einmal durch die Kartenprüfung müssen.
// ============================================================================

import { readFileSync, writeFileSync, existsSync, mkdirSync, rmSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const UEBERNEHMEN = process.argv.includes('--uebernehmen');

// --grenze <Meter> und --nur <Textstück im Namen>, siehe Kopf.
function schalter(name) {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : null;
}
const NUR = schalter('--nur');

const UA = 'WildSpot/1.0 (https://fermasster0-rgb.github.io/wild-spot/)';
const ZOOM = 15;
const KACHEL = 256;
const WASSER = [163, 221, 232];   // #A3DDE8, der Wasserton von OpenTopoMap
const TOLERANZ = 10;              // Beschriftungen und Kanten weichen leicht ab
const HINEIN_PX = 3;              // so viele Pixel weiter ins Land als nötig
const SCHLIESSEN_PX = 9;          // Radius, mit dem Schrift im Wasser zuwächst
const FENSTER = 2;                // Halbe Kantenlänge der Sicherheitsprobe (5x5)
const GRENZE_M = Number(schalter('--grenze')) || 600;   // weiter weg wird nur gemeldet
const PAUSE_MS = 250;

// Alle Kandidatendateien plus die fertigen Spotlisten — was da ist, wird
// mitgezogen, damit die Korrektur nicht beim nächsten Lauf verlorengeht.
//
// Die Kandidatendateien werden gesucht statt aufgezählt: Sonst wäre eine
// Korrektur an einem neuen Land beim nächsten Lauf von fotos-pruefen.mjs
// wieder weg, weil von dort die alte Koordinate zurückkäme. Genau das ist
// mit den österreichischen Dateien passiert.
const DATEIEN = [
  'scripts/spots-europa.json',
  'scripts/spots-nordics.json',
  ...readdirSync(resolve(projectRoot, 'scripts'))
    .filter((d) => /^kandidaten-.+\.json$/.test(d))
    .sort()
    .map((d) => `scripts/${d}`),
];

const schlaf = (ms) => new Promise((r) => setTimeout(r, ms));

let magickPfad = null;
function magick() {
  if (magickPfad) return magickPfad;
  for (const k of ['magick', 'C:\\Program Files\\ImageMagick-7.1.2-Q16-HDRI\\magick.exe']) {
    try { execFileSync(k, ['-version'], { stdio: 'pipe' }); return (magickPfad = k); } catch {}
  }
  throw new Error('ImageMagick nicht gefunden (magick.exe).');
}


// --------------------------------------------------------------------------
// Kachelrechnung. Die Weltkarte ist bei Zoom z ein Raster aus 2^z Kacheln.
// --------------------------------------------------------------------------
function nachKachel(lat, lng, z = ZOOM) {
  const n = 2 ** z;
  const x = (lng + 180) / 360 * n;
  const y = (1 - Math.log(Math.tan(lat * Math.PI / 180) + 1 / Math.cos(lat * Math.PI / 180)) / Math.PI) / 2 * n;
  return { x, y };
}

function nachGrad(x, y, z = ZOOM) {
  const n = 2 ** z;
  const lng = x / n * 360 - 180;
  const k = Math.PI - 2 * Math.PI * y / n;
  const lat = 180 / Math.PI * Math.atan(0.5 * (Math.exp(k) - Math.exp(-k)));
  return { lat, lng };
}

// Wie viele Meter ein Pixel breit ist — hängt vom Breitengrad ab.
function meterProPixel(lat, z = ZOOM) {
  return 156543.03392 * Math.cos(lat * Math.PI / 180) / 2 ** z;
}


// --------------------------------------------------------------------------
// Ein Feld aus 3x3 Kacheln um den Punkt laden und als rohe Bildpunkte lesen.
// --------------------------------------------------------------------------
async function kachelHolen(x, y, ordner) {
  const ziel = resolve(ordner, `${x}_${y}.png`);
  if (existsSync(ziel)) return ziel;
  const r = await fetch(`https://a.tile.opentopomap.org/${ZOOM}/${x}/${y}.png`, {
    headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(20000),
  });
  if (!r.ok) throw new Error(`Kachel ${x}/${y} nicht ladbar (${r.status})`);
  writeFileSync(ziel, Buffer.from(await r.arrayBuffer()));
  await schlaf(PAUSE_MS);
  return ziel;
}

async function feldLaden(kx, ky, ordner) {
  const teile = [];
  for (let dy = -1; dy <= 1; dy++)
    for (let dx = -1; dx <= 1; dx++)
      teile.push(await kachelHolen(kx + dx, ky + dy, ordner));

  const mosaik = resolve(ordner, `feld_${kx}_${ky}.png`);
  execFileSync(magick(), ['montage', ...teile, '-tile', '3x3', '-geometry', '+0+0', mosaik], { stdio: 'pipe' });

  const breite = 3 * KACHEL;

  // Schritt 1: die Farben des Mosaiks holen, drei Bytes je Bildpunkt.
  const farben = execFileSync(magick(), [mosaik, '-depth', '8', 'rgb:-'],
    { stdio: ['pipe', 'pipe', 'pipe'], maxBuffer: 16 * 1024 * 1024 });

  // Schritt 2: die Maske selbst bauen — Wasser 255, alles andere 0.
  //
  // Bewusst hier und nicht in ImageMagick. Der Versuch, das mit "-opaque" und
  // "+opaque white" zu erledigen, ging schief: OpenTopoMap legt um jede
  // Beschriftung und jedes Symbol einen weißen Rand, und "alles außer Weiß
  // wird schwarz" lässt genau diese Ränder stehen. Der Zeltplatz Hohe Wand
  // landete so auf einem Symbol mitten im Wald — und galt als Wasser.
  // Ein Vergleich gegen die eine Farbe, die Wasser hat, kennt dieses Problem
  // nicht.
  const maske = Buffer.alloc(breite * breite);
  for (let i = 0, j = 0; i < maske.length; i++, j += 3) {
    maske[i] = (Math.abs(farben[j]     - WASSER[0]) <= TOLERANZ
             && Math.abs(farben[j + 1] - WASSER[1]) <= TOLERANZ
             && Math.abs(farben[j + 2] - WASSER[2]) <= TOLERANZ) ? 255 : 0;
  }

  // Schritt 3: schließen. Das füllt die schwarzen Löcher IM Wasser — Ortsnamen,
  // Tiefenangaben, Wegsymbole. Was danach noch schwarz ist, ist Land.
  // Übergeben wird die fertige Maske als PGM, damit ImageMagick nichts mehr
  // zu raten hat.
  const pgm = Buffer.concat([Buffer.from(`P5\n${breite} ${breite}\n255\n`), maske]);
  const roh = execFileSync(magick(), [
    'pgm:-', '-morphology', 'Close', `Disk:${SCHLIESSEN_PX}`, '-depth', '8', 'gray:-',
  ], { input: pgm, stdio: ['pipe', 'pipe', 'pipe'], maxBuffer: 16 * 1024 * 1024 });

  return { roh, breite };
}

// In der geschlossenen Maske ist Wasser hell und Land dunkel.
function istWasser(roh, breite, px, py) {
  if (px < 0 || py < 0 || px >= breite || py >= breite) return false;
  return roh[py * breite + px] > 127;
}


// Land ist, wo auch die Nachbarschaft trocken ist.
//
// Das Schließen der Maske hat die Schrift schon beseitigt; diese Probe ist
// das Sicherheitsnetz für den Rest — eine Kachelkante, ein Farbverlauf, ein
// einzelner Bildpunkt, der durchgerutscht ist. Fünf mal fünf, alle trocken.
function istLand(roh, breite, px, py) {
  if (px < 0 || py < 0 || px >= breite || py >= breite) return false;
  for (let dy = -FENSTER; dy <= FENSTER; dy++)
    for (let dx = -FENSTER; dx <= FENSTER; dx++)
      if (istWasser(roh, breite, px + dx, py + dy)) return false;
  return true;
}


// --------------------------------------------------------------------------
// Den nächsten Landpunkt suchen. Ringweise nach außen, damit der erste
// Treffer auch wirklich der nächste ist.
// --------------------------------------------------------------------------
function naechstesLand(roh, breite, px, py) {
  const max = Math.floor(breite / 2) - 1;
  for (let r = 1; r <= max; r++) {
    let bester = null;
    for (let w = 0; w < 360; w += 2) {
      const dx = Math.round(r * Math.cos(w * Math.PI / 180));
      const dy = Math.round(r * Math.sin(w * Math.PI / 180));
      const nx = px + dx, ny = py + dy;
      if (!istLand(roh, breite, nx, ny)) continue;

      // Ein Stück weiter in dieselbe Richtung — sonst sitzt der Punkt auf
      // der Uferlinie, und dort steht kein Zelt.
      const laenge = Math.hypot(dx, dy) || 1;
      const tx = Math.round(nx + dx / laenge * HINEIN_PX);
      const ty = Math.round(ny + dy / laenge * HINEIN_PX);
      const ziel = istLand(roh, breite, tx, ty) ? { x: tx, y: ty } : { x: nx, y: ny };

      const abstand = Math.hypot(ziel.x - px, ziel.y - py);
      if (!bester || abstand < bester.abstand) bester = { ...ziel, abstand };
    }
    if (bester) return bester;
  }
  return null;
}

async function hoehe(lat, lng) {
  try {
    const r = await fetch(`https://api.open-meteo.com/v1/elevation?latitude=${lat}&longitude=${lng}`,
      { signal: AbortSignal.timeout(15000) });
    return Math.round((await r.json()).elevation[0]);
  } catch { return null; }
}


// --------------------------------------------------------------------------
// Los
// --------------------------------------------------------------------------
const quelle = ['scripts/spots-europa.json', 'scripts/spots-nordics.json']
  .map((q) => resolve(projectRoot, q)).find(existsSync);
if (!quelle) { console.error('Keine Spotliste gefunden.'); process.exit(1); }

const alleSpots = JSON.parse(readFileSync(quelle, 'utf8'));
const spots = NUR
  ? alleSpots.filter((s) => s.name.toLowerCase().includes(NUR.toLowerCase()))
  : alleSpots;
if (NUR && !spots.length) {
  console.error(`\nKein Spot enthält "${NUR}" im Namen.\n`);
  process.exit(1);
}

const ordner = resolve(tmpdir(), 'wildspot-kacheln');
mkdirSync(ordner, { recursive: true });

console.log(`\n${spots.length} Spots werden gegen die Karte geprüft.`);
console.log(UEBERNEHMEN ? 'Gefundene Wasserlagen werden verschoben.\n' : 'Nur prüfen — nichts wird geändert.\n');

const korrekturen = {};
let nass = 0, verschoben = 0, gemeldet = 0, unklar = 0;

for (const [i, s] of spots.entries()) {
  const fortschritt = `[${String(i + 1).padStart(2, ' ')}/${spots.length}]`;
  let feld;
  const { x: fx, y: fy } = nachKachel(s.lat, s.lng);
  const kx = Math.floor(fx), ky = Math.floor(fy);

  try {
    feld = await feldLaden(kx, ky, ordner);
  } catch (e) {
    unklar++;
    console.log(`${fortschritt} ${s.name}  ->  Karte nicht ladbar: ${e.message}`);
    continue;
  }

  // Der Spot liegt in der mittleren Kachel des Feldes.
  const px = KACHEL + Math.floor((fx - kx) * KACHEL);
  const py = KACHEL + Math.floor((fy - ky) * KACHEL);

  if (!istWasser(feld.roh, feld.breite, px, py)) continue;
  nass++;

  const land = naechstesLand(feld.roh, feld.breite, px, py);
  if (!land) {
    unklar++;
    console.log(`${fortschritt} ${s.name}  ->  im Wasser, kein Ufer im Umkreis von 700 m`);
    continue;
  }

  const mpp = meterProPixel(s.lat);
  const meter = Math.round(land.abstand * mpp);
  const { lat, lng } = nachGrad(kx - 1 + land.x / KACHEL, ky - 1 + land.y / KACHEL);

  if (meter > GRENZE_M) {
    gemeldet++;
    console.log(`${fortschritt} ${s.name}  ->  im Wasser, Ufer erst in ${meter} m — bitte ansehen`);
    continue;
  }

  const neueHoehe = UEBERNEHMEN ? await hoehe(lat, lng) : null;
  korrekturen[s.name] = {
    lat: +lat.toFixed(5), lng: +lng.toFixed(5),
    elevation_m: neueHoehe, meter,
  };
  verschoben++;
  console.log(`${fortschritt} ${s.name}  ->  ${meter} m ans Ufer` +
    (neueHoehe != null ? `, ${neueHoehe} m Seehöhe` : ''));
}

rmSync(ordner, { recursive: true, force: true });

console.log(`\n${nass} von ${spots.length} lagen im Wasser.`);
console.log(`  ${verschoben} ans Ufer geholt, ${gemeldet} nur gemeldet, ${unklar} unklar.`);

if (!UEBERNEHMEN) {
  console.log('\nZum Übernehmen:  node scripts/ufer-pruefen.mjs --uebernehmen');
} else if (verschoben) {
  for (const rel of DATEIEN) {
    const pfad = resolve(projectRoot, rel);
    if (!existsSync(pfad)) continue;
    const d = JSON.parse(readFileSync(pfad, 'utf8'));
    let n = 0;
    for (const x of d) {
      const k = korrekturen[x.name];
      if (!k) continue;
      x.lat = k.lat; x.lng = k.lng;
      if (k.elevation_m != null) x.elevation_m = k.elevation_m;
      x.koordinaten_quelle = `${x.koordinaten_quelle ?? 'unbekannt'}, ${k.meter} m ans Ufer gerückt (Kartenprüfung)`;
      n++;
    }
    writeFileSync(pfad, JSON.stringify(d, null, 2) + '\n');
    console.log(`  ${rel}: ${n} geändert`);
  }
  console.log('\nDanach:  node scripts/spots-importieren.mjs');
}
