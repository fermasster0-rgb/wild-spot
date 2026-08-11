# Die Karte starten

## In zwei Zeilen

Ein Terminal im Projektordner öffnen und eintippen:

    node web/server.mjs

Dann steht im Fenster eine Adresse wie `http://localhost:5173`. Die im Browser
öffnen — fertig. Beenden mit `Strg` + `C`.

---

## Was du siehst

Oben liegt in jeder Ecke **ein** Knopf. Alles andere klappt sich von dort auf —
die Karte soll den Platz haben, nicht die Bedienung.

| Bedienelement | Was es tut |
|---------------|------------|
| **Ebenen-Knopf (oben links)** | Kartenstil wählen und Datenebenen ein- und ausblenden |
| **Zahnrad (oben rechts)** | Konto, E-Mail-Adresse, Abmelden, Rechtshinweis |
| **+ Spot hier anlegen** | Legt einen Spot am Fadenkreuz an |
| **➤ unten rechts** | Springt zu deiner eigenen Position |
| **Zahlen unten links** | Koordinaten des Fadenkreuzes — anklicken kopiert sie |

Ein grüner Punkt am Zahnrad heißt: du bist angemeldet. Die Tafeln schließen
sich mit `Esc`, mit einem Klick auf die Karte oder auf denselben Knopf.

Der Kartenstil wird über **vier Vorschaubilder** gewählt statt über vier
Wörter — alle zeigen dieselbe Bergflanke bei Zell am See. Bei einer Karte
sieht man schneller, was man bekommt, als man es lesen kann.

Die Wasserstellen und Unterkünfte erscheinen erst, wenn du **nah genug
herangezoomt** hast. Das ist Absicht: bei ganz Österreich wären es
zehntausende Punkte auf einmal.

**Bergseen sind die Ausnahme** — die siehst du schon in der Übersicht. Es gibt
nur ein paar hundert im Land, und meistens sucht man genau nach so einem.
Als Bergsee zählt jeder See über 900 m; darunter liegen die großen bekannten
(Wörthersee, Attersee, Neusiedler See), die hier niemanden interessieren.
Die Höhe steht im Popup.

Dicht beieinanderliegende Punkte werden zu einem größeren Kreis
zusammengefasst — draufklicken zoomt hinein, bis sie auseinanderfallen.

**Spots** sind etwas anderes: die kommen nicht aus OpenStreetMap, sondern von
euch. Sie werden nie zusammengefasst, und ihre Farbe zeigt die Bewertung —
grau heißt „noch nicht bewertet".

Ansehen kann sie **jeder, auch ohne Konto**: Spots, Fotos, Bewertungen und
Kommentare. Ein Konto braucht man erst zum Mitmachen — Spot anlegen, bewerten,
kommentieren, Fotos hochladen.

Ein Spot antippen öffnet die **Leiste rechts** (am Handy ein Blatt von unten)
mit Fotos, allen Angaben, den Sternen und den Kommentaren.

Bei **eigenen** Spots steht dort ganz unten „Dein Spot" mit *Bearbeiten* und
*Löschen*. Beim Bearbeiten öffnet sich dasselbe Formular wie beim Anlegen, mit
allen bisherigen Angaben gefüllt — die Position bleibt dabei unangetastet.
Löschen fragt vorher nach: Bewertungen, Kommentare und Fotos verschwinden mit,
und das ist nicht rückholbar.

---

## Konto und Anmelden

**Ohne Konto** läuft alles zum Ansehen: Karte, Wasserstellen, Unterkünfte,
Spots samt Fotos, Bewertungen und Kommentaren.

**Ein Konto braucht es zum Mitmachen** — Spot anlegen, bewerten, kommentieren,
Fotos hochladen. Die Datenbank bindet jeden Beitrag an einen Nutzer, damit man
sieht, von wem er stammt, und damit ihn nur der Verfasser wieder löschen kann.

Anlegen: oben rechts auf **Anmelden** → *Noch kein Konto? Eins anlegen* →
E-Mail und Passwort (mindestens 8 Zeichen).

### Wenn die Bestätigungsmail nicht kommt

Supabase verlangt zurzeit eine Bestätigung per E-Mail. Der kostenlose
Mailversand ist aber auf wenige Mails pro Stunde begrenzt und landet gern im
Spam. Zwei Auswege:

**Der Dauerweg (empfohlen, drei Klicks):** Im Supabase-Dashboard unter
*Authentication → Sign In / Providers → Email* den Schalter **Confirm email**
ausschalten. Dann kann sich jeder sofort anmelden. Vor dem Verteilen an einen
größeren Kreis wieder einschalten.

**Der Notausgang:** Ein Konto von Hand freischalten —

    node db/konto-freischalten.mjs max@beispiel.at
    node db/konto-freischalten.mjs --liste

---

## Anmelden mit Google einschalten

Der Knopf ist gebaut, aber ausgeschaltet — Google verlangt vorher eine
Registrierung der App. Das dauert etwa 15 Minuten:

1. [console.cloud.google.com](https://console.cloud.google.com) → neues Projekt
   anlegen (Name egal, z. B. `wildcamp-at`)
2. **APIs & Dienste → OAuth-Zustimmungsbildschirm**: Nutzertyp *Extern*,
   App-Name, deine E-Mail als Support-Kontakt. Mehr braucht es nicht.
3. **APIs & Dienste → Anmeldedaten → Anmeldedaten erstellen → OAuth-Client-ID**,
   Typ **Webanwendung**
4. Bei *Autorisierte Weiterleitungs-URIs* genau das eintragen:

       https://aokovrrxvglxpccezjjr.supabase.co/auth/v1/callback

5. Google zeigt danach **Client-ID** und **Client-Secret**. Beide ins
   Supabase-Dashboard unter *Authentication → Sign In / Providers → Google*
   eintragen und den Provider einschalten.
6. In `web/config.js` `googleLogin` auf `true` setzen.

### Nur noch Google zulassen

Wenn wirklich **jede Adresse echt** sein soll und niemand mit `test@test.at`
hereinkommen können soll, gehören zwei Schalter umgelegt — beide sind nötig:

1. `web/config.js`: `nurGoogle: true`. Damit verschwinden E-Mail und Passwort
   aus dem Anmeldefenster, es bleibt nur der Google-Knopf.
2. Supabase-Dashboard → *Authentication → Sign In / Providers* → **Email
   ausschalten**.

> Warum beides? Punkt 1 ändert nur, was man sieht. Wer sich auskennt, könnte
> die Schnittstelle direkt ansprechen und trotzdem ein Konto per E-Mail
> anlegen. Erst Punkt 2 macht das unmöglich. Punkt 1 allein ist Kosmetik,
> Punkt 2 allein sperrt zwar zuverlässig, zeigt aber weiter ein Formular,
> das dann Fehler wirft.

Ein Nebeneffekt, der dir gefallen wird: Google-Konten sind bereits geprüft.
Die Bestätigungsmail entfällt damit komplett, und dieselbe Google-Adresse
kann sich nicht zweimal als zwei verschiedene Nutzer anmelden.

> **Und Apple?** Anmelden mit Apple setzt eine Mitgliedschaft im Apple
> Developer Program voraus — 99 Euro im Jahr. Für ein Projekt im
> Freundeskreis lohnt sich das nicht. Deshalb ist Apple bewusst nicht dabei.

---

## Der Schlüssel — schon eingetragen

In `web/config.js` steht der publishable key seit dem 2026-08-04, die
Wasserstellen laden also. Die Anleitung bleibt hier stehen für den Fall, dass
der Schlüssel einmal getauscht wird:

1. [supabase.com](https://supabase.com) öffnen, Projekt `wildcamp-at` anklicken
2. Links unten **Project Settings** → **API Keys**
3. Den **anon**- bzw. **publishable**-Schlüssel kopieren (langer Text)
4. In `web/config.js` zwischen die Anführungszeichen bei `supabaseAnonKey`
   einfügen und speichern
5. Im Browser die Seite neu laden

> **Zur Beruhigung:** Dieser Schlüssel *darf* öffentlich sein, dafür ist er
> gemacht. Was mit ihm sichtbar ist, entscheidet Row Level Security in der
> Datenbank — Lesen ist erlaubt, Schreiben nur angemeldet und nur am Eigenen.
>
> Der **service_role**- bzw. **secret**-Schlüssel gehört dagegen nie hierher.

---

## Fotos

Jeder Angemeldete kann Fotos zu einem Spot hinzufügen, **sehen kann sie
jeder** — auch ohne Konto. Mehrere Bilder auf einmal gehen.

Jedes Bild wird **schon im Browser verkleinert**, bevor es losgeschickt wird:
auf 1600 Pixel an der langen Seite. Aus einem 8-MB-Handyfoto werden dadurch
etwa 300 KB. Das spart dein Datenvolumen unterwegs und den Speicherplatz —
der kostenlose Supabase-Speicher hat 1 GB, das reicht so für rund 3.000 Fotos
statt für 120.

Löschen kann jeder nur seine eigenen Bilder. Der Knopf dazu erscheint beim
Darüberfahren in der Ecke des Bildes; bei fremden Fotos gibt es ihn nicht, und
die Datenbank würde es auch gar nicht erlauben.

Der Speicherort ist mit `db/008-fotos.sql` eingerichtet und muss nicht von
Hand im Dashboard angelegt werden.

---

## Am Handy ausprobieren

Solange die App noch nicht im Netz steht, läuft sie über deinen PC. **Beide
Geräte müssen im selben WLAN sein** — das Handy also nicht über mobile Daten.

1. Am PC den Server starten:

       node web/server.mjs

2. Im Fenster stehen **zwei** Adressen. Die zweite ist die fürs Handy:

       Auf diesem PC:  http://localhost:5173
       Am Handy:       http://192.168.68.58:5173   ← diese

3. Diese Adresse am Handy im Browser eintippen. Die Zahlen können sich
   ändern, wenn dein Router neu startet — dann nochmal im Fenster nachsehen.

4. Beim allerersten Mal fragt die **Windows-Firewall** nach:
   **privates Netzwerk erlauben**. Ohne das kommt das Handy nicht durch.

### Als Symbol auf den Startbildschirm

Damit du nicht jedes Mal die Adresse tippen musst:

- **Android (Chrome):** Menü ⋮ → *Zum Startbildschirm hinzufügen*
- **iPhone (Safari):** Teilen-Symbol → *Zum Home-Bildschirm*

Danach startet sie wie eine App, ohne Adresszeile.

### Was am Handy zu beachten ist

- Der **PC muss laufen** und der Server offen sein. Schließt du das Fenster
  oder drückst `Strg` + `C`, ist die Seite am Handy sofort tot.
- **Unterwegs geht es nicht** — nur im eigenen WLAN. Dafür muss die App ins
  Netz (GitHub Pages, steht auf der Liste in `KONZEPT.md`).
- Der **Positionsknopf ➤ funktioniert am Handy nicht**, weil die Adresse
  `http://192.168.…` und nicht `https` ist. Browser geben den Standort nur
  auf `localhost` oder über eine gesicherte Verbindung frei. Alles andere —
  Karte, Spots, Fotos, Bewerten, Kommentieren — läuft normal.

> **Der Grund, warum das alles noch umständlich ist:** Die App liegt auf
> deinem PC. Sobald sie einmal im Netz steht, tippst du nur noch eine feste
> Adresse ein — überall, ohne Server, ohne WLAN-Bedingung, und der
> Positionsknopf geht dann auch.

---

## Warum ein Server und kein Doppelklick auf die index.html

Browser erlauben Standortbestimmung und Zwischenablage nur auf `localhost`
oder `https`. Eine direkt geöffnete Datei zählt für sie nicht dazu — der
`➤`-Knopf würde einfach nichts tun.

---

## Die Dateien

| Datei | Inhalt |
|-------|--------|
| `index.html` | Aufbau der Seite und das gesamte Aussehen |
| `app.js` | Die Karte: Ebenen, Datenabfrage, Position |
| `auth.js` | Anmelden, Registrieren, Abmelden |
| `spot-form.js` | Das Formular zum Anlegen eines Spots |
| `spot-detail.js` | Die Leiste rechts: Angaben, Bewertungen, Kommentare |
| `config.js` | Die Zugangsdaten — das Einzige, was du anfassen musst |
| `server.mjs` | Der kleine Webserver zum Ausprobieren |
| `oesterreich-maske.geojson` | Der Landesumriss, damit die Karte an der Grenze endet |

### Warum außerhalb Österreichs alles schwarz ist

basemap.at schneidet seine Kacheln nicht an der Staatsgrenze ab, sondern
liefert Quadrate. Bei *Standard* fällt das nicht auf — dort sind die Flächen
außerhalb durchsichtig. *Gelände* und *Satellit* malen dagegen bis zum Rand
des Quadrats weiter und standen als helles Rechteck über das Land hinaus.

Deshalb liegt über der Karte eine **Maske**: eine Fläche über die ganze Welt,
in die Österreich als Loch geschnitten ist, in der Farbe des Hintergrunds.
Dadurch endet jede Grundkarte exakt am Landesumriss.

Den Umriss holt ein Skript einmalig von OpenStreetMap — er muss nie
aktualisiert werden, Staatsgrenzen ändern sich selten:

    node scripts/import-grenze.mjs

Die Wasserstellen liegen bewusst **unter** der Maske: der OSM-Import ging über
ein Rechteck um Österreich, deshalb sind ein paar hundert Brunnen knapp
jenseits der Grenze dabei. So verschwinden sie, statt im Schwarzen zu
schweben. Spots und die eigene Position liegen darüber und bleiben immer
sichtbar.
