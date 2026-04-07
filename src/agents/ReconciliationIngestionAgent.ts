import { BaseAgent, AgentContext, AgentResult } from './BaseAgent.js';
import { logInfo } from '../utils/logger.js';
import { ensureError } from '../utils/ensureError.js';

type IngestionFormat = 'auto' | 'bank_csv' | 'nav_xml' | 'szamlazz_json';

interface ReconciliationIngestionPayload {
  data?: string;
  format?: IngestionFormat;
  [key: string]: unknown;
}

interface NavXmlEntry {
  id: string;
  type: 'invoice';
  source: 'NAV';
  date: string;
  raw: string;
}

interface BankCsvEntry {
  id: string;
  type: 'transaction';
  amount: number;
  partner: string;
  reference: string;
  date: string;
}

type NormalizedEntry = NavXmlEntry | BankCsvEntry;

interface ReconciliationIngestionResultData {
  format_detected: IngestionFormat;
  entries_count: number;
  entries: NormalizedEntry[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isReconciliationIngestionPayload(value: unknown): value is ReconciliationIngestionPayload {
  if (!isRecord(value)) {
    return false;
  }

  const dataIsValid = value.data === undefined || typeof value.data === 'string';
  const formatIsValid = value.format === undefined || typeof value.format === 'string';
  return dataIsValid && formatIsValid;
}

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
    const task = typeof context.task === 'string' ? context.task : '';
    const payload = isReconciliationIngestionPayload(context.payload) ? context.payload : undefined;
    logInfo(this.name, `Ingesting financial data: ${task}`);

    const data = payload?.data ?? '';
    const format: IngestionFormat = payload?.format ?? 'auto';

    if (!data) {
      return { success: false, message: 'No data provided for ingestion' };
    }

    let normalizedEntries: NormalizedEntry[];

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
        normalizedEntries = lines.filter((line) => line.trim()).map((line, index) => {
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
        } satisfies ReconciliationIngestionResultData
      };
    } catch (error: unknown) {
      const err = ensureError(error);
      return { success: false, message: `Ingestion failed: ${err.message}` };
    }
  }
}
