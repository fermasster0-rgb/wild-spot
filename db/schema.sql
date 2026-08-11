-- ============================================================================
-- wildcamp-at — Datenbank-Schema für Supabase
-- Stand: 2026-08-04
--
-- Einfach komplett kopieren und im Supabase SQL Editor ausführen.
-- Das Skript ist wiederholbar: es kann mehrfach laufen, ohne kaputtzugehen.
--
-- Aufbau:
--   0. Vorbereitung (PostGIS)
--   1. profiles      — Nutzerprofile
--   2. spots         — die Wildcamp-Plätze
--   3. spot_photos   — Fotos
--   4. ratings       — Sterne
--   5. comments      — Kommentare mit Besuchsdatum
--   6. water_points  — Wasserstellen aus OpenStreetMap
--   7. View + Funktionen für die Karte
--   8. Storage (Fotos)
-- ============================================================================


-- ============================================================================
-- 0. VORBEREITUNG
-- ============================================================================

-- PostGIS erweitert Postgres um Geo-Funktionen: Koordinaten speichern,
-- Entfernungen rechnen, "was liegt in diesem Kartenausschnitt".
create extension if not exists postgis with schema extensions;

-- Damit die PostGIS-Typen im folgenden Skript ohne Präfix gefunden werden.
set search_path = public, extensions;


-- ============================================================================
-- 1. PROFILES — Nutzerprofile
--
-- Supabase legt eingeloggte Nutzer selbst in auth.users an. Da kommt man aber
-- nur an die E-Mail-Adresse. Diese Tabelle hängt daneben und hält alles, was
-- öffentlich sichtbar sein soll — aktuell nur den Anzeigenamen.
-- ============================================================================

create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  username    text unique not null check (char_length(username) between 3 and 24),
  created_at  timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "profile lesen" on public.profiles;
-- Jeder Eingeloggte darf alle Profile lesen (sonst stünde bei Kommentaren kein Name).
create policy "profile lesen" on public.profiles
  for select to authenticated using (true);

drop policy if exists "eigenes profil anlegen" on public.profiles;
-- Man darf nur ein Profil mit der eigenen Nutzer-ID anlegen, nicht für andere.
create policy "eigenes profil anlegen" on public.profiles
  for insert to authenticated with check (auth.uid() = id);

drop policy if exists "eigenes profil aendern" on public.profiles;
-- Man darf ausschließlich das eigene Profil bearbeiten.
create policy "eigenes profil aendern" on public.profiles
  for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);


-- Legt automatisch ein Profil an, sobald sich jemand registriert.
-- Ohne das müsste die App nach jeder Registrierung selbst ein Profil einfügen.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, username)
  values (
    new.id,
    -- Vorschlag: Teil vor dem @ der E-Mail, plus 4 Zufallszeichen gegen Dopplungen
    coalesce(split_part(new.email, '@', 1), 'camper') || '_' || substr(md5(random()::text), 1, 4)
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();


-- Setzt updated_at bei jeder Änderung automatisch auf jetzt.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;


-- ============================================================================
-- 2. SPOTS — die Wildcamp-Plätze
--
-- Die Attribute sind 1:1 die Liste aus KONZEPT.md, Abschnitt 3.
--
-- Warum text mit CHECK statt Postgres-Enum: Ein Enum später zu erweitern ist
-- umständlich. Bei text + CHECK ändert man eine Zeile im Constraint. Bei einem
-- Projekt, dessen Attribute sich noch bewegen werden, ist das die richtige Wahl.
--
-- Warum fast alles NULL sein darf: Ein Spot mit nur Name und Position ist
-- besser als kein Spot. Niemand soll 19 Felder ausfüllen müssen.
-- ============================================================================

create table if not exists public.spots (
  id           uuid primary key default gen_random_uuid(),
  created_by   uuid not null references public.profiles(id) on delete cascade,

  name         text not null check (char_length(name) between 3 and 80),
  description  text check (char_length(description) <= 2000),

  -- Position als Punkt auf der Erdkugel. 4326 = das Koordinatensystem von GPS.
  location     geography(Point, 4326) not null,

  ---------------------------------------------------------------- Wasser -----
  water_nearby        boolean,
  water_type          text    check (water_type in ('bach','quelle','see','brunnen','huette','keins')),
  water_distance_m    integer check (water_distance_m between 0 and 20000),
  water_reliable      text    check (water_reliable in ('ganzjaehrig','fruehjahr_sommer','unsicher')),

  ------------------------------------------------------------------ Lage -----
  above_treeline      boolean,
  elevation_m         integer check (elevation_m between 0 and 4000),
  has_lake            boolean,
  ground_type         text    check (ground_type in ('wiese','schotter','waldboden','fels','moor')),
  flat_tent_spots     text    check (flat_tent_spots in ('1','2-3','4+')),
  exposure            text    check (exposure in ('geschuetzt','halb','exponiert')),

  ------------------------------------------------------------ Ressourcen -----
  firewood_available  text    check (firewood_available in ('viel','etwas','keins')),
  -- Default bewusst 'unklar', niemals 'erlaubt' — Waldbrandgefahr.
  fire_allowed        text    check (fire_allowed in ('erlaubt','verboten','unklar')) default 'unklar',
  shelter_nearby      text    check (shelter_nearby in ('biwakschachtel','huette','felsueberhang','nichts')),

  ----------------------------------------------------------- Praktisches -----
  access              text    check (access in ('auto','kurze_wanderung','lange_wanderung')),
  hike_minutes        integer check (hike_minutes between 0 and 1440),
  mobile_signal       text    check (mobile_signal in ('gut','schwach','keiner')),
  discreet            text    check (discreet in ('sehr','mittel','einsehbar')),
  -- Auch hier Default 'unklar' statt 'erlaubt'.
  legal_status        text    check (legal_status in ('erlaubt','geduldet','verboten','unklar')) default 'unklar',
  -- Mehrfachauswahl. <@ heißt "alle Werte müssen aus dieser Liste kommen".
  season              text[]  check (season <@ array['fruehling','sommer','herbst','winter']::text[]),

  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- DER wichtigste Index des Projekts. Ohne ihn muss die Datenbank für jeden
-- Kartenausschnitt jeden einzelnen Spot durchgehen; mit ihm findet sie die
-- passenden sofort. Ab ein paar hundert Spots ist das der Unterschied zwischen
-- "flüssig" und "hakelig".
create index if not exists spots_location_idx on public.spots using gist (location);

-- Für "meine Spots" im Profil.
create index if not exists spots_created_by_idx on public.spots (created_by);

drop trigger if exists spots_set_updated_at on public.spots;
create trigger spots_set_updated_at
  before update on public.spots
  for each row execute function public.set_updated_at();

alter table public.spots enable row level security;

drop policy if exists "spots lesen" on public.spots;
-- Jeder Eingeloggte sieht alle Spots — das ist der Sinn der App.
create policy "spots lesen" on public.spots
  for select to authenticated using (true);

drop policy if exists "spot anlegen" on public.spots;
-- Beim Anlegen muss created_by die eigene Nutzer-ID sein; man kann keinen Spot
-- im Namen eines anderen eintragen.
create policy "spot anlegen" on public.spots
  for insert to authenticated with check (auth.uid() = created_by);

drop policy if exists "eigenen spot aendern" on public.spots;
-- Bearbeiten darf nur, wer den Spot angelegt hat.
create policy "eigenen spot aendern" on public.spots
  for update to authenticated using (auth.uid() = created_by) with check (auth.uid() = created_by);

drop policy if exists "eigenen spot loeschen" on public.spots;
-- Löschen darf ebenfalls nur der Ersteller.
create policy "eigenen spot loeschen" on public.spots
  for delete to authenticated using (auth.uid() = created_by);


-- ============================================================================
-- 3. SPOT_PHOTOS — Fotos zu einem Spot
--
-- In der Tabelle steht nur der Dateipfad. Die Datei selbst liegt im Supabase
-- Storage (siehe Abschnitt 8).
-- ============================================================================

create table if not exists public.spot_photos (
  id            uuid primary key default gen_random_uuid(),
  spot_id       uuid not null references public.spots(id) on delete cascade,
  uploaded_by   uuid not null references public.profiles(id) on delete cascade,
  storage_path  text not null,
  sort_order    smallint not null default 0,
  created_at    timestamptz not null default now()
);

create index if not exists spot_photos_spot_id_idx on public.spot_photos (spot_id);

alter table public.spot_photos enable row level security;

drop policy if exists "fotos lesen" on public.spot_photos;
-- Alle Eingeloggten sehen alle Fotos.
create policy "fotos lesen" on public.spot_photos
  for select to authenticated using (true);

drop policy if exists "foto hochladen" on public.spot_photos;
-- Hochladen nur unter eigenem Namen und nur zu einem Spot, den es wirklich gibt.
create policy "foto hochladen" on public.spot_photos
  for insert to authenticated with check (
    auth.uid() = uploaded_by
    and exists (select 1 from public.spots s where s.id = spot_id)
  );

drop policy if exists "foto loeschen" on public.spot_photos;
-- Löschen darf, wer das Foto hochgeladen hat — oder wem der Spot gehört.
create policy "foto loeschen" on public.spot_photos
  for delete to authenticated using (
    auth.uid() = uploaded_by
    or exists (select 1 from public.spots s where s.id = spot_id and s.created_by = auth.uid())
  );


-- ============================================================================
-- 4. RATINGS — Sternebewertungen
--
-- Ein Nutzer kann pro Spot genau einmal bewerten, die Bewertung aber ändern.
-- Das erzwingt die UNIQUE-Regel auf (spot_id, user_id).
-- ============================================================================

create table if not exists public.ratings (
  id          uuid primary key default gen_random_uuid(),
  spot_id     uuid not null references public.spots(id) on delete cascade,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  stars       smallint not null check (stars between 1 and 5),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (spot_id, user_id)
);

create index if not exists ratings_spot_id_idx on public.ratings (spot_id);

drop trigger if exists ratings_set_updated_at on public.ratings;
create trigger ratings_set_updated_at
  before update on public.ratings
  for each row execute function public.set_updated_at();

alter table public.ratings enable row level security;

drop policy if exists "bewertungen lesen" on public.ratings;
-- Alle Bewertungen sind für Eingeloggte sichtbar (daraus entsteht der Schnitt).
create policy "bewertungen lesen" on public.ratings
  for select to authenticated using (true);

drop policy if exists "bewerten" on public.ratings;
-- Bewerten nur im eigenen Namen.
create policy "bewerten" on public.ratings
  for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "eigene bewertung aendern" on public.ratings;
-- Die eigene Bewertung darf jederzeit geändert werden.
create policy "eigene bewertung aendern" on public.ratings
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "eigene bewertung loeschen" on public.ratings;
-- Und wieder zurückgenommen werden.
create policy "eigene bewertung loeschen" on public.ratings
  for delete to authenticated using (auth.uid() = user_id);


-- ============================================================================
-- 5. COMMENTS — Kommentare mit Besuchsdatum
--
-- visited_on ist Pflicht. Ein Zustandsbericht ohne Datum ist wertlos:
-- "Bach war trocken" heißt im April etwas völlig anderes als im August.
-- ============================================================================

create table if not exists public.comments (
  id          uuid primary key default gen_random_uuid(),
  spot_id     uuid not null references public.spots(id) on delete cascade,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  body        text not null check (char_length(body) between 1 and 2000),
  visited_on  date not null,   -- Prüfung "nicht in der Zukunft" macht die App
  created_at  timestamptz not null default now()
);

-- Kommentare werden nach Besuchsdatum sortiert angezeigt, neueste zuerst.
create index if not exists comments_spot_visited_idx on public.comments (spot_id, visited_on desc);

alter table public.comments enable row level security;

drop policy if exists "kommentare lesen" on public.comments;
-- Alle Eingeloggten lesen alle Kommentare.
create policy "kommentare lesen" on public.comments
  for select to authenticated using (true);

drop policy if exists "kommentieren" on public.comments;
-- Schreiben nur im eigenen Namen.
create policy "kommentieren" on public.comments
  for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "eigenen kommentar aendern" on public.comments;
-- Den eigenen Kommentar darf man korrigieren.
create policy "eigenen kommentar aendern" on public.comments
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "eigenen kommentar loeschen" on public.comments;
-- Löschen darf der Verfasser — oder der Spot-Ersteller (Hausrecht am Spot).
create policy "eigenen kommentar loeschen" on public.comments
  for delete to authenticated using (
    auth.uid() = user_id
    or exists (select 1 from public.spots s where s.id = spot_id and s.created_by = auth.uid())
  );


-- ============================================================================
-- 6. WATER_POINTS — Wasserstellen
--
-- Wird per Skript aus OpenStreetMap befüllt (Overpass API), nicht von Nutzern.
-- Deshalb gibt es hier absichtlich KEINE Schreib-Policy: normale Nutzer können
-- nur lesen. Das Import-Skript schreibt mit dem service_role-Schlüssel, der
-- Row Level Security ohnehin umgeht.
-- ============================================================================

create table if not exists public.water_points (
  id          uuid primary key default gen_random_uuid(),
  source      text not null check (source in ('osm','user')) default 'osm',
  osm_id      bigint,
  -- Entspricht den OSM-Tags aus KONZEPT.md, Abschnitt 5.
  kind        text not null check (kind in ('spring','drinking_water','well','water','shelter','alpine_hut')),
  name        text,
  location    geography(Point, 4326) not null,
  imported_at timestamptz not null default now(),
  -- Verhindert Doppel-Importe, wenn das Skript nochmal läuft.
  unique (source, osm_id, kind)
);

create index if not exists water_points_location_idx on public.water_points using gist (location);
create index if not exists water_points_kind_idx on public.water_points (kind);

alter table public.water_points enable row level security;

drop policy if exists "wasserstellen lesen" on public.water_points;
-- Nur Lesen, für alle Eingeloggten. Geschrieben wird ausschließlich vom Import-Skript.
create policy "wasserstellen lesen" on public.water_points
  for select to authenticated using (true);


-- ============================================================================
-- 7. VIEW UND FUNKTIONEN FÜR DIE KARTE
-- ============================================================================

-- Spots samt Sterneschnitt und Anzahl Bewertungen.
-- security_invoker = on ist wichtig: dadurch gelten die RLS-Regeln der Tabellen
-- auch für die View. Ohne das wäre die View ein Loch in der Absicherung.
create or replace view public.spots_with_rating
with (security_invoker = on) as
  select
    s.*,
    coalesce(avg(r.stars), 0)::numeric(2,1) as avg_stars,
    count(r.id)                             as rating_count
  from public.spots s
  left join public.ratings r on r.spot_id = s.id
  group by s.id;


-- Lädt nur die Spots im sichtbaren Kartenausschnitt, nicht alle.
-- Gibt bewusst nur die Felder zurück, die für einen Pin gebraucht werden —
-- die vollen Details holt der Spot-Detail-Screen einzeln nach.
--
-- Aufruf aus der App:
--   supabase.rpc('spots_in_bbox', { min_lat, min_lng, max_lat, max_lng })
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
  elevation_m    integer
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
    s.elevation_m
  from public.spots s
  left join public.ratings r on r.spot_id = s.id
  -- st_intersects auf geography nutzt den GIST-Index von oben.
  where st_intersects(
          s.location,
          st_makeenvelope(min_lng, min_lat, max_lng, max_lat, 4326)::geography
        )
  group by s.id;
$$;


-- Dasselbe für den Wasser-Layer.
create or replace function public.water_points_in_bbox(
  min_lat double precision,
  min_lng double precision,
  max_lat double precision,
  max_lng double precision
)
returns table (
  id   uuid,
  kind text,
  name text,
  lat  double precision,
  lng  double precision
)
language sql
stable
security invoker
set search_path = public, extensions
as $$
  select
    w.id,
    w.kind,
    w.name,
    st_y(w.location::geometry) as lat,
    st_x(w.location::geometry) as lng
  from public.water_points w
  where st_intersects(
          w.location,
          st_makeenvelope(min_lng, min_lat, max_lng, max_lat, 4326)::geography
        );
$$;


-- Die nächstgelegenen Wasserstellen zu einem Punkt, mit Entfernung in Metern.
-- Praktisch beim Anlegen eines Spots: "Quelle 340 m entfernt" als Vorschlag.
create or replace function public.nearest_water(
  in_lat    double precision,
  in_lng    double precision,
  max_dist_m integer default 2000,
  max_rows   integer default 5
)
returns table (
  id         uuid,
  kind       text,
  name       text,
  lat        double precision,
  lng        double precision,
  distance_m double precision
)
language sql
stable
security invoker
set search_path = public, extensions
as $$
  select
    w.id,
    w.kind,
    w.name,
    st_y(w.location::geometry) as lat,
    st_x(w.location::geometry) as lng,
    st_distance(w.location, st_point(in_lng, in_lat)::geography) as distance_m
  from public.water_points w
  where st_dwithin(w.location, st_point(in_lng, in_lat)::geography, max_dist_m)
  order by w.location <-> st_point(in_lng, in_lat)::geography
  limit max_rows;
$$;


-- ============================================================================
-- 8. STORAGE — Fotospeicher
--
-- ACHTUNG: Diesen Abschnitt erst ausführen, nachdem im Supabase-Dashboard
-- unter Storage ein Bucket namens "spot-photos" angelegt wurde (Public: ja).
-- Vorher schlagen die Policies fehl.
-- ============================================================================

-- Konvention für den Dateipfad: <nutzer-id>/<spot-id>/<dateiname>.jpg
-- Der erste Ordner ist die eigene Nutzer-ID — darauf bauen die Policies auf.

-- drop policy if exists "fotos oeffentlich lesen" on storage.objects;
-- -- Jeder darf die Bilder laden (der Bucket ist öffentlich, die Pfade sind nicht ratbar).
-- create policy "fotos oeffentlich lesen" on storage.objects
--   for select using (bucket_id = 'spot-photos');
--
-- drop policy if exists "fotos in eigenen ordner hochladen" on storage.objects;
-- -- Hochladen nur in den Ordner, der die eigene Nutzer-ID als Namen trägt.
-- create policy "fotos in eigenen ordner hochladen" on storage.objects
--   for insert to authenticated with check (
--     bucket_id = 'spot-photos'
--     and (storage.foldername(name))[1] = auth.uid()::text
--   );
--
-- drop policy if exists "eigene fotos loeschen" on storage.objects;
-- -- Löschen ebenfalls nur im eigenen Ordner.
-- create policy "eigene fotos loeschen" on storage.objects
--   for delete to authenticated using (
--     bucket_id = 'spot-photos'
--     and (storage.foldername(name))[1] = auth.uid()::text
--   );


-- ============================================================================
-- FERTIG.
--
-- Kurzer Test, ob alles steht (einzeln ausführen):
--   select count(*) from public.spots;                  -- muss 0 ergeben, kein Fehler
--   select postgis_version();                           -- zeigt die PostGIS-Version
--   select * from public.spots_in_bbox(46.3, 9.5, 49.1, 17.2);  -- leere Liste, kein Fehler
-- ============================================================================
