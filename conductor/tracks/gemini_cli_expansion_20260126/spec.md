# Specification - Gemini CLI Refinement & Expansion

## Overview
Ez a track a meglévő CLI funkcionalitás teljes értékű Gemini CLI-vé történő bővítését célozza meg. A cél egy olyan hibrid (Node.js/Python) eszköz létrehozása, amely képes kezelni külső MCP szervereket, dinamikus bővítményeket, és rendelkezik saját memória- és kontextuskezeléssel. A könnyebb használhatóság érdekében egy gyökérkönyvtárban elhelyezett indítófájl biztosítja a CLI azonnali elérését.

## Functional Requirements
- **Plugin/Extension Rendszer:** Külső modulok dinamikus betöltése és kezelése.
- **MCP Integráció:** Képesség külső MCP szerverekhez való csatlakozáshoz és saját MCP szerverek on-demand (igény szerinti) kezeléséhez.
- **Automatikus Felfedezés:** A helyi környezetben elérhető eszközök és szerverek automatikus felismerése.
- **Interaktív Felület:** Továbbfejlesztett interaktív menürendszer és REPL mód a könnyebb kezelhetőség érdekében.
- **Memória és Kontextus:** Korábbi interakciók és felhasználói preferenciák perzisztens tárolása és felhasználása.
- **Szerepkör Alapú Jogosultságkezelés:** Különböző hozzáférési szintek (pl. read-only, full-access) biztosítása a biztonságos parancsfuttatáshoz.
- **Gyorsindítás:** Egy `start.bat` fájl a projekt gyökerében, amely automatikusan elindítja a CLI-t a megfelelő környezetben.

## Non-Functional Requirements
- **Hibrid Nyelvi Támogatás:** Zökkenőmentes együttműködés a Node.js és Python alapú eszközök között.
- **Biztonság:** A műveletek végrehajtása a beállított jogosultsági szintnek megfelelően.
- **Skálázhatóság:** Könnyen hozzáadható új képességek és bővítmények.

## Acceptance Criteria
- A CLI képes listázni és csatlakozni elérhető MCP szerverekhez.
- A bővítmények dinamikusan betölthetők és használhatók az interaktív módban.
- A felhasználó választhat különböző jogosultsági szintek között a CLI indításakor.
- A memória funkció tesztelhetően megőrzi az információkat két indítás között.
- A `start.bat` elindítja a CLI interaktív felületét.

## Out of Scope
- Grafikus felhasználói felület (GUI) fejlesztése (ez a Dashboard feladata).
- Külső LLM szolgáltatók implementálása (csak a meglévők használata a CLI-n keresztül).
