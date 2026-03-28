import { IAgent, AgentResponse } from './types.js';
import { logInfo, logError, setAgentStatus } from '../utils/logger.js';
import { saveTransaction } from '../data/bookkeeping_db.js';
import fs from 'fs';
import path from 'path';

/**
 * BankAgent
 * Matches bank transactions in CSV format against expected sample formats.
 * Current standard is comma-separated from bank_transactions.csv.
 */
export class BankAgent implements IAgent {
  name = 'BankAgent';
  role = 'Process bank transaction statements';
  description = 'Parses CSV data from bank statements and populates the bookkeeping database.';
  capabilities = ['csv-parsing', 'bank-reconciliation', 'data-ingestion'];

  async execute(task: string): Promise<AgentResponse> {
    setAgentStatus(this.name, 'working', task.slice(0, 50));
    logInfo(this.name, `execute: ${task}`);
    try {
      // Use local sample for demo if no specific file provided
      const samplePath = path.resolve('conductor/tracks/konyveles_automatizalas/resources/samples/bank_transactions.csv');
      
      if (!fs.existsSync(samplePath)) {
        logError(this.name, `Sample file not found: ${samplePath}`);
        return { status: 'error', error: 'Sample file missing' };
      }

      const content = fs.readFileSync(samplePath, 'utf8');
      const lines = content.split('\n').filter(l => l.trim().length > 0);
      
      // Basic CSV parser (skipping header) - id,date,amount,counterparty,description
      const transactions = [];
      for (let i = 1; i < lines.length; i++) {
        const parts = lines[i].split(',').map(p => p.trim());
        if (parts.length >= 4) {
          const tx = {
            id: `BANK-${parts[0]}`,
            source: 'bank_tx',
            data: {
              id: parts[0],
              date: parts[1],
              amount: parseFloat(parts[2]),
              partner: parts[3],
              reference: parts[4] || ''
            },
            status: 'PENDING_MATCH' as const
          };
          
          saveTransaction(tx);
          transactions.push(tx);
        }
      }

      return { status: 'success', data: transactions };
    } catch (e: unknown) {
      const error = e instanceof Error ? e.message : String(e);
      logError(this.name, `execute error: ${error}`);
      return { status: 'error', error };
    } finally {
      setAgentStatus(this.name, 'idle');
    }
  }
}
