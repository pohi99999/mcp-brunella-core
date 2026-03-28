import { IAgent, AgentResponse } from './types.js';
import { logInfo, logError, setAgentStatus } from '../utils/logger.js';
import { saveTransaction } from '../data/bookkeeping_db.js';
import { BookkeepingTransaction, NavInvoiceData, TransactionStatus } from '../types/bookkeeping.d.js';
import fs from 'fs/promises';
import path from 'path';

/**
 * NavAgent
 * - Feladata: NAV Online Számla API lekérések és XML normalizálás
 * - Implementáció: helyi mintafájlokból normalizálás, NAV API placeholder
 * - Mentési cél: bookkeeping_db.ts
 */
export class NavAgent implements IAgent {
  name = 'NavAgent';
  role = 'NAV Online Számla integráció';
  description = 'Lekéri és normalizálja a NAV XML adatokat a központi adatbázisba';
  capabilities = ['nav_fetch', 'xml_normalize'];

  private samplesDir() {
    return path.join(process.cwd(), 'conductor', 'tracks', 'konyveles_automatizalas', 'resources', 'samples');
  }

  private async listLocalNavSamples() {
    try {
      const dir = this.samplesDir();
      const files = await fs.readdir(dir);
      return files.filter((f) => f.endsWith('.xml')).map((f) => path.join(dir, f));
    } catch (e) {
      logError(this.name, `listLocalNavSamples failed: ${String(e)}`);
      return [] as string[];
    }
  }

  private xmlToJson(xml: string) {
    // Very small, brittle XML->JSON extraction for known invoice tags in samples
    const extract = (tag: string) => {
      const re = new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`, 'i');
      const m = xml.match(re);
      return m ? m[1].trim() : undefined;
    };

    return {
      invoice_number: extract('invoice_number'),
      net_amount: Number(extract('net_amount') || 0),
      vat_amount: Number(extract('vat_amount') || 0),
      gross_amount: Number(extract('gross_amount') || 0),
      issue_date: extract('issue_date'),
      issueDate: extract('issue_date'), // standard alias
      partner_taxid: extract('partner_taxid'),
      partner: extract('partner_name') || extract('partner_taxid'), // standard alias
      payment_method: extract('payment_method')
    };
  }

  // Placeholder: NAV API fetch (delegated) if credentials exist
  private async fetchFromNavApi() {
    const apiKey = process.env.NAV_API_KEY;
    if (!apiKey) return null;
    logInfo(this.name, 'NAV API key detected - API client not implemented in this agent (placeholder)');
    return null;
  }

  async execute(task: string, _context?: Record<string, unknown>): Promise<AgentResponse> {
    setAgentStatus(this.name, 'working', task.slice(0, 50));
    try {
      logInfo(this.name, `execute: ${task}`);

      // If NAV_API_KEY exists, indicate delegated implementation
      if (process.env.NAV_API_KEY) {
        const apiResult = await this.fetchFromNavApi();
        return { status: 'delegated', message: 'NAV API client not implemented in-agent', metadata: { api: !!apiResult } };
      }

      // Else: parse local sample XML files
      const xmlFiles = await this.listLocalNavSamples();
      const results: Array<any> = [];

      for (const f of xmlFiles) {
        try {
          const txt = await fs.readFile(f, 'utf-8');
          const data = this.xmlToJson(txt);
          
          if (data.invoice_number) {
            try {
              // Standard source for MatchingAgent
              saveTransaction({
                id: `nav_${data.invoice_number}`,
                source: 'nav_invoice',
                data: {
                  invoiceNumber: data.invoice_number,
                  amount: Number(data.gross_amount),
                  partner: data.partner_taxid,
                  issueDate: data.issue_date
                } as any,
                status: 'PENDING_MATCH' as TransactionStatus
              });
              results.push(data);
            } catch (dbErr) {
              logError(this.name, `DB Save error for ${f}: ${String(dbErr)}`);
            }
          }
        } catch (e) {
          logError(this.name, `Failed to read/parse ${f}: ${String(e)}`);
        }
      }

      return { status: 'success', data: results, metadata: { filesProcessed: xmlFiles.length, savedEntries: results.length } };
    } catch (e: unknown) {
      const error = e instanceof Error ? e.message : String(e);
      logError(this.name, `execute error: ${error}`);
      return { status: 'error', error };
    } finally {
      setAgentStatus(this.name, 'idle');
    }
  }
}
