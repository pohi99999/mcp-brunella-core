import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MatchingAgent } from '@packages/agents/MatchingAgent.js';
import * as db from '@packages/utils/bookkeeping_db.js';
import { AgentContext } from '@packages/agents/BaseAgent.js';
import { BookkeepingTransaction, NavInvoiceData, TransactionStatus, BankTransactionData } from '@packages/types/bookkeeping.d.js';
import * as logger from '@packages/utils/logger.js';

describe('MatchingAgent', () => {
    const mockNavTxs: BookkeepingTransaction[] = [
        { id: 'nav_001', source: 'NAV', data: { invoiceNumber: 'INV-2026-001', amount: 10000, partner: 'Kovács Kft' }, status: 'PENDING_MATCH' },
        { id: 'nav_002', source: 'NAV', data: { invoiceNumber: 'INV-2026-002', amount: 5000, partner: 'Nagy Zrt' }, status: 'PENDING_MATCH' },
    ];
    
    const mockInvoices: NavInvoiceData[] = mockNavTxs.map(tx => tx.data as NavInvoiceData);

    beforeEach(() => {
        vi.spyOn(db, 'getPendingTransactions').mockImplementation((source?: string) => {
            if (source === 'BankAgent') {
                return []; // Default to no bank txs
            }
            if (source === 'NAV') {
                return mockNavTxs;
            }
            return [];
        });
        vi.spyOn(db, 'updateTransaction').mockImplementation(() => undefined);
        vi.spyOn(logger, 'logError').mockImplementation(() => {}); // Mock logError
        vi.spyOn(logger, 'logWarn').mockImplementation(() => {}); // Mock logWarn
    });

    it('should match invoice by exact reference number (Hard Match)', () => {
        const agent = new MatchingAgent();
        const bankTxData: BankTransactionData = { date: '2026-03-27', partner: 'Kovács Kft', amount: 10000, reference: 'Kifizetés INV-2026-001' };
        
        const match = agent.findMatch(bankTxData, mockInvoices);
        expect(match).not.toBeNull();
        expect(match!.invoice.invoiceNumber).toBe('INV-2026-001');
        expect(match!.confidence).toBe(100);
        expect(match!.type).toBe('HARD_MATCH');
    });

    it('should return null if no hard match is found', () => {
        const agent = new MatchingAgent();
        const bankTxData: BankTransactionData = { date: '2026-03-27', partner: 'Valaki', amount: 9999, reference: 'NoMatch' };
        const match = agent.findMatch(bankTxData, mockInvoices);
        expect(match).toBeNull();
    });

    it('should execute matching and update transactions', async () => {
        const agent = new MatchingAgent();
        const mockBankTx: BookkeepingTransaction = {
            id: 'bank_tx_1',
            source: 'BankAgent',
            data: { date: '2026-03-27', partner: 'Kovács Kft', amount: 10000, reference: 'Kifizetés INV-2026-001' },
            status: 'PENDING_MATCH'
        };
        
        vi.mocked(db.getPendingTransactions).mockImplementation((source?: string) => {
            if (source === 'BankAgent') {
                return [mockBankTx];
            }
            if (source === 'NAV') {
                return mockNavTxs;
            }
            return [];
        });

        const mockContext: AgentContext = { payload: {} };
        const result = await agent.executeTask(mockContext);

        expect(result.success).toBe(true);
        expect(db.getPendingTransactions).toHaveBeenCalledWith('NAV');
        expect(db.getPendingTransactions).toHaveBeenCalledWith('BankAgent');
        expect(db.updateTransaction).toHaveBeenCalledWith(
            'bank_tx_1',
            { status: 'COMPLETED', matchedInvoice: 'INV-2026-001' }
        );
    });

    it('should mark transaction as UNMATCHED if no match is found', async () => {
        const agent = new MatchingAgent();
        const mockBankTx: BookkeepingTransaction = {
            id: 'bank_tx_2',
            source: 'BankAgent',
            data: { date: '2026-03-28', partner: 'Unknown Plc', amount: 12345, reference: 'Unmatched payment' },
            status: 'PENDING_MATCH'
        };
        
        vi.mocked(db.getPendingTransactions).mockImplementation((source?: string) => {
            if (source === 'BankAgent') {
                return [mockBankTx];
            }
            if (source === 'NAV') {
                return mockNavTxs;
            }
            return [];
        });

        const mockContext: AgentContext = { payload: {} };
        const result = await agent.executeTask(mockContext);

        expect(result.success).toBe(true);
        expect(db.updateTransaction).toHaveBeenCalledWith(
            'bank_tx_2',
            { status: 'UNMATCHED' }
        );
    });

    it('should handle errors from getPendingTransactions gracefully', async () => {
        const agent = new MatchingAgent();
        const mockError = new Error("DB error");
        vi.spyOn(db, 'getPendingTransactions').mockImplementation(() => { throw mockError; });

        const mockContext: AgentContext = { payload: {} };
        const result = await agent.executeTask(mockContext);

        expect(result.success).toBe(false);
        expect(result.message).toBe("DB error");
        expect(logger.logError).toHaveBeenCalledWith("MatchingAgent", "executeTask failed:", mockError);
    });

    it('should handle bank transaction with missing data gracefully', async () => {
        const agent = new MatchingAgent();
        const mockBankTx: BookkeepingTransaction = {
            id: 'bank_tx_3',
            source: 'BankAgent',
            data: null as any, // Simulate missing data
            status: 'PENDING_MATCH'
        };
        vi.spyOn(db, 'getPendingTransactions').mockImplementation((source?: string) => {
            if (source === 'BankAgent') {
                return [mockBankTx];
            }
            return [];
        });

        const mockContext: AgentContext = { payload: {} };
        const result = await agent.executeTask(mockContext);

        expect(result.success).toBe(true);
        expect(db.updateTransaction).toHaveBeenCalledWith(
            'bank_tx_3',
            { status: 'ERROR' }
        );
        expect(logger.logWarn).toHaveBeenCalledWith("MatchingAgent", "Skipping bank transaction due to missing data:", 'bank_tx_3');
    });

    it('should return a FUZZY_MATCH when partner partially matches and amounts are identical', () =>
    {
        const agent = new MatchingAgent();

        // Bank tx: no useful reference number, but partner is a substring of the invoice partner
        const bankTx = {
            date: '2026-03-27',
            partner: 'Kovács',
            amount: 10000,
            reference: 'payment-unrelated-ref',
        };

        const invoices = [
            {
                invoiceNumber: 'INV-99',
                partner: 'Kovács Kft',
                amount: 10000,
                issueDate: '2026-03-27',
            },
        ];

        const result = agent.findMatch(bankTx, invoices);

        // Should score: exact amount (60) + partial partner (15) + same-day date (25) = 100 → capped to 99
        expect(result).not.toBeNull();
        expect(result!.type).toBe('FUZZY_MATCH');
        expect(result!.confidence).toBeLessThan(100);
        expect(result!.confidence).toBeGreaterThan(50);
    });

    it('should NOT return a FUZZY_MATCH when score is below threshold', () =>
    {
        const agent = new MatchingAgent();

        // amount diff = 1, within 1% of 10000 (=100), so +20; partner mismatch = 0; no date = 0; total = 20 < 50
        const bankTx = {
            date: '2026-03-27',
            partner: 'Valaki',
            amount: 9999,
            reference: 'no-matching-invoice',
        };

        const invoices = [
            {
                invoiceNumber: 'INV-X',
                partner: 'Kovács Kft',
                amount: 10000,
                issueDate: '2026-03-27',
            },
        ];

        const result = agent.findMatch(bankTx, invoices);
        expect(result).toBeNull();
    });
});

