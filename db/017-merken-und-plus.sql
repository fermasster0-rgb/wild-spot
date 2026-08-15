-- ============================================================================
-- Migration 017 — Merkliste und Wild Spot Plus
-- Stand: 2026-08-15
--
-- Zwei Dinge, die zusammengehören, weil beide am Nutzer hängen:
--
--   1. MERKLISTE   Jeder Angemeldete kann sich Spots merken. Die Liste ist
--                  privat — niemand sonst sieht, wohin du willst. Das ist bei
--                  Wildcampen kein Detail: ein öffentlicher „will ich hin"-Zähler
--                  wäre eine Einladung, genau dort hinzufahren.
--
--   2. PLUS        Der bezahlte Teil. Hier steht nur, BIS WANN jemand Plus hat.
--                  Wer das Datum setzen darf, ist die eigentliche Frage —
--                  Antwort weiter unten bei den Regeln: niemand aus der App.
--
-- Wiederholbar: kann mehrfach laufen.
-- ============================================================================


-- ============================================================================
-- 1. DIE MERKLISTE
--
-- Ein Eintrag pro Nutzer und Spot. Der zusammengesetzte Primärschlüssel
-- verhindert, dass derselbe Spot zweimal in der Liste landet — sonst müsste
-- die App vor jedem Merken erst nachsehen, ob er schon drin ist.
-- ============================================================================

create table if not exists public.saved_spots (
  user_id     uuid not null references auth.users(id) on delete cascade,
  spot_id     uuid not null references public.spots(id) on delete cascade,
  note        text check (note is null or char_length(note) <= 500),
  created_at  timestamptz not null default now(),
  primary key (user_id, spot_id)
);

-- Die Liste wird immer nach Nutzer und Datum gelesen ("meine Merkliste, neueste
-- zuerst"). Genau dafür ist der Index da.
create index if not exists saved_spots_user_idx
  on public.saved_spots (user_id, created_at desc);

alter table public.saved_spots enable row level security;

-- Alle vier Regeln sagen dasselbe: nur die eigene Liste, sonst nichts. Auch
-- Lesen — eine fremde Merkliste geht niemanden etwas an.
drop policy if exists "eigene merkliste lesen" on public.saved_spots;
create policy "eigene merkliste lesen" on public.saved_spots
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists "eigene merkliste fuellen" on public.saved_spots;
create policy "eigene merkliste fuellen" on public.saved_spots
  for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "eigene merkliste aendern" on public.saved_spots;
create policy "eigene merkliste aendern" on public.saved_spots
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "eigene merkliste leeren" on public.saved_spots;
create policy "eigene merkliste leeren" on public.saved_spots
  for delete to authenticated using (auth.uid() = user_id);


-- ============================================================================
-- 2. PLUS
--
-- Nur eine Spalte: bis wann. Kein Schalter "hat_plus", weil ein Schalter nicht
-- von selbst ausgeht — ein Datum schon. Und "für immer" ist einfach ein Datum
-- weit in der Zukunft.
-- ============================================================================

alter table public.profiles
  add column if not exists plus_until timestamptz;

alter table public.profiles
  add column if not exists plus_tarif text
    check (plus_tarif is null or plus_tarif in ('monat', 'jahr', 'immer', 'gruender'));

comment on column public.profiles.plus_until is
  'Bis wann Plus gilt. NULL = kein Plus. Wird ausschliesslich serverseitig '
  'gesetzt (Zahlungsdienst oder Verwaltung) — nie aus der App heraus.';

-- ----------------------------------------------------------------------------
-- Der wichtige Teil: Niemand darf sich Plus selbst geben.
--
-- Die bestehende Regel "eigenes profil aendern" erlaubt jedem, sein Profil zu
-- bearbeiten. Ohne die Bremse hier könnte jeder mit der offenen Schnittstelle
-- ein plus_until im Jahr 2099 eintragen — der Schlüssel in config.js liegt ja
-- offen, das ist Absicht und richtig, aber es heisst eben auch: was die
-- Datenbank erlaubt, kann jeder tun.
--
-- Ein Trigger ist hier die richtige Stelle. Eine RLS-Regel kann zwar prüfen,
-- WER schreibt, aber nur umständlich, WELCHE Spalte sich ändert.
-- ----------------------------------------------------------------------------

create or replace function public.plus_schuetzen()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Admins und alles, was ohne angemeldeten Nutzer läuft (also der
  -- service_role-Schlüssel auf dem Server), dürfen durch.
  if auth.uid() is null then
    return new;
  end if;

  if exists (select 1 from public.profiles p
             where p.id = auth.uid() and p.is_admin = true) then
    return new;
  end if;

  -- Alle anderen: die beiden Plus-Spalten bleiben, wie sie waren.
  new.plus_until := old.plus_until;
  new.plus_tarif := old.plus_tarif;
  return new;
end;
$$;

drop trigger if exists plus_nicht_selbst_setzen on public.profiles;
create trigger plus_nicht_selbst_setzen
  before update on public.profiles
  for each row execute function public.plus_schuetzen();


-- ============================================================================
-- 3. DIE WARTELISTE
--
-- Solange das Bezahlen nicht eingerichtet ist, sammelt die Plus-Seite
-- E-Mail-Adressen. Das ist mehr als ein Trostpflaster: Es beantwortet die
-- einzige Frage, die vor dem Einbau eines Zahlungsdienstes zählt — will das
-- überhaupt jemand haben?
--
-- Einfügen darf jeder, auch ohne Konto (sonst könnte man sich nur vormerken,
-- wenn man schon angemeldet ist — genau verkehrt herum).
-- Lesen darf nur die Verwaltung.
-- ============================================================================

create table if not exists public.plus_warteliste (
  id          uuid primary key default gen_random_uuid(),
  email       text not null check (email ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
  tarif       text,
  user_id     uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now()
);

-- Dieselbe Adresse nur einmal. Ohne das könnte ein einziger Klickfinger die
-- Liste aufblähen und die Zahl wertlos machen.
create unique index if not exists plus_warteliste_email_idx
  on public.plus_warteliste (lower(email));

alter table public.plus_warteliste enable row level security;

drop policy if exists "vormerken darf jeder" on public.plus_warteliste;
create policy "vormerken darf jeder" on public.plus_warteliste
  for insert to anon, authenticated with check (true);

drop policy if exists "warteliste nur fuer admins" on public.plus_warteliste;
create policy "warteliste nur fuer admins" on public.plus_warteliste
  for select to authenticated using (
    exists (select 1 from public.profiles p
            where p.id = auth.uid() and p.is_admin = true)
  );


-- ============================================================================
-- 4. SPOTS FÜR DIE STARTSEITE
--
-- Die Seite "Entdecken" braucht etwas anderes als die Karte: nicht "alles in
-- diesem Rechteck", sondern "die besten", "die neuesten", "die nächsten" —
-- jeweils mit dem ersten Foto dazu, sonst müsste die App für zwanzig Kacheln
-- zwanzigmal nachfragen.
--
-- Als Funktion und nicht als View, weil der Standort des Nutzers hineinkommt.
-- ============================================================================

create or replace function public.spots_entdecken(
  sortierung text default 'neu',      -- 'neu' | 'best' | 'nah'
  von_lat    double precision default null,
  von_lng    double precision default null,
  anzahl     integer default 12
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
      -- st_distance auf geography rechnet in Metern auf der Kugel — also
      -- richtig, und nicht nur ungefaehr wie eine Rechnung mit Grad.
      else round((st_distance(
             s.location,
             st_point(von_lng, von_lat)::geography
           ) / 1000)::numeric, 1)::double precision
    end as entfernung_km
  from public.spots_with_rating s
  -- Das erste Foto je Spot, dazu die Gesamtzahl. lateral, weil die
  -- Unterabfrage die Spot-ID von aussen braucht.
  left join lateral (
    select p.storage_path,
           count(*) over () as gesamt
    from public.spot_photos p
    where p.spot_id = s.id
    order by p.sort_order asc nulls last, p.created_at asc
    limit 1
  ) f on true
  order by
    case when sortierung = 'best' then s.avg_stars end desc nulls last,
    case when sortierung = 'best' then s.rating_count end desc nulls last,
    case when sortierung = 'nah' and von_lat is not null then
      st_distance(s.location, st_point(von_lng, von_lat)::geography)
    end asc nulls last,
    case when sortierung = 'neu' then s.created_at end desc nulls last,
    s.created_at desc
  limit least(greatest(coalesce(anzahl, 12), 1), 50);
$$;

grant execute on function public.spots_entdecken(text, double precision, double precision, integer)
  to anon, authenticated;


-- ============================================================================
-- 5. DIE GEMERKTEN SPOTS MIT ALLEN ANGABEN
--
-- Dasselbe für die Merkliste: eine Abfrage statt einer je Spot.
-- ============================================================================

create or replace function public.meine_merkliste()
returns table (
  id             uuid,
  name           text,
  lat            double precision,
  lng            double precision,
  elevation_m    integer,
  water_nearby   boolean,
  hike_minutes   integer,
  avg_stars      numeric,
  rating_count   bigint,
  gemerkt_am     timestamptz,
  note           text,
  foto_pfad      text
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
    s.elevation_m, s.water_nearby, s.hike_minutes,
    s.avg_stars, s.rating_count,
    m.created_at as gemerkt_am,
    m.note,
    f.storage_path as foto_pfad
  from public.saved_spots m
  join public.spots_with_rating s on s.id = m.spot_id
  left join lateral (
    select p.storage_path
    from public.spot_photos p
    where p.spot_id = s.id
    order by p.sort_order asc nulls last, p.created_at asc
    limit 1
  ) f on true
  where m.user_id = auth.uid()
  order by m.created_at desc;
$$;

grant execute on function public.meine_merkliste() to authenticated;


-- ============================================================================
-- 6. MEINE EIGENEN SPOTS
-- ============================================================================

create or replace function public.meine_spots()
returns table (
  id             uuid,
  name           text,
  lat            double precision,
  lng            double precision,
  elevation_m    integer,
  water_nearby   boolean,
  hike_minutes   integer,
  avg_stars      numeric,
  rating_count   bigint,
  created_at     timestamptz,
  foto_pfad      text
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
    s.elevation_m, s.water_nearby, s.hike_minutes,
    s.avg_stars, s.rating_count, s.created_at,
    f.storage_path as foto_pfad
  from public.spots_with_rating s
  left join lateral (
    select p.storage_path
    from public.spot_photos p
    where p.spot_id = s.id
    order by p.sort_order asc nulls last, p.created_at asc
    limit 1
  ) f on true
  where s.created_by = auth.uid()
  order by s.created_at desc;
$$;

grant execute on function public.meine_spots() to authenticated;


-- ============================================================================
-- 7. DIE ZAHLEN FÜRS PROFIL
--
-- Drei Zahlen in einer Abfrage statt drei Abfragen für drei Zahlen.
-- ============================================================================

create or replace function public.meine_zahlen()
returns table (
  spots       bigint,
  fotos       bigint,
  bewertungen bigint,
  gemerkt     bigint
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    (select count(*) from public.spots        where created_by  = auth.uid()),
    (select count(*) from public.spot_photos  where uploaded_by = auth.uid()),
    (select count(*) from public.ratings      where user_id     = auth.uid()),
    (select count(*) from public.saved_spots  where user_id     = auth.uid());
$$;

grant execute on function public.meine_zahlen() to authenticated;


-- ============================================================================
-- 8. MEHR ANGABEN FÜR DIE KARTE
--
-- Warum das hier steht: Seit es die Filterchips gibt ("Am See", "Kurzer
-- Zustieg", "Feuer erlaubt"), muss die Karte diese Angaben kennen. Sie filtert
-- nämlich nicht durch eine neue Abfrage, sondern blendet die Punkte aus, die
-- nicht passen — das geht ohne Netz und ohne Warten.
--
-- Dafür müssen die Angaben aber am Punkt hängen. Also liefert spots_in_bbox
-- vier Felder mehr.
--
-- create or replace reicht hier nicht: Postgres lässt die Rückgabe einer
-- bestehenden Funktion nicht verändern. Deshalb erst weg, dann neu.
-- ============================================================================

drop function if exists public.spots_in_bbox(
  double precision, double precision, double precision, double precision);

create or replace function public.spots_in_bbox(
  min_lat double precision,
  min_lng double precision,
  max_lat double precision,
  max_lng double precision
)
returns table (
  id             uuid,
  name           text,
  lat            double precision,
  lng            double precision,
  avg_stars      numeric,
  rating_count   bigint,
  water_nearby   boolean,
  above_treeline boolean,
  elevation_m    integer,
  has_lake       boolean,
  hike_minutes   integer,
  fire_allowed   text,
  discreet       text
)
language sql
stable
security invoker
set search_path = public, extensions
as $$
  select
    s.id,
    s.name,
    st_y(s.location::geometry) as lat,
    st_x(s.location::geometry) as lng,
    coalesce(avg(r.stars), 0)::numeric(2,1) as avg_stars,
    count(r.id) as rating_count,
    s.water_nearby,
    s.above_treeline,
    s.elevation_m,
    s.has_lake,
    s.hike_minutes,
    s.fire_allowed,
    s.discreet
  from public.spots s
  left join public.ratings r on r.spot_id = s.id
  -- st_intersects auf geography nutzt den GIST-Index aus schema.sql.
  where st_intersects(
          s.location,
          st_makeenvelope(min_lng, min_lat, max_lng, max_lat, 4326)::geography
        )
  group by s.id;
$$;

grant execute on function public.spots_in_bbox(
  double precision, double precision, double precision, double precision)
  to anon, authenticated;
