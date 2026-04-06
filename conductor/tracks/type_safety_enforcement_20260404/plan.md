# Implementációs Terv: Type Safety Enforcement

## 📋 Fázisok

### 1. Fázis: Domináns any-k azonosítása
- [ ] `utils/db.ts` és `utils/tasksDb.ts` refaktorálása (DB objektumok típusozása).
- [ ] `utils/rag.ts` és `utils/lancedb_client.ts` refaktorálása.

### 2. Fázis: Agent és Tool réteg típusozása
- [x] `BaseAgent.ts` és az IAgent interfész szigorítása (már tiszta, nincs teendő).
- [x] Tool handler függvények paramétereinek típusozása: `KKVCrmAgent.ts`, `kkvCrm.ts`, `kkvCrmService.ts`, `crm_create_lead.ts` @ts-nocheck elimánálva.

### 3. Fázis: Dashboard és Store típusozás
- [x] `src/dashboard/store/` mappában lévő linter warningok javítása.
- [x] Felesleges `eslint-disable` direktívák eltávolítása.

### 4. Fázis: Verifikáció
- [x] `npm run build` (ha ez átmegy, a típusozás jó). ✔️ TSC 0 errors
- [x] `npm run lint` (0 any warning). ✔️ 0 problems (lint exit 0)

## 🎨 Dashboard Integráció
- [ ] Típusbiztos Store-ok használatának verifikálása a komponensekben.

## 🖥️ CLI Integráció
- [ ] CLI parancs paraméterek típusozásának ellenőrzése.

## Jegyzetek
- 2026-04-06: A `src/server/routes/testScheduler.ts` route-slice is lezárható lesz ebben a trackben; a cél a query/body parsing és a response payloadok szigorítása a public contract megtartásával.
- 2026-04-06: Az `src/agents/ApifyScrapingAgent.ts` slice is kész; a következő biztonságos agent/tool hotspottok ugyanebben a trackben folytathatók.
- 2026-04-06: A `src/utils/cloudflareClient.ts` CloudflareClient slice is kész; a task/status/history/workers/routing válaszok most `unknown`-safe helperrel normalizáltak, a singleton és a public API megmaradt.
- 2026-04-06: A `src/agents/cloudflare/CloudflareClient.ts` wrapper slice is kész; a nested taskId/chat result/status kezelés most külön `unknown`-safe helperben fut, a singleton API és a visszafelé kompatibilis válaszformák megmaradtak. Validáció: `npm run build` + `npx vitest run test/cloudflareClient.test.ts test/cloudflare_integration.test.ts test/cloudflare_routes.test.ts`.
- 2026-04-06: A `src/agents/GenesisOrchestrator.ts` guard-slice is kész; a `metadata.spec` olvasás most lokális `unknown`-safe helperen megy át, a missing-spec üzenet és az orchestration flow változatlan. Validáció: `npm run build` + `npx vitest run test/GenesisOrchestrator.test.ts`.
- 2026-04-06: A dashboard/store slice is kész a `src/dashboard/store/systemSignalStore.ts`, `src/dashboard/context/SocketContext.tsx`, `src/dashboard/components/dashboard/MachineHunterWidget.tsx`, `src/dashboard/types/dashboard.ts` és `src/dashboard/store/systemSignalStore.test.ts` fájlokban; a store most `AgentStatusEntry`/`ChatterEntry`/`MachineAlert` típusokkal dolgozik, a fölös `eslint-disable` direktívák kikerültek, a `clearAllData()` már a machine alert listát is üríti. Validáció: `npm run test:dashboard -- src/dashboard/store/systemSignalStore.test.ts src/dashboard/hooks/useSystemSignal.test.ts` + `npm run build:ui`.
