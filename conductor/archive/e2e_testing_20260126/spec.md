# Specification: End-to-End (E2E) Tesztelési Keretrendszer

## 1. Overview
Ez a track a rendszer komponenseinek integrált tesztelésére fókuszál. A cél annak verifikálása, hogy a fő MCP szerver (Node.js) képes-e kommunikálni a Python alapú eszközökkel (Google Workspace, Scheduler), és a Dashboard (vagy egy szimulált kliens) képes-e ezeket meghívni.

## 2. Goals
- E2E tesztkörnyezet létrehozása.
- Teszt forgatókönyvek (Test Cases) implementálása:
    - **System Health:** Ping és rendszerinformációk.
    - **Python Bridge:** Python eszközök (pl. `automation_status`) elérhetőségének ellenőrzése.
    - **Scheduler:** Feladat ütemezése és listázása (Mockolva vagy valós időzítéssel).
- A tesztek beépítése a CI/CD folyamatba (lokális futtatás scripttel).

## 3. Requirements
- **Framework:** Egy Node.js alapú teszt script (`scripts/e2e_test.js` vagy hasonló), amely MCP kliensként viselkedik.
- **Tools:** `typescript`, `ts-node` (vagy lefordított JS), `@modelcontextprotocol/sdk`.
- **Execution:** A tesztnek el kell indítania a szervert (`npm start` vagy hasonló), várnia a betöltésre, futtatni a teszteket, majd leállítani a szervert.

## 4. Out of Scope
- UI alapú tesztelés (pl. Playwright kattintások a Dashboardon). Ez egy későbbi fázis lehet.
- Külső szolgáltatások (pl. Gmail API) éles hívása (Mockolás vagy "Dry Run" mód preferált az E2E tesztekben a költségek/kvóták miatt, de itt most a *rendszerintegrációt* teszteljük).
