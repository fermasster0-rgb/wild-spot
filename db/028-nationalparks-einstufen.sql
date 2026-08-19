-- ============================================================================
-- 028 — Die Nationalparks richtig einstufen
--
-- Beim Import (027) standen nach dem Lauf nur ein Nationalpark in der
-- Datenbank statt sechs. Der Grund liegt im Ablauf des Skripts: Es fragt
-- Overpass fünfmal nacheinander, und die Sorten sind nach Rangfolge geordnet —
-- was schon als Nationalpark drin ist, wird nicht mehr herabgestuft.
--
-- Wenn aber ausgerechnet die Nationalpark-Abfrage in eine Überlastung läuft
-- (Overpass antwortet dann mit 429 oder 504), kommen dieselben Gebiete kurz
-- darauf über die Naturschutz-Abfrage herein — und zwar als 'naturschutz'.
-- Die Rangfolge greift nicht mehr, weil sie zu diesem Zeitpunkt nichts
-- vorzuziehen hatte.
--
-- Das ist kein Schaden an den Flächen: Die Umrisse stimmen, nur die Einstufung
-- ist zu mild. Auf der Karte hieße das orange statt rot für den strengsten
-- Schutz, den Österreich kennt.
--
-- Hier wird über den Namen nachgezogen. Das ist bei Nationalparks verlässlich:
-- Es gibt genau sechs, und alle tragen das Wort im Namen.
-- ============================================================================

update public.protected_areas
   set art = 'nationalpark'
 where art <> 'nationalpark'
   and (name ilike '%nationalpark%' or name ilike '%national park%');

-- Zur Kontrolle beim Einspielen sichtbar machen, was jetzt drinsteht.
do $$
declare zeile record;
begin
  for zeile in
    select art, count(*) as anzahl from public.protected_areas group by art order by art
  loop
    raise notice 'Schutzgebiete %: %', rpad(zeile.art, 14), zeile.anzahl;
  end loop;

  for zeile in
    select name from public.protected_areas where art = 'nationalpark' order by name
  loop
    raise notice '  Nationalpark: %', zeile.name;
  end loop;
end $$;
