import { eventBus, BusEvent } from './eventBus.js';
import { logInfo, logError } from '@packages/utils/logger.js';
import { agentManager } from '@packages/agents/AgentManager.js';
import { updateInvoiceStatus, getInvoice } from '@packages/utils/bookkeeping_db.js';
import { registerHook } from '@packages/utils/hooks.js';

/**
 * L5 Invoice Pipeline Orchestrator
 */
export class InvoicePipeline {
  private static instance: InvoicePipeline;

  private constructor() {
    this.setupListeners();
    this.setupHooks();
  }

  public static getInstance(): InvoicePipeline {
    if (!InvoicePipeline.instance) {
      InvoicePipeline.instance = new InvoicePipeline();
    }
    return InvoicePipeline.instance;
  }

  /**
   * Register system hooks for event-driven triggers
   */
  private setupHooks() {
    logInfo('InvoicePipeline', 'Registering L5 Invoice hooks...');

    // Note: builtinHooks.ts already registers a handler for 'invoice:received'.
    // We can add supplemental logic here if needed, or rely on the built-in one.
    // For now, we register a high-priority logging hook to track L5 flow.
    registerHook('invoice:received', async (ctx: any) => {
      logInfo('InvoicePipeline', `[L5] Hook 'invoice:received' detected. Pipeline tracking active.`);
    }, { category: 'business', priority: 10 });
  }

  private setupListeners() {
    logInfo('InvoicePipeline', 'Initializing L5 Zero-Touch event listeners...');

    // 1. When an invoice is logged to Sheets, trigger NAV cross-check
    eventBus.on('invoice.logged', async (event: BusEvent) => {
      const { invoiceId } = event.payload as { invoiceId: string };
      logInfo('InvoicePipeline', `Invoice ${invoiceId} logged. Triggering NAV cross-check...`);
      
      try {
        const invoice = getInvoice(invoiceId);
        if (!invoice) throw new Error(`Invoice ${invoiceId} not found in DB`);

        // Delegate to NavCrossCheckAgent
        const result = await agentManager.delegate('NavCrossCheckAgent', `Validate invoice ${invoice.invoiceNumber} for partner ${invoice.partnerName}`, {
          invoiceId,
          invoiceData: invoice
        });

        // If cross-check successful, mark as completed
        if (result && (result as any).success) {
          updateInvoiceStatus(invoiceId, 'COMPLETED');
          eventBus.emit({
            source: 'InvoicePipeline',
            type: 'invoice.completed',
            payload: { invoiceId }
          });
          logInfo('InvoicePipeline', `Invoice ${invoiceId} fully processed and completed.`);
        } else {
          throw new Error((result as any).message || 'NAV cross-check failed');
        }
      } catch (err: any) {
        const errorMsg = err.message || String(err);
        logError('InvoicePipeline', `Failed to complete pipeline for ${invoiceId}: ${errorMsg}`);
        updateInvoiceStatus(invoiceId, 'FAILED', errorMsg);
        eventBus.emit({
          source: 'InvoicePipeline',
          type: 'invoice.failed',
          payload: { invoiceId, error: errorMsg }
        });
      }
    });

    // 2. Failure Handling - Log to a central audit trail or notify
    eventBus.on('invoice.failed', (event: BusEvent) => {
      const { invoiceId, error } = event.payload as { invoiceId: string, error: string };
      logError('InvoicePipeline', `PIPELINE FAILURE: Invoice ${invoiceId} failed with error: ${error}`);
      // Future: Add notification service call here
    });
  }
}

/**
 * Initialize the pipeline singleton.
 */
export function initializeInvoicePipeline() {
  return InvoicePipeline.getInstance();
}

