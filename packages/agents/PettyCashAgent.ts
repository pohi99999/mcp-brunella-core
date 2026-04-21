import { BaseAgent, AgentContext, AgentResult } from './BaseAgent.js';
import { createCashEntry, getCashEntries, getCashSummary, updateCashEntry } from '@packages/utils/bookkeeping_db.js';
import { logInfo, logError } from '@packages/utils/logger.js';
import { ensureError } from '@packages/utils/ensureError.js';
import type { CashEntryInput, CashEntryType } from '@packages/types/bookkeeping.d.js';

/**
 * PettyCashAgent - Házi pénztár (petty cash) nyilvántartása és kezelése.
 */
export class PettyCashAgent extends BaseAgent {
  name = 'PettyCashAgent';
  role = 'Házi pénztár kezelő';
  description = 'Kezeli a házi pénztár bevételeit és kiadásait, szinkronizálja azokat a könyvelési adatbázissal.';
  capabilities = ['petty-cash-management', 'cash-flow-tracking', 'accounting-records'];

  async executeTask(context: AgentContext): Promise<AgentResult> {
    const task = typeof context.task === 'string' ? context.task : '';
    const payload = context.payload ?? {};
    logInfo(this.name, `Executing petty cash task: ${task}`);

    try {
      if (task.includes('create') || task.includes('add') || task.includes('bevételez') || task.includes('kiad')) {
        return await this.handleCreate(payload);
      }

      if (task.includes('list') || task.includes('lista') || task.includes('lekérdez')) {
        return await this.handleList(payload);
      }

      if (task.includes('summary') || task.includes('összegzés') || task.includes('egyenleg')) {
        return await this.handleSummary(payload);
      }

      if (task.includes('sync') || task.includes('szinkronizál')) {
        return await this.handleSync(payload);
      }

      return { success: false, message: 'Ismeretlen házi pénztár feladat.' };
    } catch (error: unknown) {
      const err = ensureError(error);
      logError(this.name, `Task execution failed: ${err.message}`);
      return { success: false, message: `Hiba: ${err.message}` };
    }
  }

  private async handleCreate(payload: any): Promise<AgentResult> {
    const input: CashEntryInput = {
      date: payload.date ?? new Date().toISOString().split('T')[0],
      type: payload.type as CashEntryType,
      amount: payload.amount,
      description: payload.description ?? '',
      invoiceNumber: payload.invoiceNumber,
      source: payload.source ?? 'manual',
      syncedSheets: payload.syncedSheets ?? false
    };

    if (!input.amount || !input.type) {
      return { success: false, message: 'Összeg és típus (KP_IN/KP_OUT) megadása kötelező.' };
    }

    const entry = createCashEntry(input);
    return {
      success: true,
      message: `Házi pénztár tétel rögzítve: ${entry.type} - ${entry.amount} HUF (${entry.description})`,
      data: entry
    };
  }

  private async handleList(payload: any): Promise<AgentResult> {
    const filters = {
      dateFrom: payload.dateFrom,
      dateTo: payload.dateTo,
      type: payload.type as CashEntryType,
      syncedSheets: payload.syncedSheets,
      limit: payload.limit,
      offset: payload.offset
    };

    const entries = getCashEntries(filters);
    return {
      success: true,
      message: `${entries.length} házi pénztár tétel lekérdezve.`,
      data: entries
    };
  }

  private async handleSummary(payload: any): Promise<AgentResult> {
    const filters = {
      dateFrom: payload.dateFrom,
      dateTo: payload.dateTo
    };

    const summary = getCashSummary(filters);
    return {
      success: true,
      message: `Házi pénztár egyenleg: ${summary.balance} HUF. (Bevétel: ${summary.income}, Kiadás: ${summary.expense})`,
      data: summary
    };
  }

  private async handleSync(payload: any): Promise<AgentResult> {
    const entryId = payload.id;
    if (!entryId) {
      return { success: false, message: 'Tétel ID megadása kötelező a szinkronizáláshoz.' };
    }

    const entry = updateCashEntry(entryId, { syncedSheets: true });
    if (!entry) {
      return { success: false, message: `Tétel nem található: ${entryId}` };
    }

    return {
      success: true,
      message: `Tétel szinkronizáltként megjelölve: ${entryId}`,
      data: entry
    };
  }
}

