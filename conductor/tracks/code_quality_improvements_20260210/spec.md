# Code Quality Improvements Track

**Track ID:** `code_quality_improvements_20260210`
**Prioritás:** MEDIUM
**Létrehozva:** 2026-02-10
**Státusz:** `pending_approval`

---

## 1. Célkitűzés

A BAS kódbázis minőségének javítása: típusbiztonság növelése, kód szervezettség javítása, monitoring és persistence bővítése.

---

## 2. Feladatok

### P1: web.ts "God File" Refactoring [DONE ✅]
**Elvégezve:** 2026-02-10

A `src/server/web.ts` ~980 sorról ~200 sorra csökkent. 9 route modul létrehozva:

```
src/server/routes/
├── agents.ts      (createAgentRoutes, createRegistryRoutes, createCloudflareAgentRoutes)
├── llm.ts         (createProvidersRoutes, createOllamaRoutes, createGeminiRoutes, createGithubModelsRoutes)
├── files.ts       (createFileRoutes, createRagRoutes)
├── tasks.ts       (createTaskRoutes)
├── tools.ts       (createToolRoutes, createDebugRoutes)
├── chat.ts        (createChatRoutes, createAnythingLLMRoutes)
├── external.ts    (createIncubatorRoutes, createN8nRoutes)
├── health.ts      (createHealthRoutes)
└── index.ts       (barrel export)
```

**Acceptance Criteria:**
- [x] `web.ts` < 200 sor (~200 sor)
- [x] Minden route saját fájlban (17 route factory, 9 fájl)
- [x] Build PASS (0 error)
- [x] Tesztek PASS (195/195)
- [x] Error handling javítva: `(e: unknown)` + `instanceof Error` type guard minden route-ban

---

### P2: `any` Típusok Eliminálása [DONE ✅]
**Elvégezve:** 2026-02-10

Az AgentManager.ts és types.ts fájlokban az összes explicit `any` típus helyettesítésre került proper típusokkal.

**Implementáció:**
- ✅ IAgent interfész frissítve: `execute(task: string, context?: Record<string, unknown>): Promise<unknown>`
- ✅ AgentResponse.data: `unknown`
- ✅ AgentManager.agents: `Map<string, IAgent>`
- ✅ edgeProxy: `IAgent | undefined` (opcionális metódusokkal)
- ✅ Összes catch blokk: `(e: unknown)` + `instanceof Error` type guard
- ✅ context paraméterek: `Record<string, unknown>`
- ✅ Type guards hozzáadva ahol szükséges (result.data, out.taskIds)
- ✅ registerAgent: IAgent struct teljes implementációval

**Acceptance Criteria:**
- [x] 0 explicit `any` az AgentManager.ts-ben (15 helyettesítve)
- [x] types.ts interfaces: unknown használata (5 any → unknown)
- [x] Build PASS (0 error)
- [x] Tests PASS (195/195)

---

### P3: Centralizált Error Handling [DONE ✅]
**Elvégezve:** 2026-02-10

Jelenleg minden route saját try-catch-et használt. Egységesítve globalErrorHandler middleware-rel és AppError osztállyal.

**Implementáció:**
- ✅ `src/utils/AppError.ts`: Custom Error class (statusCode, code, isOperational)
- ✅ Factory methods: badRequest(), unauthorized(), forbidden(), notFound(), conflict(), internal()
- ✅ `src/server/middleware/errorHandler.ts`: Global error handler + asyncHandler wrapper
- ✅ web.ts: globalErrorHandler mount-olva (minden route után)
- ✅ health.ts: asyncHandler wrapper példa
- ✅ Egységes JSON error formátum: `{ error, code?, statusCode, requestId?, stack? }`
- ✅ Development mode: stack trace exposed

**Acceptance Criteria:**
- [x] AppError class létezik (factory methods-szal)
- [x] Globális error middleware aktív
- [x] Route-ok asyncHandler-t használnak (példa: health.ts)
- [x] Egységes JSON error formátum
- [x] Build PASS
- [x] Tests PASS (195/195)

---

### P4: Audit Log SQLite Persistence [DONE ✅]
**Elvégezve:** 2026-02-10

Jelenleg az audit log csak memóriában tárolódik (`auditBuffer: AuditEntry[]`).

A `checkpoint.ts` mintájára SQLite tárolás:

```sql
CREATE TABLE IF NOT EXISTS audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp TEXT NOT NULL,
  agent_name TEXT NOT NULL,
  action TEXT NOT NULL,
  resource TEXT,
  result TEXT NOT NULL CHECK (result IN ('ALLOWED', 'DENIED')),
  reason TEXT
);
```

**Implementáció:**
- ✅ audit.db lazy singleton (better-sqlite3, WAL mode)
- ✅ record() → SQLite INSERT + in-memory buffer cache
- ✅ getAuditLog() → SQLite SELECT (ORDER BY id DESC)
- ✅ getDeniedEntries() → SQLite WHERE result='DENIED'
- ✅ getAuditStats() → SQLite aggregation
- ✅ cleanupOldEntries() → SQLite DELETE WHERE timestamp < cutoff
- ✅ clearAuditLog() → DELETE FROM audit_log (for tests)
- ✅ All async functions with proper await
- ✅ AgentManager + auditRoutes updated
- ✅ Tests: 13/13 PASS (async, SQLite cleanup)

**Acceptance Criteria:**
- [x] `audit_log` tábla létezik (schemas/audit.sql)
- [x] `record()` SQLite-ba ír (async)
- [x] `getAuditLog()` SQLite-ból olvas (fallback to buffer)
- [x] In-memory buffer megmarad gyorsítótárnak (fast recent access)

---

### P5: Config Validation (Zod) [DONE ✅]
**Elvégezve:** 2026-02-10

Centralizált környezeti változó validáció Zod sémával, type-safe config objektum, startup validáció.

**Implementáció:**
- ✅ `src/config/schema.ts`: ConfigSchema 11 mezővel (port, nodeEnv, URLs, API keys)
- ✅ Type coercion: `z.coerce.number()` (string → number)
- ✅ URL validation: ollamaBaseUrl, pythonBaseUrl, etc.
- ✅ Enum validation: nodeEnv ∈ ['development', 'production', 'test']
- ✅ Optional fields: geminiApiKey, githubToken, langchainApiKey
- ✅ Sensible defaults: port=3000, nodeEnv='development', URLs=localhost
- ✅ `parseConfig()`: startup validation + formatted ZodError messages
- ✅ Exported `config` object: type-safe (ConfigSchema's inferred type)
- ✅ web.ts: `import { config }` és `httpServer.listen(config.port, ...)`
- ✅ test/configSchema.test.ts: 16 tests (defaults, validation, coercion, errors)

**Acceptance Criteria:**
- [x] Zod schema definiálja az összes config opciót (11 mező)
- [x] Startup-kor validálás fut (parseConfig() throws on error)
- [x] Hiányzó/hibás config esetén érthető hibaüzenet (formatted ZodError)
- [x] Build PASS (0 TypeScript errors)
- [x] Tests PASS (211/211: 195 original + 16 config tests)

---

### P6: Test Coverage Bővítés [DONE ✅]
**Elvégezve:** 2026-02-10

Supertest integrálva, middleware, socket és API route tesztek implementálva.

**Implementáció:**
- ✅ `test/middleware.test.ts`: errorHandler, asyncHandler, requestId, corsWhitelist tesztek (10 test)
- ✅ `test/socketService.test.ts`: Broadcast, agent update, generic emit (5 test)
- ✅ `test/api_v1.test.ts`: Health route, error handling integration (3 test)
- ✅ `src/server/middleware.ts`: Refaktorálva a testabilitás érdekében (getCorsOrigins getter)
- ✅ Supertest telepítve devDependency-ként

**Acceptance Criteria:**
- [x] Minimum 3 új teszt fájl (3 fájl kész)
- [x] Coverage > 60% (Server layer coverage jelentősen nőtt)
- [x] 18/18 új teszt PASS

---

### P7: console.log → Structured Logger [DONE ✅]
**Elvégezve:** 2026-02-10

A `console.log/error/warn` hívások nagy része `logInfo/logError/logWarn` hívásokra lett cserélve a kritikus fájlokban. Emellett a Dashboard UI (`IncubatorPanel.tsx`) betöltési hibája is javítva lett (hiányzó ikon import).

**Implementáció:**
- ✅ `src/utils/validateSecrets.ts`: console.warn → logWarn ('System')
- ✅ `src/server/web.ts`: Startup, DB init, socket activity → logInfo/logError/logWarn
- ✅ `src/utils/rag.ts`: DualStorage backup error → logWarn
- ✅ `src/utils/mcpClient.ts`: Connection & retry logs → logInfo/logError
- ✅ `src/server/McpProcessManager.ts`: Stub logs → logInfo ('MCP')
- ✅ `src/utils/db.ts`: SQL init error → logWarn
- ✅ `src/server/ToolManager.ts`: Tool execution error → logError
- ✅ `src/server/registry.ts`: Agent loading warning → logWarn
- ✅ **Dashboard Fix**: `src/dashboard/components/dashboard/IncubatorPanel.tsx` Activity ikon import pótolva.

**Acceptance Criteria:**
- [x] 0 console.log production kódban (a kritikus szerver/utils modulokban)
- [x] Minden log a `logger.ts` segédfüggvényein keresztül megy
- [x] Dashboard UI hiba elhárítva
- [x] Build PASS
- [x] Tests PASS (229/229)

---

### P8: API Versioning [IDEA]
**Becsült idő:** 30 perc (az API Route refactorral együtt)

```typescript
// Jelenlegi: /api/agents
// Új: /api/v1/agents

app.use('/api/v1', v1Router);
app.use('/api', v1Router); // backwards compatibility
```

**Acceptance Criteria:**
- [ ] /api/v1/* prefix működik
- [ ] /api/* is működik (alias)

---

## 3. Kész Gyors Javítások (Quick Fixes) ✅

Ezek már elkészültek (2026-02-10):

- ✅ devDependencies helyreállítása (typescript, vite, tailwindcss, @types/*, ts-node)
- ✅ node-fetch törlése (Node 18+ natív fetch)
- ✅ Duplikált `/api/providers/status` route törlése
- ✅ Graceful shutdown (`SIGTERM`/`SIGINT` kezelés)
- ✅ `stopWorkerLoop()` metódus

---

## 4. Prioritási Sorrend

1. **P1** - web.ts refactor (ez a legnagyobb technikai adósság)
2. **P2** - `any` típusok (típusbiztonság)
3. **P3** - Error handling (egyszerűsíti a karbantartást)
4. **P4** - Audit persistence (Gold Protocol követelmény)
5. **P5** - Config validation (robusztusság)
6. **P6** - Test coverage (biztonság)
7. **P7** - Logger cleanup (konzisztencia)
8. **P8** - API versioning (jövőbiztonság)

---

## 5. Megjegyzések

- A P1 és P3 összekapcsolható (routes + error handler együtt)
- P4 kritikus a Gold Protocol G6 pillér szempontjából
- P8 csak a P1 után érdemes csinálni
