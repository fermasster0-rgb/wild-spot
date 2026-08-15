// ============================================================================
// Koordinaten der Kandidaten gegen echte Fotostandorte prüfen
//
// Aufruf:  node scripts/orte-verorten.mjs
//
// Warum das nötig ist: Beim ersten Durchlauf lag der Punkt für Kvalvika auf
// den Lofoten rund 4 km neben der echten Bucht. Die Geosuche fand trotzdem
// ein Foto — nur eben ein Foto von woanders. Ein falsch verorteter Spot mit
// hübschem Bild ist schlimmer als gar kein Spot.
//
// Wie geprüft wird: Wikimedia Commons speichert zu vielen Bildern, WO sie
// aufgenommen wurden. Sucht man nach einem Ortsnamen und nimmt den Median
// aller Fundkoordinaten, bekommt man eine sehr belastbare Position — der
// Median ist unempfindlich gegen einzelne Ausreißer.
//
// Das Skript ändert nichts, es meldet nur. Korrigiert wird von Hand.
// ============================================================================

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const UA = 'WildSpot/1.0 (https://fermasster0-rgb.github.io/wild-spot/)';

// Wörter, ab denen im Spotnamen die deutsche Beschreibung anfängt.
// "Slåttdalsskrevan im Skuleskogen" -> gesucht wird "Slåttdalsskrevan".
const STOPP = /\s(–|-\s|bei|im|am|in|an|auf|über|vor|unter|zwischen|aus|hinter|und)\s/i;

function suchbegriff(name) {
  const teil = name.split(STOPP)[0].trim();
  return teil.replace(/[–-]$/, '').trim();
}

function abstandKm(a, b) {
  const R = 6371;
  const rad = (g) => (g * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function median(werte) {
  const s = [...werte].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

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

async function verorten(kandidat) {
  const daten = await commons({
    action: 'query',
    generator: 'search',
    gsrsearch: `${suchbegriff(kandidat.name)} ${kandidat.region}`,
    gsrnamespace: '6',
    gsrlimit: '40',
    prop: 'coordinates',
    colimit: '40',
  });
  const punkte = (daten?.query?.pages ?? [])
    .map((s) => s.coordinates?.[0])
    .filter(Boolean)
    .map((c) => ({ lat: c.lat, lng: c.lon }));
  if (punkte.length < 3) return { punkte: punkte.length, mitte: null };

  // Erster Median, dann Ausreißer über 25 km verwerfen und neu rechnen.
  let mitte = { lat: median(punkte.map((p) => p.lat)), lng: median(punkte.map((p) => p.lng)) };
  const nah = punkte.filter((p) => abstandKm(p, mitte) < 25);
  if (nah.length >= 3) {
    mitte = { lat: median(nah.map((p) => p.lat)), lng: median(nah.map((p) => p.lng)) };
  }
  return { punkte: nah.length, mitte };
}

const dateien = ['scripts/kandidaten-norwegen.json', 'scripts/kandidaten-schweden.json'];
const zeilen = [];

for (const datei of dateien) {
  const kandidaten = JSON.parse(readFileSync(resolve(projectRoot, datei), 'utf8'));
  for (const [n, kandidat] of kandidaten.entries()) {
    let ergebnis;
    try {
      ergebnis = await verorten(kandidat);
    } catch (fehler) {
      zeilen.push(`?? ${kandidat.name} — Fehler: ${fehler.message}`);
      continue;
    }
    if (!ergebnis.mitte) {
      zeilen.push(`?? ${kandidat.name} — nur ${ergebnis.punkte} verortete Fotos, keine Aussage`);
      console.log(`[${n + 1}] ?? ${kandidat.name}`);
    } else {
      const km = abstandKm(kandidat, ergebnis.mitte);
      const marke = km > 3 ? '!!' : km > 1.5 ? ' ?' : ' ok';
      zeilen.push(
        `${marke} ${km.toFixed(1).padStart(5)} km  ${kandidat.name}\n` +
        `        jetzt: ${kandidat.lat}, ${kandidat.lng}` +
        `   Fotos (${ergebnis.punkte}): ${ergebnis.mitte.lat.toFixed(4)}, ${ergebnis.mitte.lng.toFixed(4)}`,
      );
      console.log(`[${n + 1}] ${marke} ${km.toFixed(1)} km — ${kandidat.name}`);
    }
    await sleep(300);
  }
}

writeFileSync(resolve(projectRoot, 'scripts/verortung-bericht.txt'), zeilen.join('\n') + '\n', 'utf8');
console.log('\nBericht: scripts/verortung-bericht.txt');
console.log('!! = über 3 km daneben, muss korrigiert werden');
