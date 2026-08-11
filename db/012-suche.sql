-- ============================================================================
-- Migration 012 — Suche nach Namen
-- Stand: 2026-08-11
--
-- Damit man tippen kann "lünersee" und der See kommt, ohne die Karte
-- abzusuchen.
--
-- Gesucht wird in zwei Töpfen:
--   spots         — die eigenen Plätze (wenige, aber die wichtigsten)
--   water_points  — 64.000 Punkte aus OpenStreetMap, davon rund 12.000 mit
--                   Namen: Bergseen, Wasserfälle, Hütten, Quellen
--
-- Warum eine Datenbankfunktion und keine einfache Abfrage aus der App:
-- Die Position liegt als Geo-Typ vor und käme über die normale Schnittstelle
-- als unlesbarer Hex-Text zurück. Die Funktion rechnet sie in Breite und
-- Länge um — genauso wie die Kartenabfragen daneben.
--
-- Wiederholbar: kann mehrfach laufen.
-- ============================================================================


-- ---------------------------------------------------------------------------
-- 1. Schnell suchen können
--
-- pg_trgm zerlegt Wörter in Dreiergruppen ("Lünersee" → "lün", "üne", "ner" …)
-- und legt sie in einen Index. Damit findet auch eine Suche mitten im Wort
-- ihr Ziel, ohne alle 64.000 Zeilen durchzugehen. Ohne diesen Index wäre die
-- Suche bei jedem Tastendruck eine volle Tabellensuche.
-- ---------------------------------------------------------------------------

create extension if not exists pg_trgm with schema extensions;

create index if not exists spots_name_trgm
  on public.spots using gin (name extensions.gin_trgm_ops);

create index if not exists water_points_name_trgm
  on public.water_points using gin (name extensions.gin_trgm_ops);


-- ---------------------------------------------------------------------------
-- 2. Spots suchen
-- ---------------------------------------------------------------------------

create or replace function public.spots_suchen(
  q         text,
  max_rows  integer default 6
)
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
  where s.name ilike '%' || q || '%'
  -- Wer "see" tippt, meint eher "Seewiese" als "Wiese am großen See":
  -- Treffer am Wortanfang zuerst.
  order by (s.name ilike q || '%') desc, s.name
  limit max_rows;
$$;


-- ---------------------------------------------------------------------------
-- 3. Punkte aus OpenStreetMap suchen
-- ---------------------------------------------------------------------------

create or replace function public.punkte_suchen(
  q         text,
  max_rows  integer default 8
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
  where w.name ilike '%' || q || '%'
  order by
    -- Erst die Ziele, dann die Versorgung: Wer sucht, meint meistens einen
    -- Bergsee oder Wasserfall und selten einen bestimmten Trinkbrunnen.
    case w.kind
      when 'mountain_lake' then 0
      when 'waterfall'     then 1
      when 'alpine_hut'    then 2
      when 'wilderness_hut' then 3
      else 4
    end,
    (w.name ilike q || '%') desc,
    w.name
  limit max_rows;
$$;


-- Beide dürfen auch Besucher ohne Konto aufrufen — sie zeigen nur, was
-- ohnehin auf der Karte steht.
grant execute on function public.spots_suchen(text, integer)  to anon, authenticated;
grant execute on function public.punkte_suchen(text, integer) to anon, authenticated;
