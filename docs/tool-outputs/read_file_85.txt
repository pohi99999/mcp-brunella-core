# Logistics Vertical — Specifikáció

**Track:** `logistics_vertical_20260222`
**Repo:** `F:/PohiAIProt2` → Brunella integráció

---

## Mi ez?

A **PohiAIProt2** egy komplett, production-ready frontend egy nehézanyag-logisztikai B2B platformhoz. Timber (tölgy, akác, fenyő stb.) kereskedők és gyártók között AI-alapú összeillesztés, tehervagonozás, szállítmánykövetés, CMR dokumentumgenerálás.

**8 év domain expertise** áll mögötte (Pohánka Péter). A frontend teljesen kész, mock adatokkal működik. A Brunella rendelkezik AI motorral (`LogisticsDispatcherAgent`). Az integráció ezek összekapcsolása.

---

## Adatmodellek (PohiAIProt2 típusokból)

### DemandItem (Vevői igény)
```typescript
{
  id: string;
  productName?: string;
  diameterType: string;        // 'Top' | 'Middle'
  diameterFrom: string;        // cm
  diameterTo: string;          // cm
  length: string;              // méter
  quantity: string;
  cubicMeters?: number;
  status: 'RECEIVED' | 'PROCESSING' | 'COMPLETED' | 'CANCELLED';
  submissionDate: string;      // ISO
  submittedByCompanyId: string;
  submittedByCompanyName: string;
}
```

### StockItem (Gyártói készlet)
```typescript
{
  id?: string;
  productName?: string;
  diameterType: string;
  diameterFrom: string;
  diameterTo: string;
  length: string;
  quantity: string;
  cubicMeters?: number;
  status: 'AVAILABLE' | 'RESERVED' | 'SOLD';
  price?: string;              // pl. "120 EUR/m³"
  uploadDate?: string;
  uploadedByCompanyId: string;
  uploadedByCompanyName: string;
}
```

### ConfirmedMatch
```typescript
{
  id: string;
  demandId: string;
  stockId: string;
  matchDate: string;
  commissionRate: number;      // 0.05 = 5%
  commissionAmount: number;
  billed: boolean;
  shipmentId?: string;
}
```

### Deal (Tárgyalási szoba)
```typescript
{
  id: string;
  matchId: string;
  status: 'NEGOTIATION' | 'AGREED' | 'COMPLETED' | 'DISPUTED' | 'CLOSED';
  finalPrice?: string;
  finalQuantity?: string;
  finalDeliveryDate?: string;
  negotiationHistory: NegotiationEvent[];
}
```

### Shipment (Szállítmány)
```typescript
{
  id: string;                  // pl. SHIP-20240725-1
  truckDetails: { id, name, capacityM3 };
  matches: ConfirmedMatch[];
  status: 'PREPARING' | 'IN_TRANSIT' | 'DELIVERED';
  dispatchDate: string;
  estimatedArrivalDate: string;
  plan: LoadingPlan;
}
```

### LoadingPlan (Vagonozási terv)
```typescript
{
  items: LoadingPlanItem[];    // mi kerül a teherkocsi-ra
  capacityUsed: string;
  waypoints?: Waypoint[];
  optimizedRouteDescription?: string;
}
// LoadingPlanItem: { name, volumeM3, dropOffOrder, destinationName }
```

---

## Vizualizációs Komponensek

### MatchmakingVisualization
- Input: `demands[]` + `stockItems[]` + `suggestions[]` (AI output)
- Render: SVG flow-vonalak igény-készlet párosítással
- Adat: `{ demandId, stockId, reason, similarityScore }` per match

### SimulatedRouteMap
- Input: `waypoints[]` (lat/lng) + útvonal leírás
- Render: Google Maps + Directions API route
- Adat: cégek lat/lng koordinátái kellenek

### VisualTruckLoad
- Input: `items[]` (volumeM3, destinationName, dropOffOrder)
- Render: SVG 3D teherkocsi LIFO sorrendben
- Adat: köbméter méretarányos megjelenítés

### ShipmentMap
- Input: `deal` + `companies[]` + státusz
- Render: Animált kamion ikon a Google Maps-en
- Adat: indulási és célcím koordinátái

---

## Jelenlegi AI Hívások (PohiAIProt2-ben)

| Feature | Prompt input | Gemini output |
|---------|-------------|---------------|
| Matchmaking suggestions | demands[] + stock[] | `{ demandId, stockId, reason, matchStrength }[]` |
| Demand status explanation | single demand | plain text |
| Stock suggestions | single demand | alternative stock items |
| Negotiation AI | deal history | `{ suggestedPrice, message }` |
| Invoice text | match details | invoice HTML |
| CMR generation | shipment details | CMR form fields |
| Truck loading plan | items + truck capacity | `LoadingPlan` JSON |
| Route optimization | waypoints | Google Maps route description |

---

## Brunella API Contract (meglévő, F:/PohiAIPro/API_CONTRACT.md)

```
POST /api/agent-task
Body: {
  task_type: "PLAN_LOGISTICS" | "MATCH_DEMAND_STOCK" | "GENERATE_CONTENT" | "ANALYZE_DATA",
  payload: { ... }
}
Response: { task_id: string, status: "pending" }

GET /api/agent-task-status/{task_id}
Response: { status: "pending" | "running" | "completed" | "failed", result?: any }
```

Ez az ASZINKRON interfész — a frontend polling-gal kérdezi le az eredményt.

---

## Szükséges Brunella Backend Bővítések

### 1. SQLite táblák (globalDb.ts bővítés)

```sql
CREATE TABLE IF NOT EXISTS logistics_demands (...);
CREATE TABLE IF NOT EXISTS logistics_stock (...);
CREATE TABLE IF NOT EXISTS logistics_matches (...);
CREATE TABLE IF NOT EXISTS logistics_deals (...);
CREATE TABLE IF NOT EXISTS logistics_shipments (...);
CREATE TABLE IF NOT EXISTS logistics_invoices (...);
CREATE TABLE IF NOT EXISTS logistics_companies (...);
```

### 2. Express Route-ok (src/server/routes/logistics.ts — ÚJ FÁJL)

```typescript
// GET/POST /api/logistics/demands
// GET/POST /api/logistics/stock
// POST     /api/logistics/match          ← AI matchmaking
// POST     /api/logistics/deals
// PATCH    /api/logistics/deals/:id
// POST     /api/logistics/shipments
// GET      /api/logistics/shipments/:id
// POST     /api/logistics/invoices/generate
// POST     /api/logistics/loading-plan   ← Truck optimization
```

### 3. LogisticsDispatcherAgent bővítése

Jelenlegi: általános logisztikai dispatchelés
Szükséges task type-ok:

```typescript
// MATCH_DEMAND_STOCK
{
  demands: DemandItem[],
  stock: StockItem[]
} → MatchSuggestion[]

// PLAN_LOGISTICS
{
  matches: ConfirmedMatch[],
  truckCapacityM3: number,
  waypoints: Waypoint[]
} → LoadingPlan + optimizedRoute

// GENERATE_CMR
{
  shipment: Shipment,
  deal: Deal
} → CMR form fields JSON

// GENERATE_INVOICE
{
  match: ConfirmedMatch,
  commissionRate: number
} → Invoice text + line items
```

### 4. Frontend módosítások (PohiAIProt2)

**Legkisebb módosítás:** Csak a `mockDataInitializer.ts`-t és a Gemini hívásokat kell cserélni.

```typescript
// ELŐTTE (PohiAIProt2 - mockDataInitializer.ts):
localStorage.setItem('pohi-ai-customer-demands', JSON.stringify(mockDemands));

// UTÁNA (API hívás):
const response = await fetch('http://localhost:3000/api/logistics/demands');
const demands = await response.json();
```

```typescript
// ELŐTTE (Gemini direkt):
const result = await ai.models.generateContent({ model: 'gemini-2.5-flash', ... });

// UTÁNA (Brunella proxy):
const response = await fetch('http://localhost:3000/api/logistics/match', {
  method: 'POST',
  body: JSON.stringify({ demands, stock })
});
const { task_id } = await response.json();
// ... polling GET /api/agent-task-status/{task_id}
```

---

## Deployment Stratégia

### Phase 1: Standalone (gyors)
- PohiAIProt2 fut külön (Vite → port 5174)
- Brunella API-ra kötve (CORS engedélyezve)
- Gyors prototípus, külön deployolható

### Phase 2: Beolvasztott (hosszú táv)
- PohiAIProt2 komponensei → Brunella Dashboard
- React komponensek bemásolva `src/dashboard/components/logistics/`
- NavigationRegistry: "Logistics Hub" panel
- Ugyanaz a React + Tailwind tech stack → közvetlen másolható

---

## Pályázati Érték

| Szempont | Adat |
|----------|------|
| TRL szint | TRL 4 (frontend done + AI engine done, integráció = TRL 5→6) |
| Domain expertise | 8 év nehézanyag-logisztika |
| Referencia | Hackathon díjnyertes prototípus |
| Target market | Európai KKV fa/nehézanyag kereskedők |
| Revenue | Commission 5% + havidíj |
| Differenciátor | AI matchmaking + truck loading optimization + auto CMR |
| Pályázat illeszkedés | Hiventures (AI B2B SaaS = ideális), DIMOP (digitalizáció) |
