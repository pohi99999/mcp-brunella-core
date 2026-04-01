import { IAgent, AgentResponse } from './types.js';
import { logInfo, logError, setAgentStatus } from '../utils/logger.js';
import fs from 'fs/promises';
import path from 'path';

export class OCRAgent implements IAgent {
    name = 'OCRAgent';
    role = 'Invoice Data Extractor';
    description = 'Extracts structured data (partner, amounts, dates) from invoice PDFs using OCR and Vision LLM.';
    capabilities = ['ocr_extraction', 'vision_analysis', 'invoice_parsing'];

    private extractedDir = 'data/extracted';

    async execute(task: string, context?: Record<string, unknown>): Promise<AgentResponse> {
        setAgentStatus(this.name, 'working', task.slice(0, 50));
        try {
            if (task.includes('extract') || task.includes('ocr')) {
                const pdfPath = (context?.pdfPath as string) || '';
                if (!pdfPath) {
                    return { status: 'error', error: 'Missing pdfPath in context' };
                }
                const result = await this.extractInvoiceData(pdfPath);
                return {
                    status: 'success',
                    message: `Extracted data from ${path.basename(pdfPath)}.`,
                    data: result
                };
            }

            return {
                status: 'error',
                error: 'Unsupported task for OCRAgent'
            };
        } catch (e: unknown) {
            const error = e instanceof Error ? e.message : String(e);
            logError(this.name, error);
            return { status: 'error', error };
        } finally {
            setAgentStatus(this.name, 'idle');
        }
    }

    private async extractInvoiceData(pdfPath: string) {
        logInfo(this.name, `Performing OCR on ${pdfPath} (MOCKED)...`);
        
        // Simulating extraction logic (e.g. Gemini Vision API call would be here)
        const extractedData = {
            id: 'INV-2026-0001',
            partner: {
                name: 'Kovács Kft.',
                taxId: '12345678-2-12'
            },
            amounts: {
                net: 40000,
                vat: 10800,
                gross: 50800
            },
            currency: 'HUF',
            issueDate: '2026-03-01',
            dueDate: '2026-03-15',
            paymentMethod: 'bank_transfer',
            confidence: 0.95
        };

        const fileName = path.basename(pdfPath, '.pdf') + '.json';
        const outputPath = path.join(this.extractedDir, fileName);

        // Ensure directory exists
        await fs.mkdir(this.extractedDir, { recursive: true });

        try {
            await fs.writeFile(outputPath, JSON.stringify(extractedData, null, 2));
            logInfo(this.name, `Saved extracted data to ${outputPath}`);
        } catch (err) {
            logError(this.name, `Failed to save extracted data: ${err}`);
        }

        return extractedData;
    }
}
