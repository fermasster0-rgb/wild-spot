-- ============================================================================
-- Migration 033 — den Wächter über import_key richtig stellen
-- Stand: 2026-08-23
--
-- Was schiefging:
-- Der Trigger aus 032 sollte verhindern, dass sich jemand über die
-- Schnittstelle einen fremden import_key setzt. Er prüfte dafür, ob der
-- Aufrufer Admin ist — über auth.uid().
--
-- Nur: Bei einer direkten Datenbankverbindung gibt es gar keinen angemeldeten
-- Nutzer, auth.uid() ist dort schlicht NULL. Der Trigger hielt das Import-
-- Skript also für einen Fremden und warf jeden Schlüssel weg. Aufgefallen ist
-- es daran, dass nach dem ersten Lauf 88 Spots in der Tabelle standen und
-- kein einziger einen Schlüssel hatte — ein zweiter Lauf hätte alle 88 ein
-- zweites Mal angelegt.
--
-- Die Korrektur:
-- Nicht "ist der Aufrufer Admin", sondern zuerst "kommt der Aufruf überhaupt
-- über die Schnittstelle". PostgREST legt zu jedem Aufruf request.jwt.claims
-- ab — auch bei einem anonymen Besucher. Fehlt diese Angabe ganz, sitzt
-- niemand am anderen Ende: dann läuft ein Skript direkt auf der Datenbank,
-- und wer das darf, hat ohnehin alle Rechte.
--
-- Über die Schnittstelle bleibt alles wie gedacht: nur Admins.
--
-- Wiederholbar: kann mehrfach laufen.
-- ============================================================================

create or replace function public.import_key_nur_admin()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  ueber_schnittstelle boolean;
  darf                boolean;
begin
  -- Kommt der Aufruf von aussen, also über PostgREST?
  ueber_schnittstelle := coalesce(current_setting('request.jwt.claims', true), '') <> '';

  -- Ein Skript auf der Datenbank selbst darf alles. Über die Schnittstelle
  -- entscheidet weiterhin das Admin-Kennzeichen.
  darf := (not ueber_schnittstelle)
          or coalesce((select is_admin from public.profiles where id = auth.uid()), false);

  if darf then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.import_key := null;
  else
    new.import_key := old.import_key;
  end if;

  return new;
end;
$$;

drop trigger if exists spots_import_key_nur_admin on public.spots;
create trigger spots_import_key_nur_admin
  before insert or update on public.spots
  for each row execute function public.import_key_nur_admin();
