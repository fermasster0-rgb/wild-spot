# wildcamp.at

Eine Karte für Wildcampspots in Österreich. Wer einen guten Platz gefunden
hat, trägt ihn ein — mit Fotos, Bewertung und dem, was zählt: Wasser in der
Nähe, Untergrund, Wind, Handyempfang, Gehzeit.

Dazu liegen **62.000 Wasserstellen und Unterkünfte** aus OpenStreetMap auf der
Karte: Quellen, Trinkbrunnen, Berghütten, Biwakschachteln, Trekkingplätze —
und 1.417 Bergseen.

**Ansehen kann jeder.** Ein Konto braucht es erst zum Mitmachen.

---

## Loslegen

```
node web/server.mjs
```

Dann `http://localhost:5173` im Browser öffnen. Alles Weitere steht in
[`web/README.md`](web/README.md).

## Was wo liegt

| Ordner | Inhalt |
|--------|--------|
| `web/` | Die App: Karte, Spots, Fotos, Anmeldung |
| `db/` | Datenbankschema und die Migrationen, nummeriert |
| `scripts/` | Einmal-Skripte: Wasserstellen, Bergseen und Landesgrenze aus OpenStreetMap holen |
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
