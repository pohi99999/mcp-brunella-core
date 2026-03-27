
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
        return { success: true, message: "OK", data: null };
    }
}
