import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PermissionManager } from '@packages/agents/permissions.js';

// Mock dependencies
vi.mock('@packages/core-logic/auditLog.js', () => ({
    record: vi.fn().mockResolvedValue(undefined),
}));

// Mock logger
vi.mock('@packages/utils/logger.js', () => ({
    logWarn: vi.fn(),
    logError: vi.fn(),
    logInfo: vi.fn(),
}));

import { record } from '@packages/core-logic/auditLog.js';

describe('PermissionManager Audit Integration', () => {
    let permissionManager: PermissionManager;

    beforeEach(() => {
        permissionManager = new PermissionManager();
        vi.clearAllMocks();
    });

    it('should call audit record when logDeniedOperation is called with resource', () => {
        const agentName = 'TestAgent';
        const operation = 'test_operation';
        const reason = 'test reason';
        const resource = 'test_resource';

        permissionManager.logDeniedOperation(agentName, operation, reason, resource);

        expect(record).toHaveBeenCalledWith(
            'DENIED',
            agentName,
            operation,
            resource,
            reason
        );
    });

    it('should call audit record with "unknown" resource when not provided', () => {
        const agentName = 'TestAgent';
        const operation = 'test_operation';
        const reason = 'test reason';

        // @ts-expect-error - explicitly testing default parameter if called with fewer args from JS
        permissionManager.logDeniedOperation(agentName, operation, reason);

        expect(record).toHaveBeenCalledWith(
            'DENIED',
            agentName,
            operation,
            'unknown',
            reason
        );
    });
});
