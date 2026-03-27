// src/agents/BankAgent.ts
import { BaseAgent, AgentContext, AgentResult } from './BaseAgent.js';

export class BankAgent extends BaseAgent {
    name = "BankAgent";
    description = "Parses bank export files (CSV) and extracts transactions.";
    role = "Transaction Watcher";
    capabilities = ["parse_csv"];

    parseRow(csvRow: string) {
        const parts = csvRow.split(';');
        return {
            date: parts[0],
            partner: parts[1],
            amount: parseFloat(parts[2]),
            reference: parts[3]
        };
    }

    async executeTask(context: AgentContext): Promise<AgentResult> {
        return { success: true, message: "OK", data: null };
    }
}
