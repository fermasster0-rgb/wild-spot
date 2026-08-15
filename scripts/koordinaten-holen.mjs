// ============================================================================
// Echte Koordinaten für die Kandidaten besorgen
//
// Aufruf:  node scripts/koordinaten-holen.mjs
//
// Reihenfolge der Quellen, von verlässlich nach behelfsmäßig:
//   1. Wikipedia (norwegisch, schwedisch, englisch) — dort steht die
//      Koordinate des Objekts selbst, geprüft von Menschen.
//   2. Median aller Fotostandorte auf Wikimedia Commons — gut genug, wenn
//      es keinen Artikel gibt.
// Zu jedem Fund holt das Skript die Seehöhe aus dem Geländemodell. Eine
// Höhe von 0 m bei einem Bergspot heißt: der Punkt liegt im Wasser.
//
// Das Skript schreibt die Koordinaten NICHT selbst zurück, sondern legt
// einen Vorschlag ab. Übernommen wird bewusst von Hand.
// ============================================================================

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const UA = 'WildSpot/1.0 (https://fermasster0-rgb.github.io/wild-spot/)';
const SPRACHEN = ['no', 'sv', 'en', 'de'];

function abstandKm(a, b) {
  const R = 6371;
  const rad = (g) => (g * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function median(w) {
  const s = [...w].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

async function hole(url) {
  for (let versuch = 1; versuch <= 3; versuch++) {
    try {
      const antwort = await fetch(url, { headers: { 'User-Agent': UA } });
      if (!antwort.ok) throw new Error('HTTP ' + antwort.status);
      return await antwort.json();
    } catch (fehler) {
      if (versuch === 3) throw fehler;
      await sleep(800 * versuch);
    }
  }
}

// Ein Treffer zählt nur, wenn der Artikel wirklich vom gesuchten Ort handelt.
// Ohne diese Prüfung lieferte die Suche nach "Segla" den Artikel Kristiansand,
// 1.344 km entfernt — die Volltextsuche gibt lieber irgendetwas zurück als
// nichts. Zwei Fragen entlarven das: Steht der Name im Titel? Und liegt der
// Ort dort, wo wir ihn ungefähr erwarten?
const MAX_ABWEICHUNG_KM = 50;

function entdiakritisiert(text) {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[øö]/gi, 'o').replace(/[åä]/gi, 'a').replace(/æ/gi, 'ae')
    .toLowerCase();
}

function titelPasst(titel, begriff) {
  const t = entdiakritisiert(titel);
  // Der Suchbegriff kann mehrteilig sein ("Hovden Setesdal"); es genügt,
  // wenn das erste, kennzeichnende Wort im Titel steht.
  const kern = entdiakritisiert(begriff.split(' ')[0]);
  return kern.length >= 4 && t.includes(kern);
}

function plausibel(fund, anker) {
  return fund && abstandKm(anker, fund) <= MAX_ABWEICHUNG_KM;
}

// 1. Wikipedia — Volltextsuche, dann Koordinate des besten geprüften Treffers
async function ausWikipedia(begriff, anker) {
  for (const sprache of SPRACHEN) {
    const url = `https://${sprache}.wikipedia.org/w/api.php?` + new URLSearchParams({
      action: 'query', generator: 'search', gsrsearch: begriff, gsrlimit: '5',
      prop: 'coordinates', format: 'json', formatversion: '2',
    });
    const daten = await hole(url);
    const seiten = (daten?.query?.pages ?? [])
      .filter((s) => s.coordinates?.[0])
      .sort((a, b) => a.index - b.index);
    for (const seite of seiten) {
      const c = seite.coordinates[0];
      const fund = { lat: c.lat, lng: c.lon };
      if (titelPasst(seite.title, begriff) && plausibel(fund, anker)) {
        return { ...fund, quelle: `${sprache}.wikipedia: ${seite.title}` };
      }
    }
    await sleep(200);
  }
  return null;
}

// 2. Commons — Median der Fotostandorte
async function ausFotos(begriff) {
  const url = 'https://commons.wikimedia.org/w/api.php?' + new URLSearchParams({
    action: 'query', generator: 'search', gsrsearch: begriff, gsrnamespace: '6',
    gsrlimit: '40', prop: 'coordinates', colimit: '40',
    format: 'json', formatversion: '2',
  });
  const daten = await hole(url);
  const punkte = (daten?.query?.pages ?? [])
    .map((s) => s.coordinates?.[0]).filter(Boolean)
    .map((c) => ({ lat: c.lat, lng: c.lon }));
  if (punkte.length < 3) return null;
  let mitte = { lat: median(punkte.map((p) => p.lat)), lng: median(punkte.map((p) => p.lng)) };
  const nah = punkte.filter((p) => abstandKm(p, mitte) < 20);
  if (nah.length >= 3) mitte = { lat: median(nah.map((p) => p.lat)), lng: median(nah.map((p) => p.lng)) };
  return { ...mitte, quelle: `Commons-Median aus ${nah.length} Fotos` };
}

async function hoehen(punkte) {
  const raus = [];
  for (let i = 0; i < punkte.length; i += 100) {
    const stapel = punkte.slice(i, i + 100);
    const url = 'https://api.open-meteo.com/v1/elevation?' + new URLSearchParams({
      latitude: stapel.map((p) => p.lat).join(','),
      longitude: stapel.map((p) => p.lng).join(','),
    });
    const daten = await hole(url);
    stapel.forEach((_, n) => raus.push(daten?.elevation?.[n] ?? null));
    if (i + 100 < punkte.length) await sleep(12000);
  }
  return raus;
}

const begriffe = JSON.parse(readFileSync(resolve(projectRoot, 'scripts/suchbegriffe.json'), 'utf8'));
const kandidaten = [
  ...JSON.parse(readFileSync(resolve(projectRoot, 'scripts/kandidaten-norwegen.json'), 'utf8'))
    .map((k) => ({ ...k, land: 'Norwegen' })),
  ...JSON.parse(readFileSync(resolve(projectRoot, 'scripts/kandidaten-schweden.json'), 'utf8'))
    .map((k) => ({ ...k, land: 'Schweden' })),
];

const funde = [];
for (const [n, kandidat] of kandidaten.entries()) {
  const begriff = begriffe[kandidat.name];
  if (!begriff) { console.log(`[${n + 1}] ?? kein Suchbegriff für ${kandidat.name}`); continue; }
  const anker = { lat: kandidat.lat, lng: kandidat.lng };
  let fund = null;
  try {
    fund = await ausWikipedia(begriff, anker);
    if (!fund) {
      const ausBildern = await ausFotos(begriff);
      if (plausibel(ausBildern, anker)) fund = ausBildern;
    }
  } catch (fehler) {
    console.log(`[${n + 1}] ! ${kandidat.name} — ${fehler.message}`);
  }
  if (!fund) {
    console.log(`[${n + 1}] ?? ${kandidat.name} — nichts gefunden, bleibt wie es ist`);
    funde.push({ name: kandidat.name, land: kandidat.land, alt: { lat: kandidat.lat, lng: kandidat.lng }, neu: null });
  } else {
    const km = abstandKm(kandidat, fund);
    console.log(`[${n + 1}] ${km > 3 ? '!!' : km > 1 ? ' ?' : ' ok'} ${km.toFixed(1)} km — ${kandidat.name}`);
    funde.push({ name: kandidat.name, land: kandidat.land, alt: { lat: kandidat.lat, lng: kandidat.lng }, neu: fund, km });
  }
  await sleep(250);
}

console.log('\nSeehöhen bestimmen …');
const mitPunkt = funde.filter((f) => f.neu);
const h = await hoehen(mitPunkt.map((f) => f.neu));
mitPunkt.forEach((f, i) => { f.hoehe = h[i]; });

writeFileSync(resolve(projectRoot, 'scripts/koordinaten-vorschlag.json'),
  JSON.stringify(funde, null, 2) + '\n', 'utf8');

const bericht = funde.map((f) => {
  if (!f.neu) return `??  ${f.land.padEnd(9)} ${f.name} — keine Quelle`;
  const marke = f.km > 3 ? '!!' : f.km > 1 ? ' ?' : ' ok';
  return `${marke} ${String(f.km.toFixed(1)).padStart(6)} km  ${f.land.padEnd(9)} ${f.name}\n` +
    `        alt ${f.alt.lat}, ${f.alt.lng}  ->  neu ${f.neu.lat}, ${f.neu.lng}  (${f.hoehe} m)\n` +
    `        Quelle: ${f.neu.quelle}`;
}).join('\n');
writeFileSync(resolve(projectRoot, 'scripts/koordinaten-bericht.txt'), bericht + '\n', 'utf8');
console.log('\nBericht: scripts/koordinaten-bericht.txt');
