import { describe, it, expect } from 'vitest';
import { summarizeInvoices } from '../src/kkv/financeAutomation.js';

describe('KKV Finance Automation - summarizeInvoices', () => {
  it('summarizes invoices by status', () => {
    const invoices = [
      { id: '1', amount: 100, status: 'paid' },
      { id: '2', amount: 50, status: 'pending' },
      { id: '3', amount: 25, status: 'overdue' },
      { id: '4', amount: 25, status: 'overdue' },
    ];

    const res = summarizeInvoices(invoices as any);
    expect(res.totalCount).toBe(4);
    expect(res.totalAmount).toBe(200);
    expect(res.byStatus.paid.count).toBe(1);
    expect(res.byStatus.overdue.amount).toBe(50);
  });

  it('handles empty array', () => {
    const res = summarizeInvoices([]);
    expect(res.totalCount).toBe(0);
    expect(res.totalAmount).toBe(0);
    expect(res.byStatus.pending.count).toBe(0);
  });
});
