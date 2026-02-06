# Specifikáció: EV Hunter & AI Research Pipeline (2026-02-02)

## 1. Áttekintés

Az EV Hunter bot kiegészítése AI Research eszközökkel: Perplexity (piaci hírek), ArXiv (technológiai trendek), Dual Storage mentés.

## 2. Technikai Követelmények

### 2.1 ResearchSuite (myai/tools/integrated_research.py)
- **market_search(query)** – Perplexity API, real-time piaci hírek
- **tech_trends(topic)** – ArXiv API, technológiai trendek (pl. akkumulátor)

### 2.2 EVMarketResearcher (myai/agents/ev_hunter/market_researcher.py)
- **get_latest_ev_trends(region)** – régió-specifikus EV piaci hírek

### 2.3 Schemas (myai/schemas.py)
- **MarketTrend** – region, news_summary, impact_on_prices, timestamp

### 2.4 MegaOrchestrator (myai/agents/ev_hunter/mega_orchestrator.py)
- ResearchSuite integráció
- Jövőbeli: EVHunterBot, ReportGenerator (stub)

## 3. Elfogadási Kritériumok

- [x] integrated_research.py létrehozva
- [x] market_researcher.py létrehozva
- [x] schemas.py MarketTrend
- [x] mega_orchestrator.py (ResearchSuite only, minimal)
- [x] .env PERPLEXITY_API_KEY dokumentálva
