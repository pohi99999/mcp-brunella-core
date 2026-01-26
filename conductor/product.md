# Product Definition - MCP Brunella Core

## Vision
Az MCP Brunella Core a Brunella ökoszisztéma központi "idegrendszere", amely biztonságos, szabványosított és felügyelt interfészt (Model Context Protocol) biztosít az AI ágensek számára a fizikai és digitális erőforrások eléréséhez.

## Target Users
- **Fejlesztők:** Akik új ágenseket és eszközöket integrálnak a rendszerbe.
- **AI Ágensek:** Amelyeknek strukturált és biztonságos hozzáférésre van szükségük a környezetükhöz.
- **Végfelhasználók:** Akik felügyelik a rendszer működését a Dashboardon keresztül.

## Core Goals
1. **Biztonság (Security First):** Minden erőforrás-hozzáférés (fájlrendszer, parancsfuttatás) szigorúan korlátozott és naplózott.
2. **Interoperabilitás:** Az MCP szabvány révén különböző LLM-ek és ágens-keretrendszerek egységes kiszolgálása.
3. **Átláthatóság:** Valós idejű monitorozás és naplózás a rendszer minden műveletéről.

## Key Features
- **Secure Sandbox:** Fájlműveletek, Python/Node.js kód futtatása és rendszerparancsok kezelése védett környezetben.
- **Knowledge Engine:** Integráció LanceDB-vel és AnythingLLM-mel a releváns kontextus kinyeréséhez.
- **Management Dashboard:** React alapú felület a szerver állapotának, az ágenseknek és a folyamatoknak a követésére.
- **Agent Registry:** Strukturált metaadat-kezelés az elérhető ágensek és képességeik listázásához.