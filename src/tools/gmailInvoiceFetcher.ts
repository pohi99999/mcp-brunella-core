import { z } from 'zod';
import { exec } from 'child_process';
import { logInfo, logError } from '../utils/logger.js';

export const gmailInvoiceFetcherDefinition = {
  name: 'gmail_invoice_fetcher',
  description: 'Letölti a Gmail-ből a PDF számlákat és elmenti az invoices mappába.',
  inputSchema: z.object({
    query: z.string().optional().describe('Gmail keresési lekérdezés, pl. "has:attachment filename:pdf"'),
    saveDir: z.string().optional().describe('Mentési könyvtár, alapértelmezett: invoices')
  })
};

export async function gmailInvoiceFetcherHandler(args: { query?: string; saveDir?: string }, extra: any) {
  const query = args.query || 'has:attachment filename:pdf';
  const saveDir = args.saveDir || 'invoices';
  try {
    logInfo('gmail_invoice_fetcher', `Futtatás: query=${query}, saveDir=${saveDir}`);
    await new Promise((resolve, reject) => {
      exec(`python myai/gmail_invoice_fetcher.py`, (error, stdout, stderr) => {
        if (error) {
          logError('gmail_invoice_fetcher', stderr || error.message);
          reject(stderr || error.message);
        } else {
          logInfo('gmail_invoice_fetcher', stdout);
          resolve(stdout);
        }
      });
    });
    return {
      content: [
        { type: "text" as const, text: 'Számlák letöltve és elmentve.' }
      ]
    };
  } catch (e: unknown) {
    const error = e instanceof Error ? e.message : String(e);
    logError('gmail_invoice_fetcher', error);
    return {
      content: [
        { type: "text" as const, text: `Hiba: ${error}` }
      ]
    };
  }
}
