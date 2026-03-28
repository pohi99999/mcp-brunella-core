import { IAgent, AgentResponse } from './types.js';
import type { AgentContext, AgentResult } from './BaseAgent.js';
import { logInfo, logError, logWarn, setAgentStatus } from '../utils/logger.js';
import { getPendingTransactions, updateTransaction } from '../data/bookkeeping_db.js';
import type { BankTransactionData, BookkeepingTransaction, NavInvoiceData } from '../types/bookkeeping.d.js';

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
  description = 'Uses reference-number matching to reconcile bank statements with NAV and email invoices.';
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

  findMatch(bankTx: BankMatchInput, pendingInvoices: MatchableInvoice[]): MatchResult | null {
    const reference = bankTx.reference?.trim();
    if (!reference) {
      return null;
    }

    for (const invoice of pendingInvoices) {
      if (reference.includes(invoice.invoiceNumber) && bankTx.amount === invoice.amount) {
        return {
          invoice,
          confidence: 100,
          type: 'HARD_MATCH',
        };
      }
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

      logInfo(this.name, `Comparing ${pendingBank.length} bank transactions against ${invoices.length} invoices...`);

      let matched = 0;
      let manual = 0;

      for (const tx of pendingBank) {
        const bankTx = this.toBankTx(tx);
        if (!bankTx) {
          logWarn(this.name, 'Skipping bank transaction due to missing data:', tx.id);
          updateTransaction(tx.id, { status: 'ERROR' });
          continue;
        }

        const match = this.findMatch(bankTx, invoices);
        if (match) {
          updateTransaction(tx.id, {
            status: 'COMPLETED',
            matchedInvoice: match.invoice.invoiceNumber,
          });

          if (match.invoice.originalTransaction && match.invoice.originalTransaction.id !== tx.id) {
            updateTransaction(match.invoice.originalTransaction.id, {
              status: 'COMPLETED',
              matchedInvoice: tx.id,
            });
          }
          matched++;
        } else {
          updateTransaction(tx.id, { status: 'UNMATCHED' });
          manual++;
        }
      }

      return {
        success: true,
        status: 'success',
        message: `Processed ${pendingBank.length} bank transactions`,
        data: { total: pendingBank.length, matched, manual },
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
