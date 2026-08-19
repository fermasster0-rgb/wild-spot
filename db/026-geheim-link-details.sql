-- ============================================================================
-- 026 — Der Freigabelink muss auch die Angaben hergeben
--
-- 025 hat spot_per_token gebaut: Name und Position zu einem Schlüssel. Damit
-- fliegt die Karte zum richtigen Fleck und das Blatt geht auf — und bleibt
-- leer. Denn die Angaben selbst holt das Blatt aus spots_with_rating, und
-- darauf greift die Leseregel: ein geheimer Spot ist für einen Fremden dort
-- nicht vorhanden.
--
-- Beim Prüfen sah das so aus: Blatt offen, Name „–", nichts darin. Der Link
-- führte also irgendwohin, statt zu dem Platz, den jemand herzeigen wollte.
--
-- Diese Funktion schließt die Lücke: dieselbe Zeile wie in der Ansicht, aber
-- über den Schlüssel geholt statt über die Leseregel.
--
-- security definer heißt hier: Die Funktion läuft mit den Rechten ihres
-- Besitzers und kommt an der Leseregel vorbei. Das ist der Zweck — sie gibt
-- aber nur die eine Zeile heraus, deren Schlüssel übergeben wurde. Ohne
-- passenden Schlüssel kommt nichts zurück.
-- ============================================================================

create or replace function public.spot_detail_per_token(token uuid)
returns setof public.spots_with_rating
language sql
stable
security definer
set search_path = public, extensions
as $$
  select v.*
    from public.spots_with_rating v
    join public.spots s on s.id = v.id
   where s.share_token = token
   limit 1;
$$;

grant execute on function public.spot_detail_per_token(uuid) to anon, authenticated;
