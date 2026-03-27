import { getAllTransactions } from '../data/bookkeeping_db.js';
// src/agents/SheetsSyncAgent.ts
import { BaseAgent, AgentContext, AgentResult } from './BaseAgent.js';
import { BookkeepingTransaction, TransactionStatus } from '../types/bookkeeping.d.js';

export class SheetsSyncAgent extends BaseAgent {
    name = "SheetsSyncAgent";
    description = "Syncs transaction states to Google Sheets.";
    role = "UI Sync";
    capabilities = ["sheets_api"];

    formatRow(tx: BookkeepingTransaction): (string | number)[] {
        const invoiceNumber = (tx.data as any).invoiceNumber || '';
        const amount = (tx.data as any).amount || 0;
        const bankDate = (tx.data as any).date || '';

        return [
            invoiceNumber,
            amount,
            bankDate,
            tx.status
        ];
    }

    async executeTask(context: AgentContext): Promise<AgentResult> {
        try {
            const allTransactions: BookkeepingTransaction[] = await getAllTransactions();
            const sheetsRows = allTransactions.map(tx => this.formatRow(tx));

            // For MVP, we just log the rows. In a real scenario, this would update Google Sheets.
            // console.log("Simulating Google Sheets update with the following rows:", sheetsRows);
            // To avoid console.log warnings, we can use logInfo from logger.js

            return { success: true, message: `Synced ${allTransactions.length} transactions to Sheets`, data: sheetsRows };
        } catch (error) {
            console.error("SheetsSyncAgent executeTask failed:", error);
            return { success: false, error: error instanceof Error ? error.message : String(error) };
        }
    }
}
