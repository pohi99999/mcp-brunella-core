
// test/MatchingAgent.test.ts
import { describe, it, expect } from 'vitest';
import { MatchingAgent } from '../src/agents/MatchingAgent.js';

describe('MatchingAgent', () => {
    it('should match invoice by exact reference number (Hard Match)', () => {
        const agent = new MatchingAgent();
        const bankTx = { amount: 10000, reference: 'Kifizetés INV-2026-001' };
        const pendingInvoices = [
            { id: 'inv_1', invoiceNumber: 'INV-2026-001', amount: 10000 },
            { id: 'inv_2', invoiceNumber: 'INV-2026-002', amount: 5000 }
        ];
        
        const match = agent.findMatch(bankTx, pendingInvoices);
        expect(match).not.toBeNull();
        expect(match!.invoice.id).toBe('inv_1');
        expect(match!.confidence).toBe(100);
        expect(match!.type).toBe('HARD_MATCH');
    });
});
