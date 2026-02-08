# Specifikáció: Mission Control Dashboard & Remote Access (2026-02-02)

## 1. Áttekintés

A track célja a Brunella Dashboard **Mission Control** nézetének bevezetése, valós idejű ügynök-monitorozás, távoli elérés (Cloudflare Tunnel) és a fejlesztői környezet stabilizálása (ts-node → tsx).

---

## 2. Technikai Követelmények

### 2.1 Frontend (src/dashboard/)
| Komponens | Cél |
|-----------|-----|
| AgentStatusCard | Ügynök név, státusz (Idle/Working/Error), task leírás, glass box design |
| TerminalLog | Terminál stílus, log típusok (command/error/info/output), forrás megjelenítés |
| MissionControlLayout | Header, sidebar, Bento grid, Memory Context panel |
| SocketContext | Socket.IO kapcsolat, logs[], agents Map, isConnected |

### 2.2 Backend (src/server/)
| Modul | Cél |
|-------|-----|
| SocketService | Singleton: broadcastLog, updateAgentStatus |
| web.ts | socketService.init(io), CORS, debug API-k |
| Debug API | POST /api/debug/broadcast-log, POST /api/debug/agent-status |

### 2.3 Logger (src/utils/logger.ts)
- `logInfo(source, message)` – console + Socket broadcast
- `logError(source, message)` – console.error + broadcast
- `setAgentStatus(agentName, status, taskDescription?)` – agent status update
- Lazy load socketService (init order)

### 2.4 Remote Access
- **scripts/start_remote.ps1:** cloudflared letöltés (ha nincs), Quick Tunnel indítás
- **vite.config.ts:** `host: true`, `allowedHosts: true` (tunnel domainek)

### 2.5 Dev Environment
- **tsx** devDependency (ts-node helyett)
- **package.json:** `"dev": "tsx watch src/index.ts"`
- **middleware.ts:** `import { rateLimit } from 'express-rate-limit'`

---

## 3. Elfogadási Kritériumok

- [x] Mission Control Layout megjelenik a Dashboardon
- [x] Valós idejű logok és ügynök státuszok Socket.IO-n keresztül
- [x] Minden ügynök tevékenység látható (logInfo, setAgentStatus)
- [x] Cloudflare Tunnel script működik, URL megjelenik
- [x] Vite allowedHosts – tunnel domain nem blokkol
- [x] npm run dev tsx-szel fut, crash nélkül

---

## 4. Kapcsolódó Tracks

- **dashboard_restoration_20260130** – API és Socket.IO alapok
- **system_cleanup_docker_20260130** – Projekt struktúra
