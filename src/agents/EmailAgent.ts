import { IAgent, AgentResponse } from './types.js';
import { logInfo, logError, setAgentStatus } from '../utils/logger.js';
import fs from 'fs/promises';
import path from 'path';

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

  async execute(task: string, _context?: Record<string, unknown>): Promise<AgentResponse> {
    setAgentStatus(this.name, 'working', task.slice(0, 50));
    try {
      logInfo(this.name, `execute: ${task}`);

      // If IMAP/GDRIVE envs are set, indicate that integration is required (placeholder)
      const imapHost = process.env.IMAP_HOST;
      const gdriveEnabled = process.env.GDRIVE_SERVICE_ACCOUNT !== undefined;

      if (imapHost || gdriveEnabled) {
        logInfo(this.name, 'External connectors configured, but connector implementation is placeholder.');
        return {
          status: 'delegated',
          message: 'IMAP/GDrive connectors not implemented in-agent. Use connector module or provide local samples.',
          metadata: { imapHost: !!imapHost, gdrive: !!gdriveEnabled }
        };
      }

      // Fallback: return local sample files for Discovery
      const files = await this.listLocalSamples();
      logInfo(this.name, `Found ${files.length} local sample files`);

      return { status: 'success', data: { files }, metadata: { filesFound: files.length } };
    } catch (e: unknown) {
      const error = e instanceof Error ? e.message : String(e);
      logError(this.name, `execute error: ${error}`);
      return { status: 'error', error };
    } finally {
      setAgentStatus(this.name, 'idle');
    }
  }
}
