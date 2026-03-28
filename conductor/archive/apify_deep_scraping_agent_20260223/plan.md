# Implementációs Terv: Apify Deep Scraping Agent
**Track ID:** `apify_deep_scraping_agent_20260223`

> LOW prioritás — a PAIOS core (Orchestrator Chat, ModelSelector) után érdemes elkezdeni.

---

## Phase 1: Apify SDK + alapstruktúra

* [ ] **Task 1.1** — `npm install apify-client`

* [ ] **Task 1.2** — `.env.example` bővítése:
  ```
  # === Apify (Professional Web Scraping) ===
  APIFY_API_TOKEN=your-apify-token-here
  ```

* [ ] **Task 1.3** — `src/agents/ApifyScrapingAgent.ts` alap struktúra (IAgent)
  - `ApifyClient` inicializálás (token env-ből)
  - Ha nincs token → warning + graceful skip (ne crashelje a rendszert)

* [ ] **Task 1.4** — `runActor(actorId, input, timeoutMs = 60000): Promise<unknown[]>`
  - Apify run elindítása
  - Polling loop (max timeoutMs) amíg a run kész
  - Dataset items visszaadása

---

## Phase 2: Specializált scraper funkciók

* [ ] **Task 2.1** — `googleSearch(query, limit)` → `SearchResult[]`

* [ ] **Task 2.2** — `linkedinLeads(searchUrl, limit)` → `LeadResult[]`
  - Megjegyzés: LinkedIn scraping Apify cookie-t igényel (dokumentáld a README-ben)

* [ ] **Task 2.3** — `ecommerceProducts(startUrl, limit)` → `ProductResult[]`

* [ ] **Task 2.4** — `trendData(topic, source)` → `TrendResult[]`

* [ ] **Task 2.5** — `execute(task, context)`:
  - task string alapján automatikus képesség-választás (regex: "google", "linkedin", "amazon", stb.)
  - context: `{ query?, url?, limit?, capability? }`

---

## Phase 3: Tech-Harvester integráció

* [ ] **Task 3.1** — `myai/config/sources.json` bővítése Apify forrásokkal:
  ```json
  {
    "source": "apify_google",
    "type": "apify",
    "actor_id": "apify/google-search-scraper",
    "query": "AI agent systems 2026",
    "limit": 20
  }
  ```

* [ ] **Task 3.2** — `myai/tools/harvest_pipeline.py` bővítése:
  - Apify típusú forrás esetén: HTTP POST `/api/agents/ApifyScraping/execute`
  - Eredmény → LanceDB indexelés (meglévő pipeline)

---

## Phase 4: Regisztráció + tesztek

* [ ] **Task 4.1** — `src/agents/registry.json` bővítése:
  ```json
  {
    "name": "ApifyScraping",
    "module": "ApifyScrapingAgent.js",
    "class": "ApifyScrapingAgent",
    "triggers": ["scrape", "google", "linkedin", "leads", "ecommerce", "apify"],
    "priority": 4
  }
  ```

* [ ] **Task 4.2** — `test/apifyScrapingAgent.test.ts`
  - Mock `apify-client`: fake dataset items
  - `googleSearch` → helyes SearchResult formátum
  - Nincs APIFY_API_TOKEN → status: 'error' + érthető üzenet
  - `execute` → capability auto-detect 'google' kulcsszó alapján

* [ ] **Task 4.3** — `npm run build && npm test` → 0 hiba

---

## 🎯 Sikerességi Kritériumok

- `ApifyScrapingAgent.execute('Keress cégeket a logisztika szektorban', { capability: 'google', query: 'logistics startups 2026' })` → SearchResult lista
- Ha nincs APIFY_API_TOKEN → graceful error (nem crash, hanem warning)
- Tech-harvester pipeline Apify forrást is feldolgoz
- LanceDB-be kerülnek a scraped adatok
- `npm run build` → 0 TypeScript hiba
- `npm test` → minden PASS
