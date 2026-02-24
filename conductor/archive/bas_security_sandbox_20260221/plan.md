# Implementációs Terv: BAS Security & Sandbox v1
**Track ID:** `bas_security_sandbox_20260221`

> ⚠️ Előfeltétel ellenőrzés indulás előtt:
> - `src/core/goldenDatasetBridge.ts` létezik ✅
> - `src/agents/AgentManager.ts` 632. sor: `autoSaveGoldenSample()` hívás ✅
> - `@e2b/code-interpreter` a package.json-ban ✅
> - **Ezeket NE írd újra!**

---

## Phase 1: E2B Sandbox Manager

* [ ] **Task 1.1** — `src/security/` mappa létrehozása + `e2b_sandbox_manager.ts`
  ```typescript
  import { Sandbox } from '@e2b/code-interpreter';
  export class E2BSandboxManager {
    async runPython(code: string, timeoutMs = 30000): Promise<SandboxResult>
    async runNode(code: string, timeoutMs = 30000): Promise<SandboxResult>
    private async destroy(): Promise<void>  // mindig meghívódik finally-ban
  }
  export interface SandboxResult {
    stdout: string; stderr: string; exitCode: number; success: boolean;
  }
  ```
  - `E2B_API_KEY` env változóból indul
  - Timeout kezelés: ha 30s-on belül nem végez → `exitCode: 124`, sandbox kill
  - `logInfo('E2BSandbox', ...)` minden futásnál, `logError` hibánál

* [ ] **Task 1.2** — `src/utils/pythonShell.ts` bővítése: ha `process.env.E2B_ENABLED === 'true'`, az `E2BSandboxManager.runPython()`-t hívja a subprocess helyett
  - Backward compatible: `E2B_ENABLED` hiányában a régi logika fut

* [ ] **Task 1.3** — Teszt: `test/e2bSandbox.test.ts`
  - Mock `@e2b/code-interpreter` (ne hívjon valódi API-t tesztben)
  - `runPython('print("hello")')` → `{ stdout: 'hello\n', exitCode: 0, success: true }`
  - Timeout szimuláció → `{ exitCode: 124, success: false }`

* [ ] **Task 1.4** — `.env.example` és `CLAUDE.md` frissítése: `E2B_API_KEY` és `E2B_ENABLED` dokumentálása

---

## Phase 2: Golden Dataset Bridge Verifikáció

* [ ] **Task 2.1** — Ellenőrizd az `AgentManager.ts` 628-634. sor logikáját:
  - Ha `CLOUDFLARE_WORKER_URL` + `CEAN_API_KEY` hiányzik, a `getD1Adapter()` null-t ad vissza — ez elfogadható (silent skip)
  - Ha van config, tényleg ment-e a `golden_samples` D1 táblába?

* [ ] **Task 2.2** — Teszt: `test/goldenDataset.test.ts`
  - Mock D1Adapter-rel: sikeres agent futás → `insertGoldenSample()` hívódik
  - `status: 'error'` esetén → NEM hívódik
  - Quality gate: rövid (<10 karakter) prompt → NEM ment (RULE-GD2)

* [ ] **Task 2.3** — Stats endpoint: `GET /api/golden-dataset/stats` hozzáadása `src/server/routes/enterprise.ts`-be
  ```typescript
  // Response: { totalSamples: number, lastSavedAt: string | null, topAgents: { name, count }[] }
  ```

---

## Phase 3: EvaluatorAgent Guardrails

* [ ] **Task 3.1** — `EvaluatorAgent.ts` bővítése: `checkHallucination(response: AgentResponse): Promise<GuardrailResult>`
  ```typescript
  interface GuardrailResult {
    passed: boolean;
    flags: ('no_source' | 'low_confidence' | 'unverified_url')[];
    confidence: number;  // 0.0 - 1.0
  }
  ```
  - LLM-as-Judge: Ollama `qwen2.5-coder:7b` hívás, JSON mód
  - Prompt template: `src/agents/prompts/guardrail_judge.txt`

* [ ] **Task 3.2** — Guardrail szabályok implementálása:
  - `RULE-G1`: Válasz tartalmaz tény-állítást forrás nélkül → `no_source` flag
  - `RULE-G2`: LLM-judge confidence < 0.6 → `low_confidence` flag + `logWarn`
  - `RULE-G3`: Hivatkozott URL → HTTP HEAD request, 4xx/5xx → `unverified_url` flag

* [ ] **Task 3.3** — `AgentManager.ts` bővítése: ha `GUARDRAILS_ENABLED=true`, sikeres agent futás után async `EvaluatorAgent.checkHallucination()` fut (nem blokkolja a választ, csak metrikát ír)

* [ ] **Task 3.4** — Teszt: `test/guardrails.test.ts`
  - Mock Ollama: confidence=0.4 → `low_confidence` flag
  - Mock HTTP HEAD: URL 404 → `unverified_url` flag

* [ ] **Task 3.5** — `npm run test:full` — 0 hiba, minden teszt ZÖLD

---

## 🛡️ Sikerességi Kritériumok

- `E2B_ENABLED=true` esetén a `DeveloperAgent` Python kódja sandbox-ban fut, nem a gazdagépen
- `E2B_ENABLED=false` esetén a régi viselkedés változatlan (backward compat)
- Sikeres agent futás után `GET /api/golden-dataset/stats` növekvő `totalSamples` értéket mutat
- EvaluatorAgent képes jelölni az alacsony konfidenciájú válaszokat
- `npm run build` → 0 hiba
- `npm test` → minden PASS
