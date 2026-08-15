-- ============================================================================
-- Migration 018 — die Gemeinschaft
-- Stand: 2026-08-15
--
-- Aus einer Karte wird ein Ort, an dem Leute vorkommen:
--
--   Beiträge   Ein Bild, ein Text, optional ein Spot und ein Datum.
--              Das ist die „Story" — nur ohne Verfallsdatum, weil eine Nacht
--              draußen in einem Jahr noch genauso interessant ist.
--   Folgen     Wem du folgst, dessen Beiträge stehen in deinem Feed.
--   Erwähnen   Wer mit dabei war, wird verlinkt.
--   Gefällt    Der einzige Zähler, den es gibt.
--   Melden     Für alles, was nicht hierher gehört.
--   Profil     Bild und ein paar Zeilen über sich.
--
-- ----------------------------------------------------------------------------
-- ZWEI ENTSCHEIDUNGEN, DIE HIER FESTGESCHRIEBEN SIND
--
-- 1. Ein Beitrag zeigt den Spot NUR, wenn der Verfasser es will
--    (spot_zeigen). Wild Spot sagt seinen Nutzern, dass ein Platz nicht
--    beliebig viele Leute verträgt — ein Feed, der jeden Platz feiert,
--    arbeitet dagegen. Wer erzählen will, ohne den Platz preiszugeben, kann
--    das. Der Spot bleibt trotzdem gespeichert: Für die eigene Zählung
--    („an wie vielen Plätzen war ich schon") wird er gebraucht.
--
-- 2. Beiträge kann jeder LESEN, auch ohne Konto — wie die Spots. Aber
--    schreiben nur Angemeldete, und ändern nur am Eigenen. Löschen zusätzlich
--    Admins, sonst wäre eine Meldefunktion sinnlos.
--
-- Wiederholbar: kann mehrfach laufen.
-- ============================================================================


-- ============================================================================
-- 1. DAS PROFIL BEKOMMT EIN GESICHT
-- ============================================================================

alter table public.profiles
  add column if not exists avatar_path text;

alter table public.profiles
  add column if not exists bio text
    check (bio is null or char_length(bio) <= 300);

comment on column public.profiles.avatar_path is
  'Pfad im Speicher-Eimer "avatars". Aufbau: <nutzer-id>/<datei>.jpg';


-- ----------------------------------------------------------------------------
-- Der Eimer für die Profilbilder.
--
-- Klein gehalten: 2 MB reichen für ein Bild, das nirgends größer als 400 Pixel
-- angezeigt wird. Die App verkleinert ohnehin vorher im Browser.
-- ----------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 2097152,
        array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set
  public = true, file_size_limit = 2097152,
  allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'];

drop policy if exists "avatare ansehen" on storage.objects;
create policy "avatare ansehen" on storage.objects
  for select to anon, authenticated using (bucket_id = 'avatars');

-- Der erste Ordner im Pfad ist die eigene Nutzer-ID — darauf bauen die drei
-- Regeln auf. Deshalb kann niemand ein Bild in einen fremden Ordner legen.
drop policy if exists "eigenes avatar hochladen" on storage.objects;
create policy "eigenes avatar hochladen" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "eigenes avatar ersetzen" on storage.objects;
create policy "eigenes avatar ersetzen" on storage.objects
  for update to authenticated using (
    bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "eigenes avatar loeschen" on storage.objects;
create policy "eigenes avatar loeschen" on storage.objects
  for delete to authenticated using (
    bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text
  );


-- ============================================================================
-- 2. DIE BEITRÄGE
-- ============================================================================

create table if not exists public.posts (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles(id) on delete cascade,

  body         text not null check (char_length(body) between 1 and 1500),
  photo_path   text,                       -- im Eimer "post-photos"

  -- Der Spot, um den es geht. Bleibt auch dann gespeichert, wenn er im Feed
  -- nicht gezeigt wird — für die eigene Zählung.
  spot_id      uuid references public.spots(id) on delete set null,
  spot_zeigen  boolean not null default true,

  -- Wann die Nacht war. Wie bei den Kommentaren das wichtigste Feld: „Bach
  -- war trocken" ohne Datum ist wertlos.
  visited_on   date,

  created_at   timestamptz not null default now(),
  edited_at    timestamptz
);

-- Der Feed liest immer „neueste zuerst", meist gefiltert auf eine Handvoll
-- Leute. Genau dafür die beiden Indizes.
create index if not exists posts_neu_idx  on public.posts (created_at desc);
create index if not exists posts_wer_idx  on public.posts (user_id, created_at desc);
create index if not exists posts_spot_idx on public.posts (spot_id);

alter table public.posts enable row level security;

drop policy if exists "beitraege lesen" on public.posts;
create policy "beitraege lesen" on public.posts
  for select to anon, authenticated using (true);

drop policy if exists "eigene beitraege schreiben" on public.posts;
create policy "eigene beitraege schreiben" on public.posts
  for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "eigene beitraege aendern" on public.posts;
create policy "eigene beitraege aendern" on public.posts
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Löschen: der Verfasser oder ein Admin. Ohne den zweiten Teil wäre die
-- Meldefunktion weiter unten ein Briefkasten ohne Empfänger.
drop policy if exists "eigene beitraege loeschen" on public.posts;
create policy "eigene beitraege loeschen" on public.posts
  for delete to authenticated using (
    auth.uid() = user_id
    or exists (select 1 from public.profiles p
               where p.id = auth.uid() and p.is_admin = true)
  );


-- ----------------------------------------------------------------------------
-- Der Eimer für die Bilder der Beiträge.
-- ----------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('post-photos', 'post-photos', true, 5242880,
        array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set
  public = true, file_size_limit = 5242880,
  allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'];

drop policy if exists "beitragsbilder ansehen" on storage.objects;
create policy "beitragsbilder ansehen" on storage.objects
  for select to anon, authenticated using (bucket_id = 'post-photos');

drop policy if exists "eigenes beitragsbild hochladen" on storage.objects;
create policy "eigenes beitragsbild hochladen" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'post-photos' and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "eigenes beitragsbild loeschen" on storage.objects;
create policy "eigenes beitragsbild loeschen" on storage.objects
  for delete to authenticated using (
    bucket_id = 'post-photos'
    and ((storage.foldername(name))[1] = auth.uid()::text
         or exists (select 1 from public.profiles p
                    where p.id = auth.uid() and p.is_admin = true))
  );


-- ============================================================================
-- 3. FOLGEN
--
-- Einseitig wie bei Komoot oder Instagram: Man folgt jemandem, ohne dass der
-- zustimmen muss. Der Primärschlüssel aus beiden Spalten verhindert, dass man
-- jemandem zweimal folgt.
-- ============================================================================

create table if not exists public.follows (
  follower_id  uuid not null references public.profiles(id) on delete cascade,
  followed_id  uuid not null references public.profiles(id) on delete cascade,
  created_at   timestamptz not null default now(),
  primary key (follower_id, followed_id),
  -- Sich selbst zu folgen ergibt keinen Sinn und würde den eigenen Feed
  -- verdoppeln.
  constraint nicht_sich_selbst check (follower_id <> followed_id)
);

create index if not exists follows_wem_idx on public.follows (followed_id);

alter table public.follows enable row level security;

-- Wer wem folgt, ist öffentlich — sonst könnte man keine Followerzahl zeigen.
drop policy if exists "folgen lesen" on public.follows;
create policy "folgen lesen" on public.follows
  for select to anon, authenticated using (true);

drop policy if exists "selbst folgen" on public.follows;
create policy "selbst folgen" on public.follows
  for insert to authenticated with check (auth.uid() = follower_id);

drop policy if exists "selbst entfolgen" on public.follows;
create policy "selbst entfolgen" on public.follows
  for delete to authenticated using (auth.uid() = follower_id);


-- ============================================================================
-- 4. GEFÄLLT MIR
--
-- Der einzige Zähler in dieser App. Bewusst kein Kommentar unter Beiträgen:
-- Kommentare gibt es dort, wo sie etwas nützen — am Spot, mit Besuchsdatum.
-- ============================================================================

create table if not exists public.post_likes (
  post_id     uuid not null references public.posts(id) on delete cascade,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (post_id, user_id)
);

alter table public.post_likes enable row level security;

drop policy if exists "gefaellt lesen" on public.post_likes;
create policy "gefaellt lesen" on public.post_likes
  for select to anon, authenticated using (true);

drop policy if exists "selbst gefaellt" on public.post_likes;
create policy "selbst gefaellt" on public.post_likes
  for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "selbst zuruecknehmen" on public.post_likes;
create policy "selbst zuruecknehmen" on public.post_likes
  for delete to authenticated using (auth.uid() = user_id);


-- ============================================================================
-- 5. ERWÄHNUNGEN — „wer war mit dabei"
-- ============================================================================

create table if not exists public.post_mentions (
  post_id  uuid not null references public.posts(id) on delete cascade,
  user_id  uuid not null references public.profiles(id) on delete cascade,
  primary key (post_id, user_id)
);

create index if not exists mentions_wer_idx on public.post_mentions (user_id);

alter table public.post_mentions enable row level security;

drop policy if exists "erwaehnungen lesen" on public.post_mentions;
create policy "erwaehnungen lesen" on public.post_mentions
  for select to anon, authenticated using (true);

-- Erwähnen darf nur, wer den Beitrag geschrieben hat.
drop policy if exists "erwaehnen im eigenen beitrag" on public.post_mentions;
create policy "erwaehnen im eigenen beitrag" on public.post_mentions
  for insert to authenticated with check (
    exists (select 1 from public.posts p
            where p.id = post_id and p.user_id = auth.uid())
  );

drop policy if exists "erwaehnung entfernen" on public.post_mentions;
create policy "erwaehnung entfernen" on public.post_mentions
  for delete to authenticated using (
    exists (select 1 from public.posts p
            where p.id = post_id and p.user_id = auth.uid())
    -- Wer erwähnt wurde, darf sich selbst wieder herausnehmen. Niemand muss
    -- in einem fremden Beitrag stehen bleiben.
    or auth.uid() = user_id
  );


-- ============================================================================
-- 6. MELDEN
--
-- Sobald fremde Leute Bilder und Texte veröffentlichen, braucht es einen Weg,
-- etwas zu melden — und jemanden, der es sieht. Beides hier.
-- ============================================================================

create table if not exists public.reports (
  id          uuid primary key default gen_random_uuid(),
  post_id     uuid references public.posts(id) on delete cascade,
  spot_id     uuid references public.spots(id) on delete cascade,
  comment_id  uuid references public.comments(id) on delete cascade,
  melder_id   uuid references public.profiles(id) on delete set null,
  grund       text not null check (char_length(grund) between 1 and 500),
  erledigt    boolean not null default false,
  created_at  timestamptz not null default now()
);

create index if not exists reports_offen_idx on public.reports (erledigt, created_at desc);

alter table public.reports enable row level security;

drop policy if exists "melden darf jeder angemeldete" on public.reports;
create policy "melden darf jeder angemeldete" on public.reports
  for insert to authenticated with check (auth.uid() = melder_id);

-- Lesen und abhaken nur die Verwaltung. Ein Melder soll nicht sehen, was
-- andere gemeldet haben.
drop policy if exists "meldungen nur fuer admins" on public.reports;
create policy "meldungen nur fuer admins" on public.reports
  for select to authenticated using (
    exists (select 1 from public.profiles p
            where p.id = auth.uid() and p.is_admin = true)
  );

drop policy if exists "meldungen abhaken" on public.reports;
create policy "meldungen abhaken" on public.reports
  for update to authenticated using (
    exists (select 1 from public.profiles p
            where p.id = auth.uid() and p.is_admin = true)
  );


-- ============================================================================
-- 7. DER FEED
--
-- Eine Abfrage statt fünf: Beitrag, Verfasser, Bild, Spot, Gefällt-Zahl und
-- „habe ich selbst schon" — alles in einer Zeile.
--
-- welcher = 'alle'      alles, neueste zuerst
--           'folge'     nur Leute, denen ich folge (und ich selbst)
--           'wer'       das Profil einer Person (wessen_id)
-- ============================================================================

create or replace function public.feed(
  welcher   text default 'alle',
  wessen_id uuid default null,
  anzahl    integer default 20,
  ab        timestamptz default null
)
returns table (
  id            uuid,
  body          text,
  photo_path    text,
  visited_on    date,
  created_at    timestamptz,
  user_id       uuid,
  username      text,
  avatar_path   text,
  spot_id       uuid,
  spot_name     text,
  spot_lat      double precision,
  spot_lng      double precision,
  spot_hoehe    integer,
  gefaellt      bigint,
  ich_mag       boolean,
  erwaehnte     text[]
)
language sql
stable
security invoker
set search_path = public, extensions
as $$
  select
    p.id, p.body, p.photo_path, p.visited_on, p.created_at,
    p.user_id, pr.username, pr.avatar_path,

    -- Der Spot nur, wenn der Verfasser ihn zeigen wollte.
    case when p.spot_zeigen then p.spot_id end,
    case when p.spot_zeigen then s.name end,
    case when p.spot_zeigen then st_y(s.location::geometry) end,
    case when p.spot_zeigen then st_x(s.location::geometry) end,
    case when p.spot_zeigen then s.elevation_m end,

    (select count(*) from public.post_likes l where l.post_id = p.id),
    exists (select 1 from public.post_likes l
            where l.post_id = p.id and l.user_id = auth.uid()),

    array(select pr2.username
          from public.post_mentions m
          join public.profiles pr2 on pr2.id = m.user_id
          where m.post_id = p.id
          order by pr2.username)

  from public.posts p
  join public.profiles pr on pr.id = p.user_id
  left join public.spots s on s.id = p.spot_id

  where
    (ab is null or p.created_at < ab)
    and case welcher
      when 'folge' then
        p.user_id = auth.uid()
        or exists (select 1 from public.follows f
                   where f.follower_id = auth.uid() and f.followed_id = p.user_id)
      when 'wer' then p.user_id = wessen_id
      else true
    end

  order by p.created_at desc
  limit least(greatest(coalesce(anzahl, 20), 1), 50);
$$;

grant execute on function public.feed(text, uuid, integer, timestamptz)
  to anon, authenticated;


-- ============================================================================
-- 8. EIN PROFIL ANSEHEN
--
-- Alles, was auf einer Profilseite steht — auch bei fremden Leuten.
-- ============================================================================

create or replace function public.profil(wessen_id uuid)
returns table (
  id            uuid,
  username      text,
  avatar_path   text,
  bio           text,
  seit          timestamptz,
  beitraege     bigint,
  spots_gelegt  bigint,
  spots_besucht bigint,
  folgt_mir     bigint,
  folge_ich     bigint,
  ich_folge     boolean
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    pr.id, pr.username, pr.avatar_path, pr.bio, pr.created_at,

    (select count(*) from public.posts p where p.user_id = pr.id),
    (select count(*) from public.spots s where s.created_by = pr.id),

    -- „An wie vielen Plätzen war ich schon?" — der Zähler, um den es bei der
    -- Motivation geht. Gezählt wird jeder Spot, zu dem es von dieser Person
    -- einen Kommentar mit Besuchsdatum ODER einen Beitrag gibt. Doppelte
    -- fallen durch das union von selbst weg.
    (select count(*) from (
       select c.spot_id from public.comments c where c.user_id = pr.id
       union
       select p.spot_id from public.posts p
        where p.user_id = pr.id and p.spot_id is not null
     ) besuchte),

    (select count(*) from public.follows f where f.followed_id = pr.id),
    (select count(*) from public.follows f where f.follower_id = pr.id),

    exists (select 1 from public.follows f
            where f.follower_id = auth.uid() and f.followed_id = pr.id)

  from public.profiles pr
  where pr.id = wessen_id;
$$;

grant execute on function public.profil(uuid) to anon, authenticated;


-- ============================================================================
-- 9. LEUTE SUCHEN — für das Erwähnen und zum Folgen
-- ============================================================================

create or replace function public.leute_suchen(suche text, anzahl integer default 8)
returns table (
  id          uuid,
  username    text,
  avatar_path text,
  beitraege   bigint
)
language sql
stable
security invoker
set search_path = public
as $$
  select pr.id, pr.username, pr.avatar_path,
         (select count(*) from public.posts p where p.user_id = pr.id)
  from public.profiles pr
  where suche is not null
    and char_length(trim(suche)) >= 2
    and pr.username ilike '%' || trim(suche) || '%'
    and pr.id <> coalesce(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid)
  order by pr.username
  limit least(greatest(coalesce(anzahl, 8), 1), 20);
$$;

grant execute on function public.leute_suchen(text, integer) to authenticated;


-- ============================================================================
-- 10. DAS EIGENE PROFIL DARF MAN ÄNDERN — ABER NUR ZWEI SPALTEN
--
-- Die Regel "eigenes profil aendern" gibt es seit schema.sql, sie lief aber
-- ins Leere: Ohne ein GRANT auf die Tabelle darf "authenticated" gar nicht
-- schreiben, und jeder Versuch endete mit "permission denied for table
-- profiles". Aufgefallen ist das erst, als das Profilbild dazukam.
--
-- Das Recht wird deshalb hier erteilt — aber SPALTENWEISE. Nur Bild und
-- Beschreibung. Damit kann sich niemand:
--   * einen fremden Anzeigenamen nehmen (username)
--   * selbst zum Admin machen (is_admin)
--   * selbst Plus geben (plus_until) — dafür wacht zusätzlich der Trigger
--     aus Migration 017
--
-- Ein spaltenweises GRANT ist an dieser Stelle das schärfere Werkzeug als
-- jede Regel: Was nicht erteilt ist, kann auch keine Lücke haben.
-- ============================================================================

grant select on public.profiles to anon, authenticated;
grant update (avatar_path, bio) on public.profiles to authenticated;
