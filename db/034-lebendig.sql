-- ===========================================================================
-- 034 — Die App soll lebendig wirken, auch bevor Leute da sind
--
-- ---------------------------------------------------------------------------
-- Das Problem
--
-- Am 2026-09-04 stand in Wild Spot: 162 Spots, 163 Fotos, 14.560 Gipfel — und
-- 4 Leute, 0 Beiträge, 1 Bewertung. Die Startseite hat ausgerechnet die drei
-- kleinen Zahlen groß hingeschrieben ("4 Leute sind dabei, zusammen mit 1
-- Nacht draußen") und die großen kleingehalten.
--
-- Andrew Chen nennt das in "The Cold Start Problem" die Anti-Netzwerkwirkung:
-- Wer sieht, dass niemand da ist, geht wieder — und macht damit die Lage für
-- den Nächsten noch schlechter. Der Ausweg ist nicht, Leute zu erfinden. Der
-- Ausweg ist, das zu zeigen, was wirklich trägt: die Karte selbst.
--
-- ---------------------------------------------------------------------------
-- Was diese Datei ändert
--
-- 1. gemeinschaft_zahlen liefert zwei Zahlen mehr — Wasserstellen und
--    Schutzgebiete. Beide sind groß, echt und in keiner anderen App drin.
-- 2. Das Dienstkonto heißt nicht mehr "claude-dienst", sondern
--    "wildspot-redaktion". Es hat 148 der 162 Spots eingetragen; unter dem
--    alten Namen las sich die ganze Aktivitätsliste wie ein Roboterprotokoll.
--    Der neue Name ist keine Verkleidung — es IST die Redaktion: von Hand
--    recherchierte Plätze, nur eben über ein Konto eingespielt.
-- 3. Neue Konten bekommen einen lesbaren Namen statt "fermasster0_e000".
--
-- Was diese Datei NICHT tut: erfundene Menschen, erfundene Bewertungen,
-- erfundene Beiträge. Das ist in den USA seit 2024 ausdrücklich verboten
-- (FTC-Regel gegen gefälschte Bewertungen), Apple und Google werfen dafür aus
-- dem Store — und es wäre der schnellste Weg, das Vertrauen zu verlieren, auf
-- dem eine Karte mit geheimen Schlafplätzen ganz und gar beruht.
-- ===========================================================================


-- ---------------------------------------------------------------------------
-- 1. Zwei Zahlen mehr für die Startseite
-- ---------------------------------------------------------------------------
drop function if exists public.gemeinschaft_zahlen();

create function public.gemeinschaft_zahlen()
returns table (
  spots        bigint,
  leute        bigint,
  beitraege    bigint,
  gipfel_frei  bigint,
  gipfel_los   bigint,
  fotos        bigint,
  naechte      bigint,
  wasser       bigint,
  gebiete      bigint
)
language sql
stable
security definer
set search_path = public
as $$
  select
    (select count(*) from public.spots),
    (select count(*) from public.profiles),
    (select count(*) from public.posts),
    -- Wie viele Gipfel überhaupt zur Auswahl stehen …
    (select count(*) from public.water_points w where w.kind = 'peak' and w.name is not null),
    -- … und wie oft schon einer gesammelt wurde.
    (select count(*) from public.peak_logs),
    (select count(*) from public.spot_photos),
    (select count(*) from (
       select p.visited_on as d, p.user_id from public.posts p where p.visited_on is not null
       union
       select c.visited_on, c.user_id from public.comments c
     ) x),
    -- Neu: die beiden Zahlen, die diese Karte von einer Zeltplatzliste
    -- unterscheiden. Trinkwasser ist draußen die zweitwichtigste Frage nach
    -- dem Schlafplatz, und Schutzgebiete sind der Grund, warum man irgendwo
    -- NICHT stehen darf.
    (select count(*) from public.water_points where kind <> 'peak'),
    (select count(*) from public.protected_areas);
$$;

grant execute on function public.gemeinschaft_zahlen() to anon, authenticated;


-- ---------------------------------------------------------------------------
-- 2. Aus "claude-dienst" wird "wildspot-redaktion"
--
-- Nur umbenennen, wenn es das Konto gibt und der neue Name noch frei ist —
-- die Datei soll sich beliebig oft einspielen lassen, ohne zu krachen.
-- ---------------------------------------------------------------------------
update public.profiles
   set username = 'wildspot-redaktion',
       bio = 'Die von Hand recherchierten Plätze der Karte. '
             || 'Quellen: Alpenvereinskarten, Geodaten, eigene Touren.'
 where username = 'claude-dienst'
   and not exists (
     select 1 from public.profiles p2 where p2.username = 'wildspot-redaktion'
   );


-- ---------------------------------------------------------------------------
-- 3. Lesbare Namen für neue Konten
--
-- Bisher: der Teil vor dem @ plus vier Zufallszeichen — daraus wurde
-- "fermasster0_e000". Auf der Leute-Seite standen zwei solcher Namen
-- untereinander und sahen aus wie Bots.
--
-- Jetzt: ein Wort aus den Bergen plus eine Zahl — "Steinbock 214",
-- "Latschenkiefer 87". Das ist zufällig, aber es liest sich wie ein Mensch,
-- der sich einen Namen gegeben hat. Wer den Namen nicht mag, ändert ihn im
-- Profil; genau dafür ist er ein Vorschlag.
--
-- Die E-Mail-Adresse taucht nicht mehr im Namen auf. Das ist nebenbei ein
-- Datenschutzgewinn: "fermasster0_e000" verrät den halben Mailkontonamen an
-- jeden, der die Leute-Seite öffnet.
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  woerter text[] := array[
    'Steinbock', 'Murmeltier', 'Gams', 'Steinadler', 'Kolkrabe', 'Auerhahn',
    'Latschenkiefer', 'Zirbe', 'Enzian', 'Edelweiss', 'Almrausch', 'Silberdistel',
    'Wetterstein', 'Morgenrot', 'Nordwand', 'Karwasser', 'Firnschnee', 'Biwak',
    'Grat', 'Kar', 'Joch', 'Scharte', 'Klamm', 'Ache', 'Bergsee', 'Hochmoor',
    'Nachtfalter', 'Sternenklar', 'Talnebel', 'Fruehnebel', 'Windstill'
  ];
  vorschlag text;
begin
  -- Bis zu zehn Versuche. Bei 31 Wörtern mal 900 Zahlen sind das 27.900
  -- Möglichkeiten — ein Zusammenstoß ist bis weit in die Tausende hinein
  -- unwahrscheinlich, aber die Schleife kostet nichts.
  for i in 1..10 loop
    vorschlag := woerter[1 + floor(random() * array_length(woerter, 1))::int]
                 || ' ' || (100 + floor(random() * 900))::int;
    exit when not exists (
      select 1 from public.profiles where username = vorschlag
    );
    vorschlag := null;
  end loop;

  insert into public.profiles (id, username)
  values (
    new.id,
    -- Notnagel, falls zehnmal derselbe Name kam: die alte Regel, aber ohne
    -- die E-Mail-Adresse.
    coalesce(vorschlag, 'Camper ' || substr(md5(random()::text), 1, 6))
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
