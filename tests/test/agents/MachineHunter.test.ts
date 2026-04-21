import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MarketIntelAgent } from '../../src/agents/MarketIntelAgent.js';
import { runPythonWorker } from '../../src/utils/pythonShell.js';
import { getWorkspaceClient } from '../../src/tools/unifiedWorkspace.js';

// Mock dependencies
vi.mock('../../src/utils/pythonShell.js', () => ({
    runPythonWorker: vi.fn()
}));

vi.mock('../../src/tools/unifiedWorkspace.js', () => ({
    getWorkspaceClient: vi.fn().mockResolvedValue({
        createEmailDraft: vi.fn().mockResolvedValue({ url: 'http://mail.google.com/draft/123' })
    })
}));

vi.mock('../../src/utils/lancedb_client.js', () => ({
    lanceDBClient: {
        addData: vi.fn().mockResolvedValue(true)
    }
}));

describe('MarketIntelAgent - Machine Hunter', () => {
    let agent: MarketIntelAgent;

    beforeEach(() => {
        agent = new MarketIntelAgent();
        vi.clearAllMocks();
    });

    it('should successfully execute a full machine hunt with outreach', async () => {
        // Mock scraper output
        (runPythonWorker as any).mockResolvedValueOnce([
            { title: 'CNC Pro 3000', price: 5000, currency: 'EUR', source: 'MachineryPark', url: 'http://test.com' }
        ]);

        // Mock valuation output (High potential)
        (runPythonWorker as any).mockResolvedValueOnce({
            potential_score: 0.9,
            recommendation: 'BUY',
            profit_estimate: 1500
        });

        const result = await agent.executeTask({
            task: 'machine hunt',
            query: 'CNC machine'
        });

        expect(result.success).toBe(true);
        expect(result.message).toContain('outreach folyamat elindítva');
        expect(result.data.outreach_triggered).toBe(1);
        
        // Verify outreach was called
        const workspace = await getWorkspaceClient();
        expect(workspace.createEmailDraft).toHaveBeenCalled();
    });

    it('should skip outreach if potential is low', async () => {
        (runPythonWorker as any).mockResolvedValueOnce([
            { title: 'Old Lathe', price: 2000, currency: 'EUR', source: 'MachineryPark', url: 'http://test.com' }
        ]);

        (runPythonWorker as any).mockResolvedValueOnce({
            potential_score: 0.4,
            recommendation: 'HOLD',
            profit_estimate: 100
        });

        const result = await agent.executeTask({
            task: 'machine hunt'
        });

        expect(result.success).toBe(true);
        expect(result.data.outreach_triggered).toBe(0);
    });
});
