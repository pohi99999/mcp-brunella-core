import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { closeCrmDb, initCrmDb } from '@packages/utils/crm_db.js';
import { kkvCrmService } from '@packages/core-logic/services/kkvCrmService.js';

const hookHarness = vi.hoisted(() => ({
  fireHook: vi.fn(async () => ({ status: 'fired' })),
}));

vi.mock('@packages/core-logic/hookRegistry.js', () => ({
  fireHook: hookHarness.fireHook,
  fireHookSafely: hookHarness.fireHook,
}));

describe('kkvCrmService', () => {
  let dbPath: string;

  beforeEach(() => {
    dbPath = path.join(mkdtempSync(path.join(os.tmpdir(), 'kkv-crm-service-')), 'crm.db');
    initCrmDb(dbPath);
    hookHarness.fireHook.mockClear();
  });

  afterEach(() => {
    try {
      closeCrmDb();
    } finally {
      rmSync(path.dirname(dbPath), { recursive: true, force: true });
    }
  });

  it('creates a lead and follow-up plan for a valid payload', async () => {
    const result = await kkvCrmService.createLead(
      {
        source: 'demo-request',
        payload: {
          id: 'lead-hot-1',
          email: 'lead.hot@example.com',
          phone: '+36-30-777-1111',
          company: 'Hot Kft',
          created_at: '2026-04-04T10:34:00Z',
          urgency: 'high',
          budget: 7500,
          timeline: 'this week',
        },
      },
      { dbFilePath: dbPath },
    );

    expect(result.success).toBe(true);
    if (!result.success) {
      throw new Error(result.error);
    }

    expect(result.inserted).toBe(true);
    expect(result.eventType).toBe('created');
    expect(result.createdAt).toBe('2026-04-04T10:34:00Z');
    expect(result.lead.id).toBe('lead-hot-1');
    expect(result.followUpCreated).toBe(true);
    expect(result.followUpPlan).not.toBeNull();
    expect(result.followUpActions).toHaveLength(3);
    expect(result.snapshot.leadStats.total).toBe(1);
    expect(result.snapshot.followUpStats.totalPlans).toBe(1);
    expect(hookHarness.fireHook).toHaveBeenCalledWith(
      'crm:lead:created',
      expect.objectContaining({
        eventType: 'created',
        lead: expect.objectContaining({ id: 'lead-hot-1' }),
      }),
      expect.anything(),
    );
  });

  it('deduplicates repeated lead payloads', async () => {
    const payload = {
      source: 'webhook',
      payload: {
        id: 'lead-dedup-1',
        email: 'dedupe@example.com',
        phone: '+36-30-123-4567',
        company: 'Dedupe Kft',
        created_at: '2026-04-04T11:00:00Z',
      },
    };

    const first = await kkvCrmService.createLead(payload, { dbFilePath: dbPath });
    expect(first.success).toBe(true);
    if (!first.success) {
      throw new Error(first.error);
    }

    const second = await kkvCrmService.createLead(payload, { dbFilePath: dbPath });
    expect(second.success).toBe(true);
    if (!second.success) {
      throw new Error(second.error);
    }

    expect(first.inserted).toBe(true);
    expect(second.inserted).toBe(false);
    expect(second.eventType).toBe('deduped');
    expect(second.lead.id).toBe(first.lead.id);
    expect(second.snapshot.leadStats.total).toBe(1);
    expect(second.snapshot.leadStats.deduped).toBe(1);
    expect(hookHarness.fireHook).toHaveBeenLastCalledWith(
      'crm:lead:created',
      expect.objectContaining({
        eventType: 'deduped',
      }),
      expect.anything(),
    );
  });

  it('returns a validation failure for invalid payloads', async () => {
    const result = await kkvCrmService.createLead(null, { dbFilePath: dbPath });

    expect(result.success).toBe(false);
    if (result.success) {
      throw new Error('Expected invalid payload to fail');
    }

    expect(result.error).toBe('Invalid CRM lead payload');
    expect(result.statusCode).toBe(400);
  });

  it('returns a consistent status snapshot', async () => {
    const result = await kkvCrmService.createLead(
      {
        source: 'partner',
        payload: {
          id: 'lead-status-1',
          email: 'status@example.com',
          phone: '+36-30-888-2222',
          company: 'Status Kft',
          created_at: '2026-04-04T12:00:00Z',
        },
      },
      { dbFilePath: dbPath },
    );

    expect(result.success).toBe(true);
    const status = kkvCrmService.getStatus({ dbFilePath: dbPath });

    expect(status.success).toBe(true);
    expect(status.leadStats.total).toBe(1);
    expect(status.followUpStats.totalPlans).toBe(1);
    expect(status.followUpSummary.totalPlans).toBe(1);
    expect(status.generatedAt).toMatch(/T/);
  });
});
