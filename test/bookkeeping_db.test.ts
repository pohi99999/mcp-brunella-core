// test/bookkeeping_db.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import {
    createCashEntry,
    getAllTransactions,
    getCashEntry,
    getCashEntries,
    getCashSummary,
    getExceptionCount,
    getPendingTransactions,
    getReconciliationEvents,
    getTransaction,
    initDB,
    saveReconciliationEvent,
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

describe('Reconciliation Events', () => {
    beforeEach(() => {
        initDB(':memory:');
    });

    it('should save and retrieve reconciliation events', () => {
        const saved = saveReconciliationEvent({
            runId: 'run-1',
            txId: 'tx-1',
            outcome: 'MATCHED',
            matchType: 'HARD_MATCH',
            confidence: 100,
        });

        expect(saved.id).toBeGreaterThan(0);
        expect(saved.runId).toBe('run-1');
        expect(saved.txId).toBe('tx-1');
        expect(saved.outcome).toBe('MATCHED');
        expect(saved.matchType).toBe('HARD_MATCH');
        expect(saved.confidence).toBe(100);
        expect(saved.createdAt).toBeTruthy();

        const events = getReconciliationEvents('run-1');
        expect(events).toHaveLength(1);
        expect(events[0].txId).toBe('tx-1');
    });

    it('should filter events by runId', () => {
        saveReconciliationEvent({ runId: 'run-A', txId: 'tx-1', outcome: 'MATCHED' });
        saveReconciliationEvent({ runId: 'run-B', txId: 'tx-2', outcome: 'UNMATCHED' });
        saveReconciliationEvent({ runId: 'run-A', txId: 'tx-3', outcome: 'FUZZY_MATCHED' });

        const eventsA = getReconciliationEvents('run-A');
        expect(eventsA).toHaveLength(2);

        const eventsB = getReconciliationEvents('run-B');
        expect(eventsB).toHaveLength(1);
        expect(eventsB[0].outcome).toBe('UNMATCHED');
    });

    it('should count exceptions (UNMATCHED + ERROR outcomes)', () => {
        saveReconciliationEvent({ runId: 'r1', txId: 'tx-1', outcome: 'MATCHED' });
        saveReconciliationEvent({ runId: 'r1', txId: 'tx-2', outcome: 'UNMATCHED' });
        saveReconciliationEvent({ runId: 'r1', txId: 'tx-3', outcome: 'ERROR' });
        saveReconciliationEvent({ runId: 'r1', txId: 'tx-4', outcome: 'FUZZY_MATCHED' });

        expect(getExceptionCount()).toBe(2);
    });
});
