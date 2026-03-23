# Implementációs Terv: Swarm Intelligence v2
**Track ID:** `swarm_intelligence_v2_20260323`

---

## Phase 1: Colony Persistence

* [ ] **Task 1.1** — `src/core/swarm/colonyPersistence.ts`
  - SQLite `colony_checkpoints` tábla (schema: spec.md)
  - `initPersistence()`: tábla létrehozás
  - `saveCheckpoint(colony)`: állapot snapshot JSON-ként
  - `restoreCheckpoint(colonyId)`: legutóbbi checkpoint visszaállítás

* [ ] **Task 1.2** — Auto-checkpoint integration
  - ColonyManager: minden N-edik feladat után automatikus mentés
  - `colonyManager.onTaskComplete()` → checkpoint ha szükséges
  - Config: `swarm.checkpointInterval` (default: 5 task)

* [ ] **Task 1.3** — Tesztek: `test/swarm/colonyPersistence.test.ts`
  - Save + restore round-trip
  - Multiple checkpoints: legutóbbi visszaállítás
  - Corrupt checkpoint → graceful error

## Phase 2: Weighted Voting & Negotiation

* [ ] **Task 2.1** — `src/core/swarm/votingProtocol.ts`
  - `WeightedVote`: agent confidence × experience × recentSuccess
  - `conductVoting(colony, question, options)`: szavazás lebonyolítás
  - Eredmény: winner, totalWeight, consensus (>70%)

* [ ] **Task 2.2** — NegotiationProtocol
  - `negotiate(colony, question, maxRounds)`: agent-ek érveket cserélnek
  - Round 1: szavazás → ha nincs consensus → Round 2: érvek
  - Max 3 kör, utána leader dönt (legmagasabb weight)

* [ ] **Task 2.3** — collectiveMind.ts integráció
  - Meglévő GroupDecision → weighted voting delegálás
  - SharedKnowledge update szavazási eredményekkel

## Phase 3: Dynamic Resizing & Recovery

* [ ] **Task 3.1** — `src/core/swarm/dynamicResizer.ts`
  - `monitorLoad(colony)`: queue/agent ratio kalkuláció
  - Auto-scale up: queue > agents×3 → addAgent()
  - Auto-scale down: queue < agents×0.5 → removeAgent()
  - Min/max limit: 2-10 (konfigurálható)

* [ ] **Task 3.2** — Failure detection & recovery
  - `detectFailedAgents(colony)`: heartbeat timeout → halott
  - `respawnAgent(agent, checkpoint)`: újraindítás checkpoint-ból
  - Max retry: 3 respawn kísérlet, utána kizárás

## Phase 4: Dashboard + CLI

* [ ] **Task 4.1** — Dashboard: `SwarmPanel.tsx`
  - Colony map: agent-ek, státuszok, task queue
  - Voting log: szavazási előzmények
  - Health monitoring: agent heartbeat, failure count

* [ ] **Task 4.2** — CLI: `src/cli/commands/swarm-hu.ts`
  - `brunella swarm create <task>`: colony indítás
  - `brunella swarm status`: futó colony-k
  - `brunella swarm scale <colonyId> <count>`: manuális méretezés

* [ ] **Task 4.3** — Tesztek + dokumentáció

---

## 🎯 Sikerességi Kritériumok

1. Colony checkpoint mentés: crash → restart → folytatás
2. Weighted voting: tapasztalat-alapú súlyozás
3. Negotiation: 3 körben consensus vagy leader dönt
4. Auto-scale: terhelés → agent ±
5. Failure recovery: 3 respawn kísérlet
6. Dashboard SwarmPanel + CLI `brunella swarm`
7. Összes teszt PASS
