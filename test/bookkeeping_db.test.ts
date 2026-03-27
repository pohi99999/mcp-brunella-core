// test/bookkeeping_db.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { initDB, getTransaction, saveTransaction } from '../src/data/bookkeeping_db.js';

describe('Bookkeeping Database', () => {
    beforeEach(() => {
        initDB(':memory:'); // Use in-memory SQLite for testing
    });

    it('should save and retrieve a transaction event', () => {
        const mockTx = {
            id: 'tx_001',
            source: 'NAV',
            data: { invoiceNumber: 'INV-2026-001', grossAmount: 10000 },
            status: 'PENDING_MATCH'
        };
        saveTransaction(mockTx);
        const retrieved = getTransaction('tx_001');
        expect(retrieved).toEqual(mockTx);
    });
});
