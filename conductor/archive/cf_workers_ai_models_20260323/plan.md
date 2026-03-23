# Végrehajtási Terv: Workers AI Modell Paletta Bővítés

**Track ID:** `cf_workers_ai_models_20260323`
**Prioritás:** MEDIUM
**Becsült idő:** 4-6 nap

---

## Fázis 1: Modell elérhetőség tesztelés

- [ ] Workers AI modell katalógus ellenőrzés a CF Dashboard-on
- [ ] Minden célmodell tesztelése wrangler-rel:
  ```bash
  # Llama 3.3 70B
  curl -X POST https://api.cloudflare.com/client/v4/accounts/{ACCOUNT_ID}/ai/run/@cf/meta/llama-3.3-70b-instruct-fp8-fast \
    -H "Authorization: Bearer {API_TOKEN}" \
    -d '{"messages":[{"role":"user","content":"Hello"}]}'

  # DeepSeek R1
  curl -X POST https://api.cloudflare.com/client/v4/accounts/{ACCOUNT_ID}/ai/run/@cf/deepseek/deepseek-r1-distill-qwen-32b \
    -H "Authorization: Bearer {API_TOKEN}" \
    -d '{"messages":[{"role":"user","content":"Write a fibonacci function in TypeScript"}]}'

  # Phi-4
  curl -X POST https://api.cloudflare.com/client/v4/accounts/{ACCOUNT_ID}/ai/run/@cf/microsoft/phi-4 \
    -H "Authorization: Bearer {API_TOKEN}" \
    -d '{"messages":[{"role":"user","content":"Classify: bug or feature?"}]}'
  ```
- [ ] Eredmények dokumentálása: latency, minőség, token limit

## Fázis 2: Bifrost Gateway provider konfiguráció

- [ ] `src/core/modelRouter.ts` létrehozása:
  - [ ] `TaskType` típus definíció
  - [ ] `MODEL_ROUTING` leképezés
  - [ ] `selectModel()` routing logika
- [ ] `src/core/bifrost.ts` bővítése a multi-modell routing-gal
- [ ] Egységteszt: `test/core/modelRouter.test.ts`

## Fázis 3: Modell routing szabályok

- [ ] Feladattípus alapú routing implementáció:
  - [ ] `code-generation` → DeepSeek R1
  - [ ] `reasoning`, `planning` → Llama 3.3 70B
  - [ ] `quick-response`, `classification` → Phi-4
  - [ ] Fallback → Llama 3.1 8B
- [ ] Explicit modell felülírás lehetőség agent konfigurációban
- [ ] Integrációs teszt minden routing útvonalra

## Fázis 4: Dashboard modell választó

- [ ] Worker API endpoint-ok:
  - [ ] `GET /api/models` — elérhető modellek
  - [ ] `GET /api/models/routing` — routing konfiguráció
  - [ ] `PUT /api/models/routing` — routing frissítés
  - [ ] `POST /api/models/test` — modell teszt
- [ ] React komponens: `src/dashboard/components/ModelSelector.tsx`
  - [ ] Modell lista és konfiguráció
  - [ ] Teszt felület mintaprompttal

## Fázis 5: Teljesítmény benchmark

- [ ] Benchmark script létrehozása: `scripts/benchmark-models.ts`
  - [ ] TTFT (Time to First Token) mérés
  - [ ] TPS (Tokens per Second) mérés
  - [ ] Kódminőség teszt (10 db kódgenerálási feladat)
  - [ ] Reasoning teszt (10 db logikai feladat)
- [ ] Eredmények dokumentálása és összehasonlítás
- [ ] Optimális routing finomhangolás a benchmark alapján
- [ ] Track státusz frissítése: `progress: 100`, `status: "done"`

---

## Sikerkritérium

- Legalább 3 Workers AI modell aktívan használatban
- A modell routing logika automatikusan a megfelelő modellt választja feladattípus alapján
- A benchmark eredmények dokumentálva vannak
- A dashboard modell választó panel működik
