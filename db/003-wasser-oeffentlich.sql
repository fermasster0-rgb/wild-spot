-- ============================================================================
-- Migration 003 — Wasserstellen ohne Login sichtbar machen
-- Stand: 2026-08-04
--
-- Warum:
-- Die Wasserstellen stammen komplett aus OpenStreetMap und sind dort für
-- jeden frei einsehbar. Sie hinter dem Login zu verstecken bringt keinen
-- Schutz, kostet aber die erste sichtbare Version der Karte: ohne diese
-- Änderung müsste erst der ganze Login gebaut werden, bevor man überhaupt
-- einen Punkt auf der Karte sieht.
--
-- Was NICHT öffentlich wird:
-- spots, ratings, comments, spot_photos und profiles bleiben unverändert
-- hinter dem Login. Nur die eingekauften OSM-Daten sind frei lesbar.
--
-- Geschrieben wird weiterhin ausschließlich vom Import-Skript, das mit dem
-- Datenbank-Passwort arbeitet und Row Level Security ohnehin umgeht.
--
-- Wiederholbar: kann mehrfach laufen.
-- ============================================================================

drop policy if exists "wasserstellen lesen" on public.water_points;

-- anon = jeder Besucher ohne Login, authenticated = eingeloggt.
create policy "wasserstellen lesen" on public.water_points
  for select to anon, authenticated using (true);

-- Die beiden Funktionen laufen mit "security invoker", übernehmen also die
-- Rechte des Aufrufers. Damit ein Besucher ohne Login sie überhaupt aufrufen
-- darf, braucht die Rolle anon das Ausführungsrecht.
grant execute on function public.water_points_in_bbox(
  double precision, double precision, double precision, double precision
) to anon;

grant execute on function public.nearest_water(
  double precision, double precision, integer, integer
) to anon;
