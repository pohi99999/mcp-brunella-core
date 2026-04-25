/**
 * Security REST Routes — Sandbox, Network Policy, RBAC endpoints
 *
 * Endpoints:
 * - GET /api/v1/security/sandbox/stats    — Sandbox pool statistics
 * - GET /api/v1/security/network/stats    — Network policy statistics
 * - POST /api/v1/security/network/check   — Check URL access
 * - GET /api/v1/security/violations       — Recent violations
 * - GET /api/v1/security/violations/stats — Violation statistics
 * - GET /api/v1/security/rbac/profiles    — RBAC profiles list
 * - GET /api/v1/security/rbac/check       — Check agent permission
 *
 * @track sandbox_security_hardening_20260323
 * @phase Phase 4: REST API Integration
 */

import { Router } from 'express';
import { logInfo } from '../../utils/logger.js';

export const securityRouter = Router();

// --- Sandbox Stats ---
securityRouter.get('/sandbox/stats', async (_req, res) => {
  try {
    const { getSandboxPool } = await import('../../core/sandbox/wasmSandbox.js');
    const pool = getSandboxPool();
    res.json(pool.getStats());
  } catch (err: unknown) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// --- Network Policy Stats ---
securityRouter.get('/network/stats', async (_req, res) => {
  try {
    const { getNetworkPolicy } = await import('../../core/sandbox/networkPolicy.js');
    const policy = getNetworkPolicy();
    res.json(policy.getStats());
  } catch (err: unknown) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// --- Check URL access ---
securityRouter.post('/network/check', async (req, res) => {
  try {
    const { url } = req.body as { url: string };
    if (!url) {
      res.status(400).json({ error: 'url is required' });
      return;
    }
    const { getNetworkPolicy } = await import('../../core/sandbox/networkPolicy.js');
    const policy = getNetworkPolicy();
    res.json(policy.checkAccess(url));
  } catch (err: unknown) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// --- RBAC Violations ---
securityRouter.get('/violations', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string, 10) || 50;
    const { getEnhancedPermissionManager } = await import('../../core/rbac/agentPermissions.js');
    const pm = getEnhancedPermissionManager();
    res.json(pm.getViolations(limit));
  } catch (err: unknown) {
    res.status(500).json({ error: (err as Error).message });
  }
});

securityRouter.get('/violations/stats', async (_req, res) => {
  try {
    const { getEnhancedPermissionManager } = await import('../../core/rbac/agentPermissions.js');
    const pm = getEnhancedPermissionManager();
    res.json(pm.getViolationStats());
  } catch (err: unknown) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// --- RBAC Profiles ---
securityRouter.get('/rbac/profiles', async (_req, res) => {
  try {
    const { getEnhancedPermissionManager } = await import('../../core/rbac/agentPermissions.js');
    const pm = getEnhancedPermissionManager();
    res.json(pm.listProfiles());
  } catch (err: unknown) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// --- RBAC Permission Check ---
securityRouter.get('/rbac/check', async (req, res) => {
  try {
    const agent = req.query.agent as string;
    const action = req.query.action as string;
    const resource = req.query.resource as string | undefined;
    if (!agent || !action) {
      res.status(400).json({ error: 'agent and action query params required' });
      return;
    }
    const { getEnhancedPermissionManager } = await import('../../core/rbac/agentPermissions.js');
    const pm = getEnhancedPermissionManager();
    res.json(pm.checkPermission(agent, action, resource));
  } catch (err: unknown) {
    res.status(500).json({ error: (err as Error).message });
  }
});

logInfo('[Routes]', 'Security routes registered');
