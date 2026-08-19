-- ============================================================================
-- 029 — Beim Glätten verschwanden kleine Gebiete ganz
--
-- Die Abfrage aus 027 glättet die Umrisse mit ST_Simplify, damit ein
-- Nationalpark mit 20.000 Stützpunkten die Karte nicht lahmlegt. Das war
-- richtig gedacht und im Ergebnis falsch:
--
-- ST_Simplify (Douglas-Peucker) darf eine Fläche zu NICHTS vereinfachen. Ist
-- ein Gebiet kleiner als die Toleranz, bleibt eine leere Geometrie übrig — die
-- Karte bekommt ein Feature ohne Koordinaten und zeichnet nichts. Beim Prüfen
-- sah das so aus: 812 Gebiete geliefert, mehrere davon mit einem leeren
-- Koordinatenfeld.
--
-- Ausgerechnet die kleinen Gebiete verschwinden dabei zuerst — und ein kleines
-- Naturschutzgebiet ist genau das, was man auf der Karte übersieht und dann
-- versehentlich betritt.
--
-- Zwei Änderungen:
--
--   1. ST_SimplifyPreserveTopology statt ST_Simplify. Die Fassung gibt eine
--      Fläche nie ganz auf, sondern hört auf zu vereinfachen, bevor nichts
--      mehr da ist.
--
--   2. Trotzdem noch einmal prüfen und Leeres weglassen. Ein Feature ohne
--      Geometrie ist für die Karte kein Fehler, sondern ein stiller Ausfall —
--      und still ausfallen soll hier gar nichts.
-- ============================================================================

create or replace function public.schutzgebiete_in_bbox(
  min_lat double precision,
  min_lng double precision,
  max_lat double precision,
  max_lng double precision,
  zoom    integer default 12
)
returns jsonb
language sql
stable
security invoker
set search_path = public, extensions
as $$
  with gefunden as (
    select
      p.name,
      p.art,
      st_simplifypreservetopology(
        p.flaeche::geometry,
        -- Bei Zoom 14 rund 2 Meter, bei Zoom 8 rund 150 Meter.
        greatest(0.00002, 0.05 / power(2, greatest(zoom, 4) - 6))
      ) as umriss
    from public.protected_areas p
    where st_intersects(
            p.flaeche,
            st_makeenvelope(min_lng, min_lat, max_lng, max_lat, 4326)::geography
          )
  )
  select jsonb_build_object(
    'type', 'FeatureCollection',
    'features', coalesce(jsonb_agg(
      jsonb_build_object(
        'type', 'Feature',
        'properties', jsonb_build_object('name', g.name, 'art', g.art),
        'geometry', st_asgeojson(g.umriss)::jsonb
      )
    ), '[]'::jsonb)
  )
  from gefunden g
  where g.umriss is not null
    and not st_isempty(g.umriss);
$$;

grant execute on function public.schutzgebiete_in_bbox(
  double precision, double precision, double precision, double precision, integer)
  to anon, authenticated;


-- ----------------------------------------------------------------------------
-- Und die falsch eingestuften wieder herabsetzen
--
-- Die Abfrage boundary=national_park hat in Österreich nicht die sechs
-- Nationalparks geliefert, sondern einzelne Zonen und ein slowenisches
-- Waldreservat. Sie stehen jetzt als 'nationalpark' in der Tabelle und wären
-- auf der Karte kräftiger rot als der Nationalpark Hohe Tauern selbst — der
-- gar nicht drin ist.
--
-- Also zurück auf 'naturschutz'. Die echten Nationalparks holt das Skript
-- danach über ihren Namen (import-schutzgebiete.mjs).
-- ----------------------------------------------------------------------------

update public.protected_areas
   set art = 'naturschutz'
 where art = 'nationalpark'
   and (name is null or name not ilike '%nationalpark%');
