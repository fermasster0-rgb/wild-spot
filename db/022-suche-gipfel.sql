-- ============================================================================
-- Migration 022 — Gipfel gehören in der Suche nach vorne
--
-- punkte_suchen sortiert die Treffer nach Art: erst die Ziele (Bergsee,
-- Wasserfall, Hütte), dann die Versorgung (Trinkbrunnen). Gipfel gab es beim
-- Schreiben dieser Reihenfolge noch nicht und landeten deshalb in der
-- Sammelgruppe ganz hinten.
--
-- Das ist genau falsch herum: Wer "Großglockner" tippt, meint den Gipfel und
-- nicht den Trinkbrunnen am Parkplatz darunter. Ein Gipfel ist außerdem das
-- einzige, was man in dieser App sammeln kann — ihn zu finden ist der
-- häufigste Grund, überhaupt zu suchen.
--
-- Wiederholbar: kann mehrfach laufen.
-- ============================================================================

create or replace function public.punkte_suchen(
  q        text,
  max_rows integer default 8
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
    case w.kind
      when 'peak'           then 0
      when 'mountain_lake'  then 1
      when 'waterfall'      then 2
      when 'alpine_hut'     then 3
      when 'wilderness_hut' then 4
      else 5
    end,
    -- Wer den Anfang eines Namens tippt, meint meistens genau den.
    (w.name ilike q || '%') desc,
    -- Unter gleichnamigen Gipfeln steht der höchste oben. „Kreuzkogel" gibt
    -- es in Österreich elfmal; gemeint ist fast immer der bekannte, und der
    -- ist fast immer der höchste.
    w.elevation_m desc nulls last,
    w.name
  limit max_rows;
$$;

grant execute on function public.punkte_suchen(text, integer) to anon, authenticated;
