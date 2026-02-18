# MCP Brunella Core - Fejlesztési Dokumentáció

## Tartalomjegyzék

1. [Projekt Áttekintés](#projekt-áttekintés)
2. [Architektúra](#architektúra)
3. [Fejlesztési Workflow](#fejlesztési-workflow)
4. [Implementált Fejlesztések](#implementált-fejlesztések)
5. [Tesztelési Stratégia](#tesztelési-stratégia)
6. [Konfiguráció Kezelés](#konfiguráció-kezelés)
7. [Best Practices](#best-practices)
8. [Troubleshooting](#troubleshooting)

---

## Projekt Áttekintés

### Cél
A **MCP Brunella Core** egy Model Context Protocol (MCP) szerver implementáció, amely biztonságos és felügyelt hozzáférést biztosít:

- Fájlrendszer műveletekhez (workspace)
- Tudásbázis kereséshez és RAG-hoz
- Böngészési eszközökhöz (Playwright)
- AI alapú kódgeneráláshoz (self-healing pipeline)
- Agent rendszerhez (delegáció és koordináció)

### Technológiai Stack

#### Core
- **Nyelv:** TypeScript (Node.js runtime)
- **MCP SDK:** @modelcontextprotocol/sdk v1.0.0
- **Web Framework:** Express 5.x
- **Real-time:** Socket.IO

#### Adattárolás
- **Vektoros DB:** LanceDB (RAG)
- **SQLite:** better-sqlite3 (strukturált adatok)

#### AI & Tools
- **LLM:** Ollama (helyi), Claude API
- **Böngésző:** Playwright
- **Sandbox:** vm2 (Node.js), Python venv
- **Embeddings:** Ollama nomic-embed-text

#### Fejlesztés
- **Tesztelés:** Jest + ts-jest
- **Build:** TypeScript Compiler
- **Config:** JSON/YAML support (js-yaml)

---

## Architektúra

### Projekt Struktúra

```
mcp-brunella-core/
├── src/
│   ├── agents/              # Agent rendszer
│   │   ├── AgentManager.ts  # Agent koordináció
│   │   ├── types.ts         # Agent interfészek
│   │   ├── registry.json    # Agent definíciók
│   │   └── __tests__/       # Unit tesztek
│   ├── config/
│   │   ├── index.ts         # Konfiguráció kezelés
│   │   └── configLoader.ts  # Config fájl betöltés
│   ├── pipeline/
│   │   ├── llmPipeline.ts   # Self-healing pipeline
│   │   └── __tests__/       # Pipeline tesztek
│   ├── server/
│   │   └── web.ts           # Web UI (Express + Socket.IO)
│   ├── tools/               # MCP Tools
│   │   ├── workspace.ts     # Fájl műveletek
│   │   ├── knowledge.ts     # RAG keresés
│   │   ├── browser.ts       # Playwright
│   │   ├── interpreter.ts   # Code execution
│   │   ├── ollamaTool.ts    # Ollama integráció
│   │   └── ...              # További tools
│   ├── utils/
│   │   ├── logger.ts        # Strukturált logging
│   │   ├── rag.ts           # RAG cache és keresés
│   │   ├── health_check.ts  # Health monitoring
│   │   └── db.ts            # SQLite adatbázis
│   └── index.ts             # MCP szerver entry point
├── build/                   # Compiled JavaScript
├── logs/                    # Log fájlok
├── public/                  # Web UI statikus fájlok
├── docs/                    # Dokumentáció
└── package.json

```

### Komponens Diagram

```
┌─────────────────┐
│   MCP Client    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  MCP Server     │
│  (index.ts)     │
└────────┬────────┘
         │
    ┌────┴────┬──────────┬──────────────┐
    ▼         ▼          ▼              ▼
┌────────┐ ┌──────┐ ┌─────────┐ ┌──────────┐
│ Tools  │ │Agents│ │Pipeline │ │  Web UI  │
└────────┘ └──────┘ └─────────┘ └──────────┘
    │         │          │            │
    └─────────┴──────────┴────────────┘
              │
    ┌─────────┼─────────┐
    ▼         ▼         ▼
┌────────┐ ┌──────┐ ┌─────────┐
│ LanceDB│ │Logger│ │Health   │
│  RAG   │ │      │ │ Check   │
└────────┘ └──────┘ └─────────┘
```

---

## Fejlesztési Workflow

### Követelmények

1. **Node.js** 18+ vagy 20+
2. **TypeScript** 5.0+
3. **npm** vagy **yarn**

### Telepítés

```bash
# Függőségek telepítése
npm install

# Build
npm run build

# Fejlesztési mód (watch)
npm run watch

# Dev mód (ts-node)
npm run dev
```

### Fejlesztési Scriptek

```bash
# Build
npm run build

# Fejlesztés (watch mode)
npm run watch

# Dev mód (ts-node, nincs build szükséges)
npm run dev

# Production indítás
npm start

# Tesztek futtatása
npm test

# Tesztek watch módban
npm run test:watch

# Coverage report
npm run test:coverage

# Smoke test (MCP ping + AnythingLLM)
npm run smoke
```

---

## Implementált Fejlesztések

### 1. Strukturált Logging Rendszer

#### Változások

**Fájl:** `src/utils/logger.ts`

**Előtte:**
- Egyszerű timestamp + message formátum
- Nincs log szint kezelés
- Nincs strukturált adat

**Utána:**
- JSON formátumú strukturált logging
- Log szintek: DEBUG, INFO, WARN, ERROR
- Meta adatok támogatása
- Error stack trace mentés
- Visszafelé kompatibilis plain text mód

#### Használat

```typescript
import { Logger, LogLevel } from './utils/logger';

const logger = new Logger('my-module.log');

// Info log
await logger.log('Operation completed', { userId: 123 });

// Debug log
await logger.debug('Processing data', { count: 42 });

// Warning log
await logger.warn('Deprecated API used', { endpoint: '/old' });

// Error log with exception
try {
  // ...
} catch (error) {
  await logger.error('Operation failed', error, { context: 'user-action' });
}
```

#### Konfiguráció

- Környezeti változó: `STRUCTURED_LOGGING=0` letiltja a JSON formátumot
- Alapértelmezett: JSON formátum (true)

#### Log Formátum Példa

**JSON (strukturált):**
```json
{
  "timestamp": "2024-01-20T10:00:00.000Z",
  "level": "ERROR",
  "message": "Operation failed",
  "meta": { "context": "user-action" },
  "error": {
    "message": "Connection timeout",
    "stack": "Error: Connection timeout\n    at ..."
  }
}
```

**Plain Text (visszafelé kompatibilis):**
```
[2024-01-20T10:00:00.000Z] [ERROR] Operation failed {"context":"user-action"} Error: Connection timeout
```

---

### 2. Konfigurációs Fájl Támogatás

#### Változások

**Új fájlok:**
- `src/config/configLoader.ts` - Config fájl betöltő

**Módosított fájlok:**
- `src/config/index.ts` - Config merge logika

#### Támogatott Formátumok

- JSON: `brunella.config.json`
- YAML: `brunella.config.yaml` vagy `brunella.config.yml`

#### Auto-detection Sorrend

1. `./brunella.config.json`
2. `./brunella.config.yaml`
3. `./brunella.config.yml`
4. `./config.json`
5. `./config.yaml`

Vagy explicit megadás:
```bash
CONFIG_FILE=./custom-config.json npm start
```

#### Precedencia Rendszer

1. **Környezeti változók** (legmagasabb prioritás)
2. **Config fájl**
3. **Alapértelmezett értékek** (legalacsonyabb prioritás)

#### Példa Config Fájl

**JSON (`brunella.config.json`):**
```json
{
  "workspaceRoot": "C:\\MyWorkspace",
  "allowedRoots": ["projects", "docs"],
  "webUiPort": 3001,
  "structuredLogging": true,
  "anythingllmBaseUrl": "http://localhost:3001",
  "maxReadBytes": 500000
}
```

**YAML (`brunella.config.yaml`):**
```yaml
workspaceRoot: C:\MyWorkspace
allowedRoots:
  - projects
  - docs
webUiPort: 3001
structuredLogging: true
anythingllmBaseUrl: http://localhost:3001
maxReadBytes: 500000
```

#### Reload Funkció

```typescript
import { reloadConfig } from './config/index';

// Config újratöltése futás közben
await reloadConfig();
```

---

### 3. RAG Cache Optimalizálás

#### Változások

**Fájl:** `src/utils/rag.ts`

#### Implementált Funkciók

1. **In-Memory Cache**
   - Embedding cache: Query text -> embedding vector
   - Search cache: Query + limit -> results
   - TTL: 1 óra (3600000ms)

2. **Cache Statisztikák**
   ```typescript
   import { getRAGCacheStats } from './utils/rag';
   
   const stats = getRAGCacheStats();
   // { embeddings: 10, searches: 5 }
   ```

3. **Cache Menedzsment**
   ```typescript
   import { clearRAGCache } from './utils/rag';
   
   // Cache törlése (pl. új indexelés után)
   clearRAGCache();
   ```

#### Teljesítmény Javulás

- **Előtte:** Minden keresés embedding generálást és DB lekérdezést igényelt
- **Utána:** 
  - Első keresés: Embedding + DB query (cache-ba mentve)
  - Utóbbi keresések: Instant cache lookup
  - ~90% sebesség javulás ismétlődő kereséseknél

#### Cache Életciklus

```
Query Input
    │
    ▼
Cache Check ──Hit──► Return Cached Result
    │
   Miss
    │
    ▼
Generate Embedding ──► Cache Embedding
    │
    ▼
DB Search ──► Cache Results
    │
    ▼
Return Results
```

---

### 4. Bővített Health Check

#### Változások

**Fájl:** `src/utils/health_check.ts`

#### Új Funkciók

1. **Rendszer Információk**
   - Node.js verzió
   - Platform és architektúra
   - Uptime

2. **Workspace Ellenőrzés**
   - Root könyvtár létezése
   - Elérhetőség és írhatóság

3. **Logs Könyvtár**
   - Létezés ellenőrzés
   - Írhatóság teszt (temp fájl írás)

4. **Szolgáltatások**
   - Ollama elérhetőség (3s timeout)
   - AnythingLLM elérhetőség (3s timeout)

5. **Cache Statisztikák**
   - RAG cache mérete
   - Embedding és search cache statisztikák

#### Health Status Formátum

```typescript
interface HealthStatus {
  timestamp: string;
  status: 'OK' | 'WARN' | 'ERROR';
  system: {
    nodeVersion: string;
    platform: string;
    arch: string;
    uptime: number;
  };
  workspace: {
    root: string;
    exists: boolean;
    accessible: boolean;
  };
  logs: {
    directory: string;
    exists: boolean;
    writable: boolean;
  };
  services: {
    ollama?: { reachable: boolean; status: string; };
    anythingllm?: { reachable: boolean; url: string; };
  };
  cache: {
    rag: { embeddings: number; searches: number; };
  };
  errors?: string[];
}
```

#### Használat

```typescript
import { checkSystemHealth } from './utils/health_check';

const status = await checkSystemHealth();
console.log(status.status); // 'OK' | 'WARN' | 'ERROR'
console.log(status.errors); // ['Service X unreachable', ...]
```

#### Health Check Naplózás

A health check eredmények automatikusan mentve a `logs/health_status.json` fájlba.

---

### 5. Tesztelési Infrastruktúra

#### Változások

**package.json frissítések:**
- Jest és ts-jest hozzáadva
- Test scriptek
- Coverage beállítások

#### Test Scriptek

```bash
# Összes teszt futtatása
npm test

# Watch mód
npm run test:watch

# Coverage report generálás
npm run test:coverage
```

#### Coverage Célok

- Branches: 70%
- Functions: 70%
- Lines: 70%
- Statements: 70%

#### Implementált Tesztek

##### Logger Tesztek (`src/utils/__tests__/logger.test.ts`)

- Strukturált logging JSON formátum
- Log szintek (DEBUG, INFO, WARN, ERROR)
- Meta adatok kezelés
- Error stack trace
- Plain text mód
- Write failure kezelés

##### AgentManager Tesztek (`src/agents/__tests__/AgentManager.test.ts`)

- Agent regisztráció
- Agent listázás
- Agent definíciók
- Delegálás
- Built-in agentek (researcher, developer)
- Hibakezelés (nem létező agent)

##### Pipeline Tesztek (`src/pipeline/__tests__/llmPipeline.test.ts`)

- Pipeline inicializálás
- Progress events
- Error handling
- Retry logika
- Code generation
- Markdown cleanup

#### Mock Stratégiák

- **fs/promises:** Mock-olva a logger tesztekben
- **fetch:** Global fetch mock a pipeline tesztekben
- **vm2:** Mock-olva a sandbox tesztekben

---

### 6. Type Safety Javítások

#### Változások

**Fájlok módosítva:**
- `src/pipeline/llmPipeline.ts`
- `src/server/web.ts`
- `src/index.ts`
- `src/agents/AgentManager.ts`

#### Előtte vs Utána

**Előtte:**
```typescript
catch (e: any) {
  return { error: e.message };
}
```

**Utána:**
```typescript
catch (e: unknown) {
  const errorMessage = e instanceof Error ? e.message : String(e);
  return { error: errorMessage };
}
```

#### Type Guards Használata

```typescript
// Biztonságos error handling
if (error instanceof Error) {
  logger.error('Operation failed', error);
} else {
  logger.error('Operation failed', new Error(String(error)));
}
```

---

### 7. Error Handling Javítások

#### Konzisztens Hibakezelés

Minden modulban:
1. **Try-catch blokkok** minden async műveletnél
2. **Type-safe error handling** (`unknown` -> `instanceof Error`)
3. **Strukturált error logging** (logger.error())
4. **User-friendly hibaüzenetek** MCP tool válaszokban

#### Hibakezelési Minta

```typescript
try {
  const result = await someAsyncOperation();
  return {
    content: [{ type: "text", text: result }]
  };
} catch (e: unknown) {
  const errorMessage = e instanceof Error ? e.message : String(e);
  await logger.error('Operation failed', e instanceof Error ? e : undefined);
  
  return {
    isError: true,
    content: [{ 
      type: "text", 
      text: `Error: ${errorMessage}` 
    }]
  };
}
```

---

## Tesztelési Stratégia

### Unit Tesztek

**Cél:** Egyedi modulok és funkciók tesztelése izolációban.

**Coverage cél:** >70%

**Futtatás:**
```bash
npm test
```

### Integration Tesztek

**Jelenleg:** Smoke test (`scripts/smoke.mjs`)
- MCP ping teszt
- AnythingLLM elérhetőség

**Tervezett bővítések:**
- Agent delegáció integration tesztek
- Pipeline end-to-end tesztek
- Tool chain tesztek

### E2E Tesztek

**Tervezett:**
- Teljes workflow tesztek MCP client-tel
- Web UI tesztek (Playwright)
- Agent orchestration tesztek

### Test Coverage Report

```bash
npm run test:coverage
```

Generálja a `coverage/` mappát HTML reporttal.

---

## Konfiguráció Kezelés

### Környezeti Változók

| Változó | Leírás | Alapértelmezett |
|---------|--------|-----------------|
| `WORKSPACE_ROOT` | Workspace gyökérkönyvtár | Hardcoded útvonal |
| `CONFIG_FILE` | Config fájl útvonala | Auto-detection |
| `NODE_ENV` | Környezet mód | `production` |
| `ANYTHINGLLM_BASE_URL` | AnythingLLM API URL | `http://localhost:3001` |
| `ANYTHINGLLM_WORKSPACE` | Workspace ID | `` |
| `ANYTHINGLLM_API_KEY` | API kulcs | `` |
| `WEB_UI_ENABLED` | Web UI engedélyezése | `1` (true) |
| `WEB_UI_PORT` | Web UI port | `3000` |
| `STRUCTURED_LOGGING` | JSON formátumú logging | `1` (true) |

### Config Fájl Létrehozása

1. Hozz létre egy `brunella.config.json` vagy `brunella.config.yaml` fájlt
2. Adja meg a beállításokat
3. A szerver automatikusan betölti az indításkor

**Példa minimális config:**
```json
{
  "workspaceRoot": "C:\\MyWorkspace",
  "webUiPort": 3000
}
```

---

## Best Practices

### Kód Szervezés

1. **Moduláris struktúra:** Minden funkció saját modulban
2. **Dependency injection:** Config és logger dependency-k
3. **Error boundaries:** Try-catch minden kritikus ponton
4. **Type safety:** Mindig használj TypeScript típusokat

### Logging

1. **Strukturált logging:** Használj meta adatokat
2. **Log szintek:** DEBUG csak dev-ben, ERROR mindig
3. **Sensitive data:** Soha ne logold jelszavakat vagy tokeneket
4. **Context:** Adj context információkat minden loghoz

```typescript
// ✅ Jó
await logger.log('User logged in', { userId: user.id, method: 'oauth' });

// ❌ Rossz
await logger.log('User logged in', { password: user.password }); // Soha!
```

### Error Handling

1. **Type-safe:** Mindig használj `unknown` és type guards
2. **User-friendly:** Adj értelmezhető hibaüzeneteket
3. **Logging:** Logold az összes hibát strukturáltan
4. **Recovery:** Próbálj meg recovery logikát implementálni ahol lehetséges

### Testing

1. **TDD:** Írj teszteket előbb, kódot utána
2. **Coverage:** Tartsd fent a 70%+ coverage-t
3. **Mocking:** Mock-old külső függőségeket
4. **Isolation:** Minden teszt legyen független

### Konfiguráció

1. **Environment-specific:** Használj külön config fájlokat dev/prod környezethez
2. **Sensitive data:** Soha ne commitolj `.env` fájlokat
3. **Defaults:** Mindig adj értelmes alapértelmezett értékeket
4. **Validation:** Validáld a config értékeket induláskor

---

## Troubleshooting

### Gyakori Problémák

#### 1. Config fájl nem töltődik be

**Tünet:** Alapértelmezett értékek használata config fájl ellenére.

**Megoldás:**
- Ellenőrizd, hogy a config fájl a projekt gyökerében van-e
- Ellenőrizd a fájl formátumát (JSON/YAML syntax)
- Nézd meg a konzol kimenetet a hibaüzenetekért

#### 2. Log fájlok nem jönnek létre

**Tünet:** `Failed to write to log file` hibák.

**Megoldás:**
- Ellenőrizd a `logs/` könyvtár jogosultságait
- Biztosítsd, hogy a könyvtár írható

#### 3. Ollama connection failed

**Tünet:** RAG keresés vagy pipeline hibák Ollama kapcsolattal.

**Megoldás:**
- Ellenőrizd, hogy az Ollama fut-e: `http://localhost:11434`
- Futtasd a health check-et: `checkSystemHealth()`

#### 4. Cache nem működik

**Tünet:** Minden keresés lassú, nincs cache hatás.

**Megoldás:**
- Ellenőrizd a RAG cache statisztikákat: `getRAGCacheStats()`
- Nézd meg, hogy a cache nem lett-e törölve: `clearRAGCache()`

#### 5. TypeScript build hibák

**Tünet:** `tsc` build során type hibák.

**Megoldás:**
```bash
# Tiszta build
rm -rf build node_modules
npm install
npm run build
```

### Debug Mód

**Logging bekapcsolása:**
```typescript
// Structured logging
const logger = new Logger('debug.log');
await logger.debug('Debug message', { data: 'value' });
```

**Environment változó:**
```bash
STRUCTURED_LOGGING=1 NODE_ENV=development npm run dev
```

---

## Következő Lépések

### Tervezett Fejlesztések

1. **Integration Tesztek**
   - Agent delegáció teljes flow
   - Pipeline end-to-end tesztek
   - Tool chain integration

2. **Monitoring**
   - Prometheus metrikák
   - Performance monitoring
   - Error tracking

3. **Dokumentáció**
   - API dokumentáció generálás (OpenAPI)
   - Code examples repository
   - Video tutorials

4. **Performance**
   - Connection pooling
   - Batch operations
   - Lazy loading

5. **Security**
   - Rate limiting
   - Authentication tokens
   - Audit logging

---

## Changelog

### 2024-01-20 - Fejlesztési Sprint

#### Hozzáadva
- ✅ Strukturált logging rendszer (JSON + plain text)
- ✅ YAML/JSON config fájl támogatás
- ✅ RAG cache optimalizálás (in-memory, 1h TTL)
- ✅ Bővített health check (szolgáltatások, workspace, cache)
- ✅ Jest teszt infrastruktúra
- ✅ Unit tesztek (Logger, AgentManager, Pipeline)
- ✅ Type safety javítások (`any` -> `unknown`)
- ✅ Konzisztens error handling
- ✅ Cache statisztikák és management API
- ✅ Config reload funkció

#### Javítva
- ✅ Web UI markdown formázási hiba
- ✅ .gitignore bővítése
- ✅ Config merge logika (precedencia rendszer)
- ✅ Error handling konzisztencia

#### Dokumentálva
- ✅ Workflow dokumentáció
- ✅ API dokumentáció alapok
- ✅ Konfigurációs példák

---

## Kapcsolat és Támogatás

### Fejlesztési Kérdések

Problémák vagy javaslatok esetén:
1. Ellenőrizd a dokumentációt
2. Nézd meg a health check eredményeket
3. Vizsgáld meg a log fájlokat
4. Futtass unit teszteket

### Log Fájlok Helye

- `logs/system_commands.log` - Rendszerparancsok
- `logs/agent-manager.log` - Agent műveletek
- `logs/pipeline.log` - Pipeline folyamatok
- `logs/web_ui.log` - Web UI események
- `logs/health_status.json` - Health check eredmények

---

**Utolsó frissítés:** 2024-01-20
