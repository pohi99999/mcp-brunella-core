import { IAgent, AgentResponse } from './types.js';
import { logInfo, logError, setAgentStatus } from '../utils/logger.js';
import fs from 'fs/promises';
import path from 'path';

export class EmailAgent implements IAgent {
    name = 'EmailAgent';
    role = 'Invoice Intake Specialist';
    description = 'Monitors email and GDrive for new invoice PDFs, downloads them and assigns unique identifiers.';
    capabilities = ['email_watching', 'file_management', 'naming_convention'];

    private invoiceDir = 'data/invoices';

    async execute(task: string, context?: Record<string, unknown>): Promise<AgentResponse> {
        setAgentStatus(this.name, 'working', task.slice(0, 50));
        try {
            if (task.includes('fetch') || task.includes('process')) {
                const result = await this.processNewInvoices();
                return {
                    status: 'success',
                    message: `Processed ${result.count} new invoices.`,
                    data: result
                };
            }

            return {
                status: 'error',
                error: 'Unsupported task for EmailAgent'
            };
        } catch (e: unknown) {
            const error = e instanceof Error ? e.message : String(e);
            logError(this.name, error);
            return { status: 'error', error };
        } finally {
            setAgentStatus(this.name, 'idle');
        }
    }

    private async processNewInvoices() {
        logInfo(this.name, 'Checking for new invoices (MOCKED)...');
        
        // Simulating finding one new invoice
        const mockInvoice = {
            partner: 'TestKft',
            date: '2026-04-01',
            amount: '12500',
            originalName: 'invoice_123.pdf'
        };

        const fileName = `${mockInvoice.partner}_${mockInvoice.date}_${mockInvoice.amount}.pdf`;
        const filePath = path.join(this.invoiceDir, fileName);

        // Ensure directory exists
        await fs.mkdir(this.invoiceDir, { recursive: true });

        // In a real scenario, we would download the attachment here.
        // For prototype, we create a placeholder if it doesn't exist.
        try {
            await fs.writeFile(filePath, 'MOCK PDF CONTENT');
            logInfo(this.name, `Saved invoice to ${filePath}`);
        } catch (err) {
            logError(this.name, `Failed to save invoice: ${err}`);
        }

        const invoice = {
            id: `INV-${Date.now()}`,
            path: filePath,
            partner: mockInvoice.partner,
            date: mockInvoice.date,
            amount: mockInvoice.amount
        };

        return {
            count: 1,
            invoice,
            invoices: [invoice]
        };
    }
}
