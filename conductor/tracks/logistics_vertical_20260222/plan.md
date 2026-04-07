# Logistics Vertical — Végrehajtási Terv

**Track:** `logistics_vertical_20260222`
**Cél:** PohiAIProt2 frontend + Brunella LogisticsDispatcherAgent összekapcsolása

> Állapot: archív / külső frontend repo-függő. A repo-local rész külön follow-up trackbe került: `logistics_vertical_repo_local_20260407`.
**Becsült:** 3-4 nap (fázisokban)

---

## Általános Szabályok

```bash
# MINDEN módosítás előtt/után KÖTELEZŐ:
npm run build   # 0 TypeScript hiba
npm test        # 100% PASS

# Frontend (PohiAIProt2) tesztelése:
cd F:/PohiAIProt2 && npm run dev  # port 5173
# + Brunella API párhuzamosan:
cd F:/mcp-brunella-core && npm run dev  # port 3000
```

---

## PHASE 1 — Backend Foundation (1. nap, ~3-4 óra)

### 1.1 SQLite séma kiterjesztés

**Fájl:** `src/utils/globalDb.ts`

```typescript
// Meglévő initSchema()-ba HOZZÁADANDÓ:

// Logistics: Demands
CREATE TABLE IF NOT EXISTS logistics_demands (
  id TEXT PRIMARY KEY,
  product_name TEXT,
  diameter_type TEXT,
  diameter_from TEXT,
  diameter_to TEXT,
  length TEXT,
  quantity TEXT,
  cubic_meters REAL,
  status TEXT DEFAULT 'RECEIVED',
  submission_date TEXT DEFAULT (datetime('now')),
  company_id TEXT NOT NULL,
  company_name TEXT,
  processing_type TEXT,
  quality_grade TEXT
);

// Logistics: Stock
CREATE TABLE IF NOT EXISTS logistics_stock (
  id TEXT PRIMARY KEY,
  product_name TEXT,
  diameter_type TEXT,
  diameter_from TEXT,
  diameter_to TEXT,
  length TEXT,
  quantity TEXT,
  cubic_meters REAL,
  status TEXT DEFAULT 'AVAILABLE',
  price TEXT,
  upload_date TEXT DEFAULT (datetime('now')),
  company_id TEXT NOT NULL,
  company_name TEXT,
  sustainability_info TEXT
);

// Logistics: Matches
CREATE TABLE IF NOT EXISTS logistics_matches (
  id TEXT PRIMARY KEY,
  demand_id TEXT REFERENCES logistics_demands(id),
  stock_id TEXT REFERENCES logistics_stock(id),
  match_date TEXT DEFAULT (datetime('now')),
  commission_rate REAL DEFAULT 0.05,
  commission_amount REAL,
  billed INTEGER DEFAULT 0,
  shipment_id TEXT
);

// Logistics: Deals
CREATE TABLE IF NOT EXISTS logistics_deals (
  id TEXT PRIMARY KEY,
  match_id TEXT REFERENCES logistics_matches(id),
  status TEXT DEFAULT 'NEGOTIATION',
  final_price TEXT,
  final_quantity TEXT,
  final_delivery_date TEXT,
  negotiation_history TEXT,  -- JSON blob
  created_at TEXT DEFAULT (datetime('now'))
);

// Logistics: Shipments
CREATE TABLE IF NOT EXISTS logistics_shipments (
  id TEXT PRIMARY KEY,
  truck_id TEXT,
  truck_name TEXT,
  truck_capacity_m3 REAL DEFAULT 25,
  matches_json TEXT,         -- JSON blob
  status TEXT DEFAULT 'PREPARING',
  dispatch_date TEXT,
  estimated_arrival TEXT,
  loading_plan_json TEXT,    -- JSON blob
  created_at TEXT DEFAULT (datetime('now'))
);

// Logistics: Companies
CREATE TABLE IF NOT EXISTS logistics_companies (
  id TEXT PRIMARY KEY,
  company_name TEXT NOT NULL,
  role TEXT,                 -- 'CUSTOMER' | 'MANUFACTURER' | 'ADMIN'
  contact_person TEXT,
  email TEXT,
  address_json TEXT,         -- JSON blob { street, city, country, latitude, longitude }
  average_rating REAL DEFAULT 0,
  is_verified INTEGER DEFAULT 0
);
```

### 1.2 TimberMatchAgent — ÚJ AGENT

**FONTOS:** A meglévő `LogisticsDispatcherAgent` parcel tracking (GLS/DPD/Magyar Posta) — az más domain!
A timber B2B matchmaking egy **új agent**-et igényel.

**ÚJ FÁJL:** `src/agents/TimberMatchAgent.ts`

```typescript
export class TimberMatchAgent extends BaseAgent {
  name = 'TimberMatch';
  role = 'B2B Timber Logistics Matchmaking';
  description = 'AI-alapú kereslet-kínálat illesztés, vagonozástervezés, CMR generálás';
  capabilities = ['demand_stock_matching', 'loading_plan', 'cmr_generation', 'route_optimization'];
}
```

PLAN_LOGISTICS task type implementálása:
```typescript
async execute(task: string, context?: unknown): Promise<AgentResponse> {
  const ctx = context as LogisticsContext;

  if (ctx?.taskType === 'MATCH_DEMAND_STOCK') {
    return await this.matchDemandStock(ctx.demands, ctx.stock);
  }
  if (ctx?.taskType === 'PLAN_LOGISTICS') {
    return await this.planLogistics(ctx.matches, ctx.truckCapacityM3);
  }
  if (ctx?.taskType === 'GENERATE_CMR') {
    return await this.generateCmr(ctx.shipment, ctx.deal);
  }
  // ...
}

private async matchDemandStock(demands: DemandItem[], stock: StockItem[]) {
  // Gemini via LLM Router (brain model):
  const prompt = `Analyze these timber demands and stock items and suggest optimal matches.
  Demands: ${JSON.stringify(demands)}
  Stock: ${JSON.stringify(stock)}
  Return JSON array: [{ demandId, stockId, reason, similarityScore, matchStrength }]`;

  const result = await this.llmClient.generate(prompt, { outputFormat: 'json' });
  return { status: 'success', data: JSON.parse(result) };
}
```

### 1.3 Express Routes (ÚJ FÁJL)

**Fájl:** `src/server/routes/logistics.ts`

```typescript
import { Router } from 'express';
import { getDb } from '../../utils/globalDb.js';
import { AgentManager } from '../../agents/AgentManager.js';

const router = Router();

// GET /api/logistics/demands
router.get('/demands', async (req, res) => {
  const db = getDb();
  const demands = db.prepare('SELECT * FROM logistics_demands ORDER BY submission_date DESC').all();
  res.json(demands);
});

// POST /api/logistics/demands
router.post('/demands', async (req, res) => {
  const db = getDb();
  const id = `dem-${Date.now()}`;
  db.prepare('INSERT INTO logistics_demands (...) VALUES (...)').run({ id, ...req.body });
  res.json({ id, status: 'RECEIVED' });
});

// POST /api/logistics/match  ← AI matchmaking
router.post('/match', async (req, res) => {
  const { demands, stock } = req.body;
  const taskId = await AgentManager.getInstance().queueTask({
    agentName: 'LogisticsDispatcher',
    taskType: 'MATCH_DEMAND_STOCK',
    context: { demands, stock }
  });
  res.json({ task_id: taskId, status: 'pending' });
});

// ... többi endpoint
export default router;
```

**Regisztráció:** `src/server/web.ts`-be:
```typescript
import logisticsRoutes from './routes/logistics.js';
app.use('/api/logistics', logisticsRoutes);
```

---

## PHASE 2 — Frontend Wiring (2. nap, ~3 óra)

### 2.1 API Client (PohiAIProt2-ben)

**ÚJ FÁJL:** `F:/PohiAIProt2/src/lib/brunelaApiClient.ts`

```typescript
const BRUNELLA_API = 'http://localhost:3000/api/logistics';

export const BrunellaApi = {
  // Demands
  getDemands: () => fetch(`${BRUNELLA_API}/demands`).then(r => r.json()),
  createDemand: (demand) => fetch(`${BRUNELLA_API}/demands`, {
    method: 'POST', headers: {'Content-Type': 'application/json'},
    body: JSON.stringify(demand)
  }).then(r => r.json()),

  // Stock
  getStock: () => fetch(`${BRUNELLA_API}/stock`).then(r => r.json()),
  createStock: (item) => fetch(`${BRUNELLA_API}/stock`, { method: 'POST', ... }),

  // AI Matching (aszinkron)
  requestMatch: async (demands, stock) => {
    const { task_id } = await fetch(`${BRUNELLA_API}/match`, {
      method: 'POST', body: JSON.stringify({ demands, stock })
    }).then(r => r.json());
    return pollTaskStatus(task_id);
  },
};

// Polling helper
async function pollTaskStatus(taskId: string, maxAttempts = 30): Promise<any> {
  for (let i = 0; i < maxAttempts; i++) {
    const { status, result } = await fetch(
      `http://localhost:3000/api/agent-task-status/${taskId}`
    ).then(r => r.json());
    if (status === 'completed') return result;
    if (status === 'failed') throw new Error('Task failed');
    await new Promise(r => setTimeout(r, 2000)); // 2s polling
  }
  throw new Error('Timeout');
}
```

### 2.2 mockDataInitializer.ts cseréje

**Módosítás:** `F:/PohiAIProt2/src/lib/mockDataInitializer.ts`

```typescript
// ELŐTTE: localStorage.setItem(...)
// UTÁNA: Fetch Brunella API-ból

export async function initializeData(forceReset = false) {
  // Tölt a Brunella API-ból:
  try {
    const demands = await BrunellaApi.getDemands();
    const stock = await BrunellaApi.getStock();
    // Ha üres → seed mock adatokkal a Brunella-ba
    if (demands.length === 0) await seedInitialData();
    return { demands, stock };
  } catch {
    // Fallback: localStorage (offline mód)
    return loadFromLocalStorage();
  }
}
```

### 2.3 CORS konfiguráció (Brunella backend)

**Fájl:** `src/server/web.ts`

```typescript
// Meglévő CORS config bővítése:
app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:5174'],  // PohiAIProt2 Vite portjai
  credentials: true
}));
```

---

## PHASE 3 — AI Integration (3. nap, ~2 óra)

### 3.1 Matchmaking: Gemini → Brunella LLM Router

A LogisticsDispatcherAgent a Brunella `llm_client.ts` + `modelRouter.ts` rendszert használja.

**Konfiguráció:** `ROUTER_BUDGET=80` → Gemini cloud (brain model) matchmakingre

**Prompt engineering** (PohiAIProt2-ből átemelve):
```typescript
const MATCH_PROMPT = `
You are a timber logistics expert. Match these buyer demands with seller stock.
Consider: diameter compatibility, length match, quantity overlap, price range.

Demands: {demands}
Available Stock: {stock}

Return JSON array:
[{
  "demandId": "string",
  "stockId": "string",
  "reason": "explanation",
  "matchStrength": "STRONG|MEDIUM|WEAK",
  "similarityScore": 0.0-1.0
}]
`;
```

### 3.2 CMR Generálás

A PohiAIProt2-ből a CMR prompt átkerül LogisticsDispatcherAgent.GENERATE_CMR-be:
```typescript
// Output: CMR mezők JSON-ban → frontend kitölti a formot
{
  consignor: { name, address },
  consignee: { name, address },
  goodsDescription: string,
  grossWeight: number,
  specialAgreements: string
}
```

---

## PHASE 4 — Dashboard Integration (4. nap, ~2 óra)

### 4.1 Brunella Dashboard panel

**Komponens:** `src/dashboard/components/dashboard/LogisticsWidget.tsx`

```typescript
// Átvett komponensek (közvetlen másolás PohiAIProt2-ből):
// - MatchmakingVisualization → src/dashboard/components/logistics/
// - VisualTruckLoad → src/dashboard/components/logistics/
// FONTOS: Tailwind v4 kompatibilitás ellenőrizni!
```

**NavigationRegistry bejegyzés:**
```typescript
// src/dashboard/lib/navigation.tsx:
navigationRegistry.registerItem({
  id: 'logistics-hub',
  label: 'Logistics Hub',
  icon: TruckIcon,
  component: LogisticsHubPanel,
  group: 'enterprise'
});
```

### 4.2 Golden Dataset

Sikeres logistics match-ek automatikusan kerülnek a fine-tuning adatbázisba:
```typescript
// goldenDatasetBridge.ts automatikusan kezeli, ha:
// - LogisticsDispatcherAgent sikeres futás
// - LLM-alapú kimenet volt
// RULE-GD1 + RULE-GD2 teljesül automatikusan
```

---

## Tesztelés

```bash
# Brunella backend tesztek:
npm run build && npm test

# Integration teszt (manuális):
# 1. npm run dev (port 3000)
# 2. cd F:/PohiAIProt2 && npm run dev (port 5173)
# 3. Böngésző: http://localhost:5173
# 4. Admin login → Demands felvesz → Stock felvesz → AI Match → Shipment

# E2E:
npm run test:e2e
```

---

## Git Strategy

```bash
# Brunella módosítások saját branch-en:
git checkout -b feat/logistics-vertical

# Commit-ok:
git commit -m "feat(logistics): Phase 1 - SQLite schema + LogisticsDispatcherAgent"
git commit -m "feat(logistics): Phase 2 - Express routes + CORS"
git commit -m "feat(logistics): Phase 3 - AI matchmaking + CMR generation"
git commit -m "feat(logistics): Phase 4 - Dashboard integration"
```

---

## Sikerességi Kritériumok

1. ✅ `POST /api/logistics/match` → AI match-ek visszajönnek
2. ✅ PohiAIProt2 localStorage helyett Brunella API-t használ
3. ✅ `npm test` PASS (új logistics tesztek)
4. ✅ Dashboard: "Logistics Hub" panel megjelenik
5. ✅ Demo flow: demand → stock → match → shipment end-to-end
6. ✅ Golden Dataset: match-ek mentve D1-be

---

## Pályázati Érték (Hiventures-nek)

> "A Brunella platform már egy teljes körű B2B logistics SaaS vertikált integrált: AI-alapú kereslet-kínálat illesztés, optimalizált tehervagonozás, automatikus CMR és számla generálás. A 8 éves domain expertise + TRL 4 frontend + meglévő AI motor összeolvasztása TRL 6-os terméket eredményez, valós referenciával."
