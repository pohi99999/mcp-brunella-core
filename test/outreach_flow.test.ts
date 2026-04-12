import { describe, it, expect, vi, beforeEach } from 'vitest';
import { validateEmail } from '../src/services/emailValidator.js';
import { outreachService } from '../src/services/outreachService.js';
import { LeadMiningAgent } from '../src/agents/LeadMiningAgent.js';
import { globalPythonShell } from '../src/utils/pythonShell.js';

vi.mock('../src/utils/pythonShell.js', () => ({
    globalPythonShell: {
        run: vi.fn()
    }
}));

// Mock RAG utilities (LanceDB not available in test env)
vi.mock('../src/utils/rag.js', () => ({
    searchRAG: vi.fn().mockResolvedValue([]),
    addToIndex: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../src/utils/db.js', () => ({
    saveBusinessJob: vi.fn().mockResolvedValue('job-123'),
    saveBusinessLead: vi.fn().mockResolvedValue('lead-123')
}));

vi.mock('dns/promises', () => ({
    default: {
        resolveMx: vi.fn().mockResolvedValue([{ exchange: 'mx.example.com', priority: 10 }])
    }
}));

describe('Outreach & Revenue Acceleration Flow', () => {
    
    it('should validate emails correctly', async () => {
        const result = await validateEmail('test@gmail.com');
        expect(result).toBe('valid');
        
        const invalid = await validateEmail('not-an-email');
        expect(invalid).toBe('invalid');
    });

    it('should rotate outreach accounts', async () => {
        // This requires the config file to be present, which we created in Task 2.4
        const account = await outreachService.getNextAccount();
        expect(account).toBeDefined();
        expect(account?.sent_today).toBeLessThan(account?.daily_limit || 1);
    });

    it('should generate leads with icebreakers and validation', async () => {
        const agent = new LeadMiningAgent();
        
        // Mock Python output for scraping
        (globalPythonShell.run as any).mockResolvedValueOnce(JSON.stringify([
            { name: 'Test Clinic', website: 'https://testclinic.hu', email: 'info@testclinic.hu' }
        ]));
        
        // Mock Python output for icebreaker
        (globalPythonShell.run as any).mockResolvedValueOnce(JSON.stringify("Kedves Test Clinic, tetszik az oldaluk!"));

        const result = await agent.execute('fogorvos Budapest');
        
        expect(result.status).toBe('success');
        expect(result.data.leads).toHaveLength(1);
        expect(result.data.leads[0].email_status).toBe('valid');
        expect(result.data.leads[0].icebreaker_text).toContain('Kedves');
    });
});
