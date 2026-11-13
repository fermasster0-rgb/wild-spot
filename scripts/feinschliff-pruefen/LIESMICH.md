# Prüfläufe Feinschliff 2026-11-13

Playwright-Prüfungen für Spot-Blatt (Schritt 3), Zoom + Pin (4), Startseite (5)
und Gemeinschaft/Kartenkopf (6). Laufen über Playwright-MCP
`browser_run_code_unsafe` mit `filename` = eine dieser Dateien, gegen
`node web/server.mjs` (Port 5173). Sie melden ein Ergebnis-Objekt zurück;
was es bedeuten muss, steht im Bauplan
`docs/superpowers/plans/2026-11-13-wildspot-feinschliff.md`.

Schritt 2 (Startbereich) wurde direkt im Lauf geprüft: frisch → entdecken,
`?los=merken` → merken, `?spot=…` → karte + Blatt, offline → karte,
Datenbank blockiert → karte.
