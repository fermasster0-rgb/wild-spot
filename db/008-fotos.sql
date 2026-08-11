-- ============================================================================
-- Migration 008 — Fotospeicher für die Spots
-- Stand: 2026-08-11
--
-- Legt den Ablageort für die Bilder an und regelt, wer was darf:
--   ansehen     → jeder, auch ohne Konto
--   hochladen   → nur angemeldet, und nur in den eigenen Ordner
--   löschen     → nur das, was man selbst hochgeladen hat
--
-- Der Dateipfad folgt der Konvention aus schema.sql, Abschnitt 8:
--     <nutzer-id>/<spot-id>/<dateiname>.jpg
-- Der erste Ordner ist die eigene Nutzer-ID — genau darauf bauen die
-- Regeln unten auf. Deshalb kann niemand Bilder in fremde Ordner legen.
--
-- Wiederholbar: kann mehrfach laufen.
-- ============================================================================


-- ============================================================================
-- 1. DER EIMER ("Bucket")
--
-- public = true heißt: die Bilder sind über ihre Adresse abrufbar, ohne
-- Anmeldung. Das ist gewollt — die Spots sollen ja auch ohne Konto zu sehen
-- sein, und ein Foto, das erst nach dem Login lädt, wäre ein Loch in der Seite.
--
-- Die Grenzen darunter sind das Sicherheitsnetz. Die App verkleinert jedes
-- Bild schon im Browser auf etwa 1600 Pixel, damit landet ein Handyfoto bei
-- ungefähr 300 KB statt 8 MB. 5 MB sind also reichlich Luft.
-- ============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'spot-photos',
  'spot-photos',
  true,
  5242880,                                            -- 5 MB
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public             = true,
  file_size_limit    = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;


-- ============================================================================
-- 2. WER WAS DARF
-- ============================================================================

drop policy if exists "fotos oeffentlich lesen" on storage.objects;
-- Jeder darf die Bilder laden — auch ohne Konto.
create policy "fotos oeffentlich lesen" on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'spot-photos');

drop policy if exists "fotos in eigenen ordner hochladen" on storage.objects;
-- Hochladen nur angemeldet, und nur dorthin, wo die eigene Nutzer-ID
-- als oberster Ordner steht.
create policy "fotos in eigenen ordner hochladen" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'spot-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "eigene fotos loeschen" on storage.objects;
-- Löschen ebenfalls nur im eigenen Ordner.
create policy "eigene fotos loeschen" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'spot-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );


-- ============================================================================
-- 3. REIHENFOLGE DER BILDER
--
-- Ein Spot hat oft mehrere Fotos. Der Index sorgt dafür, dass sie schnell
-- und immer in derselben Reihenfolge kommen — ohne ihn stünde das
-- Titelbild mal an erster, mal an dritter Stelle.
-- ============================================================================

create index if not exists spot_photos_sortierung_idx
  on public.spot_photos (spot_id, sort_order, created_at);
