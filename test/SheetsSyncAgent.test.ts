// test/SheetsSyncAgent.test.ts
import { describe, it, expect } from 'vitest';
import { SheetsSyncAgent } from '../src/agents/SheetsSyncAgent.js';

describe('SheetsSyncAgent', () => {
    it('should format a transaction into a Sheets row', () => {
        const agent = new SheetsSyncAgent();
        const tx = {
            id: 'tx_001',
            status: 'COMPLETED',
            navData: { invoiceNumber: 'INV-1', amount: 1000 },
            bankData: { date: '2026-03-27' }
        };
        const row = agent.formatRow(tx);
        
        expect(row[0]).toBe('INV-1'); // Invoice Number
        expect(row[1]).toBe(1000);    // Amount
        expect(row[2]).toBe('2026-03-27'); // Bank Date
        expect(row[3]).toBe('COMPLETED'); // Status
    });
});
