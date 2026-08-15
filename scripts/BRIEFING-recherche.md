# Briefing: Spot-Recherche für ein Land

Du recherchierst Wildcamp-Plätze für **Wild Spot**, eine Karten-App
(https://fermasster0-rgb.github.io/wild-spot/). Dein Land steht in deinem
Auftrag. Du bearbeitest **nur dieses eine Land**.

---

## Was du lieferst

**12 bis 18 konkrete Plätze**, an denen man in deinem Land eine Nacht im Zelt
verbringen kann. Als JSON-Datei (Format weiter unten).

Warum mehr als 10: Später sucht ein Skript zu jedem Platz automatisch ein
Foto. Wer keins bekommt, fällt raus — bei Norwegen und Schweden waren das
etwa 12 %. Mit 15 Kandidaten bleiben sicher 10 übrig.

---

## Die eine Regel, an der alles hängt: keine erfundenen Koordinaten

Das ist der wichtigste Punkt des ganzen Auftrags. Ein Platz mit falschen
Koordinaten ist schlimmer als kein Platz — jemand fährt hin und steht im
Nichts, oder schlimmer, auf einem Privatgrundstück.

**Jede Koordinate muss aus einer Quelle stammen, die du tatsächlich gesehen
hast.** Zulässige Quellen:

- OpenStreetMap / Nominatim (der Ort existiert dort als benanntes Objekt)
- Wikipedia (die Koordinate steht im Artikel)
- Peakbagger, summitpost, Hüttenverzeichnisse der Alpenvereine
- Ein Tourenbericht oder eine GPX-Datei mit ausgewiesenen Koordinaten
- Offizielle Nationalpark-Seiten mit Lageplan

**Nicht zulässig:** Koordinaten, die du aus dem Kopf oder „ungefähr" angibst.
Wenn du für einen schönen Ort keine belegte Koordinate findest, **lass ihn
weg**. Lieber 12 belegte Plätze als 18, von denen fünf geraten sind.

In das Feld `koordinaten_quelle` schreibst du, woher die Koordinate stammt
(z. B. `"osm way 12345678"`, `"Wikipedia: Lago di Braies"`,
`"Nominatim, Suche 'Refuge du Plan'"`). Dieses Feld ist Pflicht.

Plausibilitätsprüfung vor dem Speichern: Liegt die Koordinate wirklich in
deinem Land? Ist der Breitengrad im richtigen Bereich? Ein Spot in Portugal
mit `lat: 62.4` ist ein Tippfehler oder eine Halluzination.

---

## Schritt 1 — zuerst die Rechtslage klären

**Bevor** du einen einzigen Platz suchst, recherchiere die Rechtslage in deinem
Land. Das entscheidet, wonach du überhaupt suchst.

Kläre:
- Ist freies Zelten grundsätzlich erlaubt, geduldet oder verboten?
- Gibt es **Ausnahmen**? Die sind das Wertvollste am ganzen Auftrag. Beispiele:
  - Frankreich: „bivouac" ist in vielen Nationalparks erlaubt, meist von 19
    bis 9 Uhr und ab einer Stunde Fußweg vom Parkplatz
  - Italien: oberhalb einer bestimmten Höhe je nach Region geduldet, dazu
    „bivacchi" (offene Biwakhütten, frei nutzbar)
  - Schottland: Scottish Outdoor Access Code — weitgehend erlaubt, mit
    Sperrzonen am Loch Lomond
  - Skandinavien/Baltikum: Jedermannsrecht
  - Spanien: von Region zu Region völlig verschieden, teils Bergbiwak erlaubt
- Gibt es **offizielle Zeltplätze in der Wildnis** (Nationalpark-Zeltflächen,
  Schutzhütten mit Zeltrecht, Biwakschachteln, „refugios libres",
  „bothies" in Schottland, „laavu"/„autiotupa" in Finnland)? Die zählen und
  sind oft die besten Einträge.
- Regionale Sonderregeln, Feuerverbote, Saisonzeiten

Wenn Zelten in deinem Land flächendeckend verboten ist, dann suche gezielt die
**legalen Ausnahmen** — Biwakplätze, Hüttenzeltflächen, Nationalparkflächen mit
Genehmigung. Ein Land mit 8 legalen Plätzen ist ein besseres Ergebnis als eines
mit 18 illegalen.

Trage das Ergebnis pro Spot in `legal_status` und `regel` ein.

---

## Schritt 2 — die Plätze suchen

Suche in der **Landessprache**, nicht nur auf Deutsch oder Englisch. Die guten
Quellen sind fast immer einheimisch. Nützliche Begriffe:

- Schweden/Norwegen: *vildmarksläger, tältplats, teltplass*
- Finnland: *laavu, autiotupa, telttapaikka*
- Frankreich: *bivouac, spot bivouac, refuge non gardé*
- Italien: *bivacco, campeggio libero*
- Spanien: *vivac, acampada libre, refugio libre*
- Portugal: *bivaque, acampamento selvagem*
- Griechenland: *ελεύθερη κατασκήνωση, καταφύγιο*
- Kroatien: *divlje kampiranje, sklonište*
- Rumänien: *cort salbatic, refugiu montan*
- Schottland/Irland: *wild camping spot, bothy*
- Island: *tjaldsvæði, wild camping*
- Baltikum: *telkimiskoht (EE), telts vieta (LV), stovyklavietė (LT)*

Achte auf **Streuung über das Land** — nicht alle 15 Plätze in dieselbe Region.
Nimm die bekannten Wandergebiete, aber auch weniger begangene.

Gute Fundstellen sind meistens: Nationalpark-Websites, staatliche Forst- und
Wanderbehörden (z. B. Metsähallitus in Finnland, Mountain Bothies Association
in Schottland), Alpenvereine, Fernwanderweg-Etappenbeschreibungen,
Wikiloc/Komoot-Tourenberichte mit Übernachtungspunkt, OpenStreetMap-Objekte mit
`tourism=camp_site` + `backcountry=yes` oder `amenity=shelter`.

---

## Schritt 3 — die Datei schreiben

Eine JSON-Datei, eine Liste von Objekten, in:

```
scripts/kandidaten-<land>.json
```

Der Dateiname in Kleinbuchstaben ohne Umlaute, z. B. `kandidaten-frankreich.json`,
`kandidaten-griechenland.json`, `kandidaten-schottland.json`.

### Format je Platz

```json
{
  "name": "Kvalvika – Bucht hinter dem Ryten",
  "region": "Lofoten",
  "lat": 68.079,
  "lng": 13.08,
  "parking_lat": 68.1112,
  "parking_lng": 13.247,
  "access": "kurze_wanderung",
  "hike_minutes": 55,
  "above_treeline": true,
  "has_lake": false,
  "water_nearby": true,
  "water_type": "bach",
  "water_distance_m": 150,
  "water_reliable": "fruehjahr_sommer",
  "ground_type": "wiese",
  "exposure": "exponiert",
  "firewood_available": "keins",
  "fire_allowed": "verboten",
  "shelter_nearby": "nichts",
  "mobile_signal": "schwach",
  "discreet": "mittel",
  "legal_status": "erlaubt",
  "season": ["sommer", "herbst"],
  "text": "Sandbucht ohne Straßenanschluss, eingerahmt von steilen Hängen. Vom Parkplatz Torvdalshalsen führt ein ausgetretener Pfad über einen Sattel hinunter zum Strand.",
  "bekannt": "Sehr bekannt – von Juni bis August stehen hier oft ein Dutzend Zelte.",
  "regel": "Jedermannsrecht gilt: höchstens zwei Nächte, mindestens 150 m von Häusern. Offenes Feuer ist von 15. April bis 15. September verboten.",
  "koordinaten_quelle": "OSM node 4711, Kvalvika"
}
```

### Erlaubte Werte — nur genau diese, sonst weist die Datenbank es ab

| Feld | erlaubte Werte |
|---|---|
| `access` | `auto`, `kurze_wanderung`, `lange_wanderung` |
| `water_type` | `bach`, `quelle`, `see`, `brunnen`, `huette`, `keins` |
| `water_reliable` | `ganzjaehrig`, `fruehjahr_sommer`, `unsicher` |
| `ground_type` | `wiese`, `schotter`, `waldboden`, `fels`, `moor` |
| `exposure` | `geschuetzt`, `halb`, `exponiert` |
| `firewood_available` | `viel`, `etwas`, `keins` |
| `fire_allowed` | `erlaubt`, `verboten`, `unklar` |
| `shelter_nearby` | `biwakschachtel`, `huette`, `felsueberhang`, `nichts` |
| `mobile_signal` | `gut`, `schwach`, `keiner` |
| `discreet` | `sehr`, `mittel`, `einsehbar` |
| `legal_status` | `erlaubt`, `geduldet`, `verboten`, `unklar` |
| `season` | Liste aus `fruehling`, `sommer`, `herbst`, `winter` |

Weitere Regeln:
- `name`: 3–80 Zeichen, auf Deutsch verständlich
- `hike_minutes`: 0–1440
- `water_distance_m`: 0–20000
- `text`: die Beschreibung, 2–5 Sätze, **auf Deutsch**, sachlich
- `bekannt`: ein Satz dazu, wie überlaufen der Ort ist
- `regel`: die konkrete Rechtslage für genau diesen Platz, ein bis zwei Sätze
- `parking_lat`/`parking_lng`: der nächste Parkplatz, falls belegbar — sonst weglassen

### Was du NICHT ausfüllst

- **`elevation_m`** — die Höhe holt ein Skript später automatisch aus dem
  Geländemodell. Lass das Feld weg.
- **`foto`** — Fotos sucht ein Skript automatisch bei Wikimedia Commons über die
  Koordinate. Du suchst keine Bilder und verlinkst keine.
- **`flat_tent_spots`** — kann man aus der Ferne nicht wissen.

### Felder, die du nicht sicher weißt

**Weglassen, nicht raten.** Ein fehlendes Feld ist in der App vollkommen in
Ordnung, ein falsches nicht. Das gilt besonders für `ground_type`,
`mobile_signal`, `water_distance_m` und `exposure`. Nur ausfüllen, wenn die
Quelle es hergibt oder es aus der Lage zwingend folgt (über der Baumgrenze →
`firewood_available: "keins"`).

---

## Wenn du fertig bist

Melde in deinem Abschlussbericht **kurz** (maximal 15 Zeilen):

1. Wie viele Plätze in der Datei stehen
2. Die Rechtslage des Landes in zwei bis drei Sätzen
3. Verteilung von `legal_status` (z. B. „6× erlaubt, 4× geduldet, 2× unklar")
4. Welche Regionen abgedeckt sind
5. Was schwierig war oder fehlt

Schicke **nicht** die ganze Liste im Bericht — die steht ja in der Datei.
