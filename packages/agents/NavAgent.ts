import { IAgent, AgentResponse } from './types.js';
import { logInfo, logError, logWarn, setAgentStatus } from '@packages/utils/logger.js';
import fs from 'fs/promises';
import path from 'path';
import { NavClient } from '@packages/utils/navClient.js';
import { calculatePasswordHash } from '@packages/utils/navSigner.js';
import { NavUserConfig } from '@packages/utils/navRequestBuilder.js';

type NavContext = Record<string, unknown>;

type NormalizedNavInvoice = {
    invoiceNumber: string;
    supplierName: string;
    supplierTaxNumber?: string;
    issueDate?: string;
    netAmount?: number;
    vatAmount?: number;
    grossAmount?: number;
    currency: string;
};

type NavValidationRecord = {
    invoice: NormalizedNavInvoice;
    navStatus: 'OK' | 'MISMATCH' | 'LOCAL_ONLY' | 'API_ERROR';
    discrepancies: string[];
    validatedAt: string;
};

export class NavAgent implements IAgent {
    name = 'NavAgent';
    role = 'NAV Compliance Specialist';
    description = 'Fetches invoice data from NAV Online Számla API and normalizes it to JSON.';
    capabilities = ['nav_api_integration', 'xml_parsing', 'data_normalization'];

    private navDir = 'data/nav';
    private client: NavClient | null = null;

    private async getClient(): Promise<NavClient | null> {
        if (this.client) return this.client;

        const config: NavUserConfig = {
            username: process.env.NAV_USERNAME || '',
            passwordHash: calculatePasswordHash(process.env.NAV_PASSWORD || ''),
            taxNumber: process.env.NAV_TAX_NUMBER || process.env.SZAMLAZZ_HU_TAX_NUMBER || '',
            signatureKey: process.env.NAV_SIGNING_KEY || '',
        };

        if (!config.username || !process.env.NAV_PASSWORD || !config.signatureKey) {
            logWarn(this.name, 'NAV API credentials missing in .env. Falling back to MOCK mode.');
            return null;
        }

        const isTest = process.env.NAV_BASE_URL?.includes('test') ?? true;
        this.client = new NavClient(config, isTest);
        return this.client;
    }

    async execute(task: string, context?: Record<string, unknown>): Promise<AgentResponse> {
        setAgentStatus(this.name, 'working', task.slice(0, 50));

        try {
            const normalizedTask = task.toLowerCase();
            const client = await this.getClient();

            if (this.shouldFetch(normalizedTask)) {
                if (!client) return await this.queryNavApiMock();
                
                const invoiceNumber = this.asString(context?.invoiceNumber || context?.id);
                if (!invoiceNumber) throw new Error('Invoice number is required for NAV fetch.');
                
                const navData = await client.queryInvoiceData(invoiceNumber);
                return await this.processNavResponse(navData);
            }

            if (this.shouldValidate(normalizedTask, context)) {
                return await this.validateNavData(context);
            }

            return {
                status: 'error',
                error: 'Unsupported task for NavAgent',
            };
        } catch (e: unknown) {
            const error = e instanceof Error ? e.message : String(e);
            logError(this.name, error);
            return { status: 'error', error };
        } finally {
            setAgentStatus(this.name, 'idle');
        }
    }

    private shouldFetch(task: string): boolean {
        return task.includes('fetch') || task.includes('query');
    }

    private shouldValidate(task: string, context?: Record<string, unknown>): boolean {
        return task.includes('validate') || this.extractInvoice(context) !== null;
    }

    private async processNavResponse(navData: any): Promise<AgentResponse> {
        // Extraction logic based on v3.0 XML structure
        const invoiceData = navData?.invoiceData;
        if (!invoiceData) {
            return { status: 'error', error: 'No invoice data found in NAV response.' };
        }

        const normalizedJson = {
            id: invoiceData.invoiceNumber,
            source: 'nav',
            partner: {
                name: invoiceData.supplierName,
                taxId: invoiceData.supplierTaxNumber,
            },
            amounts: {
                net: invoiceData.netAmount,
                vat: invoiceData.vatAmount,
                gross: invoiceData.grossAmount,
            },
            currency: invoiceData.currency || 'HUF',
            issueDate: invoiceData.issueDate,
            navStatus: 'OK',
        };

        return {
            status: 'success',
            success: true,
            message: `Successfully fetched invoice ${normalizedJson.id} from NAV API.`,
            data: normalizedJson,
        };
    }

    private async queryNavApiMock(): Promise<AgentResponse> {
        logInfo(this.name, 'Querying NAV Online Számla API (MOCKED)...');

        const mockNavData = {
            invoiceNumber: 'INV-2026-0001',
            supplierName: 'Kovács Kft.',
            supplierTaxNumber: '12345678-2-12',
            issueDate: '2026-03-01',
            netAmount: 40000,
            vatAmount: 10800,
            grossAmount: 50800,
            currency: 'HUF',
        };

        const normalizedJson = {
            id: mockNavData.invoiceNumber,
            source: 'nav',
            partner: {
                name: mockNavData.supplierName,
                taxId: mockNavData.supplierTaxNumber,
            },
            amounts: {
                net: mockNavData.netAmount,
                vat: mockNavData.vatAmount,
                gross: mockNavData.grossAmount,
            },
            currency: mockNavData.currency,
            issueDate: mockNavData.issueDate,
            navStatus: 'OK',
        };

        return {
            status: 'success',
            success: true,
            message: `Fetched ${1} invoices from NAV (MOCK).`,
            data: {
                count: 1,
                invoices: [normalizedJson],
            },
        };
    }

    private async validateNavData(context?: Record<string, unknown>): Promise<AgentResponse> {
        const invoiceRecord = this.extractInvoice(context);
        if (!invoiceRecord) {
            return {
                status: 'error',
                success: false,
                message: 'Missing invoice data for NAV validation.',
            };
        }

        const invoice = this.normalizeInvoice(invoiceRecord);
        const discrepancies = this.collectLocalDiscrepancies(invoice);
        const navData = this.extractNavData(context);

        if (navData) {
            discrepancies.push(...this.compareAgainstNavData(invoice, navData));
        }

        const navStatus: NavValidationRecord['navStatus'] = navData
            ? discrepancies.length > 0
                ? 'MISMATCH'
                : 'OK'
            : 'LOCAL_ONLY';

        const validation: NavValidationRecord = {
            invoice,
            navStatus,
            discrepancies,
            validatedAt: new Date().toISOString(),
        };

        await this.persistValidation(validation);

        const success = discrepancies.length === 0;
        return {
            status: success ? 'success' : 'error',
            success,
            message: success
                ? navData
                    ? 'NAV validation completed successfully.'
                    : 'NAV validation completed locally.'
                : `NAV validation found ${discrepancies.length} discrepancy(s).`,
            data: {
                invoice: validation.invoice,
                nav_status: validation.navStatus,
                discrepancies: validation.discrepancies,
                validatedAt: validation.validatedAt,
            },
        };
    }

    private extractInvoice(context?: Record<string, unknown>): Record<string, unknown> | null {
        const candidates = [
            context,
            this.asRecord(context?.payload),
            this.asRecord(context?.context),
        ];

        for (const candidate of candidates) {
            if (!candidate) {
                continue;
            }

            const invoice = this.asRecord(
                candidate.invoice ??
                candidate.invoiceData ??
                candidate.navInvoice ??
                candidate.data,
            );

            if (invoice) {
                return invoice;
            }

            if (
                this.hasInvoiceShape(candidate) &&
                typeof candidate.invoiceNumber !== 'undefined'
            ) {
                return candidate;
            }
        }

        return null;
    }

    private extractNavData(context?: Record<string, unknown>): Record<string, unknown> | null {
        const candidates = [
            context,
            this.asRecord(context?.payload),
            this.asRecord(context?.context),
        ];

        for (const candidate of candidates) {
            if (!candidate) {
                continue;
            }

            const navData = this.asRecord(candidate.navData ?? candidate.navResponse ?? candidate.navResult);
            if (navData) {
                return navData;
            }
        }

        return null;
    }

    private normalizeInvoice(invoice: Record<string, unknown>): NormalizedNavInvoice {
        const invoiceNumber = this.asString(
            invoice.invoiceNumber ?? invoice.invoice_no ?? invoice.id ?? invoice.number,
        ) ?? 'UNKNOWN';

        const supplierName = this.asString(
            invoice.supplierName ?? invoice.partnerName ?? invoice.partner ?? invoice.customerName,
        ) ?? 'Unknown partner';

        return {
            invoiceNumber,
            supplierName,
            supplierTaxNumber: this.asString(
                invoice.supplierTaxNumber ?? invoice.taxNumber ?? invoice.taxId,
            ),
            issueDate: this.asString(invoice.issueDate ?? invoice.date),
            netAmount: this.asNumber(invoice.netAmount ?? invoice.net ?? invoice.amount),
            vatAmount: this.asNumber(invoice.vatAmount ?? invoice.vat),
            grossAmount: this.asNumber(invoice.grossAmount ?? invoice.gross ?? invoice.amount),
            currency: this.asString(invoice.currency) ?? 'HUF',
        };
    }

    private collectLocalDiscrepancies(invoice: NormalizedNavInvoice): string[] {
        const discrepancies: string[] = [];

        if (invoice.invoiceNumber === 'UNKNOWN') {
            discrepancies.push('Missing invoice number.');
        }

        if (invoice.supplierName === 'Unknown partner') {
            discrepancies.push('Missing supplier/partner name.');
        }

        if (typeof invoice.grossAmount !== 'number' && typeof invoice.netAmount !== 'number') {
            discrepancies.push('Missing invoice amount.');
        }

        return discrepancies;
    }

    private compareAgainstNavData(invoice: NormalizedNavInvoice, navData: Record<string, unknown>): string[] {
        const discrepancies: string[] = [];
        const expectedInvoiceNumber = this.asString(navData.invoiceNumber ?? navData.number ?? navData.id);
        const expectedPartner = this.asString(navData.supplierName ?? navData.partnerName ?? navData.partner);
        const expectedAmount = this.asNumber(navData.grossAmount ?? navData.amount ?? navData.total);
        const expectedCurrency = this.asString(navData.currency);
        const expectedIssueDate = this.asString(navData.issueDate ?? navData.date);

        if (expectedInvoiceNumber && expectedInvoiceNumber !== invoice.invoiceNumber) {
            discrepancies.push(`Invoice number mismatch: expected ${expectedInvoiceNumber}, got ${invoice.invoiceNumber}.`);
        }

        if (expectedPartner && expectedPartner !== invoice.supplierName) {
            discrepancies.push(`Partner mismatch: expected ${expectedPartner}, got ${invoice.supplierName}.`);
        }

        if (typeof expectedAmount === 'number' && typeof invoice.grossAmount === 'number' && expectedAmount !== invoice.grossAmount) {
            discrepancies.push(`Amount mismatch: expected ${expectedAmount}, got ${invoice.grossAmount}.`);
        }

        if (expectedCurrency && expectedCurrency !== invoice.currency) {
            discrepancies.push(`Currency mismatch: expected ${expectedCurrency}, got ${invoice.currency}.`);
        }

        if (expectedIssueDate && expectedIssueDate !== invoice.issueDate) {
            discrepancies.push(`Issue date mismatch: expected ${expectedIssueDate}, got ${invoice.issueDate ?? 'missing'}.`);
        }

        return discrepancies;
    }

    private async persistValidation(validation: NavValidationRecord): Promise<void> {
        await fs.mkdir(this.navDir, { recursive: true });
        const safeInvoiceNumber = this.sanitizeFileName(validation.invoice.invoiceNumber);
        const fileName = `${safeInvoiceNumber || 'nav-validation'}.json`;
        const filePath = path.join(this.navDir, fileName);
        await fs.writeFile(filePath, JSON.stringify(validation, null, 2));
        logInfo(this.name, `Saved NAV validation result to ${filePath}`);
    }

    private hasInvoiceShape(value: Record<string, unknown>): boolean {
        return Boolean(
            value.invoiceNumber ||
            value.invoice_no ||
            value.partnerName ||
            value.partner ||
            value.supplierName ||
            value.amount,
        );
    }

    private asRecord(value: unknown): Record<string, unknown> | null {
        if (typeof value !== 'object' || value === null || Array.isArray(value)) {
            return null;
        }

        return value as Record<string, unknown>;
    }

    private asString(value: unknown): string | undefined {
        if (typeof value === 'string') {
            const trimmed = value.trim();
            return trimmed.length > 0 ? trimmed : undefined;
        }

        if (typeof value === 'number' && Number.isFinite(value)) {
            return String(value);
        }

        return undefined;
    }

    private asNumber(value: unknown): number | undefined {
        if (typeof value === 'number' && Number.isFinite(value)) {
            return value;
        }

        if (typeof value === 'string' && value.trim().length > 0) {
            const parsed = Number(value);
            return Number.isFinite(parsed) ? parsed : undefined;
        }

        return undefined;
    }

    private sanitizeFileName(value: string): string {
        return value
            .trim()
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '_')
            .replace(/^_+|_+$/g, '');
    }
}

