import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BankAgent } from '../src/agents/BankAgent.js';
import * as db from '../src/data/bookkeeping_db.js';
import { AgentContext } from '../src/agents/BaseAgent.js';
import { promises as fs } from 'fs';
import * as logger from '../src/utils/logger.js';

vi.mock('fs', () => ({
    promises: {
        readFile: vi.fn(),
    },
}));

describe('BankAgent', () => {
    beforeEach(() => {
        vi.spyOn(db, 'saveTransaction').mockResolvedValue(undefined);
        vi.mocked(fs.readFile).mockClear();
        vi.spyOn(logger, 'logError').mockImplementation(() => {}); // Mock logError
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
        const mockCsvContent = "2026-03-27;Kovács Kft;10000;INV-2026-001\n2026-03-27;Nagy Zrt;5000;INV-2026-002";
        vi.mocked(fs.readFile).mockResolvedValue(mockCsvContent);

        const agent = new BankAgent();
        const mockContext: AgentContext = { payload: { bankCsvPath: 'mock/path/bank.csv' } };
        const result = await agent.executeTask(mockContext);

        expect(result.success).toBe(true);
        expect(fs.readFile).toHaveBeenCalledWith('mock/path/bank.csv', 'utf-8');
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
        expect(result.message).toBe("Missing bankCsvPath in context");
        expect(db.saveTransaction).not.toHaveBeenCalled();
    });

    it('should handle file reading errors gracefully', async () => {
        const agent = new BankAgent();
        const mockError = new Error("File not found");
        vi.mocked(fs.readFile).mockRejectedValue(mockError);

        const mockContext: AgentContext = { payload: { bankCsvPath: 'mock/path/nonexistent.csv' } };
        const result = await agent.executeTask(mockContext);

        expect(result.success).toBe(false);
        expect(result.message).toBe("File not found");
        expect(logger.logError).toHaveBeenCalledWith("BankAgent", "executeTask failed:", mockError);
        expect(db.saveTransaction).not.toHaveBeenCalled();
    });

    it('should handle CSV parsing errors gracefully and continue processing', async () => {
        const agent = new BankAgent();
        const malformedCsvContent = "2026-03-27;Kovács Kft;10000;INV-2026-001\nMALFORMED_ROW\n2026-03-27;Nagy Zrt;5000;INV-2026-002";
        vi.mocked(fs.readFile).mockResolvedValue(malformedCsvContent);

        const mockContext: AgentContext = { payload: { bankCsvPath: 'mock/path/malformed.csv' } };
        const result = await agent.executeTask(mockContext);

        expect(result.success).toBe(true);
        expect(db.saveTransaction).toHaveBeenCalledTimes(2); // Still processes valid rows
        expect(logger.logError).toHaveBeenCalledWith(
            "BankAgent",
            `Error parsing row 'MALFORMED_ROW':`,
            expect.any(Error)
        );
        expect(result.message).toBe("Processed 2 bank transactions");
    });
});
