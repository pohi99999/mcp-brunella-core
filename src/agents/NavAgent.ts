import { IAgent, AgentResponse } from './types.js';
import { logInfo, logError, setAgentStatus } from '../utils/logger.js';
import fs from 'fs/promises';
import path from 'path';

export class NavAgent implements IAgent {
    name = 'NavAgent';
    role = 'NAV Compliance Specialist';
    description = 'Fetches invoice data from NAV Online Számla API and normalizes it to JSON.';
    capabilities = ['nav_api_integration', 'xml_parsing', 'data_normalization'];

    private navDir = 'data/nav';

    async execute(task: string, context?: Record<string, unknown>): Promise<AgentResponse> {
        setAgentStatus(this.name, 'working', task.slice(0, 50));
        try {
            if (task.includes('fetch') || task.includes('query')) {
                const result = await this.queryNavApi();
                return {
                    status: 'success',
                    message: `Fetched ${result.count} invoices from NAV.`,
                    data: result
                };
            }

            return {
                status: 'error',
                error: 'Unsupported task for NavAgent'
            };
        } catch (e: unknown) {
            const error = e instanceof Error ? e.message : String(e);
            logError(this.name, error);
            return { status: 'error', error };
        } finally {
            setAgentStatus(this.name, 'idle');
        }
    }

    private async queryNavApi() {
        logInfo(this.name, 'Querying NAV Online Számla API (MOCKED)...');
        
        // Simulating one fetched invoice from NAV
        const mockNavData = {
            invoiceNumber: 'INV-2026-0001',
            supplierName: 'Kovács Kft.',
            supplierTaxNumber: '12345678-2-12',
            issueDate: '2026-03-01',
            netAmount: 40000,
            vatAmount: 10800,
            grossAmount: 50800,
            currency: 'HUF'
        };

        const normalizedJson = {
            id: mockNavData.invoiceNumber,
            source: 'nav',
            partner: {
                name: mockNavData.supplierName,
                taxId: mockNavData.supplierTaxNumber
            },
            amounts: {
                net: mockNavData.netAmount,
                vat: mockNavData.vatAmount,
                gross: mockNavData.grossAmount
            },
            currency: mockNavData.currency,
            issueDate: mockNavData.issueDate,
            rawXmlPath: path.join(this.navDir, `${mockNavData.invoiceNumber}.xml`)
        };

        const filePath = path.join(this.navDir, `${mockNavData.invoiceNumber}.json`);

        // Ensure directory exists
        await fs.mkdir(this.navDir, { recursive: true });

        try {
            await fs.writeFile(filePath, JSON.stringify(normalizedJson, null, 2));
            logInfo(this.name, `Saved normalized NAV data to ${filePath}`);
        } catch (err) {
            logError(this.name, `Failed to save NAV data: ${err}`);
        }

        return {
            count: 1,
            invoices: [normalizedJson]
        };
    }
}
