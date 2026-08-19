-- ============================================================================
-- 027 — Schutzgebiete
--
-- Der teuerste Fehler beim Wildcampen ist kein vergessener Schlafsack, sondern
-- die falsche Wiese. Eine Verwaltungsstrafe im Nationalpark kostet mehr als
-- Plus in zehn Jahren — und man sieht dem Gelände nicht an, dass man drin ist.
--
-- Deshalb liegen die Grenzen als Fläche auf der Karte. Nicht als Punkt: Ein
-- Nationalpark ist kein Ort, sondern ein Gebiet, und die einzige Frage, die
-- zählt, lautet "bin ich drin oder nicht".
--
-- ----------------------------------------------------------------------------
-- Was hier NICHT behauptet wird
--
-- Diese Flächen sind eine Hilfe, keine Rechtsauskunft. Sie kommen aus
-- OpenStreetMap und sind so genau, wie sie dort jemand eingezeichnet hat.
-- Die App muss das sagen, und sie sagt es auch — sonst wäre die Karte eine
-- Zusage, die niemand geben kann.
--
-- Datenquelle: OpenStreetMap, Lizenz ODbL. In der App steht die Nennung.
-- ============================================================================

create table if not exists public.protected_areas (
  id          bigserial primary key,

  -- Woher der Eintrag stammt. Zusammen eindeutig, damit ein zweiter Import
  -- aktualisiert statt zu verdoppeln.
  osm_type    text not null check (osm_type in ('way', 'relation')),
  osm_id      bigint not null,

  name        text,

  -- Grob nach Strenge sortiert. Die Feinheiten unterscheiden sich je
  -- Bundesland; für die Karte zählt, wie deutlich die Warnung ausfällt.
  art         text not null check (art in ('nationalpark', 'naturschutz', 'natura2000', 'sonstiges')),

  -- Die Fläche selbst. MultiPolygon, weil ein Schutzgebiet aus mehreren
  -- getrennten Teilen bestehen kann — der Nationalpark Donau-Auen etwa liegt
  -- in Stücken links und rechts der Donau.
  flaeche     geography(MultiPolygon, 4326) not null,

  geholt_am   timestamptz not null default now(),

  unique (osm_type, osm_id)
);

-- Der Index, auf dem die Kartenabfrage läuft.
create index if not exists protected_areas_flaeche_idx
  on public.protected_areas using gist (flaeche);

comment on table public.protected_areas is
  'Schutzgebiete als Flächen, aus OpenStreetMap (scripts/import-schutzgebiete.mjs). '
  'Hilfe zur Orientierung, keine Rechtsauskunft.';


-- ----------------------------------------------------------------------------
-- Lesen darf jeder, schreiben nur der Server
--
-- Die Daten sind öffentlich und stehen ohnehin in OpenStreetMap. Geschrieben
-- wird ausschließlich vom Import-Skript, das mit dem service_role-Schlüssel
-- läuft — für angemeldete Nutzer gibt es keine Schreibregel, also auch keinen
-- Weg hinein.
-- ----------------------------------------------------------------------------

alter table public.protected_areas enable row level security;

drop policy if exists "schutzgebiete lesen" on public.protected_areas;
create policy "schutzgebiete lesen" on public.protected_areas
  for select to anon, authenticated using (true);


-- ----------------------------------------------------------------------------
-- Die Flächen im sichtbaren Ausschnitt
--
-- Zurück kommt fertiges GeoJSON — die Karte kann damit direkt zeichnen, ohne
-- dass die App Geometrie umrechnen muss.
--
-- ST_Simplify glättet die Umrisse. Ein Nationalpark hat in OSM leicht 20.000
-- Stützpunkte; auf einem Handybildschirm sind davon vielleicht 200 zu
-- unterscheiden. Der Rest ist Datenvolumen, das die Karte langsam macht. Die
-- Toleranz hängt am Zoom: weit draußen darf gröber vereinfacht werden.
-- ----------------------------------------------------------------------------

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
  select coalesce(
    jsonb_build_object(
      'type', 'FeatureCollection',
      'features', coalesce(jsonb_agg(
        jsonb_build_object(
          'type', 'Feature',
          'properties', jsonb_build_object('name', p.name, 'art', p.art),
          'geometry', st_asgeojson(
            st_simplify(
              p.flaeche::geometry,
              -- Bei Zoom 14 rund 2 Meter, bei Zoom 8 rund 150 Meter.
              greatest(0.00002, 0.05 / power(2, greatest(zoom, 4) - 6))
            )
          )::jsonb
        )
      ), '[]'::jsonb)
    ),
    jsonb_build_object('type', 'FeatureCollection', 'features', '[]'::jsonb)
  )
  from public.protected_areas p
  where st_intersects(
          p.flaeche,
          st_makeenvelope(min_lng, min_lat, max_lng, max_lat, 4326)::geography
        );
$$;

grant execute on function public.schutzgebiete_in_bbox(
  double precision, double precision, double precision, double precision, integer)
  to anon, authenticated;
