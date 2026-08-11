-- ============================================================================
-- Migration 002 — water_points für den OSM-Import nachschärfen
-- Stand: 2026-08-04
--
-- Zwei Korrekturen am ursprünglichen Schema:
--
-- 1. Neue Spalte osm_type ('node' / 'way' / 'relation').
--    Grund: In OpenStreetMap sind die IDs nur INNERHALB einer Objektart
--    eindeutig. Es kann gleichzeitig einen Knoten 123 und einen Weg 123 geben.
--    Ohne osm_type würde die Doppelten-Sperre die beiden verwechseln und einen
--    davon wegwerfen.
--
-- 2. Zwei zusätzliche Arten: 'wilderness_hut' (Selbstversorgerhütte) und
--    'water_tap' (Wasserhahn). Beides für Wildcampen relevant.
--
-- Wiederholbar: kann mehrfach laufen.
-- ============================================================================

alter table public.water_points
  add column if not exists osm_type text;

alter table public.water_points
  drop constraint if exists water_points_source_osm_id_kind_key;

alter table public.water_points
  drop constraint if exists water_points_osm_unique;

-- Ein OSM-Objekt kommt genau einmal in die Tabelle, egal wie oft das
-- Import-Skript läuft.
alter table public.water_points
  add constraint water_points_osm_unique unique (source, osm_type, osm_id, kind);

alter table public.water_points
  drop constraint if exists water_points_kind_check;

alter table public.water_points
  add constraint water_points_kind_check check (kind in (
    'spring',          -- Quelle
    'drinking_water',  -- Trinkbrunnen
    'well',            -- Brunnen
    'water_tap',       -- Wasserhahn
    'water',           -- See / Teich
    'shelter',         -- Unterstand / Biwakschachtel
    'alpine_hut',      -- bewirtschaftete Hütte
    'wilderness_hut'   -- Selbstversorgerhütte
  ));
