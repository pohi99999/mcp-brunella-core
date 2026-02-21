# Spec: Cloudflare Vectorize — Cloud RAG Memória

**Track ID:** `cloudflare_vectorize_rag_20260221`

---

## Vectorize Konfiguráció

```
Index neve: brunella-agent-memory
Dimensions: 384  (bge-small-en-v1.5 kimenete)
Metric: cosine
Max vectors: 5M (paid tier)
```

## Embedding Model

```
@cf/baai/bge-small-en-v1.5
Input: text string
Output: float[] (384 dim)
Ingyenes a Workers AI paid tier-ben
```

## Vector Metadata Schema

```typescript
interface VectorMetadata {
  text: string;           // Az eredeti szöveg (visszakereséshez)
  source: string;         // 'golden_sample' | 'tech_trend' | 'agent_result'
  agent?: string;         // Melyik agent produkálta
  timestamp?: string;     // ISO timestamp
  score?: string;         // Ha scoring releváns
}
```

## wrangler.toml bővítés

```toml
[[vectorize]]
binding = "VECTORIZE_INDEX"
index_name = "brunella-agent-memory"
```

## Env változók

```env
CF_VECTORIZE_ENABLED=true
CF_VECTORIZE_INDEX=brunella-agent-memory
```

## TypeScript interfész

```typescript
// src/utils/vectorize.ts
export interface VectorMatch {
  id: string;
  score: number;
  metadata?: VectorMetadata;
}

export async function vectorizeUpsert(id: string, text: string, metadata: VectorMetadata): Promise<void>
export async function vectorizeSearch(query: string, topK?: number): Promise<VectorMatch[]>
export async function vectorizeDelete(ids: string[]): Promise<void>
```

## Összehasonlítás LanceDB vs Vectorize

| Szempont | LanceDB (lokális) | Vectorize (CF) |
|----------|------------------|----------------|
| Elérhetőség | Csak helyi gépen | Globális edge |
| Sebesség | ~5ms | ~50ms (network) |
| Méret limit | Lemez | 5M vektor |
| Backup | Manuális | CF kezeli |
| Ár | Ingyenes | Included in Paid |
| Offline | Igen | Nem |
