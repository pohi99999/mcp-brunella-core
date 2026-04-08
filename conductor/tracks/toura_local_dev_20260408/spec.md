# Toura — Helyi Fejlesztési Hub

**Track ID:** `toura_local_dev_20260408`
**Szülő projekt:** Nova ökoszisztéma
**Forráskód:** `.worktrees/toura/` (külön git repo: `https://github.com/pohi99999/toura.git`)

---

## Összefoglalás

A Toura egy Cloudflare Workers alapú projekt, amely a Nova projekt helyi fejlesztési környezeteként szolgál. Ez a track koordinálja a fejlesztést, biztosítva a professzionális gyakorlatok (TDD, kódminőség, automatizált workflow-k) betartását.

> **Fontos:** A `.worktrees/toura/` mappa KÜLÖN git repo. A `.gitignore` védi, nem kerül a brunella repóba. Minden commit/push a Toura saját remote-jára megy.

---

## Célkitűzések

1.  **Helyi fejlesztési hub létrehozása:** A Toura repository-n belüli fejlesztés izolálása a fő BAS rendszertől.
2.  **Professzionális workflow-k:** `tdd-workflow` és `project-workflow-analysis-blueprint-generator` skillek használata.
3.  **Subtracks integráció:** A Nova-hoz kapcsolódó összes aktív track (briefing, gatekeeper, workflows) itt kerül fejlesztésre.

---

## Jelenlegi architektúra (Toura)

- **Backend:** Cloudflare Workers (`src/`)
- **Frontend:** Next.js (`frontend/`)
- **Researcher:** Speciális kutató modul (`researcher/`)
- **Adattárolás:** Cloudflare D1 (SQL) és R2 (Object storage)
- **Deployment:** Wrangler CLI

---

## Kapcsolódó Nova Subtracks

| Track ID | Név | Státusz |
|----------|-----|---------|
| `nova_knowledge_workflows_20260404` | Nova tudásbázis és interakciós workflow-k | active |
| `nova_multiagent_gatekeeper_20260404` | Nova multi-agent gatekeeper architektúra | active |
| `napi_intelligens_briefing_20260404` | Napi intelligens reggeli briefing ügynök | active |

---

## Fejlesztési elvek

1. **Izoláció:** Nincs brunella push a `.worktrees/` mappára.
2. **Környezeti változók:** `.env` és `wrangler.toml` helyi konfigurálása.
3. **Profi gyakorlatok:** 
    - Unit tesztek minden új funkcióhoz.
    - `mcp-builder` használata, ha új eszközöket hozunk létre.
    - Rendszeres `sync_foszal.py` futtatás a naplózáshoz.

---

## Elfogadási kritériumok

- [ ] Repository sikeresen klónozva a `.worktrees/toura` mappába.
- [ ] Conductor track beállítva.
- [ ] Helyi `npm install` és build sikeres.
- [ ] Wrangler dev mód elindul.
