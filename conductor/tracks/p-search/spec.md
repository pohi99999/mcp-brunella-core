# P-SEARCH — Spec

Rövid leírás

A P-SEARCH egy Cloudflare Worker alapú multi-component projekt (frontend + worker + researcher modul), amely kutató-ügynökökre épül.

Cél

- A projekt állapotának felmérése és a fejlesztési fázisok professzionális rendezése Brunella conductor track formájában.

Hatókör (scope)

- Klónozás és izolált fejlesztési munkakörnyezet (.worktrees\P-SEARCH)
- Alapvető audit: függőségek, titkok, CI, tesztek futtathatósága
- Conductor track (spec.md, plan.md, meta.json) létrehozása és aktiválása

Kimenetek

- Conductor track mappa: conductor/tracks/p-search/
- Dokumentáció: technikai leírás és terv
- Javaslat CI/teszt/fejlesztési lépésekre

Kizárt

- Pain-of-life refaktorok vagy feature-implementációk (ezek külön todo-k lesznek)

Elfogadási kritériumok

- A track aktív a conductor/tracks.md-ben
- A repo klónozva a .worktrees\P-SEARCH alá
- Alapvető npm install és teszt parancsok lefutnak helyileg
