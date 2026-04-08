# Toura — Helyi Fejlesztési Hub — Plan

**Track ID:** `toura_local_dev_20260408`

---

## Fázis 1: Környezet beállítás (Setup)

- [x] Toura repository klónozása a `.worktrees/toura` mappába.
- [x] Conductor track mappájának és alapfájljainak (`meta.json`, `spec.md`, `plan.md`) létrehozása.
- [x] Függőségek telepítése a `.worktrees/toura` mappában.
    - `npm install` futtatása.
- [x] Helyi környezeti változók (`.env`) beállítása a `toura` repo-ban.
- [x] Wrangler dev teszt futtatása. (Fut a http://127.0.0.1:8787 porton)

---

## Fázis 2: Skill és Plugin konfiguráció

- [ ] `tdd-workflow` aktiválása a Toura fejlesztéséhez.
- [ ] `project-workflow-analysis-blueprint-generator` futtatása a Toura struktúráján a fejlesztési prioritások meghatározásához.
- [ ] Egyéni MCP szerver (ha szükséges) regisztrálása a helyi teszteléshez.

---

## Fázis 3: Integráció és Fejlesztés

- [ ] A kapcsolódó Nova trackek (`gatekeeper`, `briefing`, `workflows`) kódjának szinkronizálása a Toura környezettel.
- [ ] Subtracks feladatok végrehajtása a Toura hub-on keresztül.
- [ ] Folyamatos naplózás a `.ai/gemini.md` és `sync_foszal.py` használatával.

---

## Fázis 4: Validáció és Lezárás

- [ ] Minden subtrack elfogadási kritériumának ellenőrzése.
- [ ] Végleges build és deployment teszt (Wrangler).
- [ ] Track lezárása és archiválása.
