import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FinanceGuardian } from '../src/agents/FinanceGuardian.js';
import { invoiceStore } from '../src/utils/lancedb_client.js';

// Mock InvoiceStore
vi.mock('../src/utils/lancedb_client.js', () => {
  return {
    invoiceStore: {
      connect: vi.fn(),
      isDuplicate: vi.fn(),
      addInvoice: vi.fn()
    }
  };
});

describe('FinanceGuardian - Invoice Processing & Duplicate Detection', () => {
  let agent: FinanceGuardian;

  beforeEach(() => {
    vi.clearAllMocks();
    agent = new FinanceGuardian();
  });

  it('should process a new invoice and save it', async () => {
    const invoiceData = { invoice_number: 'INV-001', vendor_name: 'Test Vendor', amount: 1000 };
    vi.mocked(invoiceStore.isDuplicate).mockResolvedValue(false);

    const result = await agent.executeTask({
      task: "Process invoice data",
      invoiceData
    });

    expect(result.success).toBe(true);
    expect(result.message).toContain('sikeresen feldolgozva');
    expect(invoiceStore.addInvoice).toHaveBeenCalledWith(invoiceData);
  });

  it('should detect and skip a duplicate invoice', async () => {
    const invoiceData = { invoice_number: 'INV-001', vendor_name: 'Test Vendor', amount: 1000 };
    vi.mocked(invoiceStore.isDuplicate).mockResolvedValue(true);

    const result = await agent.executeTask({
      task: "Process invoice data",
      invoiceData
    });

    expect(result.success).toBe(true);
    expect(result.message).toContain('már létezik');
    expect(result.data.isDuplicate).toBe(true);
    expect(invoiceStore.addInvoice).not.toHaveBeenCalled();
  });
});
