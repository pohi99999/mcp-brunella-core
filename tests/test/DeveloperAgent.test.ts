import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DeveloperAgent } from '@packages/agents/DeveloperAgent.js';
import * as pythonShell from '@packages/utils/pythonShell.js';
import fs from 'fs/promises';
import { execSync } from 'child_process';

// Mock dependencies
const mockGenerate = vi.fn();
vi.mock('@packages/core-logic/bifrost_gateway.js', () => ({
    getBifrostGateway: () => ({
        generate: mockGenerate
    })
}));
vi.mock('@packages/utils/pythonShell.js');
vi.mock('fs/promises');
vi.mock('child_process');
vi.mock('@packages/utils/logger.js', () => ({
    logInfo: vi.fn(),
    logError: vi.fn(),
    setAgentStatus: vi.fn()
}));
vi.mock('@apps/mcp-core/server/SocketService.js', () => ({
    socketService: {
        broadcastChatter: vi.fn()
    }
}));
vi.mock('@packages/agents/specStatus.js', () => ({
    getSpecStatus: vi.fn().mockResolvedValue('approved'),
    requiresSpec: vi.fn().mockReturnValue(false)
}));

describe('DeveloperAgent', () => {
    let agent: DeveloperAgent;

    beforeEach(() => {
        vi.clearAllMocks();
        agent = new DeveloperAgent();
        mockGenerate.mockReset();
        vi.mocked(pythonShell.globalPythonShell.run).mockResolvedValue('Python Output');
        vi.mocked(fs.mkdir).mockResolvedValue(undefined);
        vi.mocked(fs.writeFile).mockResolvedValue(undefined);
        vi.mocked(execSync).mockReturnValue('Command Output');
    });

    it('should route to ReAct loop for generic tasks', async () => {
        mockGenerate.mockResolvedValueOnce({
            success: true,
            content: "Kész a feladat",
            toolCalls: undefined
        });

        const result = await agent.execute('Create a TypeScript function to calculate fibonacci');

        expect(mockGenerate).toHaveBeenCalled();
        expect(result.status).toBe('success');
        expect(result.message).toBe('Kész a feladat');
    });

    it('should use tool calling for write_file', async () => {
        mockGenerate.mockResolvedValueOnce({
            success: true,
            content: "",
            toolCalls: [{
                id: "call_1",
                function: {
                    name: "write_file",
                    arguments: JSON.stringify({ path: "src/test.ts", content: "// Code" })
                }
            }]
        });

        mockGenerate.mockResolvedValueOnce({
            success: true,
            content: "Fájl sikeresen létrehozva.",
            toolCalls: undefined
        });

        const result = await agent.execute('Write test code');

        expect(fs.writeFile).toHaveBeenCalledWith('src/test.ts', '// Code', 'utf-8');
        expect(result.status).toBe('success');
        expect(result.message).toBe('Fájl sikeresen létrehozva.');
    });

    it('should use tool calling for run_shell_command', async () => {
        mockGenerate.mockResolvedValueOnce({
            success: true,
            content: "",
            toolCalls: [{
                id: "call_1",
                function: {
                    name: "run_shell_command",
                    arguments: JSON.stringify({ command: "npm test" })
                }
            }]
        });

        mockGenerate.mockResolvedValueOnce({
            success: true,
            content: "Teszt lefutott.",
            toolCalls: undefined
        });

        await agent.execute('Futtasd a teszteket');

        expect(execSync).toHaveBeenCalledWith('npm test', expect.anything());
    });

    it('should route to python execution handler', async () => {
        const result = await agent.execute('Calculate 50th factorial using python', {
            code: 'import math; print(math.factorial(50))'
        });

        expect(pythonShell.globalPythonShell.run).toHaveBeenCalledWith('import math; print(math.factorial(50))');
        expect(result.status).toBe('success');
        expect(result.data).toEqual(expect.objectContaining({ output: 'Python Output' }));
    });

    it('should execute git branch operations', async () => {
        const result = await agent.execute('Create branch', { branchName: 'test-branch' });
        
        expect(execSync).toHaveBeenCalledWith('git checkout -b test-branch', expect.anything());
        expect(result.status).toBe('success');
    });
});
