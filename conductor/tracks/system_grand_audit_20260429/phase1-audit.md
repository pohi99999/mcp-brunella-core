# Fázis 1 — Read-only AUDIT jelentés

**Dátum:** 2026-04-29
**Track:** `system_grand_audit_20260429`
**Audit típus:** kódmódosítás nélküli felmérés
**Eszközök:** PowerShell + Node.js direct JSON parsing + filesystem inspection

---

## 1.1 ❌ Agent registry — DIVERGENCIA TALÁLVA

| Hely | Agentek száma | Státusz |
|------|--------------:|---------|
| `packages/agents/registry.json` | **79** | ✅ KANONIKUS (alias `@packages/*` ide mutat) |
| `src/agents/registry.json` | **95** | ⚠️ LEGACY de 16 EXTRA agentet tartalmaz |
| `build/agents/registry.json` | 79 | ✅ build artifact |
| `build/packages/agents/registry.json` | 79 | ✅ build artifact |
| 5 worktree-beli másolat | – | ⏸ érintetlen |

### 16 SRC-ONLY AGENT (a futtatott rendszerből HIÁNYOZHAT)
`MarketingDirector`, `ReconciliationException`, `ReconciliationCommunication`, `NavCrossCheck`, `finance_guardian`, `FinancialGuard`, `knowledge_base_builder`, `logistics_dispatcher`, `NurturerAgent`, `ops`, `PricingAgent`, `ProactiveClaimsAgent`, `AIResearchWeekly`, `robotkezv2`, `sales_hunter`, `OCRAgent`

### 1 NÉVKONVENCIÓ ÜTKÖZÉS
`task_decomposer` (src) ↔ `TaskDecomposer` (packages) — UGYANAZ AZ AGENT, eltérő casing

**FÁZIS 2 javaslat:** A 16 hiányzó agentet vagy migrálni `packages/agents/registry.json`-ba, vagy formálisan dokumentálni mint deprecated.

---

## 1.2 ⚠️ Route ↔ Dashboard panel mapping

- **94** TS route fájl: `apps/mcp-core/server/routes/`
- **113** panel ID: `apps/dashboard/lib/navigation.tsx`
- Részletes mátrix (panel→route hívások az `apiService.ts`-ből) **FÁZIS 2 elejét**.

**Hipotézis:** több halott gomb és árva route létezik. Pontos lista FÁZIS 2.B-ben.

---

## 1.4 ⚠️ MCP autostart — 12 → 9 javaslat

| Server | Platform | Jelenlegi | Javasolt | Indok |
|--------|----------|-----------|----------|-------|
| `brunella-core` | all | autoStart | ✅ marad | core |
| `brunella-remote` | all | autoStart | ✅ marad | core |
| `filesystem` | all | autoStart | ✅ marad | core |
| `memory` | all | autoStart | ✅ marad | core |
| `sequential-thinking` | all | autoStart | ✅ marad | core |
| `fetch` | all | autoStart | ✅ marad | network base |
| `github` | all | autoStart | ✅ marad | ha PAT van |
| `csharp-mcp-server` | win32 | autoStart | ✅ marad | platform-specific |
| `windows_automation_bridge` | win32 | autoStart | ✅ marad | platform-specific |
| `workspace-mcp-server` | all | autoStart | ✅ marad | dev tools |
| `chrome-devtools` | all | autoStart | ⏳ **on-demand** | nehéz, ritka use |
| `playwright` | all | autoStart | ⏳ **on-demand** | nehéz, ritka use |
| `maestro` | all | autoStart | ⏳ **on-demand** | nehéz, ritka use |
| `sqlite` | all | disabled | ✅ marad | reserved |
| `vscode-mcp` | all | disabled | ❓ döntés | placeholder |
| `copilot-mcp` | all | disabled | ❓ döntés | placeholder |
| `brunella-self-improve` | all | disabled | ❓ döntés | reserved |

**Eredmény:** 12 → **10 autostart** (chrome-devtools, playwright, maestro on-demand-be), 4 disabled, 3 placeholder döntés.

---

## 1.5 ⚠️ Cloudflare — 5 hely, kb 47 fájl

| Hely | Fájl | Tartalom | Státusz |
|------|------|----------|---------|
| `apps/cloudflare-edge/` | 20 | `src/index.ts` (14770b) + package.json | ✅ KANONIKUS edge runtime |
| `bas-cloudflare-orchestrator/` | 16 | `src/index.ts` (15712b) | 🔧 specializált orchestrator (külön cél) |
| `workers/` | 6 | 4 cean-* worker + bas-browser-orchestrator wrangler.toml | 🔧 specializált worker pipeline |
| `src/cloudflare/` | 4 | – | ⚠️ LEGACY (migrálandó vagy törlendő) |
| `build/agents/cloudflare/` | 1 | build artifact | ✅ generated |

**Cél állapot:** 4 értelmes hely (3 specializáció + 1 legacy → archiválandó vagy migrálandó az `apps/cloudflare-edge/`-be).

---

## 1.6 ❌ dashboard.bat — Smoke gap

**Mostani működés (7 lépés):**
1. `npm run sync:docs`
2. Ollama indítás
3. AnythingLLM Desktop indítás (opcionális)
4. Python FastAPI port 8000
5. Node Core port 3000
6. Dashboard Vite port 5173
7. **15 mp vak timeout** + browser open

**Hiányosságok:**
- ❌ NINCS smoke check `/ping`-re (Core API)
- ❌ NINCS smoke check `/api/v1/health`-re
- ❌ NINCS smoke check Python `/health`-re
- ❌ NINCS smoke check dashboard `:5173`-ra
- ❌ Bukás esetén csak echo, NINCS log pointer
- ❌ NINCS error code propagation (mindig `exit 0`)

**FÁZIS 2.D javaslat:** 7. lépés tartalmazzon `curl -fsS http://localhost:3000/ping || echo "[ERROR] Core API down — see logs/node-server.log"` mintát mind a 4 service-re, és set `errorlevel`-t bukás esetén.

---

## 1.10 ✅ GitHub main szinkron — KÉSZ

- Korábban: 8 helyi commit nem ment ki
- Most: **0 helyi commit várja a push-t**, `origin/main` ↔ HEAD szinkronban (`928fba674`)
- pre-push hook: `npm run test:fast` átment (427 file, 3102 teszt)

### ⚠️ Worktrees — 9 db, 6 prunable
```
F:/mcp-brunella-core                                       928fba674 [main]              ← aktív
C:/Users/pohi9/.copilot/.../merge-main                     69958adae (detached)          ← session-state, törölhető
F:/mcp-brunella-cleanup-main                               6a04238fa [cleanup-main-...]  ← prunable
F:/mcp-brunella-core/.worktrees/push-main                  7cfeb1432 (detached)          ← detached, törölhető
F:/mcp-brunella-core/.worktrees/studio_commit_tmp          edc0046fc [copilot/studio-..] ← régi
F:/mcp-brunella-core-push                                  175d11469 [push-temp]         ← prunable
F:/mcp-brunella-core.worktrees/agents-mobile-view-...      e539d1565 [agents/mobile-...] ← élő branch?
F:/mcp-brunella-main-push                                  89400f414 [main-push-...]     ← prunable
F:/w                                                       7ccaddca7 [external-...]      ← prunable
```

**Javaslat:** `git worktree prune` + 6 explicit `git worktree remove --force` → 9 → 3 (aktív, session-state, agents-mobile branch).

---

## 1.3, 1.7, 1.8, 1.9 — még nyitott

| # | Audit | Állapot |
|---|-------|---------|
| 1.3 | PAIOS chat e2e | ⏳ a Fázis 2 elején élő futtatással ellenőrzöm |
| 1.7 | Hook / Scheduler / Reflection bekötöttség | ⏳ kódszintű grep szükséges |
| 1.8 | Skill / plugin / .vscode kihasználtság | ⏳ inventory + last-modified szűrés |
| 1.9 | `src/` legacy státusz | ⏳ build pipeline check (kapcsolódik 1.1-hez) |

---

## 🔥 PRIORITIZÁLT remediation lista (FÁZIS 2-be megy)

| Prioritás | Feladat | Subagent |
|-----------|---------|----------|
| **P0** | Worktree purge (9→3) | `brunella-delivery-lead` |
| **P0** | dashboard.bat smoke check (7. lépés tartalmas) | `brunella-implementer` |
| **P1** | MCP autostart 12→10 (`chrome-devtools/playwright/maestro` on-demand) | `brunella-architect` |
| **P1** | `src/agents/registry.json` 16 extra agent → migrálás vagy deprecated jelölés | `brunella-architect` |
| **P1** | Route ↔ Dashboard mapping mátrix + halott gomb cleanup | `brunella-architect` + `brunella-implementer` |
| **P2** | Cloudflare `src/cloudflare/` legacy konszolidáció | `brunella-architect` |
| **P2** | PAIOS chat e2e validáció + javítás (élő smoke) | `brunella-implementer` + `robust-test-writer` |
| **P3** | Skill/plugin kihasználtság inventory | `bas-self-reflect` |

**Folyamat-konvenció FÁZIS 2-höz:** minden alfeladat → külön commit + `phase2-<feladat>.md` log a track mappába. Validáció minden 2-3 alfeladat után `npm run build` + targeted vitest.
