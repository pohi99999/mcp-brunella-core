import { IAgent, AgentResponse } from './types.js';
import type { AgentContext, AgentResult } from './BaseAgent.js';
import { logInfo, logError, logWarn, setAgentStatus } from '../utils/logger.js';
import {
  getPendingTransactions,
  updateTransaction,
  saveReconciliationEvent,
} from '../data/bookkeeping_db.js';
import type {
  BankTransactionData,
  BookkeepingTransaction,
  NavInvoiceData,
} from '../types/bookkeeping.d.js';

type MatchableInvoice = NavInvoiceData & {
  id?: string;
  issueDate?: string;
  originalTransaction?: BookkeepingTransaction;
};

interface MatchResult {
  invoice: MatchableInvoice;
  confidence: number;
  type: 'HARD_MATCH' | 'FUZZY_MATCH';
}

type BankMatchInput = BankTransactionData & { id?: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/**
 * MatchingAgent
 * Reconciles bank transactions against NAV and email invoices.
 */
export class MatchingAgent implements IAgent {
  name = 'MatchingAgent';
  role = 'Match bank transactions with invoices';
  description =
    'Uses reference-number and fuzzy matching to reconcile bank statements with NAV and email invoices.';
  capabilities = ['reconciliation', 'matching', 'bookkeeping'];

  private toResponse(result: AgentResult): AgentResponse {
    return {
      success: result.success,
      status: result.success ? 'success' : 'error',
      message: result.message,
      data: result.data,
      error: result.success ? undefined : result.message,
    };
  }

  private isBankTransactionData(data: unknown): data is BankTransactionData {
    if (!isRecord(data)) {
      return false;
    }

    return (
      typeof data.date === 'string' &&
      typeof data.partner === 'string' &&
      typeof data.amount === 'number' &&
      typeof data.reference === 'string'
    );
  }

  private isInvoiceData(data: unknown): data is NavInvoiceData & { issueDate?: string } {
    if (!isRecord(data)) {
      return false;
    }

    return (
      typeof data.invoiceNumber === 'string' &&
      typeof data.partner === 'string' &&
      typeof data.amount === 'number' &&
      (data.issueDate === undefined || typeof data.issueDate === 'string')
    );
  }

  private toBankTx(tx: BookkeepingTransaction): BankMatchInput | null {
    if (!this.isBankTransactionData(tx.data)) {
      return null;
    }

    return {
      id: tx.id,
      date: tx.data.date,
      partner: tx.data.partner,
      amount: tx.data.amount,
      reference: tx.data.reference,
    };
  }

  private toInvoice(tx: BookkeepingTransaction): MatchableInvoice | null {
    if (!this.isInvoiceData(tx.data)) {
      return null;
    }

    return {
      id: tx.id,
      invoiceNumber: tx.data.invoiceNumber,
      partner: tx.data.partner,
      amount: tx.data.amount,
      issueDate: tx.data.issueDate ?? '',
      originalTransaction: tx,
    };
  }

  /**
   * Computes a fuzzy relevance score between a bank transaction and an invoice.
   *
   * Scoring breakdown:
   *  - Exact amount match (within 1 HUF):           60 pts
   *  - Near amount match (within 1 % of invoice):   20 pts
   *  - Partner name exact match (case-insensitive): 25 pts
   *  - Partner name partial match:                  15 pts
   *  - Same-day issue date:                         25 pts
   *  - Issue date within 3 days:                    15 pts
   *
   * A score ≥ 50 is considered a FUZZY_MATCH.
   */
  private fuzzyScore(bankTx: BankMatchInput, invoice: MatchableInvoice): number {
    let score = 0;

    // ── Amount proximity ──────────────────────────────────────────────────────
    const amtDiff = Math.abs(invoice.amount - bankTx.amount);
    const amtOnePct = Math.max(invoice.amount * 0.01, 1);
    if (amtDiff < 0.01) {
      score += 60; // Exact (float tolerance)
    } else if (amtDiff <= amtOnePct) {
      score += 20; // Within 1 % — partial credit
    }

    // ── Partner name ─────────────────────────────────────────────────────────
    if (invoice.partner && bankTx.partner) {
      const invLower = invoice.partner.toLowerCase();
      const bankLower = bankTx.partner.toLowerCase();
      const refLower = (bankTx.reference ?? '').toLowerCase();

      if (invLower === bankLower) {
        score += 25;
      } else if (bankLower.includes(invLower) || invLower.includes(bankLower)) {
        score += 15;
      } else if (refLower.includes(invLower)) {
        score += 10;
      }
    }

    // ── Date proximity ────────────────────────────────────────────────────────
    const issueDate = invoice.issueDate;
    if (issueDate && bankTx.date) {
      try {
        const d1 = new Date(issueDate);
        const d2 = new Date(bankTx.date);
        if (!isNaN(d1.getTime()) && !isNaN(d2.getTime())) {
          const diffDays = Math.abs(d1.getTime() - d2.getTime()) / 86_400_000;
          if (diffDays < 1) {
            score += 25;
          } else if (diffDays <= 3) {
            score += 15;
          }
        }
      } catch {
        // ignore unparseable dates
      }
    }

    return score;
  }

  /**
   * Finds the best matching invoice for a bank transaction.
   *
   * Strategy:
   *  1. Hard match — invoice number appears in the payment reference AND
   *     amounts match exactly. Returns confidence 100, type HARD_MATCH.
   *  2. Fuzzy match — highest-scoring invoice above the FUZZY_THRESHOLD (50).
   *     Returns confidence = score (capped at 99), type FUZZY_MATCH.
   *  3. Returns null if no candidate clears the threshold.
   */
  findMatch(bankTx: BankMatchInput, pendingInvoices: MatchableInvoice[]): MatchResult | null {
    const FUZZY_THRESHOLD = 50;
    const reference = bankTx.reference?.trim() ?? '';

    // ── 1. Hard match ─────────────────────────────────────────────────────────
    for (const invoice of pendingInvoices) {
      if (reference.includes(invoice.invoiceNumber) && bankTx.amount === invoice.amount) {
        return { invoice, confidence: 100, type: 'HARD_MATCH' };
      }
    }

    // ── 2. Fuzzy match ────────────────────────────────────────────────────────
    let best: { invoice: MatchableInvoice; score: number } | null = null;

    for (const invoice of pendingInvoices) {
      const score = this.fuzzyScore(bankTx, invoice);
      if (score >= FUZZY_THRESHOLD && (!best || score > best.score)) {
        best = { invoice, score };
      }
    }

    if (best) {
      return {
        invoice: best.invoice,
        confidence: Math.min(best.score, 99),
        type: 'FUZZY_MATCH',
      };
    }

    return null;
  }

  async executeTask(context: AgentContext): Promise<AgentResult> {
    try {
      const pendingBank = getPendingTransactions('BankAgent');
      const pendingNav = getPendingTransactions('NAV');
      const pendingEmail = getPendingTransactions('EmailAgent');
      const invoices = [...pendingNav, ...pendingEmail]
        .map((tx) => this.toInvoice(tx))
        .filter((invoice): invoice is MatchableInvoice => invoice !== null);

      logInfo(
        this.name,
        `Comparing ${pendingBank.length} bank transactions against ${invoices.length} invoices...`,
      );

      // Unique run identifier used for the audit trail
      const runId = `run_${Date.now()}`;

      let matched = 0;
      let manual = 0;

      for (const tx of pendingBank) {
        const bankTx = this.toBankTx(tx);
        if (!bankTx) {
          logWarn(this.name, 'Skipping bank transaction due to missing data:', tx.id);
          updateTransaction(tx.id, { status: 'ERROR' });
          this.persistEvent(runId, tx.id, 'ERROR', null);
          continue;
        }

        const match = this.findMatch(bankTx, invoices);
        if (match) {
          const newStatus = match.type === 'HARD_MATCH' ? 'COMPLETED' : 'PARTIALLY_MATCHED';
          updateTransaction(tx.id, {
            status: newStatus,
            matchedInvoice: match.invoice.invoiceNumber,
          });

          if (
            match.invoice.originalTransaction &&
            match.invoice.originalTransaction.id !== tx.id
          ) {
            updateTransaction(match.invoice.originalTransaction.id, {
              status: newStatus,
              matchedInvoice: tx.id,
            });
          }

          this.persistEvent(
            runId,
            tx.id,
            match.type === 'HARD_MATCH' ? 'MATCHED' : 'FUZZY_MATCHED',
            match,
          );
          matched++;
        } else {
          updateTransaction(tx.id, { status: 'UNMATCHED' });
          this.persistEvent(runId, tx.id, 'UNMATCHED', null);
          manual++;
        }
      }

      return {
        success: true,
        status: 'success',
        message: `Processed ${pendingBank.length} bank transactions`,
        data: { total: pendingBank.length, matched, manual, runId },
      };
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      logError(this.name, 'executeTask failed:', err);
      return {
        success: false,
        status: 'error',
        message: err.message,
        data: { total: 0, matched: 0, manual: 0 },
      };
    }
  }

  /**
   * Silently persists a reconciliation event. Failures are caught and logged
   * so a DB hiccup never interrupts the reconciliation run.
   */
  private persistEvent(
    runId: string,
    txId: string,
    outcome: 'MATCHED' | 'FUZZY_MATCHED' | 'UNMATCHED' | 'ERROR',
    match: MatchResult | null,
  ): void {
    try {
      saveReconciliationEvent({
        runId,
        txId,
        invoiceId: match?.invoice.invoiceNumber,
        outcome,
        matchType: match?.type,
        confidence: match?.confidence,
      });
    } catch (err) {
      logError(this.name, `Failed to persist reconciliation event for ${txId}:`, err);
    }
  }

  async execute(task: string, _context?: Record<string, unknown>): Promise<AgentResponse> {
    setAgentStatus(this.name, 'working', task.slice(0, 50));
    try {
      const result = await this.executeTask({ task });
      return this.toResponse(result);
    } finally {
      setAgentStatus(this.name, 'idle');
    }
  }
}
