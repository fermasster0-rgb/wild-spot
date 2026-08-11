-- ============================================================================
-- Migration 011 — die View spots_with_rating auffrischen
-- Stand: 2026-08-11
--
-- Der Fehler, den diese Migration behebt:
--
-- Die View ist mit "select s.*" angelegt. Das sieht so aus, als würde sie
-- immer alle Spalten der Tabelle zeigen — tut sie aber nicht. Postgres löst
-- das Sternchen EINMAL beim Anlegen auf und schreibt die Spaltenliste fest.
-- Spalten, die später zur Tabelle dazukommen, fehlen in der View für immer.
--
-- Nach Migration 010 (Fischen) hatte die Tabelle spots also fishing,
-- fish_species und fishing_note — die View nicht. Die App fragt die
-- Spot-Details aber über die View ab und nennt dabei jede Spalte einzeln.
-- Ergebnis: Die Abfrage schlug fehl und in der Detail-Leiste blieben die
-- Angaben leer. Bei allen Spots, nicht nur bei neuen.
--
-- "create or replace view" hilft hier nicht: damit darf man Spalten nur
-- hinten anhängen, und s.* schiebt die neuen vor avg_stars und rating_count.
-- Deshalb muss die View weg und neu entstehen.
--
-- Merke für das nächste Mal: Wer der Tabelle spots eine Spalte hinzufügt,
-- muss diese Migration mitlaufen lassen. Sie ist wiederholbar und darf
-- jederzeit erneut ausgeführt werden.
-- ============================================================================

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

-- Die Rechte verschwinden mit der alten View und müssen neu vergeben werden.
-- Ohne das sähe ein Besucher ohne Konto die Spot-Details nicht mehr.
grant select on public.spots_with_rating to anon, authenticated;
