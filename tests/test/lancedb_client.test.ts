import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LanceDBClient, lanceDBClient, invoiceStore } from '@packages/utils/lancedb_client.js';

const harness = vi.hoisted(() => ({
  logInfo: vi.fn(),
  logError: vi.fn(),
}));

vi.mock('@packages/utils/logger.js', () => ({
  logInfo: harness.logInfo,
  logError: harness.logError,
}));

function createQuery(rows: Array<Record<string, unknown>>) {
  const query = {
    filter: vi.fn(() => query),
    limit: vi.fn(() => query),
    toArray: vi.fn(async () => rows),
  };
  return query;
}

function createFakeDb(rows: Array<Record<string, unknown>>) {
  const table = {
    add: vi.fn(async () => undefined),
    query: vi.fn(() => createQuery(rows)),
    vectorSearch: vi.fn(() => createQuery(rows)),
  };

  return {
    table,
    tableNames: vi.fn(async () => ['invoices']),
    openTable: vi.fn(async () => table),
    createTable: vi.fn(async () => table),
  };
}

describe('LanceDBClient lifecycle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('reuses the module/connection cache until dispose() resets the instance', async () => {
    const fakeDb = createFakeDb([{ invoice_number: 'INV-1' }]);
    const connect = vi.fn(async () => fakeDb);
    const loadLanceDBModule = vi.fn(async () => ({ connect }));
    const client = new LanceDBClient({ dbPath: './data/test-lancedb', loadLanceDBModule });

    const first = await client.query('invoices');
    const second = await client.query('invoices');

    expect(first).toEqual([{ invoice_number: 'INV-1' }]);
    expect(second).toEqual(first);
    expect(loadLanceDBModule).toHaveBeenCalledTimes(1);
    expect(connect).toHaveBeenCalledTimes(1);
    expect(connect).toHaveBeenCalledWith('./data/test-lancedb');

    await client.dispose();
    await client.query('invoices');

    expect(loadLanceDBModule).toHaveBeenCalledTimes(2);
    expect(connect).toHaveBeenCalledTimes(2);
  });

  it('keeps the backward-compatible singleton exports available', () => {
    expect(lanceDBClient).toBeInstanceOf(LanceDBClient);
    expect(invoiceStore).toEqual(expect.objectContaining({
      isDuplicate: expect.any(Function),
      addInvoice: expect.any(Function),
    }));
  });
});
