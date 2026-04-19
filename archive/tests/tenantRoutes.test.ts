import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const tenantHarness = vi.hoisted(() => ({
  listTenants: vi.fn(),
  createTenant: vi.fn(),
  getTenantStatus: vi.fn(),
}));

vi.mock('../src/core/tenantRegistry.js', () => ({
  listTenants: tenantHarness.listTenants,
  createTenant: tenantHarness.createTenant,
  getTenantStatus: tenantHarness.getTenantStatus,
}));

vi.mock('../src/utils/logger.js', () => ({
  logError: vi.fn(),
  logInfo: vi.fn(),
}));

describe('Tenant routes', () => {
  let createTenantRoutes: typeof import('../src/server/routes/tenants.js').createTenantRoutes;
  let app: express.Express;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    ({ createTenantRoutes } = await import('../src/server/routes/tenants.js'));
    app = express();
    app.use(express.json());
    app.use('/api/v1/tenants', createTenantRoutes());
  });

  it('rejects requests without X-Tenant-ID', async () => {
    const response = await request(app).get('/api/v1/tenants');

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ success: false, error: 'X-Tenant-ID header is required' });
  });

  it('lists all tenants for the system tenant', async () => {
    tenantHarness.listTenants.mockResolvedValue([
      { id: 'system', name: 'System Tenant', tier: 'enterprise', status: 'active', createdAt: '2026-04-14T00:00:00.000Z' },
      { id: 'vv-luxury', name: 'VV Luxury', tier: 'basic', status: 'active', createdAt: '2026-04-14T01:00:00.000Z' },
    ]);

    const response = await request(app)
      .get('/api/v1/tenants')
      .set('X-Tenant-ID', 'system');

    expect(response.status).toBe(200);
    expect(response.body.count).toBe(2);
    expect(response.body.tenants).toHaveLength(2);
    expect(tenantHarness.listTenants).toHaveBeenCalledTimes(1);
  });

  it('filters the tenant list for a non-system tenant', async () => {
    tenantHarness.listTenants.mockResolvedValue([
      { id: 'system', name: 'System Tenant', tier: 'enterprise', status: 'active', createdAt: '2026-04-14T00:00:00.000Z' },
      { id: 'vv-luxury', name: 'VV Luxury', tier: 'basic', status: 'active', createdAt: '2026-04-14T01:00:00.000Z' },
    ]);

    const response = await request(app)
      .get('/api/v1/tenants')
      .set('X-Tenant-ID', 'vv-luxury');

    expect(response.status).toBe(200);
    expect(response.body.count).toBe(1);
    expect(response.body.tenants).toEqual([
      { id: 'vv-luxury', name: 'VV Luxury', tier: 'basic', status: 'active', createdAt: '2026-04-14T01:00:00.000Z' },
    ]);
  });

  it('restricts tenant creation to the system tenant', async () => {
    const response = await request(app)
      .post('/api/v1/tenants')
      .set('X-Tenant-ID', 'vv-luxury')
      .send({ name: 'New Tenant' });

    expect(response.status).toBe(403);
    expect(response.body.error).toContain('restricted to the system tenant');
  });

  it('creates a tenant for the system tenant', async () => {
    tenantHarness.createTenant.mockResolvedValue({
      id: 'new-tenant',
      name: 'New Tenant',
      tier: 'basic',
      status: 'active',
      createdAt: '2026-04-14T02:00:00.000Z',
      storagePath: 'storage/tenants/new-tenant',
      counts: { tasks: 0, studioProjects: 0, businessJobs: 0, businessLeads: 0, pullRequests: 0 },
      activeWorkItems: 0,
    });

    const response = await request(app)
      .post('/api/v1/tenants')
      .set('X-Tenant-ID', 'system')
      .send({ name: 'New Tenant', id: 'new-tenant', tier: 'basic' });

    expect(response.status).toBe(201);
    expect(response.body.tenant.id).toBe('new-tenant');
    expect(tenantHarness.createTenant).toHaveBeenCalledWith({ name: 'New Tenant', id: 'new-tenant', tier: 'basic', domain: undefined, status: undefined });
  });

  it('denies cross-tenant status access', async () => {
    const response = await request(app)
      .get('/api/v1/tenants/other/status')
      .set('X-Tenant-ID', 'vv-luxury');

    expect(response.status).toBe(403);
    expect(response.body.error).toContain('Cross-tenant status access denied');
  });

  it('returns tenant status for the requested tenant', async () => {
    tenantHarness.getTenantStatus.mockResolvedValue({
      id: 'vv-luxury',
      name: 'VV Luxury',
      tier: 'basic',
      status: 'active',
      createdAt: '2026-04-14T01:00:00.000Z',
      storagePath: 'storage/tenants/vv-luxury',
      counts: { tasks: 2, studioProjects: 1, businessJobs: 0, businessLeads: 1, pullRequests: 0 },
      activeWorkItems: 4,
    });

    const response = await request(app)
      .get('/api/v1/tenants/vv-luxury/status')
      .set('X-Tenant-ID', 'system');

    expect(response.status).toBe(200);
    expect(response.body.status.id).toBe('vv-luxury');
    expect(response.body.activeTenantId).toBe('system');
    expect(tenantHarness.getTenantStatus).toHaveBeenCalledWith('vv-luxury');
  });
});
