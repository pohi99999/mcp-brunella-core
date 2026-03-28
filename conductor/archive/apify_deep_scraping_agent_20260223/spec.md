# Specifikáció: Apify Deep Scraping Agent
**Track ID:** `apify_deep_scraping_agent_20260223`
**Státusz:** proposed
**Prioritás:** LOW
**Forrás:** `docs/Claude-nak/fejlesztes.md` — "Research & Intelligence Agent (apify-agent-skills)"

---

## 1. Jelenlegi Helyzet

| Komponens | Státusz | Megjegyzés |
|---|---|---|
| `myai/agents/tech_harvester.py` | ✅ KÉSZ | Playwright-alapú scraper |
| `browser_worker.py` | ✅ KÉSZ | JSON extraction + structured output |
| ResearcherAgent | ✅ KÉSZ | Web kutatás (alapszintű) |
| **ApifyScrapingAgent** | ❌ HIÁNYZIK | Professzionális multi-target scraping |

A jelenlegi tech_harvester.py lokális Playwright-tal dolgozik — jó, de korlátozott. Az Apify platform kész "actor"-okat biztosít Google-hoz, LinkedIn-hez, Amazon-hoz, Twitter-hez stb., amelyek sokkal robusztusabbak (CAPTCHA kezelés, proxy rotáció, strukturált output).

---

## 2. Agent Interfész

```typescript
// src/agents/ApifyScrapingAgent.ts
export class ApifyScrapingAgent implements IAgent {
  name = 'ApifyScraping';
  role = 'Research & Intelligence — Deep Web Scraper';
  description = 'Apify platform-alapú professzionális scraping: Google, LinkedIn, e-commerce, trendek';
  capabilities = ['google_search', 'linkedin_leads', 'ecommerce_scrape', 'trend_analysis', 'social_media'];

  async execute(task: string, context?: unknown): Promise<AgentResponse>
}
```

---

## 3. Apify Actor Map

| Képesség | Apify Actor ID | Input |
|----------|----------------|-------|
| Google Search | `apify/google-search-scraper` | `{ queries, maxResultsPerPage }` |
| LinkedIn Profiles | `apify/linkedin-profile-scraper` | `{ startUrls, maxItems }` |
| Amazon Products | `apify/amazon-crawler` | `{ startUrls, maxItems }` |
| Twitter Trends | `apify/twitter-scraper` | `{ searchTerms, maxItems }` |
| General Web | `apify/web-scraper` | `{ startUrls, pageFunction }` |

---

## 4. TypeScript Implementáció

```typescript
import { ApifyClient } from 'apify-client';

const client = new ApifyClient({ token: process.env.APIFY_API_TOKEN });

async function googleSearch(query: string, limit = 10): Promise<SearchResult[]> {
  const run = await client.actor('apify/google-search-scraper').call({
    queries: query,
    maxResultsPerPage: limit,
  });
  const { items } = await client.dataset(run.defaultDatasetId).listItems();
  return items.map(item => ({
    title: item.title as string,
    url: item.url as string,
    snippet: item.description as string,
  }));
}
```

---

## 5. Tech-Harvester Pipeline Integráció

```
Apify Actor (cloud)
    │
    ▼ HTTP (Apify API)
ApifyScrapingAgent.execute()
    │
    ▼
harvest_pipeline.py (Python) — HTTP-n hívja a Node backend-et
    │
    ├── LanceDB (RAG vector search)
    └── Golden Dataset (JSONL fine-tuning)
```

---

## 6. Fontos Megjegyzések

- **APIFY_API_TOKEN** szükséges (ingyenes tier: 5$ kredit/hó)
- Ha nincs token → graceful fallback: tech_harvester.py Playwright scraper
- Actor futtatás aszinkron (polling szükséges a run befejezéséig)
- Eredmények automatikusan kerülnek LanceDB-be a meglévő indexelési pipeline-on

---

## 7. Függőségek

- `apify-client` npm csomag
- `APIFY_API_TOKEN` env var
- `myai/tools/harvest_pipeline.py` — meglévő pipeline
- `src/utils/rag.ts` — LanceDB indexelés
- Nincs más blocker
