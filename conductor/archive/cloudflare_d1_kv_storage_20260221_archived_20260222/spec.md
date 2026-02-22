# Spec: Cloudflare D1 + KV Cloud Storage

**Track ID:** `cloudflare_d1_kv_storage_20260221`

---

## D1 Séma

```sql
-- enterprise_events
CREATE TABLE IF NOT EXISTS enterprise_events (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  payload TEXT NOT NULL,
  source_module TEXT NOT NULL,
  priority TEXT NOT NULL DEFAULT 'MEDIUM',
  status TEXT NOT NULL DEFAULT 'PENDING',
  created_at INTEGER NOT NULL,
  processed_at INTEGER
);

-- agent_tasks
CREATE TABLE IF NOT EXISTS agent_tasks (
  id TEXT PRIMARY KEY,
  agent_name TEXT NOT NULL,
  task TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  result TEXT,
  created_at INTEGER NOT NULL,
  completed_at INTEGER
);

-- golden_samples
CREATE TABLE IF NOT EXISTS golden_samples (
  id TEXT PRIMARY KEY,
  instruction TEXT NOT NULL,
  output TEXT NOT NULL,
  source TEXT,
  agent_name TEXT,
  created_at INTEGER NOT NULL
);
```

## KV Naming Convention

```
brunella:{category}:{identifier}
Pl:
  brunella:ev_hunter:last_results
  brunella:session:robotkez:{session_id}
  brunella:cache:market_intel:daily
  brunella:agent:status:{agent_name}
```

## Env változók

```env
CF_D1_DATABASE_ID=...      # wrangler d1 create után kapott ID
CF_KV_NAMESPACE_ID=...     # wrangler kv namespace create után
```

## Lokális fallback logika

```typescript
// globalDb.ts módosítás
export function getDb(): DbAdapter {
  if (process.env.CF_D1_ENABLED === 'true' && process.env.CF_D1_DATABASE_ID) {
    return d1Adapter;   // Cloud D1
  }
  return localSqlite;  // Jelenlegi better-sqlite3 (fallback)
}
```
