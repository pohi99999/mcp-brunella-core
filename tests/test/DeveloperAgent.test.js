import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DeveloperAgent } from '@packages/agents/DeveloperAgent.js';
import * as llmClient from '@packages/core-logic/llm_client.js';
import * as pythonShell from '@packages/utils/pythonShell.js';
import fs from 'fs/promises';
import { execSync } from 'child_process';
// Mock dependencies
vi.mock('@packages/core-logic/llm_client.js');
vi.mock('@packages/utils/pythonShell.js');
vi.mock('fs/promises');
vi.mock('child_process');
vi.mock('@packages/utils/logger.js', () => ({
    logInfo: vi.fn(),
    logError: vi.fn(),
    setAgentStatus: vi.fn()
}));
describe('DeveloperAgent', () => {
    let agent;
    beforeEach(() => {
        vi.clearAllMocks();
        agent = new DeveloperAgent();
        llmClient.generateResponse.mockResolvedValue('// Generated Code');
        pythonShell.globalPythonShell.run.mockResolvedValue('Python Output');
        fs.mkdir.mockResolvedValue(undefined);
        fs.writeFile.mockResolvedValue(undefined);
        execSync.mockReturnValue('Command Output');
    });
    it('should route to code generation handler', async () => {
        const result = await agent.execute('Create a TypeScript function to calculate fibonacci');
        expect(llmClient.generateResponse).toHaveBeenCalledWith(expect.stringContaining('System Prompt:'), 'github', 'gpt-4o');
        expect(result.status).toBe('success');
        expect(result.data.code).toBe('// Generated Code');
    });
    it('should route to test generation handler', async () => {
        const result = await agent.execute('Write vitest tests for the fibonacci function');
        expect(llmClient.generateResponse).toHaveBeenCalledWith(expect.stringContaining('System Prompt:'), 'github', 'gpt-4o');
        expect(result.status).toBe('success');
    });
    it('should route to error handler', async () => {
        const result = await agent.execute('Fix this error: TypeError: undefined is not a function', {
            error: 'TypeError: undefined is not a function'
        });
        expect(llmClient.generateResponse).toHaveBeenCalledWith(expect.stringContaining('Fix this error'), 'github', 'gpt-4o');
        expect(result.status).toBe('success');
    });
    it('should route to python execution handler', async () => {
        const result = await agent.execute('Calculate 50th factorial using python', {
            code: 'import math; print(math.factorial(50))'
        });
        expect(pythonShell.globalPythonShell.run).toHaveBeenCalledWith('import math; print(math.factorial(50))');
        expect(result.status).toBe('success');
        expect(result.data.output).toBe('Python Output');
    });
    it('should auto-save and try build when filePath provided in code gen', async () => {
        execSync.mockReturnValue(''); // Build success
        await agent.execute('Create a component', { filePath: 'src/components/Test.tsx' });
        expect(fs.writeFile).toHaveBeenCalledWith('src/components/Test.tsx', '// Generated Code', 'utf-8');
        expect(execSync).toHaveBeenCalledWith('npm run build', expect.anything());
    });
    it('should attempt self-healing if build fails', async () => {
        const buildError = new Error('Build Failed');
        buildError.stdout = 'TS2304: Cannot find name "foo"';
        execSync
            .mockImplementationOnce(() => { throw buildError; }) // First build fails
            .mockReturnValue(''); // Second build (after fix) succeeds
        llmClient.generateResponse
            .mockResolvedValueOnce('// Bad Code') // Initial gen
            .mockResolvedValueOnce('// Fixed Code'); // Fix gen
        const result = await agent.execute('Create a broken component', { filePath: 'src/broken.ts' });
        expect(llmClient.generateResponse).toHaveBeenCalledTimes(2); // 1 gen + 1 fix
        expect(fs.writeFile).toHaveBeenCalledTimes(2); // 1 save bad + 1 save fixed
        expect(result.message).toContain('Build auto-fixed');
    });
});
