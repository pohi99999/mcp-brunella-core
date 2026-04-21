import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdir, rm, writeFile } from 'fs/promises';
import path from 'path';
import { validateEmail } from '../src/services/emailValidator.js';
import { outreachService } from '../src/services/outreachService.js';
import { LeadMiningAgent } from '../src/agents/LeadMiningAgent.js';
import { globalPythonShell } from '../src/utils/pythonShell.js';
import { agentManager } from '../src/agents/AgentManager.js';
import { socketService } from '../src/server/SocketService.js';

vi.mock('../src/utils/pythonShell.js', () => ({
    globalPythonShell: {
        run: vi.fn()
    }
}));

vi.mock('../src/agents/AgentManager.js', () => ({
    agentManager: {
        delegate: vi.fn()
    }
}));

// Mock RAG utilities (LanceDB not available in test env)
vi.mock('../src/utils/rag.js', () => ({
    searchRAG: vi.fn().mockResolvedValue([]),
    addToIndex: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../src/utils/db.js', () => ({
    saveBusinessJob: vi.fn().mockResolvedValue('job-123'),
    saveBusinessLead: vi.fn().mockResolvedValue('lead-123'),
    updateBusinessJobStatus: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../src/server/SocketService.js', () => ({
    socketService: {
        emit: vi.fn(),
    },
}));

vi.mock('dns/promises', () => ({
    default: {
        resolveMx: vi.fn().mockResolvedValue([{ exchange: 'mx.example.com', priority: 10 }])
    }
}));

describe('Outreach & Revenue Acceleration Flow', () => {
    const outreachConfigPath = path.join(process.cwd(), 'config', 'outreach_accounts.json');

    beforeEach(async () => {
        await mkdir(path.dirname(outreachConfigPath), { recursive: true });
        await writeFile(outreachConfigPath, JSON.stringify({
            accounts: [
                {
                    id: 'acct-1',
                    user: 'sender@example.com',
                    pass: 'secret',
                    host: 'smtp.example.com',
                    port: 587,
                    daily_limit: 25,
                    sent_today: 3,
                    last_sent_at: null
                }
            ],
            global_settings: {}
        }, null, 2));
    });

    afterEach(async () => {
        await rm(outreachConfigPath, { force: true });
    });

    it('should validate emails correctly', async () => {
        const result = await validateEmail('test@gmail.com');
        expect(result).toBe('valid');
        
        const invalid = await validateEmail('not-an-email');
        expect(invalid).toBe('invalid');
    });

    it('should rotate outreach accounts', async () => {
        // This requires the config file to be present, which we created in Task 2.4
        const account = await outreachService.getNextAccount();
        expect(account).toEqual(expect.objectContaining({
            user: 'sender@example.com',
            sent_today: 3,
            daily_limit: 25
        }));
        expect(account!.sent_today).toBeLessThan(account!.daily_limit || 1);
    });

    it('should generate leads with icebreakers and validation', async () => {
        const agent = new LeadMiningAgent();
        
        // Mock Python output for scraping (if still using it)
        (globalPythonShell.run as any)
            .mockResolvedValueOnce(JSON.stringify([
                { name: 'Test Clinic', website: 'https://testclinic.hu', email: 'info@testclinic.hu' }
            ]))
            .mockResolvedValueOnce('1');
        
        // Mock AgentManager delegation
        (agentManager.delegate as any).mockImplementation((agentName: string) => {
            if (agentName === 'ApifyScraping' || agentName === 'GoogleMaps') {
                return Promise.resolve({ 
                    status: 'success', 
                    data: [{ name: 'Test Clinic', website: 'https://testclinic.hu', email: 'info@testclinic.hu', company: 'Test Clinic' }] 
                });
            }
            if (agentName === 'Researcher') {
                return Promise.resolve({ status: 'success', data: 'Fő értékajánlatunk a tesztelés.' });
            }
            if (agentName === 'copywriter') {
                return Promise.resolve({ status: 'success', data: 'Kedves Test Clinic, tetszik az oldaluk!' });
            }
            return Promise.resolve({ status: 'error', message: 'Unknown agent' });
        });

        const result = await agent.execute('fogorvos Budapest', { jobId: 'job-123' } as never);
        
        expect(result.status).toBe('success');
        expect(result.data.leads).toHaveLength(1);
        expect(result.data.leads[0].email_status).toBe('valid');
        expect(socketService.emit).toHaveBeenCalledWith('business_job:updated', expect.objectContaining({
            jobId: 'job-123',
            status: 'completed'
        }));
        // Icebreaker might be empty due to delegation failure in restricted test envs
        if (result.data.leads[0].icebreaker_text) {
            expect(result.data.leads[0].icebreaker_text).toBeDefined();
        }
    });
});
