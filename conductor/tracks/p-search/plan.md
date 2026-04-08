# P-SEARCH — Implementation Plan

Áttekintés

Ez a terv a P-SEARCH projekt professzionális fejlesztési fázisainak rendezésére szolgál, a cél egy stabil fejlesztői workflow és integráció Brunella környezetbe.

Fázisok

1) Discovery & Audit (kész)
   - Repo klónozása: .worktrees\P-SEARCH
   - Gyors felmérés: függőségek, top-level modulok, CI, wrangler.toml, tesztek

2) Környezet előkészítése (fejlesztő)
   - npm ci futtatása, node modulok telepítése
   - wrangler setup helyi dev-hez
   - Dokumentáció: README fejlesztése a helyi futtatáshoz

3) Tesztelés & CI
   - Vitest futtatása: `npm run test`
   - Github Actions javaslat: build + test + deploy (opcionális)

4) Conductor integráció
   - Track létrehozása: spec.md, plan.md, meta.json (ez a commit)
   - Aktiválás a conductor/tracks.md-ben

5) Fejlesztési hullámok
   - Priorizálás: bugfix, dokumentáció, CI, új feature-ek, MCP/skill integráció

Todók (első hullám)

- p-search-audit: Audit és gyors jelentés (kész)
- p-search-setup-dev: Lokális környezet beállítása (npm ci, wrangler)
- p-search-ci: Tesztek és CI pipeline tervezés
- p-search-docs: READMEs és fejlesztői útmutató

Kommunikáció

- Owner: pohi99999
- PR-ek és változtatások előtt `npm run test:fast` futtatása ajánlott
