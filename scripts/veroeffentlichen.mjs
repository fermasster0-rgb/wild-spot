// ============================================================================
// Änderungen ins Netz stellen.
//
// Aufruf aus dem Projektordner:
//     node scripts/veroeffentlichen.mjs
//     node scripts/veroeffentlichen.mjs "Fotos beim Anlegen erlauben"
//
// Ohne Text nimmt es einen Standardsatz mit Datum. Danach ist die Seite unter
// https://fermasster0-rgb.github.io/wild-spot/ aktuell — meistens nach etwa
// einer Minute, manchmal nach zwei.
//
// ----------------------------------------------------------------------------
// Warum es zwei Zweige gibt
//
// Im Zweig "main" liegt das ganze Projekt: Datenbank, Skripte, Konzept. Ins
// Netz gehört davon aber nur der Ordner web/ — niemand soll die SQL-Dateien
// im Browser aufrufen können.
//
// Deshalb gibt es den Zweig "gh-pages", der ausschließlich den Inhalt von
// web/ enthält. GitHub veröffentlicht genau diesen. Das Kopieren dorthin
// macht "git subtree split" — von Hand wäre es jedes Mal derselbe Dreisatz.
// ============================================================================

import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// Alles läuft im Projektordner, egal von wo aufgerufen wird.
function git(befehl, { still = false } = {}) {
  return execSync(`git ${befehl}`, {
    cwd: projectRoot,
    encoding: 'utf8',
    stdio: still ? 'pipe' : ['pipe', 'pipe', 'pipe'],
  }).trim();
}

function schritt(text) {
  console.log(`\n→ ${text}`);
}

// ----------------------------------------------------------------------------
// Die Fassung im Service Worker hochzählen.
//
// Seit die App offline kann, hält das Handy die Dateien fest. Ohne neue Nummer
// in sw.js bliebe dort ewig die alte Fassung kleben — die klassische Falle bei
// Apps, die offline können. Deshalb macht das Skript es, nicht der Mensch.
// ----------------------------------------------------------------------------
function fassungHochzaehlen() {
  const pfad = join(projectRoot, 'web', 'sw.js');
  const inhalt = readFileSync(pfad, 'utf8');

  const jetzt = new Date();
  const stempel = jetzt.toISOString().slice(0, 16).replace(/[:T]/g, '-');
  const neu = inhalt.replace(/const VERSION = '[^']*';/,
                             `const VERSION = '${stempel}';`);

  if (neu === inhalt) return null;   // Zeile nicht gefunden: still weitermachen
  writeFileSync(pfad, neu);
  return stempel;
}

try {
  // ------------------------------------------------------------- 0. Fassung --
  const fassung = fassungHochzaehlen();
  if (fassung) {
    schritt(`Neue Fassung für die App: ${fassung}`);
    console.log('  Handys holen sich die Dateien damit frisch');
  }

  // --------------------------------------------------------------- 1. Stand --
  const offen = git('status --porcelain', { still: true });

  if (offen) {
    const anzahl = offen.split('\n').length;
    const nachricht = process.argv[2]
      || `Änderungen vom ${new Date().toLocaleDateString('de-AT')}`;

    schritt(`${anzahl} geänderte ${anzahl === 1 ? 'Datei' : 'Dateien'} werden gesichert`);
    git('add -A');

    // Der Text kommt über eine Datei-freie Variante ohne Anführungszeichen-
    // Ärger: execSync geht durch die Shell, deshalb wird er hier maskiert.
    git(`commit -q -m "${nachricht.replace(/"/g, '\\"')}"`);
    console.log(`  gesichert als: ${nachricht}`);
  } else {
    schritt('Keine neuen Änderungen — es wird nur neu veröffentlicht');
  }

  // ------------------------------------------------------------ 2. Sichern --
  schritt('Projekt wird zu GitHub geschickt');
  git('push -q origin main');
  console.log('  main ist aktuell');

  // ------------------------------------------------------ 3. Veröffentlichen --
  schritt('Der Ordner web/ wird ins Netz gestellt');

  // Den alten Zweig wegwerfen: er wird jedes Mal frisch aus web/ gebaut.
  try { git('branch -D gh-pages', { still: true }); } catch { /* gab es noch nicht */ }

  git('subtree split --prefix web -b gh-pages', { still: true });
  git('push -q -f origin gh-pages:gh-pages');

  // Aufräumen, damit der Zweig nicht im Weg herumliegt.
  try { git('branch -D gh-pages', { still: true }); } catch { /* egal */ }

  console.log('\n============================================================');
  console.log('  Fertig.');
  console.log('  https://fermasster0-rgb.github.io/wild-spot/');
  console.log('');
  console.log('  GitHub braucht meist eine Minute, bis die Änderung');
  console.log('  wirklich draußen ist. Am Handy danach einmal neu laden.');
  console.log('============================================================\n');

} catch (err) {
  console.error('\nFEHLER beim Veröffentlichen:\n');
  console.error(err.stdout?.toString() || err.stderr?.toString() || err.message);
  console.error('\nDie Seite im Netz ist dadurch unverändert geblieben.');
  process.exitCode = 1;
}
