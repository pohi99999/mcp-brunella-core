# Specification - Agent Protocol & Factory Architecture

## Overview
Ez a track egy kutatási és tervezési ("Architectural Spike") fázis, amelynek célja a "Brunella Universal Agent Protocol" (BUAP) és az ahhoz kapcsolódó "Agent Factory" szolgáltatás alapjainak lefektetése. A cél egy olyan rendszer tervezése, amely képes különböző keretrendszerek (LangGraph, AutoGen, CrewAI) erősségeit ötvözni egy egységes, biztonságos és felügyelt környezetben, ahol az ügynökök képesek egymással kommunikálni (A2A).

## Functional Requirements
- **Hibrid Ügynök Definíció:** Képesség az ügynökök leírására deklaratív (JSON/YAML) módon, kiegészítve beágyazható Python/JS szkriptekkel.
- **Központi Üzenet Router:** Egy "Post Office" mechanizmus tervezése, amelyen keresztül minden ügynök közötti kommunikáció zajlik, biztosítva a monitorozhatóságot.
- **Folyamat Felügyelő (Supervisor):** Mechanizmus az ügynökök különálló OS folyamatként történő indítására, leállítására és állapotfigyelésére.
- **Protokoll Adaptáció:** Interfészek tervezése, amelyek lehetővé teszik a LangGraph, AutoGen és CrewAI logikák "becsomagolását" a Brunella protokollba.
- **CoPilot Integráció:** UI komponens definíciók támogatása az ügynök manifestben a CoPilotKit stílusú frontend interakciókhoz.

## Non-Functional Requirements
- **Biztonság:** Az ügynökök nem férhetnek hozzá közvetlenül egymás memóriájához vagy a fájlrendszer tiltott részeihez (MCP alapú hozzáférés).
- **Skálázhatóság:** A routernek képesnek kell lennie több tucat ügynök egyidejű kommunikációjának kezelésére.
- **Szabványosítás:** Az A2A kommunikációnak szigorú sémát (JSON Schema) kell követnie.

## Deliverables (Kimenetek)
- `agent_manifest_schema.json`: Az ügynökök leírására szolgáló JSON séma tervezete.
- `a2a_protocol_spec.md`: Az ügynökök közötti kommunikációs protokoll leírása.
- `architecture_diagram.mermaid`: A rendszer magas szintű architektúrájának diagramja.
- `integration_strategy.md`: Elemzés arról, hogyan illeszthetők be a választott keretrendszerek (LangGraph, stb.).

## Out of Scope
- A tényleges "Agent Factory" implementációja (kódolás). Ez a track a tervezésre és a specifikációra fókuszál.
- Éles Docker konténerizáció (ebben a fázisban folyamat alapú megoldást tervezünk).
