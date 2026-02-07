import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SpecWriterAgent } from '../src/agents/SpecWriterAgent.js';
import * as llmClient from '../src/core/llm_client.js';
import fs from 'fs/promises';

// Mock dependencies
vi.mock('../src/core/llm_client.js');
vi.mock('fs/promises');
vi.mock('../src/utils/logger.js', () => ({
    logInfo: vi.fn(),
    logWarn: vi.fn(),
    logError: vi.fn(),
    setAgentStatus: vi.fn()
}));

// Mock permission system for tests
vi.mock('../src/agents/permissions.js', () => ({
    Permission: {},
    PermissionProfiles: {},
    globalPermissionManager: {
        canAccessPath: vi.fn(() => true),
        hasPermission: vi.fn(() => true),
        getAgentConfig: vi.fn(() => ({ requiresSpecApproval: false })),
        logDeniedOperation: vi.fn()
    },
    PermissionManager: vi.fn()
}));

describe('SpecWriterAgent', () => {
    let agent: SpecWriterAgent;
    let originalEnv: NodeJS.ProcessEnv;

    beforeEach(() => {
        vi.clearAllMocks();

        // Bypass spec freeze for tests
        originalEnv = process.env;
        process.env = { ...originalEnv, SKIP_SPEC_CHECK: 'true' };

        agent = new SpecWriterAgent();

        // Mock LLM response
        (llmClient.generateResponse as any).mockResolvedValue(`# Test Feature

## Összefoglaló
Ez egy teszt specifikáció.

## Követelmények
1. FR1: Funkció 1
2. FR2: Funkció 2`);

        // Mock fs operations
        (fs.mkdir as any).mockResolvedValue(undefined);
        (fs.writeFile as any).mockResolvedValue(undefined);
        (fs.readFile as any).mockResolvedValue(JSON.stringify({
            id: 'test_track',
            status: 'draft'
        }));
        (fs.readdir as any).mockResolvedValue([
            { name: 'test_track_20260207', isDirectory: () => true }
        ]);
    });

    afterEach(() => {
        process.env = originalEnv;
    });

    it('should generate spec from feature description', async () => {
        const result = await agent.execute('Generate spec for user authentication');

        expect(llmClient.generateResponse).toHaveBeenCalled();
        expect(result.status).toBe('success');
        expect((result.data as any)?.spec).toContain('# Test Feature');
    });

    it('should detect spec generation keywords', async () => {
        const tasks = [
            'Create a spec for API endpoint',
            'Write specification for login flow',
            'Generálj specifikációt',
        ];

        for (const task of tasks) {
            const result = await agent.execute(task);
            expect(result.status).toBe('success');
            expect(llmClient.generateResponse).toHaveBeenCalled();
        }
    });

    it('should create track with spec and meta.json', async () => {
        const result = await agent.execute('Create track', {
            metadata: {
                featureName: 'Test Feature',
                spec: '# Test Spec\n\nContent here',
                priority: 'high'
            }
        });

        expect(fs.mkdir).toHaveBeenCalled();
        expect(fs.writeFile).toHaveBeenCalledTimes(2); // spec.md + meta.json
        expect(result.status).toBe('success');
        expect((result.data as any)?.trackId).toMatch(/test_feature_\d{8}/);
    });

    it('should sanitize track name correctly', async () => {
        const result = await agent.execute('Create track', {
            metadata: {
                featureName: 'Felhasználó Authentikáció (API)',
                spec: '# Spec'
            }
        });

        expect(result.status).toBe('success');
        expect((result.data as any)?.trackId).toMatch(/^felhasznalo_authentikacio_api_\d{8}$/);
    });

    it('should approve spec and activate track', async () => {
        const result = await agent.execute('Approve the spec', {
            metadata: {
                trackId: 'test_track_20260207'
            }
        });

        // Just check that it runs without errors - fs operations are properly mocked
        expect(result.status).toBe('success');
        // Data should contain the approval result
        expect(result.data).toBeDefined();
    });

    it('should list all tracks', async () => {
        const result = await agent.listTracks();

        expect(fs.readdir).toHaveBeenCalled();
        expect(result.success).toBe(true); // listTracks returns AgentResult, not AgentResponse
        expect((result.data as any)?.tracks).toBeDefined();
    });

    it('should handle LLM errors gracefully', async () => {
        (llmClient.generateResponse as any).mockRejectedValue(new Error('LLM timeout'));

        const result = await agent.execute('Generate spec');

        expect(result.status).toBe('error');
        expect(result.error).toContain('Failed to generate spec');
    });

    it('should include conversation history in prompt', async () => {
        await agent.execute('Generate spec', {
            metadata: {
                featureDescription: 'Add dark mode',
                conversationHistory: 'User: I want dark mode\nAssistant: What colors?'
            }
        });

        const callArgs = (llmClient.generateResponse as any).mock.calls[0];
        // callArgs[0] is the combined prompt (system + user prompt combined)
        expect(callArgs[0]).toContain('Add dark mode');
        expect(callArgs[0]).toContain('I want dark mode');
    });
});
