# Specifikáció: Workers AI Modell Paletta Bővítés

**Track ID:** `cf_workers_ai_models_20260323`
**Prioritás:** MEDIUM
**Tulajdonos:** Pohánka Péter
**Létrehozva:** 2026-03-23

---

## 1. Áttekintés

A Workers AI modell kínálatának bővítése a BAS rendszerben. Jelenleg egyetlen modell van konfigurálva, ami nem optimális a különböző feladattípusokhoz.

### Jelenlegi állapot

| Modell | Használat | Korlát |
|--------|-----------|--------|
| `@cf/meta/llama-3.1-8b-instruct` | Minden feladat | Gyenge kódgenerálás, korlátozott kontextus |

### Cél állapot

| Modell | Feladattípus | Erősség |
|--------|-------------|---------|
| `@cf/meta/llama-3.3-70b-instruct-fp8-fast` | Komplex gondolkodás, tervezés | Nagy modell, erős reasoning |
| `@cf/deepseek/deepseek-r1-distill-qwen-32b` | Kódgenerálás, kódelemzés | Kiváló kódminőség |
| `@cf/microsoft/phi-4` | Gyors válaszok, egyszerű feladatok | Alacsony latency, olcsó |
| `@cf/meta/llama-3.1-8b-instruct` | Fallback | Megbízható, jól ismert |

---

## 2. Modell Routing Logika

### 2.1 Feladattípus → Modell leképezés

```typescript
// src/core/modelRouter.ts
export type TaskType =
  | 'code-generation'
  | 'code-review'
  | 'reasoning'
  | 'planning'
  | 'summarization'
  | 'quick-response'
  | 'translation'
  | 'classification';

export const MODEL_ROUTING: Record<TaskType, string> = {
  'code-generation':  '@cf/deepseek/deepseek-r1-distill-qwen-32b',
  'code-review':      '@cf/deepseek/deepseek-r1-distill-qwen-32b',
  'reasoning':        '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
  'planning':         '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
  'summarization':    '@cf/meta/llama-3.1-8b-instruct',
  'quick-response':   '@cf/microsoft/phi-4',
  'translation':      '@cf/microsoft/phi-4',
  'classification':   '@cf/microsoft/phi-4',
};
```

### 2.2 Routing logika a Bifrost Gateway-ben

A `src/core/bifrost.ts` (Bifrost Gateway) felelős a modell kiválasztásért. A Workers AI provider konfigurációját bővíteni kell:

```typescript
// src/core/bifrost.ts bővítés
export class BifrostGateway {
  async routeRequest(request: AIRequest): Promise<AIResponse> {
    const model = this.selectModel(request.taskType, request.options);

    // Workers AI hívás
    const response = await this.env.AI.run(model, {
      messages: request.messages,
      max_tokens: request.maxTokens ?? 2048,
      temperature: request.temperature ?? 0.7,
    });

    return {
      content: response.response,
      model,
      usage: response.usage,
    };
  }

  private selectModel(taskType: TaskType, options?: RouteOptions): string {
    // 1. Explicit modell megadás felülírja a routing-ot
    if (options?.model) return options.model;

    // 2. Feladattípus alapú routing
    const model = MODEL_ROUTING[taskType];
    if (model) return model;

    // 3. Fallback
    return '@cf/meta/llama-3.1-8b-instruct';
  }
}
```

---

## 3. Modell részletek

### 3.1 Llama 3.3 70B (Erős gondolkodás)

- **Azonosító:** `@cf/meta/llama-3.3-70b-instruct-fp8-fast`
- **Paraméterek:** 70 milliárd (FP8 kvantált)
- **Kontextus:** 128K token
- **Erősségek:** Komplex következtetés, többlépéses tervezés, elemzés
- **Használat:** TaskDecomposerAgent, ReviewerAgent, PlannerAgent
- **Latency:** ~2-5 másodperc (magasabb a méret miatt)

### 3.2 DeepSeek R1 Distill Qwen 32B (Kódgenerálás)

- **Azonosító:** `@cf/deepseek/deepseek-r1-distill-qwen-32b`
- **Paraméterek:** 32 milliárd
- **Kontextus:** 64K token
- **Erősségek:** Kódgenerálás, kódelemzés, hibakeresés, refaktorálás
- **Használat:** CoderAgent, DebuggerAgent, RefactorAgent
- **Latency:** ~1-3 másodperc

### 3.3 Phi-4 (Gyors válaszok)

- **Azonosító:** `@cf/microsoft/phi-4`
- **Paraméterek:** ~14 milliárd
- **Kontextus:** 16K token
- **Erősségek:** Alacsony latency, egyszerű feladatok, osztályozás
- **Használat:** ClassifierAgent, TranslatorAgent, gyors kérdés-válasz
- **Latency:** ~0.5-1 másodperc

### 3.4 Llama 3.1 8B (Fallback)

- **Azonosító:** `@cf/meta/llama-3.1-8b-instruct`
- **Paraméterek:** 8 milliárd
- **Kontextus:** 128K token
- **Erősségek:** Megbízható, gyors, alacsony erőforrás igény
- **Használat:** Fallback minden feladattípushoz, összefoglalás
- **Latency:** ~0.3-0.8 másodperc

---

## 4. Workers AI konfiguráció

A `cloudflare/wrangler.jsonc`-ben az AI binding már létezik:

```jsonc
{
  "ai": {
    "binding": "AI"
  }
}
```

Ez az egyetlen binding szükséges — a modell kiválasztás kódszinten történik az `env.AI.run(modelName, ...)` hívásban. Nincs szükség külön binding-ra modellenként.

---

## 5. Dashboard modell választó

A BAS dashboard-on egy modell konfiguráció panel:

- Modell lista a Workers AI-ban elérhető modellekkel
- Feladattípus → modell leképezés szerkesztése
- Tesztelés gomb: mintaprompt futtatás a kiválasztott modellel
- Teljesítmény metrikák modellenként (átlagos latency, token/sec)

### API endpoint

```typescript
GET  /api/models               // Elérhető modellek listája
GET  /api/models/routing       // Jelenlegi routing konfiguráció
PUT  /api/models/routing       // Routing frissítése
POST /api/models/test          // Modell tesztelés mintaprompttal
GET  /api/models/stats         // Modellenkénti teljesítmény statisztikák
```

---

## 6. Teljesítmény benchmark

Minden modellre a következő metrikákat mérjük:

| Metrika | Mértékegység | Mérési módszer |
|---------|-------------|----------------|
| Time to First Token (TTFT) | ms | Első token megérkezési ideje |
| Tokens per Second (TPS) | token/s | Generálási sebesség |
| Minőség (kód) | 0-100 pont | Kódminőség benchmark (HumanEval-szerű) |
| Minőség (reasoning) | 0-100 pont | Gondolkodási feladat benchmark |
| Költség | token/kérés | Workers AI árszámítás alapján |

---

## 7. Kockázatok

- **Modell elérhetőség:** A Workers AI modellek beta-ban lehetnek, elérhetőségük változhat
- **Rate limit:** Workers AI Free tier 10,000 neuron/nap — nagy modellek gyorsabban fogyasztják
- **Minőségbeli eltérések:** A modellek eltérő promptolási technikákat igényelhetnek
- **FP8 kvantálás:** A 70B modell kvantált verziója — minőségromlás lehetséges az FP16-hoz képest

---

## 8. Kapcsolódó fájlok

- `cloudflare/wrangler.jsonc` — AI binding konfiguráció
- `cloudflare/src/index.ts` — Worker AI hívások
- `src/core/bifrost.ts` — Bifrost Gateway modell routing
- `src/core/providers/` — AI provider implementációk
- `src/dashboard/` — Dashboard modell panel
