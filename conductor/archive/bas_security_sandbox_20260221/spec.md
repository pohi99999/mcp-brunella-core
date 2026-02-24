# Specifikáció: BAS Security & Sandbox v1
**Track ID:** `bas_security_sandbox_20260221`
**Státusz:** active ✅
**Prioritás:** HIGH
**Leválasztva:** `bas_core_architecture_v3_20260220` (Phase 3)

---

## 1. Jelenlegi Helyzet (Mi van már kész)

| Komponens | Státusz | Fájl |
|---|---|---|
| Golden Dataset Bridge | ✅ KÉSZ | `src/core/goldenDatasetBridge.ts` |
| autoSaveGoldenSample() hívás | ✅ KÉSZ | `src/agents/AgentManager.ts:632` |
| D1 Adapter (golden_samples tábla) | ✅ KÉSZ | `src/utils/d1Adapter.ts` |
| @e2b/code-interpreter csomag | ✅ TELEPÍTVE | `package.json` |
| E2B Sandbox Manager | ❌ HIÁNYZIK | `src/security/e2b_sandbox_manager.ts` |
| EvaluatorAgent Guardrails | ❌ HIÁNYZIK | `src/agents/EvaluatorAgent.ts` bővítés |

**Ez a track csak a hiányzó részeket implementálja.**

---

## 2. E2B Sandbox Manager

### Miért szükséges?

A `DeveloperAgent` és `DataScientistAgent` jelenleg a **gazdagépen** futtat Python kódot (`PythonShell` subprocess). Ez biztonsági kockázat: egy hibás vagy rosszindulatú kód elérheti a fájlrendszert, a `.env`-t, az adatbázisokat.

### Megoldás

```typescript
// src/security/e2b_sandbox_manager.ts
import { Sandbox } from '@e2b/code-interpreter';

export class E2BSandboxManager {
  async runPython(code: string): Promise<SandboxResult>
  async runNode(code: string): Promise<SandboxResult>
  async destroy(): Promise<void>
}

export interface SandboxResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  success: boolean;
}
```

### Aktiválás

Env változóval vezérelt, nem breaking change:
```env
E2B_API_KEY=...       # E2B fiók API kulcsa
E2B_ENABLED=true      # false = régi PythonShell (default, backward compat)
```

---

## 3. Golden Dataset Bridge Verifikáció

A bridge **már be van kötve**, de nincs teszt rá. A verifikáció célja:

1. Egységteszt: sikeres AgentResponse → `golden_samples` tábla növekszik
2. Egységteszt: `status: 'error'` → nem ment
3. Stats endpoint: `GET /api/golden-dataset/stats` → `{ totalSamples: N, lastSavedAt: "..." }`

---

## 4. EvaluatorAgent Guardrails (LLM-as-Judge)

Az EvaluatorAgent egy **második LLM-hívással** ellenőrzi a fő agent válaszát:

```
AgentResponse
    ↓
EvaluatorAgent.checkHallucination(response)
    ↓
Ollama (qwen2.5-coder:7b) → { confident: bool, flags: string[] }
    ↓
RULE-G1: Forrás nélküli tény-állítás → flag
RULE-G2: Konfidencia < 0.6 → warn
RULE-G3: Hivatkozott URL → ellenőrzi (HTTP HEAD request)
```

**Fontos:** Ez csak egy async "soft check" — nem blokkolja a válasz visszaadását, csak naplózza a flageket és metrikai adatként menti.

---

## 5. Biztonsági Réteg az Architektúrában

```
Kérés → OrchestratorAgent
                ↓
         DeveloperAgent
           ↓         ↓
    [E2B_ENABLED]  [E2B_DISABLED]
    E2BSandbox     PythonShell (legacy)
           ↓
    AgentResponse (success)
           ↓
    autoSaveGoldenSample() [már kész]
           ↓
    EvaluatorAgent.checkHallucination() [async, soft]
```

---

## 6. Függőségek

- `bas_orchestration_chain_20260221` — a Guardrail eredmények a SystemArchitectureWidget Security paneljén jelennek meg (de ez track nem blokkol erre)
- `.env`: `E2B_API_KEY` szükséges a sandbox futáshoz
- Ollama fut lokálisan a Guardrail LLM-as-Judge híváshoz
