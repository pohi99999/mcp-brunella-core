import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Command } from 'commander';

const tenantHarness = vi.hoisted(() => ({
  listTenants: vi.fn(),
  createTenant: vi.fn(),
  getTenantStatus: vi.fn(),
  logInfo: vi.fn(),
  logError: vi.fn(),
}));

vi.mock('@packages/core-logic/tenantRegistry.js', () => ({
  listTenants: tenantHarness.listTenants,
  createTenant: tenantHarness.createTenant,
  getTenantStatus: tenantHarness.getTenantStatus,
}));

vi.mock('@packages/utils/logger.js', () => ({
  logInfo: tenantHarness.logInfo,
  logError: tenantHarness.logError,
}));

import { registerTenantCommands } from '@apps/mcp-core/commands/tenantCommands.js';

describe('Tenant CLI commands', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    tenantHarness.listTenants.mockReset();
    tenantHarness.createTenant.mockReset();
    tenantHarness.getTenantStatus.mockReset();
    tenantHarness.logInfo.mockReset();
    tenantHarness.logError.mockReset();
    process.exitCode = undefined;
  });

  it('registers the tenant command group', () => {
    const program = new Command();
    registerTenantCommands(program);

    const tenant = program.commands.find((command) => command.name() === 'tenant');
    expect(tenant).toBeDefined();
    expect(tenant?.commands.map((command) => command.name())).toEqual(
      expect.arrayContaining(['list', 'create', 'status']),
    );
  });

  it('lists tenants in JSON output', async () => {
    const program = new Command();
    registerTenantCommands(program);

    tenantHarness.listTenants.mockResolvedValue([
      {
        id: 'system',
        name: 'System Tenant',
        tier: 'enterprise',
        status: 'active',
        createdAt: '2026-04-14T00:00:00.000Z',
      },
    ]);

    const stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    await program.parseAsync(['node', 'test', 'tenant', 'list']);

    expect(tenantHarness.listTenants).toHaveBeenCalledTimes(1);
    expect(tenantHarness.logInfo).toHaveBeenCalledWith('CLI', 'Tenant lista lekérdezése');
    const output = stdoutSpy.mock.calls.map((args) => args.map(String).join('')).join('');
    expect(output).toContain('Tenant list');
    expect(output).toContain('System Tenant');
  });

  it('creates a tenant with the provided options', async () => {
    const program = new Command();
    registerTenantCommands(program);

    tenantHarness.createTenant.mockResolvedValue({
      id: 'vv-luxury',
      name: 'VV Luxury',
      domain: 'vv.example.com',
      tier: 'basic',
      status: 'active',
      createdAt: '2026-04-14T00:00:00.000Z',
      storagePath: 'storage/tenants/vv-luxury',
      counts: { tasks: 0, studioProjects: 0, businessJobs: 0, businessLeads: 0, pullRequests: 0 },
      activeWorkItems: 0,
    });

    const stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    await program.parseAsync(['node', 'test', 'tenant', 'create', '--name', 'VV Luxury', '--id', 'vv-luxury', '--domain', 'vv.example.com', '--tier', 'basic']);

    expect(tenantHarness.createTenant).toHaveBeenCalledWith({
      id: 'vv-luxury',
      name: 'VV Luxury',
      domain: 'vv.example.com',
      tier: 'basic',
      status: undefined,
    });
    const output = stdoutSpy.mock.calls.map((args) => args.map(String).join('')).join('');
    expect(output).toContain('Tenant created');
    expect(output).toContain('vv-luxury');
    expect(output).toContain('storage/tenants/vv-luxury');
  });

  it('renders tenant status output', async () => {
    const program = new Command();
    registerTenantCommands(program);

    tenantHarness.getTenantStatus.mockResolvedValue({
      id: 'vv-luxury',
      name: 'VV Luxury',
      domain: 'vv.example.com',
      tier: 'basic',
      status: 'active',
      createdAt: '2026-04-14T00:00:00.000Z',
      storagePath: 'storage/tenants/vv-luxury',
      counts: { tasks: 3, studioProjects: 1, businessJobs: 0, businessLeads: 2, pullRequests: 0 },
      activeWorkItems: 6,
    });

    const stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    await program.parseAsync(['node', 'test', 'tenant', 'status', 'vv-luxury']);

    expect(tenantHarness.getTenantStatus).toHaveBeenCalledWith('vv-luxury');
    const output = stdoutSpy.mock.calls.map((args) => args.map(String).join('')).join('');
    expect(output).toContain('Tenant status');
    expect(output).toContain('activeWorkItems');
    expect(output).toContain('storage/tenants/vv-luxury');
  });

  it('sets a non-zero exit code when tenant creation fails', async () => {
    const program = new Command();
    registerTenantCommands(program);

    tenantHarness.createTenant.mockRejectedValue(new Error('tenant db unavailable'));

    await program.parseAsync(['node', 'test', 'tenant', 'create', '--name', 'Broken']);

    expect(tenantHarness.logError).toHaveBeenCalledWith('CLI', expect.stringContaining('tenant db unavailable'));
    expect(process.exitCode).toBe(1);
  });
});
