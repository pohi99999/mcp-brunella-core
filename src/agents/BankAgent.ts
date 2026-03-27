// src/agents/BankAgent.ts
import { saveTransaction } from '../data/bookkeeping_db.js';
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
        const { bankCsvPath } = context.payload; // Assume bankCsvPath is provided in context

        if (!bankCsvPath) {
            return { success: false, error: "Missing bankCsvPath in context" };
        }

        // In a real scenario, you would read the file content here
        // For MVP, assume content is directly passed or mocked
        const csvContent = "2026-03-27;Kovács Kft;10000;INV-2026-001\n2026-03-27;Nagy Zrt;5000;INV-2026-002"; // Mock content

        const rows = csvContent.split('\n');
        for (const row of rows) {
            if (row.trim() === '') continue;
            const parsedTx = this.parseRow(row);
            const txId = `bank_${parsedTx.reference}_${parsedTx.amount}`; // Generate a unique ID

            await saveTransaction({
                id: txId,
                source: this.name,
                data: parsedTx,
                status: 'PENDING_MATCH'
            });
        }

        return { success: true, message: `Processed ${rows.length} bank transactions`, data: null };
    }
}
