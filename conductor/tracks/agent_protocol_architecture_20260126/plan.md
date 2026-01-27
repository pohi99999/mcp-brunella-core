# Implementation Plan - Agent Protocol & Factory Architecture

## Phase 1: Alapok és Sémák (Foundation & Schemas)
- [x] Task: Agent Manifest Schema Tervezése
    - [x] Hozd létre az `agent_manifest_schema.json` vázlatát. Definiáld a metaadatokat, modellt, promptot, eszközöket és UI komponenseket.
    - [x] Integráld a hibrid logikát (script hivatkozások) a sémába.
- [x] Task: A2A Protokoll Specifikáció
    - [x] Írd meg az `a2a_protocol_spec.md` dokumentumot. Definiáld az üzenettípusokat (Request, Response, Event) és a Handshake folyamatot.
- [x] Task: Conductor - User Manual Verification 'Alapok és Sémák' (Protocol in workflow.md)

## Phase 2: Architektúra és Futtatás (Architecture & Runtime)
- [x] Task: Rendszer Architektúra Tervezése
    - [x] Készítsd el az `architecture_diagram.mermaid` diagramot, bemutatva a Supervisor, Router és az Ügynökök kapcsolatát.
    - [x] Dokumentáld a folyamat-alapú (Process-based) futtatókörnyezet működését (indítás, életciklus).
- [x] Task: Integrációs Stratégia
    - [x] Írd meg az `integration_strategy.md` elemzést. Részletezd, hogyan "csomagoljuk be" a LangGraph, AutoGen és CrewAI ágenseket MCP szerverekként.
    - [x] Tervezd meg a CoPilotKit integrációs pontokat a frontend és az ágens között.
- [x] Task: Conductor - User Manual Verification 'Architektúra és Futtatás' (Protocol in workflow.md)

## Phase 3: Validáció és Összegzés (Validation & Review)
- [x] Task: Prototípus Tervezése (Papíron)
    - [x] Vázolj fel egy konkrét példát ("Junior Python Developer Agent") az új sémák és protokollok alapján, bemutatva a teljes működést.
- [x] Task: Dokumentáció Frissítése
    - [x] Frissítsd a `mag.md`-t és a `terv.md`-t az új architekturális irányokkal.
- [x] Task: Conductor - User Manual Verification 'Validáció és Összegzés' (Protocol in workflow.md)
