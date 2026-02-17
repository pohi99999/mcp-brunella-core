import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { RobotkezV2Agent } from '../src/agents/RobotkezV2Agent';
import { persistentBrowser } from '../src/utils/persistentBrowser';
import { backgroundTaskManager } from '../src/utils/backgroundTaskManager';
import { generateExecutionPlan } from '../src/utils/llmPlanner';

// Mocks
vi.mock('../src/utils/persistentBrowser', () => ({
    persistentBrowser: {
        sendCommand: vi.fn(),
    }
}));

vi.mock('../src/utils/backgroundTaskManager', () => ({
    backgroundTaskManager: {
        startTask: vi.fn(),
        getTaskStatus: vi.fn(),
        cancelTask: vi.fn(),
        getAllTasks: vi.fn(),
    }
}));

vi.mock('../src/utils/llmPlanner', () => ({
    generateExecutionPlan: vi.fn(),
}));

vi.mock('../src/utils/logger', () => ({
    logInfo: vi.fn(),
    logError: vi.fn(),
    setAgentStatus: vi.fn(),
}));

describe('RobotkezV2Agent (Phase 2 - MVP)', () => {
    let agent: RobotkezV2Agent;
    let mockSendCommand: any;

    beforeEach(() => {
        agent = new RobotkezV2Agent();
        mockSendCommand = vi.mocked(persistentBrowser.sendCommand);
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('Agent Metadata', () => {
        it('should have correct name and properties', () => {
            expect(agent.name).toBe('RobotkezV2');
            // Corrected role assertion
            expect(agent.role).toBe('Magyar Agentic Browser (Comet Stílus)');
            expect(agent.capabilities).toContain('agentic_browsing');
            expect(agent.capabilities).toContain('magyar_nyelv');
        });
    });

    describe('Intent Parsing - Screenshot', () => {
        it('should parse "készíts képernyőképet" as screenshot intent', async () => {
            const task = 'Készíts képernyőképet';
            
            mockSendCommand.mockResolvedValue({ status: 'success', screenshot: 'base64img' });

            const result = await agent.executeTask({ task });

            expect(result.success).toBe(true);
            // Corrected message assertion
            expect(result.message).toContain('Elkészítettem a kért képernyőképet');
            expect(mockSendCommand).toHaveBeenCalledWith({ action: 'screenshot' });
        });
    });

    describe('Default Behavior - Google Search', () => {
        it('should default to Google search for unknown commands', async () => {
            const task = 'Mi a helyzet az AI világban?';
            
            mockSendCommand.mockResolvedValue({ status: 'success', url: 'https://google.com' });
            
            // Mock LLM planner to throw error, triggering fallback
            vi.mocked(generateExecutionPlan).mockRejectedValue(new Error('LLM error'));

            const result = await agent.executeTask({ task });

            expect(result.success).toBe(true);
            // Verify the navigate command was called with google search
            const navigateCall = mockSendCommand.mock.calls.find((call: any[]) => call[0].action === 'navigate');
            expect(navigateCall).toBeDefined();
            expect(navigateCall[0].url).toContain('google.com');
        });
    });

    describe('Error Handling', () => {
        it('should handle browser command failure gracefully', async () => {
            const task = 'Navigálj a https://test.com oldalra';
            
            mockSendCommand.mockRejectedValue(new Error('Browser not responding'));

            const result = await agent.executeTask({ task });

            expect(result.success).toBe(false);
            // Corrected expectation
            expect(result.message).toContain('nem sikerült');
            expect(result.message).toContain('Browser not responding');
        });
    });

    describe('Background Task Delegation (Phase 4.4)', () => {
        it('should delegate long tasks (> 30s) to background automatically', async () => {
            const task = 'Ez egy nagyon hosszú feladat';
            
            // Mock LLM planner to return long duration
            vi.mocked(generateExecutionPlan).mockResolvedValue({
                plan: [{ action: 'navigate', url: 'foo' }],
                estimatedDuration: 45000, // > 30s
                backgroundEligible: false
            });

            vi.mocked(backgroundTaskManager.startTask).mockResolvedValue('mock_task_id_123');

            const result = await agent.executeTask({ task });

            expect(result.success).toBe(true);
            // Corrected expectation
            expect(result.message.toLowerCase()).toContain('háttérben');
            expect(result.data?.taskId).toBeDefined();
        });

        it('should delegate tasks marked as backgroundEligible', async () => {
            const task = 'Háttérben futtatható feladat';
            
            vi.mocked(generateExecutionPlan).mockResolvedValue({
                plan: [{ action: 'navigate', url: 'foo' }],
                estimatedDuration: 10000,
                backgroundEligible: true
            });

            vi.mocked(backgroundTaskManager.startTask).mockResolvedValue('mock_task_id_123');

            const result = await agent.executeTask({ task });

            expect(result.success).toBe(true);
            // Corrected expectation
            expect(result.message.toLowerCase()).toContain('háttérben');
        });

        it('should execute short tasks (< 30s) in foreground', async () => {
            const task = 'Quick task';
            
            vi.mocked(generateExecutionPlan).mockResolvedValue({
                plan: [{ action: 'navigate', url: 'foo', description: 'Quick task' }],
                estimatedDuration: 5000,
                backgroundEligible: false
            });

            mockSendCommand.mockResolvedValue({ status: 'success' });

            const result = await agent.executeTask({ task });

            expect(result.success).toBe(true);
            expect(result.message).not.toContain('Háttérben fut');
            // Corrected expectation
            expect(result.message).toContain('Sikeresen végrehajtottam');
        });
    });
});
