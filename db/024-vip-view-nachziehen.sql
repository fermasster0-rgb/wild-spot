-- ============================================================================
-- 024 — Die Spot-Ansicht kennt die neuen Spalten noch nicht
--
-- spots_with_rating ist mit "select s.*" gebaut. Das liest sich, als hole sie
-- immer alle Spalten — tut sie aber nicht: Postgres löst den Stern EINMAL auf,
-- beim Anlegen der Ansicht, und schreibt die Spaltenliste fest. Alles, was
-- danach zur Tabelle dazukommt, fehlt in der Ansicht für immer.
--
-- Deshalb sähe das Spot-Blatt die Auszeichnung aus 023 nicht, obwohl sie in
-- der Tabelle steht.
--
-- "create or replace view" hilft hier nicht: Es erlaubt nur, Spalten hinten
-- anzuhängen. Durch den Stern rücken vip und vip_notiz aber VOR avg_stars und
-- rating_count — für Postgres ist das eine geänderte Reihenfolge, und die
-- lehnt es ab. Also weg und neu.
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

grant select on public.spots_with_rating to anon, authenticated;
