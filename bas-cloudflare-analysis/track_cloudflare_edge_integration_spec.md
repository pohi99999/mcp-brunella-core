# Track: Cloudflare Edge Integration

**Track ID:** `cloudflare_edge_integration_20260202`
**Státusz:** 🟡 Proposed
**Prioritás:** HIGH
**Létrehozva:** 2026-02-02


---

## 🎯 Célok

A BAS (Brunella Agent System) bővítése Cloudflare Workers edge computing képességekkel:

1. **API Gateway** - Egységes külső belépési pont
2. **Task Router** - AI-alapú task osztályozás edge-en
3. **Távoli elérés** - Dashboard és API globális elérhetősége
4. **Hibrid Orchestráció** - Edge + Lokális együttműködés
5. **Fallback LLM** - Workers AI ha Ollama nem elérhető

---

## 📋 Specifikáció

### 1. Fázis: Alapinfrastruktúra (2-3 nap)

#### 1.1 Cloudflare Worker Setup
```
cloudflare/
├── src/
│   └── index.ts          # Fő Worker
├── wrangler.jsonc        # Konfiguráció
├── package.json
└── tsconfig.json
```

#### 1.2 Cloudflare Tunnel
- `cloudflared` telepítése
- Tunnel létrehozása: `brunella`
- Konfiguráció: `~/.cloudflared/config.yml`

#### 1.3 Alapvető Endpointok
| Endpoint | Leírás |
|----------|--------|
| `GET /` | Health check |
| `GET /health` | Részletes állapot |
| `POST /task` | Task beküldés |
| `GET /status/:id` | Task státusz |
| `/* (proxy)` | Dashboard proxy |

### 2. Fázis: Task Router (2-3 nap)

#### 2.1 Workers AI Integráció
```typescript
// Task osztályozás edge-en
const taskType = await ai.run("@cf/meta/llama-3.1-8b-instruct", {
  messages: [
    { role: "system", content: "Classify task type..." },
    { role: "user", content: instruction }
  ]
});
```

#### 2.2 KV Storage
- Namespace: `BAS_TASKS`
- Struktúra: `{ taskId, type, status, payload, createdAt, updatedAt }`
- TTL: 24 óra

#### 2.3 Szinkronizáció
```
Cloudflare KV ←→ Lokális SQLite
```
- Webhook callback a lokális rendszer felé
- Státusz frissítések KV-be

### 3. Fázis: Hibrid Orchestráció (2-3 nap)

#### 3.1 Durable Objects
```typescript
export class SessionState {
  // WebSocket kezelés
  // Multi-client koordináció
}

export class TaskCoordinator {
  // Task állapot kezelés
  // Retry logika
}
```

#### 3.2 Workers AI Fallback
- Ha Tunnel nem elérhető → Workers AI válaszol
- Modell: `@cf/meta/llama-3.1-8b-instruct`
- Korlátozott képességek (csak text generation)

#### 3.3 Dashboard Proxy
- Cloudflare Access policy
- Zero Trust Authentication
- CORS konfiguráció

---

## 🔗 Integráció a Meglévő Rendszerrel

### Érintett Fájlok

| Fájl | Módosítás |
|------|-----------|
| `src/agents/AgentManager.ts` | Edge delegálás támogatás |
| `src/server/web.ts` | Tunnel endpoint |
| `src/server/SocketService.ts` | Edge relay |
| `src/config/index.ts` | Új env változók |
| `package.json` | Új scriptek |
| `.env` | Cloudflare credentials |

### Új Fájlok

| Fájl | Leírás |
|------|--------|
| `src/edge/worker/index.ts` | Worker entry |
| `src/edge/tunnel/bridge.ts` | Tunnel kommunikáció |
| `src/agents/EdgeProxyAgent.ts` | Új ügynök |
| `cloudflare/*` | CF projekt |

---

## ✅ Elfogadási Kritériumok

### Must Have
- [ ] Worker deployolva és elérhető: `https://bas-orchestrator.workers.dev`
- [ ] Tunnel működik: lokális :3000 elérhető távolról
- [ ] Task beküldés működik edge-ről
- [ ] Health check mindkét irányban

### Should Have
- [ ] KV szinkronizáció SQLite-tal
- [ ] Workers AI fallback
- [ ] Dashboard proxy működik

### Nice to Have
- [ ] Durable Objects session state
- [ ] Cloudflare Access policy
- [ ] Multi-region deployment

---

## 📊 Sikerkritériumok

| Metrika | Cél |
|---------|-----|
| Edge latency | < 50ms |
| Tunnel uptime | > 99% |
| Task routing accuracy | > 95% |
| Fallback response time | < 2s |

---

## 🧪 Tesztelési Terv

### Unit Tesztek
```typescript
// test/edge/worker.test.ts
describe('BAS Edge Worker', () => {
  it('should classify browser tasks correctly');
  it('should forward to tunnel when available');
  it('should fallback to Workers AI when tunnel down');
});
```

### Integrációs Tesztek
```powershell
# Edge health
curl https://bas-orchestrator.workers.dev/health

# Task submission
curl -X POST https://bas-orchestrator.workers.dev/task \
  -H "Content-Type: application/json" \
  -d '{"instruction": "Test task"}'

# Tunnel proxy
curl https://bas-orchestrator.workers.dev/api/agents
```

### End-to-End Teszt
1. Task beküldés edge-ről
2. Routing lokális rendszerhez
3. Agent végrehajtás
4. Callback edge-re
5. Dashboard frissülés

---

## 📅 Ütemterv

| Nap | Feladat |
|-----|---------|
| 1 | CF Worker alap + Tunnel setup |
| 2 | Health check + proxy működés |
| 3 | Task routing + KV storage |
| 4 | Workers AI integráció |
| 5 | AgentManager módosítás |
| 6 | Tesztelés + dokumentáció |
| 7 | Buffer / javítások |

---

## 🔗 Függőségek

### Előfeltételek
- [x] MCP Brunella Core működik
- [x] Dashboard UI elérhető lokálisan
- [x] Cloudflare account aktív
- [ ] `cloudflared` telepítve

### Blokkolók
- Cloudflare API token szükséges
- Tunnel token szükséges

---

## 📚 Referenciák

- [Cloudflare Workers Docs](https://developers.cloudflare.com/workers/)
- [Cloudflare Tunnel](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/)
- [Workers AI](https://developers.cloudflare.com/workers-ai/)
- BAS Conductor: `conductor/workflow.md`
- BAS Tech Stack: `conductor/tech-stack.md`

---

*Track létrehozva: Claude (Brunella társügynök)*
