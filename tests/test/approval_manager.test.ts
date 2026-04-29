// FILE: test/approval_manager.test.ts
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { approvalManager } from '@packages/utils/approvalManager.js';

describe('ApprovalManager', () => {
    beforeEach(() => {
        // Clear requests if possible or just use unique IDs
        // ApprovalManager unfortunately stores state in a private Map without clear method
        // But we added cleanup() which clears expired. 
        // We can just rely on unique IDs.
    });

    it('should create a request and return an ID', async () => {
        const id = await approvalManager.requestApproval('command_exec', 'Run rm -rf', {}, 1000);
        expect(id).toBeDefined();
        
        const req = approvalManager.getRequest(id);
        expect(req).toBeDefined();
        expect(req?.status).toBe('pending');
        expect(req?.type).toBe('command_exec');
    });

    it('should resolve waitForResult true when approved', async () => {
        const id = await approvalManager.requestApproval('file_edit', 'Edit config', {}, 5000);
        
        const waitPromise = approvalManager.waitForResult(id);
        
        // Simulate response from another "thread"
        setTimeout(() => {
            approvalManager.respond(id, 'approve');
        }, 100);

        const result = await waitPromise;
        expect(result).toBe(true);
        expect(approvalManager.getRequest(id)?.status).toBe('approved');
    });

    it('should resolve waitForResult false when rejected', async () => {
        const id = await approvalManager.requestApproval('critical_action', 'Delete DB', {}, 5000);
        
        const waitPromise = approvalManager.waitForResult(id);
        
        setTimeout(() => {
            approvalManager.respond(id, 'reject');
        }, 100);

        const result = await waitPromise;
        expect(result).toBe(false);
        expect(approvalManager.getRequest(id)?.status).toBe('rejected');
    });

    it('should time out and expire', async () => {
        const id = await approvalManager.requestApproval('command_exec', 'Sleep', {}, 200); // 200ms timeout
        
        const result = await approvalManager.waitForResult(id);
        expect(result).toBe(false);
        expect(approvalManager.getRequest(id)?.status).toBe('expired');
    });

    it('should prevent responding to expired requests', async () => {
        const id = await approvalManager.requestApproval('command_exec', 'Quick', {}, 10);
        await new Promise(r => setTimeout(r, 50)); // Wait for expire
        
        // Trigger check (waitForResult usually triggers expire logic, but respond also checks expiresAt)
        const success = approvalManager.respond(id, 'approve');
        expect(success).toBe(false);
    });

    it('should list requests by status', async () => {
        const id1 = await approvalManager.requestApproval('file_edit', 'One');
        const id2 = await approvalManager.requestApproval('file_edit', 'Two');
        
        approvalManager.respond(id1, 'approve');
        
        const pending = approvalManager.listRequests('pending');
        const approved = approvalManager.listRequests('approved');
        
        expect(pending.find(r => r.id === id2)).toBeDefined();
        expect(pending.find(r => r.id === id1)).toBeUndefined();
        expect(approved.find(r => r.id === id1)).toBeDefined();
    });
});
