// test/bookkeeping_db.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { initDB, getTransaction, saveTransaction, getPendingTransactions, updateTransaction, getAllTransactions } from '../src/data/bookkeeping_db.js';
import { BookkeepingTransaction, TransactionStatus } from '../src/types/bookkeeping.d.js';

describe('Bookkeeping Database', () => {
    beforeEach(() => {
        initDB(':memory:'); // Use in-memory SQLite for testing
    });

    it('should save and retrieve a transaction event', () => {
        const mockTx: BookkeepingTransaction = {
            id: 'tx_001',
            source: 'NAV',
            data: { invoiceNumber: 'INV-2026-001', amount: 10000, partner: 'Test Partner' },
            status: 'PENDING_MATCH'
        };
        saveTransaction(mockTx);
        const retrieved = getTransaction('tx_001');
        expect(retrieved).toEqual(mockTx);
    });

    it('should retrieve only pending transactions', () => {
        const tx1: BookkeepingTransaction = { id: 'tx_001', source: 'NAV', data: { invoiceNumber: 'INV-1', amount: 100 }, status: 'PENDING_MATCH' };
        const tx2: BookkeepingTransaction = { id: 'tx_002', source: 'BankAgent', data: { reference: 'REF-2', amount: 200, partner: 'P2', date: 'd2' }, status: 'PENDING_MATCH' };
        const tx3: BookkeepingTransaction = { id: 'tx_003', source: 'NAV', data: { invoiceNumber: 'INV-3', amount: 300 }, status: 'COMPLETED' };

        saveTransaction(tx1);
        saveTransaction(tx2);
        saveTransaction(tx3);

        const pending = getPendingTransactions();
        expect(pending).toEqual(expect.arrayContaining([tx1, tx2]));
        expect(pending).not.toEqual(expect.arrayContaining([tx3]));
        expect(pending.length).toBe(2);
    });

    it('should update a transaction status', () => {
        const tx: BookkeepingTransaction = { id: 'tx_001', source: 'NAV', data: { invoiceNumber: 'INV-1', amount: 100 }, status: 'PENDING_MATCH' };
        saveTransaction(tx);

        updateTransaction('tx_001', { status: 'COMPLETED' });
        const updatedTx = getTransaction('tx_001');
        expect(updatedTx!.status).toBe('COMPLETED');
    });

    it('should retrieve all transactions', () => {
        const tx1: BookkeepingTransaction = { id: 'tx_001', source: 'NAV', data: { invoiceNumber: 'INV-1', amount: 100 }, status: 'PENDING_MATCH' };
        const tx2: BookkeepingTransaction = { id: 'tx_002', source: 'BankAgent', data: { reference: 'REF-2', amount: 200, partner: 'P2', date: 'd2' }, status: 'COMPLETED' };

        saveTransaction(tx1);
        saveTransaction(tx2);

        const allTxs = getAllTransactions();
        expect(allTxs).toEqual(expect.arrayContaining([tx1, tx2]));
        expect(allTxs.length).toBe(2);
    });
});
