-- ============================================================================
-- Migration 009 — Wasserfälle als eigene Art
-- Stand: 2026-08-11
--
-- Warum eine eigene Art und nicht einfach "Quelle":
-- Ein Wasserfall ist beides — verlässliches Wasser und ein Grund, überhaupt
-- dorthin zu gehen. Genau wie beim Bergsee ist das der Unterschied zu einem
-- Trinkbrunnen: Man sucht nicht Wasser und findet zufällig einen Wasserfall,
-- sondern man sucht den Wasserfall.
--
-- In OpenStreetMap steht er als waterway=waterfall.
--
-- Wiederholbar: kann mehrfach laufen.
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
    'waterfall',         -- Wasserfall  (neu in dieser Migration)
    -- Unterkünfte und Unterstände
    'shelter',           -- Biwakschachtel, Schutzdach, Felsunterstand
    'alpine_hut',        -- bewirtschaftete Berghütte
    'wilderness_hut',    -- Selbstversorgerhütte
    'chalet',            -- Almhütte / Hütte zum Mieten
    'camp_site',         -- Campingplatz
    'backcountry_camp'   -- Trekking- und Biwakplatz
  ));
