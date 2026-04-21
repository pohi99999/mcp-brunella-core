import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RobotkezV2Agent } from '../src/agents/RobotkezV2Agent.js';
import * as robotkezProModule from '../src/services/RobotkezProService.js';
import * as llmPlanner from '../src/utils/llmPlanner.js';

const { mockEngine } = vi.hoisted(() => ({
    mockEngine: {
        sendCommand: vi.fn().mockResolvedValue({ status: 'success', data: { selector: 'button' } }),
        getLastScreenshot: vi.fn(),
        close: vi.fn(),
        forceKill: vi.fn()
    }
}));

vi.mock('../src/utils/browserEngine.js', () => ({
    getRobotkezBrowserEngine: () => mockEngine,
    getRobotkezEngineName: () => 'local'
}));

vi.mock('../src/utils/rag.js', () => ({
    searchRAG: vi.fn().mockResolvedValue([]),
    addToIndex: vi.fn().mockResolvedValue(undefined),
}));

// Mock the whole module to ensure robotkezPro is a mock
vi.mock('../src/services/RobotkezProService.js', () => {
    const mock = {
        executeAction: vi.fn().mockResolvedValue({ status: 'success', coords: { x: 100, y: 200 } }),
        getSnapshot: vi.fn().mockResolvedValue({ status: 'success', image: 'base64...' })
    };
    return {
        robotkezPro: mock,
        RobotkezProService: {
            getInstance: () => mock
        }
    };
});

describe('Robotkéz Pro (BVAB) E2E Flow', () => {
    
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should deconstruct complex n8n task and use vision-click', async () => {
        const agent = new RobotkezV2Agent();
        
        const mockPlan: any = {
            plan: [
                { action: 'navigate', url: 'http://localhost:5678', description: 'n8n megnyitása' },
                { action: 'vision-click', target: 'Add Node button', description: 'Kattintás az új node gombra' },
                { action: 'type', selector: 'input', text: 'HTTP Request', description: 'HTTP Request keresése' }
            ],
            estimatedDuration: 15000,
            backgroundEligible: false
        };
        
        vi.spyOn(llmPlanner, 'generateExecutionPlan').mockResolvedValue(mockPlan);

        const result = await agent.execute('Állíts be egy HTTP Request node-ot az n8n-en.');
        
        expect(result.status).toBe('success');
        expect(robotkezProModule.robotkezPro.executeAction).toHaveBeenCalledWith(expect.objectContaining({
            action: 'vision-click',
            target: 'Add Node button'
        }));
    });

    it('should trigger self-healing on click failure', async () => {
        const agent = new RobotkezV2Agent();

        // Ensure browser state check succeeds so it doesn't consume the error
        mockEngine.sendCommand.mockResolvedValue({ status: 'success', data: {} });
        
        // 1. Specific action attempt fails
        mockEngine.sendCommand.mockImplementation(async (cmd: any) => {
            if (cmd.action === 'click') return { status: 'error', message: 'Selector not found' };
            return { status: 'success' };
        });

        // 2. Vision fallback succeeds
        (robotkezProModule.robotkezPro.executeAction as any).mockResolvedValueOnce({ status: 'success', coords: { x: 500, y: 500 } });

        const mockPlan: any = {
            plan: [{ action: 'click', selector: '#wrong-id', description: 'Kattintás a mentésre' }],
            estimatedDuration: 5000,
            backgroundEligible: false
        };
        vi.spyOn(llmPlanner, 'generateExecutionPlan').mockResolvedValue(mockPlan);

        const result = await agent.execute('Kattints a mentés gombra');
        
        expect(result.status).toBe('success');
        expect(robotkezProModule.robotkezPro.executeAction).toHaveBeenCalled();
    });
});

