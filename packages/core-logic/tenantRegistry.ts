import { mkdir } from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

import type Database from 'better-sqlite3';

import { getGlobalDb } from '@packages/utils/globalDb.js';
import { ensureError } from '@packages/utils/ensureError.js';
import { logInfo } from '@packages/utils/logger.js';
import type { Tenant, TenantCreateInput, TenantCounts, TenantStatus } from '@packages/types/tenant.js';

interface TenantRow {
  id: string;
  name: string;
  domain: string | null;
  tier: Tenant['tier'];
  status: Tenant['status'];
  created_at: string;
}

interface CountRow {
  count: number;
}

const DEFAULT_TIER: Tenant['tier'] = 'basic';
const DEFAULT_STATUS: Tenant['status'] = 'active';
const TENANT_TABLES = ['tasks', 'studio_projects', 'business_jobs', 'business_leads', 'pull_requests'] as const;

function resolveDb(database?: Database.Database): Database.Database {
  return database ?? getGlobalDb();
}

function slugify(value: string): string {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return normalized || uuidv4();
}

function mapTenantRow(row: TenantRow): Tenant {
  return {
    id: row.id,
    name: row.name,
    domain: row.domain ?? undefined,
    tier: row.tier,
    status: row.status,
    createdAt: row.created_at,
  };
}

function countTenantRows(database: Database.Database, table: string, tenantId: string): number {
  const row = database.prepare(`SELECT COUNT(*) as count FROM ${table} WHERE tenant_id = ?`).get(tenantId) as CountRow | undefined;
  return row?.count ?? 0;
}

function getTenantCounts(database: Database.Database, tenantId: string): TenantCounts {
  return {
    tasks: countTenantRows(database, 'tasks', tenantId),
    studioProjects: countTenantRows(database, 'studio_projects', tenantId),
    businessJobs: countTenantRows(database, 'business_jobs', tenantId),
    businessLeads: countTenantRows(database, 'business_leads', tenantId),
    pullRequests: countTenantRows(database, 'pull_requests', tenantId),
  };
}

export function getTenantStoragePath(tenantId: string): string {
  return path.join(process.cwd(), 'storage', 'tenants', tenantId);
}

export async function ensureTenantStorage(tenantId: string): Promise<string> {
  const storagePath = getTenantStoragePath(tenantId);
  await mkdir(path.join(storagePath, 'config'), { recursive: true });
  await mkdir(path.join(storagePath, 'credentials'), { recursive: true });
  return storagePath;
}

export async function listTenants(database?: Database.Database): Promise<Tenant[]> {
  const db = resolveDb(database);
  const rows = db.prepare('SELECT id, name, domain, tier, status, created_at FROM tenants ORDER BY created_at DESC').all() as TenantRow[];
  return rows.map(mapTenantRow);
}

export async function createTenant(input: TenantCreateInput, database?: Database.Database): Promise<TenantStatus> {
  const name = input.name.trim();
  if (!name) {
    throw new Error('Tenant name is required');
  }

  const db = resolveDb(database);
  const tenantId = input.id?.trim() || slugify(name);
  const tenant: TenantRow = {
    id: tenantId,
    name,
    domain: input.domain?.trim() || null,
    tier: input.tier ?? DEFAULT_TIER,
    status: input.status ?? DEFAULT_STATUS,
    created_at: new Date().toISOString(),
  };

  db.prepare('INSERT INTO tenants (id, name, domain, tier, status) VALUES (?, ?, ?, ?, ?)')
    .run(tenant.id, tenant.name, tenant.domain, tenant.tier, tenant.status);

  const storagePath = await ensureTenantStorage(tenant.id);
  const status = await getTenantStatus(tenant.id, db);

  logInfo('TenantRegistry', `Created tenant ${tenant.id} (${tenant.name})`);

  return {
    ...status,
    storagePath,
  };
}

export async function getTenantStatus(tenantId: string, database?: Database.Database): Promise<TenantStatus> {
  const db = resolveDb(database);
  const row = db.prepare('SELECT id, name, domain, tier, status, created_at FROM tenants WHERE id = ?').get(tenantId) as TenantRow | undefined;

  if (!row) {
    throw new Error(`Tenant not found: ${tenantId}`);
  }

  const tenant = mapTenantRow(row);
  const counts = getTenantCounts(db, tenantId);
  const activeWorkItems = counts.tasks + counts.studioProjects + counts.businessJobs + counts.businessLeads + counts.pullRequests;

  return {
    ...tenant,
    storagePath: getTenantStoragePath(tenantId),
    counts,
    activeWorkItems,
  };
}

export async function ensureSystemTenant(database?: Database.Database): Promise<TenantStatus> {
  const db = resolveDb(database);
  const existing = db.prepare('SELECT id, name, domain, tier, status, created_at FROM tenants WHERE id = ?').get('system') as TenantRow | undefined;

  if (existing) {
    return getTenantStatus('system', db);
  }

  db.prepare('INSERT INTO tenants (id, name, domain, tier, status) VALUES (?, ?, ?, ?, ?)')
    .run('system', 'System Tenant', 'localhost', 'enterprise', 'active');

  await ensureTenantStorage('system');
  return getTenantStatus('system', db);
}

export function normalizeTenantContext(input?: string): string {
  return input?.trim() || 'system';
}

export function isTenantTable(name: string): boolean {
  return TENANT_TABLES.includes(name as typeof TENANT_TABLES[number]);
}

