# Plan: Cloudflare Vectorize — Cloud RAG Memória

**Track ID:** `cloudflare_vectorize_rag_20260221`
**Prioritás:** MEDIUM
**Státusz:** ACTIVE
**Progress:** 0%

---

## Phase 1: Vectorize index + embedding

### Wrangler parancsok

```bash
wrangler vectorize create brunella-agent-memory \
  --dimensions=384 \
  --metric=cosine
```

### Embedding generálás Workers AI-jal

```typescript
// src/utils/vectorize.ts
async function embed(text: string): Promise<number[]> {
  const res = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/ai/run/@cf/baai/bge-small-en-v1.5`,
    { method: 'POST', body: JSON.stringify({ text }) }
  );
  const data = await res.json();
  return data.result.data[0]; // 384-dimenziós vektor
}
```

### Vectorize upsert és query

```typescript
async function vectorizeUpsert(id: string, text: string, metadata: Record<string, string>) {
  const vector = await embed(text);
  await vectorizeIndex.upsert([{ id, values: vector, metadata }]);
}

async function vectorizeSearch(query: string, topK = 3): Promise<VectorMatch[]> {
  const queryVector = await embed(query);
  return vectorizeIndex.query(queryVector, { topK, returnMetadata: true });
}
```

**Becslés:** ~2 óra

---

## Phase 2: RAG utils átírása

### `src/utils/rag.ts` bővítés

```typescript
export async function searchRAG(query: string, options?: RAGOptions): Promise<string[]> {
  // 1. Vectorize (cloud, elsődleges)
  if (process.env.CF_VECTORIZE_ENABLED === 'true') {
    try {
      const results = await vectorizeSearch(query, options?.topK ?? 3);
      if (results.length > 0) return results.map(r => r.metadata?.text ?? '');
    } catch (e) {
      logWarn('RAG', `Vectorize failed, fallback LanceDB: ${e}`);
    }
  }
  // 2. LanceDB fallback (lokális)
  return searchLanceDB(query, options);
}
```

### goldenDatasetBridge.ts bővítés

```typescript
// Sikeres végrehajtás → Vectorize-ba is kerül
await vectorizeUpsert(
  `golden-${Date.now()}`,
  `${sample.instruction}\n${sample.output}`,
  { source: sample.source, agent: agentName, type: 'golden_sample' }
);
```

**Becslés:** ~1.5 óra

---

## Phase 3: LanceDB migráció + Dashboard

### Migráció script

```typescript
// scripts/migrate_lancedb_to_vectorize.ts
const table = await lancedb.openTable('tech_trends');
const rows = await table.search('').limit(1000).execute();
for (const row of rows) {
  await vectorizeUpsert(row.id, row.text, { source: row.source });
}
```

### Dashboard RAG Memory widget

```tsx
// Top 5 releváns emlék megjelenítése
const { data: memories } = useQuery('/api/rag/search?q=current+task');
```

**Becslés:** ~1 óra

---

## Összesített TODO

```
[ ] 1. wrangler vectorize create brunella-agent-memory
[ ] 2. wrangler.toml: vectorize binding
[ ] 3. src/utils/vectorize.ts: embed() + upsert() + search()
[ ] 4. src/utils/rag.ts: Vectorize elsődleges, LanceDB fallback
[ ] 5. src/core/goldenDatasetBridge.ts: Vectorize upsert
[ ] 6. scripts/migrate_lancedb_to_vectorize.ts
[ ] 7. Dashboard: RAG Memory widget
[ ] 8. npm test — ALL GREEN
[ ] 9. meta.json: progress: 100, status: completed
```

---

## Kockázatok

| Kockázat | Megoldás |
|----------|----------|
| bge-small 384 dim ≠ meglévő LanceDB dim | Új Vectorize index, párhuzamos futás átmenetben |
| Vectorize quota (paid: 5M queries/nap) | Bőven elegendő |
| Embedding lassú CF AI-on | Cache embedding-eket KV-ben (TTL: 1 nap) |
