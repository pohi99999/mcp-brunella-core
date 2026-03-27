import { getPendingTransactions, updateTransaction } from '../data/bookkeeping_db.js';
// src/agents/MatchingAgent.ts
import { BaseAgent, AgentContext, AgentResult } from './BaseAgent.js';

export class MatchingAgent extends BaseAgent {
    name = "MatchingAgent";
    description = "Matches bank transactions with pending invoices.";
    role = "The Brain";
    capabilities = ["hybrid_matching"];

    findMatch(bankTx: any, pendingInvoices: any[]) {
        // Level 1: Hard Match (Reference Number)
        for (const inv of pendingInvoices) {
            if (bankTx.reference.includes(inv.invoiceNumber)) {
                // Verify amount
                if (bankTx.amount === inv.amount) {
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
        // For MVP, assume invoices are loaded from somewhere (e.g., NAV/PDF agents)
        // For now, let's mock some invoices
        const pendingInvoices = [
            { id: 'nav_001', invoiceNumber: 'INV-2026-001', amount: 10000, partner: 'Kovács Kft', status: 'PENDING_MATCH' },
            { id: 'nav_002', invoiceNumber: 'INV-2026-002', amount: 5000, partner: 'Nagy Zrt', status: 'PENDING_MATCH' }
        ];

        const pendingBankTxs = await getPendingTransactions("BankAgent"); // Assuming source filter for BankAgent

        for (const bankTx of pendingBankTxs) {
            const match = this.findMatch(bankTx.data, pendingInvoices);
            if (match) {
                // Update bank transaction status
                await updateTransaction(bankTx.id, { status: 'COMPLETED', matchedInvoice: match.invoice.id });
                // In a real system, you would also update the invoice status
            } else {
                await updateTransaction(bankTx.id, { status: 'UNMATCHED' });
            }
        }

        return { success: true, message: "Matching process completed", data: null };
    }
}

