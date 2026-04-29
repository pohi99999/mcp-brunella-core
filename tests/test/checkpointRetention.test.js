/**
 * Tests for Phoenix Protocol v2 - Checkpoint Retention Policy
 *
 * Validates that checkpoints are automatically cleaned up after 7 days
 * to prevent unbounded database growth.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { saveCheckpoint, loadCheckpoint, cleanupOldCheckpoints, getCheckpointStats, closeCheckpointDb, clearAllCheckpoints, } from '@packages/core-logic/checkpoint.js';
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
describe('Phoenix Protocol v2 - Checkpoint Retention Policy', () => {
    const TEST_DB_PATH = path.join(process.cwd(), 'data', 'checkpoints.db');
    beforeEach(async () => {
        // Clear all checkpoints before each test
        await clearAllCheckpoints();
    });
    afterEach(async () => {
        await closeCheckpointDb();
    });
    describe('Checkpoint Cleanup', () => {
        it('should clean up checkpoints older than retention period', { timeout: 10000 }, async () => {
            // Create fresh checkpoint
            const recentTaskId = 'recent_task_123';
            await saveCheckpoint(recentTaskId, 1, 'recent_step', { data: 'recent' });
            // Manually insert old checkpoint by modifying DB
            const db = new Database(TEST_DB_PATH);
            const oldDate = new Date();
            oldDate.setDate(oldDate.getDate() - 10); // 10 days ago
            db.prepare('INSERT INTO checkpoints (task_id, step_index, step_name, state_json, created_at) VALUES (?, ?, ?, ?, ?)').run('old_task_456', 1, 'old_step', '{"data":"old"}', oldDate.toISOString());
            db.close();
            // Clean up checkpoints older than 7 days
            const deleted = await cleanupOldCheckpoints(7);
            // Should have deleted 1 checkpoint
            expect(deleted).toBe(1);
            // Recent checkpoint should still exist
            const recent = await loadCheckpoint(recentTaskId);
            expect(recent).toBeDefined();
            expect(recent?.taskId).toBe(recentTaskId);
            // Old checkpoint should be gone
            const old = await loadCheckpoint('old_task_456');
            expect(old).toBeNull();
        });
        it('should not delete checkpoints within retention period', { timeout: 10000 }, async () => {
            // Create checkpoints at different times (all within 7 days)
            await saveCheckpoint('task_1', 1, 'step_1', { data: '1' });
            await saveCheckpoint('task_2', 1, 'step_1', { data: '2' });
            await saveCheckpoint('task_3', 1, 'step_1', { data: '3' });
            const statsBefore = await getCheckpointStats();
            const countBefore = statsBefore.totalCheckpoints;
            // Clean up with 7 day retention
            const deleted = await cleanupOldCheckpoints(7);
            // Should not delete any recent checkpoints
            expect(deleted).toBe(0);
            const statsAfter = await getCheckpointStats();
            expect(statsAfter.totalCheckpoints).toBe(countBefore);
        });
        it('should handle cleanup when no old checkpoints exist', { timeout: 10000 }, async () => {
            await saveCheckpoint('task_recent', 1, 'step_1', { data: 'test' });
            const deleted = await cleanupOldCheckpoints(7);
            expect(deleted).toBe(0);
        });
        it('should handle custom retention periods', { timeout: 10000 }, async () => {
            // Create checkpoint
            await saveCheckpoint('task_test', 1, 'step_1', { data: 'test' });
            // Manually insert checkpoint 2 days old
            const db = new Database(TEST_DB_PATH);
            const twoDaysAgo = new Date();
            twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
            db.prepare('INSERT INTO checkpoints (task_id, step_index, step_name, state_json, created_at) VALUES (?, ?, ?, ?, ?)').run('task_old_2days', 1, 'step_1', '{"data":"old"}', twoDaysAgo.toISOString());
            db.close();
            // Clean up with 1 day retention
            const deleted = await cleanupOldCheckpoints(1);
            // Should delete the 2-day old checkpoint
            expect(deleted).toBe(1);
            // Recent checkpoint should still exist
            const recent = await loadCheckpoint('task_test');
            expect(recent).toBeDefined();
        });
        it('should handle cleanup with no checkpoints in database', { timeout: 10000 }, async () => {
            // Ensure database is clean
            await closeCheckpointDb();
            const deleted = await cleanupOldCheckpoints(7);
            expect(deleted).toBe(0);
        });
    });
    describe('Checkpoint Stats After Cleanup', () => {
        it('should reflect correct stats after cleanup', { timeout: 10000 }, async () => {
            // Create 5 recent checkpoints
            for (let i = 1; i <= 5; i++) {
                await saveCheckpoint(`task_${i}`, 1, 'step_1', { data: `test_${i}` });
            }
            // Manually add 3 old checkpoints
            const db = new Database(TEST_DB_PATH);
            const oldDate = new Date();
            oldDate.setDate(oldDate.getDate() - 10);
            for (let i = 1; i <= 3; i++) {
                db.prepare('INSERT INTO checkpoints (task_id, step_index, step_name, state_json, created_at) VALUES (?, ?, ?, ?, ?)').run(`old_task_${i}`, 1, 'step_1', '{"data":"old"}', oldDate.toISOString());
            }
            db.close();
            const statsBefore = await getCheckpointStats();
            expect(statsBefore.totalCheckpoints).toBe(8); // 5 recent + 3 old
            // Clean up
            await cleanupOldCheckpoints(7);
            const statsAfter = await getCheckpointStats();
            expect(statsAfter.totalCheckpoints).toBe(5); // Only recent remain
            expect(statsAfter.activeTasks).toBe(5);
        });
    });
    describe('Cleanup Error Handling', () => {
        it('should handle cleanup gracefully when database not initialized', { timeout: 10000 }, async () => {
            await closeCheckpointDb();
            // Delete the database file
            try {
                if (fs.existsSync(TEST_DB_PATH)) {
                    fs.unlinkSync(TEST_DB_PATH);
                }
                // Also cleanup WAL files if they exist
                if (fs.existsSync(`${TEST_DB_PATH}-wal`))
                    fs.unlinkSync(`${TEST_DB_PATH}-wal`);
                if (fs.existsSync(`${TEST_DB_PATH}-shm`))
                    fs.unlinkSync(`${TEST_DB_PATH}-shm`);
            }
            catch (e) {
                console.warn('Failed to delete test DB, might be locked by another process:', e);
            }
            const deleted = await cleanupOldCheckpoints(7);
            // Should return 0 without throwing
            expect(deleted).toBeGreaterThanOrEqual(0);
        });
    });
    describe('Real-World Scenarios', () => {
        it('should handle mixed checkpoint ages', { timeout: 10000 }, async () => {
            const db = new Database(TEST_DB_PATH);
            // Create checkpoints at various ages
            const dates = [
                { days: -1, count: 2 }, // 1 day old (keep)
                { days: -5, count: 3 }, // 5 days old (keep)
                { days: -8, count: 2 }, // 8 days old (delete)
                { days: -15, count: 1 }, // 15 days old (delete)
            ];
            let totalOld = 0;
            dates.forEach(({ days, count }) => {
                const date = new Date();
                date.setDate(date.getDate() + days);
                for (let i = 0; i < count; i++) {
                    db.prepare('INSERT INTO checkpoints (task_id, step_index, step_name, state_json, created_at) VALUES (?, ?, ?, ?, ?)').run(`task_${days}_${i}`, 1, 'step_1', '{"data":"test"}', date.toISOString());
                }
                if (days < -7)
                    totalOld += count;
            });
            db.close();
            const deleted = await cleanupOldCheckpoints(7);
            // Should delete only checkpoints older than 7 days
            expect(deleted).toBe(totalOld);
            const stats = await getCheckpointStats();
            expect(stats.totalCheckpoints).toBe(5); // 2 + 3 kept
        });
    });
});
