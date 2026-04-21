import { describe, it, expect, afterEach } from 'vitest';
import { saveCheckpoint, loadCheckpoint } from '../src/utils/checkpoint.js';
import fs from 'fs/promises';
import path from 'path';
// Test checkpoint path — use a temp location
const TEST_CHECKPOINT_DIR = path.join(process.cwd(), 'logs');
describe('Phoenix Protocol — State Restoration', () => {
    const testCheckpoint = {
        lastTask: { agent: 'Developer', description: 'Build test', status: 'completed' },
        agents: {
            Developer: { status: 'idle', lastTask: 'Build test' },
            Researcher: { status: 'idle' },
        },
    };
    afterEach(async () => {
        // Cleanup test checkpoint
        try {
            await fs.unlink(path.join(TEST_CHECKPOINT_DIR, 'health_status.json'));
        }
        catch { /* file may not exist */ }
    });
    it('should save checkpoint data to disk', async () => {
        await saveCheckpoint(testCheckpoint);
        const loaded = await loadCheckpoint();
        expect(loaded).toBeDefined();
        expect(loaded.timestamp).toBeDefined();
        expect(loaded.lastTask).toEqual(testCheckpoint.lastTask);
        expect(loaded.agents).toEqual(testCheckpoint.agents);
    });
    it('should restore checkpoint after simulated restart', async () => {
        // Phase 1: Save state
        await saveCheckpoint(testCheckpoint);
        // Phase 2: Simulate restart — fresh load
        const restored = await loadCheckpoint();
        // Phase 3: Verify state
        expect(restored).not.toBeNull();
        expect(restored.lastTask?.agent).toBe('Developer');
        expect(restored.lastTask?.status).toBe('completed');
        expect(restored.agents?.Developer?.status).toBe('idle');
    });
    it('should handle corrupted checkpoint gracefully', async () => {
        // Write garbage to checkpoint file
        await fs.mkdir(TEST_CHECKPOINT_DIR, { recursive: true }).catch(() => { });
        await fs.writeFile(path.join(TEST_CHECKPOINT_DIR, 'health_status.json'), '{{{invalid json!!!', 'utf-8');
        const loaded = await loadCheckpoint();
        // Should not crash — return null on parse error
        expect(loaded).toBeNull();
    });
    it('should handle missing checkpoint file gracefully', async () => {
        // Delete file if exists
        try {
            await fs.unlink(path.join(TEST_CHECKPOINT_DIR, 'health_status.json'));
        }
        catch { /* already doesn't exist */ }
        const loaded = await loadCheckpoint();
        expect(loaded).toBeNull();
    });
    it('should overwrite old checkpoint with new data', async () => {
        await saveCheckpoint({ lastTask: { agent: 'Dev', description: 'task1', status: 'running' } });
        await saveCheckpoint({ lastTask: { agent: 'Dev', description: 'task2', status: 'completed' } });
        const loaded = await loadCheckpoint();
        expect(loaded.lastTask?.description).toBe('task2');
        expect(loaded.lastTask?.status).toBe('completed');
    });
    it('should include timestamp in checkpoint', async () => {
        const before = new Date().toISOString();
        await saveCheckpoint(testCheckpoint);
        const after = new Date().toISOString();
        const loaded = await loadCheckpoint();
        expect(loaded.timestamp).toBeDefined();
        expect(loaded.timestamp >= before).toBe(true);
        expect(loaded.timestamp <= after).toBe(true);
    });
});
