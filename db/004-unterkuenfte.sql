-- ============================================================================
-- Migration 004 — Unterkünfte auf der Karte, und die Bushaltestellen raus
-- Stand: 2026-08-04
--
-- Zwei Dinge:
--
-- 1. AUFRÄUMEN. In OpenStreetMap ist "amenity=shelter" der übliche Tag für
--    das Wartehäuschen an der Bushaltestelle. Von den 27.397 importierten
--    "Unterständen" sind deshalb die allermeisten Bushaltestellen — für
--    Wildcampen völlig wertlos und sie überdecken die echten Biwakplätze.
--    Sie fliegen raus, der Import holt danach nur noch die brauchbaren
--    Bauarten (Biwakschachtel, Schutzdach, Felsunterstand).
--
-- 2. NEUE ARTEN für den Unterkünfte-Layer:
--      chalet            — Almhütte, Selbstversorgerhütte, Ferienhütte
--      camp_site         — Campingplatz
--      backcountry_camp  — Trekking- und Biwakplatz, offiziell erlaubtes
--                          Zelten abseits der Straße. Das ist die Kategorie,
--                          die dem Wildcampen am nächsten kommt und dabei
--                          rechtlich sauber ist.
--
-- Wiederholbar: kann mehrfach laufen.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Erlaubte Arten erweitern
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
    'water',             -- See / Teich
    -- Unterkünfte und Unterstände
    'shelter',           -- Biwakschachtel, Schutzdach, Felsunterstand
    'alpine_hut',        -- bewirtschaftete Berghütte
    'wilderness_hut',    -- Selbstversorgerhütte
    'chalet',            -- Almhütte / Hütte zum Mieten
    'camp_site',         -- Campingplatz
    'backcountry_camp'   -- Trekking- und Biwakplatz
  ));

-- ---------------------------------------------------------------------------
-- 2. Die alten Unterstände wegräumen
--
-- Der Import legt sie gleich danach neu an — diesmal gefiltert. Nur die
-- aus OpenStreetMap, von Hand angelegte Punkte bleiben unberührt.
-- ---------------------------------------------------------------------------

delete from public.water_points
where source = 'osm' and kind = 'shelter';
