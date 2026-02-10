/**
 * Cloudflare Browser Rendering API
 * Sprint 3: Domain-free screenshots & PDF generation
 * 
 * @see https://developers.cloudflare.com/browser-rendering/
 * @author Copilot Agent, Sprint 3 implementation
 */

import { logInfo, logError } from './logger.js';

interface BrowserRenderingOptions {
    url: string;
    viewport?: {
        width: number;
        height: number;
    };
    format?: 'png' | 'jpeg' | 'pdf';
    quality?: number; // 1-100 (JPEG only)
    fullPage?: boolean;
    waitFor?: string | number; // CSS selector or timeout in ms
}

interface BrowserRenderingResponse {
    success: boolean;
    data?: Buffer;
    mimeType?: string;
    size?: number;
    error?: string;
    executionTime?: number;
}

export class CloudflareBrowserAPI {
    private apiToken: string;
    private accountId: string;
    private baseUrl: string;

    constructor() {
        this.apiToken = process.env.CF_API_TOKEN || '';
        this.accountId = process.env.CLOUDFLARE_ACCOUNT_ID || '';
        this.baseUrl = `https://api.cloudflare.com/client/v4/accounts/${this.accountId}/browser`;

        if (!this.apiToken) {
            throw new Error('CF_API_TOKEN environment variable is required');
        }
        if (!this.accountId) {
            throw new Error('CLOUDFLARE_ACCOUNT_ID environment variable is required');
        }

        logInfo('CF Browser API', `Initialized with account ID: ${this.accountId}`);
    }

    /**
     * Take a screenshot of a webpage
     */
    async screenshot(options: BrowserRenderingOptions): Promise<BrowserRenderingResponse> {
        const startTime = Date.now();

        try {
            logInfo('CF Browser API', `Taking screenshot: ${options.url} (${options.format})`);

            const payload = {
                url: options.url,
                viewport: options.viewport || { width: 1280, height: 720 },
                format: options.format || 'png',
                ...(options.quality && { quality: options.quality }),
                ...(options.fullPage && { fullPage: options.fullPage }),
                ...(options.waitFor && { waitFor: options.waitFor })
            };

            const response = await fetch(`${this.baseUrl}/screenshot`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.apiToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                const error = errorData.errors?.[0]?.message || `HTTP ${response.status}`;
                throw new Error(`CF Browser API error: ${error}`);
            }

            const data = await response.arrayBuffer();
            const executionTime = Date.now() - startTime;

            logInfo('CF Browser API', `Screenshot success: ${data.byteLength} bytes, ${executionTime}ms, format: ${options.format}`);

            return {
                success: true,
                data: Buffer.from(data),
                mimeType: this.getMimeType(options.format || 'png'),
                size: data.byteLength,
                executionTime
            };

        } catch (error: any) {
            logError('CF Browser API', `Screenshot failed: ${error.message} (URL: ${options.url})`);

            return {
                success: false,
                error: error.message,
                executionTime: Date.now() - startTime
            };
        }
    }

    /**
     * Generate PDF of a webpage
     */
    async generatePDF(options: Omit<BrowserRenderingOptions, 'format'>): Promise<BrowserRenderingResponse> {
        return this.screenshot({
            ...options,
            format: 'pdf'
        });
    }

    /**
     * Take a simple screenshot with defaults
     */
    async quickScreenshot(url: string, format: 'png' | 'jpeg' | 'pdf' = 'png'): Promise<BrowserRenderingResponse> {
        return this.screenshot({ url, format });
    }

    /**
     * Domain-free internal screenshots (localhost, IPs, etc.)
     */
    async screenshotInternal(url: string, format: 'png' | 'jpeg' | 'pdf' = 'png'): Promise<BrowserRenderingResponse> {
        // CF Browser Rendering works with any URL, including localhost/IPs
        logInfo('CF Browser API', `Internal screenshot (domain-free): ${url} (${format})`);

        return this.screenshot({
            url,
            format,
            viewport: { width: 1920, height: 1080 },
            waitFor: 2000 // 2s wait for internal services to load
        });
    }

    private getMimeType(format: string): string {
        switch (format) {
            case 'png': return 'image/png';
            case 'jpeg': return 'image/jpeg';
            case 'pdf': return 'application/pdf';
            default: return 'application/octet-stream';
        }
    }

    /**
     * Test CF Browser API connectivity
     */
    async testConnection(): Promise<boolean> {
        try {
            logInfo('CF Browser API', 'Testing connectivity...');

            const result = await this.quickScreenshot('https://example.com');

            if (result.success) {
                logInfo('CF Browser API', `Connection test successful: ${result.size} bytes`);
                return true;
            } else {
                logError('CF Browser API', `Connection test failed: ${result.error}`);
                return false;
            }
        } catch (error: any) {
            logError('CF Browser API', `Connection test exception: ${error.message}`);
            return false;
        }
    }
}

// Singleton export
export const cfBrowserAPI = new CloudflareBrowserAPI();