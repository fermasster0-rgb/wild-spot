-- ============================================================================
-- 030 — Nationalpark heißt Nationalpark
--
-- Nachdem der Import endlich die Relationen liefert (die Sache mit
-- "out geom tags", siehe import-schutzgebiete.mjs), stehen alle sechs
-- österreichischen Nationalparks in der Tabelle. Mit ihnen kam aber alles
-- herein, was in OpenStreetMap boundary=national_park trägt:
--
--   • Naturparks — Dobratsch, Weißensee. Das ist etwas ganz anderes: ein
--     Erholungsgebiet, keine Schutzkategorie mit Betretungsregeln. Auf der
--     Karte stünden sie in demselben kräftigen Rot wie der Nationalpark Hohe
--     Tauern und würden vor etwas warnen, das es dort nicht gibt.
--
--   • Bewahrungszonen und namenlose Teilstücke — Bestandteile größerer
--     Gebiete, die als eigene Fläche keinen Sinn ergeben.
--
--   • Nationalparks jenseits der Grenze (Šumava, Fertő–Hanság). Die dürfen
--     bleiben: Sie reichen bis an die Grenze, und wer dort steht, ist von den
--     Regeln genauso betroffen.
--
-- Die Einstufung entscheidet nur über die Farbe. Die Flächen selbst bleiben
-- alle erhalten — herabgestuft heißt hier nicht gelöscht, sondern orange
-- statt rot.
-- ============================================================================

update public.protected_areas
   set art = 'naturschutz'
 where art = 'nationalpark'
   and (
     name is null
     or (
       name not ilike '%nationalpark%'
       and name not ilike '%national park%'
       and name not ilike '%nemzeti park%'      -- ungarisch
       and name not ilike '%národní park%'      -- tschechisch
       and name not ilike '%narodni park%'
     )
   );

-- Naturparks sind keine Nationalparks, auch wenn sie so getaggt sind.
update public.protected_areas
   set art = 'naturschutz'
 where art = 'nationalpark'
   and name ilike '%naturpark%';
