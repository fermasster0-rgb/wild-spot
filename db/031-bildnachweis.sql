-- ============================================================================
-- Migration 031 — Bildnachweis am Foto
-- Stand: 2026-08-23
--
-- Warum:
-- Bisher lud jedes Foto ein Mensch selbst hoch — sein eigenes Bild, an dem
-- niemand sonst Rechte hat. Mit den kuratierten Spots kommen zum ersten Mal
-- fremde Bilder in die App: freie Fotos von Wikimedia Commons.
--
-- "Frei" heißt nicht "ohne Bedingung". Die meisten dieser Bilder stehen unter
-- CC BY oder CC BY-SA, und beide verlangen dasselbe: den Namen der Person,
-- die das Bild gemacht hat, die Lizenz und einen Weg zurück zur Quelle. Wer
-- das weglaesst, verletzt die Lizenz — auch wenn das Bild sonst gratis ist.
--
-- Deshalb drei Felder statt einer Fussnote irgendwo im Beschreibungstext:
-- Der Nachweis gehoert an das Bild, das er betrifft, sonst geht er beim
-- naechsten Umbau der Seite verloren.
--
-- Alle drei duerfen leer bleiben. Ein selbst geschossenes Handyfoto braucht
-- keinen Nachweis, und genau so laden die Nutzer weiterhin hoch — an der
-- bestehenden Foto-Strecke aendert diese Migration nichts.
--
-- Wiederholbar: kann mehrfach laufen.
-- ============================================================================

alter table public.spot_photos
  add column if not exists autor      text,
  add column if not exists lizenz     text,
  add column if not exists quelle_url text;

comment on column public.spot_photos.autor is
  'Wer das Bild gemacht hat. Leer bei selbst hochgeladenen Fotos.';
comment on column public.spot_photos.lizenz is
  'Lizenzkuerzel, z. B. "CC BY-SA 4.0" oder "Public domain".';
comment on column public.spot_photos.quelle_url is
  'Seite, auf der das Bild samt Lizenz nachzulesen ist.';


-- ============================================================================
-- Wer die Nachweise sehen darf
--
-- Nichts zu tun: Die Regel "fotos lesen" aus Migration 008 gilt fuer die
-- ganze Zeile, also auch fuer neue Spalten. Sichtbar sind sie damit fuer
-- jeden — was auch der Sinn eines Nachweises ist.
--
-- Schreiben bleibt ebenfalls wie gehabt: nur die eigene Zeile. Der Import
-- laeuft ueber die Datenbankverbindung und nicht ueber die Schnittstelle,
-- ihn betrifft das nicht.
-- ============================================================================
