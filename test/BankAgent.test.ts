// test/BankAgent.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BankAgent } from '../src/agents/BankAgent.js';
import * as db from '../src/data/bookkeeping_db.js';
import { AgentContext } from '../src/agents/BaseAgent.js';

describe('BankAgent', () => {
    beforeEach(() => {
        vi.spyOn(db, 'saveTransaction').mockResolvedValue(undefined);
    });

    it('should parse a simple bank CSV row', () => {
        const agent = new BankAgent();
        const csvRow = '2026-03-27;Kovács Kft;10000;INV-2026-001';
        const parsed = agent.parseRow(csvRow);
        
        expect(parsed.amount).toBe(10000);
        expect(parsed.partner).toBe('Kovács Kft');
        expect(parsed.reference).toBe('INV-2026-001');
        expect(parsed.date).toBe('2026-03-27');
    });

    it('should execute and save bank transactions to the database', async () => {
        const agent = new BankAgent();
        const mockContext: AgentContext = { payload: { bankCsvPath: 'mock/path/bank.csv' } };
        const result = await agent.executeTask(mockContext);

        expect(result.success).toBe(true);
        expect(db.saveTransaction).toHaveBeenCalledTimes(2); // Based on mock CSV content
        expect(db.saveTransaction).toHaveBeenCalledWith(expect.objectContaining({
            source: 'BankAgent',
            status: 'PENDING_MATCH',
            data: { date: '2026-03-27', partner: 'Kovács Kft', amount: 10000, reference: 'INV-2026-001' }
        }));
        expect(db.saveTransaction).toHaveBeenCalledWith(expect.objectContaining({
            source: 'BankAgent',
            status: 'PENDING_MATCH',
            data: { date: '2026-03-27', partner: 'Nagy Zrt', amount: 5000, reference: 'INV-2026-002' }
        }));
    });

    it('should return an error if bankCsvPath is missing', async () => {
        const agent = new BankAgent();
        const mockContext: AgentContext = { payload: {} };
        const result = await agent.executeTask(mockContext);

        expect(result.success).toBe(false);
        expect(result.error).toBe("Missing bankCsvPath in context");
        expect(db.saveTransaction).not.toHaveBeenCalled();
    });
});
