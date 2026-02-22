# RobotkezV2 Comet Upgrade — Specifikáció

**Track:** `robotkez_comet_upgrade_20260222`

---

## Mi a Comet-szint?

A Perplexity Comet böngésző asszisztens képes:
1. **Természetes nyelvet** megérteni (`"Keresd a legolcsóbb RTX 4070-et"`)
2. **Önállóan tervezi** a lépéseket (milyen URL, mit keres, mire kattint)
3. **Végrehajtja** a böngésző akciókat (Playwright)
4. **Ellenőrzi** hogy sikerült-e (screenshot elemzés)
5. **Önjavít** ha nem sikerült (új próba, más selector)
6. **Emlékszik** korábbi tapasztalatokra

**Jelenlegi RobotkezV2 vs Comet:**

| Képesség | Jelenlegi | Comet-szint |
|----------|-----------|-------------|
| Navigáció | ✅ fix URL | ✅ dinamikus |
| Keresés | ✅ basic | ✅ multi-step |
| Önjavítás | ❌ nincs | ✅ 3x retry + critic |
| Vision selector | ❌ fix CSS | ✅ screenshot→GPT-4o |
| Memória | ❌ nincs | ✅ SQLite history |
| CAPTCHA kezelés | ❌ crash | ✅ graceful skip |
| Multi-tab | ❌ 1 tab | ✅ több lap |

---

## Architektúra

```
User input (természetes nyelv)
    ↓
CometOrchestrator (myai/agents/comet/orchestrator.py)
    ↓
TaskPlanner (GPT-4o via GitHub Models)
    → JSON: [{ step, action, target, value }]
    ↓
BrowserActor (Playwright async)
    → screenshot után visszaküld
    ↓
CriticAgent (Gemini Flash vision)
    → { success: bool, error?: str, suggestion?: str }
    ↓
Ha FAIL → újratervez (max 3x)
Ha OK → ActionMemory-ba ment → Result visszaküld
    ↓
CometBrowserAgent.ts (Brunella wrapper)
    → Dashboard frissítés (Socket.IO)
    → Golden Dataset mentés
```

---

## Fájlstruktúra (ÚJ)

```
myai/agents/comet/
├── __init__.py
├── orchestrator.py      ← Fő belépési pont, loop vezérlés
├── planner.py           ← GPT-4o: task → steps JSON
├── actor.py             ← Playwright végrehajtó (browser_worker.py-ra épül)
├── critic.py            ← Gemini vision: screenshot → siker/hiba
└── memory.py            ← SQLite: sikeres akciók tárolása
```

---

## Részletes Komponens Specifikációk

### 1. TaskPlanner (`planner.py`)

```python
class TaskPlanner:
    """GPT-4o via GitHub Models API — feladat lebontó"""

    SYSTEM_PROMPT = """
    Te egy web automatizálási tervező vagy.
    Kapod: természetes nyelv feladatot + aktuális URL-t.
    Adsz: JSON lépéslista-t.

    Lépés típusok:
    - navigate: { action: "navigate", url: "..." }
    - search: { action: "search", selector: "input[name=q]", text: "..." }
    - click: { action: "click", selector: "...", description: "..." }
    - fill: { action: "fill", selector: "...", text: "..." }
    - extract: { action: "extract", selector: "...", key: "..." }
    - screenshot: { action: "screenshot", reason: "ellenőrzés" }
    - wait: { action: "wait", seconds: 2 }

    Ha nem tudod a selectort, add meg description-t, a vision agent majd kitalálja.
    Max 10 lépés. Visszaadás: JSON array csak.
    """

    async def plan(self, task: str, current_url: str = "", memory_hints: list = []) -> list[dict]:
        # GitHub Models API hívás (GITHUB_PAT)
        # Memory hints: "A google.com-on a keresőmező: input[name=q]"
        pass
```

**LLM hívás:**
```python
# GitHub Models - OpenAI compatible endpoint
import openai

client = openai.AsyncOpenAI(
    base_url="https://models.inference.ai.azure.com",
    api_key=os.getenv("GITHUB_PAT")
)

response = await client.chat.completions.create(
    model="gpt-4o",
    messages=[...],
    response_format={"type": "json_object"}
)
```

---

### 2. BrowserActor (`actor.py`)

```python
class BrowserActor:
    """Playwright async — lépések végrehajtója"""

    async def execute_step(self, step: dict, page: Page) -> ActorResult:
        action = step["action"]

        if action == "navigate":
            await page.goto(step["url"])

        elif action == "search":
            await page.fill(step["selector"], step["text"])
            await page.press(step["selector"], "Enter")

        elif action == "click":
            # Ha nincs pontos selector → vision fallback
            if not step.get("selector"):
                selector = await self._vision_selector(page, step["description"])
                step["selector"] = selector
            await page.click(step["selector"])

        elif action == "extract":
            text = await page.inner_text(step["selector"])
            return ActorResult(success=True, extracted={step["key"]: text})

        elif action == "screenshot":
            screenshot = await page.screenshot(full_page=True)
            return ActorResult(success=True, screenshot=screenshot)

        return ActorResult(success=True)

    async def _vision_selector(self, page: Page, description: str) -> str:
        """Screenshot → GPT-4o vision → CSS selector"""
        screenshot_b64 = base64.b64encode(
            await page.screenshot()
        ).decode()
        # GPT-4o: "A képen lévő '...' elemre mi a CSS selector?"
        pass
```

---

### 3. CriticAgent (`critic.py`)

```python
class CriticAgent:
    """Gemini Flash vision — ellenőrző ügynök"""

    CRITIC_PROMPT = """
    Nézd meg a böngésző képernyőképet.
    Feladat volt: {task}
    Utolsó lépés: {last_step}

    Kérdések:
    1. Sikerült a lépés? (igen/nem)
    2. Ha nem, mi a hiba? (ELEMENT_NOT_FOUND / CAPTCHA / TIMEOUT / WRONG_PAGE / OTHER)
    3. Javasolt javítás? (pl. "Próbáld: button.search-btn")

    Válasz JSON: { "success": bool, "error": str|null, "suggestion": str|null }
    """

    async def evaluate(self, screenshot: bytes, task: str, last_step: dict) -> CriticResult:
        # Gemini Flash vision API hívás
        # Visszaad: { success, error, suggestion }
        pass
```

---

### 4. ActionMemory (`memory.py`)

```python
class ActionMemory:
    """SQLite — sikeres akciók memóriája"""

    # Tábla: site_actions
    # Columns: domain, action_type, description, working_selector, success_count, last_used

    async def get_hints(self, domain: str, action_description: str) -> list[str]:
        """Visszaadja az ismert működő selectorokat ehhez a domain+action párhoz"""
        # pl. "google.com + keresőmező → input[name=q] (100x működött)"
        pass

    async def record_success(self, domain: str, step: dict):
        """Sikeres lépés mentése"""
        pass
```

---

### 5. CometOrchestrator (`orchestrator.py`)

```python
class CometOrchestrator:
    """Fő koordinátor — Planner→Actor→Critic loop"""

    MAX_RETRIES = 3

    async def execute(self, task: str) -> CometResult:
        domain = extract_domain(task)
        memory_hints = await self.memory.get_hints(domain, task)

        for attempt in range(self.MAX_RETRIES):
            # 1. Plan
            steps = await self.planner.plan(task, memory_hints=memory_hints)

            # 2. Execute steps
            results = []
            async with async_playwright() as p:
                browser = await p.chromium.launch(headless=True)
                page = await browser.new_page()

                for step in steps:
                    result = await self.actor.execute_step(step, page)

                    # 3. Kritikus lépéseknél screenshot + critic
                    if step.get("critical", False) or result.error:
                        screenshot = await page.screenshot()
                        critic_result = await self.critic.evaluate(
                            screenshot, task, step
                        )

                        if not critic_result.success:
                            # Suggestion alapú újratervezés
                            memory_hints.append(f"Hiba: {critic_result.error}. Javaslat: {critic_result.suggestion}")
                            break  # retry

                    results.append(result)
                    await self.memory.record_success(domain, step)

            if all(r.success for r in results):
                return CometResult(success=True, data=results)

        return CometResult(success=False, error="Max retries exceeded")
```

---

### 6. CometBrowserAgent.ts (Brunella integráció)

```typescript
export class CometBrowserAgent implements IAgent {
  name = 'CometBrowser';
  role = 'Comet-szintű autonóm böngésző ügynök';
  description = 'Természetes nyelvű webfeladatok: keresés, adatkinyerés, form kitöltés, önjavítással';
  capabilities = ['web_search', 'form_fill', 'data_extract', 'self_healing', 'multi_tab'];

  async execute(task: string, context?: unknown): Promise<AgentResponse> {
    setAgentStatus(this.name, 'working', task.slice(0, 60));
    try {
      // Python FastAPI hívás
      const response = await fetch('http://localhost:8000/comet/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ task, context })
      });
      const result = await response.json();
      return { status: result.success ? 'success' : 'error', data: result };
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

---

## Tesztfeladatok (Phase 4 demo)

### Elektromos autók (MIKI projekt):
```
Task: "Keress elektromos autókat mobile.de-n, 10000-20000 EUR árkategóriában,
       kinyerd az első 5 találat: márka, ár, km, évjárat"
```

### Pályázatfigyelés (GrantWatcherAgent-nek):
```
Task: "Nyisd meg a palyazat.gov.hu oldalt, listázd ki az aktuális KKV pályázatokat"
```

### Ingatlan ár (SalesHunterAgent-nek):
```
Task: "Keress Cserszegtomajban eladó telkeket ingatlan.com-on,
       kinyerd az árat és m2-t az első 5 találatnál"
```

---

## LLM Konfiguráció

```env
# .env kiegészítés:
GITHUB_PAT=...           # GPT-4o via GitHub Models (Planner + Vision)
GEMINI_API_KEY=...       # Gemini Flash (Critic — gyors, olcsó)
OLLAMA_MODEL=qwen2.5-coder:7b  # Fallback ha nincs internet

# Comet specifikus:
COMET_MAX_RETRIES=3
COMET_HEADLESS=true
COMET_TIMEOUT=30000      # 30s per step
COMET_MEMORY_DB=data/comet_memory.db
```

---

## FastAPI endpoint (myai/server.py bővítés)

```python
@app.post("/comet/execute")
async def comet_execute(task: CometTask):
    orchestrator = CometOrchestrator()
    result = await orchestrator.execute(task.task)
    return result

@app.get("/comet/memory/{domain}")
async def get_memory(domain: str):
    memory = ActionMemory()
    return await memory.get_hints(domain, "")
```

---

## Különbség a meglévő browser_worker.py-tól

| | `browser_worker.py` | `CometOrchestrator` |
|--|---------------------|---------------------|
| Feladat input | JSON lépéslista (fix) | Természetes nyelv |
| Tervezés | Nincs, kézzel adod meg | GPT-4o automatikus |
| Hibakezelés | Exception → stop | Critic → retry |
| Selector | Fix CSS (eltörik) | Vision-alapú regenerálás |
| Memória | Nincs | SQLite history |
| Kapcsolat | Standalone | Brunella agent rendszerbe integrált |

A `CometOrchestrator` **felhasználja** a meglévő `browser_worker.py` alacsony szintű funkcióit — nem helyettesíti, hanem föléépül rá.
