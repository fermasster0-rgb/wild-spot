// ============================================================================
// Geprüfte Koordinaten in die Kandidatendateien zurückschreiben
//
// Aufruf:  node scripts/koordinaten-uebernehmen.mjs
//
// Übernommen wird, was koordinaten-holen.mjs vorgeschlagen hat — also nur
// Positionen, die einen passenden Wikipedia-Artikel haben oder aus dem Median
// vieler Fotostandorte stammen, und die höchstens 50 km von der ursprünglichen
// Schätzung entfernt liegen.
//
// Danach folgt eine Sinnprüfung: Ein Spot, dessen Name "Plateau", "Gipfel"
// oder "Hochebene" verspricht, darf nicht auf 20 m Seehöhe liegen. Solche
// Fälle meldet das Skript, es korrigiert sie nicht selbst.
// ============================================================================

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// Von Hand nachgemessen, weil die automatische Quelle danebenlag: der
// Foto-Median zeigt den Berg VOM FJORD AUS, nicht den Berg selbst.
const VON_HAND = {
  'Ryten – Plateau über Kvalvika': { lat: 68.0868, lng: 13.0917, elevation_m: 481 },
  'Steindalsbreen in den Lyngenalpen': { lat: 69.5450, lng: 20.1900, elevation_m: 294 },

  // Nachgetragen am 2026-08-23: Diese beiden waren die einzigen Kandidaten
  // ganz ohne geprüfte Quelle — ihre Koordinate war noch die erste Schätzung
  // aus der Recherche. OpenStreetMap kennt beide Orte, und bei Ersfjord zeigt
  // der Foto-Median auf denselben Punkt. Ohne diesen Eintrag würde ein
  // erneuter Lauf die alten Werte zurückschreiben.
  'Ersfjord – Hang über dem Strand': { lat: 69.4801, lng: 17.3970, elevation_m: 0 },
  'Dyranut auf der Hardangervidda': { lat: 60.36824, lng: 7.50358, elevation_m: 1245 },
};

// Wörter, die eine Höhenlage versprechen. Steht so eines im Namen und die
// gemessene Höhe liegt darunter, stimmt etwas nicht.
const HOEHENWORT = /plateau|gipfel|hochebene|fjell|grat|sattel|berg|pass|kamm/i;
const MINDESTHOEHE_BEI_HOEHENWORT = 300;

const vorschlaege = new Map(
  JSON.parse(readFileSync(resolve(projectRoot, 'scripts/koordinaten-vorschlag.json'), 'utf8'))
    .map((f) => [f.name, f]),
);

const warnungen = [];
let geaendert = 0;

for (const datei of ['scripts/kandidaten-norwegen.json', 'scripts/kandidaten-schweden.json']) {
  const pfad = resolve(projectRoot, datei);
  const kandidaten = JSON.parse(readFileSync(pfad, 'utf8'));

  for (const kandidat of kandidaten) {
    const handarbeit = VON_HAND[kandidat.name];
    if (handarbeit) {
      Object.assign(kandidat, handarbeit);
      geaendert++;
      continue;
    }
    const vorschlag = vorschlaege.get(kandidat.name);
    if (!vorschlag?.neu) continue;
    kandidat.lat = +vorschlag.neu.lat.toFixed(5);
    kandidat.lng = +vorschlag.neu.lng.toFixed(5);
    if (typeof vorschlag.hoehe === 'number' && vorschlag.hoehe >= 0 && vorschlag.hoehe <= 4000) {
      kandidat.elevation_m = Math.round(vorschlag.hoehe);
    }
    kandidat.koordinaten_quelle = vorschlag.neu.quelle;
    geaendert++;
  }

  // Sinnprüfung
  for (const kandidat of kandidaten) {
    const h = kandidat.elevation_m;
    if (HOEHENWORT.test(kandidat.name) && typeof h === 'number' && h < MINDESTHOEHE_BEI_HOEHENWORT) {
      warnungen.push(`Höhe passt nicht zum Namen: ${kandidat.name} — ${h} m`);
    }
    if (kandidat.above_treeline === true && typeof h === 'number' && h < 150) {
      warnungen.push(`"über der Baumgrenze", aber nur ${h} m: ${kandidat.name}`);
    }
    if (kandidat.has_lake === true && kandidat.water_type !== 'see') {
      warnungen.push(`has_lake gesetzt, aber water_type ist "${kandidat.water_type}": ${kandidat.name}`);
    }
  }

  writeFileSync(pfad, JSON.stringify(kandidaten, null, 2) + '\n', 'utf8');
}

console.log(`${geaendert} Koordinaten übernommen.`);
if (warnungen.length) {
  console.log(`\n${warnungen.length} Stellen zum Nachsehen:`);
  for (const w of warnungen) console.log('  - ' + w);
} else {
  console.log('Sinnprüfung ohne Beanstandung.');
}
