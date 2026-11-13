# Wild Spot Feinschliff Karte & Startseite – Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Spot antippen zoomt die Karte hin und öffnet ein halbes, hochziehbares Fenster; die Startseite wird Karussell + Kategorie-Reihen; die App startet immer auf „Entdecken".

**Architecture:** Kein Framework, kein Build. Reine Rechenlogik (Kategorien, Karussell-Auswahl, Startbereich, Einrast-Stufe, Kartenversatz) kommt als testbare UMD-Funktionen in `web/blatt-hilfen.js` (erweitert) und `web/start-hilfen.js` (neu); Oberfläche wird in `web/index.html` (Markup + CSS), `web/spot-detail.js`, `web/screens.js`, `web/app.js` umgebaut. Daten der Startseite kommen aus der vorhandenen RPC `spots_entdecken` (liefert schon `has_lake`, `above_treeline`, `hike_minutes`, `elevation_m`, `foto_pfad`, `created_at`).

**Tech Stack:** Vanilla JS (klassische `<script>`-Dateien), MapLibre GL 5.6, Supabase JS, Service Worker. Tests: `node --test tests/` für reine Logik; Oberfläche über Playwright-MCP (Opera GX, CDP-Port 9223) gegen `node web/server.mjs` (Port 5173).

**Spec:** `docs/superpowers/specs/2026-11-13-wildspot-feinschliff-design.md` · Vorschau: https://claude.ai/artifact/PuGnvmgCqEcbvsCRE5R3tA

## Global Constraints

- Keine neuen Abhängigkeiten, keine DB-Migration, keine neue RPC, kein Build-Schritt, keine Assets aus dem Netz.
- Halbstufe nur auf der Karte am Handy (≤ 760 px). Über Startseite/Suche/Merkliste öffnet das Fenster in der Vollstufe. PC (≥ 761 px) bleibt Seitenleiste ohne Stufen.
- Tableiste rutscht weg, solange am Handy ein Spot-Fenster offen ist, und kommt beim Schließen zurück.
- Start = „Entdecken" bei Neustart und nach ≥ 30 min im Hintergrund; offline (`navigator.onLine === false` oder Startseiten-Abfrage scheitert) → „karte". `?los=` und geteilte Spot-Links (`teilen.js`) behalten Vorrang.
- Kategorie-Reihen nur mit Foto und nur ab 3 Spots, max. 10 je Reihe; Karussell 4–5 Spots ohne Doppelte, Wechsel alle 4000 ms, Pause 6000 ms nach eigenem Wischen, keine Automatik bei `prefers-reduced-motion` oder wenn die Startseite nicht sichtbar ist.
- Community (Reiter Feed/Aktivität/Leute) und Gipfel-Reihe, Kacheln, „Heute Nacht", Ausklapp-Artikel: ausblenden, nicht löschen (Markup bleibt, `hidden`/nicht mehr aufgerufen). Kommentare am Spot bleiben.
- Keine erfundenen Zahlen/Texte; Titel/Etiketten nur aus echten Eigenschaften.
- Kommentare im Code auf Deutsch, im Stil der Datei (Warum, nicht Was).
- Lokal testen: vor jedem Browser-Test Service Worker abmelden + `caches` leeren. Veröffentlichen nur mit `node scripts/veroeffentlichen.mjs "<Text ohne Umlaute>"`, danach live prüfen.
- iOS: `-webkit-backdrop-filter` mitschreiben; Mechanismus `ios-fix`/`--vp-fix` am Ende von `index.html` nicht anfassen.

## Review Focus

1. Schnell nacheinander zwei Spots auf der Karte antippen → Inhalt und Pin gehören zum zweiten, Karte fliegt zum zweiten, Stufe bleibt halb, kein zweiter Pin bleibt liegen.
2. Im ausgeklappten Fenster nach oben scrollen und zurück → schließt nicht; erst wenn der Inhalt ganz oben steht, zieht ein Zug nach unten das Fenster auf halb.
3. Datenbank nicht erreichbar / offline beim Start → App startet auf der Karte; öffnet man trotzdem „Entdecken", steht dort der vorhandene Leertext mit „Zur Karte", keine leeren Reihen, kein Karussell-Timer.
4. Nachtmodus (`data-thema="nacht"`) → Karussell-Streifen, Reihenkarten, „Gut zu wissen", Blatt in beiden Stufen lesbar.
5. Fenster schließen auf jede Art (×, Wegwischen, Bereich wechseln, Escape) → Tableiste ist wieder da, Pin weg, Route weg.

---

### Task 1: Reine Hilfen (Stufen, Versatz, Kategorien, Karussell, Startbereich)

**Files:**
- Modify: `web/blatt-hilfen.js` (neue Funktionen in den Rückgabewert aufnehmen)
- Create: `web/start-hilfen.js` (gleiches UMD-Muster wie `blatt-hilfen.js`, im Browser `window.WILDSPOT_START`)
- Modify: `web/index.html` (`<script src="start-hilfen.js">` vor `screens.js`), `web/sw.js` (Datei in die Offline-Liste)
- Test: `tests/spot-detail-hilfen.test.cjs` (erweitern), `tests/start-hilfen.test.cjs` (neu)

**Interfaces:**
- Produces (`WILDSPOT_BLATT`):
  - `stufeNachZug({ von: 'halb'|'voll', weg: number, tempo: number, halbHoehe: number }) -> 'halb'|'voll'|'zu'` — `weg` in px (positiv = nach unten), `tempo` in px/ms (positiv = nach unten), `halbHoehe` = Weg von voll bis halb in px.
  - `spotVersatzY({ hoehe: number, obenFrei: number, blattOben: number }) -> number` — MapLibre-`offset[1]` in px, damit der Spot in der Mitte zwischen `obenFrei` (Unterkante Such-/Chipleiste) und `blattOben` (Oberkante Halbstufe) steht.
  - `zielZoom(aktuell: number) -> number` — `Math.max(aktuell, 14)`.
- Produces (`WILDSPOT_START`):
  - `kategorienBauen(spots: Spot[], ohneIds: string[]) -> Array<{ key: string, titel: string, spots: Spot[] }>` (Spot = Zeile aus `spots_entdecken`).
  - `karussellWaehlen(held: Spot|null, kategorien) -> Array<{ spot: Spot, etikett: string }>`
  - `startBereich({ los: string|null, bereiche: string[], online: boolean, versteckt: number|null, jetzt: number }) -> string|null` — gibt den Bereich zurück oder `null` = „nichts ändern" (Rückkehr nach < 30 min).

- [ ] **Step 1: Failing tests schreiben**

```js
// tests/spot-detail-hilfen.test.cjs (ergänzen)
test('stufeNachZug: Schnipser nach oben aus halb → voll', () => {
  assert.equal(H.stufeNachZug({ von: 'halb', weg: -30, tempo: -0.8, halbHoehe: 330 }), 'voll');
});
test('stufeNachZug: weit nach unten aus halb → zu', () => {
  assert.equal(H.stufeNachZug({ von: 'halb', weg: 120, tempo: 0.1, halbHoehe: 330 }), 'zu');
});
test('stufeNachZug: Schnipser nach unten aus voll → halb', () => {
  assert.equal(H.stufeNachZug({ von: 'voll', weg: 60, tempo: 0.9, halbHoehe: 330 }), 'halb');
});
test('stufeNachZug: langsam bis über die Mitte aus voll → halb, davor → voll', () => {
  assert.equal(H.stufeNachZug({ von: 'voll', weg: 200, tempo: 0.1, halbHoehe: 330 }), 'halb');
  assert.equal(H.stufeNachZug({ von: 'voll', weg: 100, tempo: 0.1, halbHoehe: 330 }), 'voll');
});
test('stufeNachZug: kleiner Zug bleibt auf der Stufe', () => {
  assert.equal(H.stufeNachZug({ von: 'halb', weg: 40, tempo: 0.2, halbHoehe: 330 }), 'halb');
});
test('spotVersatzY zielt auf die Mitte des freien Kartenstücks', () => {
  // Bildschirm 844 hoch, oben frei ab 110, Blatt beginnt bei 444 → Ziel 277, Mitte 422 → -145
  assert.equal(H.spotVersatzY({ hoehe: 844, obenFrei: 110, blattOben: 444 }), -145);
});
test('zielZoom zoomt nie heraus', () => {
  assert.equal(H.zielZoom(8), 14);
  assert.equal(H.zielZoom(16.5), 16.5);
});
```

```js
// tests/start-hilfen.test.cjs (neu)
const S = require('../web/start-hilfen.js');
const spot = (id, o = {}) => ({ id, name: 'S' + id, foto_pfad: 'p/' + id, created_at: '2026-01-0' + (id % 9 + 1), ...o });
test('kategorienBauen: Bergseen nur mit has_lake und Foto, ab 3 Spots', () => {
  const k = S.kategorienBauen([spot(1, { has_lake: true }), spot(2, { has_lake: true }), spot(3, { has_lake: true, foto_pfad: null })], []);
  assert.equal(k.find((x) => x.key === 'see'), undefined);
});
test('kategorienBauen: Hoch oben sortiert nach Höhe absteigend', () => {
  const k = S.kategorienBauen([1, 2, 3].map((i) => spot(i, { above_treeline: true, elevation_m: i * 1000 })), []);
  assert.deepEqual(k.find((x) => x.key === 'hoch').spots.map((s) => s.id), [3, 2, 1]);
});
test('kategorienBauen: ohne langen Zustieg heißt hike_minutes 0..30, null zählt nicht', () => {
  const k = S.kategorienBauen([spot(1, { hike_minutes: 0 }), spot(2, { hike_minutes: 30 }), spot(3, { hike_minutes: 10 }), spot(4, { hike_minutes: 31 }), spot(5, { hike_minutes: null })], []);
  assert.deepEqual(k.find((x) => x.key === 'kurz').spots.map((s) => s.id).sort(), [1, 2, 3]);
});
test('kategorienBauen: max. 10 je Reihe, ohneIds fehlen', () => {
  const viele = Array.from({ length: 14 }, (_, i) => spot(i + 1));
  const neu = S.kategorienBauen(viele, [1]).find((x) => x.key === 'neu');
  assert.equal(neu.spots.length, 10);
  assert.ok(!neu.spots.some((s) => s.id === 1));
});
test('kategorienBauen: Reihenfolge see, hoch, kurz, neu', () => {
  const alle = Array.from({ length: 6 }, (_, i) => spot(i + 1, { has_lake: true, above_treeline: true, hike_minutes: 5 }));
  assert.deepEqual(S.kategorienBauen(alle, []).map((k) => k.key), ['see', 'hoch', 'kurz', 'neu']);
});
test('karussellWaehlen: Held zuerst, keine Doppelten, höchstens 5', () => {
  const alle = Array.from({ length: 12 }, (_, i) => spot(i + 1, { has_lake: true, above_treeline: true, hike_minutes: 5 }));
  const k = S.karussellWaehlen(alle[0], S.kategorienBauen(alle, [alle[0].id]));
  assert.equal(k[0].spot.id, 1);
  assert.equal(new Set(k.map((x) => x.spot.id)).size, k.length);
  assert.ok(k.length >= 2 && k.length <= 5);
});
test('karussellWaehlen: Held ohne Foto wird übersprungen', () => {
  assert.equal(S.karussellWaehlen(spot(1, { foto_pfad: null }), []).length, 0);
});
const B = ['karte', 'entdecken', 'merken', 'plus', 'profil'];
test('startBereich: Neustart online → entdecken', () => {
  assert.equal(S.startBereich({ los: null, bereiche: B, online: true, versteckt: null, jetzt: 0 }), 'entdecken');
});
test('startBereich: offline → karte', () => {
  assert.equal(S.startBereich({ los: null, bereiche: B, online: false, versteckt: null, jetzt: 0 }), 'karte');
});
test('startBereich: ?los=merken gewinnt', () => {
  assert.equal(S.startBereich({ los: 'merken', bereiche: B, online: true, versteckt: null, jetzt: 0 }), 'merken');
});
test('startBereich: Rückkehr nach 29 min → null, nach 30 min → entdecken', () => {
  assert.equal(S.startBereich({ los: null, bereiche: B, online: true, versteckt: 0, jetzt: 29 * 60000 }), null);
  assert.equal(S.startBereich({ los: null, bereiche: B, online: true, versteckt: 0, jetzt: 30 * 60000 }), 'entdecken');
});
```

- [ ] **Step 2: Tests laufen lassen** — `node --test tests/` → FAIL (Funktionen fehlen).
- [ ] **Step 3: Funktionen umsetzen.** Regeln, die die Tests nicht ganz festlegen:
  - `stufeNachZug`: Schnipser-Schwelle `|tempo| > 0.5`; aus `halb`: `weg > 90` → `zu`, `weg < -60` → `voll`; aus `voll`: `weg > halbHoehe / 2` → `halb`. Schnipser nach unten aus `halb` → `zu`.
  - `spotVersatzY`: `Math.round((obenFrei + blattOben) / 2 - hoehe / 2)`.
  - Kategorie-Titel exakt: `see` „Bergseen zum Übernachten", `hoch` „Hoch oben", `kurz` „Ohne langen Zustieg", `neu` „Neu dazugekommen" (neu = `created_at` absteigend). Alle Kategorien filtern `foto_pfad` und `ohneIds`.
  - Karussell-Etiketten: Held „HEUTE EMPFOHLEN", dann aus see/hoch/kurz/neu je der erste noch nicht gewählte Spot mit „AM WASSER", „HOCH HINAUS", „SCHNELL DA", „NEU".
  - `startBereich`: `los` nur, wenn in `bereiche`; Rückkehr (`versteckt !== null`) unter 30 min → `null`.
- [ ] **Step 4: Tests laufen lassen** — `node --test tests/` → alle PASS (auch die bestehenden).
- [ ] **Step 5: Commit** — `git add web/blatt-hilfen.js web/start-hilfen.js web/index.html web/sw.js tests/ && git commit -m "Hilfen: Blatt-Stufen, Kartenversatz, Kategorien, Karussell, Startbereich"`

### Task 2: Start immer auf „Entdecken"

**Files:**
- Modify: `web/screens.js` (Startblock am Dateiende, `let anfang = 'karte'` ~Z. 2035–2048; neuer `visibilitychange`-Hörer)

**Interfaces:**
- Consumes: `WILDSPOT_START.startBereich` (Task 1), vorhandenes `bereichZeigen(name, opts)`, `BEREICHE`, `window.spotDetailSchliessen`.

- [ ] **Step 1: Prüfung schreiben** in `scripts/feinschliff-pruefen.md` (Playwright-Checkliste, 390×844): (a) frisch laden → `WILDSPOT_BEREICH_JETZT() === 'entdecken'`; (b) `?los=merken` → `'merken'`; (c) mit `context.setOffline(true)` neu laden (Seite aus SW-Cache) → `'karte'`; (d) geteilter Spot-Link (`?spot=<id>` laut `teilen.js`) → Karte + Blatt offen.
- [ ] **Step 2: Prüfung laufen lassen** — (a) FAIL (heute `'karte'`).
- [ ] **Step 3: Umsetzen.** Startblock nutzt `startBereich({ los, bereiche: BEREICHE, online: navigator.onLine, versteckt: null, jetzt: Date.now() })`; Kommentar „Wo es losgeht" auf den neuen Grund umschreiben. `visibilitychange`: beim Verstecken `Date.now()` merken; beim Zurückkommen `startBereich(... versteckt ...)` — Ergebnis ≠ `null` → Blatt schließen + `bereichZeigen(ergebnis, { merken: false })`. Scheitert die Startseiten-Abfrage beim allerersten Füllen (beide RPC-Fehler, siehe `entdeckenFuellen`), einmalig `bereichZeigen('karte')`, aber nur, wenn der Nutzer seit dem Start noch nichts angetippt hat.
- [ ] **Step 4: Prüfung wiederholen** — (a)–(d) PASS.
- [ ] **Step 5: Commit** — `git commit -m "Start: immer Entdecken, offline Karte, nach 30 min Hintergrund zurück"`

### Task 3: Spot-Fenster mit Halb- und Vollstufe

**Files:**
- Modify: `web/index.html` (Handy-CSS `.detail` ~Z. 2572–2620 und ~Z. 5752–5757; neue Klassen; Tableiste-Ausblenden), `web/spot-detail.js` (Abschnitt 2b Wischen ~Z. 200–330, `spotDetailOeffnen` ~Z. 463, `zeichnen` Reihenfolge ~Z. 690–750, „Auf der Karte anzeigen" ~Z. 1167)

**Interfaces:**
- Consumes: `WILDSPOT_BLATT.stufeNachZug` (Task 1)
- Produces: `window.spotBlattStufe(stufe: 'halb'|'voll')` und Klassen am `#detail`: `stufe-halb` | `stufe-voll`; `body.detail-offen` bleibt der Schalter für „Fenster offen". Task 4 ruft `spotBlattStufe('halb')` nach „Auf der Karte anzeigen".

Verhalten (Handy):
- `#detail` am Handy: `top: calc(env(safe-area-inset-top) + 8px); bottom: 0; max-height: none`; Lage über `transform: translateY(var(--blatt-weg))`; `stufe-voll` → `0`, `stufe-halb` → so weit unten, dass ≈ 46 % der Höhe sichtbar sind (`--blatt-halb: calc(100dvh * .54 - env(safe-area-inset-top) - 8px)`). Übergang `transform .45s cubic-bezier(.2,.85,.25,1)`.
- `stufe-halb`: `.detail-koerper { overflow: hidden }`; `stufe-voll`: scrollt.
- Öffnen auf der Karte → `stufe-halb`; über einem Bereich (`!aufDerKarte()`) → `stufe-voll`. Wechsel zu einem anderen Spot behält die aktuelle Stufe.
- Am Handy: `body.detail-offen .tableiste { transform: translateY(calc(100% + 40px)); opacity: 0; pointer-events: none }` mit Übergang; der Schleier `body.bereich-offen.detail-offen::after` reicht dann bis `bottom: 0`. Bisherige Regeln `.detail { bottom: var(--tab-h) }` / `max-height: calc(76dvh - var(--tab-h))` für ≤ 760 px entfernen.
- Wischen: der vorhandene Touch-Code wird zur Zwei-Stufen-Geste — Zug nach oben ist jetzt erlaubt (aus `halb`), `transform` folgt dem Finger (nach oben gedeckelt bei Vollstufe), beim Loslassen entscheidet `stufeNachZug(... halbHoehe = gemessene Differenz ...)`; `'zu'` → bestehendes `detailWegwischen()`. Aus dem Inhalt heraus nur, wenn `stufe-voll` und `scrollTop === 0` (wie heute), oder immer in `stufe-halb`. Tippen auf den Griff wechselt halb ↔ voll.
- Reihenfolge in `zeichnen`: `blattOberteilHtml` (Kacheln + Hauptknopf) zuerst, dann die Galerie als horizontaler Fotostreifen (`.galerie` am Handy: `display:flex; overflow-x:auto; scroll-snap`, Fotos 200×150, Radius 14, erstes Foto nicht mehr voll breit), dann die übrigen Knöpfe und Blöcke wie bisher. Kopf: Name + eine Zeile aus `kopfzeileSetzen` (Koordinatenzahl bleibt dort, wie heute).
- PC (≥ 761 px): keine Stufenklassen-Wirkung, keine Tableisten-Änderung, Wischen aus wie heute.

- [ ] **Step 1: Prüfung schreiben** (`scripts/feinschliff-pruefen.md`, 390×844): auf der Karte einen Spot antippen → `#detail` hat `stufe-halb`, `getBoundingClientRect().top` zwischen 400 und 500, `.tableiste` unsichtbar (`opacity === '0'`); Griff antippen → `stufe-voll`, `top < 60`; Griff erneut → `stufe-halb`; × → Tableiste wieder `opacity === '1'`. Von „Entdecken" eine Karte antippen → direkt `stufe-voll`. Bei 1280×800: Seitenleiste wie vorher (`width` ≈ 400, Tableiste sichtbar).
- [ ] **Step 2: Prüfung laufen lassen** — FAIL.
- [ ] **Step 3: CSS + Gesten + Reihenfolge umsetzen** wie oben.
- [ ] **Step 4: Prüfung wiederholen** — PASS; zusätzlich per Touch-Emulation (`page.touchscreen` bzw. `dispatchEvent` TouchEvent) Zug nach oben/unten am Griff und Review-Focus 2 (Inhalt scrollen schließt nicht) durchspielen; Screenshots Tag/Nacht in beiden Stufen ansehen.
- [ ] **Step 5: Commit** — `git commit -m "Spot-Fenster: Halb- und Vollstufe, Leiste weg solange offen"`

### Task 4: Karte zoomt zum Spot, Pin markiert ihn

**Files:**
- Modify: `web/spot-detail.js` (`freilegen()` ~Z. 570 ersetzen, Aufruf in `spotDetailOeffnen`, „Auf der Karte anzeigen" ~Z. 1167, `detailSchliessen`), `web/index.html` (CSS `.spot-pin`)

**Interfaces:**
- Consumes: `WILDSPOT_BLATT.spotVersatzY`, `zielZoom` (Task 1); `window.spotBlattStufe` (Task 3); globales `karte` (MapLibre).
- Produces: `zumSpotFliegen(lat: number, lng: number): void` und `pinSetzen(lat, lng) / pinWeg()` in `spot-detail.js`.

- `zumSpotFliegen`: Handy → `karte.flyTo({ center, zoom: zielZoom(karte.getZoom()), offset: [0, spotVersatzY({ hoehe: innerHeight, obenFrei: Unterkante von .karte-chips (sonst .suche), blattOben: innerHeight * 0.54 })], duration: 800, essential: true })`; PC → wie heute mit `offset: [-200, 0]` plus Zoom. Nur aufrufen, wenn `aufDerKarte()`; bei `prefers-reduced-motion` `jumpTo` mit denselben Werten.
- Pin: ein `maplibregl.Marker` mit eigenem Element (grüner Kreis 40 px, weißer Rand, Zelt-Symbol, Spitze unten, `anchor: 'bottom'`, kurzes Aufploppen per CSS, Nachtmodus gleich lesbar). Genau ein Pin gleichzeitig; `pinWeg()` in `detailSchliessen`.
- „Auf der Karte anzeigen": Bereich wechseln wie heute, dann `spotBlattStufe('halb')`, `zumSpotFliegen`, `pinSetzen`.

- [ ] **Step 1: Prüfung schreiben** (`scripts/feinschliff-pruefen.md`): Spot antippen, 1 s warten → `karte.getZoom() >= 14`; projizierter Punkt `karte.project([lng, lat])` hat `y` zwischen Chip-Unterkante und `0.54 * innerHeight`, `x` ≈ `innerWidth/2 ± 4`; genau ein `.spot-pin` im DOM. Zweiten Spot antippen → weiterhin genau ein Pin, an der neuen Stelle (Review Focus 1). Schließen → kein `.spot-pin`.
- [ ] **Step 2: Prüfung laufen lassen** — FAIL.
- [ ] **Step 3: Umsetzen** wie oben; `freilegen()` entfällt (alle Aufrufer auf `zumSpotFliegen`).
- [ ] **Step 4: Prüfung wiederholen** — PASS; Wegweiser-Knopf („Weg zum Spot") bei einem Spot mit Route fährt danach wie bisher auf die Route.
- [ ] **Step 5: Commit** — `git commit -m "Karte: zum Spot fliegen und Pin setzen beim Antippen"`

### Task 5: Neue Startseite (Karussell + Reihen + Gut zu wissen)

**Files:**
- Modify: `web/index.html` (`#schirm-entdecken` ~Z. 7628–8010: neue Container, alte Blöcke `hidden`; CSS für `.ws-karussell`, `.ws-reihe`, `.ws-reihenkarte`, `.ws-wissen`), `web/screens.js` (`entdeckenFuellen()` ~Z. 897, `heroKachel()` ~Z. 404 wiederverwenden, Lese-Knöpfe ~Z. 1161)

**Interfaces:**
- Consumes: `WILDSPOT_START.kategorienBauen`, `karussellWaehlen` (Task 1); RPC `spots_entdecken`; vorhandene `heroKachel`, `kachel`, `spotOeffnen`, `nahLaden`, `merkenUmschalten`, `bildHtml`, `faktenHtml`.
- Produces: `karussellStarten(el: HTMLElement): void` / `karussellAnhalten(): void` in `screens.js` (Timer-Steuerung; `bereichZeigen` ruft Anhalten beim Verlassen von „entdecken", Starten beim Betreten).

Aufbau von oben: Kopf (wie heute) · Suche (`#entdecken-suche`, Treffer-Block wie heute) · `#entdecken-karussell` · Punkte · Reihen in der Reihenfolge see, hoch, „Gut zu wissen", kurz, neu, „In deiner Nähe" (vorhandenes `nahLaden`, als Reihe), „Am besten bewertet" (ab 3, als Reihe) · Schlusssatz „Kennst du einen Platz? Auf der Karte auf + Spot hier anlegen tippen."

- Daten: `Promise.all([spots_entdecken({ sortierung: 'neu', anzahl: 500 }), spots_entdecken({ sortierung: 'best', anzahl: 10 })])`; Held wie heute (bester bewerteter, sonst neuester); `kategorienBauen(neu.data, [held.id])`; `karussellWaehlen(held, kategorien)`. Beide Fehler → vorhandener Leertext mit „Zur Karte" statt Karussell, keine Reihen, kein Timer.
- Karussell: Karten = `heroKachel(spot, etikett)` (Breite `calc(100vw - 36px)`, Höhe 360 px, Radius 26), `scroll-snap` horizontal; Punkte unter dem Karussell; Timer 4000 ms → nächste Karte per `scrollTo({ behavior: 'smooth' })`, nach der letzten zurück zur ersten; `pointerdown`/`touchstart`/`wheel` setzen Pause 6000 ms; kein Timer bei `prefers-reduced-motion`, bei `document.hidden` oder außerhalb von „entdecken".
- Reihenkarte: 168 px breit, Foto 168×120, Radius 16, Name max. 2 Zeilen, darunter „Höhe · Zustieg" (vorhandenes `faktenHtml`), Merken-Herz auf dem Foto; Reihe `overflow-x:auto; scroll-snap-type:x mandatory; scroll-padding:18px`. Reihenkopf: Titel 20 px/800, kein „Alle"-Link (einfachster Weg ohne tote Links; die Spec lässt ihn optional).
- „Gut zu wissen": drei Karten (Etikett + Titel aus den vorhandenen `.lesekarte`-Texten); Antippen öffnet den Inhalt von `#lesen-<art>` in einer Vollbild-Lesefläche (eigenes Element `#lesen-blatt` mit Schließen-Knopf, Escape schließt), statt aufzuklappen.
- Ausblenden: `#entdecken-kacheln`, `#entdecken-reiter`, Filter-Knopf + `#entdecken-chips`, `#entdecken-heute-block`, `#entdecken-gipfel-block`, die alte `.lesekarte`-Liste, Zahlenband. `entdeckenFuellen` ruft `WILDSPOT_GIPFEL.entdeckenFuellen()` und `WILDSPOT_HEUTE.fuellen()` nicht mehr auf.

- [ ] **Step 1: Prüfung schreiben** (`scripts/feinschliff-pruefen.md`, 390×844, DB erreichbar): `#entdecken-karussell` hat 4–5 Karten; nach 4,5 s ist `scrollLeft > 0`; mindestens 3 `.ws-reihe` mit je ≥ 3 Karten; `#entdecken-reiter`, `#entdecken-heute-block`, `#entdecken-gipfel-block` sind `hidden`/nicht sichtbar; Reihenkarte antippen → Blatt `stufe-voll`; „Gut zu wissen"-Karte antippen → `#lesen-blatt` sichtbar, × schließt. Mit blockierter Supabase-Adresse (`page.route('**/rest/v1/rpc/**', r => r.abort())`): Leertext sichtbar, keine `.ws-reihe`, Karussell-Timer läuft nicht.
- [ ] **Step 2: Prüfung laufen lassen** — FAIL.
- [ ] **Step 3: Markup, CSS (Tag + Nacht über die vorhandenen `--ws-*`-Variablen) und `entdeckenFuellen` umsetzen.**
- [ ] **Step 4: Prüfung wiederholen** — PASS; Screenshots Tag/Nacht ansehen; Suche liefert weiter Treffer.
- [ ] **Step 5: Commit** — `git commit -m "Startseite: rotierendes Karussell, Kategorie-Reihen, Gut zu wissen"`

### Task 6: Community ausblenden, Feinschliff, Abschluss und Veröffentlichen

**Files:**
- Modify: `web/index.html`, `web/screens.js`, `web/feed.js`, `web/leute.js` (nur Einstiege), `scripts/feinschliff-pruefen.md`

- Community: alle sichtbaren Einstiege, die nur in Feed/Aktivität/Leute führen (z. B. Folgen-Knöpfe, Personenprofil-Öffner, Zahl „Leute" im Profil, „Von hier erzählen" im Spot-Blatt, falls es nur in den Feed schreibt) per `hidden` oder Nicht-Aufrufen ausblenden; Kommentare/Berichte am Spot bleiben. Dateien bleiben geladen, damit nichts anderes bricht. Builder prüft per `grep` nach `WILDSPOT_BEITRAG`, `personOeffnen`/Leute-Aufrufen, welche Einstiege es gibt, und listet sie im Commit-Text.
- Feinschliff Karte: Ebenen-Knopf, Suche, Einstellungen und Chips gleiche Höhe (42–44 px) und gleicher Schatten; Chip-Reihe horizontal scrollbar mit weichem Ausblenden am rechten Rand statt hartem Abschneiden.
- [ ] **Step 1: Gesamte Prüfliste** `scripts/feinschliff-pruefen.md` einmal komplett laufen lassen (Tag + Nacht, 390×844 und 1280×800) und `node --test tests/` — alles PASS. Review Focus 1–5 einzeln abhaken.
- [ ] **Step 2: Commit** — `git commit -m "Community ausgeblendet, Kartenkopf angeglichen"`
- [ ] **Step 3: Veröffentlichen** — `node scripts/veroeffentlichen.mjs "Feinschliff: Spot-Fenster mit Zoom, neue Startseite, Start auf Entdecken"`; nach 1–2 min `https://fermasster0-rgb.github.io/wild-spot/` im Playwright-Tab (390×844, SW abgemeldet) öffnen: startet auf Entdecken, Karussell dreht sich, Spot auf der Karte öffnet halb mit Zoom. Neue `sw.js`-Fassung ist live (`fetch('sw.js')` enthält die hochgezählte Nummer).
