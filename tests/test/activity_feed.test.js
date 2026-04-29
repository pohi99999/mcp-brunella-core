import { describe, it, expect, beforeEach, vi } from 'vitest';
import { activityFeed } from '@packages/utils/activityFeed.js';
describe('ActivityFeedManager', () => {
    beforeEach(() => {
        activityFeed.clear();
        vi.restoreAllMocks();
    });
    it('should add activity and retrieve it', () => {
        const item = activityFeed.addActivity('info', 'system', 'Test message');
        expect(item).toBeDefined();
        expect(item.type).toBe('info');
        expect(item.message).toBe('Test message');
        expect(item.id).toMatch(/^act-\d+-[a-z0-9]+$/);
        const recent = activityFeed.getRecent(10);
        expect(recent.length).toBe(1);
        expect(recent[0].id).toBe(item.id);
    });
    it('should emit "activity" event', () => {
        const spy = vi.fn();
        activityFeed.on('activity', spy);
        const item = activityFeed.addActivity('success', 'agent', 'Task done');
        expect(spy).toHaveBeenCalledTimes(1);
        expect(spy).toHaveBeenCalledWith(item);
    });
    it('should limit history size', () => {
        // Mock maxHistory to small number via accessing private property or just adding many items
        // Since property is private, we'll just add 205 items (default limit is 200)
        for (let i = 0; i < 205; i++) {
            activityFeed.addActivity('info', 'system', `Msg ${i}`);
        }
        const recent = activityFeed.getRecent(300);
        expect(recent.length).toBe(200);
        // Should contain the last added item (Msg 204)
        expect(recent[0].message).toBe('Msg 204');
    });
    it('should support metadata', () => {
        const meta = { taskId: '123', duration: 50 };
        const item = activityFeed.addActivity('success', 'pipeline', 'Pipeline finished', meta);
        expect(item.metadata).toEqual(meta);
    });
    it('should filter returned items by limit', () => {
        activityFeed.addActivity('info', 'system', '1');
        activityFeed.addActivity('info', 'system', '2');
        activityFeed.addActivity('info', 'system', '3');
        const recent = activityFeed.getRecent(2);
        expect(recent.length).toBe(2);
        expect(recent[0].message).toBe('3');
        expect(recent[1].message).toBe('2');
    });
});
