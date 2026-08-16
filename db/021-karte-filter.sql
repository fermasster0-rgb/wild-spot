-- ============================================================================
-- Migration 021 — die Karte muss mehr über ihre Spots wissen
--
-- Mit Migration 020 sind aus acht Filtern über zwanzig geworden. Auf der
-- Entdecken-Seite arbeiten sie über die Datenbank (spots_filtern) und
-- funktionieren sofort. Auf der KARTE arbeiten sie anders: Dort blendet
-- MapLibre Punkte aus, die schon geladen sind — ohne neue Abfrage, ohne
-- Warten, und vor allem ohne Netz.
--
-- Das geht nur, wenn die Angabe am Punkt hängt. "Windgeschützt" kann die
-- Karte nicht filtern, wenn sie exposure gar nicht kennt: Der Punkt fiele
-- stillschweigend heraus, und man würde denken, es gäbe keinen solchen Platz.
--
-- Deshalb liefert spots_in_bbox ab jetzt alle Felder mit, auf die ein Chip
-- schauen kann. Es sind kurze Textfelder — der Unterschied pro Spot liegt bei
-- etwa 60 Bytes.
--
-- Die Rückgabe ändert sich, deshalb muss die Funktion erst weg:
-- "create or replace" kann eine Spaltenliste nicht erweitern.
--
-- Wiederholbar: kann mehrfach laufen.
-- ============================================================================

drop function if exists public.spots_in_bbox(
  double precision, double precision, double precision, double precision
);

create function public.spots_in_bbox(
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
  discreet       text,
  -- Neu ab 021 — alles, was die Filterchips auf der Karte brauchen.
  water_type         text,
  water_reliable     text,
  exposure           text,
  access             text,
  ground_type        text,
  flat_tent_spots    text,
  shelter_nearby     text,
  firewood_available text,
  mobile_signal      text,
  legal_status       text,
  season             text[],
  created_at         timestamptz
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
    s.discreet,
    s.water_type,
    s.water_reliable,
    s.exposure,
    s.access,
    s.ground_type,
    s.flat_tent_spots,
    s.shelter_nearby,
    s.firewood_available,
    s.mobile_signal,
    s.legal_status,
    s.season,
    s.created_at
  from public.spots s
  left join public.ratings r on r.spot_id = s.id
  where st_intersects(
          s.location,
          st_makeenvelope(min_lng, min_lat, max_lng, max_lat, 4326)::geography
        )
  group by s.id;
$$;

-- Die Rechte hingen an der alten Funktion und sind mit ihr verschwunden.
grant execute on function public.spots_in_bbox(
  double precision, double precision, double precision, double precision
) to anon, authenticated;
