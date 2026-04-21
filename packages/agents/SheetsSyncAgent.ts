import { getAllTransactions } from '@packages/utils/bookkeeping_db.js';
// src/agents/SheetsSyncAgent.ts
import { BaseAgent, AgentContext, AgentResult } from './BaseAgent.js';
import { BookkeepingTransaction, TransactionStatus, NavInvoiceData, BankTransactionData } from '@packages/types/bookkeeping.d.js';
import { logError } from '@packages/utils/logger.js';

function isRecord(data: unknown): data is Record<string, unknown> {
    return typeof data === 'object' && data !== null;
}

function isNavInvoiceData(data: unknown): data is NavInvoiceData {
    return isRecord(data) && typeof data.invoiceNumber === 'string';
}

function isBankTransactionData(data: unknown): data is BankTransactionData {
    return isRecord(data) && typeof data.date === 'string';
}


export class SheetsSyncAgent extends BaseAgent {
    name = "SheetsSyncAgent";
    description = "Syncs transaction states to Google Sheets.";
    role = "UI Sync";
    capabilities = ["sheets_api"];

    formatRow(tx: BookkeepingTransaction): (string | number)[] {
        let invoiceNumber = '';
        let amount = 0;
        let bankDate = '';

        const data = tx.data;
        if (isNavInvoiceData(data)) {
            invoiceNumber = data.invoiceNumber;
            amount = data.amount;
        } else if (isBankTransactionData(data)) {
            bankDate = data.date;
            amount = data.amount;
        }

        return [
            invoiceNumber,
            amount,
            bankDate,
            tx.status
        ];
    }

    async executeTask(context: AgentContext): Promise<AgentResult> {
        try {
            const allTransactions: BookkeepingTransaction[] = getAllTransactions();
            const sheetsRows = allTransactions.map(tx => this.formatRow(tx));

            // For MVP, we just log the rows. In a real scenario, this would update Google Sheets.
            // Keep output consistent by using logInfo from logger.js.

            return { success: true, message: `Synced ${allTransactions.length} transactions to Sheets`, data: sheetsRows };
        } catch (error) {
            logError("SheetsSyncAgent", "executeTask failed:", error);
            const errorMsg = error instanceof Error ? error.message : String(error);
            return { success: false, message: errorMsg, data: null };
        }
    }
}

