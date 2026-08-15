# Wild Spot

**→ [fermasster0-rgb.github.io/wild-spot](https://fermasster0-rgb.github.io/wild-spot/)**

Eine Karte für Wildcampspots in Österreich. Wer einen guten Platz gefunden
hat, trägt ihn ein — mit Fotos, Bewertung und dem, was zählt: Wasser in der
Nähe, Untergrund, Wind, Handyempfang, Gehzeit.

Dazu liegen **64.000 Punkte** aus OpenStreetMap auf der Karte: Quellen,
Trinkbrunnen, Berghütten, Biwakschachteln, Trekkingplätze — dazu 1.417
Bergseen und 1.777 Wasserfälle.

**Ansehen kann jeder.** Ein Konto braucht es erst zum Mitmachen.

---

## Loslegen

```
node web/server.mjs
```

Dann `http://localhost:5173` im Browser öffnen. Alles Weitere steht in
[`web/README.md`](web/README.md).

## Änderungen ins Netz stellen

```
node scripts/veroeffentlichen.mjs
```

Sichert alles, schickt es zu GitHub und veröffentlicht den `web/`-Ordner.
Nach etwa einer Minute ist die Seite oben aktuell.

## Die Wanderrouten rechnen

```
node scripts/routen-rechnen.mjs
```

Sucht alle Spots, bei denen jemand einen Parkplatz gesetzt hat, und lässt
OpenRouteService den Fußweg zum Spot rechnen — Linie, Gehzeit und Höhenmeter
landen in der Datenbank und stehen danach in der App. Braucht `ORS_API_KEY` in
`.env.local`. Ohne offene Spots ist es nach zwei Sekunden fertig, man kann es
also bedenkenlos öfter laufen lassen. `--probe` zeigt nur an, `--alle` rechnet
alles noch einmal.

## Was wo liegt

| Ordner | Inhalt |
|--------|--------|
| `web/` | Die App: Karte, Spots, Fotos, Anmeldung |
| `web/foto-ort.js` | Liest den Aufnahmeort aus einem Handyfoto (EXIF) |
| `db/` | Datenbankschema und die Migrationen, nummeriert |
| `scripts/` | Einmal-Skripte: Wasserstellen, Bergseen, Wasserfälle und Landesgrenze aus OpenStreetMap holen |
| `KONZEPT.md` | Was die App können soll, und was schon geht |

## Technik

Karte mit [MapLibre](https://maplibre.org) auf den Kacheln von
[basemap.at](https://basemap.at), Daten in [Supabase](https://supabase.com)
(Postgres mit PostGIS, Region Frankfurt). Kein Framework, kein Build-Schritt —
die Dateien im `web/`-Ordner sind die App.

## Rechtliches

Wildcampen ist in Österreich Ländersache und vielerorts verboten oder
genehmigungspflichtig. Alle Angaben in dieser App stammen von Nutzern und sind
keine Rechtsauskunft.

Karte © [basemap.at](https://basemap.at) ·
Daten © [OpenStreetMap-Mitwirkende](https://www.openstreetmap.org/copyright) (ODbL)
