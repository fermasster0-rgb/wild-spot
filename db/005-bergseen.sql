-- ============================================================================
-- Migration 005 — Bergseen als eigene Ebene
-- Stand: 2026-08-04
--
-- Ein Bergsee ist für diese App etwas anderes als ein Trinkbrunnen: Wasser
-- zum Waschen, ein Grund überhaupt hinzugehen, und oft der schönste Platz
-- weit und breit. Deshalb eine eigene Art und ein eigener Schalter auf der
-- Karte.
--
-- Neu:
--   1. kind 'mountain_lake'
--   2. Spalte elevation_m — die Seehöhe. Sie ist das Kriterium dafür, ob ein
--      See überhaupt als Bergsee gilt, und gehört ins Popup: "Bergsee,
--      1.847 m" sagt mehr als nur ein Name.
--   3. water_points_in_bbox gibt die Höhe mit zurück.
--
-- Wiederholbar: kann mehrfach laufen.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Höhe speichern können
-- ---------------------------------------------------------------------------

alter table public.water_points
  add column if not exists elevation_m integer;

-- ---------------------------------------------------------------------------
-- 2. Neue Art erlauben
-- ---------------------------------------------------------------------------

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
    -- Unterkünfte und Unterstände
    'shelter',           -- Biwakschachtel, Schutzdach, Felsunterstand
    'alpine_hut',        -- bewirtschaftete Berghütte
    'wilderness_hut',    -- Selbstversorgerhütte
    'chalet',            -- Almhütte / Hütte zum Mieten
    'camp_site',         -- Campingplatz
    'backcountry_camp'   -- Trekking- und Biwakplatz
  ));

-- ---------------------------------------------------------------------------
-- 3. Die Höhe mit ausliefern
--
-- Die Rückgabe der Funktion ändert sich, deshalb muss sie erst weg —
-- "create or replace" allein reicht dafür nicht.
-- ---------------------------------------------------------------------------

drop function if exists public.water_points_in_bbox(
  double precision, double precision, double precision, double precision
);

create function public.water_points_in_bbox(
  min_lat double precision,
  min_lng double precision,
  max_lat double precision,
  max_lng double precision
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
        );
$$;

-- Das Ausführungsrecht war an der alten Funktion hängen und ist mit ihr
-- verschwunden — hier neu vergeben.
grant execute on function public.water_points_in_bbox(
  double precision, double precision, double precision, double precision
) to anon, authenticated;
