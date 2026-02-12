# Track: Cloudflare Chat Integration (Dashboard + CLI)

**Status:** IN_PROGRESS
**Priority:** P1
**Complexity:** HIGH
**Created:** 2026-02-11
**Owner:** Claude

## 🎯 Cél

Cloudflare Workers WebSocket chat beágyazása a Dashboardba + CLI chat interface, központosított vezérlés D1 Database történet mentéssel.

## ✅ Acceptance Criteria

1. Dashboard CloudflareChat komponens (WebSocket real-time)
2. CLI magyar chat interface (menüvezérelt)
3. D1 Database automatikus mentés (chat history)
4. AgentManager integráció (üzenetek → Orchestrator)
5. WebSocket kapcsolat kezelés (reconnect, error handling)

## 🔧 Technikai Követelmények

### Dashboard: src/dashboard/components/CloudflareChat.tsx

- WebSocket connection (wss://chat-bas.peterpohanka.com/ws)
- Real-time message display (Card + ScrollArea)
- Input field + Send button
- Connection status indicator (zöld/piros)
- Reconnect mechanizmus

### CLI: src/cli-commands/chat-hu.ts

```
1. 💬 Chat indítása
2. 📜 Chat előzmények
3. 🔙 Vissza

> Chat módban magyar menü, /exit kilépés
```

### Backend: src/server/routes/cloudflare.ts

- POST /api/chat/send → AgentManager + D1 storage
- GET /api/chat/history/:userId → D1 query
- WebSocket proxy (Socket.IO)

### Cloudflare D1 Integration

- API Token: **_REDACTED_**
- ⚠️ Teendő: Cloudflare API token **azonnali rotálása** (a repo-ban korábban szerepelt).
- Database ID: 1c4e7d00-7b09-4ddf-88b4-8df42e1123ab
- Schema: messages (id, user_id, content, type, created_at)

## 📋 Implementation Plan

### Phase 1: Dashboard Component

- [x] Dashboard Cloudflare/Edge chat felület (NeuralLinkChat: Cloudflare mód)
- [ ] WebSocket setup (useState + useRef)
- [ ] Message list rendering
- [ ] Input field + send handler
- [ ] Connection status indicator
- [ ] Dashboard route integráció

### Phase 2: CLI Interface

- [ ] chat-hu.ts létrehozás
- [ ] Magyar menü (inquirer.js)
- [ ] WebSocket CLI client
- [ ] Multi-line input support
- [ ] /exit, /help commands
- [ ] CLI command regisztráció

### Phase 3: Backend Routes

- [x] cloudflare.ts routes (v1: /api/cloudflare/*)
- [x] POST /api/cloudflare/task handler (feature-flag: EDGE_ENABLED)
- [ ] POST /api/chat/send handler
- [ ] D1 API integráció
- [ ] AgentManager call
- [ ] GET /api/chat/history handler
- [ ] WebSocket proxy (Socket.IO)

### Phase 4: Testing

- [ ] Manual testing (Dashboard)
- [ ] Manual testing (CLI)
- [ ] D1 storage verify
- [ ] Agent response verify
- [ ] npm test

### Phase 5: Deployment

- [ ] README.md frissítés
- [ ] .ai/claude.md frissítés
- [ ] GitHub commit
- [ ] Track COMPLETED

## 📝 Implementation Prompt

```
Cloudflare WebSocket chat integráció Dashboard + CLI-vel:

Dashboard:
- CloudflareChat.tsx (WebSocket + Radix UI)
- Real-time üzenetek, connection status, reconnect

CLI:
- Magyar menüvezérelt chat (inquirer.js)
- WebSocket client
- /exit, /help commands

Backend:
- Express routes (POST /api/chat/send, GET /api/chat/history)
- Cloudflare D1 API integráció
- AgentManager call minden üzenetre

D1 Database ID: 1c4e7d00-7b09-4ddf-88b4-8df42e1123ab
WebSocket URL: wss://chat-bas.peterpohanka.com/ws
```

---

## 📝 Napló

### 2026-02-12

- Spec-first: `spec.md` létrehozva (feature-flag + API contract, secrets nélküli tesztelhetőség).
- Implementáció (Iteration 1):
	- Backend: `src/server/routes/cloudflare.ts` + mount: `/api/v1/cloudflare/*`.
	- Dashboard: `NeuralLinkChat` kapott **Cloudflare (Edge)** módot.
	- Teszt: `test/cloudflare_routes.test.ts` (EDGE disabled → 503), így a CI nem hív külső endpointot.
