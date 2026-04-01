import { promises as fs } from 'fs';
import path from 'path';
import { IAgent, AgentResponse } from './types.js';
import type { AgentContext, AgentResult } from './BaseAgent.js';
import { logInfo, logError, setAgentStatus } from '../utils/logger.js';
import { saveTransaction } from '../data/bookkeeping_db.js';
import type { BankTransactionData, BookkeepingTransaction, TransactionStatus } from '../types/bookkeeping.d.js';

/**
 * BankAgent
 * Parses bank CSV exports and stores transactions for bookkeeping reconciliation.
 */
export class BankAgent implements IAgent {
  name = 'BankAgent';
  role = 'Process bank transaction statements';
  description = 'Parses CSV data from bank statements and populates the bookkeeping database.';
  capabilities = ['csv-parsing', 'bank-reconciliation', 'data-ingestion'];

  private getSamplePath(): string {
    return path.resolve('conductor/tracks/konyveles_automatizalas/resources/samples/bank_transactions.csv');
  }

  private resolveCsvPath(context?: AgentContext | Record<string, unknown>): string | undefined {
    if (!context || typeof context !== 'object') {
      return undefined;
    }

    const directPath = (context as Record<string, unknown>).bankCsvPath;
    if (typeof directPath === 'string' && directPath.trim()) {
      return directPath.trim();
    }

    if ('payload' in context) {
      const payload = (context as AgentContext).payload;
      const payloadPath = payload?.bankCsvPath;
      if (typeof payloadPath === 'string' && payloadPath.trim()) {
        return payloadPath.trim();
      }
    }

    return undefined;
  }

  private toResponse(result: AgentResult): AgentResponse {
    return {
      success: result.success,
      status: result.success ? 'success' : 'error',
      message: result.message,
      data: result.data,
      error: result.success ? undefined : result.message,
    };
  }

  private isHeaderRow(row: string): boolean {
    const normalized = row.toLowerCase();
    return normalized.includes('date') && normalized.includes('amount') && (normalized.includes('partner') || normalized.includes('reference'));
  }

  parseRow(csvRow: string): BankTransactionData {
    const delimiter = csvRow.includes(';') ? ';' : ',';
    const parts = csvRow.split(delimiter).map((part) => part.trim());

    if (parts.length < 4) {
      throw new Error('Invalid bank CSV row');
    }

    const [date, partner, amountText, reference] = parts;
    const normalizedAmount = amountText.replace(/\s/g, '').replace(',', '.');
    const amount = Number(normalizedAmount);

    if (!date || !partner || !reference || Number.isNaN(amount)) {
      throw new Error('Invalid bank CSV row');
    }

    return { date, partner, amount, reference };
  }

  async executeTask(context: AgentContext): Promise<AgentResult> {
    const bankFilePath = this.resolveCsvPath(context);

    if (!bankFilePath) {
      return {
        success: false,
        status: 'error',
        message: 'Missing bankFilePath (csv or json) in context',
        data: [],
      };
    }

    logInfo(this.name, `Processing bank file: ${bankFilePath}`);

    try {
      const ext = path.extname(bankFilePath).toLowerCase();
      let transactions: BankTransactionData[] = [];

      if (ext === '.json') {
        const content = await fs.readFile(bankFilePath, 'utf-8');
        const data = JSON.parse(content);
        transactions = Array.isArray(data) ? data : (data.transactions || []);
        
        for (const [index, txData] of transactions.entries()) {
            const transaction: BookkeepingTransaction = {
                id: `bank_json_${Date.now()}_${index}`,
                source: 'BankAgent',
                data: txData,
                status: 'PENDING_MATCH',
            };
            saveTransaction(transaction);
        }
      } else {
        const content = await fs.readFile(bankFilePath, 'utf-8');
        const lines = content.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
        const rows = lines.length > 0 && this.isHeaderRow(lines[0]) ? lines.slice(1) : lines;

        for (const row of rows) {
          try {
            const parsed = this.parseRow(row);
            const transaction: BookkeepingTransaction = {
              id: `bank_${transactions.length + 1}`,
              source: 'BankAgent',
              data: parsed,
              status: 'PENDING_MATCH' as TransactionStatus,
            };

            saveTransaction(transaction);
            transactions.push(parsed);
          } catch (error: unknown) {
            const rowError = error instanceof Error ? error : new Error(String(error));
            logError(this.name, `Error parsing row '${row}':`, rowError);
          }
        }
      }

      return {
        success: true,
        status: 'success',
        message: `Processed ${transactions.length} bank transactions`,
        data: transactions,
      };
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      logError(this.name, 'executeTask failed:', err);
      return {
        success: false,
        status: 'error',
        message: err.message,
        data: [],
      };
    }
  }

  async execute(task: string, context?: Record<string, unknown>): Promise<AgentResponse> {
    setAgentStatus(this.name, 'working', task.slice(0, 50));
    try {
      const bankCsvPath = this.resolveCsvPath(context) ?? this.getSamplePath();
      const result = await this.executeTask({ task, payload: { bankCsvPath } });
      return this.toResponse(result);
    } finally {
      setAgentStatus(this.name, 'idle');
    }
  }
}
