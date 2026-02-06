# Hybrid Cloud Integration - Specifikáció

**Track ID:** `hybrid_cloud_integration_20260203`
**Létrehozva:** 2026-02-03
**Prioritás:** HIGH
**Owner:** Péter + Claude

---

## 1. Összefoglaló

Hibrid, antifragilis ökoszisztéma kialakítása, ahol a lokális BAS mag (F:\mcp-brunella-core) szimbiózisban él a Cloudflare peremhálózatával (Edge), GitHub Copilot Pro+ integrációval és öngyógyító (Phoenix) képességekkel.

## 2. Célok

| Cél | Leírás | Siker Kritérium |
|-----|--------|-----------------|
| **R2 Memória** | LanceDB snapshotok a felhőben | `wrangler r2 object list` visszaadja a snapshotokat |
| **D1 Metaadatok** | tracks + system_state szinkronban | D1 query visszaadja az aktuális állapotot |
| **R2 Sync** | Automatikus szinkronizáció | `sync_to_r2.py` hiba nélkül fut |
| **GitHub Runner** | Lokális futtatás CI-ból | GitHub Actions sikeresen triggerel lokális scriptet |
| **Copilot Context** | BAS-specifikus kódgenerálás | Copilot ismeri az MCP architektúrát |

## 3. Architektúra

```
┌─────────────────────────────────────────────────────────────────┐
│                    HYBRID BAS ECOSYSTEM                         │
│                                                                 │
│  ┌─────────────┐     ┌─────────────┐     ┌─────────────┐       │
│  │   LOKÁLIS   │────▶│  CLOUDFLARE │────▶│   GITHUB    │       │
│  │   BAS MAG   │◀────│    EDGE     │◀────│  COPILOT+   │       │
│  └─────────────┘     └─────────────┘     └─────────────┘       │
│        │                   │                   │                │
│        ▼                   ▼                   ▼                │
│  ┌─────────────┐     ┌─────────────┐     ┌─────────────┐       │
│  │  LanceDB    │     │  R2 Bucket  │     │  Self-host  │       │
│  │  (Vektor)   │────▶│  (Snapshot) │     │   Runner    │       │
│  └─────────────┘     └─────────────┘     └─────────────┘       │
│        │                   │                                    │
│        ▼                   ▼                                    │
│  ┌─────────────┐     ┌─────────────┐                           │
│  │  SQLite     │     │  D1 Database│                           │
│  │  (TaskQueue)│────▶│  (Metadata) │                           │
│  └─────────────┘     └─────────────┘                           │
│                                                                 │
│  Phoenix Protocol: D1/R2 → Lokális visszaállítás ha kell       │
└─────────────────────────────────────────────────────────────────┘
```

## 4. Komponensek

### 4.1 Cloudflare R2 Bucket
- **Név:** `bas-knowledge-base`
- **Tartalom:**
  - LanceDB snapshotok (`.lance` fájlok)
  - Backup konfiguráció
- **Szinkron frekvencia:** Naponta 1x vagy manuális trigger

### 4.2 Cloudflare D1 Database
- **Név:** `bas-metadata`
- **Táblák:**
  - `tracks` - fejlesztési szálak állapota
  - `system_state` - rendszer metaadatok
  - `sync_log` - szinkronizációs napló

### 4.3 R2 Sync Script
- **Fájl:** `myai/sync_to_r2.py`
- **Funkciók:**
  - LanceDB export → tar.gz
  - Upload R2-be (wrangler vagy boto3-kompatibilis)
  - Metadata frissítés D1-ben

### 4.4 GitHub Self-hosted Runner
- **Lokáció:** `G:\Brunella\actions-runner`
- **Trigger:** GitHub Actions workflow
- **Feladatok:** Lokális tesztek, BAS parancsok

### 4.5 Copilot Instructions
- **Fájl:** `.github/copilot-instructions.md`
- **Tartalom:** MCP architektúra szabályok, BAS konvenciók

## 5. Kockázatok

| Kockázat | Valószínűség | Hatás | Mitigáció |
|----------|--------------|-------|-----------|
| R2 szinkron timeout | Közepes | Adatvesztés | Retry logika, chunk upload |
| D1 séma változás | Alacsony | Inkompatibilitás | Verziókövetés, migráció |
| Runner biztonsági rés | Közepes | Jogosulatlan hozzáférés | Whitelist repo, token rotation |

## 6. Függőségek

- Cloudflare account + Wrangler CLI
- GitHub repo admin jogosultság
- Lokális LanceDB működő állapotban
- Python 3.10+ (sync script)

## 7. Elfogadási kritériumok

- [ ] R2 bucket létezik és írható
- [ ] D1 database séma migrálva
- [ ] `sync_to_r2.py` sikeresen feltölt
- [ ] GitHub Runner regisztrálva és online
- [ ] Copilot instructions aktív
- [ ] End-to-end teszt: lokális változás → cloud sync → visszaolvasás
