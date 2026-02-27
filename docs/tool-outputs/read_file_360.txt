# Green Market Watcher B2B Implementation Plan

> **For Gemini:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Adaptálja a "Green Lightning" (EV Hunter) és "Industrial Machine Hunter" logikáját egy általános, B2B piacra szabott piaci/konkurencia figyelő szolgáltatássá, amely azonosítja az alulárazott/magas potenciálú termékeket/szolgáltatásokat, és automatikus riasztásokat, napi jelentéseket küld.

**Architecture:** A `MarketIntelAgent` orchestrálja a folyamatot. Egy rugalmas Python worker (`market_scraper.py`) végez webscraping-et. A `DataScientistAgent` (vagy `product_valuation.py`) értékeli és pontozza az adatokat. Az eredmények LanceDB-ben tárolódnak. Az n8n workflow-k küldenek riasztásokat és jelentéseket.

**Tech Stack:** Python (Playwright/BeautifulSoup), TypeScript (BAS Agents), LanceDB, n8n, Email/Slack API.

---

### Task 1: Általános Piaci Scraper Worker Létrehozása (Python)

**Files:**
- Create: `myai/workers/market_scraper.py`
- Test: `test/workers/test_market_scraper.py`

**Step 1: Write the failing test**

```python
# test/workers/test_market_scraper.py
import pytest
from myai.workers.market_scraper import scrape_page_data

@pytest.mark.asyncio
async def test_scrape_page_data_success():
    mock_html = """
    <html>
        <body>
            <h1 class="title">Product A</h1>
            <span class="price">123.45</span>
            <div id="availability">In Stock</div>
        </body>
    </html>
    """
    selectors = {
        "title": ".title",
        "price": ".price",
        "availability": "#availability"
    }
    results = await scrape_page_data(url="http://mockurl.com", selectors=selectors, mock_html=mock_html)
    
    assert "title" in results
    assert results["title"] == "Product A"
    assert "price" in results
    assert results["price"] == "123.45"
    assert "availability" in results
    assert results["availability"] == "In Stock"
```

**Step 2: Run test to verify it fails**

Run: `pytest test/workers/test_market_scraper.py -v`
Expected: FAIL

**Step 3: Write minimal implementation**

```python
# myai/workers/market_scraper.py
from typing import Dict, Any
from bs4 import BeautifulSoup

async def scrape_page_data(url: str, selectors: Dict[str, str], mock_html: str = None) -> Dict[str, Any]:
    # A valóságban itt Playwright vagy requests hívás lenne
    html_content = mock_html if mock_html else "<html><body></body></html>" # Mock tartalom
    soup = BeautifulSoup(html_content, 'html.parser')
    
    data = {}
    for key, selector in selectors.items():
        element = soup.select_one(selector)
        if element:
            data[key] = element.get_text(strip=True)
    return data
```

**Step 4: Run test to verify it passes**

Run: `pytest test/workers/test_market_scraper.py -v`
Expected: PASS

**Step 5: Commit**

```bash
git add myai/workers/market_scraper.py test/workers/test_market_scraper.py
git commit -m "feat(market-watcher): add general market scraper worker"
```

### Task 2: Értékbecslés és Potenciál Pontozás Worker (Python)

**Files:**
- Create: `myai/refiners/product_valuation.py`
- Test: `test/refiners/test_product_valuation.py`

**Step 1: Write the failing test**

```python
# test/refiners/test_product_valuation.py
import pytest
from myai.refiners.product_valuation import evaluate_product_potential

@pytest.mark.asyncio
async def test_evaluate_product_potential_high():
    product_data = {"price": 100, "market_average": 150, "demand_score": 0.8, "rarity": "high"}
    valuation = await evaluate_product_potential(product_data)
    assert valuation["recommendation"] == "BUY"
    assert valuation["potential_score"] > 0.7

@pytest.mark.asyncio
async def test_evaluate_product_potential_low():
    product_data = {"price": 150, "market_average": 100, "demand_score": 0.2, "rarity": "low"}
    valuation = await evaluate_product_potential(product_data)
    assert valuation["recommendation"] == "IGNORE"
    assert valuation["potential_score"] < 0.3
```

**Step 2: Run test to verify it fails**

Run: `pytest test/refiners/test_product_valuation.py -v`
Expected: FAIL

**Step 3: Write minimal implementation**

```python
# myai/refiners/product_valuation.py
from typing import Dict, Any

async def evaluate_product_potential(product_data: Dict[str, Any]) -> Dict[str, Any]:
    price = product_data.get("price", 0)
    market_average = product_data.get("market_average", price)
    demand_score = product_data.get("demand_score", 0.5)
    rarity = product_data.get("rarity", "medium")

    potential_score = (market_average - price) / market_average * 0.5 + demand_score * 0.3
    if rarity == "high":
        potential_score += 0.2

    recommendation = "WATCH"
    if potential_score > 0.7:
        recommendation = "BUY"
    elif potential_score < 0.3:
        recommendation = "IGNORE"
    
    return {"potential_score": potential_score, "recommendation": recommendation}
```

**Step 4: Run test to verify it passes**

Run: `pytest test/refiners/test_product_valuation.py -v`
Expected: PASS

**Step 5: Commit**

```bash
git add myai/refiners/product_valuation.py test/refiners/test_product_valuation.py
git commit -m "feat(market-watcher): add product valuation worker"
```

### Task 3: MarketIntelAgent TypeScript Integráció és LanceDB Tárolás

**Files:**
- Modify: `src/agents/MarketIntelAgent.ts`
- Modify: `myai/workers/market_scraper.py` (ha LanceDB specifikus bejegyzés kell)
- Test: `test/agents/MarketIntelAgent.test.ts` (új teszt metódus)

**Step 1: Write the failing test**

```typescript
// test/agents/MarketIntelAgent.test.ts (új teszt metódus)
import { describe, it, expect, vi } from 'vitest';
import { MarketIntelAgent } from '../../src/agents/MarketIntelAgent.js';
import { lanceDBClient } from '../../src/utils/lancedb_client.js';

vi.mock('../../src/utils/lancedb_client.js', () => ({
    lanceDBClient: {
        table: vi.fn(() => ({
            add: vi.fn(() => Promise.resolve()),
            query: vi.fn(() => ({ // Mock a historikus adatokhoz
                filter: vi.fn(() => ({
                    toArrow: vi.fn(() => ({
                        toArray: vi.fn(() => Promise.resolve([])),
                    })),
                })),
            })),
        }))
    }
}));

describe('MarketIntelAgent Data Processing', () => {
    it('should scrape, value, and store market data', async () => {
        const agent = new MarketIntelAgent();
        const context = {
            task: "Monitor product prices",
            url: "http://mockproductpage.com",
            selectors: { title: ".title", price: ".price" }
        };
        const result = await agent.executeTask(context);

        expect(lanceDBClient.table).toHaveBeenCalledWith('market_intel_data');
        expect(lanceDBClient.table().add).toHaveBeenCalled();
        expect(result.success).toBe(true);
        expect(result.data).toBeDefined();
    }, 10000);
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- test/agents/MarketIntelAgent.test.ts`
Expected: FAIL

**Step 3: Write minimal implementation**

```typescript
// src/agents/MarketIntelAgent.ts (módosítás)
import { BaseAgent, AgentContext, AgentResult } from './BaseAgent.js';
import { lanceDBClient } from '../utils/lancedb_client.js';
import { runPythonWorker } from '../utils/pythonShell.js'; // Python worker futtatáshoz

export class MarketIntelAgent extends BaseAgent {
    name = "market_intel";
    // ... (korábbi rész)

    async executeTask(context: AgentContext): Promise<AgentResult> {
        if (context.task === "Monitor product prices") {
            const { url, selectors } = context.context as { url: string, selectors: object };

            // 1. Scraping
            const scrapedData = await runPythonWorker('market_scraper.py', { url, selectors });

            // 2. Valuation (mockolva a python worker-rel)
            const valuationResult = await runPythonWorker('product_valuation.py', scrapedData);

            const marketData = {
                ...scrapedData,
                ...valuationResult,
                timestamp: new Date().toISOString(),
                url: url
            };

            // 3. Store in LanceDB
            const marketIntelTable = lanceDBClient.table('market_intel_data');
            await marketIntelTable.add([marketData]);

            return { success: true, message: "Market data scraped, valued, and stored.", data: marketData };
        }
        return { success: false, message: "Unknown task", data: null };
    }
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- test/agents/MarketIntelAgent.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/agents/MarketIntelAgent.ts test/agents/MarketIntelAgent.test.ts
git commit -m "feat(market-watcher): integrate scraper, valuation and LanceDB storage into MarketIntelAgent"
```

### Task 4: Automatikus Riasztások és Jelentések (n8n & Email/Slack)

**Files:**
- Create: `n8n/workflows/market_watcher_report.json`
- Modify: `src/agents/MarketIntelAgent.ts` (ha riasztásokat küld az n8n-nek)

**Step 1: Write the n8n Workflow**
Készítsd el az `n8n/workflows/market_watcher_report.json` workflow-t. Ez tartalmazza a Cron triggert, LanceDB lekérdezést (új "BUY" ajánlásokra), email generálást és Slack üzenetküldést.

**Step 2: Implement Alerting Logic (TypeScript)**
A `MarketIntelAgent.ts`-ben implementáld azt a logikát, ami n8n-en keresztül riasztást küld, ha egy termék `recommendation` = `BUY` és a `potential_score` magasabb egy bizonyos értéknél. Ehhez használhatod az `n8n_webhook.ts` tool-t, ha van ilyen.

**Step 3: Commit**

```bash
git add n8n/workflows/market_watcher_report.json src/agents/MarketIntelAgent.ts
git commit -m "feat(market-watcher): add n8n alerts and reporting"
```

### Task 5: Szolgáltatás Csomagolása & Ügyfélportál

**Files:**
- Create: `docs/services/green-market-watcher.md`
- Create: `src/dashboard/components/MarketWatcherConfig.tsx` (mini ügyfélportál)

**Step 1: Create Service Documentation**
Írd meg a `docs/services/green-market-watcher.md` fájlt, amely leírja a szolgáltatás működését, az üzleti modellt (havi előfizetés), és a konfigurációs lehetőségeket.

**Step 2: Create Client Configuration UI**
Készítsd el a `src/dashboard/components/MarketWatcherConfig.tsx` React komponenst, ahol a felhasználó (kliens) beállíthatja a figyelt URL-eket, selectorokat, kulcsszavakat és az értesítési preferenciákat.

**Step 3: Commit**

```bash
git add docs/services/green-market-watcher.md src/dashboard/components/MarketWatcherConfig.tsx
git commit -m "docs(market-watcher): add service documentation and client UI"
```
