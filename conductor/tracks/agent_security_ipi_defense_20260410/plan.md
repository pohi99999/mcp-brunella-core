# Implementációs Terv: Agent Security Sandbox (IPI Defense)

## Phase 1: llm_client.ts Védelmi Réteg (1. nap)
- Frissítsük a `src/core/llm_client.ts`-t. Implementáljuk a külső adatok és a rendszer promptok szigorúbb elválasztását (pl. egyértelmű XML tag-ek `<external_data>`).
- Implementáljunk egy "Prompt Armor" előszűrő middleware-t, ami gyanús kulcsszavakat keres a letöltött nyers adatokban (pl. "ignore previous instructions").
- **Ügynök:** `security_engineer`, `coder`

## Phase 2: Security Benchmark Kialakítása (2. nap)
- Töltsünk le / generáljunk egy IPI teszt halmazt (`agent-security-sandbox` mintájára).
- Hozzuk létre / frissítsük a `Security Auditor Agent`-et (vagy egy scriptet) ezen tesztek automatizált futtatásához.
- **Ügynök:** `tester`, `security_engineer`

## Phase 3: Cloudflare Edge Integráció (3. nap)
- A `bas-cloudflare-orchestrator` kapjon beállításokat az AI Gateway tartalom-szűrő képességeinek (ha elérhető) aktiválására.
- **Ügynök:** `devops_engineer`, `coder`

## Phase 4: EPP v2 Dashboard & CLI (4. nap)
- Hozzuk létre a `brunella security audit` CLI parancsot (`src/cli/commands/security-hu.ts`).
- Bővítsük a Mission Control felületet a Security Audit vizualizálásával.
- **Ügynök:** `frontend-specialist`, `coder`