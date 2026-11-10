# Wild Spot – Redesign „Next Level" (Schritt 1)

Stand: 2026-11-10 · Entschieden mit Ferdinand im Gespräch, Entwürfe:
https://claude.ai/artifact/RjtdoRQLkXzUy1er9c9iyH (A Nachthimmel · B Hell & klar · C Karte zuerst)

## Warum

Wild Spot (PWA, `web/`, online unter fermasster0-rgb.github.io/wild-spot) wurde seit Monaten nicht
angefasst. Ferdinand findet sie „nicht wirklich ansprechend". Ziel: Design auf das Niveau großer
Apps heben – „UI wie Apple, wie ein Riesenunternehmen", einladend, mit echten Naturfotos und
weicher Bewegung (Maßstab: sein Wild-Spot-Werbevideo und das Apple-Morphing-Rezept). Die App soll
beim ersten Öffnen das Gefühl geben: „die will ich behalten".

## Entscheidungen von Ferdinand

1. **Grundlook = Entwurf B „Hell & klar"** (wie die Heute-Seite im App Store): heller ruhiger Grund,
   große echte Spot-Fotos in großen runden Karten mit Überschrift im Bild, fette enge Überschriften,
   viel Luft, kleine weiße Info-Kacheln (z. B. Nachttemperatur, Spot-Anzahl). Grün (#2f6b1f-Familie)
   nur sparsam für Knöpfe, aktive Zustände, Zelt.
2. **Von Entwurf A:** die **untere Leiste als schwebende Glas-Pille** (Milchglas, Inhalt scheint
   verschwommen durch, abgerundet, Abstand zu den Rändern, wie iOS 26) und die **Suchleiste ganz oben**
   auf der Startseite („Ort, Berg oder See").
3. **Von Entwurf C: die Kartenansicht** – Karte bildschirmfüllend, oben schwebend Suche +
   Ebenen-Knopf + Filter-Chips (Spots, Wasser, Bergseen, Hütten); Tippen auf einen Spot öffnet ein
   **Blatt von unten wie Apple Karten**: Foto, Name, Region/Lage, drei Kacheln (Höhe, Zustieg,
   Nachttemperatur), Knopf „Weg zum Spot" (grün) und Merken.
4. **Neue Funktion: animierter Wegweiser** (Idee 3). Der echte Fußweg Parkplatz → Spot zeichnet sich
   auf der Karte animiert (Linie „wächst" vom Parkplatz zum Zelt, wie im Werbevideo), dazu Gehzeit
   und Höhenmeter. Ausgelöst über „Weg zum Spot" bzw. beim Öffnen eines Spots mit Route.
5. Die anderen Ideen (Morph-Übergänge Karte→Detail, „Heute Nacht" mit Mondphase, Vollbild-Fotos mit
   Ken-Burns, Morph-Start) kommen **später**, nicht in diesem Schritt.
6. Vorgehen in zwei Schritten (siehe Umfang), damit früh etwas Sichtbares da ist.
7. **Statusleiste:** soll hell sein, aber im Nachtmodus nicht hell über der dunklen App. Umgesetzt
   (online seit 2026-11-10): die Angabe `apple-mobile-web-app-status-bar-style` ist ganz entfernt –
   laut Apple (WebKit-Bug 317153) nimmt die Statusleiste dann die Seitenfarbe an. Das Zu-lang-Melden
   ohne die Angabe (WebKit-Bug 316008) gleicht das Skript „ios-hoehe" aus. Gerätetest steht aus.

## Vom Planer entschieden (nach der Prüfung, Ferdinand kann kippen)

- **„Weg zum Spot":** Beim Öffnen eines Spots wird die Route wie heute still gezeichnet, ohne
  Kamerasprung. Erst der grüne Knopf „Weg zum Spot" fährt die Kamera auf die Route und startet die
  Wachs-Animation. Ohne berechnete Route wird der Hauptknopf zu „Anfahrt" (Google Maps, vorhandener
  Link); Komoot bleibt als kleiner Nebenlink.
- **Veröffentlichen:** Schritt 1 geht wie üblich sofort online. Dafür gehört zu Schritt 1 ein
  Prüfdurchgang: alle noch nicht umgestalteten Bildschirme (Merkliste, Plus, Profil, Detail-Inhalt,
  Formulare, Verwaltung) müssen mit den neuen Tokens bei Tag und Nacht ordentlich aussehen und
  funktionieren.
- Karten-Filter-Chips sind Abkürzungen für die vorhandenen Ebenen-Schalter; das volle Ebenen-Panel
  bleibt. Kachel „Zustieg" = berechnete Routenzeit, sonst die beim Spot gespeicherte Gehzeit. Am PC
  darf die Tableiste eine linke Spalte bleiben.

## Umfang

**Schritt 1 (dieses Dokument):**
- Neues Grundgerüst des Looks: Farb-/Schrift-/Radius-/Schatten-Tokens als CSS-Variablen, Karten-,
  Chip-, Knopf- und Kachel-Stile, gläserne schwebende Tableiste.
- Neue **Startseite** (`#schirm-entdecken`) im Stil B mit Suchleiste oben.
- Neue **Kartenansicht** (Ecken/Suche/Filter über `#karte`) im Stil C, Spot-Blatt im Apple-Karten-Stil
  (auf dem Handy; die bestehende `.detail`-Fläche ist dort schon ein Blatt von unten – neu gestalten,
  nicht neu erfinden).
- Animierter Wegweiser.

**Schritt 2 (später, eigenes Dokument):** Spot-Detail-Inhalt, Merkliste, Plus, Profil, Anmelden,
„Spot eintragen", Verwaltung im neuen Look.

## Ziele

- Erster Eindruck einladend: Startseite beginnt mit einem großen echten Spot-Foto, nicht mit Formularen.
- Wirkt wie eine native Apple-App: ruhig, hochwertig, konsistente Abstände/Radien, weiche Bewegungen.
- Karte „wie Apple Karten" inklusive Wegweiser.

## Nicht-Ziele

- Keine neuen Datenquellen, keine neuen Backend-Funktionen, kein Framework, kein Build-Schritt
  (die Dateien in `web/` sind die App – bleibt so).
- Keine Änderung an Datenbank, Auth, Offline-Logik, Plus-Logik, Verwaltung in Schritt 1.
- Kein Umbau der Inhalte/Texte außer wo das neue Layout es braucht.

## Anti-Ziele (wäre ein Fehlschlag, auch wenn es technisch läuft)

- Eine Funktion geht verloren oder ist nicht mehr erreichbar (Filter, Ebenen, Wasserstellen, Wetter,
  Offline-Karten, Anmeldung, Spot eintragen, Verwaltung, Merkliste, Plus).
- Die untere Leiste verschwindet oder ist auf dem iPhone abgeschnitten (am 2026-11-10 passiert, siehe
  „Bekannte Fallen").
- Erfundene Inhalte: keine Fake-Bewertungen, keine geratenen Wege, Zahlen nur aus echten Daten.
- Der Wegweiser zeigt einen geschätzten/geratenen Weg. Ohne echte Route (kein Parkplatz eingetragen)
  wird **kein** Weg gezeichnet.
- Nachtmodus kaputt oder unlesbar.

## Rahmenbedingungen

- Code-Basis: `web/index.html` (≈8 000 Zeilen, enthält das gesamte CSS mit Themen `tag`/`nacht` über
  CSS-Variablen auf `:root` bzw. `[data-thema="nacht"]`), `web/app.js` (MapLibre-Karte `karte`,
  Ebenen, Filter), `web/screens.js` (Startseite/Merkliste/Plus/Profil, Tableiste), `web/route.js`
  (zeichnet die vorberechnete Route aus der Datenbank; Linienfarbe heute `#e2603c`),
  `web/spot-detail.js` (Spot-Blatt), `web/wetter.js`, `web/heute.js` („Heute Nacht"-Karte).
- Routen werden NICHT im Browser gerechnet (Schlüssel bleibt geheim): `scripts/routen-rechnen.mjs`
  schreibt Linie, Gehzeit, Strecke, Höhenmeter in die Datenbank. Der Wegweiser animiert nur diese Daten.
- Muss offline weiter funktionieren (Service Worker `web/sw.js`, Fassung wird beim Veröffentlichen
  hochgezählt). Keine Schriften/Assets aus dem Netz, die offline fehlen würden – Systemschrift
  (`system-ui, -apple-system, …`) beibehalten; das passt auch zum Apple-Look (SF auf dem iPhone).
- Veröffentlichen nur mit `node scripts/veroeffentlichen.mjs "<Text>"` (ein Push auf main reicht nicht).
- Lokal testen: `node web/server.mjs` (Port 5173), vorher Service Worker abmelden und Caches löschen.
- Die Supabase-Datenbank ist am 2026-11-10 **pausiert** (Pooler: „tenant not found"). Bis Ferdinand
  sie mit „Restore project" aufweckt, lädt keine Spot-Liste – Gestaltung zuerst mit dem leeren bzw.
  mit festen Testdaten prüfen, mit echten Daten nachprüfen, sobald sie wieder läuft.
- Zielgerät: vor allem iPhone (iOS 26) als installierte App, daneben Browser am Handy und PC.
  Darstellung muss auch am PC (breiter Bildschirm) ordentlich bleiben – Detail ist dort heute ein
  Seitenpanel (≥ 760 px), das bleibt erlaubt.

## Bekannte Fallen (iOS 26, installierte App)

- Mit `apple-mobile-web-app-status-bar-style="black-translucent"` legt iOS 26 oben einen Schleier über
  die Seite und lässt unten einen schwarzen Streifen, den die Seite nicht füllen kann; mit `black`
  rutschte die Tableiste unter den Rand. Aktuell online: keine Statusleisten-Angabe + Skript
  „ios-hoehe" am Ende von `index.html`, das die Seite um das zu viel Gemeldete kürzt (Klasse
  `ios-fix`, Variable `--vp-fix`, Messzeile 12 s – vor dem Abschluss wieder entfernen). **Ergebnis auf
  dem Gerät steht noch aus.** Die schwebende Tableiste muss mit diesem Mechanismus zusammenspielen
  (fixed relativ zu `body`, wenn `ios-fix` aktiv) und darf nie unter den Rand rutschen.
- Statusleisten-Änderungen wirken erst nach Neu-Hinzufügen zum Home-Bildschirm.
- `backdrop-filter` (Glas) braucht auf iOS die `-webkit-`-Variante.

## Gestaltung im Detail (verbindlich, wo genannt)

- **Farben Tag:** Grund `#f4f5f1`, Karten `#ffffff`, Text `#111511`, Nebentext `#5c6356`, Grün
  `#2f6b1f` (aktiv/Knöpfe), helles Grün `#e7ecdf` (sekundäre Knöpfe), Schatten weich
  (`0 20px 44px rgba(17,21,17,.18)` für Hero, sehr leicht für Kacheln). Kontrast ≥ 4,5:1 für Text.
- **Farben Nacht:** gleiche Struktur, dunkel: Grund ≈ `#0b0f0c`, Karten ≈ `#161c17`, Text `#f2f5ee`,
  Grün hell `#9be07a` für aktive Elemente (Richtung Entwurf A).
- **Schrift:** Systemschrift; Titel 800, eng (−0,03 em), Startseiten-Titel 34 px, Abschnittstitel
  20–21 px, Kleinlabel 12–13 px Großbuchstaben mit Laufweite.
- **Formen:** Hero-Karte Radius 28, Karten/Kacheln 20–22, Chips/Knöpfe voll rund, Touch-Ziele ≥ 44 px.
- **Tableiste:** schwebende Pille, links/rechts 16 px, unten 18 px über dem sicheren Bereich, Höhe ≈ 64,
  Radius voll, Milchglas (`backdrop-filter: blur(…) saturate(…)` + halbtransparenter Grund, Tag hell /
  Nacht dunkel), fünf Einträge wie heute (Entdecken, Karte, Merkliste, Plus, Profil), aktiv in Grün.
  Inhalte darunter laufen bis an den Rand und halten sich mit Padding frei (wie heute `--tab-h`).
- **Startseite:** Kopf mit Datum-Label + Titel „Entdecken" + Profil-Knopf; Suchleiste (vorhandene
  Suche weiterverwenden); große Hero-Karte „Heute empfohlen" mit echtem Spot-Foto, Überschrift im
  Bild und weißem Info-Streifen unten (Mini-Foto, Name, Region · Höhe, „Ansehen"); darunter zwei
  Kacheln (Nachttemperatur am nächsten/empfohlenen Spot aus `heute.js`/`wetter.js`; Anzahl Spots);
  darunter Abschnitte mit horizontal wischbaren Spot-Karten (z. B. „Über der Baumgrenze", „Bergseen
  zum Übernachten") aus vorhandenen Spot-Eigenschaften. Bestehende Startseiten-Inhalte (Reiter
  Spots/Feed/Aktivität/Leute, Filter-Chips, „Heute Nacht", „Spot der Woche") bleiben erreichbar und
  werden in den neuen Aufbau einsortiert (Builder entscheidet Reihenfolge, nichts streichen).
- **Kartenansicht:** Suche + Ebenen-Knopf oben als schwebende weiße Pillen, Filter-Chips darunter,
  „Spot hier anlegen"/Standort-Knopf schwebend; Spot-Blatt wie in Entwurf C.
- **Wegweiser:** Linie „wächst" in ≈ 1,2–1,8 s vom Parkplatz zum Spot (ease-in-out), Parkplatz-Symbol
  „P" am Start, Zelt am Ziel, danach Chip mit Gehzeit · Höhenmeter (· Strecke). Kamera fährt vorher
  sanft auf die Route (fitBounds mit Platz fürs Blatt). Linienfarbe passend zum neuen Look (Grün mit
  weißem Saum statt Rotorange – Builder prüft Lesbarkeit auf allen Grundkarten). Bei
  `prefers-reduced-motion` ohne Animation sofort komplett zeichnen.
- **Bewegung allgemein:** Ankünfte mit leichtem Nachfedern, Abgänge kürzer, keine Dauer-Animationen;
  `prefers-reduced-motion` respektieren (gibt es im Code schon).

## Dem Builder überlassen

- Genaue Komponenten-Struktur, Benennung, wie viel vom alten CSS ersetzt vs. überschrieben wird.
- Welche Spot-Eigenschaften die Abschnitte auf der Startseite speisen und welcher Spot „Heute
  empfohlen" ist (z. B. vorhandene Logik „Spot der Woche"/„Heute Nacht" wiederverwenden).
- Umsetzung der Linien-Animation (z. B. schrittweise wachsende GeoJSON-Linie oder `line-gradient`
  mit `line-progress`).
- PC-Darstellung im Detail, solange sie ordentlich bleibt.

## Erfolg

- Ferdinand öffnet die App am iPhone und sagt, sie sieht aus „wie von einem großen Unternehmen".
- Alle bisherigen Funktionen sind erreichbar, Tableiste immer sichtbar, Nachtmodus lesbar.
- Bei einem Spot mit Route zeichnet sich der Weg animiert mit echten Werten.
