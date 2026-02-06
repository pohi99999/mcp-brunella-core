# Fejlesztési Terv: Mission Control Dashboard & Remote Access (2026-02-02)

Ez a track a **Mission Control Dashboard** UI fejlesztését, a valós idejű ügynök-monitorozást, a Cloudflare Tunnel távoli elérését és a fejlesztői környezet stabilizálását dokumentálja.

---

## 1. Mission Control Dashboard UI

### 1.1 Glass Box Komponensek
- **AgentStatusCard.tsx:** Egyedi ügynök kártya – név, státusz (Idle/Working/Error), task leírás. Színes pulzáló pont aktív állapotban. Glass box design: `bg-zinc-950/60 backdrop-blur-sm`.
- **TerminalLog.tsx:** Terminál stílus (fekete háttér, zöld/fehér/cián monospace). Log típusok: command (zöld), error (piros), info (cián), output (fehér). Forrás megjelenítés: `[source] message`.
- **MissionControlLayout.tsx:** Header (Brunella logó, "Mission Control" badge, Live indikátor, CPU/RAM). Sidebar: Dashboard, Files, Settings. Bento grid: AgentStatusCard lista + TerminalLog. Right panel: Memory Context.
- **App.tsx:** Egyszerűsítve – csak MissionControlLayout + Toaster.

### 1.2 UI Alapok
- shadcn-ui (New York, neutral base) már inicializálva
- Komponensek: Card, Button, Badge, Progress, Separator, ScrollArea, Tabs, Avatar, Alert, Table
- Csomagok: lucide-react, recharts, framer-motion, clsx, tailwind-merge

---

## 2. Backend–Frontend Valós Idejű Kapcsolat (Socket.IO)

### 2.1 Backend (src/server/)
- **SocketService.ts (Singleton):** `init(io)`, `broadcastLog(message, type, source?)`, `updateAgentStatus(agentName, status, taskDescription?)`
- **web.ts:** `socketService.init(io)` szerver induláskor. CORS: localhost:5173, 3000, *
- **Debug API-k:** `POST /api/debug/broadcast-log`, `POST /api/debug/agent-status`
- Port hiba: EADDRINUSE esetén tiszta hibaüzenet + exit

### 2.2 Frontend (src/dashboard/)
- **SocketContext.tsx:** SocketProvider, csatlakozik localhost:3000. Események: `system:log`, `agent:update`. State: logs[], agents (Map), isConnected.
- **Komponensek bekötése:** MissionControlLayout, TerminalLog a context-ből; "Live" badge ha csatlakozva.

---

## 3. Ügynökök Integrálása

### 3.1 Logger Utility (src/utils/logger.ts)
- `logInfo(source, message)` – console + Socket.IO broadcast
- `logError(source, message)` – console.error + broadcast
- `setAgentStatus(agentName, status, taskDescription?)` – socketService.updateAgentStatus
- Lazy load: socketService dynamic import (init order biztonság)

### 3.2 Agent Frissítések
- Érintett: OrchestratorAgent, ResearcherAgent, DeveloperAgent, DataScientistAgent, EvaluatorAgent, DynamicAgent
- `execute()` elején: `setAgentStatus(this.name, 'working', taskDescription)`
- `finally`: `setAgentStatus(this.name, 'idle')`
- Hiba: `setAgentStatus(this.name, 'error')`
- `logInfo` / `logError` a logger helyett

### 3.3 Chat Request Bekötés
- `socket.on('user_message')` kezdetén: `logInfo('Orchestrator', 'Új kérés érkezett: ' + userMsg)`

---

## 4. Remote Access (Cloudflare Tunnel)

### 4.1 Script: scripts/start_remote.ps1
- Ellenőrzés: `bin/cloudflared.exe` létezik-e (bin mappa létrehozása ha nincs)
- Letöltés: `https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe`
- Indítás: `cloudflared tunnel --url http://localhost:5173`
- Színes kiírás, felhasználói üzenet: "MASOLD KI AZ URL-T A TERMINALBOL ES NYISD MEG A TELEFONODON!"

### 4.2 Vite Security Host
- **vite.config.ts** (gyökér + src/dashboard): `server: { host: true, allowedHosts: true, port: 5173 }`
- `allowedHosts: true` – Cloudflare/ngrok domainek engedélyezve
- `host: true` – 0.0.0.0 bind külső IP-ről is

---

## 5. Fejlesztői Környezet Javítás

### 5.1 ts-node → tsx Migráció
- **Probléma:** Node.js v24 + ts-node/esm loader inkompatibilis → `[Object: null prototype]` crash
- **Ok:** express-rate-limit v8 named export (`{ rateLimit }`), de default import-ként használva
- **Javítások:**
  - `middleware.ts`: `import { rateLimit } from 'express-rate-limit'`
  - `tsx` telepítve devDependency-ként
  - `package.json`: `"dev": "tsx watch src/index.ts"`
  - `cross-env` → `"dev:alt": "cross-env PORT=3001 tsx watch src/index.ts"`

---

## 6. Eredmény

- **Backend:** `npm run dev` (3000) vagy `npm run dev:alt` (3001). Socket.IO fut, ügynökök regisztrálva.
- **Frontend:** `npm run dev:ui` → http://localhost:5173. Mission Control, valós idejű logok, ügynök státuszok.
- **Távoli elérés:** `.\scripts\start_remote.ps1` → trycloudflare.com URL a Dashboardhoz.
