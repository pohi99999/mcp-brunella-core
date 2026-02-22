# RobotkezV2 Comet Upgrade — Végrehajtási Terv

**Track:** `robotkez_comet_upgrade_20260222`
**Cél:** RobotkezV2 → Comet-szintű önjavító multi-agent browser
**LLM:** GitHub Copilot Pro / GitHub Models GPT-4o (GITHUB_PAT megvan)

---

## Általános Szabályok

```bash
# Minden fázis előtt/után:
npm run build && npm test   # TypeScript oldal
cd myai && uvicorn server:app --reload --port 8000  # Python FastAPI

# Comet modul tesztelése:
cd myai && python -m pytest agents/comet/tests/ -v

# Teljes integráció teszt:
curl -X POST http://localhost:8000/comet/execute \
  -H "Content-Type: application/json" \
  -d '{"task": "Keress elektromos autókat mobile.de-n"}'
```

---

## PHASE 1 — Foundation: Planner + Actor (~4 óra)

### 1.1 Könyvtárstruktúra létrehozása

```bash
mkdir -p myai/agents/comet/tests
touch myai/agents/comet/__init__.py
touch myai/agents/comet/orchestrator.py
touch myai/agents/comet/planner.py
touch myai/agents/comet/actor.py
touch myai/agents/comet/critic.py
touch myai/agents/comet/memory.py
touch myai/agents/comet/models.py   # Pydantic modellek
```

### 1.2 Pydantic modellek (`models.py`)

**DeveloperAgent feladat:**
```
"Írj Pydantic V2 modelleket a myai/agents/comet/models.py fájlba:
 - BrowserStep: action(str), selector(str|None), url(str|None), text(str|None),
                key(str|None), description(str|None), critical(bool=False)
 - ActorResult: success(bool), extracted(dict={}), screenshot(bytes|None), error(str|None)
 - CriticResult: success(bool), error(str|None), suggestion(str|None)
 - CometResult: success(bool), data(list[ActorResult]), error(str|None), attempts(int)
 - CometTask: task(str), context(dict={})
 Használj from pydantic import BaseModel, Field"
```

### 1.3 TaskPlanner (`planner.py`)

**DeveloperAgent feladat:**
```
"Írj async Python osztályt myai/agents/comet/planner.py-ba:

class TaskPlanner:
  - __init__: OpenAI client init (base_url='https://models.inference.ai.azure.com',
              api_key=os.getenv('GITHUB_PAT'))
  - async plan(task: str, current_url: str='', memory_hints: list[str]=[]) -> list[BrowserStep]
    - GPT-4o hívás JSON mode-ban
    - System prompt: természetes nyelv → BrowserStep lista
    - Ha GITHUB_PAT nincs → Ollama fallback (llm_client.ts mintájára)
    - Return: list[BrowserStep]

Importok: openai, os, json, logging, .models.BrowserStep
Tesztelés: asyncio.run(TaskPlanner().plan('Keress elektromos autót mobile.de-n'))"
```

### 1.4 BrowserActor (`actor.py`)

**DeveloperAgent feladat:**
```
"Írj async Python osztályt myai/agents/comet/actor.py-ba:

class BrowserActor:
  - async execute_steps(steps: list[BrowserStep], page: Page) -> list[ActorResult]
    - Iterál a lépéseken
    - navigate: page.goto(url, wait_until='networkidle')
    - fill: page.fill(selector, text)
    - click: page.click(selector) — ha nincs selector: log warning, skip
    - extract: page.inner_text(selector) → ActorResult.extracted
    - screenshot: page.screenshot(full_page=True) → ActorResult.screenshot
    - wait: asyncio.sleep(seconds)
    - Minden lépés: try/except → ActorResult(success=False, error=str(e)) ha hiba
    - Timeout: 30s per lépés (COMET_TIMEOUT env)

Importok: playwright.async_api, asyncio, os, .models.*
NE importálj browser_worker.py-t, ez önálló"
```

### 1.5 Alap orchestrátor + FastAPI endpoint

**DeveloperAgent feladat:**
```
"Bővítsd a myai/server.py-t:

1. Importáld: from agents.comet.orchestrator import CometOrchestrator
2. Adj hozzá endpointot:

@app.post('/comet/execute')
async def comet_execute(task: CometTask):
    try:
        orch = CometOrchestrator()
        result = await orch.execute(task.task)
        return result.model_dump()
    except Exception as e:
        return {'success': False, 'error': str(e)}

3. myai/agents/comet/orchestrator.py — alap verzió (Critic nélkül):
   - __init__: planner, actor init
   - async execute(task): plan → playwright launch → execute_steps → return result
   - Headless chromium (COMET_HEADLESS=true)"
```

**Tesztelés (Phase 1 végén):**
```bash
cd myai && uvicorn server:app --reload --port 8000 &
curl -X POST http://localhost:8000/comet/execute \
  -d '{"task": "Nyisd meg a google.com-ot és keress: elektromos auto mobile de"}' \
  -H "Content-Type: application/json"
# Elvárt: success=true, screenshot, extracted adat
```

---

## PHASE 2 — Self-Correction: Critic + Retry (~3 óra)

### 2.1 CriticAgent (`critic.py`)

**DeveloperAgent feladat:**
```
"Írj async Python osztályt myai/agents/comet/critic.py-ba:

class CriticAgent:
  - Gemini Flash vision API hívás (google-genai SDK, GEMINI_API_KEY)
  - async evaluate(screenshot: bytes, task: str, last_step: dict) -> CriticResult
    - Screenshot base64 encode
    - Prompt: 'Böngésző képernyőképen: sikerült a következő lépés?
               Feladat: {task}. Lépés: {last_step}.
               JSON válasz: {success: bool, error: str|null, suggestion: str|null}'
    - Ha GEMINI_API_KEY nincs → heurisztikus fallback:
      success=True ha screenshot nem üres
  - Fallback ha nincs API: egyszerű DOM check

Hibatípusok: CAPTCHA, ELEMENT_NOT_FOUND, TIMEOUT, WRONG_PAGE, OTHER"
```

### 2.2 Retry loop az orchestrátorba

**DeveloperAgent feladat:**
```
"Frissítsd a myai/agents/comet/orchestrator.py-t:

MAX_RETRIES = int(os.getenv('COMET_MAX_RETRIES', 3))

async def execute(task: str) -> CometResult:
  memory_hints = []
  for attempt in range(MAX_RETRIES):
    steps = await self.planner.plan(task, memory_hints=memory_hints)
    async with async_playwright() as p:
      browser = await p.chromium.launch(headless=...)
      page = await browser.new_page()
      results = []
      failed = False
      for step in steps:
        result = await self.actor.execute_step(step, page)
        if result.error or step.critical:
          screenshot = await page.screenshot()
          critic = await self.critic.evaluate(screenshot, task, step.model_dump())
          if not critic.success:
            if critic.error == 'CAPTCHA':
              return CometResult(success=False, error='CAPTCHA blocker', attempts=attempt+1)
            memory_hints.append(f'Hiba: {critic.error}. Javaslat: {critic.suggestion}')
            failed = True
            break
        results.append(result)
      if not failed:
        return CometResult(success=True, data=results, attempts=attempt+1)
  return CometResult(success=False, error='Max retries reached', attempts=MAX_RETRIES)"
```

### 2.3 Vision selector regenerálás

**DeveloperAgent feladat:**
```
"Bővítsd a myai/agents/comet/actor.py BrowserActor-t:

async def _vision_selector(self, page: Page, description: str) -> str | None:
  '''Screenshot → GPT-4o vision → CSS selector'''
  screenshot_b64 = base64.b64encode(await page.screenshot()).decode()
  prompt = f'A böngésző képernyőképen mi a CSS selector ehhez: {description}? Csak a selectort add vissza.'
  # OpenAI vision hívás (GITHUB_PAT / GitHub Models)
  # Ha nincs → None (skip step)
  pass

# execute_step-ben: ha nincs selector → _vision_selector hívás
```

**Tesztelés:**
```bash
# CAPTCHA teszt:
curl -X POST http://localhost:8000/comet/execute \
  -d '{"task": "Keress google.com-on: test query"}' \
  -H "Content-Type: application/json"
# Elvárt: 3 próbálkozás logban, vagy sikeres eredmény
```

---

## PHASE 3 — Memory + Cross-Tab (~3 óra)

### 3.1 ActionMemory (`memory.py`)

**DeveloperAgent feladat:**
```
"Írj SQLite-alapú memória osztályt myai/agents/comet/memory.py-ba:

DB_PATH = os.getenv('COMET_MEMORY_DB', 'data/comet_memory.db')

class ActionMemory:
  - __init__: SQLite init, CREATE TABLE IF NOT EXISTS site_actions(
              id, domain, action_description, working_selector,
              success_count, last_used)
  - async get_hints(domain: str, action_desc: str) -> list[str]
    - Query: WHERE domain=? AND success_count > 2, ORDER BY success_count DESC LIMIT 3
    - Return: ['A google.com-on a keresőmező selector: input[name=q] (45x sikeres)']
  - async record_success(domain: str, step: dict)
    - Upsert: ha létezik → success_count+1, last_used=now
    - Ha nincs → INSERT
  - async clear_old(days: int = 30)
    - DELETE WHERE last_used < now-30d"
```

### 3.2 Memory integráció az orchestrátorba

**DeveloperAgent feladat:**
```
"Frissítsd az orchestrator.py-t memory-val:
  - __init__-ben: self.memory = ActionMemory() (await self.memory.init())
  - Plan előtt: hints = await self.memory.get_hints(domain, task)
  - Sikeres lépés után: await self.memory.record_success(domain, step)
  - domain kinyerés: urllib.parse.urlparse(url).netloc"
```

### 3.3 Multi-tab kezelés

**DeveloperAgent feladat:**
```
"Bővítsd a BrowserActor-t multi-tab kezeléssel:
  - BrowserStep: adj hozzá tab_index: int = 0 mezőt
  - execute_steps: tartsunk pages = [page] listát
  - Ha step.tab_index >= len(pages): új tab nyitás context.new_page()
  - Ha tab_index == -1: page = await context.new_page() (új tab)
  - Context session megtartás: browser.new_context(
      storage_state='data/comet_session.json' ha létezik)"
```

---

## PHASE 4 — Brunella integráció + Demo (~2 óra)

### 4.1 CometBrowserAgent.ts (TypeScript wrapper)

**Fájl:** `src/agents/CometBrowserAgent.ts`

```typescript
import { BaseAgent } from './BaseAgent.js';
import { AgentResponse } from './types.js';
import { logInfo, logError, setAgentStatus } from '../utils/logger.js';

export class CometBrowserAgent extends BaseAgent {
  name = 'CometBrowser';
  role = 'Comet-szintű autonóm böngésző ügynök';
  description = 'Természetes nyelvű webfeladatok önjavítással: keresés, kinyerés, form kitöltés';
  capabilities = ['web_search', 'data_extract', 'form_fill', 'self_healing', 'multi_tab'];

  async execute(task: string, context?: unknown): Promise<AgentResponse> {
    setAgentStatus(this.name, 'working', task.slice(0, 60));
    try {
      const response = await fetch('http://localhost:8000/comet/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ task, context })
      });
      if (!response.ok) throw new Error(`FastAPI error: ${response.status}`);
      const result = await response.json();
      logInfo(this.name, `Comet done: success=${result.success}, attempts=${result.attempts}`);
      return {
        status: result.success ? 'success' : 'error',
        data: result,
        error: result.error
      };
    } catch (e: unknown) {
      const error = e instanceof Error ? e.message : String(e);
      logError(this.name, error);
      return { status: 'error', error };
    } finally {
      setAgentStatus(this.name, 'idle');
    }
  }
}
```

**Regisztráció** (`registry.json`-ba):
```json
{
  "name": "CometBrowser",
  "module": "./agents/CometBrowserAgent.js",
  "class": "CometBrowserAgent",
  "triggers": ["browse", "keresd", "nyisd meg", "tölts ki", "scrape", "autó kereső", "ingatlan kereső"],
  "priority": 2
}
```

### 4.2 FastAPI memory endpoint

```python
@app.get("/comet/memory/{domain}")
async def get_memory(domain: str):
    memory = ActionMemory()
    await memory.init()
    hints = await memory.get_hints(domain, "")
    return {"domain": domain, "hints": hints}

@app.delete("/comet/memory")
async def clear_memory():
    memory = ActionMemory()
    await memory.init()
    await memory.clear_old(days=0)  # Teljes törlés
    return {"cleared": True}
```

### 4.3 Demo futtatás (MIKI elektromos autó projekt)

```bash
# 1. Brunella backend indítás
npm run dev &
cd myai && uvicorn server:app --reload --port 8000 &

# 2. Demo task
curl -X POST http://localhost:3000/api/agents/CometBrowser/execute \
  -H "Content-Type: application/json" \
  -d '{"task": "Keress elektromos autókat mobile.de-n, 10000-20000 EUR, kinyerd az első 5 találat adatait"}'

# 3. Elvárt output:
{
  "status": "success",
  "data": {
    "success": true,
    "attempts": 1,
    "data": [
      {"action": "navigate", "success": true},
      {"action": "search", "success": true},
      {"action": "extract", "success": true, "extracted": {
        "results": ["Tesla Model 3, 18500 EUR, 45000km, 2021", ...]
      }}
    ]
  }
}
```

---

## Tesztek (`myai/agents/comet/tests/`)

```python
# test_planner.py
async def test_plan_elektromos_auto():
    planner = TaskPlanner()
    steps = await planner.plan("Keress elektromos autót mobile.de-n")
    assert len(steps) > 0
    assert any(s.action == "navigate" for s in steps)
    assert any(s.action in ["search", "fill"] for s in steps)

# test_critic.py
async def test_critic_success():
    critic = CriticAgent()
    # Mock screenshot
    result = await critic.evaluate(b"fake_screenshot", "keresés", {"action": "search"})
    assert isinstance(result.success, bool)

# test_memory.py
async def test_memory_roundtrip():
    memory = ActionMemory(db_path=":memory:")
    await memory.init()
    await memory.record_success("google.com", {"action": "search", "selector": "input[name=q]", "description": "keresőmező"})
    hints = await memory.get_hints("google.com", "keresőmező")
    assert len(hints) > 0
```

---

## Prioritási Sorrend

1. **Phase 1** (alap loop) → Ez ad legtöbb értéket azonnal
2. **Phase 2.1** (CriticAgent) → CAPTCHA és hibakezelés
3. **Phase 3.1** (Memory) → Tanulás, ne kelljen mindig újra selector
4. **Phase 2.3** (Vision selector) → Legbonyolultabb, utoljára
5. **Phase 4** (Brunella integráció) → Csak ha 1-3 stabil

---

## Git Strategy

```bash
git checkout -b feat/comet-browser-agent
# Commit-ok fázisonként:
git commit -m "feat(comet): Phase 1 - Planner + Actor foundation"
git commit -m "feat(comet): Phase 2 - Critic + self-healing retry"
git commit -m "feat(comet): Phase 3 - ActionMemory + cross-tab"
git commit -m "feat(comet): Phase 4 - Brunella integration + demo"
```

---

## Conductor Prompt (ProjectConductorAgent-nek)

```
"Kezdd a robotkez_comet_upgrade_20260222 track Phase 1.2-vel.
 Feladat: Hozd létre a myai/agents/comet/models.py fájlt a spec.md 1.2 pontja szerint.
 Majd hívd meg a DeveloperAgent-et a planner.py megírásához (1.3 pont).
 Minden lépés után: npm run build && pytest myai/agents/comet/tests/ -v
 Ha hiba → javítsd, ne lépj tovább amíg nem PASS."
```
