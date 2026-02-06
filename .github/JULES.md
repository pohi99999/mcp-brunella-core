# Jules AI Agent - Brunella Core Projekt

**Google Jules:** https://jules.google.com
**Sessions:** 100/nap
**Mód:** Autonomous async agent (órákon át dolgozik egyedül)

---

## 🎯 Projekt Kontextus

**Brunella Agent System (BAS)** - AI multi-agent rendszer szoftverfejlesztés automatizálására.

- **Stack:** TypeScript (Node.js) + Python (FastAPI)
- **Platform:** Windows
- **Ügynökök:** Developer, Evaluator, Researcher, DataScientist, EdgeProxy, ProjectConductor
- **LLM:** Ollama (local) + GitHub Models (GPT-4o) + Cloudflare Workers AI
- **Protokollok:** MCP (Model Context Protocol), Data Flywheel, Phoenix (self-healing)

---

## 📋 Kritikus Szabályok (KÖTELEZŐ!)

### Build & Test Protokoll
```bash
npm run build    # MUSZÁJ sikerülnie (0 hiba)
npm test         # MUSZÁJ 58/58 PASS
```

### ESM Konvenciók
- Minden import `.js` kiterjesztéssel: `import { foo } from './bar.js'`
- `"type": "module"` a package.json-ban
- TypeScript strict mode

### Logging
```typescript
import { logInfo, logError, setAgentStatus } from '../utils/logger.js';
// NE HASZNÁLJ console.log()-ot!
```

### Védett Fájlok (NE TÖRÖLD!)
- `package.json`, `src/agents/types.ts`, `src/agents/registry.json`
- `src/server/web.ts`, `src/server/registry.ts`
- `src/cli.ts`, `src/index.ts`, `src/core/llm_client.ts`

---

## 🗓️ 1 HETES MUNKATERV (100 sessions = ~14 session/nap)

### **Hétfő: DeveloperAgent 2.0 Bővítés** (15 sessions)

**Cél:** Memory Bank (LanceDB) - hibák és javítások tárolása

**Tasks:**
1. `src/agents/DeveloperAgent.ts` - `saveFixToMemory()` metódus
2. LanceDB schema: `{ error: string, fix: string, context: object, timestamp: Date }`
3. `queryMemory(error)` - hasonló hibák keresése
4. Self-heal pipeline integráció (használja memóriát)
5. Teszt: `test/developer_memory.test.ts`

**Prompt Template:**
```
Implement a Memory Bank feature for DeveloperAgent using LanceDB.

Requirements:
1. Save error-fix pairs to LanceDB after successful self-healing
2. Query similar errors before attempting fix (semantic search)
3. Integrate with selfHealBuild() method
4. Schema: { error, fix, context, timestamp, embedding }
5. Use myai/refiner_logic.py LanceDB pattern (optional import)

Files to modify:
- src/agents/DeveloperAgent.ts (add memory methods)
- Create: test/developer_memory.test.ts

DO NOT touch: package.json, src/agents/types.ts

After implementation:
- Run: npm run build (must succeed)
- Run: npm test (must pass 58/58)
- Commit with message: "feat(agent): DeveloperAgent memory bank with LanceDB"
```

---

### **Kedd: EdgeProxy + Cloudflare Integration** (15 sessions)

**Cél:** CLI-ből közvetlenül használható Cloudflare Worker hívások

**Tasks:**
1. `src/agents/EdgeProxyAgent.ts` - `delegateToEdge()` metódus
2. AgentManager bővítés: edge-first routing opció
3. CLI command: `brunella edge-agent <agentName> <task>`
4. Fallback: ha Worker offline, local execution
5. Teszt: `test/edge_proxy.test.ts`

**Prompt:**
```
Integrate EdgeProxyAgent with CLI for remote Cloudflare Worker execution.

Requirements:
1. EdgeProxyAgent.delegateToEdge(agentName, task, context)
2. Modify AgentManager: check EDGE_ENABLED env var
3. Add CLI command in src/cli.ts: edge-agent <name> <task>
4. Fallback to local if Worker unreachable
5. Use CLOUDFLARE_WORKER_URL from .env

Worker URL: https://bas-orchestrator.iam-dd1.workers.dev
Endpoints: POST /task, GET /status/:taskId

Test with:
- brunella edge-agent Developer "generate fibonacci function"

After implementation:
- npm run build && npm test
- Commit: "feat(edge): CLI integration for Cloudflare Worker agents"
```

---

### **Szerda: Browser-Use Robotkéz Aktiválás** (15 sessions)

**Cél:** Playwright automatizálás működésbe hozása

**Tasks:**
1. `myai/browser_worker.py` - teszt és debug
2. Függőségek: `uv pip install browser-use playwright`
3. Scenario futtatás: `myai/scenarios/n8n_training.json`
4. CLI wrapper: `brunella robot <instruction>`
5. Teszt: tényleges n8n workflow létrehozás böngészőben

**Prompt:**
```
Activate Browser-Use automation (Robotkéz) for web automation tasks.

Requirements:
1. Install: uv pip install browser-use playwright
2. Test: python myai/browser_worker.py --check
3. Scenario execution: load myai/scenarios/n8n_training.json
4. CLI command: brunella robot <instruction>
5. Integration with ResearcherAgent (web scraping)

Example task:
"Log into n8n.bas.peterpohanka.com and create a basic HTTP workflow"

After implementation:
- Test with: brunella robot "open google.com and search for 'TypeScript async'"
- Document in: docs/browser-use-setup.md
```

---

### **Csütörtök: LangSmith Tracing Kiterjesztés** (15 sessions)

**Cél:** Minden agent execute automatikusan trace-elve

**Tasks:**
1. `src/agents/BaseAgent.ts` - trace wrapper az execute körül
2. `src/core/llm_client.ts` - traceable minden generateResponse hívás
3. Dashboard: LangSmith link megjelenítés
4. Error tracking: failed traces automatikus report
5. Teszt: `test/langsmith_integration.test.ts`

**Prompt:**
```
Extend LangSmith tracing to all agent executions.

Requirements:
1. Wrap BaseAgent.execute() with @traceable decorator
2. All generateResponse() calls must be traced
3. Add trace metadata: agentName, taskDescription, timestamp
4. Dashboard: show LangSmith trace URL after execution
5. Error tracking: log failed traces to src/utils/logger.ts

LangSmith config:
- LANGCHAIN_TRACING_V2=true (already set)
- LANGCHAIN_PROJECT=Brunella_Core
- LANGCHAIN_API_KEY=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

After implementation:
- Run agent: brunella agent Developer "test task"
- Check trace at: https://smith.langchain.com/
- npm test (verify tracing doesn't break tests)
```

---

### **Péntek: Automated Testing Pipeline** (20 sessions)

**Cél:** Pre-commit hook + CI/CD pipeline

**Tasks:**
1. `.husky/pre-commit` - automatikus build + test
2. GitHub Actions workflow: `.github/workflows/ci.yml`
3. Test coverage report (Vitest coverage)
4. Failing test auto-fix (DeveloperAgent integration)
5. Slack/Discord notification (opcionális)

**Prompt:**
```
Implement automated testing pipeline with pre-commit hooks and CI/CD.

Requirements:
1. Husky pre-commit: npm run build && npm test
2. GitHub Actions: run tests on every push/PR
3. Vitest coverage report (threshold: 80%)
4. If test fails: DeveloperAgent auto-fix attempt
5. Notification: Discord webhook on test failure (optional)

Files to create:
- .husky/pre-commit
- .github/workflows/ci.yml
- .github/workflows/auto-fix-tests.yml

Husky install:
npm install -D husky && npx husky init

After implementation:
- Test: git commit (should run tests)
- Verify: GitHub Actions run successfully
```

---

### **Szombat-Vasárnap: Documentation & Refactor** (20 sessions)

**Cél:** Kód dokumentáció + függőség cleanup

**Tasks:**
1. JSDoc minden public metódushoz (agents/, utils/)
2. README.md frissítés (új CLI commands)
3. API docs generálás (TypeDoc)
4. Dependency audit: `npm audit fix`
5. Unused imports cleanup (ESLint autofix)

**Prompt:**
```
Complete project documentation and code cleanup.

Requirements:
1. Add JSDoc to all public methods in src/agents/
2. Update README.md with new CLI commands (edge-agent, robot)
3. Generate API docs: npx typedoc --out docs/api src/
4. Run: npm audit fix (security vulnerabilities)
5. ESLint autofix: npx eslint src/ --fix

After implementation:
- Verify docs at: docs/api/index.html
- npm test (ensure no breaking changes)
- Commit: "docs: complete JSDoc and API documentation"
```

---

## 🔧 Jules Használati Sablon

### Új Task Indítás

```markdown
# [Feature/Fix Name]

## Context
[Link to track: conductor/tracks/...]
[Link to related issue/PR]

## Requirements
1. [Requirement 1]
2. [Requirement 2]

## Files to Modify
- src/path/to/file.ts

## DO NOT TOUCH
- package.json, src/agents/types.ts

## Acceptance Criteria
- [ ] npm run build succeeds
- [ ] npm test passes (58/58)
- [ ] New test added: test/feature.test.ts
- [ ] Documentation updated

## Commit Message
feat(scope): brief description

Co-Authored-By: Jules AI <jules@google.com>
```

---

## 📊 Session Tracking

**100 sessions/nap = ~14 session/feature**

| Nap | Feature | Sessions | Státusz |
|-----|---------|----------|---------|
| Hét | Memory Bank | 15 | ⏳ Pending |
| Kedd | Edge Integration | 15 | ⏳ Pending |
| Szer | Robotkéz | 15 | ⏳ Pending |
| Csüt | LangSmith | 15 | ⏳ Pending |
| Pén | Testing Pipeline | 20 | ⏳ Pending |
| Szo-Vas | Docs & Refactor | 20 | ⏳ Pending |

---

## 🚨 Ha Jules Elakad

**Hibaüzenet mentése:**
```bash
# jules_error_YYYYMMDD.log
```

**Következő session:**
```
Previous session failed with error:
[paste error log]

Please:
1. Analyze the error
2. Suggest fix
3. Implement fix
4. Verify with npm test
```

---

## ✅ Session Záró Checklist

- [ ] npm run build (0 error)
- [ ] npm test (58/58 PASS)
- [ ] Git commit with Co-Authored-By
- [ ] Update .ai/claude.md or .ai/FOSZAL.md
- [ ] Push to branch (NOT main!)

---

*Generated: 2026-02-06*
*Jules Dashboard: https://jules.google.com*
