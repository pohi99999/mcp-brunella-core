import { IAgent, AgentResponse } from './types.js';
import { logInfo, logError, setAgentStatus } from '../utils/logger.js';
import { getPendingTransactions, updateTransaction } from '../data/bookkeeping_db.js';
import { findFuzzyMatch } from './matcher.js';

/**
 * MatchingAgent
 * - Queries the DB for bank transactions and invoices
 * - Uses the fuzzy matcher to suggest pairings
 * - Updates transaction status in DB
 */
export class MatchingAgent implements IAgent {
  name = 'MatchingAgent';
  role = 'Match bank transactions with multi-source invoices';
  description = 'Uses heuristic scoring to reconcile bank statements with NAV and Email invoices.';
  capabilities = ['reconciliation', 'fuzzy-matching', 'bookkeeping'];

  async execute(task: string): Promise<AgentResponse> {
    setAgentStatus(this.name, 'working', task.slice(0, 50));
    try {
      // 1. Fetch data from DB
      const pendingBank = getPendingTransactions('bank_tx');
      const pendingNav = getPendingTransactions('nav_invoice');
      const pendingEmail = getPendingTransactions('email_invoice');
      
      const invoices = [...pendingNav, ...pendingEmail].map(inv => ({
        invoiceNumber: (inv.data as any).invoiceNumber,
        partner: (inv.data as any).partner,
        amount: Number((inv.data as any).amount),
        issueDate: (inv.data as any).issueDate,
        originalTransaction: inv
      }));

      logInfo(this.name, `Comparing ${pendingBank.length} bank transactions against ${invoices.length} potential invoices...`);

      let matched = 0;
      let manual = 0;

      for (const tx of pendingBank) {
        // Standardize bank transaction for matcher
        const bTx = {
          id: tx.id,
          amount: Number((tx.data as any).amount),
          date: (tx.data as any).date,
          partner: (tx.data as any).partner,
          reference: (tx.data as any).reference
        };

        const result = findFuzzyMatch(bTx, invoices);
        logInfo(this.name, `Tx ${bTx.id} (${bTx.amount}) result: ${result.matchType} (Score: ${result.confidence})`);
        if (result.matchType === 'EXACT' || result.matchType === 'FUZZY') {
          // Update bank transaction as COMPLETED
          updateTransaction(tx.id, { 
            status: 'COMPLETED', 
            matchedInvoice: result.invoice!.invoiceNumber 
          });
          
          // Update the specific invoice as COMPLETED if it exists as a separate transaction
          if (result.invoice?.originalTransaction?.id) {
             updateTransaction(result.invoice.originalTransaction.id, { 
               status: 'COMPLETED',
               matchedInvoice: tx.id // Cross-reference back to bank transaction
             });
          }
          matched++;
        } else {
          updateTransaction(tx.id, { status: 'MANUAL_REVIEW' });
          manual++;
        }
      }

      return { 
        status: 'success', 
        data: { total: pendingBank.length, matched, manual } 
      };

    } catch (e: unknown) {
      const error = e instanceof Error ? e.message : String(e);
      logError(this.name, error);
      return { status: 'error', error };
    } finally {
      setAgentStatus(this.name, 'idle');
    }
  }
}
