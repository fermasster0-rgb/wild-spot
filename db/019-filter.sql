-- ============================================================================
-- 019 — Spots nach den Filterchips holen
--
-- Bisher taten die Chips auf der Entdecken-Seite nur eines: zur Karte
-- springen und dort Punkte ausblenden. Wer wissen wollte, welche Plätze über
-- der Baumgrenze liegen, bekam eine Karte mit ein paar Punkten darauf — aber
-- keine Liste, in der er sie durchsehen kann.
--
-- Diese Funktion liefert genau diese Liste: alle Spots, auf die die
-- angetippten Chips zutreffen, mit dem ersten Foto dazu. Damit kann die App
-- die Treffer als Kacheln zeigen, ohne für jeden Spot einzeln nachzufragen.
--
-- Die Chips kommen als Liste von Kürzeln herein ('hoch', 'baum', …) und nicht
-- als acht einzelne Parameter. Ein neuer Chip ist dann eine Zeile hier und
-- eine Zeile in screens.js — nicht eine neue Signatur, an der jede alte
-- Fassung der App hängen bleibt.
--
-- Wichtig: Die Bedingungen stehen damit an zwei Stellen — hier für die Liste,
-- in screens.js als Kartenausdruck für die Punkte auf der Karte. Das ist
-- Absicht: Die Karte filtert ohne Netz, was sie schon geladen hat. Wer eine
-- Bedingung ändert, muss beide Stellen anfassen; deshalb steht in screens.js
-- ein Hinweis auf diese Datei.
-- ============================================================================

create or replace function public.spots_filtern(
  chips    text[]           default '{}',
  von_lat  double precision default null,
  von_lng  double precision default null,
  anzahl   integer          default 60
)
returns table (
  id             uuid,
  name           text,
  lat            double precision,
  lng            double precision,
  description    text,
  elevation_m    integer,
  water_nearby   boolean,
  has_lake       boolean,
  above_treeline boolean,
  hike_minutes   integer,
  avg_stars      numeric,
  rating_count   bigint,
  created_at     timestamptz,
  foto_pfad      text,
  foto_anzahl    bigint,
  entfernung_km  double precision
)
language sql
stable
security invoker
set search_path = public, extensions
as $$
  select
    s.id, s.name,
    st_y(s.location::geometry) as lat,
    st_x(s.location::geometry) as lng,
    s.description, s.elevation_m,
    s.water_nearby, s.has_lake, s.above_treeline, s.hike_minutes,
    s.avg_stars, s.rating_count, s.created_at,
    f.storage_path as foto_pfad,
    coalesce(f.gesamt, 0) as foto_anzahl,
    case
      when von_lat is null or von_lng is null then null
      else round((st_distance(
             s.location,
             st_point(von_lng, von_lat)::geography
           ) / 1000)::numeric, 1)::double precision
    end as entfernung_km
  from public.spots_with_rating s
  left join lateral (
    select p.storage_path,
           count(*) over () as gesamt
    from public.spot_photos p
    where p.spot_id = s.id
    order by p.sort_order asc nulls last, p.created_at asc
    limit 1
  ) f on true
  -- Jede Zeile liest sich als: "Ist dieser Chip nicht angetippt, ist die
  -- Bedingung erfuellt." Angetippte Chips gelten zusammen — zwei Chips heisst
  -- beides, nicht eines von beiden. Genau so ist die Frage gemeint, die
  -- jemand mit zwei Chips stellt.
  where (not ('see'    = any(coalesce(chips, '{}'))) or s.has_lake is true)
    and (not ('wasser' = any(coalesce(chips, '{}'))) or s.water_nearby is true)
    and (not ('hoch'   = any(coalesce(chips, '{}'))) or coalesce(s.elevation_m, 0) >= 1500)
    and (not ('baum'   = any(coalesce(chips, '{}'))) or s.above_treeline is true)
    -- Ohne eingetragene Gehzeit faellt ein Spot hier heraus: "unter einer
    -- Stunde" ist eine Zusage, und die kann man ohne Angabe nicht geben.
    and (not ('kurz'   = any(coalesce(chips, '{}'))) or coalesce(s.hike_minutes, 9999) <= 60)
    and (not ('gut'    = any(coalesce(chips, '{}'))) or coalesce(s.avg_stars, 0) >= 4)
    and (not ('still'  = any(coalesce(chips, '{}'))) or s.discreet = 'sehr')
    and (not ('feuer'  = any(coalesce(chips, '{}'))) or s.fire_allowed = 'erlaubt')
  order by
    -- Ist der Standort bekannt, ist der naechste Treffer der beste. Sonst
    -- zaehlt die Bewertung, und zuletzt das Alter.
    case when von_lat is not null and von_lng is not null then
      st_distance(s.location, st_point(von_lng, von_lat)::geography)
    end asc nulls last,
    s.avg_stars desc nulls last,
    s.rating_count desc nulls last,
    s.created_at desc
  limit least(greatest(coalesce(anzahl, 60), 1), 100);
$$;

grant execute on function public.spots_filtern(text[], double precision, double precision, integer)
  to anon, authenticated;
