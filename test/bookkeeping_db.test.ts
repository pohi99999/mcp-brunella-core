// test/bookkeeping_db.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import {
    createCashEntry,
    getAllTransactions,
    getCashEntry,
    getCashEntries,
    getCashSummary,
    getPendingTransactions,
    getTransaction,
    initDB,
    saveTransaction,
    updateCashEntry,
    updateTransaction,
} from '../src/data/bookkeeping_db.js';
import { BookkeepingTransaction } from '../src/types/bookkeeping.d.js';

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

    it('should create, filter, update and summarize cash entries', () => {
        const entry1 = createCashEntry({
            date: '2026-03-29',
            type: 'KP_IN',
            amount: 15000,
            description: 'Készpénzes bevétel',
            source: 'manual',
            syncedSheets: false,
        });
        const entry2 = createCashEntry({
            date: '2026-03-30',
            type: 'KP_OUT',
            amount: 2500,
            description: 'Irodaszer beszerzés',
            invoiceNumber: 'INV-2',
            source: 'email',
            syncedSheets: true,
        });

        expect(entry1.id).toBe(1);
        expect(entry1.syncedSheets).toBe(false);
        expect(getCashEntry(entry2.id)).toEqual(entry2);

        const filtered = getCashEntries({ type: 'KP_IN' });
        expect(filtered).toHaveLength(1);
        expect(filtered[0].description).toBe('Készpénzes bevétel');

        const updated = updateCashEntry(entry1.id, { syncedSheets: true, description: 'Frissített bevétel' });
        expect(updated?.syncedSheets).toBe(true);
        expect(getCashEntry(entry1.id)?.description).toBe('Frissített bevétel');

        const summary = getCashSummary();
        expect(summary).toMatchObject({
            total: 2,
            income: 15000,
            expense: 2500,
            balance: 12500,
            syncedSheets: 2,
            pendingSheets: 0,
        });
        expect(summary.byType).toMatchObject({ KP_IN: 1, KP_OUT: 1 });
    });
});
