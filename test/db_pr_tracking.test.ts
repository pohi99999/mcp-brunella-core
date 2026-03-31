import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';

// Setup temp dir for DB logic (path checks)
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'brunella-test-'));
process.env.BRUNELLA_SYSTEM_LOG_DIR = tempDir;

const { mockDbInstance, mockPrepare, mockRun, mockGet, mockAll } = vi.hoisted(() => {
    const mockRun = vi.fn();
    const mockGet = vi.fn();
    const mockAll = vi.fn();
    const mockPrepare = vi.fn().mockReturnValue({
        run: mockRun,
        get: mockGet,
        all: mockAll
    });
    const mockExec = vi.fn();

    return {
        mockDbInstance: {
            prepare: mockPrepare,
            exec: mockExec
        },
        mockPrepare,
        mockRun,
        mockGet,
        mockAll,
        mockExec
    };
});

vi.mock('better-sqlite3', () => {
    return {
        default: class {
            constructor() {
                return mockDbInstance;
            }
        }
    };
});

// Import db AFTER setting env var and mocks
import { savePullRequest, getPullRequest, initDb } from '../src/utils/db';

describe('Database PR Tracking', () => {

    beforeEach(async () => {
        vi.clearAllMocks();
        // Reset mock implementations/returns if needed
        mockPrepare.mockReturnValue({
            run: mockRun,
            get: mockGet,
            all: mockAll
        });
        mockRun.mockReturnValue({ lastInsertRowid: 1 });

        await initDb();
    });

    afterAll(() => {
        try {
            fs.rmSync(tempDir, { recursive: true, force: true });
        } catch {
            // Ignore cleanup errors
        }
    });

    it('should save a pull request', async () => {
        const prData = {
            pr_number: 101,
            github_id: 12345,
            title: 'Test PR',
            owner: 'test-owner',
            repo: 'test-repo',
            branch: 'feature/test',
            state: 'open',
            action: 'opened'
        };

        await savePullRequest(prData);

        expect(mockPrepare).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO pull_requests'));
        expect(mockRun).toHaveBeenCalledWith(prData);
    });

    it('should retrieve a pull request', async () => {
        mockGet.mockReturnValue({
            id: 1,
            pr_number: 101,
            title: 'Test PR'
        });

        const saved = await getPullRequest('test-owner', 'test-repo', 101);

        expect(mockPrepare).toHaveBeenCalledWith(expect.stringContaining('SELECT * FROM pull_requests'));
        expect(mockGet).toHaveBeenCalledWith('test-owner', 'test-repo', 101);
        expect(saved).toEqual({
            id: 1,
            pr_number: 101,
            title: 'Test PR'
        });
    });
});
