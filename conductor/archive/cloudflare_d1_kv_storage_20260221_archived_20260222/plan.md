# Plan: Cloudflare D1 + KV Cloud Storage

**Track ID:** `cloudflare_d1_kv_storage_20260221`
**Prioritás:** MEDIUM
**Státusz:** ACTIVE
**Progress:** 0%

---

## Phase 1: D1 adatbázis létrehozása és séma

### Wrangler parancsok

```bash
wrangler d1 create brunella-core-db
wrangler d1 execute brunella-core-db --command "CREATE TABLE IF NOT EXISTS enterprise_events (...)"
```

### Migrált táblák

1. `enterprise_events` — EnterpriseEventBus perzisztencia
2. `agent_tasks` — TaskQueue
3. `golden_samples` — Golden Dataset fine-tuning adatok

### `src/utils/d1Adapter.ts`

```typescript
export class D1Adapter {
  private workerUrl = process.env.CLOUDFLARE_WORKER_URL;

  async query(sql: string, params: unknown[] = []): Promise<unknown[]> {
    const res = await fetch(`${this.workerUrl}/d1/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sql, params })
    });
    const data = await res.json();
    return data.results ?? [];
  }
}
```

**Becslés:** ~2 óra

---

## Phase 2: KV cache réteg

### Namespace létrehozása

```bash
wrangler kv namespace create brunella-agent-cache
```

### `src/utils/kvCache.ts`

```typescript
export async function kvGet(key: string): Promise<string | null>
export async function kvSet(key: string, value: string, ttlSeconds?: number): Promise<void>
export async function kvDelete(key: string): Promise<void>
```

### Cache-elt adatok

| Key | TTL | Tartalom |
|-----|-----|---------|
| `ev_hunter:last_results` | 6 óra | EV Hunter JSON eredmény |
| `robotkez:session:{id}` | 1 óra | Chat history |
| `market_intel:daily` | 24 óra | MarketIntel összegzés |

**Becslés:** ~1.5 óra

---

## Phase 3: Golden Dataset D1 szinkron

```typescript
// src/core/goldenDatasetBridge.ts bővítés
async function autoSaveGoldenSample(sample) {
  // 1. Lokális JSONL (megmarad)
  await appendToJsonl(sample);
  // 2. D1 cloud (új)
  await d1Adapter.query(
    'INSERT INTO golden_samples (instruction, output, source, created_at) VALUES (?, ?, ?, ?)',
    [sample.instruction, sample.output, sample.source, Date.now()]
  );
}
```

**Becslés:** ~1 óra

---

## Összesített TODO

```
[ ] 1. wrangler d1 create brunella-core-db
[ ] 2. D1 séma migrációs SQL fájlok
[ ] 3. bas-orchestrator Worker: /d1/query endpoint
[ ] 4. src/utils/d1Adapter.ts létrehozása
[ ] 5. wrangler kv namespace create brunella-agent-cache
[ ] 6. bas-orchestrator Worker: /kv/* endpoints
[ ] 7. src/utils/kvCache.ts létrehozása
[ ] 8. src/core/goldenDatasetBridge.ts: D1 szinkron
[ ] 9. npm test — ALL GREEN
[ ] 10. meta.json: progress: 100, status: completed
```
