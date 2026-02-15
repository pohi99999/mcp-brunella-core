# Cloudflare R1 (Vectorize) Vector Mappings for CEAN

**Track:** cloudflare_edge_agents_network_20260215  
**Phase:** 1B (Schema Design)  
**Date:** 2026-02-15

---

## 📊 Overview

CEAN uses **Cloudflare R1 (Vectorize)** for semantic search and RAG (Retrieval-Augmented Generation) across three main document collections:

- **research_papers** - GitHub trends, arXiv papers, technical articles (1536-dim)
- **grants** - EU/US grant opportunities with structured metadata (1536-dim)
- **harvested_data** - Raw web-scraped content needing deep analysis (3072-dim for precision)

---

## 🧠 Vector Models

### Primary: `text-embedding-3-small`
- **Provider:** OpenAI via Cloudflare Workers AI
- **Dimension:** 1536
- **Collections:** research_papers, grants
- **Latency:** ~50ms per embedding
- **Cost:** ~$0.02 per 1M tokens
- **Use Case:** Fast semantic search, filtering, recommendation

### Secondary: `text-embedding-3-large`
- **Provider:** OpenAI via Cloudflare Workers AI
- **Dimension:** 3072
- **Collections:** harvested_data
- **Latency:** ~100ms per embedding
- **Cost:** ~$0.06 per 1M tokens
- **Use Case:** Deep semantic analysis, RAG retrieval, fine-grained matching

---

## 📚 Collections

### 1️⃣ research_papers

**Purpose:** Index AI/ML research trends from GitHub, arXiv, HackerNews

**Fields:**

```json
{
  "id": "paper-{uuid}",                     // Unique ID
  "title": "Efficient Attention in Transformers",  // Paper title
  "url": "https://arxiv.org/abs/...",       // Source URL
  "source": "arxiv|github|hackernews",      // Origin
  "summary": "This paper proposes...",       // 200-500 char summary
  "authors": ["John Doe", "Jane Smith"],    // Author names
  "published_date": "2024-02",              // ISO YYYY-MM
  "relevance_score": 0.95,                  // 0-1: how relevant to our research
  "technology_tags": ["transformers", "attention", "optimization"], // Keywords
  "embedding": [...1536 floats...]          // Vector (auto-generated)
}
```

**Example Query:**
```javascript
// Find papers similar to: "LLM inference optimization"
const query_embedding = await embeddings.generate("LLM inference optimization", "text-embedding-3-small");
const results = await r1.search(query_embedding, "research_papers", { top_k: 10 });
```

**Retention:** 90 days rolling (auto-archive to D1 after 90 days)

---

### 2️⃣ grants

**Purpose:** Track EU/US/Tech funding opportunities with intelligent matching

**Fields:**

```json
{
  "id": "grant-{uuid}",                // Unique ID
  "title": "Horizon Europe R&I Grant", // Grant name
  "url": "https://cordis.ec.europa.eu/...", // Application link
  "source": "eu_cordis|nih|nsf|tech_foundation", // Grant source
  "budget_usd": 500000,                // Funding amount
  "deadline": "2026-06-30",            // ISO date
  "description": "Support innovative AI projects...", // Full description
  "eligible_countries": ["EU", "UK", "CH"], // Eligibility
  "keywords": ["AI", "LLM", "machine-learning"], // Topic tags
  "match_score": 0.87,                 // 0-1: relevance to our research areas
  "embedding": [...1536 floats...]     // Vector (auto-generated)
}
```

**Example Query:**
```javascript
// Find grants matching our AI research profile
const profile_embedding = await embeddings.generate(
  "European AI funding for LLM agents and edge computing",
  "text-embedding-3-small"
);
const matching_grants = await r1.search(
  profile_embedding,
  "grants",
  { top_k: 20, filter: { deadline: { $gte: new Date() } } }
);
```

**Retention:** 180 days rolling (keep active + upcoming grants; archive closed ones)

---

### 3️⃣ harvested_data

**Purpose:** Store raw scraped content for deep semantic analysis and extraction

**Fields:**

```json
{
  "id": "harvest-{uuid}",              // Unique ID
  "source_url": "https://example.com/article", // Original URL
  "source_domain": "example.com",      // Domain only
  "source_type": "blog|news|documentation|api", // Content type
  "title": "Article: Advanced Techniques...", // Page title
  "raw_html": "<html>...</html>",      // Original HTML (truncated)
  "extracted_text": "The article discusses...", // Text-only version
  "metadata": {                        // Extracted metadata
    "author": "John Smith",
    "publish_date": "2024-02-15",
    "word_count": 3500,
    "language": "en"
  },
  "extraction_status": "raw|extracted|enriched", // Processing state
  "embedding": [...3072 floats...]     // Vector (3072-dim for precision)
}
```

**Example Query:**
```javascript
// Find raw content similar to: "How to deploy LLM models on edge"
const query_embedding = await embeddings.generate(
  "How to deploy large language models on edge computing platforms",
  "text-embedding-3-large"  // 3072-dim for better precision
);
const relevant_content = await r1.search(
  query_embedding,
  "harvested_data",
  {
    top_k: 50,
    filter: {
      extraction_status: "enriched",
      "metadata.language": "en"
    }
  }
);
```

**Retention:** 30 days rolling (archive to D1, delete after 30 days unless starred)

---

## 🔄 Data Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                        EDGE AGENTS                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. Research Agent → GitHub/arXiv/HN → extract papers          │
│     ↓                                                           │
│     Generate embedding (text-embedding-3-small)                │
│     ↓                                                           │
│     Insert into R1 "research_papers" collection               │
│     + Store metadata in D1 (edge_results)                     │
│                                                                 │
│  2. Grant Monitor → EU CORDIS/NSF/NIH → extract grants        │
│     ↓                                                           │
│     Generate embedding + relevance score                       │
│     ↓                                                           │
│     Insert into R1 "grants" collection                        │
│     + Notify if match_score > 0.8                             │
│                                                                 │
│  3. Data Harvester → Playwright → scrape URLs                 │
│     ↓                                                           │
│     Store raw HTML in D1 (edge_results)                       │
│     + Mark as "raw"                                            │
│                                                                 │
│  4. Data Extractor → LLM structured extraction                │
│     ↓                                                           │
│     Extract text/metadata from HTML                            │
│     ↓                                                           │
│     Generate embedding (text-embedding-3-large)               │
│     ↓                                                           │
│     Insert into R1 "harvested_data" collection                │
│     + Update D1 status to "enriched"                          │
│                                                                 │
│  5. RAG/Search → Query → Embedding → R1 search               │
│     ↓                                                           │
│     Return top-k results + fetch full content from D1         │
│     ↓                                                           │
│     Feed into LLM for final analysis                          │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🛠️ Implementation Details

### R1 API Endpoints

**Insert/Update Document:**
```javascript
await r1.put("research_papers", {
  id: "paper-001",
  title: "...",
  embedding: [...1536 values...],
  // ... other fields
});
```

**Search by Vector:**
```javascript
const results = await r1.search(
  query_embedding,  // [1536] or [3072] floats
  "research_papers", // collection name
  {
    top_k: 10,
    threshold: 0.7,  // Minimum similarity score
    filter: {       // Optional metadata filtering
      source: "arxiv",
      published_date: { $gte: "2023-01" }
    }
  }
);
```

**Delete Document:**
```javascript
await r1.delete("research_papers", "paper-001");
```

---

## 📊 Indexing Strategy

### Batch Indexing (Daily)
- Run **Embedding Generation** worker
- Process 1000+ documents/batch
- Insert vectors into R1 collections
- Update D1 timestamps (`synced_to_r1_at`)

### Real-time Indexing (On-demand)
- When Data Extractor completes processing
- Immediately generate embedding
- Push to R1 within 5 seconds

### Caching Strategy
- Cache recent queries (last 10 searches)
- Use D1 as source-of-truth for metadata
- R1 = vector index only (always rebuild-able)

---

## 🎯 Search Filters & Limits

### research_papers Filters
```javascript
{
  source: ["arxiv", "github", "hackernews"],
  published_date: { $gte: "2023-01-01" },
  relevance_score: { $gte: 0.5 },
  technology_tags: { $contains: "LLM" }
}
```

### grants Filters
```javascript
{
  source: ["eu_cordis", "nih", "nsf"],
  deadline: { $gte: new Date() },
  budget_usd: { $gte: 50000, $lte: 500000 },
  eligible_countries: { $contains: "EU" }
}
```

### harvested_data Filters
```javascript
{
  source_type: ["blog", "documentation"],
  extraction_status: "enriched",
  "metadata.language": "en"
}
```

---

## 🧪 Testing

### Test Embed + Search
```bash
# 1. Test embedding generation
curl -X POST http://localhost:8000/embeddings/test \
  -H "Content-Type: application/json" \
  -d '{"text": "LLM optimization", "model": "text-embedding-3-small"}'

# 2. Test R1 insert
curl -X POST http://localhost:8000/r1/test/insert \
  -d '{ "id": "test-1", "title": "Test", "embedding": [...] }'

# 3. Test R1 search
curl -X POST http://localhost:8000/r1/test/search \
  -d '{ "query_embedding": [...], "top_k": 10 }'
```

---

## 📈 Monitoring

Track R1 health via Prometheus metrics:
- `r1_insertion_success_rate` - % of successful inserts
- `r1_search_latency_ms` - P50/P95/P99 search time
- `r1_collection_size_docs` - Document count per collection
- `r1_embedding_errors_total` - Failed embeddings

Log to D1 in `edge_metrics` table for historical analysis.

---

**Version:** 1.0.0  
**Last Updated:** 2026-02-15  
**Owner:** CEAN Phase 1B  
