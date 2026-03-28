import { IAgent, AgentResponse } from './types.js';
import { logInfo, logError, setAgentStatus } from '../utils/logger.js';
import { saveTransaction } from '../data/bookkeeping_db.js';
import { BookkeepingTransaction, NavInvoiceData, TransactionStatus } from '../types/bookkeeping.d.js';
import fs from 'fs/promises';
import path from 'path';
import { fetchEmailsAsEml, fetchAndExtractAttachments } from '../connectors/imapConnector.js';
import { downloadFilesFromFolder } from '../connectors/gdriveConnector.js';

/**
 * EmailAgent
 * - Feladata: IMAP/GDrive figyelés (PDF számlák letöltése) és egyedi azonosító hozzárendelése
 * - Implementáció: ha nincsenek külső hitelesítések, helyi minta fájlokat ad vissza
 * - Mentési cél: bookkeeping_db.ts
 */
export class EmailAgent implements IAgent {
  name = 'EmailAgent';
  role = 'Email/Drive watcher - PDF collector';
  description = 'Letölti a PDF számlákat IMAP/GDrive forrásból és menti a bookkeeping_db-be';
  capabilities = ['email_fetch', 'pdf_store', 'id_assign'];

  async initialize(): Promise<void> {
    logInfo(this.name, 'initialize - noop');
  }

  private samplesDir() {
    return path.join(process.cwd(), 'conductor', 'tracks', 'konyveles_automatizalas', 'resources', 'samples');
  }

  private async listLocalSamples() {
    try {
      const dir = this.samplesDir();
      const files = await fs.readdir(dir);
      return files.map((f) => ({ filename: f, path: path.join(dir, f) }));
    } catch (e) {
      logError(this.name, `listLocalSamples failed: ${String(e)}`);
      return [];
    }
  }

  // Simple parser for our sample invoice placeholders (text files)
  private async parseInvoiceText(filePath: string) {
    try {
      const txt = await fs.readFile(filePath, 'utf-8');
      const lines = txt.split(/\r?\n/).map((l) => l.trim());
      const get = (prefix: string) => {
        const line = lines.find((ln) => ln.toLowerCase().startsWith(prefix.toLowerCase()));
        return line ? line.split(':').slice(1).join(':').trim() : undefined;
      };

      const invoiceId = get('Invoice ID') || get('Invoice');
      const partner = get('Partner');
      const net = Number(get('Net') || 0);
      const vat = Number(get('VAT') || 0);
      const gross = Number(get('Gross') || 0);
      const issueDate = get('IssueDate') || get('Issue Date');

      return { id: invoiceId, partner, net, vat, gross, issueDate, source: filePath };
    } catch (e) {
      logError(this.name, `parseInvoiceText failed for ${filePath}: ${String(e)}`);
      return null;
    }
  }

  async execute(task: string, _context?: Record<string, unknown>): Promise<AgentResponse> {
    setAgentStatus(this.name, 'working', task.slice(0, 50));
    try {
      logInfo(this.name, `execute: ${task}`);

      const imapHost = process.env.IMAP_HOST;
      const gdriveEnabled = process.env.GDRIVE_SERVICE_ACCOUNT !== undefined || process.env.GDRIVE_FOLDER_ID;

      const collectedFiles: Array<{ filename: string; path: string }> = [];

      if (imapHost) {
        try {
          const imapCfg = {
            host: process.env.IMAP_HOST || '',
            port: process.env.IMAP_PORT ? Number(process.env.IMAP_PORT) : 993,
            secure: process.env.IMAP_SECURE !== 'false',
            auth: { user: process.env.IMAP_USER || '', pass: process.env.IMAP_PASS || '' },
            mailbox: process.env.IMAP_MAILBOX || 'INBOX',
            destDir: path.join(process.cwd(), 'data', 'invoices'),
            markSeen: process.env.IMAP_MARKSEEN === 'true'
          };
          const attachments = await fetchAndExtractAttachments(imapCfg);
          for (const a of attachments) collectedFiles.push({ filename: a.filename, path: a.path });
        } catch (e) {
          logError(this.name, `IMAP fetch failed: ${String(e)}`);
        }
      }

      if (gdriveEnabled && process.env.GDRIVE_FOLDER_ID) {
        try {
          const files = await downloadFilesFromFolder({ keyFile: process.env.GDRIVE_SERVICE_ACCOUNT, folderId: process.env.GDRIVE_FOLDER_ID, destDir: path.join(process.cwd(), 'data', 'invoices') });
          for (const f of files) collectedFiles.push(f);
        } catch (e) {
          logError(this.name, `GDrive fetch failed: ${String(e)}`);
        }
      }

      let finals: Array<{ filename: string; path: string }> = collectedFiles;
      if (finals.length === 0) {
        // Fallback: use local sample files
        const localSamples = await this.listLocalSamples();
        finals = localSamples;
        logInfo(this.name, `No external files collected, using ${finals.length} local samples.`);
      }

      const parsedEntries: Array<any> = [];
      for (const f of finals) {
        if (f.filename.toLowerCase().endsWith('.txt')) {
          const data = await this.parseInvoiceText(f.path);
          if (data && data.id) {
            const tx: BookkeepingTransaction = {
              id: `email_${data.id}`,
              source: this.name,
              data: {
                invoiceNumber: data.id,
                amount: data.gross,
                partner: data.partner,
                issueDate: data.issueDate
              } as any,
              status: 'PENDING_MATCH' as TransactionStatus
            };
            
            try {
              saveTransaction(tx);
              parsedEntries.push(data);
              logInfo(this.name, `Saved email/drive invoice ${data.id} to DB`);
            } catch (dbErr) {
              logError(this.name, `DB Save error for ${f.filename}: ${String(dbErr)}`);
            }
          }
        }
      }

      return { 
        status: 'success', 
        data: { files: finals, parsed: parsedEntries }, 
        metadata: { 
          source: collectedFiles.length > 0 ? 'external' : 'local_samples',
          totalFiles: finals.length, 
          savedEntries: parsedEntries.length 
        } 
      };
    } catch (e: unknown) {
      const error = e instanceof Error ? e.message : String(e);
      logError(this.name, `execute error: ${error}`);
      return { status: 'error', error };
    } finally {
      setAgentStatus(this.name, 'idle');
    }
  }
}
