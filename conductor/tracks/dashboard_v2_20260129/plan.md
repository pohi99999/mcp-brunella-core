# Implementation Plan - Dashboard v2

## Feladatok (Tasks)

### [ ] Task 1: Backend API Bővítése (Socket.IO)
- **Cél:** A \src/server/web.ts\ felkészítése az adatok streamelésére.
- **Adatok:** Agent logs, System metrics, Tools list.

### [ ] Task 2: Dashboard Alapok Ellenőrzése és Helyreállítása
- **Cél:** Ellenőrizni, hogy a \src/dashboard\ fájljai megvannak-e a sync után. Ha kell, újraépíteni a Vite projektet.

### [ ] Task 3: Komponensek Építése (React)
- **Monitor:** \SystemMonitor.tsx\ (CPU/RAM grafikon).
- **Agents:** \AgentControl.tsx\ (Indítás/Leállítás/Logok).
- **Tools:** \ToolsBrowser.tsx\ (Kereshető lista).

### [ ] Task 4: Integráció és Build
- **Cél:** A frontend összekötése a backenden futó Socket.IO-val.
- **Kimenet:** Működő Dashboard a 3000-es porton.
