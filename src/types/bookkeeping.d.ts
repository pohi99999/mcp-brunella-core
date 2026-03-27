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
    // Add other NAV specific fields as needed
}

export interface BookkeepingTransaction {
    id: string;
    source: string; // e.g., 'BankAgent', 'NavAgent', 'EmailAgent'
    data: BankTransactionData | NavInvoiceData; // Can be a bank transaction or an NAV invoice
    status: TransactionStatus;
    matchedInvoice?: string; // ID of the matched invoice if applicable
}

export interface MatchedResult {
    invoice: NavInvoiceData; // Should be the full invoice object, not just ID
    confidence: number;
    type: 'HARD_MATCH' | 'FUZZY_MATCH';
}
