import { getPendingTransactions, updateTransaction } from '../data/bookkeeping_db.js';
// src/agents/MatchingAgent.ts
import { BaseAgent, AgentContext, AgentResult } from './BaseAgent.js';
import { BookkeepingTransaction, NavInvoiceData, MatchedResult, TransactionStatus, BankTransactionData } from '../types/bookkeeping.d.js';

export class MatchingAgent extends BaseAgent {
    name = "MatchingAgent";
    description = "Matches bank transactions with pending invoices.";
    role = "The Brain";
    capabilities = ["hybrid_matching"];

    findMatch(bankTxData: BankTransactionData, pendingInvoices: NavInvoiceData[]): MatchedResult | null {
        if (!bankTxData || !bankTxData.reference || typeof bankTxData.amount !== 'number') {
            console.warn("Invalid bank transaction data for matching:", bankTxData);
            return null;
        }

        // Level 1: Hard Match (Reference Number)
        for (const inv of pendingInvoices) {
            if (bankTxData.reference.includes(inv.invoiceNumber)) {
                // Verify amount
                if (bankTxData.amount === inv.amount) {
                    return {
                        invoice: inv,
                        confidence: 100,
                        type: 'HARD_MATCH'
                    };
                }
            }
        }
        return null;
    }

    async executeTask(context: AgentContext): Promise<AgentResult> {
        try {
            // For MVP, assume invoices are loaded from somewhere (e.g., NAV/PDF agents)
            // For now, let's mock some invoices
            const pendingInvoices: NavInvoiceData[] = [
                { invoiceNumber: 'INV-2026-001', amount: 10000, partner: 'Kovács Kft' },
                { invoiceNumber: 'INV-2026-002', amount: 5000, partner: 'Nagy Zrt' }
            ];

            const pendingBankTxs: BookkeepingTransaction[] = await getPendingTransactions("BankAgent");

            for (const bankTx of pendingBankTxs) {
                if (!bankTx.data) {
                    console.warn("Skipping bank transaction due to missing data:", bankTx.id);
                    await updateTransaction(bankTx.id, { status: 'ERROR' as TransactionStatus });
                    continue;
                }
                const match = this.findMatch(bankTx.data as BankTransactionData, pendingInvoices);
                if (match) {
                    await updateTransaction(bankTx.id, { status: 'COMPLETED' as TransactionStatus, matchedInvoice: match.invoice.invoiceNumber });
                } else {
                    await updateTransaction(bankTx.id, { status: 'UNMATCHED' as TransactionStatus });
                }
            }

            return { success: true, message: "Matching process completed", data: null };
        } catch (error) {
            console.error("MatchingAgent executeTask failed:", error);
            return { success: false, error: error instanceof Error ? error.message : String(error) };
        }
    }
}
