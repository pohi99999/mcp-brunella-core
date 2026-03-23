# Specifikáció: Guardrails & Evaluáció
**Track ID:** `guardrails_evaluation_20260323`
**Státusz:** active | **Prioritás:** CRITICAL
**Assignee:** Copilot + Pohánka Péter

---

## 1. Jelenlegi Helyzet

| Komponens | Státusz | Megjegyzés |
|---|---|---|
| `src/config/schema.ts` | ✅ Zod validáció env vars-ra | Csak konfigurációra, nem agent outputra |
| `src/agents/EvaluatorAgent.ts` | ✅ Hallucination check | LLM-as-judge, URL validáció, confidence 0-1 |
| `src/core/checkpoint.ts` | ✅ State recovery | SQLite WAL, checkpoint save/load |
| **Agent output schema validáció** | ❌ HIÁNYZIK | Nincs Zod schema az AgentResponse-ra |
| **PII/secret redakció** | ❌ HIÁNYZIK | Agent válaszok szűretlenül mennek a kliensnek |
| **Kötelező evaluáció** | ❌ HIÁNYZIK | EvaluatorAgent opcionális, nincs auto-trigger |

## 2. Cél Architektúra

```
Agent.execute(task)
    │
    ▼
[Zod Schema Validáció] ── FAIL → StructuredError + retry
    │ PASS
    ▼
[Confidence Scoring] ── < 0.6 → EvaluatorAgent review
    │ >= 0.6
    ▼
[PII/Secret Redakció] ── redacted fields → Audit Log
    │
    ▼
AgentResponse (validated, scored, sanitized)
```

## 3. Zod Sémák

```typescript
// src/agents/schemas/agentOutput.ts
import { z } from 'zod';

export const AgentResponseSchema = z.object({
  status: z.enum(['success', 'error', 'partial']),
  data: z.unknown().optional(),
  error: z.string().optional(),
  confidence: z.number().min(0).max(1).optional(),
  metadata: z.object({
    agentName: z.string(),
    executionTimeMs: z.number(),
    tokenUsage: z.number().optional(),
    sources: z.array(z.string()).optional(),
  }).optional(),
});

export const AgentResultSchema = z.object({
  success: z.boolean(),
  message: z.string().min(1),
  data: z.unknown().optional(),
  confidence: z.number().min(0).max(1).optional(),
});
```

## 4. PII Redakció Szabályok

```typescript
// src/security/redactor.ts
const PII_PATTERNS = [
  { name: 'email', pattern: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g },
  { name: 'phone_hu', pattern: /(\+36|06)[\s-]?\d{1,2}[\s-]?\d{3}[\s-]?\d{3,4}/g },
  { name: 'api_key', pattern: /(?:sk|pk|api|key|token|secret)[-_]?[a-zA-Z0-9]{20,}/gi },
  { name: 'password', pattern: /(?:password|passwd|pwd)\s*[:=]\s*\S+/gi },
  { name: 'credit_card', pattern: /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g },
];

export function redactPII(text: string): { redacted: string; findings: RedactionFinding[] }
```

## 5. Confidence Scoring

```typescript
// Automatikus confidence számítás BaseAgent-ben
function calculateConfidence(task: string, result: AgentResult): number {
  let score = 0.5; // baseline
  if (result.data) score += 0.15;           // van adat
  if (result.message.length > 50) score += 0.1; // részletes válasz
  if (result.sources?.length) score += 0.15; // van forrás
  if (!result.success) score -= 0.3;         // hiba
  return Math.max(0, Math.min(1, score));
}
```

## 6. Dashboard Integráció

- **Panel:** `src/dashboard/components/dashboard/GuardrailsPanel.tsx`
- **Megjelenítés:** Evaluáció history tábla, confidence distribution chart, redakciós log
- **Navigation:** Regisztráció `navigation.tsx`-ben

## 7. CLI Integráció

```bash
brunella evaluate                    # Interaktív menü: agent kiválasztás + task
brunella evaluate --agent Developer --task "Írj unit teszt-et"
brunella guardrails status           # Redakciós és validációs statisztikák
```

## 8. Sikerességi Kritériumok

- [ ] Zod validáció minden agent outputon (AgentManager middleware)
- [ ] Confidence score 0.0-1.0 minden válaszban
- [ ] PII redakció: email, telefon, API key, jelszó automatikusan szűrve
- [ ] EvaluatorAgent auto-trigger ha confidence < 0.6
- [ ] Dashboard panel: evaluáció history + confidence chart
- [ ] CLI: `brunella evaluate` + `brunella guardrails status`
- [ ] `npm run build && npm test` → 0 hiba
