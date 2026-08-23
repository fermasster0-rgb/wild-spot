// ============================================================================
// Fotos und Höhen für die Spot-Kandidaten prüfen
//
// Aufruf:  node scripts/fotos-pruefen.mjs
//
// Wie das funktioniert:
//   1. Für jeden Kandidaten fragt das Skript Wikimedia Commons, welche Bilder
//      IN DER NÄHE DIESER KOORDINATEN aufgenommen wurden (Geosuche). Das ist
//      strenger als eine Namenssuche: ein Bild, das bei "Kvalvika" heißt, kann
//      irgendwo entstanden sein — ein Bild mit Geokoordinate 300 m daneben
//      nicht.
//   2. Findet die Geosuche nichts, wird ersatzweise nach dem Ortsnamen gesucht.
//   3. Aus den Treffern wird das beste echte Landschaftsfoto gewählt. Karten,
//      Zeichnungen, Schilder und Panoramen von Parkplätzen fliegen raus.
//   4. Die Seehöhe kommt aus dem Copernicus-Geländemodell über Open-Meteo —
//      dieselbe Quelle, die die App beim Anlegen eines Spots benutzt.
//
// Wer kein Foto hat, kommt nicht auf die Karte. Das ist die harte Regel:
// ein Spot ohne Bild ist auf einer Wildcamp-Karte wertlos.
//
// Eingabe:  alle scripts/kandidaten-<land>.json — eine Datei je Land. Neue
//           Länder werden von selbst mitgenommen, ohne Änderung am Skript.
//           Wer im letzten Lauf schon ein Foto bekam, wird übersprungen.
//
// Ergebnis: scripts/spots-europa.json   (importfertig, alle Länder)
//           scripts/fotos-bericht.txt   (was drin ist und was rausfiel)
//
// Datenquellen: Wikimedia Commons (freie Lizenzen) und Open-Meteo.
// ============================================================================

import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const UA = 'WildSpot/1.0 (https://fermasster0-rgb.github.io/wild-spot/)';
const GEO_RADIUS_M = 3000;
const PAUSE_MS = 350;

// ---------------------------------------------------------------------------
// Was ist ein brauchbares Foto?
// ---------------------------------------------------------------------------

// Dateinamen, die fast nie ein Landschaftsbild sind. Beim ersten Durchlauf
// landete sonst "Atlantic Ocean Road map.svg" als Titelbild einer Bucht.
const NAME_SPERRE = [
  'map', 'karta', 'kart_', 'karte', 'plan', 'diagram', 'chart', 'skilt',
  'sign', 'schild', 'logo', 'wappen', 'coat_of_arms', 'flag', 'teckning',
  'drawing', 'sketch', 'portrait', 'porträtt', 'grave', 'gravsten',
  'stamp', 'briefmarke', 'poster', 'cover', 'label', 'tabell', 'profil',
];

// Naturkundliche Sammlungen laden massenhaft Nahaufnahmen von Pilzen, Käfern
// und Flechten hoch — mit Koordinate, aber ohne jeden Landschaftsbezug. Beim
// zweiten Durchlauf bekam der Ryten so ein Pilzfoto als Titelbild.
const BIO_QUELLE = /biodiversity|artsdatabanken|inaturalist|gbif|naturalis|herbarium|museum|artportalen|observation\.org/i;
const BIO_TITEL = /\b(sp|ssp|var|subsp)\.|\((l|lasch|donk|fr|pers|müll|link)\.\)|larva|imago|flower|blomma|sopp|svamp|lav\b|moss\b|insect|beetle|bird|fugl|fågel/i;

// Lizenzen, mit denen wir arbeiten dürfen. Reihenfolge = Vorliebe: je weiter
// vorne, desto weniger Auflagen. Namensnennung leisten wir bei allen, auch
// bei CC0 — kostet nichts und ist fair.
const LIZENZ_RANG = [
  { muster: /^cc0/i, rang: 0 },
  { muster: /public domain|^pd/i, rang: 1 },
  { muster: /^cc by 4/i, rang: 2 },
  { muster: /^cc by 3|^cc by 2/i, rang: 3 },
  { muster: /^cc by-sa 4/i, rang: 4 },
  { muster: /^cc by-sa 3|^cc by-sa 2/i, rang: 5 },
];

function lizenzRang(kurz) {
  if (!kurz) return null;
  for (const { muster, rang } of LIZENZ_RANG) if (muster.test(kurz)) return rang;
  return null; // unbekannte Lizenz — nicht verwenden
}

function istFoto(titel) {
  const t = titel.toLowerCase();
  if (!/\.(jpe?g)$/.test(t)) return false; // svg/png sind meist Grafiken
  return !NAME_SPERRE.some((wort) => t.includes(wort));
}

// extmetadata liefert HTML — für einen Bildnachweis brauchen wir nur den Text.
function textAus(html) {
  if (!html) return '';
  return html
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#039;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

// ---------------------------------------------------------------------------
// Commons abfragen
// ---------------------------------------------------------------------------

async function commons(params) {
  const url = 'https://commons.wikimedia.org/w/api.php?' +
    new URLSearchParams({ ...params, format: 'json', formatversion: '2' });
  for (let versuch = 1; versuch <= 3; versuch++) {
    try {
      const antwort = await fetch(url, { headers: { 'User-Agent': UA } });
      if (!antwort.ok) throw new Error('HTTP ' + antwort.status);
      return await antwort.json();
    } catch (fehler) {
      if (versuch === 3) throw fehler;
      await sleep(1000 * versuch);
    }
  }
}

// Wie gut passt dieses Bild zu diesem Ort? Je höher, desto besser.
// Der Ortsname im Titel ist das stärkste Signal: ein Bild, das "Segla" heißt
// und bei Segla aufgenommen wurde, zeigt mit hoher Sicherheit Segla.
function punkte(bild, ortsname) {
  let p = 10 - bild.rang;                       // bessere Lizenz = mehr Punkte
  // Nur das kennzeichnende erste Wort vergleichen: der Suchbegriff kann
  // "Rogen naturreservat" lauten, das Bild heißt aber schlicht "Rogen".
  const ort = entdiakritisiert(ortsname.split(' ')[0]);
  const titel = entdiakritisiert(bild.titel);
  const text = entdiakritisiert(bild.beschreibung);
  if (ort.length >= 4 && titel.includes(ort)) p += 30;
  else if (ort.length >= 4 && text.includes(ort)) p += 20;
  if (bild.breit) p += 5;                       // Querformat spricht für Landschaft
  if (BIO_QUELLE.test(bild.autor)) p -= 50;     // naturkundliche Sammlung
  if (BIO_TITEL.test(bild.titel)) p -= 40;      // Art statt Ort
  return p;
}

function entdiakritisiert(text) {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[øö]/gi, 'o').replace(/[åä]/gi, 'a').replace(/æ/gi, 'ae')
    .toLowerCase();
}

function treffer(daten, ortsname) {
  const seiten = daten?.query?.pages ?? [];
  const raus = [];
  for (const seite of seiten) {
    const titel = seite.title?.replace(/^File:/, '') ?? '';
    if (!istFoto(titel)) continue;
    const info = seite.imageinfo?.[0];
    if (!info) continue;
    const meta = info.extmetadata ?? {};
    const lizenz = textAus(meta.LicenseShortName?.value);
    const rang = lizenzRang(lizenz);
    if (rang === null) continue;
    const breite = info.thumbwidth ?? 0;
    if (breite && breite < 800) continue; // zu klein fürs Titelbild
    const bild = {
      titel,
      url: info.thumburl ?? info.url,
      lizenz,
      autor: textAus(meta.Artist?.value) || 'Unbekannt',
      beschreibung: textAus(meta.ImageDescription?.value).slice(0, 300),
      seite: info.descriptionurl,
      rang,
      breit: (info.width ?? 0) >= (info.height ?? 1),
    };
    bild.punkte = punkte(bild, ortsname);
    // Unter 0 Punkten ist es mit Sicherheit kein Bild dieser Landschaft.
    if (bild.punkte < 0) continue;
    raus.push(bild);
  }
  raus.sort((a, b) => b.punkte - a.punkte);
  return raus;
}

// Ein Bild wird nur genommen, wenn es diesen Wert erreicht. Der Wert ist so
// gewählt, dass der Ortsname im Titel oder in der Bildbeschreibung stehen
// MUSS — Geokoordinate allein genügt nicht. Sonst bekam der Snøheim ein Foto
// von einem Pilz, der zufällig dort wuchs, und der Ersfjord Möwen auf einem
// Schornstein. Lieber ein Spot weniger als ein irreführendes Titelbild.
const MINDESTPUNKTE = 25;

// Zwei Spots mit demselben Titelbild sehen auf der Karte nach Schlamperei
// aus — Kvalvika und der Ryten darüber bekamen beim Testlauf dasselbe Foto.
// Deshalb merkt sich der Lauf, welches Bild schon vergeben ist.
const vergeben = new Set();
const frei = (liste) => liste.filter((b) => !vergeben.has(b.titel));

async function fotoSuchen(kandidat, ortsname) {
  // 1. Geosuche — Bilder, die wirklich dort aufgenommen wurden
  const geo = await commons({
    action: 'query',
    generator: 'geosearch',
    ggscoord: `${kandidat.lat}|${kandidat.lng}`,
    ggsradius: String(GEO_RADIUS_M),
    ggsnamespace: '6',
    ggslimit: '40',
    prop: 'imageinfo',
    iiprop: 'url|size|extmetadata',
    iiurlwidth: '1600',
  });
  const nah = frei(treffer(geo, ortsname));
  if (nah.length && nah[0].punkte >= MINDESTPUNKTE) {
    vergeben.add(nah[0].titel);
    return { foto: nah[0], quelle: 'geo', auswahl: nah.length };
  }

  // 2. Namenssuche als Rückfallebene
  await sleep(PAUSE_MS);
  const text = await commons({
    action: 'query',
    generator: 'search',
    gsrsearch: `${ortsname} ${kandidat.region}`,
    gsrnamespace: '6',
    gsrlimit: '40',
    prop: 'imageinfo',
    iiprop: 'url|size|extmetadata',
    iiurlwidth: '1600',
  });
  const gefunden = frei(treffer(text, ortsname));
  if (gefunden.length && gefunden[0].punkte >= MINDESTPUNKTE) {
    vergeben.add(gefunden[0].titel);
    return { foto: gefunden[0], quelle: 'name', auswahl: gefunden.length };
  }

  // Kein Bild mit belegbarem Ortsbezug — dann kommt dieser Spot nicht auf
  // die Karte. Eine Notfallstufe gibt es bewusst nicht.
  return null;
}

// ---------------------------------------------------------------------------
// Seehöhe aus dem Geländemodell
// ---------------------------------------------------------------------------

async function hoehenHolen(punkte) {
  const raus = new Map();
  for (let i = 0; i < punkte.length; i += 100) {
    const stapel = punkte.slice(i, i + 100);
    const url = 'https://api.open-meteo.com/v1/elevation?' + new URLSearchParams({
      latitude: stapel.map((p) => p.lat).join(','),
      longitude: stapel.map((p) => p.lng).join(','),
    });
    const antwort = await fetch(url, { headers: { 'User-Agent': UA } });
    const daten = await antwort.json();
    stapel.forEach((p, n) => {
      const h = daten?.elevation?.[n];
      if (typeof h === 'number') raus.set(p.name, Math.round(h));
    });
    if (i + 100 < punkte.length) await sleep(12000); // Open-Meteo drosselt
  }
  return raus;
}

// ---------------------------------------------------------------------------
// Hauptlauf
// ---------------------------------------------------------------------------

// Alle Länderdateien einsammeln, die im Ordner liegen. Wer eine neue Datei
// scripts/kandidaten-<land>.json ablegt, ist damit automatisch dabei — am
// Skript muss nichts geändert werden.
const LAND_NAME = {
  rumaenien: 'Rumänien',
  oesterreich: 'Österreich',
  tschechien: 'Tschechien',

  // Österreich wurde nach Bundesländern recherchiert, weil das Zeltrecht hier
  // Landesrecht ist und sich von Land zu Land unterscheidet — von "über der
  // Waldgrenze frei" in der Steiermark bis "überall verboten" in Kärnten.
  // Auf der Karte ist das trotzdem ein Land.
  tirol: 'Österreich',
  'salzburg-ooe': 'Österreich',
  'steiermark-kaernten': 'Österreich',
  vorarlberg: 'Österreich',
  niederoesterreich: 'Österreich',
};

function landAusDateiname(datei) {
  const kurz = datei.replace(/^kandidaten-/, '').replace(/\.json$/, '');
  return LAND_NAME[kurz] ?? kurz.charAt(0).toUpperCase() + kurz.slice(1);
}

const dateien = readdirSync(resolve(projectRoot, 'scripts'))
  .filter((d) => /^kandidaten-.+\.json$/.test(d))
  .sort();

const kandidaten = dateien.flatMap((datei) => {
  const land = landAusDateiname(datei);
  const liste = JSON.parse(readFileSync(resolve(projectRoot, 'scripts', datei), 'utf8'));
  return liste.map((k) => ({ ...k, land }));
});

// Was in einem früheren Lauf schon ein Foto bekommen hat, wird nicht noch
// einmal gesucht. Sonst würde jeder Durchgang alle Länder neu durch Wikimedia
// jagen — bei über 200 Spots dauert das unnötig lang.
const ZIEL = resolve(projectRoot, 'scripts/spots-europa.json');
const schonFertig = new Map();
for (const alt of ['scripts/spots-europa.json', 'scripts/spots-nordics.json']) {
  const pfad = resolve(projectRoot, alt);
  if (!existsSync(pfad)) continue;
  for (const s of JSON.parse(readFileSync(pfad, 'utf8'))) {
    if (s.foto && !schonFertig.has(s.name)) schonFertig.set(s.name, s);
  }
}

// Der örtliche Eigenname — danach wird gesucht und daran wird gemessen, ob
// ein Bild zum Ort gehört. "Hochebene über dem Vøringsfossen" hilft nicht,
// "Vøringsfossen" schon.
const ortsnamen = JSON.parse(readFileSync(resolve(projectRoot, 'scripts/suchbegriffe.json'), 'utf8'));

console.log(
  `${kandidaten.length} Kandidaten aus ${dateien.length} Ländern — ` +
  `${schonFertig.size} haben schon ein Foto, der Rest wird gesucht …\n`,
);

const fertig = [];
const rausgefallen = [];

for (const [n, kandidat] of kandidaten.entries()) {
  const zaehler = `[${String(n + 1).padStart(3, ' ')}/${kandidaten.length}]`;

  // Schon im letzten Lauf versorgt — Foto und Höhe übernehmen, nicht neu suchen.
  const alt = schonFertig.get(kandidat.name);
  if (alt) {
    fertig.push({ ...kandidat, ortsname: alt.ortsname, foto: alt.foto, foto_quelle: alt.foto_quelle, elevation_m: alt.elevation_m });
    console.log(`${zaehler} · ${kandidat.name} — schon versorgt`);
    continue;
  }

  try {
    const ortsname = ortsnamen[kandidat.name] ?? kandidat.name.split('–')[0].trim();
    const ergebnis = await fotoSuchen(kandidat, ortsname);
    if (!ergebnis) {
      rausgefallen.push({ ...kandidat, grund: 'kein brauchbares Foto' });
      console.log(`${zaehler} ✗ ${kandidat.name} — kein Foto`);
    } else {
      fertig.push({ ...kandidat, ortsname, foto: ergebnis.foto, foto_quelle: ergebnis.quelle });
      console.log(`${zaehler} ${ergebnis.quelle === 'geo-schwach' ? '~' : '✓'} ${kandidat.name} — ${ergebnis.foto.lizenz} (${ergebnis.quelle}, ${ergebnis.foto.punkte} P.)`);
    }
  } catch (fehler) {
    rausgefallen.push({ ...kandidat, grund: 'Fehler: ' + fehler.message });
    console.log(`${zaehler} ! ${kandidat.name} — ${fehler.message}`);
  }
  await sleep(PAUSE_MS);
}

const ohneHoehe = fertig.filter((s) => typeof s.elevation_m !== 'number');
if (ohneHoehe.length) {
  console.log(`\nSeehöhen aus dem Geländemodell holen (${ohneHoehe.length}) …`);
  const hoehen = await hoehenHolen(ohneHoehe.map((s) => ({ name: s.name, lat: s.lat, lng: s.lng })));
  for (const spot of ohneHoehe) {
    const h = hoehen.get(spot.name);
    if (typeof h === 'number' && h >= 0 && h <= 4000) spot.elevation_m = h;
  }
}

writeFileSync(ZIEL, JSON.stringify(fertig, null, 2) + '\n', 'utf8');

// Zählung je Land, sortiert nach Ausbeute.
const laender = [...new Set(kandidaten.map((k) => k.land))].sort();
const proLand = laender.map((land) => {
  const drin = fertig.filter((s) => s.land === land).length;
  const raus = rausgefallen.filter((s) => s.land === land).length;
  return `  ${land.padEnd(14)} ${String(drin).padStart(3)} auf der Karte, ${raus} ohne Foto`;
});

const bericht = [
  `Stand: ${new Date().toISOString().slice(0, 10)}`,
  `Länder: ${laender.length}`,
  `Kandidaten: ${kandidaten.length}`,
  `Mit Foto (kommen auf die Karte): ${fertig.length}`,
  `Ohne Foto (fallen raus): ${rausgefallen.length}`,
  '',
  '--- Je Land ---',
  ...proLand,
  '',
  '--- Rausgefallen ---',
  ...rausgefallen.map((s) => `${s.land.padEnd(14)} ${s.name} — ${s.grund}`),
  '',
  '--- Aufgenommen ---',
  ...fertig.map((s) =>
    `${s.land.padEnd(14)} ${String(s.elevation_m ?? '?').padStart(4)} m  ${s.name}\n` +
    `               Foto: ${s.foto.titel}\n` +
    `                     ${s.foto.lizenz}, ${s.foto.autor} — ${s.foto_quelle}, ${s.foto.punkte} Punkte`),
].join('\n');

writeFileSync(resolve(projectRoot, 'scripts/fotos-bericht.txt'), bericht + '\n', 'utf8');

console.log(`\nFertig: ${fertig.length} von ${kandidaten.length} Spots haben ein Foto.`);
console.log('  scripts/spots-europa.json   — importfertig');
console.log('  scripts/fotos-bericht.txt   — vollständige Liste');
