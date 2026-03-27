# Cloudflare Workers Migration — 16 Agent Edge Orkesztrátor

Állapot: ARCHIVED

## Cél
A BAS rendszer 16 ügynökének migrálása Cloudflare Workers környezetbe, edge orchestration támogatással.

## Fő lépések
- Jelenlegi architektúra elemzése
- Cloudflare Workers korlátok és lehetőségek feltérképezése
- Agentek edge-re való átalakításának terve
- D1, KV, R2, Vectorize integráció
- Biztonsági és RBAC policyk
- Tesztelési és rollout stratégia

## TODO-k
- [x] Részletes követelménylista

### Részletes követelménylista

1. **Architektúra kompatibilitás**
   - Node.js/TypeScript kód edge-re portolhatósága
   - Python alrendszer (ha szükséges) Workers-ön kívül
2. **Agent migráció**
   - 16 ügynök edge-kompatibilis újraimplementálása
   - MCP protokoll támogatás Workers környezetben
3. **Cloudflare szolgáltatások integrációja**
   - D1 (SQL), KV, R2 (objektumtár), Vectorize (vektoros keresés)
   - API rate limit, storage quota kezelése
4. **Biztonság és RBAC**
   - Tokenkezelés, jogosultsági szintek
   - Workers environment variable management
5. **LLM provider routing**
   - Bifrost Gateway edge-en (Ollama, Gemini, GitHub, Anthropic, Cloudflare)
   - Fallback, költségkontroll, health monitoring
6. **Orchestration & workflow**
   - DAG engine edge-re optimalizálása
   - Budget, timeout, error handling
7. **Build & deploy pipeline**
   - Dockerless deploy (wrangler, CI/CD)
   - Rollback, staging, canary support
8. **Monitoring & logging**
   - Edge-native log gyűjtés, health check endpoint
   - OpenTelemetry támogatás
9. **Tesztelhetőség**
   - Unit, integration, e2e tesztek edge környezetben
   - Mock/fake edge servicek

- [x] Jelenlegi agent architektúra feltérképezése

### Jelenlegi agent architektúra

- **Agent registry:** 57+ agent (src/agents/registry.json), minden agent IAgent vagy BaseAgent interfészt valósít meg
- **AgentStateMachine:** LangGraph-inspirált FSM, Phoenix Protocol integrációval (checkpoint, auto-retry)
- **DAG engine:** Workflow motor (DAGNode, DAGEdge, DAGWorkflow), budget, error handling, loop/condition támogatás
- **MCP protokoll:** Model Context Protocol, multi-agent kommunikáció, edge-re is portolható
- **LLM routing:** Bifrost Gateway (Ollama, Gemini, GitHub, Anthropic, Cloudflare), fallback, költségkontroll
- **RBAC:** Jogosultságkezelés agent/profil szinten
- **Logging, checkpointing:** OpenTelemetry, PhoenixEventBus, logInfo/logError
- **Python alrendszer:** FastAPI + FastMCP, Playwright, LanceDB, ChromaDB, browser automation

- [x] Cloudflare Workers technikai proof-of-concept

### Cloudflare Workers technikai proof-of-concept

- **Cél:** Minimális működő Workers script, amely HTTP requestet fogad és választ ad (Hello World)
- **Lépések:**
  1. Új Workers projekt inicializálása (wrangler init)
  2. Alap handler (fetch event → Response)
  3. Deploy teszt (wrangler publish, preview)
  4. Lokális teszt (wrangler dev)
- **Következő lépések:**
  - D1/KV/Vectorize integráció PoC
  - Biztonsági policyk PoC

- [x] D1/KV/Vectorize API integrációs terv

### D1/KV/Vectorize API integrációs terv

- **Cél:** Edge storage (D1, KV, Vectorize) integrációs terv kidolgozása Workers környezetben
- **Lépések:**
  1. D1 adatbázis kapcsolódás (wrangler d1)
  2. KV namespace használat (wrangler kv)
  3. Vectorize API endpointok feltérképezése
  4. Példa CRUD műveletek (read/write)
- **Következő lépések:**
  - Biztonsági policyk PoC
  - Migrációs ütemterv, tesztelési terv

- [x] Biztonsági policyk kidolgozása

### Biztonsági policyk kidolgozása

- **Cél:** RBAC és edge security policyk meghatározása Workers környezetben
- **Lépések:**
  1. RBAC profilok (admin, developer, readonly, robotkez, enterprise, evaluator)
  2. URL/domain whitelist/blacklist
  3. API kulcs és token kezelés
  4. PII redakció, audit log
  5. Cost tracking, napi limit
- **Következő lépések:**
  - Migrációs ütemterv, tesztelési terv

- [x] Migrációs ütemterv

### Migrációs ütemterv

- **Cél:** Lépésről lépésre migrációs terv kidolgozása
- **Fő lépések:**
  1. Proof-of-concept Workers script
  2. D1/KV/Vectorize integráció
  3. Biztonsági policyk implementációja
  4. Fokozatos agent/route migráció (prioritás szerint)
  5. Tesztelés, validáció, rollback stratégia
  6. Teljes átállás, monitoring

- [x] Tesztelési terv

### Tesztelési terv

- **Cél:** Edge deployment és agent tesztelési stratégia kidolgozása
- **Lépések:**
  1. Unit és integrációs tesztek Workers környezetben
  2. Agent/route endpoint validáció
  3. Biztonsági policyk tesztelése
  4. Teljesítmény és skálázási tesztek
  5. Rollback és monitoring tesztek


## Megjegyzések
- Prioritás: HIGH
- Kritikus komponens a skálázhatósághoz és edge futtatáshoz.
