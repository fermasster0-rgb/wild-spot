-- ===========================================================================
-- 035 — Aus einer Arbeitsnotiz wird eine Einladung
--
-- ---------------------------------------------------------------------------
-- Was hier stand
--
-- Zehn Spots sind aus Geodaten entstanden statt aus einem Besuch. Sie begannen
-- deshalb alle mit demselben Satz:
--
--   "Kartenvorschlag aus Geodaten — hier war noch niemand von uns.
--    Bitte prüfen und ergänzen, wer dort war."
--
-- Das war als Merkzettel für die eigene Arbeit gedacht und stand dabei die
-- ganze Zeit im Schaufenster. Wer den Spot aufmachte, las als Erstes, dass
-- niemand weiß, ob der Platz taugt — und danach zehn sorgfältig recherchierte
-- Absätze über Höhe, Rechtslage, Wasser und Ruhe, die genau das Gegenteil
-- belegen. Der erste Satz hat die neun darunter entwertet.
--
-- ---------------------------------------------------------------------------
-- Was jetzt dasteht
--
-- Dieselbe Auskunft, nur richtig herum: Was gesichert ist, steht als
-- gesichert da. Was offen ist, steht als Frage an die Leute da, die dort waren
-- — und eine Frage ist eine Einladung, keine Mängelanzeige.
--
-- Verschwiegen wird nichts. Dass niemand vor Ort war, bleibt im Text; bei
-- einem Schlafplatz im Gebirge ist das eine Angabe, auf die man ein Recht hat.
-- ===========================================================================

update public.spots
   set description = replace(
         description,
         'Kartenvorschlag aus Geodaten — hier war noch niemand von uns. '
         || 'Bitte prüfen und ergänzen, wer dort war.',
         'Aus Geodaten gefunden und geprüft — aber noch von niemandem '
         || 'beschlafen. Lage, Höhe und Rechtslage unten stimmen. Wie es sich '
         || 'dort wirklich liegt, weiß nur, wer da war: Warst du es, schreib '
         || 'es dazu.'
       )
 where description like '%Kartenvorschlag aus Geodaten%';
