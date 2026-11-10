# Wild Spot Redesign Schritt 1 – Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wild Spot bekommt den hellen Apple-Look (Entwurf B) mit gläserner schwebender Tableiste, neuer Startseite, Kartenansicht im Apple-Karten-Stil und animiertem Wegweiser – ohne eine Funktion zu verlieren.

**Architecture:** Kein Framework, kein Build. Der Look entsteht über neue CSS-Variablen auf `:root` / `[data-thema="nacht"]` in `web/index.html` plus gezielte Umbauten von Markup (Startseite, Kartenecken, Spot-Blatt). Die Wegweiser-Logik liegt als reine Funktionen in einer neuen Datei `web/wegweiser.js` (in Node testbar), die Animation und Kamera hängen sich an das vorhandene `route.js`.

**Tech Stack:** Vanilla JS (klassische `<script>`-Dateien), MapLibre GL 5.6, Supabase JS, Service Worker. Tests: `node --test` für reine Logik; Oberfläche über Playwright-MCP (hängt an Opera GX, Port 9223) gegen `node web/server.mjs` (Port 5173).

**Spec:** `docs/superpowers/specs/2026-11-10-wildspot-redesign-design.md`

## Global Constraints

- Keine neuen Abhängigkeiten, kein Build-Schritt, keine Schriften/Assets aus dem Netz (offline!). Schrift bleibt `system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`.
- Farben Tag: Grund `#f4f5f1`, Karten `#ffffff`, Text `#111511`, Nebentext `#5c6356`, Grün `#2f6b1f`, helles Grün `#e7ecdf`. Nacht: Grund `#0b0f0c`, Karten `#161c17`, Text `#f2f5ee`, aktives Grün `#9be07a`. Text-Kontrast ≥ 4,5:1.
- Radien: Hero 28 px, Karten/Kacheln 20–22 px, Chips/Knöpfe voll rund (999px); Touch-Ziele ≥ 44 px.
- Tableiste: schwebende Pille, 16 px links/rechts, 18 px über `env(safe-area-inset-bottom)`, Höhe 64 px, Milchglas mit `-webkit-backdrop-filter` + `backdrop-filter`.
- Keine erfundenen Inhalte; ohne `route_line` wird kein Weg gezeichnet.
- Kommentare im Code auf Deutsch, im Stil der Datei (Warum, nicht Was).
- Veröffentlichen nur mit `node scripts/veroeffentlichen.mjs "<Text>"`; vor jedem lokalen Test Service Worker abmelden + `caches` leeren.
- `prefers-reduced-motion: reduce` → keine Animationen (Wegweiser sofort komplett).
- Das Skript „ios-hoehe" (Klasse `ios-fix`, `--vp-fix`) am Ende von `index.html` bleibt funktionsfähig; die Messzeile bleibt drin, bis Ferdinands Geräte-Screenshot da ist.

## Review Focus

1. Spot ohne Route (kein `route_line`, kein Parkplatz) → Blatt zeigt „Anfahrt" statt „Weg zum Spot", es wird nichts animiert, keine Fehlermeldung in der Konsole.
2. Datenbank nicht erreichbar (heute der Fall) → Startseite zeigt saubere Leerzustände statt kaputter Karten oder Endlos-Platzhalter; Tableiste und Suche funktionieren.
3. Nachtmodus (`data-thema="nacht"`) → jede neue Fläche lesbar, Glas-Leiste dunkel, kein weißer Kasten.
4. Breiter Bildschirm (≥ 760 px) → Tableiste bleibt linke Spalte, Detail bleibt Seitenpanel, nichts überlappt.
5. Spot-Wechsel während die Wegweiser-Animation läuft → alte Animation bricht ab, keine zwei Linien, keine Ausnahme.

---

### Task 1: Design-Tokens und Grundbausteine

**Files:**
- Modify: `web/index.html` (`:root`-Block ab Z. ~60, Nacht-Block ab Z. ~170, `.abschnitt-titel`/`.gross-titel` Z. ~2943, `.chip`-, Knopf- und Kachel-Regeln)

**Interfaces:**
- Produces (CSS-Variablen, beide Themen): `--ws-grund`, `--ws-karte`, `--ws-text`, `--ws-text-neben`, `--ws-gruen`, `--ws-gruen-hell`, `--ws-gruen-aktiv` (Tag = `--ws-gruen`, Nacht = `#9be07a`), `--ws-glas` (Hintergrund der Glasflächen), `--ws-glas-rand`, `--ws-schatten-hero`, `--ws-schatten-karte`, `--ws-r-hero: 28px`, `--ws-r-karte: 22px`. Bestehende Variablen (`--bg`, `--text`, `--text-weak`, `--unterkante`, …) werden auf die neuen Werte umgebogen statt gelöscht, damit alte Bildschirme mitziehen.
- Produces (Klassen): `.ws-karte` (weiße/dunkle Karte, Radius 22), `.ws-kachel` (Info-Kachel 16 px Innenabstand), `.ws-knopf` (grün, voll rund, ≥ 44 px), `.ws-knopf.zweit` (helles Grün), `.ws-chip`.

- [ ] **Step 1: Prüfskript schreiben** `scripts/design-pruefen.md` (Checkliste für Playwright-MCP): lokale Seite in 390×844 öffnen, per `browser_evaluate` `getComputedStyle(document.body).backgroundColor` lesen. Erwartet Tag `rgb(244, 245, 241)`, nach `document.documentElement.dataset.thema='nacht'` `rgb(11, 15, 12)`.
- [ ] **Step 2: Prüfung laufen lassen** – erwartet heute FAIL (alte Farben).
- [ ] **Step 3: Tokens + Klassen in `web/index.html` umsetzen** (Werte aus Global Constraints; `--unterkante` = `--ws-grund`).
- [ ] **Step 4: Prüfung wiederholen** – PASS. Zusätzlich Screenshots von Entdecken, Merkliste, Plus, Profil, Spot-Blatt bei Tag und Nacht ansehen: nichts unlesbar.
- [ ] **Step 5: Commit** `git commit -m "Design: neue Farb- und Formvariablen (Look B)"`

### Task 2: Gläserne schwebende Tableiste

**Files:**
- Modify: `web/index.html` (`.tableiste` ab Z. ~2984, `--tab-h`/`--tab-inhalt`/`--tab-luft` Z. ~2928, Media-Query für breite Bildschirme Z. ~3102)

**Interfaces:**
- Consumes: `--ws-glas`, `--ws-glas-rand`, `--ws-gruen-aktiv` (Task 1)
- Produces: `--tab-h` = Platz, den Inhalte unten freihalten müssen = `64px + 18px + env(safe-area-inset-bottom)`; alle bestehenden Nutzer von `--tab-h` (`.unten`, `.detail`, `#schirm-plus` …) ziehen automatisch mit.

- [ ] **Step 1: Prüfung schreiben** (in `scripts/design-pruefen.md`): bei 390×844 `document.getElementById('tableiste').getBoundingClientRect()` → erwartet `left === 16`, `right === 374`, `height === 64`, `bottom === 844 - 18` (Browser ohne Safe-Area); `getComputedStyle(...).backdropFilter` enthält `blur`. Bei 1280×800 ist sie weiterhin die linke Spalte (bestehendes Verhalten, `left === 0`).
- [ ] **Step 2: Prüfung laufen lassen** – FAIL.
- [ ] **Step 3: Tableiste umbauen** (Pille, Radius 32, Glas Tag `rgba(255,255,255,.72)` / Nacht `rgba(22,30,24,.72)`, `blur(20px) saturate(1.6)`, aktiver Eintrag in `--ws-gruen-aktiv`; mit `ios-fix` bleibt sie über `body` positioniert – nichts Zusätzliches nötig, aber prüfen).
- [ ] **Step 4: Prüfung wiederholen** – PASS; Karte, Startseite und Merkliste scrollen sichtbar verschwommen unter der Leiste durch, letzter Listeneintrag bleibt über der Leiste erreichbar.
- [ ] **Step 5: Commit** `git commit -m "Design: Tableiste als schwebende Glas-Pille"`

### Task 3: Neue Startseite (Look B)

**Files:**
- Modify: `web/index.html` (`#schirm-entdecken` Z. ~7214–7570: Kopf, `#entdecken-suche`, neuer `#entdecken-hero`, neue Kacheln `#entdecken-kacheln`, Abschnitte), `web/screens.js` (`entdeckenFuellen()` Z. 832, `zahlenbandFuellen()` Z. 940, `kachel()` Z. 371), `web/heute.js` (liefert Nachttemperatur)

**Interfaces:**
- Consumes: `.ws-karte`, `.ws-kachel`, `.ws-knopf` (Task 1); vorhandene RPC `spots_entdecken`, `window.WILDSPOT_HEUTE`
- Produces: `heroKachel(spot) -> HTMLElement` in `screens.js` (Foto bildfüllend, Label „Heute empfohlen", Überschrift = Spot-Name, weißer Streifen unten mit Mini-Foto, Region · Höhe, Knopf „Ansehen" → `spotOeffnen(spot)`); `window.WILDSPOT_HEUTE.nachtWert -> {grad:number, spotName:string} | null` (Wert, den `heute.js` ohnehin errechnet).

Aufbau von oben: Kleinlabel mit Wochentag + Datum (de-AT, Großbuchstaben) · Titel „Entdecken" 34 px · Profil-Knopf (öffnet Bereich Profil) · Suchleiste (`#entdecken-suche`, voll rund, 50 px) · Reiter Spots/Feed/Aktivität/Leute als Segment-Leiste · Filter-Zeile (unverändert funktional) · Hero „Heute empfohlen" (= bisheriger Held: bester bewerteter, sonst neuester) · zwei Kacheln (Nachttemperatur aus `nachtWert` mit Spotname; Spot-Anzahl aus `zahlenbandFuellen`) · „Heute Nacht"-Block · Neu dazugekommen (horizontale Karten 168 px) · Am besten bewertet · Gipfel · Zahlenband.

- [ ] **Step 1: Prüfung schreiben** (`scripts/design-pruefen.md`): Entdecken öffnen, erwartet: `#entdecken-titel.textContent === 'Entdecken'`; Suchleiste über dem Hero (`suche.bottom < hero.top`); Hero-Höhe ≥ 380 px wenn ein Spot geladen ist; bei leerer DB zeigt `#entdecken-hero` den Leertext statt Platzhalter-Animation nach spätestens 8 s.
- [ ] **Step 2: Prüfung laufen lassen** – FAIL.
- [ ] **Step 3: Markup + `heroKachel()` + Kacheln umsetzen**; Leerzustand: Hero zeigt „Gerade keine Verbindung zur Spot-Datenbank" mit Knopf „Zur Karte", wenn beide RPCs Fehler liefern.
- [ ] **Step 4: Prüfung wiederholen** – PASS bei Tag und Nacht; Review Focus 2 (DB weg) einmal bewusst durchspielen.
- [ ] **Step 5: Commit** `git commit -m "Design: Startseite im Look B mit Hero und Kacheln"`

### Task 4: Kartenansicht im Apple-Karten-Stil

**Files:**
- Modify: `web/index.html` (`.ecke links/rechts` Z. ~6800/6931, `.suche` Z. ~6904, neue Chip-Zeile `#karte-chips`), `web/app.js` (Ebenen-Schalter: Funktion zum Umschalten einer Ebenen-Gruppe nach außen geben)

**Interfaces:**
- Consumes: Task 1 Tokens
- Produces: `window.WILDSPOT_EBENE_SETZEN(gruppe: 'spots'|'wasser'|'seen'|'unterstand', an: boolean)` und `window.WILDSPOT_EBENE_AN(gruppe) -> boolean` in `app.js`, nutzen exakt die vorhandenen Schalter (gleicher Zustand wie im Ebenen-Panel, gleiche Speicherung).

Oben: Suchfeld als weiße Pille (50 px, Schatten `0 8px 24px rgba(17,21,17,.16)`) + Ebenen-Knopf (50 px rund) daneben; darunter Chips „Spots", „Wasser", „Bergseen", „Hütten" (aktiv = dunkel gefüllt). Einstellungen-Knopf und Filter bleiben erreichbar (Filter als eigener Chip ganz links). Nacht: Pillen dunkel-glasig.

- [ ] **Step 1: Prüfung schreiben**: Karte öffnen, Chip „Wasser" antippen → `WILDSPOT_EBENE_AN('wasser')` wechselt und der Schalter im Ebenen-Panel zeigt denselben Zustand; Suchfeld-Pille `top ≥ env(safe-area-inset-top)+12`.
- [ ] **Step 2: Prüfung laufen lassen** – FAIL (Funktion fehlt).
- [ ] **Step 3: Umsetzen.**
- [ ] **Step 4: Prüfung wiederholen** – PASS; Ebenen-Panel, Filter, Einstellungen, „Spot hier anlegen", Standort-Knopf weiterhin erreichbar.
- [ ] **Step 5: Commit** `git commit -m "Design: Kartenansicht mit schwebender Suche und Ebenen-Chips"`

### Task 5: Spot-Blatt im Apple-Karten-Stil

**Files:**
- Modify: `web/spot-detail.js` (Kopf des Blatts + `hinkommenHtml()` Z. 1022), `web/index.html` (`.detail` mobil Z. ~2160, neue Klassen `.blatt-kopf`, `.blatt-kacheln`, `.blatt-aktionen`)

**Interfaces:**
- Consumes: `window.routeAnimieren(spot)` aus Task 6 (bis Task 6 fertig ist: Knopf ruft vorhandenes `insBildHolen` über `window.routeZeichnen` nicht auf – Task 5 darf den Knopf mit `typeof window.routeAnimieren === 'function'` absichern).
- Produces: `blattKopfHtml(spot) -> string` und `zustiegMinuten(spot) -> number|null` (= `spot.route_minutes`, sonst `spot.hike_minutes`, sonst `null`) in `spot-detail.js`.

Kopf: Greifbalken · Foto 64×64 (erstes Spot-Foto, sonst Zelt-Symbol) · Name (19 px, 800) · Lage (Region bzw. „Über der Baumgrenze") · drei Kacheln Höhe (`elevation_m` → „2 136 m"), Zustieg (`zustiegMinuten` → „4 h"/„45 min"), Nacht (Nachttemperatur aus `wetter.js`, solange unbekannt „–") · Aktionen: Hauptknopf grün „Weg zum Spot", wenn `route_line.length > 1`, sonst „Anfahrt" (Google-Maps-Link aus `hinkommenHtml`) · Merken-Knopf rund. Komoot bleibt als kleiner Link im Hinkommen-Abschnitt. Restlicher Detail-Inhalt unverändert darunter.

- [ ] **Step 1: Test schreiben** `tests/spot-detail-hilfen.test.cjs` (node:test, lädt die Hilfsfunktionen): `zustiegMinuten({route_minutes: 240, hike_minutes: 200}) === 240`; `zustiegMinuten({hike_minutes: 45}) === 45`; `zustiegMinuten({}) === null`. Dafür die zwei reinen Hilfen in `web/blatt-hilfen.js` (UMD-Muster wie Task 6) auslagern.
- [ ] **Step 2: `node --test tests/` laufen lassen** – FAIL.
- [ ] **Step 3: Hilfen + Blatt-Kopf umsetzen**, `blatt-hilfen.js` in `index.html` vor `spot-detail.js` einbinden und in `sw.js` in die Offline-Liste aufnehmen.
- [ ] **Step 4: Test PASS; Prüfung im Browser**: Spot mit Route → Knopf „Weg zum Spot"; Spot ohne Route → „Anfahrt" öffnet Google Maps (Review Focus 1).
- [ ] **Step 5: Commit** `git commit -m "Design: Spot-Blatt mit Kacheln und Hauptknopf"`

### Task 6: Animierter Wegweiser

**Files:**
- Create: `web/wegweiser.js`, `tests/wegweiser.test.cjs`
- Modify: `web/route.js` (Farben Z. 40/65–105, neue `window.routeAnimieren`), `web/index.html` (Script-Tag vor `route.js`, Chip-Stil `.weg-chip`), `web/sw.js` (Offline-Liste)

**Interfaces:**
- Produces in `wegweiser.js` (UMD: `module.exports` in Node, sonst `window.WILDSPOT_WEGWEISER`):
  - `streckenLaengen(coords: [lng,lat][]) -> number[]` – kumulierte Meter (Haversine), erstes Element 0.
  - `teilLinie(coords, anteil: number) -> [lng,lat][]` – Linie vom Start bis zum Anteil 0…1 der Gesamtlänge, letzter Punkt linear zwischen zwei Stützpunkten interpoliert; `anteil<=0` → `[coords[0]]`, `anteil>=1` → alle Punkte.
  - `sanft(t: number) -> number` – ease-in-out (`t<.5 ? 4t³ : 1-(-2t+2)³/2`).
- Produces in `route.js`: `window.routeAnimieren(spot) -> void` – holt die Route ins Bild (vorhandenes `insBildHolen`), wartet `moveend`, lässt die Linie in 1500 ms (`sanft`) per `requestAnimationFrame` wachsen (`teilLinie` → `setData`), setzt danach den Chip „Gehzeit · Höhenmeter · Strecke" (vorhandene `dauer()`/`strecke()`); bricht ab, wenn `routeZeichnen`/`routeAusblenden` für einen anderen Spot gerufen wird; ohne `route_line` tut es nichts; bei `prefers-reduced-motion` sofort komplett.
- Farben: Linie `#2f7d25` (Nacht `#7bd35c`), Saum weiß 85 % statt schwarz; Parkplatz als HTML-Marker (`maplibregl.Marker`) mit „P" (kein Glyphen-Server nötig), Ziel bleibt das vorhandene Zelt-Symbol.

- [ ] **Step 1: Tests schreiben** `tests/wegweiser.test.cjs`:
  - `streckenLaengen([[15,47],[15,47.001]])[1]` ≈ 111,2 (±0,5)
  - `teilLinie(L, 0).length === 1`, `teilLinie(L, 1)` deepEqual `L`
  - `teilLinie([[0,0],[0,0.002]], 0.5)` letzter Punkt ≈ `[0, 0.001]` (±1e-6)
  - `sanft(0) === 0`, `sanft(1) === 1`, `sanft(0.5) === 0.5`
- [ ] **Step 2: `node --test tests/` laufen lassen** – FAIL (Datei fehlt).
- [ ] **Step 3: `wegweiser.js` umsetzen.**
- [ ] **Step 4: Tests PASS.**
- [ ] **Step 5: `routeAnimieren` in `route.js` umsetzen und an den Knopf aus Task 5 hängen**; Browser-Prüfung: Spot mit Route öffnen → Linie still da; „Weg zum Spot" → Kamera fährt, Linie wächst sichtbar (Screenshots bei 0,3 s / 0,8 s / 1,6 s zeigen kurz/halb/voll), Chip erscheint; während der Animation anderen Spot öffnen → keine zweite Linie, keine Konsolenfehler (Review Focus 5).
- [ ] **Step 6: Commit** `git commit -m "Wegweiser: Route wächst animiert vom Parkplatz zum Spot"`

### Task 7: Prüfdurchgang, Veröffentlichen

**Files:**
- Modify: nach Befund (`web/index.html` für Korrekturen alter Bildschirme)

- [ ] **Step 1: Alle Bildschirme durchgehen** bei 390×844 und 1280×800, je Tag und Nacht: Entdecken (alle vier Reiter), Karte inkl. Ebenen-Panel und Filter, Spot-Blatt, Merkliste, Plus, Profil, Anmelden, Spot eintragen, Verwaltung (Dienstkonto aus `.env.local`). Erwartet: alles lesbar, nichts überlappt die Tableiste, keine Konsolenfehler (`browser_console_messages`).
- [ ] **Step 2: Gefundenes beheben, erneut prüfen.**
- [ ] **Step 3: `node --test tests/`** – alle PASS.
- [ ] **Step 4: Commit + `node scripts/veroeffentlichen.mjs "Redesign Schritt 1: Look B, Glas-Leiste, Startseite, Karte, Wegweiser"`**; warten bis `https://fermasster0-rgb.github.io/wild-spot/` die neue Fassung ausliefert (curl auf ein neues Merkmal, z. B. `wegweiser.js`).
- [ ] **Step 5: Ferdinand bitten, am iPhone neu zu laden** (bei geänderter Statusleiste: neu zum Home-Bildschirm hinzufügen); Messzeile von „ios-hoehe" erst entfernen, wenn sein Screenshot die Höhe bestätigt.
