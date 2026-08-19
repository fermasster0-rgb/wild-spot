-- ============================================================================
-- 025 — Geheime Spots
--
-- Der Grund, warum viele ihre besten Plätze gar nicht erst eintragen: Sobald
-- sie in der App stehen, stehen sie für alle drin. Wer eine Lichtung kennt,
-- an der seit Jahren niemand war, trägt sie nicht ein, um sie nicht zu
-- verlieren.
--
-- Ein geheimer Spot löst das: Er liegt in derselben Karte, mit denselben
-- Angaben, aber nur der Ersteller sieht ihn — und wer einen Link von ihm
-- bekommt.
--
-- ----------------------------------------------------------------------------
-- Warum ein Token und nicht die ID
--
-- Die Spot-ID steht in jedem geteilten Link (?spot=…). Würde der Zugriff auf
-- einen geheimen Spot allein an der ID hängen, wäre er nicht geheim: Wer
-- irgendwann einmal einen Link bekommen hat, käme für immer heran, und wer
-- IDs durchprobiert, ebenfalls.
--
-- Deshalb ein zweiter, eigener Schlüssel pro Spot. Er steht nur im Link, und
-- er lässt sich neu würfeln — dann sind alle alten Links tot. Das ist der
-- Unterschied zwischen "versteckt" und "verschlossen".
-- ============================================================================

alter table public.spots
  add column if not exists privat boolean not null default false;

alter table public.spots
  add column if not exists share_token uuid not null default gen_random_uuid();

comment on column public.spots.privat is
  'Geheim: nur der Ersteller sieht ihn — und wer den Link mit share_token hat.';
comment on column public.spots.share_token is
  'Der Schlüssel im Freigabelink. Neu würfeln macht alle alten Links ungültig.';

-- Der Index sitzt auf den öffentlichen Zeilen, denn die werden bei jeder
-- Kartenbewegung gelesen. Nach den geheimen fragt nur ihr Besitzer.
create index if not exists spots_oeffentlich_idx on public.spots (privat) where not privat;


-- ----------------------------------------------------------------------------
-- Wer darf einen geheimen Spot sehen?
--
-- Die bisherige Regel war "alle sehen alles". Sie bekommt eine Bedingung:
-- geheime Spots nur für ihren Ersteller. Admins ausdrücklich NICHT — ein
-- geheimer Platz, den der Betreiber trotzdem sieht, ist ein gebrochenes
-- Versprechen. Sie können ihn löschen (dafür gibt es Gründe: Missbrauch,
-- Beschwerden), aber nicht ansehen.
--
-- Der Zugriff über den Link läuft nicht über diese Regel, sondern über die
-- Funktion spot_per_token weiter unten — die kommt an der Regel vorbei, weil
-- sie den Schlüssel prüft.
-- ----------------------------------------------------------------------------

drop policy if exists "spots lesen" on public.spots;
create policy "spots lesen" on public.spots
  for select to anon, authenticated
  using (not privat or created_by = auth.uid());


-- ----------------------------------------------------------------------------
-- Einen geheimen Spot über den Link öffnen
--
-- security definer: Die Funktion umgeht die Leseregel bewusst — das ist ihr
-- ganzer Zweck. Sie gibt aber nur genau die eine Zeile heraus, deren Schlüssel
-- übergeben wurde, und nichts sonst. Ohne passenden Schlüssel kommt nichts
-- zurück, nicht einmal die Auskunft, ob es den Spot gibt.
-- ----------------------------------------------------------------------------

create or replace function public.spot_per_token(token uuid)
returns table (
  id          uuid,
  name        text,
  lat         double precision,
  lng         double precision,
  privat      boolean
)
language sql
stable
security definer
set search_path = public, extensions
as $$
  select
    s.id,
    s.name,
    st_y(s.location::geometry) as lat,
    st_x(s.location::geometry) as lng,
    s.privat
  from public.spots s
  where s.share_token = token
  limit 1;
$$;

grant execute on function public.spot_per_token(uuid) to anon, authenticated;


-- ----------------------------------------------------------------------------
-- Die Karte lässt geheime Spots weg — außer die eigenen
--
-- spots_in_bbox läuft als security invoker, die Leseregel oben greift also
-- ohnehin. Die Bedingung steht trotzdem noch einmal ausdrücklich drin: Wer
-- diese Funktion später liest, soll nicht erst die Regeln nachschlagen
-- müssen, um zu wissen, dass hier nichts Geheimes herauskommt.
-- ----------------------------------------------------------------------------

drop function if exists public.spots_in_bbox(
  double precision, double precision, double precision, double precision);

create or replace function public.spots_in_bbox(
  min_lat double precision,
  min_lng double precision,
  max_lat double precision,
  max_lng double precision
)
returns table (
  id             uuid,
  name           text,
  lat            double precision,
  lng            double precision,
  avg_stars      numeric,
  rating_count   bigint,
  water_nearby   boolean,
  above_treeline boolean,
  elevation_m    integer,
  has_lake       boolean,
  hike_minutes   integer,
  fire_allowed   text,
  discreet       text,
  vip            boolean,
  vip_notiz      text,
  privat         boolean
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
    st_x(s.location::geometry) as lng,
    coalesce(avg(r.stars), 0)::numeric(2,1) as avg_stars,
    count(r.id) as rating_count,
    s.water_nearby,
    s.above_treeline,
    s.elevation_m,
    s.has_lake,
    s.hike_minutes,
    s.fire_allowed,
    s.discreet,
    s.vip,
    s.vip_notiz,
    s.privat
  from public.spots s
  left join public.ratings r on r.spot_id = s.id
  where st_intersects(
          s.location,
          st_makeenvelope(min_lng, min_lat, max_lng, max_lat, 4326)::geography
        )
    and (not s.privat or s.created_by = auth.uid())
  group by s.id;
$$;

grant execute on function public.spots_in_bbox(
  double precision, double precision, double precision, double precision)
  to anon, authenticated;


-- ----------------------------------------------------------------------------
-- Die Ansicht noch einmal nachziehen
--
-- Aus demselben Grund wie in 024: "select s.*" hat die Spaltenliste beim
-- letzten Anlegen festgeschrieben, privat und share_token fehlen darin.
-- ----------------------------------------------------------------------------

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
