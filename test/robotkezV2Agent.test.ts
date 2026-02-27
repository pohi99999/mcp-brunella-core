/**
 * RobotkezV2Agent Unit Tests
 *
 * Test Coverage:
 * - Intent parsing (magyar nyelvű parancsok)
 * - executeTask main entry point
 * - Simple plan execution (navigate, click, type, screenshot)
 * - Error handling
 *
 * @track robotkezv2-full-comet-20260215
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { RobotkezV2Agent } from '../src/agents/RobotkezV2Agent.js';
import { AgentContext } from '../src/agents/BaseAgent.js';

// Mock persistentBrowser
const mockSendCommand = vi.fn();
vi.mock('../src/utils/persistentBrowser.js', () => ({
    persistentBrowser: {
        sendCommand: (...args: any[]) => mockSendCommand(...args)
    }
}));

// Mock llmPlanner to force fallback to Phase 2 simple parsing
// (Phase 3 LLM planning has separate tests)
vi.mock('../src/utils/llmPlanner.js', () => ({
    generateExecutionPlan: vi.fn().mockRejectedValue(new Error('LLM mocked - using fallback'))
}));

// Mock logger
vi.mock('../src/utils/logger.js', () => ({
    logInfo: vi.fn(),
    logWarn: vi.fn(),
    logError: vi.fn(),
    setAgentStatus: vi.fn()
}));

// Mock backgroundTaskManager (Phase 4.4)
vi.mock('../src/utils/backgroundTaskManager.js', () => ({
    backgroundTaskManager: {
        startTask: vi.fn().mockResolvedValue('mock_task_id_123'),
        getTaskStatus: vi.fn().mockReturnValue(null),
        cancelTask: vi.fn().mockReturnValue(false),
        getAllTasks: vi.fn().mockReturnValue([])
    }
}));

describe('RobotkezV2Agent (Phase 2 - MVP)', () => {
    let agent: RobotkezV2Agent;

    beforeEach(() => {
        agent = new RobotkezV2Agent();
        mockSendCommand.mockClear();
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    describe('Agent Metadata', () => {
        it('should have correct name and properties', () => {
            expect(agent.name).toBe('RobotkezV2');
            expect(agent.role).toBe('Magyar Agentic Browser (Comet Stílus)');
            expect(agent.capabilities).toContain('agentic_browsing');
            expect(agent.capabilities).toContain('magyar_nyelv');
        });
    });

    describe('Intent Parsing - Navigáció', () => {
        it('should parse "navigálj a google.com-ra" as navigate intent', async () => {
            mockSendCommand.mockResolvedValueOnce({ status: 'success', url: 'https://google.com' });
            mockSendCommand.mockResolvedValueOnce({ status: 'success' }); // screenshot

            const context: AgentContext = {
                task: 'navigálj a https://google.com oldalra'
            };

            const result = await agent.executeTask(context);

            expect(result.success).toBe(true);
            expect(result.message).toContain('google.com');
            expect(mockSendCommand).toHaveBeenCalledWith({
                action: 'navigate',
                url: 'https://google.com'
            });
        });

        it('should fallback to Google search if no URL in navigate command', async () => {
            mockSendCommand.mockResolvedValueOnce({ status: 'success', url: 'https://www.google.com/search?q=TypeScript' });
            mockSendCommand.mockResolvedValueOnce({ status: 'success' }); // screenshot

            const context: AgentContext = {
                task: 'navigálj TypeScript'
            };

            const result = await agent.executeTask(context);

            expect(result.success).toBe(true);
            expect(mockSendCommand).toHaveBeenCalledWith(
                expect.objectContaining({
                    action: 'navigate',
                    url: expect.stringContaining('google.com/search?q=TypeScript')
                })
            );
        });

        it('should parse "keress rá a..."', async () => {
            mockSendCommand.mockResolvedValueOnce({ status: 'success', url: 'https://www.google.com/search?q=AI' });
            mockSendCommand.mockResolvedValueOnce({ status: 'success' });

            const context: AgentContext = {
                task: 'keress rá a legújabb AI hírekre'
            };

            const result = await agent.executeTask(context);

            expect(result.success).toBe(true);
            // expect(mockSendCommand.mock.calls[0][0].url).toContain('google.com/search');
            expect(mockSendCommand).toHaveBeenCalledWith(
                expect.objectContaining({
                    url: expect.stringContaining('google.com/search')
                })
            );
        });
    });

    describe('Intent Parsing - Kattintás', () => {
        it('should parse "kattints a ".button"-ra" as click intent', async () => {
            mockSendCommand.mockResolvedValueOnce({ status: 'success' }); // click
            mockSendCommand.mockResolvedValueOnce({ status: 'success' }); // screenshot

            const context: AgentContext = {
                task: 'kattints a ".login-button"-ra'
            };

            const result = await agent.executeTask(context);

            expect(result.success).toBe(true);
            expect(result.message).toContain('.login-button');
            expect(mockSendCommand).toHaveBeenCalledWith({
                action: 'click',
                selector: '.login-button'
            });
        });

        it('should default to .primary-button if no selector specified', async () => {
            mockSendCommand.mockResolvedValueOnce({ status: 'success' });
            mockSendCommand.mockResolvedValueOnce({ status: 'success' });

            const context: AgentContext = {
                task: 'kattints'
            };

            const result = await agent.executeTask(context);

            expect(result.success).toBe(true);
            // expect(mockSendCommand.mock.calls[0][0].selector).toBe('.primary-button');
            expect(mockSendCommand).toHaveBeenCalledWith(
                expect.objectContaining({
                    selector: '.primary-button'
                })
            );
        });
    });

    describe('Intent Parsing - Gépelés', () => {
        it('should parse "írj be \'Hello\'" as type intent', async () => {
            mockSendCommand.mockResolvedValueOnce({ status: 'success' }); // type
            mockSendCommand.mockResolvedValueOnce({ status: 'success' }); // screenshot

            const context: AgentContext = {
                task: "írj be 'Hello World'"
            };

            const result = await agent.executeTask(context);

            expect(result.success).toBe(true);
            expect(result.message).toContain('Hello World');
            expect(mockSendCommand).toHaveBeenCalledWith({
                action: 'type',
                selector: 'input',
                text: 'Hello World'
            });
        });

        it('should extract selector from "gépelj be a \'input#email\' mezőbe"', async () => {
            mockSendCommand.mockResolvedValueOnce({ status: 'success' });
            mockSendCommand.mockResolvedValueOnce({ status: 'success' });

            const context: AgentContext = {
                task: 'gépelj be \'test@example.com\' a "input#email" mezőbe'
            };

            const result = await agent.executeTask(context);

            expect(result.success).toBe(true);
        });
    });

    describe('Intent Parsing - Screenshot', () => {
        it('should parse "készíts képernyőképet" as screenshot intent', async () => {
            mockSendCommand.mockResolvedValueOnce({ status: 'success' }); // screenshot (intent)
            mockSendCommand.mockResolvedValueOnce({ status: 'success' }); // screenshot (auto)

            const context: AgentContext = {
                task: 'készíts képernyőképet'
            };

            const result = await agent.executeTask(context);

            expect(result.success).toBe(true);
            expect(result.message).toContain('képernyőképet');
            expect(mockSendCommand).toHaveBeenCalledWith({ action: 'screenshot' });
        });
    });

    describe('Default Behavior - Google Search', () => {
        it.skip('should default to Google search for unknown commands', async () => {
            mockSendCommand.mockResolvedValueOnce({ status: 'success', url: 'https://www.google.com/search?q=random' });
            mockSendCommand.mockResolvedValueOnce({ status: 'success' });

            const context: AgentContext = {
                task: 'valami random szöveg ami nem parancs'
            };

            const result = await agent.executeTask(context);

            expect(result.success).toBe(true);
            // expect(mockSendCommand.mock.calls[0][0].url).toContain('google.com/search');
            expect(mockSendCommand).toHaveBeenCalledWith(
                expect.objectContaining({
                    url: expect.stringContaining('google.com/search')
                })
            );
        });
    });

    describe('Error Handling', () => {
        it('should handle browser command failure gracefully', async () => {
            mockSendCommand.mockRejectedValueOnce(new Error('Browser not responding'));

            const context: AgentContext = {
                task: 'navigálj a https://test.com oldalra'
            };

            const result = await agent.executeTask(context);

            expect(result.success).toBe(false);
            expect(result.message).toContain('nem sikerült');
            expect(result.message).toContain('Browser not responding');
        });

        it('should handle empty task gracefully', async () => {
            mockSendCommand.mockResolvedValueOnce({ status: 'success', url: 'https://www.google.com/search?q=' });
            mockSendCommand.mockResolvedValueOnce({ status: 'success' });

            const context: AgentContext = {
                task: ''
            };

            const result = await agent.executeTask(context);

            // Empty task should default to Google search with empty query
            expect(result.success).toBe(true);
        });
    });

    describe('Auto Screenshot', () => {
        it('should always take screenshot after execution', async () => {
            mockSendCommand.mockResolvedValueOnce({ status: 'success', url: 'https://google.com' });
            mockSendCommand.mockResolvedValueOnce({ status: 'success' }); // screenshot

            const context: AgentContext = {
                task: 'navigálj a https://google.com oldalra'
            };

            await agent.executeTask(context);

            // Should have 2 calls: navigate + screenshot
            expect(mockSendCommand).toHaveBeenCalledTimes(2);
            expect(mockSendCommand).toHaveBeenCalledWith({ action: 'screenshot' });
        });

        it('should continue even if screenshot fails', async () => {
            mockSendCommand.mockResolvedValueOnce({ status: 'success', url: 'https://google.com' });
            mockSendCommand.mockRejectedValueOnce(new Error('Screenshot failed'));

            const context: AgentContext = {
                task: 'navigálj a https://google.com oldalra'
            };

            const result = await agent.executeTask(context);

            // Main task should still succeed even if screenshot failed
            expect(result.success).toBe(true);
        });
    });

    describe('Background Task Delegation (Phase 4.4)', () => {
        it('should delegate long tasks (> 30s) to background automatically', async () => {
            // Mock LLM to return a plan with > 30s duration
            const longPlan = {
                plan: [
                    { action: 'navigate', url: 'https://test.com', description: 'Step 1' },
                    { action: 'wait', selector: 'body', timeout: 20000, description: 'Long wait' },
                    { action: 'click', selector: '.button', description: 'Step 3' }
                ],
                estimatedDuration: 45000, // > 30s
                backgroundEligible: false,
                requiresUserInput: []
            };

            const llmPlanner = await import('../src/utils/llmPlanner.js');
            (llmPlanner.generateExecutionPlan as any).mockResolvedValueOnce(longPlan);

            mockSendCommand.mockResolvedValue({ status: 'success' });

            const context: AgentContext = {
                task: 'Végezd el ezt a hosszú műveletet'
            };

            const result = await agent.executeTask(context);

            // Should delegate to background
            expect(result.success).toBe(true);
            expect(result.message).toContain('háttérben');
            expect(result.data?.taskId).toBeDefined();
        });

        it('should delegate tasks marked as backgroundEligible', async () => {
            const backgroundPlan = {
                plan: [
                    { action: 'navigate', url: 'https://test.com', description: 'Navigate' },
                    { action: 'screenshot', description: 'Screenshot' }
                ],
                estimatedDuration: 10000, // < 30s
                backgroundEligible: true, // But explicitly marked as background
                requiresUserInput: []
            };

            const llmPlanner = await import('../src/utils/llmPlanner.js');
            (llmPlanner.generateExecutionPlan as any).mockResolvedValueOnce(backgroundPlan);

            mockSendCommand.mockResolvedValue({ status: 'success' });

            const context: AgentContext = {
                task: 'Background task test'
            };

            const result = await agent.executeTask(context);

            expect(result.success).toBe(true);
            expect(result.message).toContain('háttérben');
        });

        it('should execute short tasks (< 30s) in foreground', async () => {
            const shortPlan = {
                plan: [
                    { action: 'navigate', url: 'https://test.com', description: 'Quick nav' },
                    { action: 'screenshot', description: 'Screenshot' }
                ],
                estimatedDuration: 5000, // < 30s
                backgroundEligible: false,
                requiresUserInput: []
            };

            const llmPlanner = await import('../src/utils/llmPlanner.js');
            (llmPlanner.generateExecutionPlan as any).mockResolvedValueOnce(shortPlan);

            mockSendCommand.mockResolvedValue({ status: 'success' });

            const context: AgentContext = {
                task: 'Quick task'
            };

            const result = await agent.executeTask(context);

            // Should execute in foreground
            expect(result.success).toBe(true);
            expect(result.message).not.toContain('háttérben');
            expect(result.message).toContain('végrehajtottam');
        });

        it('should provide executeInBackground method for manual delegation', async () => {
            const plan = {
                plan: [
                    { action: 'navigate', url: 'https://test.com', description: 'Test' }
                ],
                estimatedDuration: 5000,
                backgroundEligible: false,
                requiresUserInput: []
            };

            const llmPlanner = await import('../src/utils/llmPlanner.js');
            (llmPlanner.generateExecutionPlan as any).mockResolvedValueOnce(plan);

            mockSendCommand.mockResolvedValue({ status: 'success' });

            const result = await agent.executeInBackground('Manual background test');

            expect(result.taskId).toBeDefined();
            expect(result.plan).toEqual(plan);
        });

        it('should provide background task status methods', () => {
            // getBackgroundTaskStatus
            expect(agent.getBackgroundTaskStatus('test_id')).toBeDefined();

            // cancelBackgroundTask
            const cancelled = agent.cancelBackgroundTask('non_existent');
            expect(cancelled).toBe(false);

            // listBackgroundTasks
            const tasks = agent.listBackgroundTasks();
            expect(Array.isArray(tasks)).toBe(true);
        });
    });
});
