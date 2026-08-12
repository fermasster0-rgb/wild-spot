// ============================================================================
// Winziger Webserver, damit die Karte im Browser läuft — auch auf dem Handy.
//
// Aufruf aus dem Projektordner:
//     node web/server.mjs
//
// Danach steht im Fenster eine Adresse für diesen PC und eine fürs Handy.
// Beenden mit Strg + C.
//
// Warum überhaupt ein Server, wenn man die index.html doch anklicken könnte:
// Die Standortbestimmung und das Kopieren in die Zwischenablage funktionieren
// in Browsern nur auf "http://localhost" oder "https://", nicht auf einer
// direkt geöffneten Datei.
// ============================================================================

import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { networkInterfaces } from 'node:os';

const webDir = dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 5173;

const TYPEN = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'text/javascript; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.geojson': 'application/geo+json; charset=utf-8',
  // Ohne den richtigen Typ nimmt der Browser das Manifest nicht an — und
  // ohne Manifest lässt sich die App nicht installieren.
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg':  'image/svg+xml',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.ico':  'image/x-icon',
};

const server = createServer(async (req, res) => {
  let pfad = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (pfad === '/') pfad = '/index.html';

  // Sicherheitsnetz: nichts außerhalb des web-Ordners ausliefern.
  const datei = resolve(join(webDir, normalize(pfad)));
  if (!datei.startsWith(webDir)) {
    res.writeHead(403).end('Verboten');
    return;
  }

  try {
    const inhalt = await readFile(datei);
    res.writeHead(200, {
      'Content-Type': TYPEN[extname(datei).toLowerCase()] || 'application/octet-stream',
      // Beim Entwickeln immer die frische Datei, nie eine alte aus dem Cache.
      'Cache-Control': 'no-store',
    });
    res.end(inhalt);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Nicht gefunden: ' + pfad);
  }
});

// Die eigene Adresse im WLAN — damit man die Karte am Handy aufmachen kann.
function lanAdresse() {
  for (const liste of Object.values(networkInterfaces())) {
    for (const n of liste ?? []) {
      if (n.family === 'IPv4' && !n.internal) return n.address;
    }
  }
  return null;
}

server.listen(PORT, '0.0.0.0', () => {
  const lan = lanAdresse();
  console.log('\n  wildcamp.at — Karte läuft\n');
  console.log(`  Auf diesem PC:  http://localhost:${PORT}`);
  if (lan) {
    console.log(`  Am Handy:       http://${lan}:${PORT}   (gleiches WLAN)`);
    console.log('\n  Falls das Handy nicht durchkommt: Windows-Firewall fragt beim');
    console.log('  ersten Start nach — dort "Privates Netzwerk" erlauben.');
  }
  console.log('\n  Beenden mit Strg + C\n');
});
