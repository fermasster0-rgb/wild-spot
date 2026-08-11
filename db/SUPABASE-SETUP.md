# Supabase einrichten

> **Status 2026-08-04: erledigt.** Das Projekt läuft
> (`aokovrrxvglxpccezjjr`, Region Frankfurt), das Schema ist eingespielt,
> alle sechs Tabellen stehen mit aktiver Row Level Security.
>
> Die Zugangsdaten liegen in `.env.local` im Projektordner — nicht mehr hier,
> und nicht auf GitHub.
>
> **Ab jetzt läuft alles über Skripte, nicht über Klicken:**
>
>     node db/run-sql.mjs db/schema.sql   # Schema einspielen (wiederholbar)
>     node db/check.mjs                   # prüfen, ob alles steht
>
> Die Klick-Anleitung unten bleibt als Nachschlagewerk stehen — für den Fall,
> dass du das Projekt mal neu aufsetzen musst.

---

Ungefähr 20 Minuten. Kein Code nötig, nur einmal Kopieren und Einfügen.

Supabase ist Datenbank, Login und Fotospeicher in einem — du musst keinen
eigenen Server betreiben. Der Free Tier reicht für dieses Projekt locker.

---

## 1. Account und Projekt anlegen

1. Auf [supabase.com](https://supabase.com) gehen → **Start your project**
2. Mit dem **GitHub-Account** anmelden (den hast du schon — spart ein Passwort)
3. **New project** anklicken und ausfüllen:

   | Feld | Wert |
   |------|------|
   | Name | `wildcamp-at` |
   | Database Password | Ein starkes Passwort erzeugen lassen |
   | Region | **Central EU (Frankfurt)** — `eu-central-1` |
   | Plan | Free |

> **Das Datenbank-Passwort sofort sicher speichern** (Passwort-Manager oder
> deine Notizen). Supabase zeigt es nur einmal. Du brauchst es selten, aber
> wenn, dann dringend.

> **Warum Frankfurt:** Die Daten bleiben in der EU (DSGVO) und die Verbindung
> aus Österreich ist schneller als über die USA.

Das Projekt braucht ein bis zwei Minuten, bis es bereit ist.

---

## 2. Schema einspielen

1. Links in der Seitenleiste auf **SQL Editor**
2. **New query**
3. Die komplette Datei [`schema.sql`](schema.sql) öffnen, alles markieren,
   kopieren, ins Fenster einfügen
4. **Run** (oder `Strg` + `Enter`)

Unten sollte **Success. No rows returned** stehen.

### Wenn ein Fehler kommt

Die Fehlermeldung **komplett kopieren** und mir schicken — nicht umschreiben,
nicht zusammenfassen. Die Meldung ist die nützlichste Information, die es gibt.

Zwei bekannte Fälle:

- *„extension postgis is not available"* → In der Seitenleiste **Database →
  Extensions**, dort `postgis` suchen und einschalten. Dann das Skript nochmal
  laufen lassen.
- *„type geography does not exist"* → Dasselbe Problem, gleiche Lösung.

Das Skript darfst du jederzeit erneut ausführen, es macht nichts kaputt.

---

## 3. Prüfen, ob alles steht

Im SQL Editor eine neue Query, die drei Zeilen einfügen und ausführen:

    select postgis_version();
    select count(*) from public.spots;
    select * from public.spots_in_bbox(46.3, 9.5, 49.1, 17.2);

> **Merke fürs nächste Mal:** Zeilen, die nur aus drei Backticks (` ``` `)
> bestehen, sind Formatierung und gehören **nie** mit in den SQL Editor.
> Sonst kommt `syntax error at or near "```"`.

Erwartet: eine PostGIS-Version, eine `0`, und eine leere Liste. **Kein Fehler**
ist das Ergebnis, auf das es ankommt — leer ist völlig richtig, es gibt ja noch
keine Spots.

Danach links auf **Table Editor**: dort müssen jetzt sechs Tabellen stehen —
`profiles`, `spots`, `spot_photos`, `ratings`, `comments`, `water_points`.

---

## 4. Fotospeicher anlegen

1. Seitenleiste → **Storage** → **New bucket**
2. Name: `spot-photos`
3. **Public bucket** einschalten
4. **Create**

Danach zurück in den SQL Editor: in `schema.sql` ganz unten steht Abschnitt 8.
Dort die auskommentierten Zeilen (die mit `--` am Anfang) markieren, die `--`
entfernen und diesen Block ausführen. Das regelt, dass jeder nur in seinen
eigenen Ordner hochladen kann.

*(Das kann auch warten, bis wir tatsächlich Fotos einbauen.)*

---

## 5. Login-Einstellungen

Seitenleiste → **Authentication** → **Sign In / Providers**:

- **Email** muss aktiv sein (ist es standardmäßig)
- **Confirm email** für den Anfang **ausschalten** — sonst musst du bei jedem
  Testkonto erst eine Bestätigungsmail abrufen. Vor dem Verteilen an Freunde
  wieder einschalten.

---

## 6. Die zwei Schlüssel merken

Seitenleiste → **Project Settings** → **API Keys**. Dort stehen:

| Schlüssel | Wofür | Geheim? |
|-----------|-------|---------|
| **Project URL** | Adresse deiner Datenbank | Nein |
| **anon / publishable key** | Damit spricht die App | Nein — darf öffentlich sein, RLS schützt die Daten |
| **service_role / secret key** | Nur für das Wasserstellen-Import-Skript | **JA. Niemals in die App, niemals auf GitHub.** |

Der `service_role`-Schlüssel umgeht sämtliche Sicherheitsregeln. Er gehört
ausschließlich in eine `.env`-Datei auf deinem PC, und die `.env` gehört in die
`.gitignore`.

---

## Fertig

Damit steht das Fundament. Was jetzt möglich wäre:

- **Wasserstellen importieren** — ein Skript holt alle Quellen, Brunnen und
  Trinkwasserstellen Österreichs aus OpenStreetMap in deine `water_points`.
  Das ist der Schritt, nach dem sich das Projekt zum ersten Mal echt anfühlt:
  ein paar tausend Wasserstellen, die dir gehören.
- **Entscheidung Web oder App** — siehe KONZEPT.md, Abschnitt 8.
