# Hybrid Cloud Integration - Végrehajtási Terv

**Track ID:** `hybrid_cloud_integration_20260203`
**Státusz:** 🟡 ACTIVE
**Kezdés:** 2026-02-03

---

## Fázis I: Cloudflare Infrastruktúra [IN PROGRESS]

### 1.1 R2 Bucket létrehozása
```bash
cd F:\mcp-brunella-core
wrangler r2 bucket create bas-knowledge-base
```
- [ ] Bucket létrehozva
- [ ] CORS policy beállítva (ha kell)

### 1.2 D1 Database létrehozása
```bash
wrangler d1 create bas-metadata
```
- [ ] Database létrehozva
- [ ] Database ID mentve a wrangler.toml-ba

### 1.3 D1 Séma migráció
```sql
-- migrations/0001_initial.sql
CREATE TABLE IF NOT EXISTS tracks (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    status TEXT DEFAULT 'active',
    progress INTEGER DEFAULT 0,
    priority TEXT DEFAULT 'MEDIUM',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS system_state (
    key TEXT PRIMARY KEY,
    value TEXT,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sync_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sync_type TEXT NOT NULL,
    status TEXT NOT NULL,
    details TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
```
- [ ] Migráció futtatva: `wrangler d1 execute bas-metadata --file=migrations/0001_initial.sql`

### 1.4 wrangler.toml frissítése
- [ ] R2 binding hozzáadva
- [ ] D1 binding hozzáadva

---

## Fázis II: Szinkronizációs Rendszer [PENDING]

### 2.1 sync_to_r2.py létrehozása
**Fájl:** `myai/sync_to_r2.py`

Funkciók:
- LanceDB mappa tömörítése (tar.gz)
- Upload R2-be wrangler CLI-vel vagy S3-kompatibilis API-val
- D1 sync_log frissítése
- Hiba kezelés és retry

- [ ] Script megírva
- [ ] Tesztelve lokálisan
- [ ] Dokumentálva

### 2.2 Scheduled Sync (Opcionális)
- Windows Task Scheduler vagy
- GitHub Actions cron job

- [ ] Ütemezés beállítva

---

## Fázis III: GitHub Integráció [PENDING]

### 3.1 Self-hosted Runner telepítése
```powershell
# G:\Brunella\actions-runner mappában
mkdir actions-runner && cd actions-runner
# GitHub Settings → Actions → Runners → New self-hosted runner
# Követni a GitHub utasításait
```
- [ ] Runner letöltve
- [ ] Konfigurálva (repo vagy org szinten)
- [ ] Szolgáltatásként futtatva

### 3.2 GitHub Actions Workflow
**Fájl:** `.github/workflows/bas-local-sync.yml`
- [ ] Workflow létrehozva
- [ ] Trigger beállítva (push, schedule, manual)

### 3.3 Copilot Instructions
**Fájl:** `.github/copilot-instructions.md`
- [ ] Fájl létrehozva
- [ ] BAS architektúra szabályok
- [ ] MCP konvenciók
- [ ] Lokális útvonalak

---

## Fázis IV: Light-Brunella Edge Worker [OPTIONAL]

### 4.1 Workers AI integráció
- R2-ből olvasás
- Minimál válaszadás offline módban
- [ ] Worker kód frissítve
- [ ] Tesztelve

---

## Napló

| Dátum | Esemény | Státusz |
|-------|---------|---------|
| 2026-02-03 | Track létrehozva | ✅ |
| 2026-02-03 | R2 bucket kész (vodor1) | ✅ |
| 2026-02-03 | wrangler.jsonc frissítve (R2/D1 bindings) | ✅ |
| 2026-02-03 | D1 séma migrációs fájl kész | ✅ |
| 2026-02-03 | sync_to_r2.py megírva | ✅ |
| 2026-02-03 | .github/copilot-instructions.md létrehozva | ✅ |
| 2026-02-03 | bas-cloud-sync.yml workflow létrehozva | ✅ |
| 2026-02-03 | GitHub Runner dokumentáció kész | ✅ |
| 2026-02-03 | D1 database létrehozva (bas-metadata) | ✅ |
| 2026-02-03 | D1 séma migrálva (10 parancs OK) | ✅ |
| 2026-02-03 | Worker újradeployolva (R2+D1 bindings) | ✅ |
| 2026-02-03 | sync_to_r2.py tesztelve - MŰKÖDIK | ✅ |
| 2026-02-03 | **TRACK COMPLETE** | 🎉 |

---

## Következő lépések (Péter feladata)

### 1. D1 Database létrehozása
```powershell
cd F:\mcp-brunella-core\bas-cloudflare-orchestrator
npx wrangler d1 create bas-metadata
```
**Mentsd el a visszakapott `database_id`-t!**

### 2. wrangler.jsonc frissítése a database_id-vel
Cseréld ki a `PLACEHOLDER_RUN_WRANGLER_D1_CREATE` értéket a valós ID-ra.

### 3. D1 séma migráció futtatása
```powershell
npx wrangler d1 execute bas-metadata --file=migrations/0001_initial_schema.sql
```

### 4. Worker újradeployolása
```powershell
npx wrangler deploy
```

### 5. Sync tesztelése
```powershell
cd F:\mcp-brunella-core\myai
python sync_to_r2.py full
```

### 6. (Opcionális) Self-hosted Runner telepítése
Lásd: `docs/github-runner-setup.md`
