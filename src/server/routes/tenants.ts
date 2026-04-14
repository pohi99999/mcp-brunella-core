import { Router, type Request, type Response } from 'express';

import { createTenant, getTenantStatus, listTenants } from '../../core/tenantRegistry.js';
import { ensureError } from '../../utils/ensureError.js';
import { logError } from '../../utils/logger.js';

function readTenantHeader(req: Request): string | null {
  const tenantId = req.header('X-Tenant-ID')?.trim();
  return tenantId && tenantId.length > 0 ? tenantId : null;
}

export function createTenantRoutes(): Router {
  const router = Router();

  router.use((req, res, next) => {
    const tenantId = readTenantHeader(req);
    if (!tenantId) {
      return res.status(400).json({ success: false, error: 'X-Tenant-ID header is required' });
    }

    res.locals.tenantId = tenantId;
    next();
  });

  router.get('/', async (_req, res) => {
    try {
      const tenantId = String(res.locals.tenantId);
      const tenants = await listTenants();
      const visibleTenants = tenantId === 'system' ? tenants : tenants.filter((tenant) => tenant.id === tenantId);

      res.json({
        success: true,
        activeTenantId: tenantId,
        count: visibleTenants.length,
        tenants: visibleTenants,
      });
    } catch (error: unknown) {
      const normalized = ensureError(error);
      logError('TenantRoutes', 'Tenant listing failed', normalized);
      res.status(500).json({ success: false, error: normalized.message });
    }
  });

  router.post('/', async (req, res) => {
    try {
      const tenantId = String(res.locals.tenantId);
      if (tenantId !== 'system') {
        return res.status(403).json({ success: false, error: 'Tenant creation is restricted to the system tenant' });
      }

      const { id, name, domain, tier, status } = req.body ?? {};
      const tenant = await createTenant({ id, name, domain, tier, status });

      res.status(201).json({
        success: true,
        activeTenantId: tenantId,
        tenant,
      });
    } catch (error: unknown) {
      const normalized = ensureError(error);
      logError('TenantRoutes', 'Tenant creation failed', normalized);
      res.status(500).json({ success: false, error: normalized.message });
    }
  });

  router.get('/:tenantId/status', async (req, res) => {
    try {
      const tenantId = String(res.locals.tenantId);
      const requestedTenantId = req.params.tenantId;

      if (tenantId !== 'system' && tenantId !== requestedTenantId) {
        return res.status(403).json({ success: false, error: 'Cross-tenant status access denied' });
      }

      const status = await getTenantStatus(requestedTenantId);

      res.json({
        success: true,
        activeTenantId: tenantId,
        status,
      });
    } catch (error: unknown) {
      const normalized = ensureError(error);
      logError('TenantRoutes', 'Tenant status failed', normalized);
      res.status(404).json({ success: false, error: normalized.message });
    }
  });

  return router;
}
