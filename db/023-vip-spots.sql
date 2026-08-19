-- ============================================================================
-- 023 — Handverlesene Spots (VIP)
--
-- Bis hierher waren alle Spots gleich: eingetragen von irgendwem, bewertet von
-- irgendwem. Das ist die Stärke der Karte und zugleich ihre Schwäche — bei
-- vierzehn Spots sieht man noch alles durch, bei vierhundert nicht mehr.
--
-- Ein handverlesener Spot ist einer, den jemand ausgesucht hat, der dort war.
-- Nicht der mit den meisten Sternen: Sterne sammelt der Platz, den viele
-- finden, nicht der beste. Der beste liegt oft dort, wo kaum einer hinkommt.
--
-- Zwei Spalten, mehr braucht es nicht:
--
--   vip        — ist er handverlesen?
--   vip_notiz  — warum. Ein Satz von dem, der ihn ausgesucht hat.
--
-- Die Notiz ist kein Beiwerk. „Handverlesen" ohne Begründung ist eine
-- Behauptung; mit Begründung ist es eine Empfehlung. Und sie ist das, wofür
-- jemand mit Plus bezahlt.
--
-- Setzen darf das Kennzeichen nur ein Admin. Sonst wäre es in einer Woche
-- wertlos: Jeder würde seinen eigenen Platz auszeichnen.
-- ============================================================================

alter table public.spots
  add column if not exists vip boolean not null default false;

alter table public.spots
  add column if not exists vip_notiz text
    check (vip_notiz is null or char_length(vip_notiz) <= 400);

comment on column public.spots.vip is
  'Handverlesen. Nur Admins dürfen das setzen (Trigger vip_nur_admin).';
comment on column public.spots.vip_notiz is
  'Warum dieser Platz ausgesucht wurde — ein Satz von dem, der dort war.';

-- Ein Teilindex nur über die ausgezeichneten Zeilen. Sie sind die Minderheit,
-- und genau nach ihnen wird gefiltert.
create index if not exists spots_vip_idx on public.spots (vip) where vip;


-- ----------------------------------------------------------------------------
-- Nur Admins dürfen auszeichnen
--
-- Nach demselben Muster wie plus_until in 017: Der Trigger lässt die Änderung
-- nicht scheitern, er dreht sie zurück. Ein harter Fehler würde das Speichern
-- eines Spots aus ganz anderem Grund abbrechen — dann könnte niemand mehr
-- seinen eigenen Platz bearbeiten, nur weil das Formular das Feld mitschickt.
-- ----------------------------------------------------------------------------

create or replace function public.vip_schuetzen()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Ohne angemeldeten Nutzer läuft der service_role-Schlüssel auf dem Server.
  if auth.uid() is null then
    return new;
  end if;

  if exists (select 1 from public.profiles p
             where p.id = auth.uid() and p.is_admin = true) then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.vip := false;
    new.vip_notiz := null;
  else
    new.vip := old.vip;
    new.vip_notiz := old.vip_notiz;
  end if;
  return new;
end;
$$;

drop trigger if exists vip_nur_admin on public.spots;
create trigger vip_nur_admin
  before insert or update on public.spots
  for each row execute function public.vip_schuetzen();


-- ----------------------------------------------------------------------------
-- Die Karte muss wissen, welcher Punkt handverlesen ist
--
-- spots_in_bbox bekommt zwei Spalten dazu. Eine Funktion mit geänderter
-- Rückgabe lässt sich nicht mit "create or replace" überschreiben — Postgres
-- verweigert das. Also erst weg, dann neu, und die Rechte danach wieder
-- vergeben, denn die fallen mit der Funktion mit.
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
  vip_notiz      text
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
    s.vip_notiz
  from public.spots s
  left join public.ratings r on r.spot_id = s.id
  where st_intersects(
          s.location,
          st_makeenvelope(min_lng, min_lat, max_lng, max_lat, 4326)::geography
        )
  group by s.id;
$$;

grant execute on function public.spots_in_bbox(
  double precision, double precision, double precision, double precision)
  to anon, authenticated;


-- ----------------------------------------------------------------------------
-- Admins haben Plus
--
-- Wer die App verwaltet, muss jede Funktion darin sehen können — sonst prüft
-- er blind. Das Datum steht weit in der Zukunft und nicht auf "unendlich",
-- weil plus_until ein Zeitpunkt ist und bleiben soll.
--
-- Die App rechnet zusätzlich clientseitig damit (plus.js), damit ein frisch
-- ernannter Admin nicht auf diese Zeile warten muss.
-- ----------------------------------------------------------------------------

update public.profiles
   set plus_until = timestamptz '2099-12-31 00:00:00+00',
       plus_tarif = 'immer'
 where is_admin = true
   and (plus_until is null or plus_until < now());
