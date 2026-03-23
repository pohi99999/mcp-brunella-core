# Implementációs Terv: Guardrails & Evaluáció
**Track ID:** `guardrails_evaluation_20260323`

---

## Phase 1: Agent Output Schema Validáció

* [ ] **Task 1.1** — `src/agents/schemas/` mappa létrehozása
  - `agentOutput.ts`: AgentResponseSchema, AgentResultSchema (Zod)
  - `toolOutput.ts`: ToolOutputSchema generikus tool válaszokhoz
  - Re-export: `index.ts`

* [ ] **Task 1.2** — `src/agents/middleware/validateOutput.ts`
  - `validateAgentOutput(response, schema)`: Zod parse + StructuredError
  - Logolás: `logWarn` ha validáció fail, de ne crasheljen
  - Opcionális strict mód: `GUARDRAILS_STRICT=true` → error ha fail

* [ ] **Task 1.3** — AgentManager integráció
  - `execute()` után validáció middleware lefuttatása
  - Validáció fail → retry (max 1x) majd StructuredError válasz

* [ ] **Task 1.4** — Tesztek
  - `test/guardrails/schemaValidation.test.ts`
  - Valid/invalid AgentResponse-ok tesztelése

---

## Phase 2: Confidence Scoring Framework

* [ ] **Task 2.1** — `AgentResponse` interface bővítés (`src/agents/types.ts`)
  - `confidence?: number` (0.0-1.0) hozzáadása
  - `metadata?: { executionTimeMs, tokenUsage, sources }` bővítés

* [ ] **Task 2.2** — `src/agents/scoring/confidenceCalculator.ts`
  - `calculateConfidence(task, result)`: heurisztika alapú score
  - Faktorok: válasz hossz, adatok jelenléte, források, hiba státusz
  - Konfigurálható: `CONFIDENCE_THRESHOLD=0.6`

* [ ] **Task 2.3** — BaseAgent integráció
  - `execute()` bridge: automatikus confidence számítás
  - `executeTask()` result-jához hozzáfűzés

* [ ] **Task 2.4** — Low-confidence trigger
  - Ha confidence < threshold → EvaluatorAgent.execute() automatikus hívás
  - Evaluáció eredmény → módosított válasz vagy reject

---

## Phase 3: PII/Secret Redakció

* [ ] **Task 3.1** — `src/security/redactor.ts`
  - PII_PATTERNS: email, telefon (HU+INT), API key, jelszó, bankkártya
  - `redactPII(text)` → `{ redacted, findings }`
  - Replacer: `[REDACTED:email]`, `[REDACTED:api_key]` stb.

* [ ] **Task 3.2** — Redakció middleware
  - `src/agents/middleware/redactOutput.ts`
  - AgentManager pipeline: validáció → scoring → redakció → válasz
  - String típusú data mezők rekurzív szűrése

* [ ] **Task 3.3** — Audit log integráció
  - `src/core/auditLog.ts` bővítés: `logRedaction(agentName, findings)`
  - Retention: 30 nap (meglévő audit retention-nel összhangban)

* [ ] **Task 3.4** — Tesztek
  - `test/guardrails/redactor.test.ts`
  - Különböző PII típusok detekció + redakció

---

## Phase 4: EvaluatorAgent Integration + Dashboard/CLI

* [ ] **Task 4.1** — EvaluatorAgent bővítés
  - Schema validáció + confidence check képesség
  - `evaluateOutput(agentName, task, response)`: kombinált értékelés
  - Eredmény: `{ approved, adjustedConfidence, issues[], suggestions[] }`

* [ ] **Task 4.2** — AgentManager auto-evaluate
  - `registry.json` bővítés: `"requiresEvaluation": true` flag
  - Kritikus agentek (Developer, Orchestrator) auto-evaluate

* [ ] **Task 4.3** — Dashboard panel
  - `src/dashboard/components/dashboard/GuardrailsPanel.tsx`
  - Evaluáció history tábla (agent, task, confidence, approved)
  - Confidence distribution chart (histogram)
  - Redakciós log (legutóbbi PII findings)
  - Navigation regisztráció

* [ ] **Task 4.4** — CLI parancsok
  - `src/cli/commands/evaluate-hu.ts`: brunella evaluate (inquirer menü)
  - `src/cli/commands/guardrails-hu.ts`: brunella guardrails status
  - Magyar nyelv, színes output

* [ ] **Task 4.5** — Végső tesztek + dokumentáció
  - `npm run build && npm test` → 0 hiba
  - README.md frissítés: Guardrails szekció

---

## 🎯 Sikerességi Kritériumok

1. `validateAgentOutput()` fut minden agent válaszon
2. Confidence score jelenik meg minden AgentResponse-ban
3. PII redakció: email `[REDACTED:email]`-re cserélve
4. EvaluatorAgent automatikusan fut ha confidence < 0.6
5. Dashboard GuardrailsPanel működik
6. CLI `brunella evaluate` és `brunella guardrails status` elérhető
7. Összes meglévő teszt PASS
