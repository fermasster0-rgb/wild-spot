-- ============================================================================
-- Migration 016 — einen einzelnen Spot über seine ID finden
-- Stand: 2026-08-14
--
-- Warum:
-- Seit es Links auf einen einzelnen Spot gibt (der Teilen-Knopf in der
-- Detail-Leiste), kommt jemand mit nichts als einer ID an:
--   https://…/wild-spot/?spot=8c1b0bde-…
-- Um die Karte dorthin zu schicken, braucht die App Name und Koordinaten.
--
-- Über die normale Tabellenabfrage geht das nicht: Die Position steht als
-- PostGIS-Punkt in location und käme über die Schnittstelle nur als
-- unlesbarer Hex-Text zurück. spots_in_bbox löst das für die Karte, indem es
-- st_y und st_x aufruft — aber dafür müsste man den Ausschnitt schon kennen,
-- und genau den sucht man ja.
--
-- Deshalb dasselbe noch einmal für genau einen Spot. Bewusst nur die vier
-- Felder, die zum Hinfliegen und Aufklappen nötig sind: Alles Weitere holt
-- die Detail-Leiste ohnehin selbst nach.
--
-- security invoker heißt: Die Funktion läuft mit den Rechten dessen, der sie
-- aufruft. Die Regel "spots lesen" gilt also weiter — sie erlaubt seit
-- Migration 007 jedem das Lesen, auch ohne Konto. Ein geteilter Link
-- funktioniert damit für jeden, genau wie gedacht.
--
-- Wiederholbar: kann mehrfach laufen.
-- ============================================================================

create or replace function public.spot_by_id(spot_id uuid)
returns table (
  id   uuid,
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
    s.id,
    s.name,
    st_y(s.location::geometry) as lat,
    st_x(s.location::geometry) as lng
  from public.spots s
  where s.id = spot_id;
$$;

grant execute on function public.spot_by_id(uuid) to anon, authenticated;
