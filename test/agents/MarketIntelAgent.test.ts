import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MarketIntelAgent } from '../../src/agents/MarketIntelAgent.js';
import * as pythonShell from '../../src/utils/pythonShell.js';
import { lanceDBClient } from '../../src/utils/lancedb_client.js';

// Mock PythonShell
vi.mock('../../src/utils/pythonShell.js', () => ({
    runPythonWorker: vi.fn(async (script, args) => {
        if (script === 'market_scraper.py') {
            return { title: 'Product X', price: '100', currency: 'HUF' };
        }
        if (script === 'product_valuation.py') {
            return { potential_score: 0.8, recommendation: 'BUY' };
        }
        return {};
    }),
    globalPythonShell: { run: vi.fn() }
}));

// Mock LanceDB
vi.mock('../../src/utils/lancedb_client.js', () => ({
    lanceDBClient: {
        addData: vi.fn(() => Promise.resolve()),
        query: vi.fn(() => Promise.resolve([])),
        connect: vi.fn()
    }
}));

describe('MarketIntelAgent - Market Monitoring', () => {
    let agent: MarketIntelAgent;

    beforeEach(() => {
        vi.clearAllMocks();
        agent = new MarketIntelAgent();
    });

    it('should successfully scrape, value, and store market data', async () => {
        const task = "Monitor product prices";
        const context = {
            url: "http://example.com",
            selectors: { title: ".title", price: ".price" },
            productCategory: "electronics"
        };

        const result = await agent.executeTask({ task, ...context });

        expect(pythonShell.runPythonWorker).toHaveBeenCalledWith('market_scraper.py', expect.anything());
        expect(pythonShell.runPythonWorker).toHaveBeenCalledWith('product_valuation.py', expect.anything());
        expect(lanceDBClient.addData).toHaveBeenCalledWith('market_intel_data', expect.objectContaining({
            title: 'Product X',
            recommendation: 'BUY'
        }));
        expect(result.success).toBe(true);
        expect(result.message).toContain('sikeresen gyűjtve és értékelve');
    });

    it('should fail if URL or selectors are missing', async () => {
        const task = "Monitor product prices";
        const result = await agent.executeTask({ task });

        expect(result.success).toBe(false);
        expect(result.message).toContain('URL és selectorok megadása kötelező');
    });
});
