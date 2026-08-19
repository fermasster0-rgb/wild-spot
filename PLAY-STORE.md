# Wild Spot in den Google Play Store

Der Weg von der Web-App in den Store. Stand: 2026-08-19.

Android geht vor iOS, weil Google eine PWA ausdrücklich als App zulässt —
Apple lehnt sie ab (Richtlinie 4.2). Für iOS braucht es echte native
Funktionen und einen Mac; das ist ein eigenes Projekt.

---

## Was schon erledigt ist

- [x] **Wurzel-Domain angelegt** — `github.com/fermasster0-rgb/fermasster0-rgb.github.io`.
      Sie leitet auf Wild Spot weiter und trägt die Asset-Links-Datei.
      Die musste dorthin, weil Android sie nur in der Wurzel einer Domain
      sucht, nie in einem Unterordner wie `/wild-spot/`.
- [x] **`.nojekyll`** in dieser Wurzel — sonst liefert GitHub Pages den Ordner
      `.well-known` gar nicht aus (Jekyll überspringt alles mit Punkt am Anfang).
- [x] **Manifest ergänzt** — `id` und zwei Kurzbefehle (Karte, Merkliste), die
      beim langen Antippen des App-Symbols erscheinen.
- [x] **Datenschutzerklärung** unter `/wild-spot/datenschutz.html`, verlinkt
      im Profil. **Entwurf** — die Angaben in eckigen Klammern fehlen noch.

---

## Was du selbst machen musst

### 1. Google-Play-Entwicklerkonto (25 $, einmalig)

play.google.com/console — auf **deinen 20-jährigen Partner** anmelden, nicht
auf dich. Google verlangt Volljährigkeit und prüft den Ausweis.

Bei der Anmeldung wird gefragt, ob es ein **persönliches Konto** oder eine
**Organisation** ist. Persönlich reicht und ist einfacher; Organisation
verlangt eine Firmenbuchnummer.

Die Prüfung dauert derzeit einige Tage.

### 2. Die Datenschutzerklärung fertig machen

In `web/datenschutz.html` stehen drei Platzhalter:

- Name der verantwortlichen Person
- Anschrift (eine echte Adresse ist Pflicht)
- Kontakt-E-Mail
- Datum

Ohne verlinkte Datenschutzerklärung nimmt Google die App nicht an.

### 3. Material für den Store-Eintrag

| Was | Vorgabe | Stand |
|---|---|---|
| App-Symbol | 512 × 512 PNG | ✅ vorhanden (`icon-512.png`) |
| Feature-Grafik | 1024 × 500 | ❌ fehlt |
| Screenshots Handy | mindestens 2, je 320–3840 px | ❌ fehlen |
| Kurzbeschreibung | max. 80 Zeichen | Entwurf unten |
| Beschreibung | max. 4000 Zeichen | Entwurf unten |

---

## Textentwürfe

**Kurzbeschreibung** (77 Zeichen):

> Die Karte für Plätze, an denen man wirklich übernachten kann. Auch offline.

**Beschreibung:**

> Wild Spot zeigt Plätze zum Übernachten unter freiem Himmel — eingetragen von
> Leuten, die dort waren.
>
> **Was drauf ist**
> Über tausend Spots, Bergseen, Wasserfälle, Trinkwasserstellen und
> Biwakschachteln. Zu jedem Platz: Wasser in der Nähe, Untergrund, wie
> geschützt er liegt, wie lange man geht.
>
> **Die Nacht vorher planen**
> Für jeden Spot die Temperatur in der Nacht — nicht die im Tal, sondern die
> auf seiner Seehöhe. Dazu Regen, Wind und wann es dunkel wird.
>
> **Ohne Empfang**
> Was du einmal angesehen hast, bleibt am Gerät. Am Berg brauchst du kein Netz.
>
> **Wo eigene Regeln gelten**
> Nationalparks und Naturschutzgebiete liegen als Fläche auf der Karte.
>
> Wild Spot ist kostenlos. Plus schaltet zusätzliche Karten, das Vorausladen
> ganzer Gebiete und handverlesene Spots frei.

---

## Der Fragebogen zur Datensicherheit

Google fragt beim Einreichen ab, welche Daten die App erhebt. Für Wild Spot:

| Frage | Antwort |
|---|---|
| Standort (ungefähr/genau) | **Ja**, genau — nur während der Nutzung, wird nicht gespeichert |
| Persönliche Daten | **Ja** — E-Mail-Adresse, Name (Benutzername) |
| Fotos | **Ja** — nur die, die man selbst hochlädt |
| Nutzerinhalte | **Ja** — Spots, Bewertungen, Kommentare |
| Werden Daten verkauft? | **Nein** |
| Verschlüsselt übertragen? | **Ja** |
| Kann man Löschung verlangen? | **Ja** |

---

## Wenn das Konto steht

Dann baue ich das Android-Paket mit Bubblewrap (Googles eigenem Werkzeug für
genau diesen Zweck — es ist bereits installiert):

```
bubblewrap init --manifest https://fermasster0-rgb.github.io/wild-spot/manifest.webmanifest
bubblewrap build
```

Dabei entsteht ein Signaturschlüssel. **Der ist wichtiger als die App selbst:**
Geht er verloren, lässt sich die App nie wieder aktualisieren. Deshalb beim
Anlegen **Play App Signing** einschalten — dann verwahrt Google den echten
Schlüssel, und ein verlorener Upload-Schlüssel ist ersetzbar.

Nach dem Build steht der Fingerabdruck des Schlüssels fest. Er kommt in die
Datei `.well-known/assetlinks.json` im Wurzel-Repo — erst damit erkennt Android
die App als zu dieser Domain gehörig und blendet die Browser-Adressleiste aus.
Ohne diesen Schritt sieht die App aus wie ein Browserfenster.
