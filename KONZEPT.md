# Wild Spot — Konzept

Eine App für Wildcampen-Spots in Österreich. Nutzer legen Plätze an, bewerten sie
und sehen auf der Karte, wo Wasser ist.

**Stand:** 2026-08-15 · **Version:** V1, in Benutzung

---

## 1. Wofür das gut ist

Der Kern-Nutzen, in einem Satz: **Du siehst auf einer Karte Österreichs, wo andere
schon gut geschlafen haben — und ob es dort Wasser gibt.**

Alles, was nicht auf diesen Satz einzahlt, ist V2 (siehe Abschnitt 7).

Zielgruppe V1: Ferdinand und Freunde. Kein Play Store, keine Öffentlichkeit,
keine AGB. Das kommt erst, wenn die App wirklich benutzt wird.

---

## 2. Die 5 Bildschirme

Seit dem 2026-08-15 hat die App **eine Leiste unten mit fünf Bereichen**, wie
man es von Komoot, Strava oder AllTrails kennt. Vorher war sie eine Karte mit
Knöpfen an den Rändern — richtig für eine Karte, aber es gab keinen Ort für
die Frage *davor*: Wo könnte ich überhaupt hin?

| # | Bereich | Was drauf ist |
|---|---------|---------------|
| 1 | **Entdecken** (Start) | Spots als große Bildkacheln: Spot der Woche, neu dazugekommen, in deiner Nähe, Bestenliste. Dazu Filterchips und drei Artikel (Recht, Kälte, keine Spuren) |
| 2 | **Karte** | Wie bisher: Spots als Zeichen, Wasser und Hütten als Ebenen, Position, Ebenenwahl, Spot anlegen |
| 3 | **Merkliste** | Gemerkte Spots (Herz), eigene Spots, was offline gespeichert ist |
| 4 | **Plus** | Der bezahlte Teil — siehe Abschnitt 10 |
| 5 | **Profil** | Konto, Zahlen, Tag/Nacht, Einstellungen, Verwaltung (nur Admins) |

Dazu die beiden Ansichten, die sich über alles legen:

| Ansicht | Was drauf ist |
|---------|---------------|
| **Spot-Blatt** | Name, Fotos, alle Attribute, Wetter, Wanderroute, Sterne, Kommentare — dazu Merken, Teilen, Schließen |
| **Spot anlegen** | Position per Fadenkreuz auf der Karte, dann Formular |

### Warum das Aussehen von Komoot kommt

Komoot löst dasselbe Problem für Wanderrouten, das Wild Spot für Schlafplätze
hat: Man muss etwas finden, das man noch nicht kennt, und dabei entscheidet
das Bild und nicht die Beschreibung. Deshalb ist übernommen:

- **Warmes Papierbeige statt Weiß** (`#edebe5`), fast schwarze Schrift, Oliv
  als Akzent (`#4f6814`), Orange für alles Neue und für Plus (`#ee6b17`)
- **Sehr fette, sehr enge Überschriften** — eine Zeile wirkt dadurch wie ein
  Plakat und nicht wie eine Zwischenüberschrift
- **Das Foto ist die Kachel**, der Name liegt darauf, die Fakten darunter
- **Reihen, die man seitlich schiebt** und die absichtlich über den Bildrand
  hinauslaufen: Das zeigt ohne Pfeil, dass noch mehr kommt
- **Weiche Ecken überall** — Radien zwischen 14 und 24 Pixeln, das Suchfeld
  ganz rund
- **Die Leiste unten ist Milchglas**, und der Inhalt läuft darunter durch

### Warum Milchglas und nicht einfach Weiß

Die erste Fassung hatte eine deckende Leiste. Sie klebte technisch am unteren
Rand, wirkte aber trotzdem **zu weit oben** — und der Grund dafür ist lehrreich:

Ein deckender Balken **schneidet den Bildschirm ab.** Darüber ist die App,
darunter ein Streifen Nichts. Das Auge liest die Kante als Ende der Seite, und
alles darunter als verschenkten Platz.

Milchglas liegt stattdessen **über** dem Inhalt. Die Seite reicht bis zum
Bildschirmrand, man sieht sie unter der Leiste verschwommen weiterlaufen —
und damit endet nichts zu früh. Dazu muss der Bereich bis `bottom: 0` gehen
und sich den Platz mit `padding-bottom` freihalten statt mit `bottom`.

Der aktive Bereich bekommt eine **grüne Pille** hinter dem Zeichen. Farbe
allein reicht auf Glas nicht: Über einem hellen Foto ist Oliv kaum von Grau zu
unterscheiden. Eine Fläche sieht man auch mit dem Daumen davor.

Nicht übernommen ist die Schriftart (Satoshi, kostenpflichtig und ein Nachladen
aus dem Netz — die App muss aber offline starten). Die Wirkung macht hier die
Systemschrift in Gewicht 800 mit engem Zeichenabstand.

**Der Nachtmodus bleibt.** Die alte dunkle Fassung ist als Umschalter im Profil
erhalten — im Zelt um 22 Uhr blendet Weiß. Möglich ist das, weil im Stilblatt
keine feste Farbe mehr steht, sondern überall nur ein Name aus `:root`.

---

## 3. Die Spot-Attribute

**Das ist das wichtigste Dokument des Projekts.** Aus dieser Liste entstehen die
Datenbank-Spalten, das Formular und die Icons im Spot-Detail. Änderungen hier
sind gratis — Änderungen später in der Datenbank sind mühsam.

Die Spalte "Wert in der Datenbank" ist das, was technisch gespeichert wird
(ohne Umlaute, damit es nirgends Probleme gibt). Die Spalte "Anzeige" ist das,
was der Nutzer im Formular sieht.

### Wasser

| Feld | Anzeige (Auswahl) | Wert in der Datenbank |
|------|-------------------|------------------------|
| `water_nearby` | Wasser in der Nähe? Ja / Nein | `true` / `false` |
| `water_type` | Bach / Quelle / See / Brunnen / Hütte / keins | `bach` `quelle` `see` `brunnen` `huette` `keins` |
| `water_distance_m` | Entfernung in Metern (geschätzt) | Zahl |
| `water_reliable` | ganzjährig / nur Frühjahr–Sommer / unsicher | `ganzjaehrig` `fruehjahr_sommer` `unsicher` |

### Lage

| Feld | Anzeige (Auswahl) | Wert in der Datenbank |
|------|-------------------|------------------------|
| `above_treeline` | Über der Baumgrenze? Ja / Nein | `true` / `false` |
| `elevation_m` | Seehöhe in Metern | Zahl — *wird automatisch vorgeschlagen* |
| `has_lake` | See direkt am Spot? Ja / Nein | `true` / `false` |
| `ground_type` | Wiese / Schotter / Waldboden / Fels / Moor | `wiese` `schotter` `waldboden` `fels` `moor` |
| `flat_tent_spots` | Platz für 1 / 2–3 / 4+ Zelte | `1` `2-3` `4+` |
| `exposure` | windgeschützt / halb / exponiert | `geschuetzt` `halb` `exponiert` |

### Ressourcen

| Feld | Anzeige (Auswahl) | Wert in der Datenbank |
|------|-------------------|------------------------|
| `firewood_available` | Brennholz: viel / etwas / keins | `viel` `etwas` `keins` |
| `fire_allowed` | Feuer: erlaubt / verboten / unklar | `erlaubt` `verboten` `unklar` |
| `shelter_nearby` | Biwakschachtel / Hütte / Felsüberhang / nichts | `biwakschachtel` `huette` `felsueberhang` `nichts` |

> `fire_allowed` ist der heikelste Wert der App. Default ist **`unklar`**, nie
> `erlaubt`. Dazu der Hinweistext aus Abschnitt 6.

### Fischen

| Feld | Anzeige (Auswahl) | Wert in der Datenbank |
|------|-------------------|------------------------|
| `fishing` | ja, mit Lizenz / nein, verboten / unklar | `mit_lizenz` `verboten` `unklar` |
| `fish_species` | Mehrfachauswahl: Bachforelle, Saibling, Äsche, Huchen … | Liste aus 12 Arten |
| `fishing_note` | „Wo bekommt man die Karte?" — kurzer Freitext | Text, max. 300 Zeichen |

> Wie bei `fire_allowed` ist der Default **`unklar`**, und die beste Angabe
> heißt bewusst „mit Lizenz" statt „erlaubt". In Österreich gibt es kein frei
> befischbares Gewässer: Es braucht immer die staatliche Fischerkarte *und*
> die Erlaubnis des Bewirtschafters. Ohne beides ist es Fischwilderei und
> damit strafbar — nicht bloß eine Verwaltungsübertretung. Der Hinweis steht
> deshalb direkt im Formular.
>
> `fishing_note` ist die praktisch wertvollste Angabe der Gruppe: Wo die Karte
> zu bekommen ist, findet sonst jeder von vorne heraus.

### Praktisches

| Feld | Anzeige (Auswahl) | Wert in der Datenbank |
|------|-------------------|------------------------|
| `access` | Auto direkt / kurze Wanderung / lange Wanderung | `auto` `kurze_wanderung` `lange_wanderung` |
| `hike_minutes` | Gehzeit in Minuten (geschätzt) | Zahl |
| `parking_lat` / `parking_lng` | Parkplatz, an dem die Wanderung beginnt | zwei Zahlen |
| `route_line` | Die Wanderroute als Linie | Liste von `[lng,lat]` |
| `route_minutes` | **gemessene** Gehzeit | Zahl |
| `route_distance_m`, `route_ascent_m`, `route_descent_m` | Strecke und Höhenmeter | Zahlen |
| `route_status` | Stand der Berechnung | `ok` `kein_weg` `fehler` |
| `mobile_signal` | Empfang: gut / schwach / keiner | `gut` `schwach` `keiner` |
| `discreet` | Einsehbarkeit: sehr diskret / mittel / einsehbar | `sehr` `mittel` `einsehbar` |
| `legal_status` | erlaubt / geduldet / verboten / unklar | `erlaubt` `geduldet` `verboten` `unklar` |
| `season` | Mehrfachauswahl: Frühling / Sommer / Herbst / Winter | Liste aus `fruehling` `sommer` `herbst` `winter` |

**Alle Attribute sind freiwillig** außer Name und Position. Ein Spot mit nur
einem Foto und einer Koordinate ist besser als kein Spot. Das Formular darf
niemanden zwingen, alle Felder auszufüllen — deshalb sind die Gruppen
zugeklappt.

---

## 4. Datenmodell (Kurzfassung)

Das vollständige SQL steht in [`db/schema.sql`](db/schema.sql).

| Tabelle | Inhalt |
|---------|--------|
| `profiles` | Nutzerprofil, hängt an Supabase Auth |
| `spots` | Der Spot mit Position und allen Attributen aus Abschnitt 3 |
| `spot_photos` | Fotos zu einem Spot (Datei liegt im Supabase Storage) |
| `ratings` | 1–5 Sterne, ein Nutzer kann pro Spot genau einmal bewerten |
| `comments` | Kommentar mit **Besuchsdatum** |
| `water_points` | Wasserstellen aus OpenStreetMap, einmalig importiert |

Drei Dinge, die im Schema nicht fehlen dürfen:

1. **GIST-Index auf `location`** — ohne den wird die Karte ab ein paar hundert
   Spots spürbar langsam.
2. **Row Level Security (RLS) auf jeder Tabelle** — ohne die könnte jeder mit
   dem öffentlichen Schlüssel alles löschen. Regel: jeder Eingeloggte darf
   lesen, aber nur seine eigenen Einträge ändern.
3. **`spots_in_bbox(...)`** — lädt nur die Spots im sichtbaren Kartenausschnitt,
   nicht alle. Inklusive Sterneschnitt, damit die Pins eingefärbt werden können.

### Warum `comments.visited_on` das wichtigste Feld der App ist

Ein Spot ändert sich. Die Quelle versiegt, der Forstweg wird gesperrt, ein Zaun
kommt dazu. Ein Kommentar ohne Datum ist wertlos, ein Kommentar mit
*"war dort am 12.08.2026, Bach war trocken"* ist Gold. Deshalb ist das
Besuchsdatum **Pflichtfeld** und die Kommentare sind nach Besuchsdatum sortiert
(nicht nach Schreibdatum).

---

## 5. Karten und Daten

| Layer | Quelle | Wozu |
|-------|--------|------|
| Standardkarte | basemap.at `geolandbasemap` | Orientierung |
| Gelände / Relief | basemap.at `bmapgelaende` | Man sieht sofort, wo flach ist |
| Orthofoto (Satellit) | basemap.at `bmaporthofoto30cm` | Baumgrenze und Wasser sichtbar |
| Topo / Wandern | OpenTopoMap | Höhenlinien, Wege, Hütten |

basemap.at ist die offizielle österreichische Verwaltungskarte: kostenlos, ohne
API-Key, ohne Anmeldung. Die genauen Tile-URLs vor dem Einbauen frisch von
basemap.at holen.

**Wasserstellen** kommen aus OpenStreetMap über die Overpass API. Das läuft
**einmalig als Skript auf dem PC**, das Ergebnis landet in `water_points`. Die
App fragt danach nur noch die eigene Datenbank ab — Overpass live aus der App
wäre langsam, unzuverlässig und gegen deren Nutzungsregeln. Alle paar Monate
Skript neu laufen lassen.

Relevante OSM-Tags: `natural=spring` (Quelle, die wichtigste),
`amenity=drinking_water`, `man_made=water_well`, `natural=water`,
`amenity=shelter`, `tourism=alpine_hut`.

**Lizenz:** OSM-Daten stehen unter ODbL. Der Hinweis
*„© OpenStreetMap-Mitwirkende"* muss sichtbar in der App stehen. Nicht optional.

**Höhe automatisch:** Beim Anlegen eines Spots die Seehöhe holen (Open-Elevation
oder das österreichische Höhenmodell) und `elevation_m` vorausfüllen. Über
ca. 1.800 m zusätzlich vorschlagen: *„vermutlich über der Baumgrenze"*. Der
Nutzer kann per Schalter korrigieren. Kleiner Aufwand, fühlt sich magisch an.

---

## 6. Rechtliches (V1-Minimum)

Wildcampen ist in Österreich Ländersache und in weiten Teilen nicht erlaubt.
Die App darf nicht so tun, als wäre das egal.

- Beim **ersten Start** ein Hinweis, den man einmal wegklicken muss: Wildcampen
  ist in Österreich je nach Bundesland und Grundstück verboten oder
  genehmigungspflichtig; die Angaben in der App sind Nutzerangaben und keine
  Rechtsauskunft; jeder ist selbst verantwortlich.
- `legal_status` und `fire_allowed` stehen defaultmäßig auf **`unklar`**.
- Beim Feuer-Attribut ein Satz zur Waldbrandgefahr.
- OSM-Attribution sichtbar auf der Karte.

Datenschutzerklärung und AGB erst, wenn die App über den Freundeskreis
hinausgeht.

---

## 7. Bewusst NICHT in V1

Damit V1 auch fertig wird:

- Wetter- und Waldbrandwarnung pro Spot
- Routenplanung / Navigation zum Spot
- Schutzgebiets-Layer (Nationalparks, Natura 2000)
- Sonnenauf-/untergang, Windrichtung
- Melde- und Moderationsfunktion
- Öffentliche Version mit Datenschutzerklärung und AGB
- Andere Länder als Österreich
- „Bestätigen / Widersprechen" pro Attribut *(gute Idee, aber V2)*

---

## 8. Technik-Entscheidungen

| Was | Womit | Warum |
|-----|-------|-------|
| Datenbank, Login, Fotospeicher | Supabase (Region Frankfurt) | Alles in einem, kein eigener Server, DSGVO-Region |
| Geo-Funktionen | PostGIS | Rechnet mit Koordinaten, macht die Bbox-Abfrage schnell |
| Karte | MapLibre | Frei, keine Lizenzkosten, kann Offline-Regionen |
| Frontend | **Web** (entschieden am 2026-08-04) | Läuft sofort im Handy-Browser, keine Android-SDK-Hürde |

**Entschieden: Web zuerst.**

MapLibre läuft in React Native nicht in Expo Go, sondern braucht ein natives
Development Build (Android SDK, Gradle) — das wäre die härteste Hürde des
Projekts gewesen, direkt am Anfang und bevor überhaupt etwas zu sehen ist.
Die Web-Version läuft dagegen im Handy-Browser und lässt sich über *Zum
Startbildschirm hinzufügen* wie eine App ablegen.

Die native App bleibt jederzeit möglich: Datenbank, Wasserstellen-Import und
die Attribute aus Abschnitt 3 sind bei beiden Wegen identisch. Es geht durch
diese Entscheidung keine Arbeit verloren.

---

## 9. Nächste Schritte

**Erledigt**

- [x] Konzept festnageln (dieses Dokument)
- [x] Datenbank-Schema schreiben (`db/schema.sql`)
- [x] Supabase-Account anlegen und Schema einspielen (`db/SUPABASE-SETUP.md`)
- [x] Wasser und Unterkünfte aus OpenStreetMap importieren (`scripts/import-water.mjs`)
- [x] Entscheidung Web vs. native App → **Web** (Abschnitt 8)
- [x] Erste Karte mit vier Hintergründen und eigener Position (`web/`)
- [x] Schlüssel eingetragen — die Wasserstellen erscheinen auf der Karte
- [x] **Screen 5: Login** — E-Mail und Passwort, Google vorbereitet (`web/auth.js`)
- [x] **Screen 3: Spot anlegen** — Formular mit allen Attributen aus
      Abschnitt 3, in vier zugeklappten Gruppen (`web/spot-form.js`)
- [x] Seehöhe beim Anlegen automatisch vorschlagen — über Open-Meteo, samt
      Vorschlag „über der Baumgrenze" ab 1.800 m
- [x] Unterkünfte auf der Karte: Berg-, Selbstversorger- und Almhütten,
      Campingplätze, Trekkingplätze, Biwakschachteln
- [x] **Screen 2: Spot-Detail** — die Leiste rechts (am Handy ein Blatt von
      unten) mit allen Attributen, Symbolen und der Beschreibung
      (`web/spot-detail.js`). Leere Felder werden weggelassen.
- [x] **Screen 4: Bewerten und Kommentieren** — 5 Sterne zum Antippen,
      Kommentare mit dem Pflichtfeld „Wann warst du da?", eigene Beiträge
      wieder löschbar
- [x] **Fotos** — hochladen, ansehen, eigene wieder löschen
      (`db/008-fotos.sql`). Jedes Bild wird schon im Browser auf 1600 Pixel
      verkleinert: aus 8 MB werden etwa 300 KB.
- [x] **Spots ohne Konto sichtbar** (`db/007-spots-oeffentlich.sql`).
      Anlegen, bewerten und kommentieren bleibt angemeldeten Nutzern
      vorbehalten — geändert wurde nur das Lesen.

- [x] **Eigene Spots bearbeiten und löschen** — beides in der Detail-Leiste
      unter „Dein Spot". Löschen fragt vorher nach und räumt die Bilddateien
      im Speicher mit weg; Bewertungen und Kommentare erledigt die Datenbank.

- [x] **Hinkommen** — im Spot-Detail zwei Knöpfe: „Anfahrt" öffnet Google Maps
      mit gesetztem Ziel, „Wanderweg" den Tourenplaner von Komoot an dieser
      Stelle. Dazu „Koordinaten kopieren" an einer Stelle, an der man es auch
      findet.

      Bewusst nur Links, keine Routen auf unserer eigenen Karte: Googles
      Bedingungen verbieten es, eine Google-Route auf einer fremden Karte
      (basemap.at) zu zeichnen, und Komoot hat für Außenstehende gar keine
      offene Schnittstelle — nur Partnerverträge mit Geräteherstellern.
      Die eigene Wanderroute darunter ist ein anderer Fall: sie kommt aus
      OpenStreetMap-Daten, die man zeichnen darf (siehe unten).

- [x] **Eigene Wanderroute Parkplatz → Spot** (`web/route.js`,
      `scripts/routen-rechnen.mjs`, Migration 015) — beim Spot lässt sich ein
      Parkplatz setzen (Fadenkreuz, wie beim Anlegen). Zwischen Parkplatz und
      Spot rechnet OpenRouteService den Fußweg über echte Wanderwege aus
      OpenStreetMap, Profil `foot-hiking` — dieselbe Datengrundlage, aus der
      auch Komoot seine Touren baut. Angezeigt werden Linie auf der Karte,
      Gehzeit, Strecke und Höhenmeter; die geschätzte `hike_minutes`
      verschwindet damit aus der Anzeige und wird in der Datenbank durch den
      gemessenen Wert ersetzt.

      Gerechnet wird **nicht im Browser**, sondern im Skript
      `node scripts/routen-rechnen.mjs`. Zwei Gründe: Der Schlüssel läge im
      Ordner `web/` für jeden lesbar (er bleibt so in `.env.local`), und die
      2.000 Gratis-Anfragen am Tag wären an einem guten Tag verbraucht,
      obwohl sich eine Wanderroute nie ändert. Gespeichert ist sie einmal —
      und funktioniert dadurch nebenbei auch offline.

      Wird ein Parkplatz verschoben, wirft ein Trigger in der Datenbank die
      alte Route weg. Eine Linie, die vom falschen Ort losläuft, wäre am Berg
      schlimmer als gar keine.

- [x] **Ort aus dem Foto lesen** (`web/foto-ort.js`) — beim Anlegen ein
      Handyfoto auswählen, und die Position steht. Die Karte fliegt hin, die
      Seehöhe wird für den neuen Punkt geholt, und das Bild wird beim Speichern
      gleich als erstes Foto des Spots abgelegt.

      Der EXIF-Block wird von Hand gelesen statt mit einer Bibliothek: Von den
      hundert Angaben darin braucht die App vier (Breite, Länge und die zwei
      Himmelsrichtungen). Das Bild verlässt das Gerät dabei nicht.

      Zwei Dinge sind bewusst so gebaut: Ein Bild ohne Ortsangabe wirft nichts
      um — eine vorher übernommene Position bleibt stehen. Und ein Foto von
      außerhalb Österreichs wird übernommen, aber mit einem Hinweis versehen.

      Nebenbei: Weil jedes Bild vor dem Hochladen im Browser verkleinert wird,
      trägt das gespeicherte Foto die Koordinaten *nicht* mehr in sich.

- [x] **Ins Web gestellt** (GitHub Pages) — die Karte läuft unterwegs, ohne
      dass der PC daheim läuft: https://fermasster0-rgb.github.io/wild-spot/
      Veröffentlicht wird mit `node scripts/veroeffentlichen.mjs "…"`.

- [x] **Installierbar und offline-fähig** (`web/manifest.webmanifest`,
      `web/sw.js`, `web/offline.js`) — die Seite lässt sich als App auf den
      Startbildschirm legen: eigenes Symbol, Vollbild ohne Adresszeile.

      Offline gilt für drei Dinge: die App selbst startet ohne Netz, die
      **Kartenkacheln bleiben liegen**, sobald man sie einmal gesehen hat, und
      die **Spots werden am Gerät mitgeschrieben** — letzteres muss über
      `localStorage` laufen, weil der Kartendienst sie über einen `rpc`-Aufruf
      liefert und der Browser schreibende Aufrufe nicht aufheben darf.

      Bewusste Grenze: Ein Gebiet lässt sich **nicht im Voraus** herunterladen.
      Der Speicher füllt sich nur durchs Anschauen — wer die Tour vorher zu
      Hause abfährt, hat sie am Berg. Vorausladen wäre ein eigener Schritt und
      würde bei basemap.at auch die Frage nach der erlaubten Menge aufwerfen.

      Die Fassungsnummer in `sw.js` setzt das Veröffentlichungsskript selbst.
      Ohne das würde am Handy ewig die alte Fassung kleben — die klassische
      Falle bei Apps, die offline können.

**Als Nächstes**

- [x] **Einen Spot teilen** (`web/teilen.js`, Migration 016) — im Kopf der
      Detail-Leiste ein Knopf, der einen Link auf genau diesen Spot in die
      Zwischenablage legt: `…/wild-spot/?spot=<id>`. Wer ihn öffnet, bekommt
      die Karte auf diesen Spot zentriert und die Leiste aufgeklappt — ohne
      Konto, ohne Installation.

      Die ID statt Koordinaten im Link: So zeigt er auch dann noch auf den
      Spot, wenn der umbenannt wird oder ein paar Meter wandert. Nachgesehen
      wird zuerst im Offline-Speicher der Karte, erst dann in der Datenbank —
      ein Link auf einen schon einmal gesehenen Spot geht damit auch im
      Funkloch auf.

      Zwei Stolpersteine, die beim Bauen Zeit gekostet haben und hier stehen,
      damit sie es nicht noch einmal tun: `karte.isStyleLoaded()` meldet beim
      Start eine ganze Weile `false`, obwohl die Karte längst dasteht, und
      `load` feuert mehrfach — gewartet wird deshalb auf `idle`. Und das
      Aufklappen der Leiste schiebt die Karte selbst noch zur Seite; passiert
      das mitten im Flug, bricht es ihn ab. Erst fliegen, dann aufklappen.

- [ ] **Die Routen regelmäßig nachrechnen lassen** — setzt jemand anderes
      einen Parkplatz, erscheint seine Route erst, wenn
      `node scripts/routen-rechnen.mjs` gelaufen ist. Bei einer Handvoll Spots
      genügt es, das gelegentlich von Hand zu tun; wächst die Karte, gehört
      das einmal am Tag automatisch angestoßen.
- [ ] *(kein Muss)* In ein paar Monaten den Import wiederholen, dann sind die
      OSM-Daten wieder aktuell: `node scripts/import-water.mjs`

---

## 10. Wild Spot Plus — womit die App Geld verdient

Steht seit dem 2026-08-15 in der App (`web/plus.js`, Migration 017). Die
Verkaufsseite ist fertig, **Bezahlen geht noch nicht** — dazu unten mehr.

### Der Grundsatz

**Die Karte bleibt kostenlos.** Spots ansehen, eintragen, bewerten,
kommentieren, Fotos hochladen — alles ohne Bezahlung, für immer. Eine Karte,
die von Beiträgen der Nutzer lebt, darf das Beitragen nicht hinter eine
Bezahlschranke stellen; sonst gibt es bald nichts mehr zu verkaufen.

Bezahlt wird für das, was **die Nacht draußen vorbereitet**: Karten fürs
Funkloch, die richtige Nacht, und die Frage, wo man überhaupt sein darf.

### Was drin ist

| Funktion | Warum das Geld wert ist | Stand |
|----------|------------------------|-------|
| **Karten im Voraus laden** | Am Berg gibt es keinen Empfang. Heute muss man die Gegend vorher von Hand abfahren und hoffen, dass sie im Speicher bleibt | zu bauen |
| **Die beste Nacht der Woche** | Sieben Nächte im Voraus am Spot: Temperatur, Wind, Regen, Bewölkung — und welche Nacht die richtige ist | Hälfte steht (`wetter.js` kann schon einen Spot) |
| **Wo du sein darfst** | Nationalparks und Schutzgebiete als Fläche auf der Karte, dazu die Regel des Bundeslands. Eine Strafe im Nationalpark kostet mehr als Plus in zehn Jahren | zu bauen |
| **Geheime Spots** | Eigene Plätze privat halten oder nur per Link teilen. Das ist der Grund, warum viele ihre besten Plätze gar nicht erst eintragen | zu bauen (`spots.visibility`) |
| **Alle Filter auf einmal** | Kostenlos geht ein Filter, mit Plus alle zusammen — samt gespeicherter Suchen | **fertig**, Schranke greift |
| **Routen ohne Limit + GPX** | Wanderroute beliebig oft rechnen und als Datei mitnehmen. Kostenlos: drei im Monat | Route steht (`route.js`), Limit und GPX fehlen |
| **Sterne, Mond, Dunkelheit** | Lichtverschmutzung, Mondphase, astronomische Dunkelheit — für alle, die wegen des Himmels hinausgehen | zu bauen |
| **Wache über deine Spots** | Nachricht bei Frost am gemerkten Spot, bei neuen Spots in der Gegend, bei Kommentaren | zu bauen |

### Die Preise

| Tarif | Preis | Gedanke dahinter |
|-------|-------|------------------|
| Monatlich | **3,49 €** | Zum Ausprobieren. Bewusst nicht billig — wer monatlich zahlt, soll zum Jahr wechseln |
| Jährlich | **24,99 €** | 2,08 € im Monat, 40 % günstiger. Der Tarif, den die Seite vorschlägt |
| Für immer | **59 €** einmalig | Der *Gründerpass* für die ersten 500. Bringt am Anfang Geld herein, wenn es am nötigsten ist, und schafft Leute, die das Ding weiterempfehlen |

Zum Vergleich: Komoot Premium kostet 59,99 € im Jahr. Wild Spot kann und soll
das nicht verlangen — es kann viel weniger. 24,99 € liegt an der Stelle, an
der niemand lange nachrechnet.

**Bei 500 Jahresabos wären das rund 1.040 € im Monat.** Das Ziel von 500 € im
Monat steht bei etwa 240 laufenden Jahresabos.

### Warum man noch nicht bezahlen kann, und was stattdessen passiert

Für echtes Geld braucht es einen Zahlungsdienstleister (Stripe oder Paddle),
ein Gewerbe und ein Geschäftskonto. Nichts davon ist eingerichtet.

Die Seite sagt das **offen** und sammelt stattdessen E-Mail-Adressen
(`plus_warteliste`). Das ist nicht nur ehrlicher, sondern nützlicher: Bevor
man Wochen in eine Bezahlstrecke steckt, will man die Antwort auf die eine
Frage haben, die zählt — **will überhaupt jemand zahlen?** Zwanzig Adressen
auf der Liste sind diese Antwort. Null Adressen sind sie auch.

### Wie Plus später angeschaltet wird

In `profiles.plus_until` steht ein Datum. Liegt es in der Zukunft, hat der
Nutzer Plus. Mehr ist es nicht.

Setzen darf es **nur der Server**: Ein Trigger aus Migration 017 hält jeden
davon ab, sich das Datum selbst einzutragen — der Schlüssel in `config.js`
liegt ja offen, und was die Datenbank erlaubt, kann jeder tun. Kommt eines
Tages Stripe dazu, schreibt dessen Webhook dieses eine Feld, und alles in der
App funktioniert ohne eine weitere Zeile Änderung.
