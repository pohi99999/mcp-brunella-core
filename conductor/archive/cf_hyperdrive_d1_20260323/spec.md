# Specifikáció: Hyperdrive Connection Pooling D1 Teljesítményhez

**Track ID:** `cf_hyperdrive_d1_20260323`
**Prioritás:** LOW
**Tulajdonos:** Pohánka Péter
**Létrehozva:** 2026-03-23

---

## 1. Áttekintés

A Cloudflare Hyperdrive bevezetésének vizsgálata a D1 adatbázis teljesítmény javítására. Ez egy **feltételes** track — csak akkor kerül végrehajtásra, ha a D1 query latency problémát okoz.

### Fontos megjegyzés

A Hyperdrive elsősorban **külső PostgreSQL/MySQL** adatbázisokhoz készült (connection pooling + query caching). A D1 egy Cloudflare-natív adatbázis, amely már optimalizálva van a Workers környezetre. Lehetséges, hogy a Hyperdrive **nem alkalmazható közvetlenül** D1-re — ezt a track első fázisában kell tisztázni.

---

## 2. Jelenlegi D1 állapot

### 2.1 BAS D1 adatbázis használat

A BAS rendszer a következő D1 adatbázisokat használja:

| Adatbázis | Használat | Becsült méret |
|-----------|-----------|---------------|
| `bas-main` | Feladatok, agent futások, logok | 50-200 MB |
| `bas-knowledge` | RAG pipeline, dokumentumok | 100-500 MB |

### 2.2 Ismert D1 korlátok

| Korlát | Érték | Hatás |
|--------|-------|-------|
| Max sorok/tábla | 10M | Bőven elég |
| Max DB méret | 10 GB (paid) / 500 MB (free) | Figyelni kell |
| Olvasási latency | ~5-15 ms (edge) | Általában elfogadható |
| Írási latency | ~30-100 ms (primary) | Batch írásnál lehet probléma |
| Max batch méret | 100 utasítás | Korlátozott batch lehetőség |

### 2.3 Jelenlegi D1 query minta

```typescript
// Tipikus BAS D1 query-k
// 1. Agent futás mentése (~30-50ms)
await env.DB.prepare(
  'INSERT INTO agent_runs (id, agent_id, status, result, created_at) VALUES (?, ?, ?, ?, ?)'
).bind(runId, agentId, status, JSON.stringify(result), now).run();

// 2. Task lekérdezés (~5-10ms)
const tasks = await env.DB.prepare(
  'SELECT * FROM tasks WHERE status = ? ORDER BY priority DESC LIMIT ?'
).bind('pending', 10).all();

// 3. Batch statisztika (~10-20ms)
const stats = await env.DB.prepare(
  'SELECT agent_id, COUNT(*) as runs, AVG(duration_ms) as avg_duration FROM agent_runs WHERE created_at > ? GROUP BY agent_id'
).bind(sinceDate).all();
```

---

## 3. Hyperdrive működése

A Hyperdrive a következőket nyújtja:

### 3.1 Connection Pooling
- Készleten tart adatbázis kapcsolatokat
- Csökkenti a connection setup időt (TCP + TLS handshake)
- **D1-nél nem releváns** — a D1 binding nem használ hagyományos TCP kapcsolatot

### 3.2 Query Caching
- Ismétlődő olvasási query-k eredményeit cache-eli
- Cache TTL konfigurálható
- **D1-nél potenciálisan hasznos** — ha sok azonos olvasási query fut

### 3.3 Wrangler konfiguráció (ha alkalmazható)

```jsonc
{
  "hyperdrive": [
    {
      "binding": "HYPERDRIVE_D1",
      "id": "<hyperdrive-config-id>"
    }
  ]
}
```

---

## 4. D1 alternatív teljesítmény javítások

Ha a Hyperdrive nem alkalmazható D1-re, a következő alternatívák vizsgálandók:

### 4.1 D1 Query Batching

```typescript
// Batch INSERT — egyetlen tranzakcióban több sor
const batch = [
  env.DB.prepare('INSERT INTO logs (msg) VALUES (?)').bind('log1'),
  env.DB.prepare('INSERT INTO logs (msg) VALUES (?)').bind('log2'),
  env.DB.prepare('INSERT INTO logs (msg) VALUES (?)').bind('log3'),
];
await env.DB.batch(batch); // Egyetlen roundtrip
```

### 4.2 KV Cache réteg

```typescript
// KV-alapú cache a gyakori olvasásokhoz
async function getCachedQuery(env: Env, key: string, query: string): Promise<any> {
  // 1. KV cache ellenőrzés
  const cached = await env.BAS_CACHE.get(key, 'json');
  if (cached) return cached;

  // 2. D1 query
  const result = await env.DB.prepare(query).all();

  // 3. KV cache frissítés (60 mp TTL)
  await env.BAS_CACHE.put(key, JSON.stringify(result), { expirationTtl: 60 });

  return result;
}
```

### 4.3 Read Replica (D1 beépített)

A D1 automatikusan read replica-kat használ az edge-en. Ez a legtöbb olvasási latency problémát megoldja.

### 4.4 Indexelés optimalizálás

```sql
-- Hiányzó indexek hozzáadása a gyakori query-khez
CREATE INDEX IF NOT EXISTS idx_tasks_status_priority ON tasks(status, priority);
CREATE INDEX IF NOT EXISTS idx_agent_runs_created ON agent_runs(created_at);
CREATE INDEX IF NOT EXISTS idx_agent_runs_agent ON agent_runs(agent_id, created_at);
```

---

## 5. Mérési terv

### 5.1 Baseline mérés

```typescript
// Teljesítmény mérő utility
async function measureQuery(env: Env, name: string, queryFn: () => Promise<any>) {
  const start = performance.now();
  const result = await queryFn();
  const duration = performance.now() - start;

  console.log(`[D1 Perf] ${name}: ${duration.toFixed(2)}ms`);
  return { result, duration };
}
```

### 5.2 Mérési pontok

| Mérés | Módszer | Elfogadható | Kritikus |
|-------|---------|-------------|----------|
| Egyszerű SELECT | P95 latency | < 20 ms | > 200 ms |
| INSERT (egyedi) | P95 latency | < 50 ms | > 200 ms |
| Batch INSERT (10) | P95 latency | < 100 ms | > 500 ms |
| Aggregáció (GROUP BY) | P95 latency | < 50 ms | > 300 ms |
| Full table scan | P95 latency | < 200 ms | > 1000 ms |

---

## 6. Döntési fa

```
D1 latency > 200ms (P95)?
├── NEM → Track lezárás, nincs szükség beavatkozásra
└── IGEN → Milyen típusú query a lassú?
    ├── Olvasás → Indexelés optimalizálás + KV cache
    ├── Írás → D1 query batching
    └── Mindkettő → Hyperdrive vizsgálat (ha D1-kompatibilis)
        ├── Hyperdrive működik D1-gyel → Implementálás
        └── Nem működik → KV cache + batching kombinálás
```

---

## 7. Kockázatok

- **Hyperdrive D1 kompatibilitás:** Nem biztos, hogy működik — elsősorban külső DB-khez tervezték
- **Cache inkonzisztencia:** KV cache-nél figyelni kell a stale adatokra
- **Felesleges optimalizálás:** Ha a D1 latency elfogadható, ez a track nem szükséges
- **Költség:** Hyperdrive paid feature lehet — ellenőrizni a pricing-ot

---

## 8. Kapcsolódó fájlok

- `cloudflare/wrangler.jsonc` — D1 binding konfiguráció
- `cloudflare/src/index.ts` — D1 query-k a Worker-ben
- `src/utils/database.ts` — Lokális adatbázis kezelés (referencia)
