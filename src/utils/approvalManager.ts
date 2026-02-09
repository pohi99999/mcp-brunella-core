// FILE: src/utils/approvalManager.ts
// PURPOSE: Manage human-in-the-loop approvals for critical actions
// VERSION: 3.0

import { v4 as uuidv4 } from 'uuid';
import { logInfo, logWarn } from './logger.js';
import { activityFeed } from './activityFeed.js';

export interface ApprovalRequest {
    id: string;
    type: 'file_edit' | 'command_exec' | 'critical_action';
    description: string;
    metadata?: any;
    status: 'pending' | 'approved' | 'rejected' | 'expired';
    createdAt: number;
    expiresAt: number;
    response?: any;
    respondedAt?: number;
}

export type ApprovalAction = 'approve' | 'reject';

class ApprovalManager {
    private requests: Map<string, ApprovalRequest> = new Map();
    private readonly defaultTimeoutMs = 15 * 60 * 1000; // 15 minutes
    
    // Polling interval for waitForResponse
    private readonly pollIntervalMs = 500;

    /**
     * Create a new approval request.
     * Optionally waits for response if waitForResult is true.
     */
    async requestApproval(
        type: ApprovalRequest['type'],
        description: string,
        metadata?: any,
        timeoutMs: number = this.defaultTimeoutMs
    ): Promise<string> { // Returns ID immediately
        const id = uuidv4();
        const now = Date.now();
        
        const request: ApprovalRequest = {
            id,
            type,
            description,
            metadata,
            status: 'pending',
            createdAt: now,
            expiresAt: now + timeoutMs,
        };
        
        this.requests.set(id, request);
        logInfo('ApprovalManager', `New approval request [${id}]: ${type} - ${description}`);

        activityFeed.addActivity(
            'approval',
            'system',
            `Approval requested: ${type} - ${description}`,
            { requestId: id, type, description }
        );
        
        return id;
    }

    /**
     * Wait for a request to be resolved.
     */
    waitForResult(id: string): Promise<boolean> {
        return new Promise((resolve) => {
            const check = () => {
                const req = this.requests.get(id);
                if (!req) {
                    resolve(false);
                    return;
                }

                if (req.status === 'approved') {
                    resolve(true);
                } else if (req.status === 'rejected') {
                    resolve(false);
                } else if (Date.now() > req.expiresAt) {
                    if (req.status === 'pending') {
                        req.status = 'expired';
                        logWarn('ApprovalManager', `Request [${id}] expired`);
                        
                        activityFeed.addActivity(
                            'error',
                            'system',
                            `Approval request expired: ${req.description}`,
                            { requestId: id }
                        );
                    }
                    resolve(false);
                } else {
                    setTimeout(check, this.pollIntervalMs);
                }
            };
            check();
        });
    }

    /**
     * Respond to an approval request
     */
    respond(id: string, action: ApprovalAction, responsePayload?: any): boolean {
        const req = this.requests.get(id);
        if (!req) {
            logWarn('ApprovalManager', `Attempted to respond to unknown request [${id}]`);
            return false;
        }

        if (req.status !== 'pending') {
            logWarn('ApprovalManager', `Attempted to respond to non-pending request [${id}] (${req.status})`);
            return false;
        }

        if (Date.now() > req.expiresAt) {
            req.status = 'expired';
            logWarn('ApprovalManager', `Attempted to respond to expired request [${id}]`);
            return false;
        }

        req.status = action === 'approve' ? 'approved' : 'rejected';
        req.respondedAt = Date.now();
        req.response = responsePayload;
        
        logInfo('ApprovalManager', `Request [${id}] ${req.status}`);

        activityFeed.addActivity(
            action === 'approve' ? 'success' : 'warning',
            'user',
            `Approval request ${req.status}: ${req.description}`,
            { requestId: id, action, response: responsePayload }
        );

        return true;
    }

    /**
     * Get a specific request
     */
    getRequest(id: string): ApprovalRequest | undefined {
        return this.requests.get(id);
    }

    /**
     * List all requests, optionally filtered
     */
    listRequests(status?: ApprovalRequest['status']): ApprovalRequest[] {
        const all = Array.from(this.requests.values()).sort((a, b) => b.createdAt - a.createdAt);
        if (status) {
            return all.filter(r => r.status === status);
        }
        return all;
    }

    /**
     * Clean up old requests
     */
    cleanup(maxAgeMs: number = 24 * 60 * 60 * 1000): number {
        const now = Date.now();
        let count = 0;
        for (const [id, req] of this.requests) {
            if (now - req.createdAt > maxAgeMs && req.status !== 'pending') {
                this.requests.delete(id);
                count++;
            }
        }
        return count;
    }
}

export const approvalManager = new ApprovalManager();
