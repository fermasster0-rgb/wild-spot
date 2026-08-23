-- ============================================================================
-- Migration 032 — Schlüssel für eingespielte Spots
-- Stand: 2026-08-23
--
-- Warum:
-- Die recherchierten Spots kommen aus Dateien und werden mit einem Skript
-- eingespielt. So ein Skript läuft nie nur einmal: Ein Land kommt dazu, ein
-- Text wird besser, eine Koordinate wird korrigiert — und dann läuft es
-- wieder. Ohne Merkmal, an dem die Datenbank einen schon vorhandenen Spot
-- wiedererkennt, entsteht bei jedem Lauf ein zweiter davon.
--
-- Dass das kein Schreckgespenst ist, steht in der Tabelle: Der Lünersee liegt
-- zweimal drin, 300 m auseinander, aus dem Geodaten-Import vom August.
--
-- Der Schlüssel ist bewusst ein Text und keine Zahl, damit man ihm ansieht,
-- woher der Spot stammt:
--     nordics:Kvalvika – Bucht hinter dem Ryten
--
-- Er ist eindeutig und darf leer bleiben: Spots, die ein Mensch über das
-- Formular anlegt, haben keinen — und sollen auch keinen bekommen. "unique"
-- lässt beliebig viele NULL-Werte zu, das passt genau.
--
-- Wiederholbar: kann mehrfach laufen.
-- ============================================================================

alter table public.spots
  add column if not exists import_key text;

comment on column public.spots.import_key is
  'Herkunft eingespielter Spots, z. B. "nordics:<Name>". Leer bei Spots aus dem Formular.';

create unique index if not exists spots_import_key_idx
  on public.spots (import_key)
  where import_key is not null;


-- ----------------------------------------------------------------------------
-- Niemand darf sich fremde Spots unter den Nagel reißen
--
-- Der Schlüssel entscheidet, welchen Spot der nächste Import überschreibt.
-- Könnte ihn jeder setzen, könnte auch jeder einen fremden Spot beim nächsten
-- Lauf mit eigenen Daten überschreiben lassen. Deshalb dasselbe Muster wie
-- bei vip in 023 und plus_until in 017: Über die Schnittstelle geht es nicht.
--
-- Das Import-Skript arbeitet nicht über die Schnittstelle, sondern direkt auf
-- der Datenbank — für den Verwalter der Datenbank gilt der Trigger nicht.
-- ----------------------------------------------------------------------------

create or replace function public.import_key_nur_admin()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if new.import_key is not null
       and not coalesce((select is_admin from public.profiles where id = auth.uid()), false) then
      new.import_key := null;
    end if;
  else
    if new.import_key is distinct from old.import_key
       and not coalesce((select is_admin from public.profiles where id = auth.uid()), false) then
      new.import_key := old.import_key;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists spots_import_key_nur_admin on public.spots;
create trigger spots_import_key_nur_admin
  before insert or update on public.spots
  for each row execute function public.import_key_nur_admin();
