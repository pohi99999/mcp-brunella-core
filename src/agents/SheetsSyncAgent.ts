// src/agents/SheetsSyncAgent.ts
import { BaseAgent, AgentContext, AgentResult } from './BaseAgent.js';

export class SheetsSyncAgent extends BaseAgent {
    name = "SheetsSyncAgent";
    description = "Syncs transaction states to Google Sheets.";
    role = "UI Sync";
    capabilities = ["sheets_api"];

    formatRow(tx: any) {
        return [
            tx.navData?.invoiceNumber || '',
            tx.navData?.amount || 0,
            tx.bankData?.date || '',
            tx.status
        ];
    }

    async executeTask(context: AgentContext): Promise<AgentResult> {
        return { success: true, message: "OK", data: null };
    }
}
