# Specification - Brunella UI & ADK Integration Dashboard

## Overview
A cél az `mcp-brunella-core` Dashboardjának kiterjesztése egy teljes körű vezérlőfelületté. A UI lehetővé teszi az ágensek vizuális tervezését, a központi chatet, az AnythingLLM tudásbázis kezelését, valamint az MCP szerverek és eszközök dinamikus menedzselését.

## Functional Requirements
- **Visual Agent Flow Editor:** Node-alapú vizuális felület az ágens logikák és interakciók tervezéséhez (Agent Factory ADK integráció).
- **Integrated Chat Interface:** Központi felület a Brunella maggal és az ágensekkel való kommunikációhoz (BUAP támogatás).
- **AnythingLLM Management:** Dokumentumfeltöltés, vektoros indexelés és keresési konfigurációk kezelése a UI-ról.
- **MCP Server & Tool Registry:** 
    - Menürendszer az elérhető MCP szerverek, bővítmények és eszközök listázásához.
    - Hibrid aktiválás: Konfiguráció mentése mellett az egyes szerverek egyenkénti indítása/leállítása (Runtime Process Control).
- **Live Operations Log:** Strukturált, valós idejű naplózás az ágens-szerver interakciókról és rendszerműveletekről.

## Non-Functional Requirements
- **Tech Stack Adherence:** React 19, Tailwind CSS 4 és Zustand alapú megvalósítás.
- **Modularitás:** A flow szerkesztő és a chat modul legyen könnyen leválasztható és bővíthető.
- **Valós idejű frissítés:** Socket.io használata a folyamatok állapotának és a naplóknak a követéséhez.

## Acceptance Criteria
- A felhasználó képes egy egyszerű ágens logikát összeállítani a vizuális szerkesztőben.
- A chat interfészen keresztül érkeznek válaszok a Brunella magtól.
- Az AnythingLLM tudásbázis állapota látható és módosítható a felületen.
- Az MCP szerverek listázhatók és egyenként aktiválhatók/deaktiválhatók a UI-ról.
- A rendszerlogok késleltetés nélkül megjelennek a Dashboardon.
