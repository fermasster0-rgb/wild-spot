# Wild Spot — die Karte starten

## In zwei Zeilen

Ein Terminal im Projektordner öffnen und eintippen:

    node web/server.mjs

Dann steht im Fenster eine Adresse wie `http://localhost:5173`. Die im Browser
öffnen — fertig. Beenden mit `Strg` + `C`.

---

## Was du siehst

Unten liegt eine Leiste mit **fünf Bereichen**. Die Karte ist einer davon —
der wichtigste, aber eben einer.

| Bereich | Wofür |
|---------|-------|
| **Entdecken** | Die Startseite mit **fünf Tafeln**: Spots, Feed, Ich folge, Aktivität, Leute |
| **Karte** | Spots, Wasser, Hütten, **Gipfel**, Position, Spot anlegen, Filter |
| **Merkliste** | Gemerkte Plätze, deine eigenen Spots, **deine Gipfel**, offline Gespeichertes |
| **Plus** | Was Geld kostet und warum ([KONZEPT.md, Abschnitt 10](../KONZEPT.md)) |
| **Profil** | Konto, **deine Zahlen**, **Abzeichen**, **Gipfel**, **letzte Aktivität**, Einstellungen |

Die vier Tafeln auf **Entdecken** — Textreiter mit Unterstrich, ohne Zeichen:

| Tafel | Was drauf steht |
|-------|-----------------|
| **Spots** | Suche, Filter, Treffer, Spot der Woche, neu dazugekommen, in deiner Nähe, Bestenliste, **Gipfel sammeln**, drei Artikel |
| **Feed** | Beiträge — umschaltbar auf *Nur wem ich folge* |
| **Aktivität** | Alle Ereignisse: wer war auf einem Gipfel, wer hat einen Platz eingetragen, wer hat bewertet |
| **Leute** | Namen suchen, Vorschläge zum Folgen, die Gipfel-Bestenliste |

> **Was am 2026-08-16 aufgeräumt wurde:** Über der Seite lagen vier
> Bedienreihen übereinander — ein Zahlenband aus fünf Kacheln, fünf grüne
> Reiterpillen mit Emojis, das Suchfeld und acht Filterchips. Der erste Spot
> war damit aus dem Bild geschoben. Jetzt sind es drei ruhige Zeilen: Reiter,
> Suche, Filter. Der Reiter *Ich folge* ist ein Umschalter im Feed geworden,
> und die Zahlen der Gemeinschaft stehen als ein Satz am Ende der Seite.

**Am Rechner** wird aus der Leiste unten eine Spalte links — dort ist unten
kein Daumen, sondern nur weiter Weg für die Maus.

Die Karte wird beim Wechseln nie weggeworfen, sondern nur verdeckt. Deshalb
steht sie sofort wieder da, an derselben Stelle und im selben Zoom.

### Zeichen statt Emojis

In der App stehen fast keine Emojis mehr. Sie waren an vielen Stellen: vor
jedem Filterchip, vor jeder Angabe unter einer Spot-Kachel, vor jedem der
zwanzig Merkmale im Spot-Blatt, auf den Reitern, in der Aktivität und auf der
Plus-Seite.

Der Grund fürs Aufräumen ist nicht Geschmack, sondern Lesbarkeit: Ein Emoji vor
dem Wort *Wasser* sagt nichts, was das Wort nicht schon sagt — es verdoppelt
die Auskunft und zieht dabei den Blick auf sich. Zwanzig davon untereinander
sind eine bunte Spalte, durch die man sich durchsehen muss.

Wo ein Zeichen wirklich hilft, ist es jetzt **gezeichnet**: dieselben dünnen
Striche wie die Symbole auf der Karte, in einer Farbe, auf jedem Gerät gleich.
Das betrifft die Aktivitätsliste (Zelt, Berg, Stern, Sprechblase, Kamera), die
Gipfel, die Wege-Knöpfe und die Plus-Seite.

Emojis geblieben sind nur zwei Sorten:

- **Die Abzeichen** — dort ist das Zeichen das Abzeichen und nicht seine
  Verzierung.
- **Das Wetter** — ein Regenschauer als Bild ist schneller erfasst als das Wort,
  und die Symbole stehen dort für sich, nicht neben einem Text, der dasselbe
  sagt.

### Hell und dunkel

Die App startet **hell** — warmes Papierbeige, wie Komoot. Bei Sonne draußen
ist das lesbar, wo Dunkelgrau verschwindet.

Im Profil unter *Aussehen* lässt sich auf **dunkel** stellen: der bisherige
Waldlook. Im Zelt um 22 Uhr blendet Weiß. Beim allerersten Start folgt die App
der Einstellung deines Handys.

### Einen Spot antippen

Egal wo — auf einer Kachel bei *Entdecken*, in der *Merkliste* oder auf der
Karte: Es geht immer **dasselbe Blatt** auf, mit Fotos, Angaben, Wetter,
Bewertung und Kommentaren.

**Der Bereich wechselt dabei nicht.** Wer bei Entdecken stöbert, bleibt bei
Entdecken — beim Schließen des Blattes steht man wieder genau dort, wo man war,
und kann sich durch zehn Spots lesen, ohne die Liste zu verlieren.

Wo der Spot liegt, ist die Frage danach. Dafür steht ganz oben im Blatt der
grüne Knopf **Auf der Karte anzeigen**: Er springt zur Karte, fliegt hin — und
lässt das Blatt offen, damit die Angaben nicht verloren gehen. Liegt das Blatt
ohnehin schon über der Karte, gibt es den Knopf nicht.

### Das Herz

An jeder Spot-Kachel und oben im Spot-Blatt sitzt ein Herz. Es legt den Spot
auf die **Merkliste** — die ist privat, niemand sonst sieht sie. Dafür braucht
es ein Konto, sonst wäre die Liste beim nächsten Gerät weg.

### Die Filter

Es gibt **28 Filter** in sieben Gruppen — Wasser, Lage, Zustieg, Der Platz,
Regeln und Empfang, Jahreszeit, Ruf und Alter. Sie liegen hinter einem
**Filterknopf**, der an zwei Stellen steht: über der Karte (oben links, als
Glasknopf) und auf der Entdecken-Seite am Ende der Chipreihe. Die Zahl im Knopf
sagt, wie viele Filter gerade gesetzt sind.

> **Warum ein Knopf statt einer Chipreihe:** Über der Karte lag bis zum
> 2026-08-16 eine Reihe aus acht Chips, die man seitlich schieben musste. Auf
> einem Handy sah man drei davon — die anderen fünf existierten für die
> meisten Leute nicht. Ein Blatt mit allen Filtern untereinander zeigt in einer
> Sekunde, was überhaupt geht.

Auf der Entdecken-Seite stehen **vier** davon zusätzlich als Reihe neben dem
Knopf — die häufigsten Fragen als Abkürzung. Im Blatt sind sie noch einmal mit
dabei.

Beide Orte zeigen **dieselbe Auswahl** — was hier gesetzt wird, ist dort
gesetzt. Nur die Antwort sieht an jedem der beiden Orte anders aus:

| Wo getippt | Was passiert |
|------------|--------------|
| **Entdecken** | Man bleibt auf der Seite. Direkt unter den Chips kommen die Treffer als Kacheln mit Bild, zwei nebeneinander. Der Rest der Seite tritt so lange zurück. |
| **Karte** | Man bleibt auf der Karte. Es bleiben nur die passenden Punkte stehen — auch beim Weiterschieben, für alles, was neu dazugeladen wird. |

Der Grund für die Trennung: Wer einen Filter setzt, stellt eine Frage („Welche
Plätze liegen über 1.500 m?"). Auf einer Karte sind ein paar Punkte darauf
keine Antwort — man sieht weder Name noch Bild. Früher sprang die App beim
Antippen sofort zur Karte; heute entscheidet der Ort, an dem man tippt.

Auf der Karte wird **ohne neue Abfrage** gefiltert: Die Punkte sind längst
geladen, es werden nur welche ausgeblendet. Das geht sofort und auch ohne
Empfang. Die Trefferliste auf Entdecken holt dagegen alle passenden Spots aus
der Datenbank (`spots_filtern`, `db/019-filter.sql`) — sie soll auch Plätze
zeigen, die weit weg vom aktuellen Kartenausschnitt liegen. Deshalb steht jede
Bedingung an zwei Stellen: als Kartenausdruck in `screens.js` und als
SQL-Zeile in der Migration.

**Ein Filter ist kostenlos, mehrere gleichzeitig gehören zu Plus.**

Ein Filter, der keine Kartenregel hat (*Mit Fotos*), wirkt nur auf die
Trefferliste: Ob ein Spot Fotos hat, weiß der Kartenpunkt nicht.

---

## Gipfel sammeln

Auf der Karte liegt seit dem 2026-08-16 eine neue Ebene: **14.560 Gipfel**
Österreichs aus OpenStreetMap, jeder mit Namen und Höhe (`kind = 'peak'` in
`water_points`, importiert mit `node scripts/import-peaks.mjs`).

Ein Gipfel antippen — auf der Karte, in der Suche, in einer Liste — öffnet sein
**Gipfelblatt**: Höhe, der wievielthöchste des Landes, wie viele schon oben
waren, wer zuletzt. Und den Knopf **„Ich war oben"**, dazu freiwillig ein Datum
und ein Satz.

Gesammelte Gipfel werden auf der Karte **goldgelb** statt schiefergrau. Das ist
der ganze Reiz daran: Man sieht im Vorbeiscrollen, wo man schon überall
gestanden ist, ohne eine Liste zu öffnen.

Wo Gipfel stehen:

| Ort | Was man dort sieht |
|-----|--------------------|
| **Karte** | Alle Gipfel im Ausschnitt, ab Zoom 11. Nie zu Blasen zusammengefasst — man muss sie einzeln antippen können |
| **Entdecken → Spots** | Der Block *Gipfel sammeln*: ohne Konto die höchsten, mit Konto die, die dir noch fehlen |
| **Gipfelliste** (Knopf *Alle ansehen*) | Die höchsten, noch offene, meine, in der Nähe — mit Suche |
| **Merkliste → Gipfel** | Deine gesammelten |
| **Profil** | Deine gesammelten und die Zahlen dazu |

> **Warum Gipfel und nicht Touren:** Ein Gipfel ist ein Punkt — man war oben
> oder nicht, und beides lässt sich ehrlich speichern. Kilometer und Gehzeit
> bräuchten eine Aufzeichnung im Hintergrund, und die kann eine Webseite nicht
> (siehe unten).

## Abzeichen

Fünfzehn Stück, vom *Ersten Spot* über *Winterbiwak* bis *Fünfzig Gipfel*. Sie
stehen im Profil, erreichte zuerst, darunter die offenen **mit Fortschritt**
(„3 von 10") — denn ein Abzeichen zieht nur, wenn man sieht, wie weit man ist.

Auf **fremden** Profilen stehen nur die erreichten: Der Fortschritt eines
anderen liest sich wie eine Bewertung und geht niemanden etwas an.

Vergeben wird nichts — die Abzeichen werden bei jedem Aufruf aus den Daten
**gerechnet** (`abzeichen(...)` in `db/020`). Ein neues Abzeichen ist damit
eine Zeile SQL und nicht ein Durchlauf über alle Konten.

## Kilometer und Zeit — warum die fehlen

Im Profil stehen drei Zahlen ausdrücklich als Strich: **km, Stunden,
Höhenmeter**. Der Grund steht dort auch:

Ein Browser darf im Hintergrund nicht dauerhaft den Standort verfolgen. Sobald
der Bildschirm aus ist oder man die App wechselt, hört er auf zu zählen — die
halbe Strecke fehlt, und niemand merkt es. Eine Zahl, die falsch ist, ohne dass
man es sieht, ist schlechter als gar keine.

Vorbereitet ist alles: Die Tabelle `tracks` (`db/020`) steht, und die Statistik
rechnet schon mit ihr. Sobald es Wild Spot als echte App gibt — oder jemand
eine GPX-Datei hochlädt — stehen die Zahlen sofort überall, ohne dass eine
Abfrage geändert werden muss.

---

## Leute und Aktivität

**Leute** (Entdecken → *Leute*): Namen suchen, Vorschläge zum Folgen (die, die
am meisten beigetragen haben), und die Gipfel-Bestenliste. Folgen geht einseitig
und ohne Zustimmung, wie bei Komoot.

Eine Suche nach E-Mail-Adressen gibt es bewusst **nicht** — man findet jemanden
über seinen Namen in Wild Spot oder gar nicht.

Auf jedem Profil sind die Zahlen **Follower** und **gefolgt** anklickbar und
öffnen die jeweilige Liste.

**Aktivität** (Entdecken → *Aktivität*): fünf Arten von Ereignissen in einer
Spur — Beitrag, Gipfel, neuer Spot, Bewertung, Kommentar. Umschaltbar zwischen
*Alle* und *Nur wem ich folge*, und dieselbe Liste steht auf jedem Profil unter
*Letzte Aktivität*.

> **Der Unterschied zum Feed in einem Satz:** Der Feed zeigt Erzählungen, die
> Aktivität zeigt Bewegung. Wer einen Gipfel einträgt, schreibt dazu keinen
> Beitrag — in der Aktivität steht es trotzdem.

Die Aktivität ist eine **Abfrage über fünf Tabellen** (`aktivitaeten(...)`) und
kein Ereignisprotokoll. Ein Protokoll wäre schneller, müsste aber bei jedem
Löschen mitgepflegt werden — und ein Strom, in dem Gelöschtes stehen bleibt,
ist schlimmer als ein langsamer Strom.

---

## Auf der Karte

Oben liegt in jeder Ecke **ein** Knopf. Alles andere klappt sich von dort auf —
die Karte soll den Platz haben, nicht die Bedienung.

| Bedienelement | Was es tut |
|---------------|------------|
| **Ebenen-Knopf (oben links)** | Kartenstil wählen und Datenebenen ein- und ausblenden (Spots, Bergseen, Wasserfälle, **Gipfel**, Wasserstellen, Unterkünfte) |
| **Filter-Knopf (darunter)** | Klappt das Filterblatt mit allen 28 Filtern auf; die Zahl darin sagt, wie viele gesetzt sind |
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

**Bergseen und Wasserfälle sind die Ausnahme** — die siehst du schon in der
Übersicht. Von beiden gibt es nur ein paar tausend im Land, und meistens sucht
man genau nach so einem: Sie sind nicht nur Wasser, sondern ein Grund,
überhaupt dort hinzugehen.

Als Bergsee zählt jeder See über 900 m; darunter liegen die großen bekannten
(Wörthersee, Attersee, Neusiedler See), die hier niemanden interessieren.
Die Höhe steht im Popup.

Dicht beieinanderliegende Punkte werden zu einem größeren Kreis
zusammengefasst — draufklicken zoomt hinein, bis sie auseinanderfallen.
Bergseen, Wasserfälle und Spots nie: die sind zu selten dafür.

**Auf der Karte stehen dieselben Zeichen wie in der Legende** — Zelt, Berge,
Wasserfall, Tropfen, Hütte, durchgehend von der Österreich-Übersicht bis ganz
nah, nur unterschiedlich groß. Es gibt keinen Kreis darunter: das Zeichen
selbst trägt die Farbe.

Damit es auf jedem Untergrund lesbar bleibt, wird jedes zweimal übereinander
gezeichnet — zuerst dick in Weiß, dann dünner in seiner Farbe. Ohne diesen
weißen Rand verschwindet ein blaues Zeichen im blauen Bach.

Die Symbole werden nicht doppelt gepflegt, sondern beim Start aus der Legende
im HTML ausgelesen und umgefärbt. Sie können also gar nicht auseinanderlaufen.

Bei den **Spots** zeigt die Farbe des Zeltes die Bewertung: grün (gut oder noch
nicht bewertet), gelb (mittelmäßig), braun (schwach).

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

- **Android (Chrome):** In den Einstellungen (Zahnrad) steht der Knopf
  *App installieren*. Alternativ: Menü ⋮ → *App installieren*
- **iPhone (Safari):** Teilen-Symbol → *Zum Home-Bildschirm*

Danach startet sie wie eine App: eigenes Zelt-Symbol, Vollbild ohne
Adresszeile — und sie öffnet sich auch ohne Empfang.

### Was am Handy zu beachten ist

- Der **PC muss laufen** und der Server offen sein. Schließt du das Fenster
  oder drückst `Strg` + `C`, ist die Seite am Handy sofort tot.
- **Unterwegs geht es über diese Adresse nicht** — nur im eigenen WLAN. Dafür
  gibt es die App im Netz: https://fermasster0-rgb.github.io/wild-spot/
  Der Weg hierüber ist nur zum Ausprobieren neuer Änderungen da.
- Der **Positionsknopf ➤ funktioniert am Handy nicht**, weil die Adresse
  `http://192.168.…` und nicht `https` ist. Browser geben den Standort nur
  auf `localhost` oder über eine gesicherte Verbindung frei. Alles andere —
  Karte, Spots, Fotos, Bewerten, Kommentieren — läuft normal.

> **Der Grund, warum das hier umständlich ist:** Diese Anleitung beschreibt die
> App auf deinem PC — dafür braucht es Server, WLAN und die IP-Adresse. Im
> Alltag tippst du stattdessen die feste Adresse oben ein oder öffnest die
> installierte App vom Startbildschirm.

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
| `screens.js` | Die Leiste unten, die Bereiche Entdecken/Merkliste/Profil und die Filter |
| `feed.js` | Beiträge, Gefällt mir, das Profilblatt einer Person |
| `gipfel.js` | Gipfel sammeln, das Gipfelblatt, die Gipfelliste, Abzeichen, Zahlen |
| `leute.js` | Leute suchen und folgen, Follower-Listen, der Aktivitätsstrom |
| `plus.js` | Wild Spot Plus: Zustand, Schranken, Verkaufsseite |
| `app.js` | Die Karte: Ebenen, Datenabfrage, Position |
| `auth.js` | Anmelden, Registrieren, Abmelden |
| `spot-form.js` | Das Formular zum Anlegen eines Spots |
| `spot-detail.js` | Die Leiste rechts: Angaben, Bewertungen, Kommentare |
| `wetter.js` | Wetter und Nachttemperatur am Spot (Open-Meteo) |
| `route.js` | Die Wanderroute Parkplatz → Spot: Linie, Gehzeit, Höhenmeter |
| `teilen.js` | Der Teilen-Knopf und das Öffnen geteilter Spot-Links |
| `suche.js` | Die Suchleiste über Spots, OSM-Punkte und Orte |
| `foto-ort.js` | Liest die Koordinaten aus einem Handyfoto (EXIF) |
| `intro.js` | Die Einführung beim allerersten Start |
| `offline.js` | Meldet den Service Worker an, Installieren-Knopf, Funkloch-Hinweis |
| `sw.js` | Der Service Worker: hält App, Kacheln und Fotos offline |
| `manifest.webmanifest` | Macht die Seite installierbar (Name, Symbol, Vollbild) |
| `config.js` | Die Zugangsdaten — das Einzige, was du anfassen musst |
| `server.mjs` | Der kleine Webserver zum Ausprobieren |
| `oesterreich-maske.geojson` | Der Landesumriss, damit die Karte an der Grenze endet |

---

## Offline: was geht und was nicht

Seit `sw.js` dabei ist, hält das Handy die App fest:

- **Die App startet ohne Netz.** Auch im Flugmodus, auch am Berg.
- **Kartenkacheln bleiben liegen**, sobald sie einmal geladen wurden. Deshalb
  gilt: *Die Tour vorher zu Hause einmal auf der Karte abfahren* — dann ist
  das Gebiet unterwegs da.
- **Spots werden mitgeschrieben.** Ohne Netz erscheinen die zuletzt geladenen.
  Sie liegen in `localStorage`, weil die Datenbank sie über einen `rpc`-Aufruf
  liefert und der Browser schreibende Aufrufe nicht aufheben darf.
- **Was nicht geht:** ein Gebiet im Voraus herunterladen, und alles Schreibende
  (anlegen, bewerten, kommentieren, Fotos) — das braucht Empfang.

In den Einstellungen (Zahnrad) steht unter *Karte offline*, wie viel gespeichert
ist, und dort lässt es sich auch wieder leeren.

> **Wenn am Handy eine alte Fassung klebt:** Die Nummer in `sw.js` (`VERSION`)
> setzt `scripts/veroeffentlichen.mjs` bei jedem Veröffentlichen neu. Kommt die
> Änderung trotzdem nicht an, hilft: App schließen und neu öffnen — beim
> Starten wird ein Hinweis *„Neue Fassung da"* eingeblendet.

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
