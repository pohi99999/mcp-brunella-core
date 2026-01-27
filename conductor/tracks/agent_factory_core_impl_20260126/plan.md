# Implementation Plan - Agent Factory Core Implementation

## Phase 1: Database & Persistence Layer
- [x] Task: Schema Definition
    - [x] Hozd létre az `src/database/agents_schema.sql` fájlt az ügynökök és üzenetek tábláival (Agents, Messages, Tasks).
- [x] Task: Database Manager Implementation
    - [x] Bővítsd a `src/utils/db.ts` (vagy hozz létre újat), hogy kezelje az `agents.db` inicializálását és lekérdezéseit.
- [x] Task: Conductor - User Manual Verification 'Database & Persistence Layer' (Protocol in workflow.md)

## Phase 2: Message Router & Protocol
- [x] Task: Router Implementation
    - [x] Hozd létre a `src/agent_factory/router.ts` modult.
    - [x] Implementáld a `registerAgent`, `routeMessage` és `delegateTask` metódusokat.
    - [x] Készíts validációt a JSON-RPC üzenetekhez a BUAP séma alapján.
- [x] Task: Protocol Types
    - [x] Definiáld a TypeScript interfészeket a BUAP üzenetekhez a `src/types/buap.ts` fájlban.
- [x] Task: Conductor - User Manual Verification 'Message Router & Protocol' (Protocol in workflow.md)

## Phase 3: Agent Supervisor
- [x] Task: Process Manager
    - [x] Hozd létre a `src/agent_factory/supervisor.ts` modult.
    - [x] Implementáld a folyamatok indítását (`spawn`) és a StdIO csatornák kezelését.
    - [x] Kösd össze a Supervisor-t a Router-rel (bejövő StdIO -> Router).
- [x] Task: Lifecycle Management
    - [x] Implementáld a folyamatok figyelését (exit event) és az újraindítási logikát.
- [x] Task: Conductor - User Manual Verification 'Agent Supervisor' (Protocol in workflow.md)

## Phase 4: Python Base Agent & Verification
- [x] Task: Python SDK Skeleton
    - [x] Hozd létre a `src/agent_factory/sdk/python/base_agent.py` fájlt.
    - [x] Implementáld a kapcsolatfelvételt (Handshake) és az üzenetfogadást StdIO-n.
- [x] Task: "Ping-Pong" Verification
    - [x] Hozz létre két egyszerű teszt ügynököt (`ping_agent.py`, `pong_agent.py`).
    - [x] Írj egy integrációs tesztet (`test/agent_factory.test.ts`), ami elindítja a rendszert és ellenőrzi, hogy a két ügynök tud-e kommunikálni.
- [x] Task: Conductor - User Manual Verification 'Python Base Agent & Verification' (Protocol in workflow.md)
