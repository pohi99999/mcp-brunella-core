# Fejlesztési Terv: EV Hunter & AI Research Pipeline (2026-02-02)

A BAS EV Hunter bot és az AI Research Pipeline egyesítése. Perplexity kutatás, ArXiv trendek, Dual Storage mentés.

---

## STEP 1: Függőségek

```bash
pip install pydantic requests arxiv python-dotenv
```

## STEP 2: Fájlok

- **myai/tools/integrated_research.py** – ResearchSuite (Perplexity, ArXiv)
- **myai/agents/ev_hunter/market_researcher.py** – EVMarketResearcher (autópiaci hírek)
- **myai/schemas.py** – MarketTrend Pydantic modell
- **myai/agents/ev_hunter/mega_orchestrator.py** – Központi vezérlő (ResearchSuite + jövőbeli Hunter)

## STEP 3: Integráció

- DualStorageManager (már létezik src/utils/rag.ts-ben)
- .env: PERPLEXITY_API_KEY

## STEP 4: Tesztelés

- test/ev_hunter_research.test.ts – schema és ResearchSuite elérhetőség
