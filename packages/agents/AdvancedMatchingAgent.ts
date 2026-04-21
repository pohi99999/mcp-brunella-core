import { BaseAgent, AgentContext, AgentResult } from './BaseAgent.js';
import { logInfo } from '@packages/utils/logger.js';
import { ensureError } from '@packages/utils/ensureError.js';

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
    const task = typeof context?.task === 'string' ? context.task : '';
    logInfo(this.name, `Matching financial records: ${task}`);

    const payload = context?.payload ?? {};
    const bankEntries = Array.isArray(payload.bankEntries) ? payload.bankEntries as Array<Record<string, unknown>> : [];
    const openInvoices = Array.isArray(payload.openInvoices) ? payload.openInvoices as Array<Record<string, unknown>> : [];
    const threshold = typeof payload.confidenceThreshold === 'number' ? payload.confidenceThreshold : 0.8;

    if (bankEntries.length === 0 || openInvoices.length === 0) {
      return { 
        success: true, 
        message: 'Nothing to match. Ensure both bank entries and open invoices are provided.',
        data: { matched: [], unmatched_bank: bankEntries, unmatched_invoices: openInvoices }
      };
    }

    const matched: Array<Record<string, unknown>> = [];
    const unmatchedBank = [...bankEntries];
    const unmatchedInvoices = [...openInvoices];

    try {
      // 1. Exact Amount & Reference Match (High Confidence)
      // Helper to safely extract numeric amount and string identifiers
      const getAmount = (obj: Record<string, unknown> | undefined): number => {
        if (!obj) return 0;
        const a = obj['amount'];
        if (typeof a === 'number') return a;
        if (typeof a === 'string') return parseFloat(a || '0') || 0;
        return 0;
      };

      const getId = (obj: Record<string, unknown> | undefined): string => {
        if (!obj) return '';
        const id = obj['id'];
        return typeof id === 'string' ? id : String(id ?? '');
      };

      const getReference = (obj: Record<string, unknown> | undefined): string => {
        if (!obj) return '';
        const r = obj['reference'];
        return typeof r === 'string' ? r : '';
      };

      for (let i = unmatchedBank.length - 1; i >= 0; i--) {
        const bank = unmatchedBank[i];
        const bankAmount = getAmount(bank as Record<string, unknown>);
        const bankRef = getReference(bank as Record<string, unknown>);

        const matchIndex = unmatchedInvoices.findIndex(inv => {
          const invAmount = getAmount(inv as Record<string, unknown>);
          const invId = getId(inv as Record<string, unknown>);
          const amountMatch = Math.abs(invAmount - bankAmount) < 0.01;
          const refMatch = bankRef && invId ? (bankRef.includes(invId) || invId.includes(bankRef)) : false;
          return amountMatch && refMatch;
        });

        if (matchIndex !== -1) {
          const invoice = unmatchedInvoices.splice(matchIndex, 1)[0];
          unmatchedBank.splice(i, 1);
          matched.push({
            bank_id: getId(bank as Record<string, unknown>),
            invoice_id: getId(invoice as Record<string, unknown>),
            amount: bankAmount,
            method: 'exact_amount_reference',
            confidence: 1.0,
          });
        }
      }

      // 2. Amount-only Match (Medium Confidence - multiple invoices might have same amount)
      for (let i = unmatchedBank.length - 1; i >= 0; i--) {
        const bank = unmatchedBank[i];
        const bankAmount = getAmount(bank as Record<string, unknown>);
        const potentialMatches = unmatchedInvoices.filter(inv => Math.abs(getAmount(inv as Record<string, unknown>) - bankAmount) < 0.01);

        if (potentialMatches.length === 1) {
          const invoice = potentialMatches[0];
          const invIdx = unmatchedInvoices.indexOf(invoice);
          unmatchedInvoices.splice(invIdx, 1);
          unmatchedBank.splice(i, 1);
          matched.push({
            bank_id: getId(bank as Record<string, unknown>),
            invoice_id: getId(invoice as Record<string, unknown>),
            amount: bankAmount,
            method: 'amount_only',
            confidence: 0.85,
          });
        }
      }

      // 3. TODO [tech-debt-cleanup]: Semantic / Fuzzy partner match for remaining
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

