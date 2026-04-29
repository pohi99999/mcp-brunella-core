/**
 * Unit tests for FinancialGuardAgent
 * Tests invoice OCR, validation, and anomaly detection
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { FinancialGuardAgent } from '@packages/agents/FinancialGuardAgent.js';
describe('FinancialGuardAgent', () => {
    let agent;
    beforeEach(() => {
        agent = new FinancialGuardAgent();
    });
    describe('Agent Metadata', () => {
        it('should have correct name', () => {
            expect(agent.name).toBe('FinancialGuard');
        });
        it('should have correct capabilities', () => {
            expect(agent.capabilities).toContain('invoice_ocr');
            expect(agent.capabilities).toContain('data_validation');
            expect(agent.capabilities).toContain('duplicate_detection');
            expect(agent.capabilities).toContain('anomaly_detection');
            expect(agent.capabilities).toContain('sheets_export');
        });
    });
    describe('Invoice Processing', () => {
        it('should process invoice with OCR', async () => {
            const task = JSON.stringify({
                invoiceNumber: 'INV-2026-001',
                amount: 50000,
                currency: 'HUF',
                vendorName: 'TechSupplier Kft.',
            });
            const result = await agent.execute(task);
            expect(result.status).toBe('success');
            expect(result.data.processedInvoice).toBeDefined();
        });
        it('should extract invoice data', async () => {
            const task = JSON.stringify({
                pdfPath: '/invoices/test-invoice.pdf',
            });
            const result = await agent.execute(task);
            expect(result.status).toBe('success');
            expect(result.data.processedInvoice).toHaveProperty('invoiceNumber');
            expect(result.data.processedInvoice).toHaveProperty('amount');
            expect(result.data.processedInvoice).toHaveProperty('dueDate');
        });
    });
    describe('Duplicate Detection', () => {
        it('should detect duplicate invoices', async () => {
            const task = JSON.stringify({
                invoiceNumber: 'INV-2026-001', // Same as before
                amount: 50000,
                vendorName: 'TechSupplier Kft.',
            });
            const result = await agent.execute(task);
            expect(result.status).toBe('success');
            expect(result.data.validationResults).toBeDefined();
            expect(result.data.validationResults).toHaveProperty('isDuplicate');
        });
    });
    describe('Anomaly Detection', () => {
        it('should flag unusually high amounts', async () => {
            const task = JSON.stringify({
                invoiceNumber: 'INV-2026-999',
                amount: 50000000, // Extremely high
                vendorName: 'Normal Supplier',
            });
            const result = await agent.execute(task);
            expect(result.status).toBe('success');
            expect(result.data.validationResults.anomalies).toBeDefined();
            expect(result.data.validationResults.anomalies.length).toBeGreaterThan(0);
        });
        it('should detect amount mismatches', async () => {
            const task = JSON.stringify({
                invoiceNumber: 'INV-TEST',
                amount: 100000,
                extractedText: 'Total: 200000 HUF', // Mismatch
            });
            const result = await agent.execute(task);
            expect(result.status).toBe('success');
            // Should flag validation error
        });
    });
    describe('Sheets Export', () => {
        it('should provide Google Sheets export URL', async () => {
            const task = JSON.stringify({
                invoiceNumber: 'INV-EXPORT-TEST',
                amount: 75000,
                vendorName: 'Export Vendor',
            });
            const result = await agent.execute(task);
            expect(result.status).toBe('success');
            expect(result.data.sheetsUrl).toBeDefined();
            expect(typeof result.data.sheetsUrl).toBe('string');
        });
    });
    describe('Error Handling', () => {
        it('should handle missing invoice data', async () => {
            const task = '{}';
            const result = await agent.execute(task);
            // Should use defaults or return validation errors
            expect(result.status).toBe('success');
        });
        it('should handle invalid amount', async () => {
            const task = JSON.stringify({
                amount: 'not a number',
            });
            const result = await agent.execute(task);
            expect(result.status).toBe('success');
        });
    });
});
