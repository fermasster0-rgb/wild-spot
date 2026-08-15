// ============================================================================
// Der Service Worker — das Stück, das die App offline hält.
//
// Ein Service Worker ist ein kleines Programm, das der Browser neben der Seite
// laufen lässt. Es sitzt zwischen der App und dem Netz: Jede Anfrage geht
// zuerst hier durch. Damit kann es Antworten aufheben und sie später wieder
// herausgeben — auch wenn kein Empfang da ist.
//
// Genau darum geht es hier: Am Berg gibt es kein Netz, und genau dort braucht
// man die Karte.
//
// Drei Sorten von Anfragen, drei Umgangsweisen:
//
//   1. Die App selbst (HTML, JavaScript, Symbole)
//      → beim Installieren einmal komplett laden, danach aus dem Speicher.
//        Die App startet dadurch auch im Flugmodus.
//
//   2. Kartenkacheln (basemap.at, OpenTopoMap, CARTO)
//      → was einmal geladen wurde, bleibt. Kacheln ändern sich über Jahre
//        nicht, deshalb wird zuerst im Speicher nachgesehen und gar nicht
//        erst ins Netz gegangen. Das macht die Karte nebenbei schneller.
//
//   3. Alles Lebendige (Anmeldung, Spots, Bewertungen)
//      → immer ins Netz. Aufgehobene Anmeldedaten wären ein Sicherheitsloch,
//        aufgehobene Bewertungen wären schlicht falsch.
//
// Was das NICHT kann: ein Gebiet im Voraus herunterladen ("Karte für die Tour
// speichern"). Der Speicher füllt sich nur mit dem, was man angeschaut hat.
// Wer die Tour vorher zu Hause auf der Karte abfährt, hat sie am Berg — wer
// blind hinfährt, nicht. Das Vorausladen wäre ein eigener Schritt.
// ============================================================================

// Die Version wird beim Veröffentlichen automatisch neu gesetzt
// (scripts/veroeffentlichen.mjs). Ändert sie sich, wirft der Browser die alten
// App-Dateien weg und holt sie frisch — sonst würde am Handy ewig die alte
// Fassung kleben. Die Kartenkacheln bleiben davon unberührt, die sind ja
// nicht veraltet.
const VERSION = '2026-08-15-14-39';

const CACHE_APP    = `wildspot-app-${VERSION}`;
const CACHE_KARTEN = 'wildspot-karten';   // ohne Version: bleibt über Updates
const CACHE_FOTOS  = 'wildspot-fotos';

// Wie viel darf liegen bleiben. Eine Kachel ist etwa 20–40 KB, 1500 Stück
// sind also grob 45 MB — genug für mehrere Wandergebiete, wenig genug, dass
// es auf keinem Handy auffällt.
const MAX_KACHELN = 1500;
const MAX_FOTOS   = 200;

// ----------------------------------------------------------------------------
// Was beim Installieren geladen wird: alles, was die App zum Starten braucht.
//
// Die beiden Bibliotheken von fremden Servern (die Karte und die Verbindung
// zur Datenbank) gehören mit dazu — ohne sie startet gar nichts.
// ----------------------------------------------------------------------------
const APP_DATEIEN = [
  './',
  './index.html',
  './config.js',
  './auth.js',
  './app.js',
  './foto-ort.js',
  './spot-form.js',
  './spot-detail.js',
  './suche.js',
  './intro.js',
  './offline.js',
  './wetter.js',
  './route.js',
  './teilen.js',
  './plus.js',
  './screens.js',
  // Die Verwaltung. Liegt für alle mit im Speicher — sie ist ohne
  // Admin-Recht ohnehin wirkungslos, und ein Nachladen unterwegs würde
  // offline scheitern.
  './admin.js',
  './oesterreich-maske.geojson',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png',
  './icon-maskable-512.png',
  './apple-touch-icon.png',
  'https://unpkg.com/maplibre-gl@5.6.0/dist/maplibre-gl.css',
  'https://unpkg.com/maplibre-gl@5.6.0/dist/maplibre-gl.js',
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.112.0/dist/umd/supabase.js',
];

// ============================================================================
// INSTALLIEREN
// ============================================================================

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_APP);

    // Einzeln statt addAll: Fällt eine Datei aus (etwa weil ein fremder Server
    // gerade hustet), soll nicht die ganze Installation scheitern. Lieber eine
    // Datei später aus dem Netz als eine App, die nie offline kann.
    await Promise.all(APP_DATEIEN.map(async (pfad) => {
      try {
        const antwort = await fetch(pfad, { cache: 'reload' });
        if (antwort.ok) await cache.put(pfad, antwort);
      } catch { /* kommt beim nächsten Aufruf aus dem Netz */ }
    }));

    // Nicht warten, bis alle Fenster geschlossen sind. Beim ersten Mal gibt es
    // ohnehin keine alte Fassung, die noch laufen könnte.
    await self.skipWaiting();
  })());
});

// ============================================================================
// ÜBERNEHMEN — und dabei die alten App-Speicher wegräumen
// ============================================================================

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const namen = await caches.keys();
    await Promise.all(namen.map((name) => {
      const veraltet = name.startsWith('wildspot-app-') && name !== CACHE_APP;
      return veraltet ? caches.delete(name) : null;
    }));
    await self.clients.claim();
  })());
});

// Die Seite kann sagen: "Übernimm sofort." Das passiert, wenn der Nutzer auf
// den Hinweis "Neue Fassung — antippen zum Aktualisieren" tippt.
self.addEventListener('message', (event) => {
  if (event.data === 'jetzt-uebernehmen') self.skipWaiting();
});

// ============================================================================
// JEDE ANFRAGE LÄUFT HIER DURCH
// ============================================================================

// Server, von denen die Kartenkacheln kommen.
const KARTEN_SERVER = [
  'mapsneu.wien.gv.at',      // basemap.at: Standard, Gelände, Satellit, Beschriftung
  'tile.opentopomap.org',    // Wanderkarte
  'a.tile.opentopomap.org',
  'b.tile.opentopomap.org',
  'c.tile.opentopomap.org',
  'basemaps.cartocdn.com',   // die weltweite Grundkarte
  'a.basemaps.cartocdn.com',
  'b.basemaps.cartocdn.com',
  'c.basemaps.cartocdn.com',
];

function istKarte(url) {
  return KARTEN_SERVER.some((server) => url.hostname === server ||
                                        url.hostname.endsWith('.' + server));
}

function istFoto(url) {
  return url.pathname.includes('/storage/v1/object/');
}

self.addEventListener('fetch', (event) => {
  const anfrage = event.request;

  // Nur Abrufe. Alles, was etwas verändert (anlegen, bewerten, hochladen),
  // geht unangetastet ins Netz.
  if (anfrage.method !== 'GET') return;

  const url = new URL(anfrage.url);

  // Anmeldung und Datenbank: niemals aufheben. Ein aufgehobener Anmeldestand
  // wäre ein Sicherheitsloch, aufgehobene Bewertungen wären falsch.
  if (url.pathname.startsWith('/auth/v1/') || url.pathname.startsWith('/rest/v1/')) {
    return;
  }

  // Das Aufrufen der Seite selbst: zuerst ins Netz (damit Änderungen ankommen),
  // bei Funkloch die aufgehobene Fassung.
  if (anfrage.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        return await fetch(anfrage);
      } catch {
        const cache = await caches.open(CACHE_APP);
        return (await cache.match('./index.html')) ||
               (await cache.match('./')) ||
               new Response('Keine Verbindung.', { status: 503 });
      }
    })());
    return;
  }

  if (istKarte(url)) {
    event.respondWith(ausSpeicherSonstNetz(anfrage, CACHE_KARTEN, MAX_KACHELN));
    return;
  }

  if (istFoto(url)) {
    event.respondWith(ausSpeicherSonstNetz(anfrage, CACHE_FOTOS, MAX_FOTOS));
    return;
  }

  // Die App-Dateien: aus dem Speicher, im Hintergrund still erneuern.
  event.respondWith((async () => {
    const cache = await caches.open(CACHE_APP);
    const gespeichert = await cache.match(anfrage);
    if (gespeichert) return gespeichert;

    try {
      const antwort = await fetch(anfrage);
      if (antwort.ok) cache.put(anfrage, antwort.clone());
      return antwort;
    } catch (err) {
      return new Response('Keine Verbindung.', { status: 503 });
    }
  })());
});

// ----------------------------------------------------------------------------
// Zuerst im Speicher nachsehen, sonst holen und aufheben.
//
// Für Kacheln und Fotos das Richtige: Beide ändern sich nicht mehr, sobald sie
// einmal da sind. Der Gang ins Netz wäre verschenkte Zeit und verschenktes
// Datenvolumen.
// ----------------------------------------------------------------------------
async function ausSpeicherSonstNetz(anfrage, cacheName, maximum) {
  const cache = await caches.open(cacheName);
  const gespeichert = await cache.match(anfrage);
  if (gespeichert) return gespeichert;

  try {
    const antwort = await fetch(anfrage);

    // "opaque" heißt: Der fremde Server hat die Antwort ohne Leseerlaubnis
    // geschickt. Anschauen können wir sie nicht, weiterreichen und aufheben
    // schon — für ein Kachelbild genügt das.
    if (antwort.ok || antwort.type === 'opaque') {
      await cache.put(anfrage, antwort.clone());
      aufraeumen(cacheName, maximum);
    }
    return antwort;
  } catch (err) {
    // Kein Netz und nichts im Speicher: eine leere, durchsichtige Kachel.
    // Besser ein Loch in der Karte als eine Fehlermeldung über dem Bild.
    return new Response(null, { status: 504 });
  }
}

// ----------------------------------------------------------------------------
// Aufräumen: Wird es zu viel, fliegt das Älteste zuerst raus.
//
// Der Browser gibt die Einträge in der Reihenfolge zurück, in der sie
// hineingekommen sind — mehr braucht es für diese Entscheidung nicht.
// ----------------------------------------------------------------------------
let raeumtGerade = false;

async function aufraeumen(cacheName, maximum) {
  if (raeumtGerade) return;
  raeumtGerade = true;

  try {
    const cache = await caches.open(cacheName);
    const eintraege = await cache.keys();
    const zuviel = eintraege.length - maximum;
    if (zuviel > 0) {
      await Promise.all(eintraege.slice(0, zuviel).map((e) => cache.delete(e)));
    }
  } catch { /* Aufräumen ist Kür, nicht Pflicht */ }

  raeumtGerade = false;
}
