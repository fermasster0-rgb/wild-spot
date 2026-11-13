# Wild Spot – Feinschliff Karte & Startseite

Stand: 2026-11-13 · Mit Ferdinand im Gespräch entschieden. Antippbare Vorschau (echte Spots/Fotos):
https://claude.ai/artifact/PuGnvmgCqEcbvsCRE5R3tA (Abschnitt 1 = Spot-Fenster, Abschnitt 2 „Deine Wahl" = Startseite)

## Warum

Nach dem Redesign vom 2026-11-10 (siehe `2026-11-10-wildspot-redesign-design.md`) wirken einige
Stellen noch nicht wie eine professionelle App. Ferdinand stört konkret:

- **Spot auf der Karte antippen:** Das Fenster ist zu groß (heute ~¾ des Bildschirms), die Karte
  zoomt nicht zum Spot, man sieht nicht mehr, wo der Spot liegt.
- **Startseite:** Die Ausklapp-Texte unten („Bevor du losziehst") „fühlt er gar nicht". Er will
  mehr Spots sehen, in Reihen nach Kategorien untereinander, die man nach rechts wischt.
- **Start der App:** Sie öffnet heute auf der Karte, er will immer zuerst die Startseite.

Maßstab: fühlt sich an wie Apple Karten / App Store. Ferdinand hat beide Teile der Vorschau
gesehen und gesagt: „gefällt mir beides sehr gut", „so wie es da ist passt es".

## Entscheidungen von Ferdinand

1. **Spot-Fenster (Handy):** Antippen eines Spots → die Karte zoomt gleichzeitig zum Spot, der Spot
   steht danach **mittig in der oberen Hälfte** (im sichtbaren Kartenbereich über dem Fenster).
   Das Fenster öffnet sich von unten und bleibt zuerst in der **unteren Hälfte** mit nur dem
   Wichtigsten für den ersten Blick. **Hochziehen** zeigt alles; nach unten ziehen schließt.
2. **Startseite:** ganz oben ein **großes Fenster, das alle paar Sekunden von selbst nach rechts
   weiterwischt** (Karussell, rotiert durch). Darunter **Reihen mit mittelgroßen Karten**, die man
   seitwärts scrollt, eine Reihe pro Kategorie (Vorschau „Deine Wahl").
3. **Raus von der Startseite:** die Ausklapp-Artikel in ihrer heutigen Form, die zwei Kacheln
   (Nachttemperatur, Spot-Anzahl), „Heute Nacht", „Gipfel sammeln" und die Reiter
   Spots/Feed/Aktivität/Leute. Auf die Rückfrage, dass damit die **Community-Ecke (Feed,
   Aktivität, Leute) aus der App verschwindet**: „Dann lass das mal weg."
4. **Start immer auf der Startseite** („Entdecken"), egal wo man zuletzt war.

## Vom Planer entschieden (Ferdinand kann kippen)

- **Untere Leiste:** Solange ein Spot-Fenster offen ist, rutscht die Glas-Tableiste nach unten weg
  und kommt beim Schließen zurück (stand als Annahme in der Vorschau, kein Einwand).
- **Ratgeber-Texte** („Wo Wildcampen erlaubt ist", „Warum die Nacht kälter wird", „Keine Spuren")
  bleiben als eigene Reihe **„Gut zu wissen"** mit kleinen Karten; Antippen öffnet den Text als
  eigene Fläche (Blatt/Vollbild) statt aufzuklappen. Inhalt unverändert. (Stand so in der Vorschau.)
- **Community & Gipfel werden ausgeblendet, nicht gelöscht:** HTML/JS bleiben im Code (z. B. per
  `hidden` bzw. nicht mehr aufgerufen), damit sie später ohne Neubau zurückkommen können. Nichts
  an Datenbank oder Tabellen ändern. Wo die Community sonst noch sichtbar auftaucht (z. B.
  Profil-Links „Folgen", Personen-Profile aus Kommentaren, Zahl „Leute"), entscheidet der Builder:
  Einstiege, die nur in den Feed führen, ebenfalls ausblenden; Kommentare/Berichte am Spot bleiben.
- **Suche bleibt** oben auf der Startseite und zeigt Treffer wie heute (`#entdecken-treffer-block`).
  Filter-Knopf und Filter-Chips verschwinden von der Startseite; Filtern geht weiter auf der Karte.
- **Kategorien-Reihen** (nur echte Spot-Eigenschaften, Reihe nur zeigen, wenn ≥ 3 Spots drin):
  „Bergseen zum Übernachten" (`has_lake`), „Hoch oben" (`above_treeline`, höchste zuerst),
  „Ohne langen Zustieg" (`hike_minutes` ≤ 30), „Neu dazugekommen" (neueste), dazu die bestehenden
  „In deiner Nähe" (nur mit Standort, wie heute) und „Am besten bewertet" (ab 3 bewerteten, als
  Reihe statt Liste). Reihenfolge und genaue Titel darf der Builder anpassen. Pro Reihe max. ~10
  Karten, „Alle"-Link rechts → öffnet die Trefferliste/Karte mit passendem Filter, falls einfach
  machbar; sonst Link weglassen (kein toter Link).
- **Karussell:** 4–5 Karten; erste = heutiger „Heute empfohlen"-Spot (bestbewertet, sonst neuester,
  vorhandene Logik), danach je ein Spot aus den Kategorien mit Etikett (z. B. „HOCH HINAUS",
  „NEU", „AM WASSER"). Keine Doppelten zwischen Karussell-Karten. Wechsel alle 4 s, sanftes
  Gleiten; Punkte darunter zeigen die Position. Selbst wischen geht immer und pausiert die
  Automatik für ~6 s. Läuft nur, solange die Startseite sichtbar ist. Bei
  `prefers-reduced-motion` keine Automatik.

### Nach der Prüfung entschieden (Planer, Ferdinand kann kippen)

- **Spot von der Startseite / Suche / Merkliste öffnen:** Dort gibt es keine Karte, die oben
  sichtbar bleiben müsste. Deshalb öffnet das Fenster dort **gleich in der Vollstufe** über der
  Seite (wie eine Detailseite bei Airbnb), Tableiste rutscht weg. Der vorhandene Knopf „Auf der
  Karte anzeigen" wechselt zur Karte, zoomt zum Spot und stellt das Fenster auf die Halbstufe.
  Halbstufe + Zoom gelten also nur auf der Karte. Schließen kehrt zur Seite zurück, von der man kam.
- **Was „Start" heißt:** echter Neustart der App **und** Rückkehr aus dem Hintergrund nach
  mindestens 30 Minuten → Entdecken (offenes Blatt schließen). Kurzes Wechseln in eine andere App
  lässt alles, wie es war.
- **Ohne Netz:** Ist beim Start keine Verbindung da (`navigator.onLine === false` oder die
  Startseiten-Abfrage scheitert), startet die App auf der Karte wie bisher, damit offline
  gespeicherte Gebiete sofort nutzbar sind.
- **Spots ohne Foto** erscheinen nicht in Karussell und Reihen (155 von 162 Spots haben eines).

## Ziele

- Spot antippen fühlt sich an wie Apple Karten: Zoom + halbes Fenster, Spot bleibt sichtbar.
- Startseite zeigt auf einen Blick viele echte Spots, ruhig und hochwertig.
- App öffnet immer auf der Startseite.

## Nicht-Ziele

- Keine neuen Datenquellen, kein Backend-Umbau, keine DB-Änderung, kein Framework, kein Build-Schritt.
- Merkliste, Plus, Profil, Formulare, Verwaltung werden nicht umgestaltet.
- Inhalt des ausgeklappten Spot-Fensters wird nicht neu erfunden – vorhandene Bausteine
  (Fotos, Beschreibung, Attribute, Wetter, Wegweiser, Kommentare, Komoot, Teilen, Merken …)
  werden nur neu geordnet.

## Anti-Ziele

- Eine Spot-Funktion geht verloren (Merken, Teilen, Anfahrt/Weg zum Spot + Wegweiser-Animation,
  Wetter, Fotos groß ansehen, Kommentare schreiben, Spot bearbeiten, Plus-Inhalte, Offline).
  Ausnahme: Community und Gipfel, wie oben entschieden.
- Das Fenster springt, ruckelt oder lässt sich nicht mehr wegwischen; Scrollen im ausgeklappten
  Fenster schließt es versehentlich.
- Karte zoomt bei jedem Antippen wild heraus/herein oder der Spot landet unter dem Fenster.
- Tableiste bleibt nach dem Schließen verschwunden oder ist auf dem iPhone abgeschnitten.
- Erfundene Inhalte oder Zahlen. Leere Reihen oder Reihen mit 1–2 Spots.
- Nachtmodus unlesbar.

## Rahmenbedingungen

- Code: `web/index.html` (gesamtes CSS, Themen `tag`/`nacht`), `web/app.js` (MapLibre `karte`,
  Spot-Klick ab ~Z. 1890–1980), `web/spot-detail.js` (Spot-Blatt; `freilegen()` ~Z. 570, Wischen
  zum Schließen Abschnitt 2b ~Z. 200), `web/screens.js` (Bereiche/Tableiste, `entdeckenFuellen()`
  ~Z. 897, Startbereich `anfang = 'karte'` ~Z. 2035), `web/feed.js`, `web/leute.js`,
  `web/gipfel.js`, `web/heute.js`, `web/route.js`/`web/wegweiser.js`.
- Startseiten-Daten heute über RPC `spots_entdecken` (sortierung `neu`/`best`). Für die Kategorien
  braucht es eine zusätzliche Abfrage auf `spots` + `spot_photos` (die Karte lädt nur den
  sichtbaren Ausschnitt über `spots_in_bbox`, ohne Fotos) – keine neue RPC/Migration. Private
  Spots (`privat = true`) nie zeigen.
- **Start:** `?los=`-Kurzbefehle aus dem Manifest gelten weiter; ein geteilter Spot-Link öffnet
  weiter Karte + Fenster (`teilen.js`). Nur der Normalstart wird „Entdecken".
- **PC (≥ 760 px):** Das Detail bleibt Seitenleiste rechts, keine Halbstufe. Der Zoom zum Spot gilt
  auch dort, mit Versatz, damit der Spot nicht unter der Leiste liegt.
- Wegweiser: Öffnet der Spot eine Route, darf die Kamera beim Antippen trotzdem zuerst zum Spot
  fahren; „Weg zum Spot" fährt dann wie heute auf die Route.
- PWA/Offline: Service Worker `web/sw.js`. Lokal testen über `node web/server.mjs` (Port 5173),
  vorher Service Worker abmelden + Caches löschen. Veröffentlichen nur mit
  `node scripts/veroeffentlichen.mjs "<Text ohne Umlaute>"`, danach live prüfen.
- iOS-26-Fallen aus dem Dokument vom 2026-11-10 gelten weiter (Tableiste, `ios-fix`, `-webkit-backdrop-filter`).

## Gestaltung im Detail

**Spot-Fenster, Handy (Vorschau Abschnitt 1):**
- Halbstufe: sichtbare Höhe ≈ 45–50 % des Bildschirms. Inhalt oben nach unten: Griff · Name (22 px,
  800) mit Merken- und Schließen-Knopf rechts · eine kurze Zeile aus echten Eigenschaften
  (z. B. „Bergsee · über der Baumgrenze") · drei Kacheln (Höhe, Zustieg, Nacht-Temperatur wie
  heute) · Aktionsreihe: grüner Hauptknopf (Weg zum Spot bzw. Anfahrt, Logik wie heute) + kleine
  quadratische Nebenknöpfe (Teilen, ggf. Wetter) · darunter beginnt der Fotostreifen
  (horizontal wischbar), der am unteren Rand angeschnitten hervorschaut.
- Vollstufe: Fenster bis knapp unter die Statusleiste; Inhalt scrollt. Danach alles Weitere
  (Beschreibung, Attribute als ruhige Liste, Wetter, Kommentare, Bearbeiten, Komoot …).
- Gesten: Griff/Kopf ziehen; schneller Schnipser nach oben → voll, nach unten → halb bzw. zu;
  Loslassen rastet auf die nächste Stufe; aus der Halbstufe weit nach unten → zu. Antippen des
  Griffs wechselt halb ↔ voll. Im ausgeklappten Inhalt gilt die bestehende Regel: nur wenn ganz
  oben gescrollt, zieht der Inhalt das Fenster mit.
- In der Halbstufe scrollt der Inhalt nicht (erst hochziehen).
- Karte: gleichzeitig mit dem Öffnen `flyTo`/`easeTo` auf den Spot, Zoom mind. ~13–14 (nie
  herauszoomen, wenn schon näher), Versatz so, dass der Spot in der Mitte des freien Bereichs
  zwischen oberer Such-/Chipleiste und Fensterkante steht. Dauer ~0,7–0,9 s, sanftes Ausrollen.
  Ausgewählter Spot sichtbar hervorgehoben (größerer grüner Pin o. ä.), solange das Fenster offen ist.
- Anderen Spot antippen bei offenem Fenster → Inhalt wechselt, Karte fliegt zum neuen Spot,
  Stufe bleibt halb.

**Startseite (Vorschau „Deine Wahl"):**
- Kopf wie heute (Datum klein, „Entdecken" groß, Profilknopf) · Suchleiste · Karussell
  (Kartenbreite = Bildschirm minus Ränder, Höhe ≈ 360 px, Radius 26, Etikett + Überschrift oben im
  Bild, weißer Info-Streifen unten mit Mini-Foto, Name, Höhe · Zustieg, „Ansehen") · Punkte ·
  Kategorie-Reihen: Titel 19–20 px/800 links, „Alle" rechts; Karten ≈ 168 px breit, Foto ≈ 168×120,
  Radius 16, Name (2 Zeilen max.) und „Höhe · Zustieg" darunter; Merken-Herz auf dem Foto wie
  heute bei Kacheln. Reihe scrollt mit Snap, Rand links bündig zum Text.
- „Gut zu wissen" als Reihe kleiner Textkarten (Etikett + Titel).
- Kein Zahlenband/Fußtext nötig; der kurze Satz „Kennst du einen Platz? Auf der Karte auf
  + Spot hier anlegen tippen" darf als Abschluss bleiben.
- Tippen auf Karussell- oder Reihenkarte öffnet den Spot im Fenster (Vollstufe, siehe oben).

**Sonstiger Feinschliff (klein halten):** gleiche Ränder (16–18 px) und Radien auf Startseite und
Karte; keine halb abgeschnittenen Chips unter der Tableiste; Kartenkopf (Suche, Ebenen,
Einstellungen, Chips) auf eine Höhe und Schattenstärke angleichen. Nichts darüber hinaus.

## Dem Builder überlassen

- Komponenten-Struktur, Benennung, wie viel altes CSS ersetzt oder überschrieben wird.
- Genaue Stufen-Höhen, Federkurven, Zoomstufe, Etiketten-Texte im Karussell.
- Wie die Kategorie-Daten geholt werden (innerhalb der Rahmenbedingungen).
- Darstellung von „Gut zu wissen"-Texten (Blatt oder Vollbild).

## Erfolg

- Ferdinand tippt am iPhone einen Spot an: Karte zoomt hin, halbes Fenster, Spot oben mittig
  sichtbar; Hochziehen zeigt alles; Wegwischen schließt, Leiste kommt zurück.
- Startseite: Karussell dreht sich, darunter mehrere volle Reihen echter Spots; keine Ausklapp-Texte.
- App öffnet nach dem Schließen immer auf „Entdecken".
- Alle Spot-Funktionen funktionieren wie vorher, Tag und Nacht.
