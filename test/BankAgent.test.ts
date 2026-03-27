// test/BankAgent.test.ts
import { describe, it, expect } from 'vitest';
import { BankAgent } from '../src/agents/BankAgent.js';

describe('BankAgent', () => {
    it('should parse a simple bank CSV row', async () => {
        const agent = new BankAgent();
        const csvRow = '2026-03-27;Kovács Kft;10000;INV-2026-001';
        const parsed = agent.parseRow(csvRow);
        
        expect(parsed.amount).toBe(10000);
        expect(parsed.partner).toBe('Kovács Kft');
        expect(parsed.reference).toBe('INV-2026-001');
    });
});
