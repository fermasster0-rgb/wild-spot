-- ============================================================================
-- Migration 013 — Admin-Rolle
-- Stand: 2026-08-12
--
-- Bisher folgte jede Regel demselben Muster: "nur was mir selbst gehört".
-- Das ist für normale Nutzer richtig, aber der Betreiber der App muss
-- aufräumen können — falsche Spots korrigieren, Unsinn löschen, Fotos
-- nachtragen.
--
-- ----------------------------------------------------------------------------
-- Warum das in der Datenbank steht und nicht in der Webseite
--
-- Ein Admin-Knopf, den man nur im Browser versteckt, ist keine Sperre. Jeder
-- kann die Seite umschreiben oder die Schnittstelle direkt ansprechen — der
-- öffentliche Schlüssel steht ja in config.js. Deshalb entscheidet die
-- Datenbank, wer was darf. Die Webseite blendet den Bereich nur zusätzlich
-- aus, damit er niemanden verwirrt.
--
-- ----------------------------------------------------------------------------
-- Warum ist_admin() eine eigene Funktion ist
--
-- Eine Regel auf profiles, die selbst in profiles nachschlägt, würde sich im
-- Kreis drehen: um zu prüfen, ob jemand lesen darf, müsste sie lesen. Postgres
-- bricht das mit einer Fehlermeldung ab.
--
-- SECURITY DEFINER löst das: Die Funktion läuft mit den Rechten ihres
-- Eigentümers und übergeht die Regeln — sie ist damit die einzige Stelle, die
-- den Kreis durchbricht. "set search_path" gehört zwingend dazu, sonst könnte
-- jemand eine eigene Tabelle namens profiles unterschieben und die Funktion
-- damit zum Lügen bringen.
--
-- Wiederholbar: kann mehrfach laufen.
-- ============================================================================


-- ============================================================================
-- 1. DIE SPALTE
-- ============================================================================

alter table public.profiles
  add column if not exists is_admin boolean not null default false;

comment on column public.profiles.is_admin is
  'Darf alles sehen, ändern und löschen. Wird nur von Hand per SQL gesetzt — '
  'bewusst nicht über die App, damit sich niemand selbst befördern kann.';


-- ============================================================================
-- 2. DIE PRÜFFUNKTION
-- ============================================================================

create or replace function public.ist_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select p.is_admin from public.profiles p where p.id = auth.uid()),
    false
  );
$$;

comment on function public.ist_admin() is
  'true, wenn der gerade angemeldete Nutzer Admin ist. Ohne Anmeldung false.';

-- Aufrufbar für angemeldete und nicht angemeldete Besucher. Die Funktion
-- verrät nichts — sie sagt nur etwas über den Fragenden selbst.
grant execute on function public.ist_admin() to anon, authenticated;


-- ============================================================================
-- 3. DIE REGELN
--
-- Für jede Tabelle eine zusätzliche Regel. Die bestehenden bleiben
-- unangetastet: Postgres verknüpft mehrere Regeln mit ODER. Wer Admin ist,
-- kommt durch die neue; alle anderen weiterhin nur durch die alte.
-- ============================================================================

-- ---- Spots -----------------------------------------------------------------
drop policy if exists "admin darf spots aendern" on public.spots;
create policy "admin darf spots aendern" on public.spots
  for update using (public.ist_admin()) with check (public.ist_admin());

drop policy if exists "admin darf spots loeschen" on public.spots;
create policy "admin darf spots loeschen" on public.spots
  for delete using (public.ist_admin());

-- ---- Fotos (die Einträge) --------------------------------------------------
drop policy if exists "admin darf fotos eintragen" on public.spot_photos;
create policy "admin darf fotos eintragen" on public.spot_photos
  for insert with check (public.ist_admin());

drop policy if exists "admin darf fotos loeschen" on public.spot_photos;
create policy "admin darf fotos loeschen" on public.spot_photos
  for delete using (public.ist_admin());

drop policy if exists "admin darf fotos aendern" on public.spot_photos;
create policy "admin darf fotos aendern" on public.spot_photos
  for update using (public.ist_admin()) with check (public.ist_admin());

-- ---- Kommentare ------------------------------------------------------------
drop policy if exists "admin darf kommentare loeschen" on public.comments;
create policy "admin darf kommentare loeschen" on public.comments
  for delete using (public.ist_admin());

-- ---- Bewertungen -----------------------------------------------------------
drop policy if exists "admin darf bewertungen loeschen" on public.ratings;
create policy "admin darf bewertungen loeschen" on public.ratings
  for delete using (public.ist_admin());

-- ---- Profile ---------------------------------------------------------------
-- Ändern erlaubt (etwa einen anstößigen Namen), Löschen bewusst NICHT: ein
-- Profil hängt an auth.users, das gehört ins Supabase-Dashboard.
drop policy if exists "admin darf profile aendern" on public.profiles;
create policy "admin darf profile aendern" on public.profiles
  for update using (public.ist_admin()) with check (public.ist_admin());


-- ============================================================================
-- 4. DER BILDSPEICHER
--
-- Normale Nutzer dürfen nur in ihren eigenen Ordner (<nutzer-id>/...).
-- Der Admin darf überall hin — sonst könnte er zu einem fremden Spot kein
-- Foto nachtragen und keines entfernen.
-- ============================================================================

drop policy if exists "admin darf ueberall fotos ablegen" on storage.objects;
create policy "admin darf ueberall fotos ablegen" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'spot-photos' and public.ist_admin());

drop policy if exists "admin darf fremde fotos loeschen" on storage.objects;
create policy "admin darf fremde fotos loeschen" on storage.objects
  for delete to authenticated
  using (bucket_id = 'spot-photos' and public.ist_admin());

drop policy if exists "admin darf fotos ersetzen" on storage.objects;
create policy "admin darf fotos ersetzen" on storage.objects
  for update to authenticated
  using (bucket_id = 'spot-photos' and public.ist_admin())
  with check (bucket_id = 'spot-photos' and public.ist_admin());


-- ============================================================================
-- 5. ÜBERSICHT FÜR DAS ADMIN-FENSTER
--
-- Eine einzelne Abfrage statt fünf. Die Regel darauf lässt nur Admins durch;
-- ohne sie könnte jeder die Zahlen abrufen.
-- ============================================================================

-- Das "where ist_admin()" am Ende ist die eigentliche Sperre, nicht das
-- grant. Ohne die Zeile bekäme jeder Besucher die Zahlen: security_invoker
-- bedeutet, dass die Rechte des Fragenden gelten — und Spots, Profile,
-- Kommentare und Bewertungen sind alle öffentlich lesbar. Jeder hätte sie
-- also selbst zusammenzählen können, die Ansicht hätte es nur bequem
-- gemacht. Für Nicht-Admins kommt jetzt gar keine Zeile zurück.
create or replace view public.admin_zahlen
with (security_invoker = true) as
  select
    (select count(*) from public.spots)                      as spots,
    (select count(*) from public.spot_photos)                as fotos,
    (select count(*) from public.comments)                   as kommentare,
    (select count(*) from public.ratings)                    as bewertungen,
    (select count(*) from public.profiles)                   as nutzer,
    (select count(*) from public.spots
      where created_at > now() - interval '7 days')          as spots_diese_woche
  where public.ist_admin();

revoke all on public.admin_zahlen from anon;
grant select on public.admin_zahlen to authenticated;


-- ============================================================================
-- 5b. SPOTLISTE FÜR DIE VERWALTUNG
--
-- Warum eine eigene Ansicht: Über die Web-Schnittstelle kommt die Spalte
-- location als Binärkauderwelsch heraus (WKB-Hex), damit kann der Browser
-- nichts anfangen. Hier werden Breite und Länge als gewöhnliche Zahlen
-- danebengestellt — dann kann die Verwaltung von der Liste aus zum Spot
-- springen.
--
-- security_invoker = true heißt: Es gelten die Regeln des Fragenden. Die
-- Ansicht öffnet also keine Hintertür, sie ist nur bequemer.
-- ============================================================================

create or replace view public.admin_spots
with (security_invoker = true) as
  select
    s.id,
    s.name,
    s.description,
    s.elevation_m,
    s.legal_status,
    s.above_treeline,
    s.created_by,
    s.created_at,
    st_y(s.location::geometry) as lat,
    st_x(s.location::geometry) as lon
  from public.spots s
 where public.ist_admin();

revoke all on public.admin_spots from anon;
grant select on public.admin_spots to authenticated;


-- ============================================================================
-- 6. WER IST ADMIN
--
-- Bewusst nach E-Mail und nicht nach fest eingetragener ID: so bleibt die
-- Migration lesbar und lässt sich auf einer frischen Datenbank wiederholen.
-- ============================================================================

update public.profiles p
   set is_admin = true
  from auth.users u
 where u.id = p.id
   and u.email in ('fermasster0@gmail.com');
