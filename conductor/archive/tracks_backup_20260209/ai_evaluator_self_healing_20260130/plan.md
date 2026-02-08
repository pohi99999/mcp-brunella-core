# Plan: AI Evaluator & Self-Healing

**Track ID:** `ai_evaluator_self_healing_20260130`
**Cél:** Egy dedikált "Evaluator" ügynök létrehozása, amely periodikusan vagy kérésre ellenőrzi a rendszer integritását, teszteket futtat, és javaslatokat tesz javításra.

## 1. Helyzetkép
- A rendszernek vannak tesztjei (`npm test`) és health check-je (`/api/health`).
- Nincs olyan ágens, ami ezt "értelmezné" és proaktívan jelezné a hibát.
- A "Jules" külső ágens, de szükség van egy belső "Auditorra" is.

## 2. Lépések

- [x] **1. `EvaluatorAgent.ts` létrehozása:**
    - Role: "QA_Lead".
    - Képességek: Tesztfuttatás, Log elemzés, Health check validálás.
    - Implementáció: `IAgent` interface.
- [x] **2. Regisztráció:**
    - `registry.json` bővítése.
    - `AgentManager.ts` (illetve `src/server/registry.ts`) frissítése (dinamikus betöltés vagy manuális import).
- [x] **3. Funkcionalitás:**
    - `execute("audit_system")`: Lefuttatja a health check-et és az `npm test`-et, majd összefoglalót ad.
    - `execute("analyze_logs")`: Megnézi az utolsó 50 log bejegyzést hibákért.
- [x] **4. Verifikáció:**
    - Ágens meghívása CLI-ből vagy Dashboard-ról.

## 3. Kockázatok
- Az `npm test` futtatása az ágensen belül lassú lehet.
- Jogosultsági kérdések (rendszerparancsok futtatása).