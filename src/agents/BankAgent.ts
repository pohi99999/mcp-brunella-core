import { saveTransaction } from '../data/bookkeeping_db.js';
import { BaseAgent, AgentContext, AgentResult } from './BaseAgent.js';
import { BankTransactionData, BookkeepingTransaction, TransactionStatus } from '../types/bookkeeping.d.js';
import { promises as fs } from 'fs';
import { logError } from '../utils/logger.js';

export class BankAgent extends BaseAgent {
    name = "BankAgent";
    description = "Parses bank export files (CSV) and extracts transactions.";
    role = "Transaction Watcher";
    capabilities = ["parse_csv"];

    parseRow(csvRow: string): BankTransactionData {
        const parts = csvRow.split(';');
        if (parts.length < 4) {
            throw new Error(`Invalid CSV row format: ${csvRow}`);
        }
        return {
            date: parts[0],
            partner: parts[1],
            amount: parseFloat(parts[2]),
            reference: parts[3]
        };
    }

    async executeTask(context: AgentContext): Promise<AgentResult> {
        try {
            const bankCsvPath = (context as any)?.payload?.bankCsvPath; // Assume bankCsvPath is provided in context

            if (!bankCsvPath) {
                return { success: false, message: "Missing bankCsvPath in context", data: null };
            }

            const csvContent = await fs.readFile(bankCsvPath, 'utf-8');

            const rows = csvContent.split('\n');
            let processedCount = 0;
            for (const row of rows) {
                if (row.trim() === '') continue;
                try {
                    const parsedTx: BankTransactionData = this.parseRow(row);
                    const txId = `bank_${parsedTx.reference}_${parsedTx.amount}`; // Generate a unique ID

                    const newTx: BookkeepingTransaction = {
                        id: txId,
                        source: this.name,
                        data: parsedTx,
                        status: 'PENDING_MATCH' as TransactionStatus
                    };
                    await saveTransaction(newTx);
                    processedCount++;
                } catch (parseError) {
                    logError("BankAgent", `Error parsing row '${row}':`, parseError);
                    // Continue to next row even if one fails
                }
            }

            return { success: true, message: `Processed ${processedCount} bank transactions`, data: null };
        } catch (error) {
            logError("BankAgent", "executeTask failed:", error);
            const errorMsg = error instanceof Error ? error.message : String(error);
            return { success: false, message: errorMsg, data: null };
        }
    }
}
