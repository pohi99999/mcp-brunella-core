import { BaseAgent, AgentContext, AgentResult } from './BaseAgent.js';
import { logInfo } from '../utils/logger.js';
import { ensureError } from '../utils/ensureError.js';

/**
 * ReconciliationIngestionAgent - Bejövő pénzügyi bizonylatok (Bank, NAV, Számlák) 
 * beolvasása és normalizálása Multi-Ágens reconciliation folyamathoz.
 */
export class ReconciliationIngestionAgent extends BaseAgent {
  name = 'ReconciliationIngestionAgent';
  role = 'Pénzügyi adat ingesztor';
  description = 'Különböző forrású bizonylatok (banki kivonatok, NAV XML, számlák) beolvasása és egységes formátumra hozása.';
  capabilities = ['finance-ingestion', 'data-normalization', 'accounting-parsing'];

  async executeTask(context: AgentContext): Promise<AgentResult> {
    const { task, payload } = context as any;
    logInfo(this.name, `Ingesting financial data: ${task}`);

    const data = payload?.data;
    const format = payload?.format || 'auto'; // 'bank_csv', 'nav_xml', 'szamlazz_json'

    if (!data) {
      return { success: false, message: 'No data provided for ingestion' };
    }

    let normalizedEntries: Array<Record<string, unknown>>;

    try {
      if (format === 'nav_xml' || (format === 'auto' && data.includes('<invoiceData'))) {
        logInfo(this.name, 'Detected NAV XML format');
        // Egyszerűsített NAV XML regex alapú extraction (példa)
        const invoiceNumbers = [...data.matchAll(/<invoiceNumber>(.*?)<\/invoiceNumber>/g)].map(m => m[1]);
        normalizedEntries = invoiceNumbers.map(num => ({
          id: num,
          type: 'invoice',
          source: 'NAV',
          date: new Date().toISOString(), // Valóságban XML-ből jönne
          raw: data
        }));
      } else if (format === 'bank_csv' || (format === 'auto' && data.includes(';'))) {
        logInfo(this.name, 'Detected Bank CSV format');
        const lines = data.split('\n');
        normalizedEntries = lines.filter((l: string) => l.trim()).map((line: string, index: number) => {
          const parts = line.split(';');
          return {
            id: `bank-${Date.now()}-${index}`,
            type: 'transaction',
            amount: parseFloat(parts[1]) || 0,
            partner: parts[2] || 'Unknown',
            reference: parts[3] || '',
            date: parts[0]
          };
        });
      } else {
        return { success: false, message: `Unsupported or undetectable format: ${format}` };
      }

      return {
        success: true,
        message: `Financial data ingested: ${normalizedEntries.length} entries processed.`,
        data: {
          format_detected: format,
          entries_count: normalizedEntries.length,
          entries: normalizedEntries
        }
      };
    } catch (error: unknown) {
      const err = ensureError(error);
      return { success: false, message: `Ingestion failed: ${err.message}` };
    }
  }
}
