import { BaseAgent, AgentContext, AgentResult } from './BaseAgent.js';
import { logError, logInfo } from '../utils/logger.js';
import { getSzamlazzInvoicesHandler } from '../tools/getSzamlazzInvoices.js';
import { writeSheetsInvoicesHandler } from '../tools/writeSheetsInvoices.js';

type SzamlazzPayload = Record<string, unknown>;

export class SzamlazzHuAgent extends BaseAgent {
  name = 'SzamlazzHuAgent';
  role = 'Számlázz.hu Szinkronizáló';
  description = 'Számlázz.hu számlák lekérése, normalizálása és opcionális Sheets szinkronizálása.';
  capabilities = ['szamlazz_fetch', 'invoice_normalization', 'sheets_sync'];

  async executeTask(context: AgentContext): Promise<AgentResult> {
    const task = (context.task ?? '').toLowerCase();
    const payload = (context.payload ?? {}) as SzamlazzPayload;

    const shouldFetch = this.shouldFetch(task);
    if (!shouldFetch) {
      return {
        success: false,
        message: 'Ismeretlen feladat. Használd a fetch, sync vagy szamlazz kulcsszavakat.',
      };
    }

    try {
      logInfo(this.name, 'Számlázz.hu invoice fetch indítása...');

      const fetchResult = await getSzamlazzInvoicesHandler({
        since_date: this.asString(payload.since_date),
        limit: this.asNumber(payload.limit),
        force_refresh: this.asBoolean(payload.force_refresh),
        include_unpaid_only: this.asBoolean(payload.include_unpaid_only),
        get_overdue: this.asBoolean(payload.get_overdue),
      });

      if (!fetchResult.success) {
        return {
          success: false,
          message: fetchResult.error || 'Számlázz.hu lekérdezés sikertelen.',
          data: fetchResult,
        };
      }

      const invoices = Array.isArray(fetchResult.data) ? fetchResult.data : [];
      const shouldSyncToSheets = this.shouldSync(task, payload);
      let sheetSync: Record<string, unknown> | undefined;

      if (shouldSyncToSheets && invoices.length > 0) {
        logInfo(this.name, `Számlázz.hu invoice Sheets szinkron: ${invoices.length} tétel`);
        const writeResult = await writeSheetsInvoicesHandler({
          invoices,
          append: true,
          include_line_items: false,
          clear_first: false,
          skip_duplicates: true,
          batch_size: 75,
        });

        if (!writeResult.success) {
          return {
            success: false,
            message: writeResult.error || 'A Sheets szinkronizálás sikertelen.',
            data: {
              fetched: invoices.length,
              writeResult,
            },
          };
        }

        sheetSync = writeResult.data as Record<string, unknown> | undefined;
      }

      return {
        success: true,
        message: shouldSyncToSheets
          ? `Számlázz.hu szinkron kész: ${invoices.length} számla feldolgozva.`
          : `Számlázz.hu lekérés kész: ${invoices.length} számla elérhető.`,
        data: {
          invoices,
          count: invoices.length,
          fetchedStats: fetchResult.stats,
          sheetSync,
        },
      };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      logError(this.name, message);
      return {
        success: false,
        message,
      };
    }
  }

  private shouldFetch(task: string): boolean {
    return [
      'fetch',
      'sync',
      'szamlazz',
      'számlázz',
      'invoice',
      'szamla',
      'számla',
    ].some((keyword) => task.includes(keyword));
  }

  private shouldSync(task: string, payload: SzamlazzPayload): boolean {
    const explicit = this.asBoolean(payload.write_to_sheets) || this.asBoolean(payload.sync_to_sheets);
    return explicit || task.includes('sync') || task.includes('write');
  }

  private asString(value: unknown): string | undefined {
    return typeof value === 'string' && value.trim() ? value : undefined;
  }

  private asNumber(value: unknown): number | undefined {
    return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
  }

  private asBoolean(value: unknown): boolean | undefined {
    return typeof value === 'boolean' ? value : undefined;
  }
}

export default SzamlazzHuAgent;
