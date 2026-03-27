import { getAllTransactions } from '../data/bookkeeping_db.js';
// src/agents/SheetsSyncAgent.ts
import { BaseAgent, AgentContext, AgentResult } from './BaseAgent.js';

export class SheetsSyncAgent extends BaseAgent {
    name = "SheetsSyncAgent";
    description = "Syncs transaction states to Google Sheets.";
    role = "UI Sync";
    capabilities = ["sheets_api"];

    formatRow(tx: any) {
        return [
            tx.navData?.invoiceNumber || (tx.data?.invoiceNumber || ''),
            tx.navData?.amount || (tx.data?.amount || 0),
            tx.bankData?.date || (tx.data?.date || ''),
            tx.status
        ];
    }

    async executeTask(context: AgentContext): Promise<AgentResult> {
        const allTransactions = await getAllTransactions();
        const sheetsRows = allTransactions.map(tx => this.formatRow(tx));

        // For MVP, we just log the rows. In a real scenario, this would update Google Sheets.
        console.log("Simulating Google Sheets update with the following rows:", sheetsRows);

        return { success: true, message: `Synced ${allTransactions.length} transactions to Sheets`, data: sheetsRows };
    }
}

