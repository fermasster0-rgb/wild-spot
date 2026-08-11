-- ============================================================================
-- Migration 006 — Kartenabfrage nach Art filtern können
-- Stand: 2026-08-04
--
-- Warum:
-- Bisher holt die Karte immer alle Punkte im Ausschnitt. Bei Trinkbrunnen ist
-- das richtig — davon gibt es 16.000, die dürfen erst beim Hineinzoomen
-- erscheinen. Bergseen sind dagegen selten und genau das, wonach man von
-- weitem sucht. Die sollen schon in der Übersicht zu sehen sein.
--
-- Deshalb bekommt die Funktion einen optionalen Filter: ohne Angabe kommt
-- alles wie bisher, mit Angabe nur die genannten Arten.
--
-- Wiederholbar: kann mehrfach laufen.
-- ============================================================================

-- Die alte Fassung muss weg, sonst gäbe es zwei Funktionen gleichen Namens
-- und Postgres wüsste beim Aufruf mit vier Werten nicht, welche gemeint ist.
drop function if exists public.water_points_in_bbox(
  double precision, double precision, double precision, double precision
);

drop function if exists public.water_points_in_bbox(
  double precision, double precision, double precision, double precision, text[]
);

create function public.water_points_in_bbox(
  min_lat double precision,
  min_lng double precision,
  max_lat double precision,
  max_lng double precision,
  -- Leer lassen heißt: alle Arten.
  kinds   text[] default null
)
returns table (
  id          uuid,
  kind        text,
  name        text,
  lat         double precision,
  lng         double precision,
  elevation_m integer
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
    w.elevation_m
  from public.water_points w
  where st_intersects(
          w.location,
          st_makeenvelope(min_lng, min_lat, max_lng, max_lat, 4326)::geography
        )
    and (kinds is null or w.kind = any(kinds))
  -- Feste Reihenfolge. Supabase liefert höchstens 1.000 Zeilen auf einmal;
  -- die Karte holt den Rest mit limit/offset nach. Ohne ein order by dürfte
  -- Postgres die Reihenfolge zwischen zwei Abfragen ändern — dann kämen
  -- einzelne Punkte doppelt und andere gar nicht.
  order by w.id;
$$;

grant execute on function public.water_points_in_bbox(
  double precision, double precision, double precision, double precision, text[]
) to anon, authenticated;
