# Implementációs Terv: Agent Instability Chaos Testing

## Phase 1: Chaos Middleware Kialakítása (1. nap)
- Hozzuk létre a `src/utils/chaos_injector.ts`-t.
- Implementáljunk véletlenszerű hiba-generátorokat (Timeout, Rate Limit, Data Corruption).
- Integráljuk a `src/server/registry.ts`-be, mint egy opcionális wrappert, amely csak a `CHAOS_MODE=true` környezeti változó esetén aktív.
- **Ügynök:** `coder` / `developer`

## Phase 2: EvaluatorAgent & Phoenix Protocol Frissítése (2. nap)
- Bővítsük a `Phoenix Protocol` auto-recovery logikáját a specifikus hibakódok (pl. rate limits) proaktív kezelésével.
- Az `EvaluatorAgent` kapjon egy `/run-chaos-suite` parancsot a szisztematikus teszteléshez.
- **Ügynök:** `coder` / `evaluator`

## Phase 3: EPP v2 Integráció (3. nap)
- **Dashboard:** A `Mission Control` felület kapjon egy "Chaos Mode" toggle-t és valós idejű hiba-injektálás vizualizációt.
- **CLI:** A `src/cli/commands/chaos-hu.ts` elkészítése inquirer.js alapú menüvel.
- **Ügynök:** `frontend-specialist`, `coder`

## Phase 4: Tesztelés és Validáció (4. nap)
- E2E és integrációs tesztek futtatása a `Chaos Mode` bekapcsolásával.
- `vitest` tesztek írása a `chaos_injector.ts`-hez.
- **Ügynök:** `tester`