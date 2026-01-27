# Specification - Brunella CLI Enhancement & Parity

## Overview
A cél a Brunella CLI (`src/cli`) funkcionalitásának jelentős bővítése, hogy elérje a Gemini CLI szintjét, miközben megőrzi saját identitását. Ez magában foglalja a bővítmények (extensions) kezelését, a beépített eszközök (tools) támogatását és egy fejlett interaktív chat felületet.

## Functional Requirements
- **Interactive Chat Interface:**
    - Természetes nyelvű parancsértelmezés (mockolt vagy egyszerű regex alapú kezdetben, később LLM integrációval).
    - Munkamenet történet (history) kezelése.
- **Extension System:**
    - Bővítmények felfedezése, listázása és betöltése (`src/cli/extensions.ts` integráció).
    - Új parancsok hozzáadása bővítményeken keresztül.
- **Built-in Tools:**
    - Fájlrendszer műveletek (listázás, olvasás, írás) biztonságos módon.
    - Rendszerinformációk lekérdezése.
- **Command Line Arguments:**
    - Nem interaktív mód támogatása (pl. `brunella run <script>`, `brunella extension list`).

## Non-Functional Requirements
- **Modularity:** A parancsok és eszközök legyenek leválasztva a magról.
- **UX:** Színes kimenet (chalk), töltőképernyők (ora), és egyértelmű hibaüzenetek.

## Acceptance Criteria
- A felhasználó el tud indítani egy chat felületet a `brunella chat` paranccsal (vagy menüből).
- A felhasználó listázni tudja a telepített bővítményeket.
- A CLI képes alapvető fájlműveletekre beépített eszközként.
