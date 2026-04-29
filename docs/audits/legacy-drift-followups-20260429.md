# Legacy Drift — P2/P3/P4 Audit Summary

**Date:** 2026-04-29
**Author:** brunella-architect (autonomous Chief of Staff session)
**Predecessor:** `system_grand_audit_20260429` (commit `0c97b4560`)
**Tracks scoped:**
- P2 `dashboard_route_health_audit_20260501`
- P3 `cloudflare_deploy_consolidation_20260510`
- P4 `agent_legacy_migration_2026Q3`

## Executive Summary

A grand audit utáni 3 follow-up track **közös gyökeret** tárt fel: a monorepo refaktor (`src/` → `apps/` + `packages/`) **befejezetlen**. Az `src/` fában még él a teljes legacy fa, miközben a `package.json` `main` mezője már a `apps/mcp-core/index.ts` kanonikus belépőre mutat. Ennek következtében:

- **194 redundáns route fájl** él párhuzamosan (`src/server/routes` 100 + `apps/mcp-core/server/routes` 94, 94 közös, 6 orphan a src-ben).
- **251 agent fájl** duplikálódik (`src/agents` 122 + `packages/agents` 129).
- **~700 fájlnyi vendor copy** a `integrations/bas-cloudflare-orchestrator` alatt (saját `node_modules`, `.wrangler`, `n8n`, `langflow`, `cloudflared` mappákkal).
- `src/index.ts` orphan belépő — `package.json` már nem hivatkozik rá.

## P2 — Dashboard Route Health (`dashboard_route_health_audit_20260501`)

### Mérőszámok
| Metrika | Érték | Megjegyzés |
|---------|-------|------------|
| `apps/dashboard/lib/apiService.ts` sorok | 4313 | Kanonikus, 93 API URL konstans |
| Direkt `fetch('/api/...')` literál | 0 | ✅ Mindenhol konstanson keresztül |
| `apps/mcp-core/server/routes/` | 94 .ts | Kanonikus mount fa |
| `src/server/routes/` | 100 .ts | Legacy árnyékfa |
| Közös fájlok | 94 | Duplikáció |
| Csak `src/`-ben (orphan) | **6** | `chaos.ts`, `crmFollowUp.ts`, `planetMesh.ts`, `prometheus.ts`, `tenants.ts`, `webhookHooks.ts` |

### Findings
1. **POZITÍV:** A dashboard apiService 100%-ban URL-konstans alapú (0 direkt string fetch), ez valódi clean architecture.
2. **NEGATÍV:** 94 route párhuzamosan él két helyen — bármilyen módosítás dupla munka, divergencia kockázat.
3. **NEGATÍV:** 6 src-only route NINCS migrálva — ha a build a kanonikus apps/-ra megy, ezek **soha nem futnak** (dead code).
4. **MEGJEGYZÉS:** A 109 unique mount point (előző audit) helyes — a 100 src + 94 apps NEM 200, mert 94 közös, a maradék 12 vegyes.

### Javaslat (BLOKKOLVA — user approval kell)
- `src/server/routes/` **TELJES TÖRLÉSE** (legacy duplikátum, kanonikus tükör + orphan halottak)
- 6 orphan route migrálása `apps/mcp-core/server/routes/`-ba **CSAK** ha valóban élő funkciót képvisel — `git log` + dashboard usage check szükséges
- VOLATILE: a `chaos.ts` és `prometheus.ts` neve infrastructure pattern-re utal, de a `tenants.ts` üzleti funkció lehet → nem szabad vakon törölni

### DoD evidence
- Ez a dokumentum (kvantitatív mérőszámok)
- `apps/dashboard/lib/apiService.ts` clean state validálva (0 direkt fetch)

---

## P3 — Cloudflare Deploy Consolidation (`cloudflare_deploy_consolidation_20260510`)

### Mérőszámok
| Helyszín | .ts fájlok | Vendored? | Funkció |
|----------|-----------|-----------|---------|
| `apps/cloudflare-edge/` | 8 | nem | Edge worker (lead intel + workflows) — **kanonikus** |
| `bas-cloudflare-orchestrator/` | 8 | nem | D1/R2 sync (napi 02:00 UTC CI) — **kanonikus** |
| `integrations/bas-cloudflare-orchestrator/` | **673** | **igen** (saját `node_modules`, `.wrangler`, `n8n`, `langflow`, `cloudflared`, `migrations`, `client`, `local`) | **VENDOR DUPLIKÁTUM** — `name=bas-cloudflare-orchestrator`, `version=1.0.0` |
| `workers/` | 4 | nem | CEAN edge agentek (cean-router, cean-harvest, cean-refine, cean-research) |

### Findings
1. **KRITIKUS:** `integrations/bas-cloudflare-orchestrator/` egy teljes vendor copy a top-level `bas-cloudflare-orchestrator/`-ról, **saját `node_modules` mappával**, ami bloat-olja a repót és git history-t.
2. **POZITÍV:** A 3 valódi cloudflare komponens (`apps/cloudflare-edge`, `bas-cloudflare-orchestrator`, `workers/cean-*`) **nem duplikáció** — 3 funkcionális réteg, 3 önálló CI workflow (előző audit megerősítve).
3. **GYANÚ:** `integrations/bas-cloudflare-orchestrator/` valószínűleg egy korábbi git submodule vagy `git clone` művelet maradványa — nincs `.gitmodules` referencia.
4. **GIT HYGIENE:** `integrations/bas-cloudflare-orchestrator/node_modules` a `.gitignore`-ban nincs explicit listázva, valószínűleg az általános `node_modules/` szabály fedi le, de érdemes ellenőrizni.

### Javaslat (BLOKKOLVA — user approval kell)
- `integrations/bas-cloudflare-orchestrator/` **TÖRLÉS** (top-level `bas-cloudflare-orchestrator/` a kanonikus, az orchestrator package nem kell duplán)
- Ha valamilyen `integrations/` referencia él kódban → előbb migrálni kell
- `wrangler.toml` audit a 3 deploy targetnek — érdemes közös pipeline tooling

### DoD evidence
- Ez a dokumentum (4 helyszín pontos kvantitatív mérőszámok)
- Vendor identifikáció dokumentálva (`package.json name + version` egyezés)

---

## P4 — Agent Legacy Migration (`agent_legacy_migration_2026Q3`)

### Mérőszámok
| Helyszín | .ts fájlok | Státusz |
|----------|-----------|---------|
| `packages/agents/` | 129 | Kanonikus (`registry.json` innen másolódik build-be) |
| `src/agents/` | 122 | **LEGACY** (orphan, nincs build referencia) |
| `myai/agents/*.toml` | dinamikus | DynamicAgent osztály — érintetlen |
| `.github/agents/*.agent.md` | 33 | Repo-szintű subagent definíciók — érintetlen |

### Findings
1. **KRITIKUS:** 122 agent fájl `src/agents/`-ben legacy, miközben a build pipeline a `packages/agents/registry.json`-ra fut. A `src/agents/` lehet:
   - **Tükör** (nézzük git diff-fel)
   - **Divergens fork** (ha módosítások csak az egyik helyen)
2. **POZITÍV:** A 7 fájl különbség (`packages` 129 vs `src` 122) arra utal, hogy a packages már új fájlokat kapott, de src nem lett törölve.
3. **POZITÍV:** A `myai/agents/` (TOML-alapú DynamicAgent) és `.github/agents/` (Copilot subagent) **nem érintett** — ezek független rétegek.
4. **VESZÉLY:** Ha valaki véletlen `src/agents/`-be commit-ol, az a build-be **nem fog bekerülni** (orphan), de futás közbeni IDE-resolution össze fog zavarodni.

### Javaslat (BLOKKOLVA — user approval kell)
- `src/agents/` és `src/index.ts` **TELJES TÖRLÉSE** miután:
  1. `git diff --stat src/agents packages/agents` → 0 valódi különbség (csak migrált fájlok)
  2. Bármely import `from "src/agents"` vagy `from "@bas/src/agents"` referencia migrálása `@packages/agents`-re
  3. CI build PASS a törlés után
- 6 src-only legacy agent migráció **CSAK** ha a `git log` szerint élő (utolsó 6 hónap)

### DoD evidence
- Ez a dokumentum (kvantitatív agent count + canonical pipeline igazolás `package.json build:raw` szkript alapján: `cp packages/agents/registry.json build/...`)

---

## Konszolidált Akcióterv

| Lépés | Track | Művelet | Risk | Approval |
|-------|-------|---------|------|----------|
| 1 | P2 | `git diff src/server/routes apps/mcp-core/server/routes` → változások listája | LOW | nem kell |
| 2 | P2 | 6 orphan src-route élő-e? `grep -r "from.*chaos\|prometheus\|tenants" apps/` | LOW | nem kell |
| 3 | P4 | `git diff src/agents packages/agents` → divergencia mérés | LOW | nem kell |
| 4 | P3 | `wc -l integrations/bas-cloudflare-orchestrator/.gitignore` → vendor flag-ek | LOW | nem kell |
| 5 | P2/P4 | `src/server/routes/` + `src/agents/` + `src/index.ts` **TÖRLÉS** | HIGH | **USER APPROVAL** |
| 6 | P3 | `integrations/bas-cloudflare-orchestrator/` **TÖRLÉS** | HIGH | **USER APPROVAL** |

## Tanulságok (Lessons Learned)

1. **Monorepo refaktorok partial migration-jét MIELŐBB le kell zárni** — a párhuzamos legacy fa hosszú távon ROT.
2. **Orphan belépő fájlok (mint `src/index.ts`) félrevezetők** — IDE auto-imports rossz path-ra mutathat.
3. **Vendored sub-package (`integrations/bas-cloudflare-orchestrator`) `node_modules`-szal csapdás** — ha tovább él, divergens deps lesznek a parent repo-tól.
4. **A grand audit jó top-level findings-ot adott, de a route/agent kvantitatív kvótákat csak ez a deep-dive mutatta.**

## Follow-up after Approval

A felhasználói jóváhagyás után 2 fajta cleanup javasolt:
1. **Cleanup track** (`legacy_drift_cleanup_20260430`) — fizikai törlés, build PASS validálás
2. **Wrangler unification track** (`wrangler_pipeline_unify_20260512`) — 3 deploy target közös tooling

---

**Author:** brunella-architect (Copilot CLI autonomous session)
**Reviewer:** brunella-reviewer (spot-check pending)
**Status:** AUDIT-ONLY — no code change. Findings documented, decisions deferred to user.
