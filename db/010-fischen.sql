-- ============================================================================
-- Migration 010 — Angaben zum Fischen
-- Stand: 2026-08-11
--
-- Wer am Bergsee zeltet, will oft auch angeln. Bisher stand davon nichts im
-- Spot, obwohl es beim Packen den Unterschied macht: Rute mit oder ohne.
--
-- Drei neue Angaben:
--   fishing        — geht es hier überhaupt?
--   fish_species   — was schwimmt drin?
--   fishing_note   — wo bekommt man die Karte? (Freitext, kurz)
--
-- Alle drei sind freiwillig, wie alles außer dem Namen.
--
-- Zum Rechtlichen: In Österreich ist Fischen ohne Fischerkarte UND ohne
-- Erlaubnis des Bewirtschafters strafbar — es gibt kein "freies" Gewässer.
-- Deshalb heißt die beste Angabe hier "mit Lizenz" und nicht "erlaubt", und
-- der Standard ist "unklar". Dieselbe Vorsicht wie bei fire_allowed.
--
-- Wiederholbar: kann mehrfach laufen.
-- ============================================================================


-- ---------------------------------------------------------------------------
-- 1. Geht hier fischen?
-- ---------------------------------------------------------------------------

alter table public.spots
  add column if not exists fishing text;

alter table public.spots
  drop constraint if exists spots_fishing_check;

alter table public.spots
  add constraint spots_fishing_check check (fishing in (
    'mit_lizenz',   -- möglich, Karte beim Bewirtschafter
    'verboten',     -- Schongebiet, Privat, Naturschutz
    'unklar'        -- weiß ich nicht — der ehrliche Standard
  ));

alter table public.spots
  alter column fishing set default 'unklar';


-- ---------------------------------------------------------------------------
-- 2. Welche Fische
--
-- Als Liste, weil in einem Gewässer mehrere Arten stehen. Die Auswahl deckt
-- ab, was in österreichischen Bergseen und Fließgewässern tatsächlich
-- vorkommt — vom Huchen an der Mur bis zum Saibling auf 2.000 Metern.
-- ---------------------------------------------------------------------------

alter table public.spots
  add column if not exists fish_species text[];

alter table public.spots
  drop constraint if exists spots_fish_species_check;

alter table public.spots
  add constraint spots_fish_species_check check (
    fish_species <@ array[
      'bachforelle',
      'regenbogenforelle',
      'seeforelle',
      'saibling',
      'aesche',
      'huchen',
      'renke',
      'hecht',
      'barsch',
      'karpfen',
      'schleie',
      'aitel'
    ]::text[]
  );


-- ---------------------------------------------------------------------------
-- 3. Wo bekommt man die Karte
--
-- Kurz gehalten: Das ist ein Hinweis wie "Tageskarte beim Gasthof am
-- Seeufer", keine zweite Beschreibung.
-- ---------------------------------------------------------------------------

alter table public.spots
  add column if not exists fishing_note text;

alter table public.spots
  drop constraint if exists spots_fishing_note_check;

alter table public.spots
  add constraint spots_fishing_note_check check (char_length(fishing_note) <= 300);
