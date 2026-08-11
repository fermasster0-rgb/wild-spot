# Wild Spot — Konzept

Eine App für Wildcampen-Spots in Österreich. Nutzer legen Plätze an, bewerten sie
und sehen auf der Karte, wo Wasser ist.

**Stand:** 2026-08-04 · **Version:** V1-Planung

---

## 1. Wofür das gut ist

Der Kern-Nutzen, in einem Satz: **Du siehst auf einer Karte Österreichs, wo andere
schon gut geschlafen haben — und ob es dort Wasser gibt.**

Alles, was nicht auf diesen Satz einzahlt, ist V2 (siehe Abschnitt 7).

Zielgruppe V1: Ferdinand und Freunde. Kein Play Store, keine Öffentlichkeit,
keine AGB. Das kommt erst, wenn die App wirklich benutzt wird.

---

## 2. Die 5 Bildschirme

| # | Screen | Was drauf ist |
|---|--------|---------------|
| 1 | **Karte** (Start) | Spots als Pins, Wasser als eigener Layer, "Meine Position"-Button, Layer-Umschalter |
| 2 | **Spot-Detail** | Name, Fotos, alle Attribute mit Icons, Durchschnittsbewertung, Kommentare |
| 3 | **Spot anlegen** | Position per Fadenkreuz auf der Karte, dann Formular |
| 4 | **Bewerten / Kommentieren** | 5 Sterne + Text + Pflichtfeld "Wann warst du da?" |
| 5 | **Profil / Login** | E-Mail-Login, meine Spots, meine Bewertungen |

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
| `hike_minutes` | Gehzeit in Minuten | Zahl |
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

**Als Nächstes**

- [ ] Ins Web stellen (GitHub Pages), damit die Karte auch unterwegs läuft,
      ohne dass der PC daheim laufen muss
- [ ] *(kein Muss)* In ein paar Monaten den Import wiederholen, dann sind die
      OSM-Daten wieder aktuell: `node scripts/import-water.mjs`
