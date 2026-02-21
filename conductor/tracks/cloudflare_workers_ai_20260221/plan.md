# Plan: Cloudflare Workers AI Integráció

**Track ID:** `cloudflare_workers_ai_20260221`
**Prioritás:** CRITICAL
**Státusz:** ACTIVE
**Progress:** 0%

---

## Miért szükséges?

A Gemini API quota kimerül (Robotkez, EV Hunter, Orchestrator mind használja).
Ollama lokális — ha a gép ki van kapcsolva, semmi nem fut.
**Cloudflare Workers AI: ingyenes inferencia a paid tierben, edge-en, mindig elérhető.**

---

## Phase 1: Workers AI provider — `src/core/llm_client.ts`

### Lépések

1. **Env változók ellenőrzése:**
   ```
   CF_ACCOUNT_ID=dd107933ac970dac857f27cee7a7ff46  (már megvan)
   CF_AI_API_TOKEN=...  (Workers AI scope szükséges)
   ```

2. **`generateCF(model, prompt)` függvény implementálása:**
   ```typescript
   async function generateCF(model: string, prompt: string): Promise<string> {
     const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${model}`;
     const res = await fetch(url, {
       method: 'POST',
       headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
       body: JSON.stringify({ messages: [{ role: 'user', content: prompt }] })
     });
     const data = await res.json();
     return data.result?.response ?? '';
   }
   ```

3. **`generateRouted()` bővítése:**
   - `provider === 'cloudflare'` ág hozzáadása
   - Default provider sorrend: `cloudflare` → `gemini` → `ollama`
   - `CF_AI_ENABLED=true` env flag

4. **Ajánlott modellek listája** (konstansok `llm_client.ts`-ben):
   ```typescript
   export const CF_MODELS = {
     fast: '@cf/meta/llama-3.1-8b-instruct',
     smart: '@cf/meta/llama-3.3-70b-instruct',
     embed: '@cf/baai/bge-small-en-v1.5',
   };
   ```

5. **Teszt:** `test/llm_client.test.ts` — mock fetch, CF response parsing

**Becslés:** ~1.5 óra

---

## Phase 2: Robotkez LLM Planner + EV Hunter átállítás

### Robotkez (`src/utils/llmPlanner.ts`)

```typescript
// generateExecutionPlan() — provider: cloudflare (elsődleges)
const plan = await generateRouted('cloudflare', CF_MODELS.smart, systemPrompt + userTask);
```

### EV Hunter Python (`myai/tasks/ev_hunter.py`)

```python
def get_llm(config: EVConfig):
    if provider == "cloudflare":
        from langchain_community.llms import CloudflareWorkersAI
        return CloudflareWorkersAI(
            account_id=os.getenv("CF_ACCOUNT_ID"),
            api_token=os.getenv("CF_AI_API_TOKEN"),
            model="@cf/meta/llama-3.3-70b-instruct"
        )
```

Vagy egyszerű REST wrapper ha langchain_community nem tartalmazza.

**Becslés:** ~1 óra

---

## Phase 3: Orchestrator + ModelRouter + Dashboard

### ModelRouter (`src/core/modelRouter.ts`)

```typescript
// Routing táblázat bővítése:
{ task: 'planning', provider: 'cloudflare', model: CF_MODELS.smart },
{ task: 'summary', provider: 'cloudflare', model: CF_MODELS.fast },
{ task: 'embedding', provider: 'cloudflare', model: CF_MODELS.embed },
```

### Dashboard státusz widget

- Melyik LLM provider aktív (CF / Gemini / Ollama)
- CF AI quota használat (requests today)

**Becslés:** ~1 óra

---

## Összesített TODO

```
[ ] 1. CF_AI_API_TOKEN megszerzése (Workers AI scope) → .env
[ ] 2. src/core/llm_client.ts — generateCF() implementálás
[ ] 3. test/llm_client.test.ts — CF provider unit teszt
[ ] 4. src/utils/llmPlanner.ts — CF AI használata
[ ] 5. myai/tasks/ev_hunter.py — cloudflare LLM provider
[ ] 6. src/core/modelRouter.ts — CF ágak hozzáadása
[ ] 7. npm test — ALL GREEN
[ ] 8. meta.json — progress: 100, status: completed
```

---

## Kockázatok

| Kockázat | Megoldás |
|----------|----------|
| CF AI token nem Workers AI scope-os | Új token generálás CF dashboard-on |
| llama-3.3-70b lassabb mint Gemini | Gyors feladatokhoz llama-3.1-8b használata |
| Rate limit CF AI-on | Fallback Gemini/Ollama-ra ha 429 jön |
| langchain CF wrapper nem elérhető | Saját REST wrapper (20 sor Python) |
