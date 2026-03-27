// test/SheetsSyncAgent.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SheetsSyncAgent } from '../src/agents/SheetsSyncAgent.js';
import * as db from '../src/data/bookkeeping_db.js';
import { AgentContext } from '../src/agents/BaseAgent.js';
import { BookkeepingTransaction, TransactionStatus } from '../src/types/bookkeeping.d.js';

describe('SheetsSyncAgent', () => {
    beforeEach(() => {
        vi.spyOn(db, 'getAllTransactions').mockResolvedValue([]);
        vi.spyOn(console, 'log').mockImplementation(() => {}); // Mock console.log
    });

    it('should format a transaction into a Sheets row', () => {
        const agent = new SheetsSyncAgent();
        const tx: BookkeepingTransaction = {
            id: 'tx_001',
            source: 'NAV',
            status: 'COMPLETED' as TransactionStatus,
            data: { invoiceNumber: 'INV-1', amount: 1000, partner: 'Test Partner' }
        };
        const row = agent.formatRow(tx);
        
        expect(row[0]).toBe('INV-1'); // Invoice Number
        expect(row[1]).toBe(1000);    // Amount
        expect(row[2]).toBe('');      // Bank Date (not present in this mock tx)
        expect(row[3]).toBe('COMPLETED'); // Status
    });

    it('should execute and sync all transactions to Sheets (mocked)', async () => {
        const agent = new SheetsSyncAgent();
        const mockTx1: BookkeepingTransaction = {
            id: 'tx_001',
            source: 'NAV',
            status: 'COMPLETED' as TransactionStatus,
            data: { invoiceNumber: 'INV-A', amount: 100, partner: 'P1' }
        };
        const mockTx2: BookkeepingTransaction = {
            id: 'tx_002',
            source: 'BankAgent',
            status: 'PENDING_MATCH' as TransactionStatus,
            data: { date: '2026-03-29', partner: 'P2', amount: 200, reference: 'REF-B' }
        };
        vi.spyOn(db, 'getAllTransactions').mockResolvedValue([mockTx1, mockTx2]);

        const mockContext: AgentContext = { payload: {} };
        const result = await agent.executeTask(mockContext);

        expect(result.success).toBe(true);
        expect(result.message).toBe("Synced 2 transactions to Sheets");
        expect(result.data).toEqual([
            ['INV-A', 100, '', 'COMPLETED'],
            ['', 200, '2026-03-29', 'PENDING_MATCH']
        ]);
        expect(console.log).toHaveBeenCalledWith("Simulating Google Sheets update with the following rows:", expect.any(Array));
    });
});
