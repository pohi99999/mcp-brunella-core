import { describe, it, expect, vi } from 'vitest';
import { checkToolPermission, checkFilePermission } from '../src/tools/toolPermissions.js';
import { globalPermissionManager } from '../src/agents/permissions.js';
import * as auditLog from '../src/core/auditLog.js';

vi.mock('../src/core/auditLog.js', () => ({
    record: vi.fn().mockResolvedValue(undefined),
    // Needed for module loading if imported elsewhere
    getAuditLog: vi.fn(),
}));

describe('Permission Check Integration', () => {
    it('should log audit on tool permission denial', () => {
        globalPermissionManager.registerAgent('TestAuditTool', {
            permissions: [],
            pathRestrictions: { allowed: [], denied: [] }
        });

        checkToolPermission('run_command', { agentName: 'TestAuditTool' });

        expect(auditLog.record).toHaveBeenCalledWith(
            'DENIED',
            'TestAuditTool',
            'tool:run_command',
            'run_command', // resource
            expect.stringContaining('lacks run_command permission')
        );
    });

    it('should log audit on file permission denial', () => {
        globalPermissionManager.registerAgent('TestAuditFile', {
            permissions: [],
            pathRestrictions: { allowed: [], denied: [] }
        });

        checkFilePermission('TestAuditFile', '/tmp/test', 'read');

        expect(auditLog.record).toHaveBeenCalledWith(
            'DENIED',
            'TestAuditFile',
            'file:read',
            expect.stringMatching(/\/tmp\/test/), // resource (might be normalized)
            expect.stringContaining('cannot read file')
        );
    });
});
