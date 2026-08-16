-- ============================================================================
-- Migration 020 — Gipfel, Abzeichen, Aktivität und Leute
-- Stand: 2026-08-16
--
-- Wild Spot konnte bis hierher zwei Dinge: Plätze zeigen (die Karte) und
-- Leute erzählen lassen (Migration 018). Was fehlte, ist der Grund
-- wiederzukommen, wenn man gerade nicht draußen ist.
--
-- Komoot löst das über drei Dinge, und genau die stehen hier:
--
--   Letzte Aktivität  Ein Strom von Ereignissen statt nur Beiträgen: Wer war
--                     auf welchem Gipfel, wer hat einen Spot eingetragen, wer
--                     hat bewertet. Der Feed zeigt Erzählungen, die Aktivität
--                     zeigt Bewegung.
--
--   Leute finden      Suchen, Vorschläge, Follower-Listen. Ohne das ist
--                     "Folgen" eine Funktion ohne Eingang: Man kann nur
--                     jemandem folgen, dessen Beitrag einem zufällig
--                     unterkommt.
--
--   Sammeln           Gipfel. Sie sind der eine Teil des Bergsports, der sich
--                     ehrlich zählen lässt, ohne dass die App mitlaufen muss:
--                     Ein Gipfel ist ein Punkt, man war oben oder nicht.
--                     Kilometer und Zeit brauchen dagegen eine Aufzeichnung
--                     im Hintergrund — die kann eine Webseite nicht. Dafür
--                     steht hier die Tabelle "tracks" schon bereit, leer und
--                     mit Absicht.
--
-- ----------------------------------------------------------------------------
-- DREI ENTSCHEIDUNGEN, DIE HIER FESTGESCHRIEBEN SIND
--
-- 1. Gipfel bekommen KEINE eigene Tabelle. Sie liegen als kind 'peak' in
--    water_points — der Tabelle, in der schon Hütten, Campingplätze und
--    Bergseen stehen. Ihr Name ist historisch, ihr Inhalt ist längst
--    "Punkte aus OpenStreetMap". Der Gewinn ist groß: Kartenabfrage nach
--    Ausschnitt, Import-Skript, Symbole und Ebenenschalter gibt es schon,
--    und ein Gipfel verhält sich auf der Karte exakt wie ein Wasserfall.
--
-- 2. Abzeichen werden GERECHNET, nicht gespeichert. Es gibt keine Tabelle
--    "verliehene Abzeichen" und keinen Trigger, der sie vergibt. Der Stand
--    ergibt sich jedes Mal neu aus den Daten. Damit kann nichts
--    auseinanderlaufen — und ein neues Abzeichen ist eine Zeile hier statt
--    einer Wanderung durch alle bestehenden Konten.
--
-- 3. Die Aktivität ist eine ABFRAGE, keine Tabelle. Sie fügt Beiträge,
--    Spots, Gipfel, Bewertungen und Kommentare zusammen. Ein Ereignisprotokoll
--    wäre schneller, müsste aber bei jedem Löschen mitgepflegt werden — und
--    ein Feed, in dem gelöschte Dinge stehen bleiben, ist schlimmer als ein
--    langsamer Feed.
--
-- Wiederholbar: kann mehrfach laufen.
-- ============================================================================


-- ============================================================================
-- 1. GIPFEL SIND EINE ART VON PUNKT
--
-- Die Prüfliste muss neu geschrieben werden — "add constraint" allein kann
-- eine bestehende nicht erweitern.
-- ============================================================================

alter table public.water_points
  drop constraint if exists water_points_kind_check;

alter table public.water_points
  add constraint water_points_kind_check check (kind in (
    -- Wasser
    'spring',            -- Quelle
    'drinking_water',    -- Trinkbrunnen
    'well',              -- Brunnen
    'water_tap',         -- Wasserhahn
    'water',             -- Gewässer allgemein
    'mountain_lake',     -- Bergsee
    'waterfall',         -- Wasserfall
    -- Unterkünfte und Unterstände
    'shelter',           -- Biwakschachtel, Schutzdach, Felsunterstand
    'alpine_hut',        -- bewirtschaftete Berghütte
    'wilderness_hut',    -- Selbstversorgerhütte
    'chalet',            -- Almhütte / Hütte zum Mieten
    'camp_site',         -- Campingplatz
    'backcountry_camp',  -- Trekking- und Biwakplatz
    -- Neu: Ziele
    'peak'               -- Gipfel
  ));

-- Gipfel werden fast immer nach Höhe sortiert gesucht ("die höchsten", "alles
-- über 3.000"). Dafür ein eigener Index, sonst liest die Datenbank für jede
-- Bestenliste alle 60.000 Punkte durch.
create index if not exists water_points_peak_hoehe_idx
  on public.water_points (elevation_m desc)
  where kind = 'peak';


-- ============================================================================
-- 2. GESAMMELTE GIPFEL
--
-- Ein Eintrag heißt: Diese Person war auf diesem Gipfel. Mehrfach oben
-- gewesen zu sein ändert daran nichts — deshalb ein Schlüssel aus beiden
-- Spalten und kein zweiter Eintrag. Das Datum ist das der letzten Besteigung,
-- es lässt sich überschreiben.
-- ============================================================================

create table if not exists public.peak_logs (
  user_id     uuid not null references public.profiles(id) on delete cascade,
  peak_id     uuid not null references public.water_points(id) on delete cascade,

  -- Wann. Freiwillig: Wer einen Gipfel von vor zehn Jahren nachträgt, weiß
  -- das Datum oft nicht mehr — und soll ihn trotzdem eintragen können.
  besucht_am  date,

  notiz       text check (notiz is null or char_length(notiz) <= 500),
  created_at  timestamptz not null default now(),

  primary key (user_id, peak_id)
);

create index if not exists peak_logs_gipfel_idx on public.peak_logs (peak_id);
create index if not exists peak_logs_neu_idx    on public.peak_logs (created_at desc);

alter table public.peak_logs enable row level security;

-- Wer wo oben war, ist öffentlich — sonst gäbe es keine Bestenliste und
-- keine Aktivität. Wie bei den Spots: ansehen darf jeder, eintragen nur der
-- Angemeldete, und nur bei sich selbst.
drop policy if exists "gipfel lesen" on public.peak_logs;
create policy "gipfel lesen" on public.peak_logs
  for select to anon, authenticated using (true);

drop policy if exists "eigenen gipfel eintragen" on public.peak_logs;
create policy "eigenen gipfel eintragen" on public.peak_logs
  for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "eigenen gipfel aendern" on public.peak_logs;
create policy "eigenen gipfel aendern" on public.peak_logs
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "eigenen gipfel entfernen" on public.peak_logs;
create policy "eigenen gipfel entfernen" on public.peak_logs
  for delete to authenticated using (auth.uid() = user_id);


-- ============================================================================
-- 3. TOUREN — die Tabelle, die noch leer bleibt
--
-- Kilometer, Gehzeit und Höhenmeter sind das, was eine Wander-App eigentlich
-- zählt. Wild Spot kann das heute NICHT ehrlich: Eine Webseite darf im
-- Hintergrund nicht dauerhaft den Standort verfolgen — sobald der Bildschirm
-- aus ist oder man die Seite wechselt, hört sie auf zu zählen. Eine Zahl, die
-- die Hälfte der Strecke verschluckt, ist schlimmer als keine.
--
-- Deshalb steht die Tabelle hier schon, aber die App schreibt noch nicht
-- hinein. Was sie heute schon tut: die Statistik rechnet mit ihr. Sobald es
-- eine echte App gibt (oder jemand eine GPX-Datei hochlädt), stehen die
-- Kilometer sofort überall, ohne dass eine einzige Abfrage geändert werden
-- muss.
--
-- quelle sagt, woher die Zahlen kommen — das ist wichtiger, als es aussieht:
-- Eine von Hand eingetragene Tour und eine aufgezeichnete dürfen in einer
-- Bestenliste nicht gleich zählen.
-- ============================================================================

create table if not exists public.tracks (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles(id) on delete cascade,

  titel        text check (titel is null or char_length(titel) <= 120),
  spot_id      uuid references public.spots(id) on delete set null,

  strecke_m    integer check (strecke_m    is null or strecke_m    between 0 and 1000000),
  dauer_s      integer check (dauer_s      is null or dauer_s      between 0 and 1000000),
  aufstieg_m   integer check (aufstieg_m   is null or aufstieg_m   between 0 and 30000),
  abstieg_m    integer check (abstieg_m    is null or abstieg_m    between 0 and 30000),

  gestartet_am timestamptz,
  quelle       text not null default 'hand'
                 check (quelle in ('hand', 'aufgezeichnet', 'gpx')),

  created_at   timestamptz not null default now()
);

create index if not exists tracks_wer_idx on public.tracks (user_id, gestartet_am desc);

alter table public.tracks enable row level security;

drop policy if exists "touren lesen" on public.tracks;
create policy "touren lesen" on public.tracks
  for select to anon, authenticated using (true);

drop policy if exists "eigene tour schreiben" on public.tracks;
create policy "eigene tour schreiben" on public.tracks
  for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "eigene tour aendern" on public.tracks;
create policy "eigene tour aendern" on public.tracks
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "eigene tour loeschen" on public.tracks;
create policy "eigene tour loeschen" on public.tracks
  for delete to authenticated using (auth.uid() = user_id);


-- ============================================================================
-- 4. DIE GIPFELLISTE
--
-- Eine Abfrage für drei Ansichten: alle Gipfel, nur meine gesammelten, oder
-- die Suche nach einem Namen. Dazu immer: war ich oben, wann, und wie viele
-- andere waren es.
--
-- welche = 'alle'      alle Gipfel, höchster zuerst
--          'meine'     nur die, die ich gesammelt habe
--          'offen'     alle außer meinen — die Liste zum Abarbeiten
--          'nah'       nach Entfernung vom übergebenen Standort
-- ============================================================================

drop function if exists public.gipfel_liste(text, text, double precision, double precision, integer, integer);

create or replace function public.gipfel_liste(
  welche    text             default 'alle',
  suche     text             default null,
  von_lat   double precision default null,
  von_lng   double precision default null,
  ab_hoehe  integer          default 0,
  anzahl    integer          default 40
)
returns table (
  id            uuid,
  name          text,
  elevation_m   integer,
  lat           double precision,
  lng           double precision,
  ich_war       boolean,
  besucht_am    date,
  sammler       bigint,
  entfernung_km double precision
)
language sql
stable
security invoker
set search_path = public, extensions
as $$
  select
    w.id, w.name, w.elevation_m,
    st_y(w.location::geometry) as lat,
    st_x(w.location::geometry) as lng,

    exists (select 1 from public.peak_logs l
            where l.peak_id = w.id and l.user_id = auth.uid()) as ich_war,

    (select l.besucht_am from public.peak_logs l
      where l.peak_id = w.id and l.user_id = auth.uid()) as besucht_am,

    (select count(*) from public.peak_logs l where l.peak_id = w.id) as sammler,

    case
      when von_lat is null or von_lng is null then null
      else round((st_distance(w.location, st_point(von_lng, von_lat)::geography)
                  / 1000)::numeric, 1)::double precision
    end as entfernung_km

  from public.water_points w
  where w.kind = 'peak'
    and w.name is not null
    and coalesce(w.elevation_m, 0) >= coalesce(ab_hoehe, 0)

    -- Der Name muss passen, wenn gesucht wird. Unter zwei Zeichen wird nicht
    -- gefiltert: Ein einzelner Buchstabe trifft ohnehin alles.
    and (suche is null or char_length(trim(suche)) < 2
         or w.name ilike '%' || trim(suche) || '%')

    and case coalesce(welche, 'alle')
      when 'meine' then exists (select 1 from public.peak_logs l
                                where l.peak_id = w.id and l.user_id = auth.uid())
      when 'offen' then not exists (select 1 from public.peak_logs l
                                    where l.peak_id = w.id and l.user_id = auth.uid())
      else true
    end

  order by
    -- Bei 'nah' zählt die Entfernung, sonst die Höhe. Ein Gipfel ist in einer
    -- Liste erst einmal so interessant, wie er hoch ist.
    case when welche = 'nah' and von_lat is not null and von_lng is not null then
      st_distance(w.location, st_point(von_lng, von_lat)::geography)
    end asc nulls last,
    w.elevation_m desc nulls last,
    w.name asc
  limit least(greatest(coalesce(anzahl, 40), 1), 200);
$$;

grant execute on function public.gipfel_liste(text, text, double precision, double precision, integer, integer)
  to anon, authenticated;


-- ============================================================================
-- 5. EIN EINZELNER GIPFEL
--
-- Alles, was im Gipfelblatt steht: die Angaben, ob ich oben war, wie viele
-- es waren und die letzten fünf Namen. Ein Aufruf statt vier.
-- ============================================================================

create or replace function public.gipfel_detail(gipfel_id uuid)
returns table (
  id           uuid,
  name         text,
  elevation_m  integer,
  lat          double precision,
  lng          double precision,
  ich_war      boolean,
  besucht_am   date,
  notiz        text,
  sammler      bigint,
  letzte       text[],
  rang         bigint
)
language sql
stable
security invoker
set search_path = public, extensions
as $$
  select
    w.id, w.name, w.elevation_m,
    st_y(w.location::geometry), st_x(w.location::geometry),

    exists (select 1 from public.peak_logs l
            where l.peak_id = w.id and l.user_id = auth.uid()),
    (select l.besucht_am from public.peak_logs l
      where l.peak_id = w.id and l.user_id = auth.uid()),
    (select l.notiz from public.peak_logs l
      where l.peak_id = w.id and l.user_id = auth.uid()),

    (select count(*) from public.peak_logs l where l.peak_id = w.id),

    array(select pr.username
          from public.peak_logs l
          join public.profiles pr on pr.id = l.user_id
          where l.peak_id = w.id
          order by l.created_at desc
          limit 6),

    -- Der wievielthöchste Gipfel des Landes ist das? Eine Zahl, die man
    -- sonst nirgends bekommt und die einem Namen sofort Gewicht gibt.
    (select count(*) + 1 from public.water_points h
      where h.kind = 'peak' and h.name is not null
        and h.elevation_m > w.elevation_m)

  from public.water_points w
  where w.id = gipfel_id and w.kind = 'peak';
$$;

grant execute on function public.gipfel_detail(uuid) to anon, authenticated;


-- ============================================================================
-- 6. DIE STATISTIK EINER PERSON
--
-- Die Zahlen, die auf dem Profil stehen. Bewusst in EINER Funktion: Auf einer
-- Profilseite acht einzelne Abfragen abzufeuern ist am Handy im Funkloch der
-- Unterschied zwischen "da" und "lädt noch".
--
-- Kilometer und Stunden kommen aus tracks und sind heute überall 0. Sie
-- stehen trotzdem drin — die App zeigt sie als "kommt noch" an, und in dem
-- Moment, in dem die erste Tour eingetragen wird, stimmen sie von selbst.
-- ============================================================================

create or replace function public.statistik(wessen_id uuid)
returns table (
  gipfel            bigint,
  gipfel_hoechster  integer,
  gipfel_meter      bigint,
  plaetze           bigint,
  naechte           bigint,
  spots_gelegt      bigint,
  beitraege         bigint,
  fotos             bigint,
  bewertungen       bigint,
  kommentare        bigint,
  km                numeric,
  stunden           numeric,
  aufstieg_m        bigint,
  touren            bigint,
  letzte_aktivitaet timestamptz
)
language sql
stable
security invoker
set search_path = public, extensions
as $$
  select
    (select count(*) from public.peak_logs l where l.user_id = wessen_id),

    (select max(w.elevation_m) from public.peak_logs l
       join public.water_points w on w.id = l.peak_id
      where l.user_id = wessen_id),

    -- Die Summe aller bestiegenen Gipfelhöhen. Das sind keine geleisteten
    -- Höhenmeter — es ist die Zahl, die man im Wirtshaus nennt ("ich hab
    -- schon 40.000 Meter Gipfel gesammelt"). Ehrlich benannt wird sie in der
    -- App: "Gipfelmeter gesammelt".
    (select coalesce(sum(w.elevation_m), 0) from public.peak_logs l
       join public.water_points w on w.id = l.peak_id
      where l.user_id = wessen_id),

    -- An wie vielen Plätzen war ich? Wie in profil(): ein Kommentar oder ein
    -- Beitrag zählt als "war da".
    (select count(*) from (
       select c.spot_id from public.comments c where c.user_id = wessen_id
       union
       select p.spot_id from public.posts p
        where p.user_id = wessen_id and p.spot_id is not null
     ) x),

    -- Nächte draußen: verschiedene Besuchsdaten. Zwei Beiträge vom selben
    -- Tag sind eine Nacht, nicht zwei.
    (select count(*) from (
       select c.visited_on from public.comments c where c.user_id = wessen_id
       union
       select p.visited_on from public.posts p
        where p.user_id = wessen_id and p.visited_on is not null
     ) y),

    (select count(*) from public.spots s        where s.created_by  = wessen_id),
    (select count(*) from public.posts p        where p.user_id     = wessen_id),
    (select count(*) from public.spot_photos f  where f.uploaded_by = wessen_id),
    (select count(*) from public.ratings r      where r.user_id     = wessen_id),
    (select count(*) from public.comments c     where c.user_id     = wessen_id),

    (select round(coalesce(sum(t.strecke_m), 0) / 1000.0, 1) from public.tracks t
      where t.user_id = wessen_id),
    (select round(coalesce(sum(t.dauer_s), 0) / 3600.0, 1) from public.tracks t
      where t.user_id = wessen_id),
    (select coalesce(sum(t.aufstieg_m), 0)::bigint from public.tracks t
      where t.user_id = wessen_id),
    (select count(*) from public.tracks t where t.user_id = wessen_id),

    -- Wann war diese Person zuletzt aktiv? Steht oben auf dem Profil und
    -- entscheidet, ob es sich lohnt, ihr zu folgen.
    greatest(
      (select max(p.created_at) from public.posts p     where p.user_id    = wessen_id),
      (select max(l.created_at) from public.peak_logs l where l.user_id    = wessen_id),
      (select max(s.created_at) from public.spots s     where s.created_by = wessen_id),
      (select max(c.created_at) from public.comments c  where c.user_id    = wessen_id)
    );
$$;

grant execute on function public.statistik(uuid) to anon, authenticated;


-- ============================================================================
-- 7. ABZEICHEN
--
-- Sie werden bei jedem Aufruf neu gerechnet. Jede Zeile unten ist ein
-- Abzeichen: Schlüssel, Titel, ein Satz dazu, ein Zeichen, der aktuelle
-- Stand und das Ziel.
--
-- Warum "stand" und "ziel" und nicht nur "hat er / hat er nicht": Ein
-- Abzeichen, das man nicht hat, ist nur dann ein Antrieb, wenn man sieht,
-- wie weit man ist. "3 von 10 Gipfeln" zieht, "noch nicht erreicht" nicht.
--
-- Die Reihenfolge ist die Anzeigereihenfolge: erst das, was fast jeder
-- schafft, dann das Seltene.
-- ============================================================================

drop function if exists public.abzeichen(uuid);

create or replace function public.abzeichen(wessen_id uuid)
returns table (
  schluessel text,
  titel      text,
  beschreibung text,
  zeichen    text,
  stand      bigint,
  ziel       bigint,
  erreicht   boolean
)
language sql
stable
security invoker
set search_path = public, extensions
as $$
  with z as (
    select
      (select count(*) from public.peak_logs l where l.user_id = wessen_id) as gipfel,
      (select count(*) from public.peak_logs l
         join public.water_points w on w.id = l.peak_id
        where l.user_id = wessen_id and w.elevation_m >= 2000) as gipfel2000,
      (select count(*) from public.spots s where s.created_by = wessen_id) as spots,
      (select count(*) from public.posts p where p.user_id = wessen_id) as posts,
      (select count(*) from public.spot_photos f where f.uploaded_by = wessen_id) as fotos,
      (select count(*) from public.ratings r where r.user_id = wessen_id) as bewertungen,
      (select count(*) from public.follows f where f.follower_id = wessen_id) as folgt,
      (select count(*) from (
         select c.spot_id from public.comments c where c.user_id = wessen_id
         union
         select p.spot_id from public.posts p
          where p.user_id = wessen_id and p.spot_id is not null
       ) x) as plaetze,
      (select count(*) from (
         select c.visited_on as d from public.comments c where c.user_id = wessen_id
         union
         select p.visited_on from public.posts p
          where p.user_id = wessen_id and p.visited_on is not null
       ) w where extract(month from w.d) in (12, 1, 2)) as winter,
      (select count(distinct case
                when extract(month from d) in (3, 4, 5)   then 1
                when extract(month from d) in (6, 7, 8)   then 2
                when extract(month from d) in (9, 10, 11) then 3
                else 4 end)
         from (
           select c.visited_on as d from public.comments c where c.user_id = wessen_id
           union
           select p.visited_on from public.posts p
            where p.user_id = wessen_id and p.visited_on is not null
         ) j) as jahreszeiten,
      (select coalesce(max(s.elevation_m), 0) from public.spots s
        where s.id in (
          select c.spot_id from public.comments c where c.user_id = wessen_id
          union
          select p.spot_id from public.posts p
           where p.user_id = wessen_id and p.spot_id is not null
        )) as hoechster_platz
  ),
  liste as (
    select * from z, lateral (values
      ('erste-nacht',   'Erste Nacht',       'Einmal draußen geschlafen und davon erzählt.',      '🌙', least(z.plaetze, 1),      1::bigint),
      ('erster-spot',   'Erster Spot',       'Einen eigenen Platz in die Karte eingetragen.',     '⛺', least(z.spots, 1),        1::bigint),
      ('erster-gipfel', 'Erster Gipfel',     'Einen Gipfel gesammelt.',                           '🏔️', least(z.gipfel, 1),       1::bigint),
      ('kritiker',      'Kenner',            'Fünf Plätze bewertet — das hilft allen anderen.',   '⭐', least(z.bewertungen, 5),  5::bigint),
      ('erzaehler',     'Erzähler',          'Fünf Beiträge geschrieben.',                        '📖', least(z.posts, 5),        5::bigint),
      ('gesellig',      'Nicht allein',      'Drei Leuten folgen.',                               '👣', least(z.folgt, 3),        3::bigint),
      ('kartograf',     'Kartograf',         'Fünf eigene Spots eingetragen.',                    '✏️', least(z.spots, 5),        5::bigint),
      ('fotograf',      'Fotograf',          'Zehn Fotos zu Spots beigesteuert.',                 '📷', least(z.fotos, 10),      10::bigint),
      ('zehn-naechte',  'Zehn Plätze',       'An zehn verschiedenen Plätzen übernachtet.',        '🗺️', least(z.plaetze, 10),    10::bigint),
      ('zehn-gipfel',   'Zehn Gipfel',       'Zehn Gipfel gesammelt.',                            '⛰️', least(z.gipfel, 10),     10::bigint),
      ('winterschlaf',  'Winterbiwak',       'Eine Nacht zwischen Dezember und Februar draußen.', '❄️', least(z.winter, 1),       1::bigint),
      ('zweitausender', 'Zweitausender',     'Auf einem Gipfel über 2.000 Metern gestanden.',     '🥾', least(z.gipfel2000, 1),   1::bigint),
      ('hochlager',     'Hochlager',         'An einem Platz über 2.000 Metern übernachtet.',     '🏕️',
         case when z.hoechster_platz >= 2000 then 1::bigint else 0::bigint end,                          1::bigint),
      ('jahreszeiten',  'Vier Jahreszeiten', 'In allen vier Jahreszeiten draußen geschlafen.',    '🍂', least(z.jahreszeiten, 4), 4::bigint),
      ('fuenfzig',      'Fünfzig Gipfel',    'Fünfzig Gipfel gesammelt. Das sind Jahre.',         '👑', least(z.gipfel, 50),     50::bigint)
    ) as d(schluessel, titel, beschreibung, zeichen, stand, ziel)
  )
  select
    l.schluessel, l.titel, l.beschreibung, l.zeichen,
    l.stand::bigint, l.ziel::bigint,
    (l.stand >= l.ziel) as erreicht
  from liste l
  -- Erreichte zuerst — eine Abzeichenwand soll zeigen, was man hat, und
  -- darunter, was als Nächstes drin wäre.
  order by (l.stand >= l.ziel) desc, l.ziel asc, l.titel asc;
$$;

grant execute on function public.abzeichen(uuid) to anon, authenticated;


-- ============================================================================
-- 8. DIE AKTIVITÄT
--
-- Fünf Arten von Ereignissen in einer Liste, neueste zuerst:
--
--   'beitrag'    jemand hat etwas erzählt
--   'gipfel'     jemand war oben
--   'spot'       jemand hat einen Platz eingetragen
--   'bewertung'  jemand hat einen Platz bewertet
--   'kommentar'  jemand hat einen Zustandsbericht hinterlassen
--
-- welcher = 'alle'   alles
--           'folge'  nur Leute, denen ich folge (und ich selbst)
--           'wer'    eine bestimmte Person (wessen_id)
--
-- Kommentare und Bewertungen sind in der Datenbank nur für Angemeldete
-- lesbar (so steht es seit schema.sql). Wer ohne Konto zusieht, bekommt
-- deshalb einen etwas dünneren Strom — das ist richtig so und kein Fehler.
-- ============================================================================

drop function if exists public.aktivitaeten(text, uuid, integer, timestamptz);

create or replace function public.aktivitaeten(
  welcher   text        default 'alle',
  wessen_id uuid        default null,
  anzahl    integer     default 30,
  ab        timestamptz default null
)
returns table (
  art          text,
  zeit         timestamptz,
  user_id      uuid,
  username     text,
  avatar_path  text,
  titel        text,
  inhalt       text,
  zahl         numeric,
  ziel_id      uuid,
  lat          double precision,
  lng          double precision,
  foto_pfad    text
)
language sql
stable
security invoker
set search_path = public, extensions
as $$
  with wer as (
    -- Wessen Ereignisse zählen? Einmal ausgerechnet, statt in jedem der fünf
    -- Teile noch einmal.
    select pr.id
    from public.profiles pr
    where case coalesce(welcher, 'alle')
      when 'folge' then
        pr.id = auth.uid()
        or exists (select 1 from public.follows f
                   where f.follower_id = auth.uid() and f.followed_id = pr.id)
      when 'wer' then pr.id = wessen_id
      else true
    end
  ),
  alles as (
    -- ---------------------------------------------------------- Beiträge
    select
      'beitrag'::text as art, p.created_at as zeit,
      p.user_id, p.body as inhalt,
      case when p.spot_zeigen then s.name else null end as titel,
      null::numeric as zahl,
      case when p.spot_zeigen then p.spot_id end as ziel_id,
      case when p.spot_zeigen then st_y(s.location::geometry) end as lat,
      case when p.spot_zeigen then st_x(s.location::geometry) end as lng,
      p.photo_path as foto_pfad
    from public.posts p
    join wer on wer.id = p.user_id
    left join public.spots s on s.id = p.spot_id

    union all

    -- ------------------------------------------------------------ Gipfel
    select
      'gipfel', l.created_at,
      l.user_id, l.notiz,
      w.name,
      w.elevation_m::numeric,
      w.id,
      st_y(w.location::geometry), st_x(w.location::geometry),
      null
    from public.peak_logs l
    join wer on wer.id = l.user_id
    join public.water_points w on w.id = l.peak_id

    union all

    -- --------------------------------------------------- Neue eigene Spots
    select
      'spot', s.created_at,
      s.created_by, s.description,
      s.name,
      s.elevation_m::numeric,
      s.id,
      st_y(s.location::geometry), st_x(s.location::geometry),
      (select f.storage_path from public.spot_photos f
        where f.spot_id = s.id
        order by f.sort_order asc nulls last, f.created_at asc limit 1)
    from public.spots s
    join wer on wer.id = s.created_by

    union all

    -- -------------------------------------------------------- Bewertungen
    select
      'bewertung', r.created_at,
      r.user_id, null,
      s.name,
      r.stars::numeric,
      s.id,
      st_y(s.location::geometry), st_x(s.location::geometry),
      null
    from public.ratings r
    join wer on wer.id = r.user_id
    join public.spots s on s.id = r.spot_id

    union all

    -- --------------------------------------------------------- Kommentare
    select
      'kommentar', c.created_at,
      c.user_id, c.body,
      s.name,
      null,
      s.id,
      st_y(s.location::geometry), st_x(s.location::geometry),
      null
    from public.comments c
    join wer on wer.id = c.user_id
    join public.spots s on s.id = c.spot_id
  )
  select
    a.art, a.zeit, a.user_id, pr.username, pr.avatar_path,
    a.titel, a.inhalt, a.zahl, a.ziel_id, a.lat, a.lng, a.foto_pfad
  from alles a
  join public.profiles pr on pr.id = a.user_id
  where ab is null or a.zeit < ab
  order by a.zeit desc
  limit least(greatest(coalesce(anzahl, 30), 1), 60);
$$;

grant execute on function public.aktivitaeten(text, uuid, integer, timestamptz)
  to anon, authenticated;


-- ============================================================================
-- 9. LEUTE SUCHEN — jetzt mit allem, was man zum Folgen wissen muss
--
-- Die alte Fassung konnte zwei Dinge nicht, die eine Suche zum Folgen braucht:
-- Sie war nur für Angemeldete (wer ohne Konto stöbert, sieht sonst niemanden)
-- und sie sagte nicht, ob man der Person schon folgt — der Knopf daneben
-- stand also immer auf "Folgen", auch bei Leuten, denen man längst folgt.
-- ============================================================================

drop function if exists public.leute_suchen(text, integer);

create or replace function public.leute_suchen(
  suche  text,
  anzahl integer default 12
)
returns table (
  id          uuid,
  username    text,
  avatar_path text,
  bio         text,
  beitraege   bigint,
  spots       bigint,
  gipfel      bigint,
  folgt_mir   bigint,
  ich_folge   boolean
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    pr.id, pr.username, pr.avatar_path, pr.bio,
    (select count(*) from public.posts p     where p.user_id    = pr.id),
    (select count(*) from public.spots s     where s.created_by = pr.id),
    (select count(*) from public.peak_logs l where l.user_id    = pr.id),
    (select count(*) from public.follows f   where f.followed_id = pr.id),
    exists (select 1 from public.follows f
            where f.follower_id = auth.uid() and f.followed_id = pr.id)
  from public.profiles pr
  where suche is not null
    and char_length(trim(suche)) >= 2
    and pr.username ilike '%' || trim(suche) || '%'
    and pr.id <> coalesce(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid)
  order by
    -- Wer genau so heißt, wie gesucht wurde, steht oben. Danach die, die am
    -- meisten beigetragen haben — das ist die brauchbarste Reihenfolge, wenn
    -- drei Leute ähnlich heißen.
    (lower(pr.username) = lower(trim(suche))) desc,
    (select count(*) from public.posts p where p.user_id = pr.id) desc,
    pr.username
  limit least(greatest(coalesce(anzahl, 12), 1), 30);
$$;

grant execute on function public.leute_suchen(text, integer) to anon, authenticated;


-- ============================================================================
-- 10. WEM KÖNNTE ICH FOLGEN?
--
-- Eine Suche hilft nur dem, der schon einen Namen kennt. Am Anfang kennt man
-- keinen. Deshalb eine Liste der Leute, die am meisten beigetragen haben und
-- denen ich noch nicht folge.
--
-- Bewusst keine "Empfehlung" aus Freundesfreunden: Bei einer App mit ein paar
-- Dutzend Leuten wäre das eine leere Liste mit einem klugen Namen.
-- ============================================================================

create or replace function public.leute_vorschlaege(anzahl integer default 12)
returns table (
  id          uuid,
  username    text,
  avatar_path text,
  bio         text,
  beitraege   bigint,
  spots       bigint,
  gipfel      bigint,
  folgt_mir   bigint,
  ich_folge   boolean,
  zuletzt     timestamptz
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    pr.id, pr.username, pr.avatar_path, pr.bio,
    p.anzahl_posts, s.anzahl_spots, g.anzahl_gipfel,
    (select count(*) from public.follows f where f.followed_id = pr.id),
    false,
    greatest(p.zuletzt, s.zuletzt, g.zuletzt)
  from public.profiles pr
  cross join lateral (
    select count(*) as anzahl_posts, max(x.created_at) as zuletzt
    from public.posts x where x.user_id = pr.id
  ) p
  cross join lateral (
    select count(*) as anzahl_spots, max(x.created_at) as zuletzt
    from public.spots x where x.created_by = pr.id
  ) s
  cross join lateral (
    select count(*) as anzahl_gipfel, max(x.created_at) as zuletzt
    from public.peak_logs x where x.user_id = pr.id
  ) g
  where pr.id <> coalesce(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid)
    and not exists (select 1 from public.follows f
                    where f.follower_id = auth.uid() and f.followed_id = pr.id)
    -- Wer noch gar nichts gemacht hat, ist kein Vorschlag, sondern ein
    -- leeres Profil. Vorgeschlagen wird nur, wer etwas beigetragen hat.
    and (p.anzahl_posts + s.anzahl_spots + g.anzahl_gipfel) > 0
  order by (p.anzahl_posts * 3 + s.anzahl_spots * 2 + g.anzahl_gipfel) desc,
           greatest(p.zuletzt, s.zuletzt, g.zuletzt) desc nulls last
  limit least(greatest(coalesce(anzahl, 12), 1), 30);
$$;

grant execute on function public.leute_vorschlaege(integer) to anon, authenticated;


-- ============================================================================
-- 11. FOLLOWER UND GEFOLGTE
--
-- art = 'follower'  wer folgt dieser Person
--       'folge'     wem folgt diese Person
-- ============================================================================

create or replace function public.folge_liste(
  wessen_id uuid,
  art       text default 'follower',
  anzahl    integer default 50
)
returns table (
  id          uuid,
  username    text,
  avatar_path text,
  bio         text,
  beitraege   bigint,
  gipfel      bigint,
  ich_folge   boolean
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    pr.id, pr.username, pr.avatar_path, pr.bio,
    (select count(*) from public.posts p     where p.user_id = pr.id),
    (select count(*) from public.peak_logs l where l.user_id = pr.id),
    exists (select 1 from public.follows f2
            where f2.follower_id = auth.uid() and f2.followed_id = pr.id)
  from public.follows f
  join public.profiles pr
    on pr.id = case when art = 'folge' then f.followed_id else f.follower_id end
  where case when art = 'folge' then f.follower_id else f.followed_id end = wessen_id
  order by f.created_at desc
  limit least(greatest(coalesce(anzahl, 50), 1), 100);
$$;

grant execute on function public.folge_liste(uuid, text, integer) to anon, authenticated;


-- ============================================================================
-- 12. DIE ZAHLEN DER GEMEINSCHAFT
--
-- Für das Band auf der Entdecken-Seite. Eine App, in der man sieht, dass 14
-- Plätze und 9 Leute drin sind, wirkt lebendiger als eine, die das verschweigt
-- — auch wenn die Zahlen klein sind. Vor allem dann.
-- ============================================================================

create or replace function public.gemeinschaft_zahlen()
returns table (
  spots       bigint,
  leute       bigint,
  beitraege   bigint,
  gipfel_frei bigint,
  gipfel_los  bigint,
  fotos       bigint,
  naechte     bigint
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    (select count(*) from public.spots),
    (select count(*) from public.profiles),
    (select count(*) from public.posts),
    -- Wie viele Gipfel überhaupt zur Auswahl stehen …
    (select count(*) from public.water_points w where w.kind = 'peak' and w.name is not null),
    -- … und wie oft schon einer gesammelt wurde.
    (select count(*) from public.peak_logs),
    (select count(*) from public.spot_photos),
    (select count(*) from (
       select p.visited_on as d, p.user_id from public.posts p where p.visited_on is not null
       union
       select c.visited_on, c.user_id from public.comments c
     ) x);
$$;

grant execute on function public.gemeinschaft_zahlen() to anon, authenticated;


-- ============================================================================
-- 13. MEHR FILTER
--
-- Die Chips waren acht. Jetzt sind es mehr als zwanzig, in Gruppen sortiert,
-- hinter einem Filterknopf. Jede Zeile hier gehört zu genau einem Chip in
-- screens.js (Liste CHIPS) — wer hier eine Bedingung ändert, muss dort den
-- Kartenausdruck mitändern. Der Grund für die Doppelung steht in 019.
--
-- Die Funktion behält Signatur und Rückgabe, deshalb reicht "replace".
-- ============================================================================

create or replace function public.spots_filtern(
  chips    text[]           default '{}',
  von_lat  double precision default null,
  von_lng  double precision default null,
  anzahl   integer          default 60
)
returns table (
  id             uuid,
  name           text,
  lat            double precision,
  lng            double precision,
  description    text,
  elevation_m    integer,
  water_nearby   boolean,
  has_lake       boolean,
  above_treeline boolean,
  hike_minutes   integer,
  avg_stars      numeric,
  rating_count   bigint,
  created_at     timestamptz,
  foto_pfad      text,
  foto_anzahl    bigint,
  entfernung_km  double precision
)
language sql
stable
security invoker
set search_path = public, extensions
as $$
  select
    s.id, s.name,
    st_y(s.location::geometry) as lat,
    st_x(s.location::geometry) as lng,
    s.description, s.elevation_m,
    s.water_nearby, s.has_lake, s.above_treeline, s.hike_minutes,
    s.avg_stars, s.rating_count, s.created_at,
    f.storage_path as foto_pfad,
    coalesce(f.gesamt, 0) as foto_anzahl,
    case
      when von_lat is null or von_lng is null then null
      else round((st_distance(
             s.location,
             st_point(von_lng, von_lat)::geography
           ) / 1000)::numeric, 1)::double precision
    end as entfernung_km
  from public.spots_with_rating s
  left join lateral (
    select p.storage_path,
           count(*) over () as gesamt
    from public.spot_photos p
    where p.spot_id = s.id
    order by p.sort_order asc nulls last, p.created_at asc
    limit 1
  ) f on true
  where
    -- ------------------------------------------------------------- Wasser
        (not ('see'      = any(coalesce(chips, '{}'))) or s.has_lake is true)
    and (not ('wasser'   = any(coalesce(chips, '{}'))) or s.water_nearby is true)
    and (not ('quelle'   = any(coalesce(chips, '{}'))) or s.water_type in ('quelle','bach'))
    and (not ('sicher'   = any(coalesce(chips, '{}'))) or s.water_reliable = 'ganzjaehrig')

    -- --------------------------------------------------------------- Lage
    and (not ('hoch'     = any(coalesce(chips, '{}'))) or coalesce(s.elevation_m, 0) >= 1500)
    and (not ('sehrhoch' = any(coalesce(chips, '{}'))) or coalesce(s.elevation_m, 0) >= 2000)
    and (not ('baum'     = any(coalesce(chips, '{}'))) or s.above_treeline is true)
    and (not ('still'    = any(coalesce(chips, '{}'))) or s.discreet = 'sehr')
    and (not ('schutz'   = any(coalesce(chips, '{}'))) or s.exposure = 'geschuetzt')

    -- ------------------------------------------------------------ Zustieg
    and (not ('kurz'     = any(coalesce(chips, '{}'))) or coalesce(s.hike_minutes, 9999) <= 60)
    and (not ('sehrkurz' = any(coalesce(chips, '{}'))) or coalesce(s.hike_minutes, 9999) <= 20)
    and (not ('auto'     = any(coalesce(chips, '{}'))) or s.access = 'auto')
    and (not ('weit'     = any(coalesce(chips, '{}'))) or s.access = 'lange_wanderung')

    -- ---------------------------------------------------------- Der Platz
    and (not ('weich'    = any(coalesce(chips, '{}'))) or s.ground_type in ('wiese','waldboden'))
    and (not ('mehrere'  = any(coalesce(chips, '{}'))) or s.flat_tent_spots in ('2-3','4+'))
    and (not ('unter'    = any(coalesce(chips, '{}'))) or s.shelter_nearby in ('biwakschachtel','huette','felsueberhang'))
    and (not ('holz'     = any(coalesce(chips, '{}'))) or s.firewood_available in ('viel','etwas'))

    -- --------------------------------------------------------- Regeln, Ruf
    and (not ('feuer'    = any(coalesce(chips, '{}'))) or s.fire_allowed = 'erlaubt')
    and (not ('erlaubt'  = any(coalesce(chips, '{}'))) or s.legal_status in ('erlaubt','geduldet'))
    and (not ('empfang'  = any(coalesce(chips, '{}'))) or s.mobile_signal = 'gut')
    and (not ('funkloch' = any(coalesce(chips, '{}'))) or s.mobile_signal = 'keiner')

    -- ------------------------------------------------------- Jahreszeiten
    and (not ('winter'   = any(coalesce(chips, '{}'))) or 'winter'    = any(coalesce(s.season, '{}')))
    and (not ('sommer'   = any(coalesce(chips, '{}'))) or 'sommer'    = any(coalesce(s.season, '{}')))
    and (not ('fruehling'= any(coalesce(chips, '{}'))) or 'fruehling' = any(coalesce(s.season, '{}')))
    and (not ('herbst'   = any(coalesce(chips, '{}'))) or 'herbst'    = any(coalesce(s.season, '{}')))

    -- -------------------------------------------------------------- Sonst
    and (not ('gut'      = any(coalesce(chips, '{}'))) or coalesce(s.avg_stars, 0) >= 4)
    and (not ('bilder'   = any(coalesce(chips, '{}'))) or coalesce(f.gesamt, 0) > 0)
    and (not ('neu'      = any(coalesce(chips, '{}'))) or s.created_at > now() - interval '30 days')
  order by
    case when von_lat is not null and von_lng is not null then
      st_distance(s.location, st_point(von_lng, von_lat)::geography)
    end asc nulls last,
    s.avg_stars desc nulls last,
    s.rating_count desc nulls last,
    s.created_at desc
  limit least(greatest(coalesce(anzahl, 60), 1), 100);
$$;

grant execute on function public.spots_filtern(text[], double precision, double precision, integer)
  to anon, authenticated;


-- ============================================================================
-- 14. DIE GIPFEL-BESTENLISTE
--
-- Wer hat die meisten gesammelt. Klein gehalten und ohne Anspruch auf
-- Vollständigkeit — es geht um ein Ziel vor Augen, nicht um einen Wettkampf.
-- ============================================================================

create or replace function public.gipfel_bestenliste(anzahl integer default 10)
returns table (
  id          uuid,
  username    text,
  avatar_path text,
  gipfel      bigint,
  hoechster   integer,
  meter       bigint
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    pr.id, pr.username, pr.avatar_path,
    count(*)::bigint,
    max(w.elevation_m),
    coalesce(sum(w.elevation_m), 0)::bigint
  from public.peak_logs l
  join public.profiles pr on pr.id = l.user_id
  join public.water_points w on w.id = l.peak_id
  group by pr.id, pr.username, pr.avatar_path
  order by count(*) desc, coalesce(sum(w.elevation_m), 0) desc
  limit least(greatest(coalesce(anzahl, 10), 1), 50);
$$;

grant execute on function public.gipfel_bestenliste(integer) to anon, authenticated;
