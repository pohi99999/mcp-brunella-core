import { getPendingTransactions, updateTransaction } from '../data/bookkeeping_db.js';
// src/agents/MatchingAgent.ts
import { BaseAgent, AgentContext, AgentResult } from './BaseAgent.js';
import { BookkeepingTransaction, NavInvoiceData, MatchedResult, TransactionStatus, BankTransactionData } from '../types/bookkeeping.d.js';
import { logError, logWarn } from '../utils/logger.js';

export class MatchingAgent extends BaseAgent {
    name = "MatchingAgent";
    description = "Matches bank transactions with pending invoices.";
    role = "The Brain";
    capabilities = ["hybrid_matching"];

    findMatch(bankTxData: BankTransactionData, pendingInvoices: NavInvoiceData[]): MatchedResult | null {
        if (!bankTxData || !bankTxData.reference || typeof bankTxData.amount !== 'number') {
            logWarn("MatchingAgent", "Invalid bank transaction data for matching:", bankTxData);
            return null;
        }

        // Level 1: Hard Match (Reference Number)
        for (const inv of pendingInvoices) {
            if (bankTxData.reference.includes(String(inv.invoiceNumber))) {
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
            const pendingInvoicesFromDB: BookkeepingTransaction[] = getPendingTransactions("NAV");
            const pendingInvoices: NavInvoiceData[] = pendingInvoicesFromDB
                .map(tx => tx.data as NavInvoiceData) // Assuming NAV transactions always have NavInvoiceData
                .filter(data => data.invoiceNumber && typeof data.amount === 'number'); // Basic validation

            const pendingBankTxs: BookkeepingTransaction[] = getPendingTransactions("BankAgent");

            for (const bankTx of pendingBankTxs) {
                if (!bankTx.data) {
                    logWarn("MatchingAgent", "Skipping bank transaction due to missing data:", bankTx.id);
                    updateTransaction(bankTx.id, { status: 'ERROR' as TransactionStatus });
                    continue;
                }
                const match = this.findMatch(bankTx.data as BankTransactionData, pendingInvoices);
                if (match) {
                    updateTransaction(bankTx.id, { status: 'COMPLETED' as TransactionStatus, matchedInvoice: match.invoice.invoiceNumber });
                } else {
                    updateTransaction(bankTx.id, { status: 'UNMATCHED' as TransactionStatus });
                }
            }

            return { success: true, message: "Matching process completed", data: null };
        } catch (error) {
            logError("MatchingAgent", "executeTask failed:", error);
            const errorMsg = error instanceof Error ? error.message : String(error);
            return { success: false, message: errorMsg, data: null };
        }
    }
}
