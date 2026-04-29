import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MatchingAgent } from '@packages/agents/MatchingAgent.js';
import { initDB, saveTransaction } from '@packages/utils/bookkeeping_db.js';

vi.mock('@packages/utils/logger.js', () => ({
  logInfo: vi.fn(),
  logError: vi.fn(),
  logWarn: vi.fn(),
  setAgentStatus: vi.fn(),
}));

describe('MatchingAgent Multi-Match', () => {
  let agent: MatchingAgent;

  beforeEach(() => {
    initDB(':memory:');
    agent = new MatchingAgent();
  });

  it('successfully matches one bank transaction to multiple invoices', async () => {
    // Seed invoices
    const inv1 = {
      id: 'nav_inv_1',
      source: 'NAV',
      data: { invoiceNumber: 'INV-001', partner: 'Test Kft', amount: 10000, date: '2026-04-01' },
      status: 'PENDING_MATCH'
    };
    const inv2 = {
      id: 'nav_inv_2',
      source: 'NAV',
      data: { invoiceNumber: 'INV-002', partner: 'Test Kft', amount: 5000, date: '2026-04-01' },
      status: 'PENDING_MATCH'
    };
    
    // Seed bank transaction (sum of inv1 and inv2)
    const bankTx = {
      id: 'bank_tx_1',
      source: 'BankAgent',
      data: { partner: 'Test Kft', amount: 15000, date: '2026-04-02', reference: 'INV-001, INV-002' },
      status: 'PENDING_MATCH'
    };

    saveTransaction(inv1 as any);
    saveTransaction(inv2 as any);
    saveTransaction(bankTx as any);

    const result = await (agent as any).execute('Match all PENDING transactions');
    
    expect(result.status).toBe('success');
    
    // Check if bank transaction is COMPLETED
    const { getAllTransactions } = await import('@packages/utils/bookkeeping_db.js');
    const transactions = getAllTransactions();
    const updatedBankTx = transactions.find(t => t.id === 'bank_tx_1');
    
    expect(updatedBankTx?.status).toBe('COMPLETED');
    expect(updatedBankTx?.matchedInvoice).toContain('INV-001');
    expect(updatedBankTx?.matchedInvoice).toContain('INV-002');
  });
});
