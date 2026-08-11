-- ============================================================================
-- Migration 007 — Spots, Bewertungen und Kommentare ohne Login sichtbar
-- Stand: 2026-08-11
--
-- Warum:
-- Eine Karte, auf der ohne Konto nichts steht, gibt niemandem einen Grund,
-- ein Konto anzulegen. Wer die App zum ersten Mal öffnet, soll sehen, worum
-- es geht: die Spots, ihre Bewertungen und die Kommentare.
--
-- Was sich NICHT ändert — das Schreiben bleibt vollständig geschützt:
--   anlegen, ändern, löschen  → weiterhin nur angemeldet und nur am Eigenen
--   bewerten, kommentieren    → weiterhin nur angemeldet
-- Geändert wird ausschließlich das Lesen.
--
-- Bewusst mitgedacht:
-- profiles wird ebenfalls öffentlich lesbar. Ohne das stünde bei jedem
-- Kommentar „Jemand" statt einem Namen. Sichtbar wird dadurch nur der
-- Anzeigename, niemals die E-Mail-Adresse — die liegt in auth.users und
-- ist von außen grundsätzlich nicht erreichbar.
--
-- Der vorgeschlagene Anzeigename entsteht aber aus dem Teil vor dem @ der
-- E-Mail (siehe handle_new_user im schema.sql). Wer das nicht möchte, kann
-- seinen Namen ändern — dafür ist die Spalte da.
--
-- Wiederholbar: kann mehrfach laufen.
-- ============================================================================


-- ---------------------------------------------------------------- spots -----
drop policy if exists "spots lesen" on public.spots;

-- anon = jeder Besucher ohne Login, authenticated = angemeldet.
create policy "spots lesen" on public.spots
  for select to anon, authenticated using (true);


-- ------------------------------------------------------------- profiles -----
drop policy if exists "profile lesen" on public.profiles;

create policy "profile lesen" on public.profiles
  for select to anon, authenticated using (true);


-- -------------------------------------------------------------- ratings -----
drop policy if exists "bewertungen lesen" on public.ratings;

create policy "bewertungen lesen" on public.ratings
  for select to anon, authenticated using (true);


-- ------------------------------------------------------------- comments -----
drop policy if exists "kommentare lesen" on public.comments;

create policy "kommentare lesen" on public.comments
  for select to anon, authenticated using (true);


-- ---------------------------------------------------------- spot_photos -----
drop policy if exists "fotos lesen" on public.spot_photos;

create policy "fotos lesen" on public.spot_photos
  for select to anon, authenticated using (true);


-- ============================================================================
-- Die Kartenabfrage muss ein Besucher ohne Login ebenfalls aufrufen dürfen.
-- Die Funktion läuft mit "security invoker", übernimmt also die Rechte des
-- Aufrufers — die Policies oben gelten dadurch weiterhin.
-- ============================================================================

grant execute on function public.spots_in_bbox(
  double precision, double precision, double precision, double precision
) to anon;

-- Die View für den Detail-Screen. select on view reicht: durch
-- security_invoker gelten auch hier die Policies der Tabellen darunter.
grant select on public.spots_with_rating to anon;
