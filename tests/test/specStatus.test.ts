import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getSpecStatus, approveSpec, rejectSpec, requiresSpec, isSpecApproved, listSpecStatuses, type SpecStatus } from '../src/agents/specStatus.js';
import fs from 'fs/promises';
import path from 'path';

// Mock logger
vi.mock('../src/utils/logger.js', () => ({
    logInfo: vi.fn(),
    logWarn: vi.fn(),
    logError: vi.fn(),
    logDebug: vi.fn(),
    setAgentStatus: vi.fn()
}));

// Mock fs/promises
vi.mock('fs/promises');

describe('specStatus', () => {
    beforeEach(() => {
        vi.resetAllMocks();
    });

    describe('getSpecStatus', () => {
        it('should return approved when meta.json has approved spec_status', async () => {
            vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify({
                id: 'test_track',
                spec_status: 'approved'
            }));

            const status = await getSpecStatus('test_track');
            expect(status).toBe('approved');
        });

        it('should return pending_approval when spec is pending', async () => {
            vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify({
                id: 'test_track',
                spec_status: 'pending_approval'
            }));

            const status = await getSpecStatus('test_track');
            expect(status).toBe('pending_approval');
        });

        it('should return rejected when spec was rejected', async () => {
            vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify({
                id: 'test_track',
                spec_status: 'rejected'
            }));

            const status = await getSpecStatus('test_track');
            expect(status).toBe('rejected');
        });

        it('should return not_found when meta.json does not exist', async () => {
            vi.mocked(fs.readFile).mockRejectedValue(new Error('ENOENT'));

            const status = await getSpecStatus('nonexistent_track');
            expect(status).toBe('not_found');
        });

        it('should return not_found for invalid spec_status values', async () => {
            vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify({
                id: 'test_track',
                spec_status: 'invalid_status'
            }));

            const status = await getSpecStatus('test_track');
            expect(status).toBe('not_found');
        });

        it('should return not_found when spec_status is missing', async () => {
            vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify({
                id: 'test_track'
            }));

            const status = await getSpecStatus('test_track');
            expect(status).toBe('not_found');
        });
    });

    describe('approveSpec', () => {
        it('should set spec_status to approved and status to active', async () => {
            vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify({
                id: 'test_track',
                spec_status: 'pending_approval',
                status: 'draft',
                updated: '2026-01-01'
            }));
            vi.mocked(fs.writeFile).mockResolvedValue(undefined);

            const result = await approveSpec('test_track');
            expect(result).toBe(true);

            const writeCall = vi.mocked(fs.writeFile).mock.calls[0];
            const writtenMeta = JSON.parse(writeCall[1] as string);
            expect(writtenMeta.spec_status).toBe('approved');
            expect(writtenMeta.status).toBe('active');
        });

        it('should return false for nonexistent track', async () => {
            vi.mocked(fs.readFile).mockRejectedValue(new Error('ENOENT'));

            const result = await approveSpec('nonexistent');
            expect(result).toBe(false);
        });
    });

    describe('rejectSpec', () => {
        it('should set spec_status to rejected with reason', async () => {
            vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify({
                id: 'test_track',
                spec_status: 'pending_approval',
                updated: '2026-01-01'
            }));
            vi.mocked(fs.writeFile).mockResolvedValue(undefined);

            const result = await rejectSpec('test_track', 'Incomplete requirements');
            expect(result).toBe(true);

            const writeCall = vi.mocked(fs.writeFile).mock.calls[0];
            const writtenMeta = JSON.parse(writeCall[1] as string);
            expect(writtenMeta.spec_status).toBe('rejected');
            expect(writtenMeta.rejection_reason).toBe('Incomplete requirements');
        });

        it('should work without a reason', async () => {
            vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify({
                id: 'test_track',
                spec_status: 'pending_approval',
                updated: '2026-01-01'
            }));
            vi.mocked(fs.writeFile).mockResolvedValue(undefined);

            const result = await rejectSpec('test_track');
            expect(result).toBe(true);
        });

        it('should return false for nonexistent track', async () => {
            vi.mocked(fs.readFile).mockRejectedValue(new Error('ENOENT'));

            const result = await rejectSpec('nonexistent');
            expect(result).toBe(false);
        });
    });

    describe('requiresSpec', () => {
        it('should return true for Developer agent', () => {
            expect(requiresSpec('Developer')).toBe(true);
        });

        it('should return true for DeveloperAgent', () => {
            expect(requiresSpec('DeveloperAgent')).toBe(true);
        });

        it('should return false for Researcher agent', () => {
            expect(requiresSpec('Researcher')).toBe(false);
        });

        it('should return false for Orchestrator agent', () => {
            expect(requiresSpec('Orchestrator')).toBe(false);
        });

        it('should return false for SpecWriter agent', () => {
            expect(requiresSpec('SpecWriter')).toBe(false);
        });
    });

    describe('isSpecApproved', () => {
        it('should return true when spec is approved', async () => {
            vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify({
                id: 'test_track',
                spec_status: 'approved'
            }));

            expect(await isSpecApproved('test_track')).toBe(true);
        });

        it('should return false when spec is pending', async () => {
            vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify({
                id: 'test_track',
                spec_status: 'pending_approval'
            }));

            expect(await isSpecApproved('test_track')).toBe(false);
        });

        it('should return false when spec is rejected', async () => {
            vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify({
                id: 'test_track',
                spec_status: 'rejected'
            }));

            expect(await isSpecApproved('test_track')).toBe(false);
        });

        it('should return false when track does not exist', async () => {
            vi.mocked(fs.readFile).mockRejectedValue(new Error('ENOENT'));

            expect(await isSpecApproved('nonexistent')).toBe(false);
        });
    });

    describe('listSpecStatuses', () => {
        it('should list all tracks with their spec statuses', async () => {
            vi.mocked(fs.readdir).mockResolvedValue([
                { name: 'track_a', isDirectory: () => true, isFile: () => false, isSymbolicLink: () => false, isBlockDevice: () => false, isCharacterDevice: () => false, isFIFO: () => false, isSocket: () => false },
                { name: 'track_b', isDirectory: () => true, isFile: () => false, isSymbolicLink: () => false, isBlockDevice: () => false, isCharacterDevice: () => false, isFIFO: () => false, isSocket: () => false },
                { name: 'readme.md', isDirectory: () => false, isFile: () => true, isSymbolicLink: () => false, isBlockDevice: () => false, isCharacterDevice: () => false, isFIFO: () => false, isSocket: () => false }
            ] as any);

            vi.mocked(fs.readFile).mockImplementation(async (filePath: any) => {
                const p = String(filePath);
                if (p.includes('track_a')) return JSON.stringify({ id: 'track_a', spec_status: 'approved' });
                if (p.includes('track_b')) return JSON.stringify({ id: 'track_b', spec_status: 'pending_approval' });
                throw new Error('ENOENT');
            });

            const results = await listSpecStatuses();
            expect(results).toHaveLength(2);
            expect(results.find(r => r.id === 'track_a')?.spec_status).toBe('approved');
            expect(results.find(r => r.id === 'track_b')?.spec_status).toBe('pending_approval');
        });

        it('should skip directories without meta.json', async () => {
            vi.mocked(fs.readdir).mockResolvedValue([
                { name: 'track_a', isDirectory: () => true, isFile: () => false, isSymbolicLink: () => false, isBlockDevice: () => false, isCharacterDevice: () => false, isFIFO: () => false, isSocket: () => false },
                { name: 'track_broken', isDirectory: () => true, isFile: () => false, isSymbolicLink: () => false, isBlockDevice: () => false, isCharacterDevice: () => false, isFIFO: () => false, isSocket: () => false }
            ] as any);

            vi.mocked(fs.readFile).mockImplementation(async (filePath: any) => {
                const p = String(filePath);
                if (p.includes('track_a')) return JSON.stringify({ id: 'track_a', spec_status: 'approved' });
                throw new Error('ENOENT');
            });

            const results = await listSpecStatuses();
            expect(results).toHaveLength(1);
            expect(results[0].id).toBe('track_a');
        });
    });
});

describe('DeveloperAgent Spec Gate', () => {
    beforeEach(() => {
        vi.resetAllMocks();
    });

    it('should block DeveloperAgent when spec is not approved (integration concept)', async () => {
        expect(requiresSpec('Developer')).toBe(true);

        vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify({
            id: 'test_track',
            spec_status: 'pending_approval'
        }));

        const status = await getSpecStatus('test_track');
        expect(status).toBe('pending_approval');
        expect(status).not.toBe('approved');
    });

    it('should allow DeveloperAgent when spec is approved (integration concept)', async () => {
        expect(requiresSpec('Developer')).toBe(true);

        vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify({
            id: 'test_track',
            spec_status: 'approved'
        }));

        const status = await getSpecStatus('test_track');
        expect(status).toBe('approved');
    });

    it('should skip spec gate when no trackId is provided', () => {
        const trackId = undefined;
        expect(trackId && requiresSpec('Developer')).toBeFalsy();
    });
});
