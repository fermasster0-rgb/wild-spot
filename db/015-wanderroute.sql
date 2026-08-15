-- ============================================================================
-- Migration 015 — Wanderroute vom Parkplatz zum Spot
-- Stand: 2026-08-14
--
-- Warum:
-- Bisher stand bei einem Spot nur "Gehzeit: 45 min" — eine Schätzung dessen,
-- der ihn eingetragen hat. Wer den Spot nicht kennt, weiß damit nichts: 45
-- Minuten flach am Bach entlang sind etwas völlig anderes als 45 Minuten mit
-- 400 Höhenmetern.
--
-- Deshalb bekommt jeder Spot einen zweiten Punkt: den Parkplatz, an dem die
-- Wanderung beginnt. Dazwischen rechnet OpenRouteService die Route über echte
-- Wanderwege aus OpenStreetMap (Profil foot-hiking) und liefert Linie,
-- Gehzeit und Höhenmeter. Gerechnet wird das im Skript
-- scripts/routen-rechnen.mjs, hier stehen nur die Spalten, in denen das
-- Ergebnis landet.
--
-- ----------------------------------------------------------------------------
-- Warum der Parkplatz zwei Zahlen sind und kein Geo-Punkt
--
-- Die Position des Spots ist ein PostGIS-Punkt, weil die Karte danach sucht
-- ("alle Spots in diesem Ausschnitt") — dafür braucht es einen Geo-Index.
-- Nach Parkplätzen sucht dagegen niemand; der Parkplatz gehört immer zu genau
-- einem Spot und wird nur mitgelesen. Als zwei einfache Zahlen kann ihn der
-- Browser direkt lesen und schreiben, ohne den Umweg über WKT und ohne dass
-- er als unlesbarer Hex-Text zurückkommt.
--
-- ----------------------------------------------------------------------------
-- Warum die Route gespeichert wird und nicht jedes Mal neu gerechnet
--
--   · OpenRouteService erlaubt gratis 2.000 Anfragen am Tag. Würde jeder
--     Besucher bei jedem Antippen eine Route rechnen lassen, wäre das
--     Kontingent an einem guten Tag weg.
--   · Der Schlüssel dafür müsste im Browser liegen und wäre damit öffentlich.
--     So bleibt er in .env.local — nur das Rechenskript kennt ihn.
--   · Eine Wanderroute ändert sich nicht. Einmal rechnen genügt.
--
-- ----------------------------------------------------------------------------
-- Der Trigger, der die Route wieder wegwirft
--
-- Wird der Parkplatz verschoben, ist die gespeicherte Linie falsch — sie
-- beginnt dann woanders. Das darf nicht passieren, denn eine falsche Route
-- am Berg ist schlimmer als gar keine. Deshalb leert ein Trigger die
-- Routen-Spalten automatisch, sobald sich der Parkplatz oder die Position des
-- Spots ändert. Das Rechenskript findet den Spot beim nächsten Lauf von
-- selbst wieder und füllt ihn neu.
--
-- Wiederholbar: kann mehrfach laufen.
-- ============================================================================


-- ------------------------------------------------------------- Spalten -----
alter table public.spots
  -- Der Parkplatz: wo das Auto stehen bleibt und die Wanderung anfängt.
  add column if not exists parking_lat       double precision
    check (parking_lat between -90 and 90),
  add column if not exists parking_lng       double precision
    check (parking_lng between -180 and 180),

  -- Das Ergebnis von OpenRouteService.
  -- route_line ist die Linie als Liste von [Länge, Breite]-Paaren — genau
  -- das, was MapLibre als GeoJSON-LineString zeichnen kann.
  add column if not exists route_line        jsonb,
  add column if not exists route_minutes     integer
    check (route_minutes between 0 and 10080),
  add column if not exists route_distance_m  integer
    check (route_distance_m between 0 and 500000),
  add column if not exists route_ascent_m    integer
    check (route_ascent_m between 0 and 20000),
  add column if not exists route_descent_m   integer
    check (route_descent_m between 0 and 20000),

  -- 'ok'       — Route gerechnet, alles da
  -- 'kein_weg' — OpenRouteService findet keinen Weg (etwa Parkplatz mitten
  --              im Nichts oder jenseits eines Gewässers ohne Brücke)
  -- 'fehler'   — der Dienst war nicht erreichbar; beim nächsten Lauf erneut
  add column if not exists route_status      text
    check (route_status in ('ok', 'kein_weg', 'fehler')),
  add column if not exists route_updated_at  timestamptz;

comment on column public.spots.parking_lat is
  'Breite des Parkplatzes, an dem die Wanderung zum Spot beginnt.';
comment on column public.spots.route_line is
  'Die Wanderroute als Liste von [lng,lat]-Paaren. Gerechnet von '
  'OpenRouteService, Profil foot-hiking. Wird von scripts/routen-rechnen.mjs '
  'gefüllt, nie von Hand.';
comment on column public.spots.route_minutes is
  'Gemessene Gehzeit in Minuten. Ersetzt in der Anzeige die geschätzte '
  'hike_minutes, sobald sie da ist.';


-- ------------------------------------------------- Route bei Umzug leeren -----
create or replace function public.spots_route_zuruecksetzen()
returns trigger
language plpgsql
set search_path = public, extensions
as $$
begin
  -- "is distinct from" statt <> — damit auch der Wechsel von NULL auf einen
  -- Wert (und zurück) als Änderung zählt. Mit <> wäre jeder Vergleich mit
  -- NULL selbst NULL, also nie wahr, und der Trigger würde stillschweigend
  -- nichts tun.
  if new.parking_lat is distinct from old.parking_lat
     or new.parking_lng is distinct from old.parking_lng
     or not st_equals(new.location::geometry, old.location::geometry)
  then
    new.route_line       := null;
    new.route_minutes    := null;
    new.route_distance_m := null;
    new.route_ascent_m   := null;
    new.route_descent_m  := null;
    new.route_status     := null;
    new.route_updated_at := null;
  end if;

  return new;
end;
$$;

drop trigger if exists spots_route_zuruecksetzen on public.spots;
create trigger spots_route_zuruecksetzen
  before update on public.spots
  for each row execute function public.spots_route_zuruecksetzen();


-- ============================================================================
-- Die View auffrischen — Pflicht nach JEDER neuen Spalte.
--
-- Der Grund steht ausführlich in 011-view-auffrischen.sql: "select s.*" wird
-- einmal beim Anlegen aufgelöst, spätere Spalten fehlen für immer. Die App
-- fragt die Spot-Details über diese View ab und nennt jede Spalte einzeln —
-- ohne das hier bliebe die ganze Detail-Leiste leer.
-- ============================================================================

drop view if exists public.spots_with_rating;

create view public.spots_with_rating
with (security_invoker = on) as
  select
    s.*,
    coalesce(avg(r.stars), 0)::numeric(2,1) as avg_stars,
    count(r.id)                             as rating_count
  from public.spots s
  left join public.ratings r on r.spot_id = s.id
  group by s.id;

grant select on public.spots_with_rating to anon, authenticated;
