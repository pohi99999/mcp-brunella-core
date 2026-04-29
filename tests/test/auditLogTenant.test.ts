import { beforeEach, describe, expect, it } from 'vitest';

import { clearAuditLog, getAuditLog, getAuditStats, getDeniedEntries, record } from '@packages/core-logic/auditLog.js';

describe('audit log tenant support', () => {
  beforeEach(async () => {
    await clearAuditLog();
  });

  it('stores and filters audit entries by tenant', async () => {
    await record('ALLOWED', 'AgentA', 'create', 'tenant-resource', undefined, 'tenant-a');
    await record('DENIED', 'AgentB', 'delete', 'tenant-resource', 'blocked', 'tenant-b');

    const allEntries = await getAuditLog(10, 0);
    expect(allEntries).toHaveLength(2);
    expect(allEntries.map((entry) => entry.tenantId)).toEqual(['tenant-b', 'tenant-a']);

    const tenantAEntries = await getAuditLog(10, 0, 'tenant-a');
    expect(tenantAEntries).toHaveLength(1);
    expect(tenantAEntries[0].tenantId).toBe('tenant-a');
  });

  it('filters denied entries by tenant', async () => {
    await record('DENIED', 'AgentA', 'create', 'resource-a', 'blocked', 'tenant-a');
    await record('DENIED', 'AgentB', 'delete', 'resource-b', 'blocked', 'tenant-b');

    const tenantAEntries = await getDeniedEntries(10, 'tenant-a');
    expect(tenantAEntries).toHaveLength(1);
    expect(tenantAEntries[0].tenantId).toBe('tenant-a');
  });

  it('returns tenant scoped stats and clear operations', async () => {
    await record('ALLOWED', 'AgentA', 'create', 'resource-a', undefined, 'tenant-a');
    await record('DENIED', 'AgentA', 'delete', 'resource-a', 'blocked', 'tenant-a');
    await record('DENIED', 'AgentB', 'delete', 'resource-b', 'blocked', 'tenant-b');

    const tenantStats = await getAuditStats('tenant-a');
    expect(tenantStats.totalEntries).toBe(2);
    expect(tenantStats.allowedCount).toBe(1);
    expect(tenantStats.deniedCount).toBe(1);

    await clearAuditLog('tenant-a');
    const remaining = await getAuditLog(10, 0);
    expect(remaining).toHaveLength(1);
    expect(remaining[0].tenantId).toBe('tenant-b');
  });
});
