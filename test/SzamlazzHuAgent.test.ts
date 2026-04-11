import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SzamlazzHuAgent } from '../src/agents/SzamlazzHuAgent.js';
import { getSzamlazzInvoicesHandler } from '../src/tools/getSzamlazzInvoices.js';
import { writeSheetsInvoicesHandler } from '../src/tools/writeSheetsInvoices.js';

vi.mock('../src/tools/getSzamlazzInvoices.js');
vi.mock('../src/tools/writeSheetsInvoices.js');
vi.mock('../src/utils/logger.js');

describe('SzamlazzHuAgent', () => {
  let agent: SzamlazzHuAgent;

  beforeEach(() => {
    vi.clearAllMocks();
    agent = new SzamlazzHuAgent();
  });

  it('fetches invoices successfully', async () => {
    (getSzamlazzInvoicesHandler as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      success: true,
      data: [
        { invoice_no: 'INV-1', invoice_date: '2026-04-10' },
      ],
      stats: { count: 1 },
    });

    const result = await agent.execute('fetch szamlazz invoices');

    expect(result.success).toBe(true);
    expect(getSzamlazzInvoicesHandler).toHaveBeenCalledTimes(1);
    expect(writeSheetsInvoicesHandler).not.toHaveBeenCalled();
  });

  it('syncs fetched invoices to sheets when requested', async () => {
    (getSzamlazzInvoicesHandler as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      success: true,
      data: [{ invoice_no: 'INV-2', invoice_date: '2026-04-11' }],
      stats: { count: 1 },
    });
    (writeSheetsInvoicesHandler as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      success: true,
      data: { row_count: 1 },
    });

    const result = await agent.execute('sync szamlazz invoices');

    expect(result.success).toBe(true);
    expect(writeSheetsInvoicesHandler).toHaveBeenCalledWith(
      expect.objectContaining({
        invoices: [{ invoice_no: 'INV-2', invoice_date: '2026-04-11' }],
        append: true,
        skip_duplicates: true,
      }),
    );
  });

  it('returns success when fetch yields no invoices', async () => {
    (getSzamlazzInvoicesHandler as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      success: true,
      data: [],
      stats: { count: 0 },
    });

    const result = await agent.execute('fetch szamlazz invoices');

    expect(result.success).toBe(true);
    expect(result.data).toEqual(expect.objectContaining({ count: 0 }));
  });

  it('returns an error when the fetch handler fails', async () => {
    (getSzamlazzInvoicesHandler as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      success: false,
      error: 'Szamlazz API down',
    });

    const result = await agent.execute('fetch szamlazz invoices');

    expect(result.success).toBe(false);
    expect(result.message).toContain('Szamlazz API down');
  });

  it('rejects unsupported tasks', async () => {
    const result = await agent.execute('do something unrelated');

    expect(result.success).toBe(false);
    expect(result.message).toContain('Ismeretlen feladat');
  });
});
