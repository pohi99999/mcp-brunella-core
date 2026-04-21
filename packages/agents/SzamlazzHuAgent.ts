import { BaseAgent, AgentContext, AgentResult } from './BaseAgent.js';
import { logError, logInfo, logWarn } from '@packages/utils/logger.js';
import { getSzamlazzInvoicesHandler } from '@packages/utils/getSzamlazzInvoices.js';
import { writeSheetsInvoicesHandler } from '@packages/utils/writeSheetsInvoices.js';
import { SzamlazzClient } from '@packages/utils/szamlazzClient.js';
import { InvoiceRequest } from '@packages/utils/szamlazzRequestBuilder.js';

type SzamlazzPayload = Record<string, unknown>;

export class SzamlazzHuAgent extends BaseAgent {
  name = 'SzamlazzHuAgent';
  role = 'Számlázz.hu Szinkronizáló és Számlázó';
  description = 'Számlázz.hu számlák lekérése, normalizálása és új számlák kiállítása.';
  capabilities = ['szamlazz_fetch', 'invoice_normalization', 'sheets_sync', 'invoice_creation'];

  private client: SzamlazzClient | null = null;

  private getClient(): SzamlazzClient | null {
    if (this.client) return this.client;
    const apiKey = process.env.SZAMLAZZ_HU_API_KEY;
    if (!apiKey) {
      logWarn(this.name, 'SZAMLAZZ_HU_API_KEY hiányzik a .env-ből.');
      return null;
    }
    this.client = new SzamlazzClient({ apiKey });
    return this.client;
  }

  async executeTask(context: AgentContext): Promise<AgentResult> {
    const task = (context.task ?? '').toLowerCase();
    const payload = (context.payload ?? {}) as SzamlazzPayload;

    // Számla kiállítása
    if (task.includes('create') || task.includes('kiállítás') || task.includes('küldés')) {
      return await this.handleCreateInvoice(payload);
    }

    // Számlák lekérése és szinkronizálása
    const shouldFetch = this.shouldFetch(task);
    if (!shouldFetch) {
      return {
        success: false,
        message: 'Ismeretlen feladat. Használd a fetch, sync vagy create kulcsszavakat.',
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

  private async handleCreateInvoice(payload: SzamlazzPayload): Promise<AgentResult> {
    const client = this.getClient();
    if (!client) {
      return { success: false, message: 'Számlázz.hu API kulcs hiányzik. Ellenőrizd a .env fájlt.' };
    }

    try {
      logInfo(this.name, 'Számla létrehozásának indítása...');
      
      const invoiceRequest = payload as unknown as InvoiceRequest;
      if (!invoiceRequest.customer || !invoiceRequest.items || invoiceRequest.items.length === 0) {
        return { success: false, message: 'Hiányzó számla adatok (vevő vagy tételek).' };
      }

      // Add seller info from env if not present in payload
      if (!invoiceRequest.seller) {
        invoiceRequest.seller = {
          bankAccount: process.env.SZAMLAZZ_HU_BANK_ACCOUNT || '',
          email: process.env.GMAIL_USER || '',
        };
      }

      const response = await client.createInvoice(invoiceRequest);

      if (response.success) {
        return {
          success: true,
          message: `Számla sikeresen kiállítva: ${response.invoiceNumber}`,
          data: response,
        };
      } else {
        return {
          success: false,
          message: `Számlázz.hu hiba: ${response.errorMessage}`,
          data: response,
        };
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      logError(this.name, `Számla létrehozási hiba: ${message}`);
      return { success: false, message };
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

