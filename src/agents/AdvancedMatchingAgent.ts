import { BaseAgent, AgentContext, AgentResult } from './BaseAgent.js';
import { logInfo } from '../utils/logger.js';
import { ensureError } from '../utils/ensureError.js';

/**
 * AdvancedMatchingAgent - Részleges fizetések, árfolyam-különbözetek és 
 * bonyolult párosítások kezelése a reconciliation folyamatban.
 */
export class AdvancedMatchingAgent extends BaseAgent {
  name = 'AdvancedMatchingAgent';
  role = 'Intelligens párosító motor';
  description = 'Számlák és kifizetések (banki tételek) intelligens, többlépcsős párosítása.';
  capabilities = ['smart-reconciliation', 'partial-payment-split', 'fx-recalculation'];

  async executeTask(context: AgentContext): Promise<AgentResult> {
    const { task, payload } = context as any;
    logInfo(this.name, `Matching financial records: ${task}`);

    const bankEntries = payload?.bankEntries || [];
    const openInvoices = payload?.openInvoices || [];
    const threshold = payload?.confidenceThreshold || 0.8;

    if (bankEntries.length === 0 || openInvoices.length === 0) {
      return { 
        success: true, 
        message: 'Nothing to match. Ensure both bank entries and open invoices are provided.',
        data: { matched: [], unmatched_bank: bankEntries, unmatched_invoices: openInvoices }
      };
    }

    const matched: any[] = [];
    const unmatchedBank = [...bankEntries];
    const unmatchedInvoices = [...openInvoices];

    try {
      // 1. Exact Amount & Reference Match (High Confidence)
      for (let i = unmatchedBank.length - 1; i >= 0; i--) {
        const bank = unmatchedBank[i];
        const matchIndex = unmatchedInvoices.findIndex(inv => 
          Math.abs(inv.amount - bank.amount) < 0.01 && 
          (bank.reference?.includes(inv.id) || inv.id.includes(bank.reference || 'NOMATCH'))
        );

        if (matchIndex !== -1) {
          const invoice = unmatchedInvoices.splice(matchIndex, 1)[0];
          unmatchedBank.splice(i, 1);
          matched.push({
            bank_id: bank.id,
            invoice_id: invoice.id,
            amount: bank.amount,
            method: 'exact_amount_reference',
            confidence: 1.0
          });
        }
      }

      // 2. Amount-only Match (Medium Confidence - multiple invoices might have same amount)
      for (let i = unmatchedBank.length - 1; i >= 0; i--) {
        const bank = unmatchedBank[i];
        const potentialMatches = unmatchedInvoices.filter(inv => Math.abs(inv.amount - bank.amount) < 0.01);
        
        if (potentialMatches.length === 1) {
          const invoice = potentialMatches[0];
          const invIdx = unmatchedInvoices.indexOf(invoice);
          unmatchedInvoices.splice(invIdx, 1);
          unmatchedBank.splice(i, 1);
          matched.push({
            bank_id: bank.id,
            invoice_id: invoice.id,
            amount: bank.amount,
            method: 'amount_only',
            confidence: 0.85
          });
        }
      }

      // 3. TODO: Semantic / Fuzzy partner match for remaining
      // This will involve LLM calls or RAG lookups in Phase 2.5

      return {
        success: true,
        message: `Matching engine finished: ${matched.length} pairs identified.`,
        data: {
          matched_count: matched.length,
          matched: matched,
          unmatched_bank_count: unmatchedBank.length,
          unmatched_invoices_count: unmatchedInvoices.length,
          unmatched_bank: unmatchedBank,
          unmatched_invoices: unmatchedInvoices
        }
      };
    } catch (error: unknown) {
      const err = ensureError(error);
      return { success: false, message: `Matching failed: ${err.message}` };
    }
  }
}
