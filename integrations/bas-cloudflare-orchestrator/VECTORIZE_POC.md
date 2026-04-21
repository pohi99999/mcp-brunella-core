# Cloudflare Vectorize - Proof of Concept

## Overview

Cloudflare Vectorize is a globally distributed vector database for storing and querying embeddings at the edge. This document outlines the POC setup for BAS (Brunella Agent System).

## Setup Instructions

### 1. Create Vectorize Index

```bash
cd bas-cloudflare-orchestrator
wrangler vectorize create bas-knowledge-index --dimensions=768 --metric=cosine
```

**Note:** `nomic-embed-text` uses 768 dimensions. If using a different model (e.g., OpenAI ada-002 = 1536), adjust accordingly.

**Output:**

```
✅ Successfully created index: bas-knowledge-index
   ID: <index-id>
   Dimensions: 768
   Metric: cosine
```

### 2. Update wrangler.jsonc

Add Vectorize binding to `bas-cloudflare-orchestrator/wrangler.jsonc`:

```jsonc
{
  "name": "bas-orchestrator",
  "vectorize": [
    {
      "binding": "VECTORIZE",
      "index_name": "bas-knowledge-index"
    }
  ],
  // ... existing bindings (AI, KV, R2, D1)
}
```

### 3. Worker Implementation

The Worker now includes a `/vectorize/search` endpoint (see `src/index.ts`).

**Usage:**

```bash
curl -X POST https://bas-orchestrator.workers.dev/vectorize/search \
  -H "Content-Type: application/json" \
  -d '{
    "query": "Agent permissions system",
    "topK": 5
  }'
```

**Response:**

```json
{
  "success": true,
  "query": "Agent permissions system",
  "results": [
    {
      "id": "doc-123",
      "score": 0.92,
      "metadata": {
        "filePath": "src/agents/permissions.ts",
        "content": "Permission check implementation..."
      }
    }
  ]
}
```

### 4. Populate Index (Initial Data)

Two approaches:

#### A. From Local LanceDB (Python script)

```python
# scripts/sync_vectorize.py
import lancedb
import requests

db = lancedb.connect("./data/brunella_lancedb")
table = db.open_table("harvest")

# Batch upload to Vectorize via Worker
for batch in table.to_batches(batch_size=100):
    requests.post(
        "https://bas-orchestrator.workers.dev/vectorize/upsert",
        json={"vectors": batch.to_pylist()}
    )
```

#### B. Direct Wrangler CLI

```bash
wrangler vectorize insert bas-knowledge-index \
  --vectors '[{"id":"1","values":[0.1,0.2,...],"metadata":{"source":"readme"}}]'
```

### 5. Test Query

```typescript
// In BAS code
import fetch from 'node-fetch';

const response = await fetch('https://bas-orchestrator.workers.dev/vectorize/search', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    query: 'How do I create a new agent?',
    topK: 3
  })
});

const results = await response.json();
console.log(results);
```

---

## Architecture Decision: LanceDB vs Vectorize

### Use Both (Hybrid Approach - RECOMMENDED)

| Storage | Role | Use Case |
|---------|------|----------|
| **LanceDB (Local)** | Master Write Database | Real-time writes, full control, no network latency |
| **Vectorize (Edge)** | Read-Only Replica | Fast global queries, caching, reduced localhost dependency |

**Sync Strategy:**

1. All harvests write to LanceDB immediately
2. Cron job (or webhook) syncs LanceDB → Vectorize daily
3. BAS queries Vectorize for RAG (faster, cached)
4. Fall back to LanceDB if Vectorize unavailable

**Benefits:**

- ✅ Zero-latency writes (LanceDB local)
- ✅ Fast global reads (Vectorize CDN)
- ✅ Backup redundancy (two sources)
- ✅ Offline resilience (LanceDB still works)

---

## API Reference

### POST /vectorize/search

**Request:**

```json
{
  "query": "string",
  "topK": 5
}
```

**Response:**

```json
{
  "success": true,
  "query": "string",
  "results": [
    {
      "id": "string",
      "score": 0.95,
      "metadata": {}
    }
  ]
}
```

### POST /vectorize/upsert (Admin Only)

**Request:**

```json
{
  "vectors": [
    {
      "id": "doc-123",
      "values": [0.1, 0.2, ...],
      "metadata": { "source": "file.ts" }
    }
  ]
}
```

---

## Limitations (Free Tier)

- **5 million dimensions stored** (~6,500 documents @ 768 dims)
- **100,000 queries/month** (~3,300/day)
- **30 queries/second** burst rate

For BAS: This is **more than sufficient** for early usage.

---

## Next Steps (Post-POC)

1. ✅ Create Vectorize index (wrangler)
2. ✅ Add Worker endpoint
3. ⏳ Test single query
4. ⏳ Build sync script (LanceDB → Vectorize)
5. ⏳ Integrate into RAG pipeline
6. ⏳ Monitor usage in CF Dashboard

---

**Status:** Ready for testing  
**Created:** 2026-02-10  
**Owner:** Brunella Core Team
