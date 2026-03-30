// src/types/bookkeeping.d.ts

export type TransactionStatus = 'PENDING_MATCH' | 'PARTIALLY_MATCHED' | 'COMPLETED' | 'MANUAL_REVIEW' | 'UNMATCHED' | 'ERROR';

export interface BankTransactionData {
    date: string;
    partner: string;
    amount: number;
    reference: string;
}

export interface NavInvoiceData {
    invoiceNumber: string;
    amount: number;
    partner: string;
    issueDate?: string;
    // Add other NAV specific fields as needed
}

export interface BookkeepingTransaction {
    id: string;
    source: string; // e.g., 'BankAgent', 'NAV', 'EmailAgent'
    data: BankTransactionData | NavInvoiceData; // Can be a bank transaction or an NAV invoice
    status: TransactionStatus;
    matchedInvoice?: string; // ID of the matched invoice if applicable
}

export interface MatchedResult {
    invoice: NavInvoiceData; // Should be the full invoice object, not just ID
    confidence: number;
    type: 'HARD_MATCH' | 'FUZZY_MATCH';
}

export type CashEntryType = 'KP_IN' | 'KP_OUT';

export type CashEntrySource = 'manual' | 'email' | 'import';

export interface CashEntryInput {
    date: string;
    type: CashEntryType;
    amount: number;
    description: string;
    invoiceNumber?: string;
    source?: CashEntrySource;
    syncedSheets?: boolean;
}

export interface CashEntry {
    id: number;
    date: string;
    type: CashEntryType;
    amount: number;
    description: string;
    invoiceNumber?: string;
    source: CashEntrySource;
    syncedSheets: boolean;
    createdAt: string;
    updatedAt: string;
}

export interface CashEntrySummary {
    total: number;
    income: number;
    expense: number;
    balance: number;
    syncedSheets: number;
    pendingSheets: number;
    byType: Record<CashEntryType, number>;
}

export type ReconciliationOutcome = 'MATCHED' | 'FUZZY_MATCHED' | 'UNMATCHED' | 'ERROR' | 'PARTIAL';

export interface ReconciliationEvent {
    id: number;
    /** Unique identifier for a single MatchingAgent run (e.g. UUID or timestamp-based). */
    runId: string;
    /** ID of the bank transaction being reconciled. */
    txId: string;
    /** Invoice ID or invoice number that was matched (if any). */
    invoiceId?: string;
    outcome: ReconciliationOutcome;
    matchType?: 'HARD_MATCH' | 'FUZZY_MATCH';
    /** Confidence score 0-100 assigned by the matcher. */
    confidence?: number;
    /** Free-form notes for manual review context. */
    notes?: string;
    createdAt: string;
}

export interface ReconciliationEventInput {
    runId: string;
    txId: string;
    invoiceId?: string;
    outcome: ReconciliationOutcome;
    matchType?: 'HARD_MATCH' | 'FUZZY_MATCH';
    confidence?: number;
    notes?: string;
}
