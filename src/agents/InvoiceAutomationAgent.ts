import { BaseAgent, AgentContext, AgentResult } from './BaseAgent.js';
import { logInfo, logError } from '../utils/logger.js';
import { getWorkspaceClient } from '../tools/unifiedWorkspace.js';
import { getBifrostGateway } from '../core/bifrost_gateway.js';
import { eventBus } from '../core/eventBus.js';
import { 
  saveInvoice, 
  getInvoiceByGmailId, 
  updateInvoiceStatus 
} from '../data/bookkeeping_db.js';
import * as path from 'path';
import * as crypto from 'node:crypto';

/**
 * Extracted Invoice Data
 */
interface ExtractedInvoice {
  vendorName: string;
  invoiceNumber: string;
  amount: number;
  currency: string;
  date: string; // ISO format YYYY-MM-DD
}

/**
 * InvoiceAutomationAgent - Automatizált Számlafeldolgozó (L5 Zero-Touch)
 * Feladata: Gmail -> Gemini Vision -> Drive & Sheets -> Event Pipeline
 */
export class InvoiceAutomationAgent extends BaseAgent {
  name = 'InvoiceAutomation';
  role = 'Automated Invoice Processor';
  description = 'Számlák automatikus feldolgozása L5 szinten: Gmail letöltés, Gemini Vision elemzés, Drive mentés és Sheets rögzítés eseményvezérelt módon.';
  capabilities = ['gmail_read', 'vision_extraction', 'drive_organization', 'sheets_logging', 'event_driven'];

  async executeTask(context: AgentContext): Promise<AgentResult> {
    const task = context.task?.toLowerCase() || '';

    try {
      if (task.includes('process') || task.includes('feldolgoz') || task.includes('run')) {
        return await this.runFullWorkflow(context);
      }

      return {
        success: false,
        message: 'Ismeretlen feladat. Kérlek használd a "process" vagy "számlák feldolgozása" utasítást.'
      };
    } catch (e: unknown) {
      const error = e instanceof Error ? e.message : String(e);
      logError(this.name, `Hiba a munkafolyamat során: ${error}`);
      return { success: false, message: `Hiba: ${error}` };
    }
  }

  /**
   * Teljes munkafolyamat futtatása
   */
  private async runFullWorkflow(context: AgentContext): Promise<AgentResult> {
    logInfo(this.name, 'L5 Számlafeldolgozási munkafolyamat indítása...');

    // 1. Gmail keresés - utolsó 10 releváns levél
    const query = 'has:attachment (filename:pdf OR filename:jpg OR filename:png) label:inbox "számla"';
    const workspace = await getWorkspaceClient();
    const messages = (await workspace.searchEmails(query, 10)) as Array<{ id?: string }>;

    if (messages.length === 0) {
      return { 
        success: true, 
        message: 'Nem találtam új feldolgozandó számlát a Gmail-ben.',
        data: { processed: 0 }
      };
    }

    let processedCount = 0;
    let failedCount = 0;
    let skippedCount = 0;
    const results = [];

    for (const msg of messages) {
      const messageId = msg.id;
      if (!messageId) {
        logInfo(this.name, 'Skipping Gmail message without id');
        continue;
      }

      // Idempotencia ellenőrzés
      const existing = getInvoiceByGmailId(messageId);
      if (existing) {
        logInfo(this.name, `Levél már feldolgozva (id: ${existing.id}), kihagyás.`);
        skippedCount++;
        continue;
      }

      const invoiceId = crypto.randomUUID(); // Generate unique ID for this invoice
      logInfo(this.name, `Új levél feldolgozása (Job ID: ${invoiceId}): ${messageId}`);
      
      // Kezdeti rögzítés a DB-be
      saveInvoice({
        id: invoiceId,
        gmailMessageId: messageId,
        status: 'RECEIVED'
      });

      eventBus.emit({
        source: this.name,
        type: 'invoice.received',
        payload: { invoiceId, gmailMessageId: messageId }
      });

      const attachments = await workspace.getEmailAttachments(messageId);
      
      for (const att of attachments) {
        if (this.isInvoiceFile(att.filename)) {
          try {
            // Fázis: Kivonás (Vision)
            const extraction = await this.processInvoiceFile(att.data, att.filename);
            
            if (extraction.success && extraction.data) {
              const extractedData = extraction.data as ExtractedInvoice;
              
              saveInvoice({
                id: invoiceId,
                partnerName: extractedData.vendorName,
                invoiceNumber: extractedData.invoiceNumber,
                amount: extractedData.amount,
                currency: extractedData.currency,
                date: extractedData.date,
                status: 'EXTRACTED'
              });

              eventBus.emit({
                source: this.name,
                type: 'invoice.extracted',
                payload: { invoiceId, data: extractedData }
              });

              // Fázis: Mentés Drive-ra
              const driveFile = await this.saveToDrive(att.data, att.filename, extractedData);
              
              updateInvoiceStatus(invoiceId, 'STORED');
              saveInvoice({ id: invoiceId, driveFileId: driveFile.fileId, status: 'STORED' });

              eventBus.emit({
                source: this.name,
                type: 'invoice.stored',
                payload: { invoiceId, driveFileId: driveFile.fileId }
              });

              // Fázis: Rögzítés Sheets-be
              await this.logToSheets(extractedData, driveFile.webViewLink);
              
              updateInvoiceStatus(invoiceId, 'COMPLETED');
              eventBus.emit({
                source: this.name,
                type: 'invoice.completed',
                payload: { invoiceId }
              });

              processedCount++;
              results.push({ filename: att.filename, status: 'success', vendor: extractedData.vendorName, amount: extractedData.amount });
            } else {
              throw new Error(extraction.message);
            }
          } catch (err: any) {
            const errorMsg = err.message || String(err);
            logError(this.name, `Hiba a fájl feldolgozásakor (${att.filename}): ${errorMsg}`);
            
            updateInvoiceStatus(invoiceId, 'FAILED', errorMsg);
            eventBus.emit({
              source: this.name,
              type: 'invoice.failed',
              payload: { invoiceId, error: errorMsg }
            });

            // Hiba esetén megjelöljük a levelet egy speciális címkével
            try {
              await workspace.modifyEmail(messageId, { addLabelIds: ['Brunella-Manual-Check'] });
            } catch (labelErr) {
              logError(this.name, `Nem sikerült a hiba-címkézés: ${labelErr}`);
            }
            failedCount++;
            results.push({ filename: att.filename, status: 'failed', reason: errorMsg });
          }
        }
      }
    }

    return {
      success: true,
      message: `L5 Feldolgozás kész. Sikeres: ${processedCount}, Sikertelen: ${failedCount}, Kihagyott: ${skippedCount}.`,
      data: { results, processedCount, failedCount, skippedCount }
    };
  }

  private isInvoiceFile(filename: string): boolean {
    const ext = path.extname(filename).toLowerCase();
    return ['.pdf', '.jpg', '.jpeg', '.png'].includes(ext);
  }

  /**
   * PDF/Kép elemzése Gemini Vision-nel
   */
  private async processInvoiceFile(data: Buffer, filename: string): Promise<AgentResult> {
    logInfo(this.name, `Intelligens adatkivonás: ${filename}`);
    
    const gateway = getBifrostGateway();
    const prompt = `
      Te egy profi magyar számlafeldolgozó asszisztens vagy. 
      A feladatod, hogy a mellékelt számláról (kép vagy PDF) kinyerd a legfontosabb adatokat.
      
      Kérlek az alábbi JSON formátumban válaszolj:
      {
        "vendorName": "Cégnév vagy Partner neve",
        "invoiceNumber": "Számla sorszáma/azonosítója",
        "amount": 12345,
        "currency": "HUF",
        "date": "YYYY-MM-DD"
      }

      Szabályok:
      - Az "amount" mező csak szám legyen (ha van tizedes, ponttal válaszd el).
      - A "date" mező a számla keltét tartalmazza ISO formátumban.
      - Csak a nyers JSON-t add vissza, ne írj körítést!
      - Ha valamelyik adatot nem találod, írj "null"-t az értékhez.
    `;

    const response = await gateway.generate({
      prompt,
      taskType: 'general', // Bifrost most már támogatja a vision-t ezen belül ha van context.files
      provider: 'gemini',
      context: { 
        files: [{ 
          data: data.toString('base64'), 
          mimeType: this.getMimeType(filename) 
        }] 
      }
    });

    if (!response.success || !response.content) {
      return { success: false, message: `LLM hiba: ${response.error || 'Nincs válasz'}` };
    }

    try {
      const jsonStr = response.content.replace(/```json|```/g, '').trim();
      const extracted = JSON.parse(jsonStr) as ExtractedInvoice;
      
      // Minimális validáció
      if (!extracted.vendorName || extracted.vendorName === 'null') {
        return { success: false, message: 'Nem sikerült azonosítani a partnert.', data: extracted };
      }

      return {
        success: true,
        message: 'Adatok sikeresen kinyerve.',
        data: extracted
      };
    } catch (e) {
      logError(this.name, `JSON parse hiba: ${response.content}`);
      return { success: false, message: 'A modell válasza nem érvényes JSON.' };
    }
  }

  private getMimeType(filename: string): string {
    const ext = path.extname(filename).toLowerCase();
    if (ext === '.pdf') return 'application/pdf';
    if (ext === '.png') return 'image/png';
    return 'image/jpeg';
  }

  /**
   * Fájl mentése Drive-ra év/hónap szerint
   */
  private async saveToDrive(data: Buffer, filename: string, invoice: ExtractedInvoice): Promise<{ fileId: string; webViewLink: string }> {
    const workspace = await getWorkspaceClient();
    
    // Dátum kezelése
    const invDate = invoice.date && invoice.date !== 'null' ? new Date(invoice.date) : new Date();
    const year = invDate.getFullYear().toString();
    const month = (invDate.getMonth() + 1).toString().padStart(2, '0');
    const monthNames = ['Januar', 'Februar', 'Marcius', 'Aprilis', 'Majus', 'Junius', 'Julius', 'Augusztus', 'Szeptember', 'Oktober', 'November', 'December'];
    const monthLabel = `${month}_${monthNames[invDate.getMonth()]}`;

    logInfo(this.name, `Drive mentés: Invoice/${year}/${monthLabel}`);

    // 1. "Invoice" gyökérmappa
    let rootFolder = await workspace.findFolder('Invoice');
    if (!rootFolder) {
      rootFolder = await workspace.createFolder('Invoice');
    }

    // 2. Év mappa
    let yearFolder = await workspace.findFolder(year, rootFolder.id);
    if (!yearFolder) {
      yearFolder = await workspace.createFolder(year, rootFolder.id);
    }

    // 3. Hónap mappa
    let monthFolder = await workspace.findFolder(monthLabel, yearFolder.id);
    if (!monthFolder) {
      monthFolder = await workspace.createFolder(monthLabel, yearFolder.id);
    }

    // 4. Feltöltés egyedi névvel
    const cleanVendor = (invoice.vendorName || 'Ismeretlen').replace(/[^a-z0-9]/gi, '_');
    const cleanId = (invoice.invoiceNumber || 'NoID').replace(/[^a-z0-9]/gi, '_');
    const newFilename = `${invoice.date?.replace(/-/g, '') || '00000000'}_${cleanVendor}_${cleanId}${path.extname(filename)}`;
    
    return await workspace.uploadFileFromBuffer(data, newFilename, this.getMimeType(filename), monthFolder.id);
  }

  /**
   * Adatok rögzítése Sheets-be
   */
  private async logToSheets(invoice: ExtractedInvoice, driveLink: string): Promise<void> {
    const workspace = await getWorkspaceClient();
    const spreadsheetId = process.env.INVOICE_SPREADSHEET_ID;

    if (!spreadsheetId) {
      logWarn(this.name, 'INVOICE_SPREADSHEET_ID hiányzik, a Sheets rögzítés kimarad.');
      return;
    }

    logInfo(this.name, `Sheets rögzítés: ${invoice.vendorName} - ${invoice.amount} ${invoice.currency}`);

    const row = [
      invoice.date || '',
      invoice.vendorName || '',
      invoice.invoiceNumber || '',
      invoice.amount || 0,
      invoice.currency || 'HUF',
      driveLink,
      new Date().toISOString()
    ];

    await workspace.performSheetOperation({
      operation: 'append',
      spreadsheetId,
      range: 'Sheet1!A:G', // Feltételezzük, hogy az első fül neve Sheet1
      values: [row]
    });
  }
}

function logWarn(agent: string, msg: string) {
  console.warn(`[${agent}] WARN: ${msg}`);
}

export default InvoiceAutomationAgent;
