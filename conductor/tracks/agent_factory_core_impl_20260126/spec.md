# Specification - Agent Factory Core Implementation

## Overview
Ez a track az Agent Factory rendszer magjának megvalósítását célozza meg. A hangsúly a stabil infrastruktúra (Supervisor és Router) kiépítésén van, amely lehetővé teszi az ügynökök életciklus-kezelését és az egymás közötti, felügyelt kommunikációt (A2A) a BUAP protokoll alapján.

## Functional Requirements
- **Agent Supervisor (Node.js):**
    - Ügynök folyamatok (Python/Node) indítása és leállítása.
    - Életciklus figyelés (heartbeat) és automatikus újraindítás.
    - Erőforrás-korlátok alapvető érvényesítése.
- **Message Router (Node.js):**
    - Ügynökök regisztrációjának kezelése (Handshake).
    - Feladatok delegálása (`agent.delegate`) a címzett ügynök felé.
    - Közvetlen üzenetküldés (`agent.message`) biztosítása két ágens között.
    - Üzenetek validálása a BUAP JSON sémák alapján.
- **Persistence Layer (SQLite):**
    - Ügynök metaadatok és állapotok tárolása.
    - Üzenetnaplózás a későbbi auditálhatóság érdekében.
- **Base Agent Adapter (Python):**
    - Egy alap osztály létrehozása, amely implementálja a BUAP protokoll szerinti be- és kimenetet StdIO-n keresztül.

## Non-Functional Requirements
- **Megbízhatóság:** A Supervisor-nak stabilan kell kezelnie a váratlanul leálló ügynök folyamatokat.
- **Teljesítmény:** A Routernek minimális késleltetéssel kell továbbítania az üzeneteket.
- **Egyszerűség:** Ebben a fázisban a közös `.venv` használata a cél a Python függőségekhez.

## Acceptance Criteria
- A Supervisor képes elindítani egy teszt ügynököt és fogadni a regisztrációs kérését.
- Két teszt ügynök képes üzenetet váltani egymással a Routeren keresztül.
- Az ügynökök állapota és a regisztrált képességeik mentésre kerülnek az SQLite adatbázisba.
- A rendszer hiba esetén (pl. egy ügynök leáll) képes automatikusan újraindítani a folyamatot.

## Out of Scope
- Komplex LangGraph vagy AutoGen logikák implementálása (csak egyszerű teszt ügynökök).
- Dashboard integráció (ebben a fázisban a CLI/Log alapú verifikáció elegendő).
- Konténerizáció (Docker).
