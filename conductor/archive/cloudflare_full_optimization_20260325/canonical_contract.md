# Canonical Cloudflare Contract (v1)

Ez a dokumentum a Brunella Cloudflare réteg *kanonikus* végpontjait és payload szerződését rögzíti.

## 1) Canonical role split

- **Orchestrator Worker**
  - task dispatch
  - status lookup
  - execution history
  - D1 bridge
- **Chat Sync Worker**
  - chat message exchange (`/chat/messages`)
- **Node API Gateway (Express)**
  - stabil, belső kliens felé egységes belépési pont (`/api/v1/cloudflare/*`)

---

## 2) Canonical endpoints

### A) Node API surface (internal clients)
- `GET /api/v1/cloudflare/config`
- `GET /api/v1/cloudflare/agents`
- `POST /api/v1/cloudflare/agents/:workerId/task`
- `GET /api/v1/cloudflare/status`
- `POST /api/v1/cloudflare/task`
- `GET /api/v1/cloudflare/status/:taskId`
- `GET /api/v1/cloudflare/history?limit=20`
- `POST /api/v1/cloudflare/chat`

Compatibility alias fenntartható átmenetileg:
- `/api/cloudflare/*`

### B) Orchestrator worker (remote)
- `GET /health`
- `POST /task`
- `GET /status/:id`
- `GET /history`
- `POST /d1/query`

### C) Chat sync worker (remote)
- `GET /chat/messages`
- `POST /chat/messages`

---

## 3) Request/Response schema baseline

### `POST /task`
**Request**
```json
{
  "instruction": "string",
  "context": { "any": "json" }
}
```

**Response (success)**
```json
{
  "success": true,
  "taskId": "string",
  "type": "string",
  "message": "string",
  "result": {}
}
```

**Response (error)**
```json
{
  "success": false,
  "error": "string"
}
```

### `GET /status/:id`
**Response (success)**
```json
{
  "id": "string",
  "status": "queued|running|completed|failed",
  "result": {}
}
```

### `GET /history`
**Response**
```json
{
  "tasks": []
}
```

### `POST /chat` (Node proxy)
**Request**
```json
{
  "instruction": "string",
  "history": [
    { "role": "user", "content": "..." },
    { "role": "assistant", "content": "..." }
  ]
}
```

**Response**
```json
{
  "success": true,
  "message": "string",
  "endpoint": "string",
  "raw": {}
}
```

---

## 4) Error policy

- `400` — kliens oldali hiányzó/hibás input
- `401/403` — auth required/protected endpoint (worker elérhető, de védelem alatt)
- `404` — worker/route/task not found
- `502` — upstream Cloudflare proxy hiba
- `503` — edge disabled / service unavailable
- `500` — backend belső hiba

---

## 5) Migration notes

1. Új kód `api/v1/cloudflare` prefixet használjon.
2. Remote worker hívásoknál ne legyen endpoint-szórás: a fenti canonical listára kell szűkíteni.
3. Chat útvonalnál a `CLOUDFLARE_CHAT_SYNC_URL` legyen elsődleges source-of-truth.
4. D1 bridge mindig orchestrator workeren keresztül (`/d1/query`).
