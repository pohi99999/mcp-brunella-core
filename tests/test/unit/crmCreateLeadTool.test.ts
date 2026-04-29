import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { closeCrmDb, initCrmDb } from '@packages/utils/crm_db.js';
import { crmCreateLeadHandler } from '@packages/utils/crm_create_lead.js';

describe('crmCreateLeadHandler', () => {
  let dbPath: string;

  beforeEach(() => {
    dbPath = path.join(mkdtempSync(path.join(os.tmpdir(), 'crm-tool-')), 'crm.db');
    initCrmDb(dbPath);
  });

  afterEach(() => {
    try {
      closeCrmDb();
    } finally {
      rmSync(path.dirname(dbPath), { recursive: true, force: true });
    }
  });

  it('returns a structured MCP response for a valid lead payload', async () => {
    const response = await crmCreateLeadHandler({
      payload: {
        source: 'webhook',
        id: 'tool-lead-1',
        email: 'tool@example.com',
        phone: '+36-30-999-1111',
        company: 'Tool Kft',
        created_at: '2026-04-04T15:00:00Z',
      },
      workflowId: 'wf-tool-1',
    });

    expect(response.isError).not.toBe(true);
    expect(response.content).toHaveLength(1);

    const text = response.content?.[0]?.text ?? '';
    const parsed = JSON.parse(text) as Record<string, unknown>;

    expect(parsed).toEqual(
      expect.objectContaining({
        ok: true,
        inserted: true,
        eventType: 'created',
      }),
    );
    expect((parsed.lead as { id?: string }).id).toBe('tool-lead-1');
  });
});
