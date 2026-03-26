import { IAgent, AgentResponse } from './types.js';
import { logInfo, logError, setAgentStatus } from '../utils/logger.js';
import fs from 'fs/promises';
import path from 'path';
import { fetchEmailsAsEml } from '../connectors/imapConnector.js';
import { downloadFilesFromFolder } from '../connectors/gdriveConnector.js';

/**
 * EmailAgent
 * - Feladata: IMAP/GDrive figyelés (PDF számlák letöltése) és egyedi azonosító hozzárendelése
 * - Implementáció: ha nincsenek külső hitelesítések, helyi minta fájlokat ad vissza
 */
export class EmailAgent implements IAgent {
  name = 'EmailAgent';
  role = 'Email/Drive watcher - PDF collector';
  description = 'Letölti a PDF számlákat IMAP/GDrive forrásból és menti a data/invoices/ alá';
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

  // Placeholder for IMAP fetch implementation
  private async fetchFromImap(): Promise<Array<{ id: string; filename: string; path: string }>> {
    // Intended implementation: connect to IMAP, search unseen, download PDF attachments
    logInfo(this.name, 'fetchFromImap: not implemented (placeholder)');
    return [];
  }

  // Placeholder for Google Drive fetch implementation
  private async fetchFromGDrive(): Promise<Array<{ id: string; filename: string; path: string }>> {
    // Intended implementation: use service account to list files in configured folder and download PDFs
    logInfo(this.name, 'fetchFromGDrive: not implemented (placeholder)');
    return [];
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

      // If IMAP/GDRIVE envs are set, indicate that integration is required (placeholder)
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
          const emls = await fetchEmailsAsEml(imapCfg);
          for (const e of emls) collectedFiles.push({ filename: e.filename, path: e.path });
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

      if (collectedFiles.length > 0) {
        logInfo(this.name, `Collected ${collectedFiles.length} files from external connectors`);
        // Parse any text placeholders among them
        const parsed: Array<Record<string, unknown>> = [];
        for (const f of collectedFiles) {
          if (f.filename.toLowerCase().endsWith('.txt')) {
            const p = await this.parseInvoiceText(f.path);
            if (p) parsed.push(p);
          }
        }
        return { status: 'success', data: { files: collectedFiles, parsed }, metadata: { collected: collectedFiles.length, parsed: parsed.length } };
      }

      // Fallback: return local sample files for Discovery and try to parse text placeholders
      const files = await this.listLocalSamples();
      logInfo(this.name, `Found ${files.length} local sample files`);

      const parsed: Array<Record<string, unknown>> = [];
      for (const f of files) {
        if (f.filename.toLowerCase().endsWith('.txt')) {
          const p = await this.parseInvoiceText(f.path);
          if (p) parsed.push(p);
        }
      }

      return { status: 'success', data: { files, parsed }, metadata: { filesFound: files.length, parsed: parsed.length } };
    } catch (e: unknown) {
      const error = e instanceof Error ? e.message : String(e);
      logError(this.name, `execute error: ${error}`);
      return { status: 'error', error };
    } finally {
      setAgentStatus(this.name, 'idle');
    }
  }
}
