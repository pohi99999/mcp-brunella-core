import { differenceInDays, parseISO } from 'date-fns';
import { logDebug } from '@packages/utils/logger.js';
import { ensureError } from '@packages/utils/ensureError.js';

export interface MatchInvoice {
  invoiceNumber: string;
  partner: string;
  amount: number;
  issueDate: string;
  originalTransaction?: unknown;
}

export interface MatchBankTx {
  id: string;
  partner: string;
  amount: number;
  date: string;
  reference?: string;
}

export interface FuzzyMatchResult {
  confidence: number;
  matchType: 'EXACT' | 'FUZZY' | 'NONE';
  invoice?: MatchInvoice;
}

/**
 * findFuzzyMatch
 * Heuristic scoring to find the best invoice for a bank transaction.
 */
export function findFuzzyMatch(tx: MatchBankTx, invoices: MatchInvoice[]): FuzzyMatchResult {
  let bestMatch: MatchInvoice | undefined;
  let highestScore = 0;

  for (const inv of invoices) {
    let score = 0;

    // 1. Amount Match (Critical: 60 points)
    // We allow a small epsilon for rounding or currency conversion diffs if needed, 
    // but usually bank/NAV match exactly.
    if (Math.abs(tx.amount) === Math.abs(inv.amount)) {
      score += 60;
    }

    // 2. Date Proximity (30 points)
    try {
      const txDate = parseISO(tx.date);
      const invDate = parseISO(inv.issueDate);
      const diff = Math.abs(differenceInDays(txDate, invDate));
      
      if (diff === 0) score += 30;
      else if (diff <= 3) score += 20;
      else if (diff <= 7) score += 10;
    } catch (error: unknown) {
      const err = ensureError(error);
      logDebug('Matcher', `Ignoring date parsing error in scoring: ${err.message}`);
    }

    // 3. Reference/InvoiceNumber Match (20 points)
    if (tx.reference && tx.reference.includes(inv.invoiceNumber)) {
      score += 20;
    }

    // 4. Partner Match (15 points)
    if (tx.partner && inv.partner && 
       (tx.partner.toLowerCase().includes(inv.partner.toLowerCase()) || 
        inv.partner.toLowerCase().includes(tx.partner.toLowerCase()))) {
      score += 15;
    }

    if (score > highestScore) {
      highestScore = score;
      bestMatch = inv;
    }
  }

  // Thresholds
  if (highestScore >= 100) return { confidence: 100, matchType: 'EXACT', invoice: bestMatch };
  if (highestScore >= 80) return { confidence: highestScore, matchType: 'FUZZY', invoice: bestMatch };
  
  return { confidence: highestScore, matchType: 'NONE' };
}

