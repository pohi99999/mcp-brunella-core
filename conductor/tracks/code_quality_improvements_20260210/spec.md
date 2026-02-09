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

### P3: Centralizált Error Handling [IMPORTANT]
**Becsült idő:** 1 óra

Jelenleg minden route saját try-catch-et használ. Helyette:

```typescript
// src/utils/AppError.ts
export class AppError extends Error {
  constructor(
    message: string,
    public statusCode: number = 500,
    public code?: string
  ) {
    super(message);
    this.name = 'AppError';
  }
}

// src/server/middleware/errorHandler.ts
export function globalErrorHandler(err, req, res, next) {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({ error: err.message, code: err.code });
  }
  logError('Express', err.message);
  res.status(500).json({ error: 'Internal Server Error' });
}
```

**Acceptance Criteria:**
- [ ] AppError class létezik
- [ ] Globális error middleware aktív
- [ ] Route-ok `throw new AppError(...)` formát használnak
- [ ] Egységes JSON error formátum

---

### P4: Audit Log SQLite Persistence [IMPORTANT]
**Becsült idő:** 1 óra

Jelenleg az audit log csak memóriában tárolódik (`auditBuffer: AuditEntry[]`).

A `checkpoint.ts` mintájára SQLite tárolás:

```sql
CREATE TABLE IF NOT EXISTS audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp TEXT NOT NULL,
  action TEXT NOT NULL,
  agent_name TEXT,
  details TEXT,
  user_id TEXT
);
```

**Acceptance Criteria:**
- [ ] `audit_log` tábla létezik (schema.sql)
- [ ] `recordAuditEntry()` SQLite-ba ír
- [ ] `getAuditHistory()` SQLite-ból olvas
- [ ] In-memory buffer megmarad gyorsítótárnak

---

### P5: Config Validation (Zod) [MEDIUM]
**Becsült idő:** 30 perc

```typescript
// src/config/schema.ts
import { z } from 'zod';

export const ConfigSchema = z.object({
  port: z.number().default(3000),
  ollamaBaseUrl: z.string().url().default('http://localhost:11434'),
  pythonSubsetUrl: z.string().url().default('http://127.0.0.1:8000'),
  geminiApiKey: z.string().optional(),
  githubToken: z.string().optional(),
  nodeEnv: z.enum(['development', 'production', 'test']).default('development'),
});

export const config = ConfigSchema.parse({
  port: Number(process.env.PORT),
  ollamaBaseUrl: process.env.OLLAMA_BASE_URL,
  // ...
});
```

**Acceptance Criteria:**
- [ ] Zod schema definiálja az összes config opciót
- [ ] Startup-kor validálás fut
- [ ] Hiányzó/hibás config esetén érthető hibaüzenet

---

### P6: Test Coverage Bővítés [MEDIUM]
**Becsült idő:** 2 óra

Hiányzó tesztek:
- `src/server/web.ts` → API route tesztek (supertest)
- `src/server/middleware.ts` → Middleware unit tesztek
- `src/server/socketService.ts` → Socket.IO event tesztek

**Acceptance Criteria:**
- [ ] Minimum 3 új teszt fájl
- [ ] Coverage > 60%

---

### P7: console.log → Structured Logger [IDEA]
**Becsült idő:** 1 óra

A 50+ `console.log/error/warn` hívás cseréje `logInfo/logError` hívásokra.

**Acceptance Criteria:**
- [ ] 0 console.log production kódban (kivéve index.ts startup)
- [ ] Minden log a logger.ts-en megy keresztül

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
