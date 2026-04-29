import { describe, it, expect, vi, beforeEach } from 'vitest';
import { globalPermissionManager } from '@packages/agents/permissions.js';
import * as auditLog from '@packages/core-logic/auditLog.js';

// Mock the audit log module
vi.mock('@packages/core-logic/auditLog.js', () => ({
    record: vi.fn().mockResolvedValue(undefined),
    // Add other exports if needed for module loading, but record is what we care about
    getAuditLog: vi.fn(),
    getDeniedEntries: vi.fn(),
    getAuditStats: vi.fn(),
    cleanupOldEntries: vi.fn(),
    startCleanupSchedule: vi.fn(),
    stopCleanupSchedule: vi.fn(),
    clearAuditLog: vi.fn(),
    closeAuditDb: vi.fn(),
}));

describe('Permission Manager Audit Integration', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should call audit record when logDeniedOperation is called', () => {
        // signature: logDeniedOperation(agentName, operation, reason, resource)
        globalPermissionManager.logDeniedOperation('TestAgent', 'test_op', 'test_reason', 'test_resource');

        // record() is called with resource before reason internally
        expect(auditLog.record).toHaveBeenCalledWith('DENIED', 'TestAgent', 'test_op', 'test_resource', 'test_reason');
    });
});
