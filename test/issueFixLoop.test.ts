import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
    analyzeIssueForFixLoop,
    startIssueFixAttempt,
    getIssueFixAttempt,
    hydrateIssueFixAttemptsFromStore,
} from '../src/agents/issueFixLoop.js';

const {
    requestApprovalMock,
    waitForResultMock,
    getRequestMock,
    loadIssueFixAttemptRuntimeEntriesMock,
    saveIssueFixAttemptRuntimeMock,
} = vi.hoisted(() => ({
    requestApprovalMock: vi.fn().mockResolvedValue('approval-42'),
    waitForResultMock: vi.fn().mockResolvedValue(false),
    getRequestMock: vi.fn().mockReturnValue({ status: 'pending' }),
    loadIssueFixAttemptRuntimeEntriesMock: vi.fn().mockReturnValue([]),
    saveIssueFixAttemptRuntimeMock: vi.fn(),
}));

vi.mock('../src/utils/approvalManager.js', () => ({
    approvalManager: {
        requestApproval: requestApprovalMock,
        waitForResult: waitForResultMock,
        getRequest: getRequestMock,
    },
}));

vi.mock('../src/agents/developerPipeline.js', () => ({
    pipelineRunner: {
        createPipeline: vi.fn().mockReturnValue({ taskId: 'dev-issue-42' }),
        startPhase: vi.fn(),
        completePhase: vi.fn(),
        failPhase: vi.fn(),
        completePipeline: vi.fn(),
    },
}));

vi.mock('../src/agents/AgentManager.js', () => ({
    agentManager: {
        delegate: vi.fn().mockResolvedValue({ status: 'success', message: 'done' }),
    },
}));

vi.mock('../src/utils/activityFeed.js', () => ({
    activityFeed: {
        addActivity: vi.fn(),
    },
}));

vi.mock('../src/utils/logger.js', () => ({
    logInfo: vi.fn(),
    logWarn: vi.fn(),
    logError: vi.fn(),
}));

vi.mock('../src/core/autonomyRuntimeStore.js', () => ({
    loadIssueFixAttemptRuntimeEntries: loadIssueFixAttemptRuntimeEntriesMock,
    saveIssueFixAttemptRuntime: saveIssueFixAttemptRuntimeMock,
}));

vi.mock('fs/promises', async (importOriginal) => {
    const actual = await importOriginal<typeof import('fs/promises')>();
    return {
        ...actual,
        access: vi.fn().mockResolvedValue(undefined),
        readFile: vi.fn().mockImplementation(async (filePath: string) => {
            if (String(filePath).includes('src\\server\\routes\\developer.ts')) {
                return 'import { Router } from "express";';
            }
            return 'export {};';
        }),
        readdir: vi.fn().mockResolvedValue([]),
    };
});

vi.mock('../src/core/githubAPIClient.js', () => ({
    GitHubAPIClient: vi.fn().mockImplementation(() => ({
        getIssue: vi.fn().mockResolvedValue({
            number: 42,
            title: 'Route regression in developer analyze endpoint',
            state: 'open',
            body: 'The issue points at `src/server/routes/developer.ts` and may need coverage in `test/routes_developer.test.ts`.',
            created_at: '2026-04-01T00:00:00.000Z',
            updated_at: '2026-04-01T00:00:00.000Z',
            labels: [{ name: 'bug' }],
            user: { login: 'alice' },
        }),
    })),
}));

describe('issueFixLoop', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        process.env.GITHUB_PAT = 'test-token';
        requestApprovalMock.mockResolvedValue('approval-42');
        waitForResultMock.mockResolvedValue(false);
        getRequestMock.mockReturnValue({ status: 'pending' });
        loadIssueFixAttemptRuntimeEntriesMock.mockReturnValue([]);
    });

    it('should analyze an issue and return safe verification commands', async () => {
        const result = await analyzeIssueForFixLoop(
            {
                issueNumber: 42,
                owner: 'owner',
                repo: 'repo',
            },
            {
                profileId: 'developer-mcp-safe-v1',
                workspaceRoot: 'F:\\mcp-brunella-core',
                repositoryOwner: 'owner',
                repositoryName: 'repo',
                repositoryFullName: 'owner/repo',
                preferredMcpServers: ['brunella-core', 'filesystem', 'git'],
                availableMcpServers: [],
                safeCommandExamples: ['npm run build'],
                defaultVerificationCommands: ['npm run build'],
                commandCategories: {
                    inspection: ['git status --short'],
                    build: ['npm run build'],
                    test: ['npm run test:fast'],
                    lint: ['npm run lint'],
                },
            },
        );

        expect(result.mode).toBe('analysis-only');
        expect(result.issue.issueNumber).toBe(42);
        expect(result.context.targetFile?.replaceAll('/', '\\')).toBe('src\\server\\routes\\developer.ts');
        expect(result.context.gathered.files.length).toBeGreaterThan(0);
        expect(result.recommendation.verificationCommands).toContain('npm run build');
        expect(result.recommendation.validatedCommands.every((entry) => entry.valid)).toBe(true);
    });

    it('should fail fast when GitHub auth is missing', async () => {
        delete process.env.GITHUB_PAT;
        delete process.env.GITHUB_TOKEN;

        await expect(
            analyzeIssueForFixLoop({
                issueNumber: 42,
                owner: 'owner',
                repo: 'repo',
            }),
        ).rejects.toThrow(/GITHUB_PAT or GITHUB_TOKEN/i);
    });

    it('should honor explicit file hints before inferred issue body hints', async () => {
        const result = await analyzeIssueForFixLoop(
            {
                issueNumber: 42,
                owner: 'owner',
                repo: 'repo',
                filePathHints: ['src\\agents\\DeveloperAgent.ts'],
            },
            {
                profileId: 'developer-mcp-safe-v1',
                workspaceRoot: 'F:\\mcp-brunella-core',
                repositoryOwner: 'owner',
                repositoryName: 'repo',
                repositoryFullName: 'owner/repo',
                preferredMcpServers: ['brunella-core'],
                availableMcpServers: [],
                safeCommandExamples: [],
                defaultVerificationCommands: [],
                commandCategories: {
                    inspection: ['git status --short'],
                    build: ['npm run build'],
                    test: ['npm run test:fast'],
                    lint: ['npm run lint'],
                },
            },
        );

        expect(result.context.targetFile?.replaceAll('/', '\\')).toBe('src\\agents\\DeveloperAgent.ts');
    });

    it('should create an approval-gated fix attempt record', async () => {
        waitForResultMock.mockImplementation(() => new Promise<boolean>(() => {}));

        const result = await startIssueFixAttempt(
            {
                issueNumber: 42,
                owner: 'owner',
                repo: 'repo',
            },
            {
                profileId: 'developer-mcp-safe-v1',
                workspaceRoot: 'F:\\mcp-brunella-core',
                repositoryOwner: 'owner',
                repositoryName: 'repo',
                repositoryFullName: 'owner/repo',
                preferredMcpServers: ['brunella-core'],
                availableMcpServers: [],
                safeCommandExamples: [],
                defaultVerificationCommands: ['npm run build'],
                commandCategories: {
                    inspection: ['git status --short'],
                    build: ['npm run build'],
                    test: ['npm run test:fast'],
                    lint: ['npm run lint'],
                },
            },
        );

        expect(result.taskId).toBe('dev-issue-42');
        expect(result.approvalRequestId).toBe('approval-42');
        expect(result.status).toBe('awaiting_approval');
        expect(requestApprovalMock).toHaveBeenCalled();

        const stored = getIssueFixAttempt('dev-issue-42');
        expect(stored).toBeDefined();
        expect(stored?.approvalRequestId).toBe('approval-42');
        expect(stored?.status).toBe('awaiting_approval');
        expect(saveIssueFixAttemptRuntimeMock).toHaveBeenCalledWith(
            expect.objectContaining({
                record: expect.objectContaining({
                    taskId: 'dev-issue-42',
                    approvalRequestId: 'approval-42',
                    status: 'awaiting_approval',
                }),
                analysis: expect.objectContaining({
                    issue: expect.objectContaining({
                        issueNumber: 42,
                    }),
                }),
            }),
        );
    });

    it('should hydrate persisted issue fix attempts from runtime storage', async () => {
        loadIssueFixAttemptRuntimeEntriesMock.mockReturnValueOnce([
            {
                record: {
                    taskId: 'persisted-dev-issue-1',
                    approvalRequestId: 'approval-persisted',
                    status: 'done',
                    createdAt: '2026-04-01T00:00:00.000Z',
                    updatedAt: '2026-04-01T00:01:00.000Z',
                    issueNumber: 7,
                    issueTitle: 'Persisted fix attempt',
                    repositoryFullName: 'owner/repo',
                    targetFile: 'src/server/routes/developer.ts',
                    analysisSummary: 'Persisted summary',
                    verificationCommands: ['npm run build'],
                    verificationResults: [
                        {
                            normalizedCommand: 'npm run build',
                            success: true,
                            exitCode: 0,
                            combinedOutput: 'ok',
                        },
                    ],
                },
                analysis: undefined,
            },
        ]);

        vi.resetModules();
        const runtimeModule = await import('../src/agents/issueFixLoop.js');
        const count = runtimeModule.hydrateIssueFixAttemptsFromStore();

        expect(count).toBeGreaterThanOrEqual(1);
        expect(runtimeModule.getIssueFixAttempt('persisted-dev-issue-1')).toEqual(
            expect.objectContaining({
                taskId: 'persisted-dev-issue-1',
                status: 'done',
                issueNumber: 7,
            }),
        );
    });
});
