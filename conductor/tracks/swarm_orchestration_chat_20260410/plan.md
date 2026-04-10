# Implementációs Terv: Swarm Orchestration Chat (ClawSwarm)

## Phase 1: SwarmManager Alapok (1. nap)
- Hozzuk létre a `src/core/SwarmManager.ts`-t.
- Valósítsuk meg a megosztott kontextus (Shared Context) kezelését.
- Implementáljuk az ügynök-üzenet elosztót (Message Dispatcher).
- **Ügynök:** `architect`, `coder`

## Phase 2: Ügynök Protokoll Frissítés (2. nap)
- Frissítsük a `BaseAgent.ts`-t, hogy felismerje a raj-specifikus instrukciókat és a csoportos chat formátumot.
- Teszteljük az ügynökök közötti "@mentions" alapú hivatkozást.
- **Ügynök:** `coder`, `developer`

## Phase 3: Dashboard & Vizualizáció (3. nap)
- Frissítsük a React UI `AgentGraph` komponensét (`src/dashboard/components/AgentGraph.tsx`).
- Támogassuk a dinamikus, raj-alapú kapcsolatok megjelenítését.
- **Ügynök:** `frontend-specialist`

## Phase 4: EPP v2 CLI & Demo (4. nap)
- Hozzuk létre a `brunella swarm start` CLI parancsot.
- Készítsünk egy demo forgatókönyvet a raj intelligencia bemutatására.
- **Ügynök:** `coder`, `technical_writer`