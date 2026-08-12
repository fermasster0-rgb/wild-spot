-- ============================================================================
-- Migration 014 — die Admin-Rolle gegen Selbstbeförderung absichern
-- Stand: 2026-08-12
--
-- ----------------------------------------------------------------------------
-- Der Fehler, den diese Migration behebt
--
-- Migration 013 hat die Spalte is_admin an profiles gehängt. Übersehen wurde,
-- dass es längst eine Regel gibt, die jedem erlaubt, sein EIGENES Profil zu
-- ändern — und die gilt für alle Spalten der Zeile, also auch für die neue.
--
-- Damit reichten zwei Handgriffe, um die ganze App zu übernehmen:
--
--   1. Konto anlegen (geht ohne Bestätigungsmail, in Sekunden)
--   2. update profiles set is_admin = true where id = <eigene id>
--
-- Danach war man Admin — und weil Admins fremde Profile ändern dürfen, ließen
-- sich im zweiten Schritt gleich alle übrigen Konten mitbefördern. Genau das
-- ist beim Sicherheitstest am 2026-08-12 passiert: Oskars Konto wurde dabei
-- ungewollt zum Admin und musste zurückgesetzt werden.
--
-- ----------------------------------------------------------------------------
-- Warum Regeln allein hier nicht reichen
--
-- Row Level Security entscheidet über ZEILEN, nicht über Spalten. Eine Regel
-- kann sagen "diese Zeile darfst du ändern", aber nicht "diese Zeile schon,
-- diese eine Spalte darin aber nicht".
--
-- Dafür gibt es ein zweites, älteres Mittel: Spaltenrechte. Wer kein
-- UPDATE-Recht auf einer Spalte hat, kommt an ihr nicht vorbei — egal was
-- die Regeln sagen. Das ist die eigentliche Sperre unten.
--
-- Dazu kommt ein Auslöser (Trigger) als zweite Sicherung. Er ist streng
-- genommen überflüssig, solange die Spaltenrechte stimmen — aber genau darauf
-- soll sich niemand verlassen müssen. Wer später einmal Rechte großzügig
-- vergibt, läuft trotzdem in die Wand.
--
-- Ergebnis: is_admin lässt sich NUR noch direkt an der Datenbank setzen,
-- also mit dem Passwort aus .env.local. Über die App, die Schnittstelle oder
-- irgendeinen Schlüssel aus dem Browser geht es nicht mehr.
--
-- Wiederholbar: kann mehrfach laufen.
-- ============================================================================


-- ============================================================================
-- 1. SPALTENRECHTE — die eigentliche Sperre
--
-- Erst alles wegnehmen, dann gezielt zurückgeben: username darf jeder bei
-- sich selbst ändern (welche ZEILE, regelt weiterhin RLS). is_admin ist in
-- dieser Liste nicht enthalten und damit für die App unerreichbar.
-- ============================================================================

revoke update on public.profiles from anon, authenticated;
grant  update (username) on public.profiles to authenticated;

-- Anlegen und Lesen bleiben, wie sie waren.
grant insert on public.profiles to authenticated;
grant select on public.profiles to anon, authenticated;


-- ============================================================================
-- 2. DER AUSLÖSER — zweite Sicherung
--
-- Blockt jede Änderung an is_admin, die nicht direkt an der Datenbank
-- passiert. Die Rollen anon und authenticated sind genau die, unter denen
-- Anfragen aus dem Browser laufen; wer sich mit dem Datenbank-Passwort
-- verbindet, ist keine von beiden und darf weiterhin.
-- ============================================================================

create or replace function public.is_admin_schuetzen()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.is_admin is distinct from old.is_admin
     and current_user in ('anon', 'authenticated') then
    raise exception
      'is_admin laesst sich nicht ueber die App aendern. Nur direkt in der Datenbank.';
  end if;
  return new;
end;
$$;

drop trigger if exists is_admin_schuetzen on public.profiles;
create trigger is_admin_schuetzen
  before update on public.profiles
  for each row execute function public.is_admin_schuetzen();


-- ============================================================================
-- 3. DIE ADMIN-REGEL AUF ANGEMELDETE BESCHRÄNKEN
--
-- 013 hatte sie für "public" angelegt, also für jede Rolle einschließlich
-- nicht angemeldeter Besucher. Gefährlich war das nicht — ist_admin() gibt
-- ohne Anmeldung false zurück — aber es liest sich, als dürfte jeder etwas,
-- und das soll eine Sicherheitsregel nie.
-- ============================================================================

drop policy if exists "admin darf profile aendern" on public.profiles;
create policy "admin darf profile aendern" on public.profiles
  for update to authenticated
  using (public.ist_admin()) with check (public.ist_admin());


-- ============================================================================
-- 4. FOTO-EINTRÄGE AN DIE DATEI BINDEN
--
-- Beim Test kam ein Eintrag in spot_photos durch, der auf gar kein Bild
-- zeigte ("x/y.jpg") — die Regel prüfte nur, wer ihn anlegt, nicht wohin er
-- zeigt. Damit ließe sich die Liste eines fremden Spots mit toten Einträgen
-- zumüllen.
--
-- Neu: Der Pfad muss mit der eigenen Nutzer-ID beginnen. Genau dorthin darf
-- man auch Dateien legen — Eintrag und Datei gehören damit zusammen.
-- Fotos zu FREMDEN Spots bleiben erlaubt, das ist gewollt: Wer dort war,
-- soll ein Bild beisteuern können.
-- ============================================================================

drop policy if exists "foto hochladen" on public.spot_photos;
create policy "foto hochladen" on public.spot_photos
  for insert to authenticated
  with check (
    uploaded_by = auth.uid()
    and storage_path like auth.uid()::text || '/%'
  );


-- ============================================================================
-- 5. AUFRÄUMEN: Einträge, die auf keine Datei zeigen
-- ============================================================================

delete from public.spot_photos
 where storage_path !~ '^[0-9a-f-]{36}/';
