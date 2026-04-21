import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { rmSync } from 'fs';
import path from 'path';

vi.mock('../src/utils/logger.js');

import { NavAgent } from '../src/agents/NavAgent.js';

const navDir = path.resolve(process.cwd(), 'data', 'nav');

describe('NavAgent', () => {
  let agent: NavAgent;

  beforeEach(() => {
    agent = new NavAgent();
    rmSync(navDir, { recursive: true, force: true });
  });

  afterEach(() => {
    rmSync(navDir, { recursive: true, force: true });
  });

  it('keeps the fetch compatibility path for legacy callers', async () => {
    const result = await agent.execute('fetch NAV invoices');

    expect(result.success).toBe(true);
    expect(result.status).toBe('success');
    expect(result.data).toEqual(expect.objectContaining({ count: 1 }));
  });

  it('validates invoices locally when NAV payload is not provided', async () => {
    const result = await agent.execute('validate invoice', {
      invoice: {
        invoiceNumber: 'NAV-2026-0001',
        partnerName: 'Teszt Kft.',
        amount: 12000,
        currency: 'HUF',
        issueDate: '2026-04-01',
      },
    });

    expect(result.success).toBe(true);
    expect(result.status).toBe('success');
    expect(result.data).toEqual(expect.objectContaining({
      nav_status: 'LOCAL_ONLY',
      discrepancies: [],
    }));
  });

  it('reports a mismatch when NAV payload differs', async () => {
    const result = await agent.execute('validate invoice', {
      invoice: {
        invoiceNumber: 'NAV-2026-0001',
        partnerName: 'Teszt Kft.',
        amount: 12000,
        currency: 'HUF',
        issueDate: '2026-04-01',
      },
      navData: {
        invoiceNumber: 'NAV-2026-9999',
        supplierName: 'Eltérő Kft.',
        grossAmount: 14000,
        currency: 'EUR',
        issueDate: '2026-04-02',
      },
    });

    expect(result.success).toBe(false);
    expect(result.status).toBe('error');
    expect(result.data).toEqual(expect.objectContaining({
      nav_status: 'MISMATCH',
    }));

    const data = result.data as { discrepancies?: unknown };
    expect(Array.isArray(data.discrepancies)).toBe(true);
    expect((data.discrepancies as string[]).length).toBeGreaterThan(0);
  });
});
