/**
 * Cloudflare Browser Rendering REST API Client
 * Full 8-endpoint implementation based on official CF docs (2026-02-10)
 * 
 * Endpoints: /content, /screenshot, /pdf, /markdown, /snapshot, /scrape, /json, /links
 * Base URL: https://api.cloudflare.com/client/v4/accounts/{accountId}/browser-rendering/{endpoint}
 * Auth: Bearer token with "Browser Rendering - Edit" permission
 * 
 * @see https://developers.cloudflare.com/browser-rendering/rest-api/
 */

import { logInfo, logError } from './logger.js';

// ─── Common Types ────────────────────────────────────────────────────────────

/** Shared goto options (Puppeteer API compatible) */
export interface GotoOptions {
    waitUntil?: 'load' | 'domcontentloaded' | 'networkidle0' | 'networkidle2';
    timeout?: number;
}

/** Viewport configuration */
export interface Viewport {
    width: number;
    height: number;
    deviceScaleFactor?: number;
}

/** Cookie for authenticated pages */
export interface BrowserCookie {
    name: string;
    value: string;
    domain: string;
    path?: string;
}

/** Injected script/style tags */
export interface ScriptTag { content?: string; url?: string }
export interface StyleTag { content?: string; url?: string }

/** Common request fields shared across all endpoints */
export interface CommonRequestFields {
    url?: string;
    html?: string;
    gotoOptions?: GotoOptions;
    viewport?: Viewport;
    cookies?: BrowserCookie[];
    addScriptTag?: ScriptTag[];
    addStyleTag?: StyleTag[];
    userAgent?: string;
    setExtraHTTPHeaders?: Record<string, string>;
    rejectResourceTypes?: string[];
    rejectRequestPattern?: string[];
    allowResourceTypes?: string[];
    allowRequestPattern?: string[];
    waitForSelector?: string;
    authenticate?: { username: string; password: string };
}

// ─── Screenshot Types ────────────────────────────────────────────────────────

export interface ScreenshotOptions {
    fullPage?: boolean;
    omitBackground?: boolean;
    type?: 'png' | 'jpeg';
    quality?: number;       // 1-100 (jpeg only)
    clip?: { x: number; y: number; width: number; height: number };
    captureBeyondViewport?: boolean;
}

export interface ScreenshotRequest extends CommonRequestFields {
    screenshotOptions?: ScreenshotOptions;
    selector?: string;
}

// ─── PDF Types ───────────────────────────────────────────────────────────────

export interface PdfOptions {
    format?: 'a0' | 'a1' | 'a2' | 'a3' | 'a4' | 'a5' | 'a6' | 'letter' | 'legal' | 'tabloid' | 'ledger';
    landscape?: boolean;
    printBackground?: boolean;
    scale?: number;
    displayHeaderFooter?: boolean;
    headerTemplate?: string;
    footerTemplate?: string;
    margin?: { top?: string; bottom?: string; left?: string; right?: string };
    preferCSSPageSize?: boolean;
    timeout?: number;
}

export interface PdfRequest extends CommonRequestFields {
    pdfOptions?: PdfOptions;
}

// ─── Scrape Types ────────────────────────────────────────────────────────────

export interface ScrapeElement {
    selector: string;
}

export interface ScrapeRequest extends CommonRequestFields {
    elements: ScrapeElement[];
}

export interface ScrapedItem {
    text: string;
    html: string;
    attributes: Array<{ name: string; value: string }>;
    height: number;
    width: number;
    top: number;
    left: number;
}

export interface ScrapeResult {
    selector: string;
    results: ScrapedItem[];
}

// ─── JSON (AI-powered structured extraction) ─────────────────────────────────

export interface JsonRequest extends CommonRequestFields {
    prompt: string;
    schema?: Record<string, unknown>;
}

// ─── API Response Wrappers ───────────────────────────────────────────────────

export interface BinaryResponse {
    success: boolean;
    data?: Buffer;
    mimeType?: string;
    size?: number;
    browserMs?: number;
    error?: string;
    executionTime?: number;
}

export interface JsonApiResponse<T = unknown> {
    success: boolean;
    result?: T;
    browserMs?: number;
    error?: string;
    executionTime?: number;
}

// ─── Main Client ─────────────────────────────────────────────────────────────

export class CloudflareBrowserAPI {
    private apiToken: string;
    private accountId: string;
    private baseUrl: string;

    constructor(apiToken?: string, accountId?: string) {
        this.apiToken = apiToken || process.env.CF_API_TOKEN || process.env.CLOUDFLARE_API_TOKEN || '';
        this.accountId = accountId || process.env.CLOUDFLARE_ACCOUNT_ID || '';
        this.baseUrl = `https://api.cloudflare.com/client/v4/accounts/${this.accountId}/browser-rendering`;

        if (!this.apiToken) {
            throw new Error('CF_API_TOKEN or CLOUDFLARE_API_TOKEN environment variable is required');
        }
        if (!this.accountId) {
            throw new Error('CLOUDFLARE_ACCOUNT_ID environment variable is required');
        }

        logInfo('CF Browser API', `Initialized (account: ${this.accountId.slice(0, 8)}...)`);
    }

    // ─── Core HTTP helpers ───────────────────────────────────────────────────

    private get headers(): Record<string, string> {
        return {
            'Authorization': `Bearer ${this.apiToken}`,
            'Content-Type': 'application/json'
        };
    }

    /** POST that returns binary data (screenshot / pdf) */
    private async postBinary(endpoint: string, body: Record<string, unknown>): Promise<BinaryResponse> {
        const startTime = Date.now();
        try {
            const res = await fetch(`${this.baseUrl}/${endpoint}`, {
                method: 'POST',
                headers: this.headers,
                body: JSON.stringify(body)
            });
            const browserMs = parseInt(res.headers.get('X-Browser-Ms-Used') || '0', 10);

            if (!res.ok) {
                const errJson = await res.json().catch(() => ({} as Record<string, unknown>));
                const msg = (errJson as Record<string, unknown[]>).errors?.[0]
                    ? ((errJson as Record<string, unknown[]>).errors[0] as Record<string, string>).message
                    : `HTTP ${res.status}`;
                throw new Error(msg);
            }

            const buf = await res.arrayBuffer();
            return {
                success: true,
                data: Buffer.from(buf),
                size: buf.byteLength,
                browserMs,
                executionTime: Date.now() - startTime
            };
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : String(err);
            return { success: false, error: message, executionTime: Date.now() - startTime };
        }
    }

    /** POST that returns JSON data (content, scrape, json, links, markdown, snapshot) */
    private async postJson<T = unknown>(endpoint: string, body: Record<string, unknown>): Promise<JsonApiResponse<T>> {
        const startTime = Date.now();
        try {
            const res = await fetch(`${this.baseUrl}/${endpoint}`, {
                method: 'POST',
                headers: this.headers,
                body: JSON.stringify(body)
            });
            const browserMs = parseInt(res.headers.get('X-Browser-Ms-Used') || '0', 10);

            if (!res.ok) {
                const errJson = await res.json().catch(() => ({} as Record<string, unknown>));
                const msg = (errJson as Record<string, unknown[]>).errors?.[0]
                    ? ((errJson as Record<string, unknown[]>).errors[0] as Record<string, string>).message
                    : `HTTP ${res.status}`;
                throw new Error(msg);
            }

            const json = await res.json() as T;
            return { success: true, result: json, browserMs, executionTime: Date.now() - startTime };
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : String(err);
            return { success: false, error: message, executionTime: Date.now() - startTime };
        }
    }

    // ─── 1. /screenshot ──────────────────────────────────────────────────────

    /**
     * Capture a screenshot of a URL or raw HTML.
     * Returns binary PNG/JPEG data.
     * @see https://developers.cloudflare.com/browser-rendering/rest-api/screenshot-endpoint/
     */
    async screenshot(req: ScreenshotRequest): Promise<BinaryResponse> {
        logInfo('CF Browser', `screenshot: ${req.url || '(html)'}`);
        const res = await this.postBinary('screenshot', req as unknown as Record<string, unknown>);
        res.mimeType = req.screenshotOptions?.type === 'jpeg' ? 'image/jpeg' : 'image/png';
        return res;
    }

    /** Convenience: quick screenshot with defaults */
    async quickScreenshot(url: string): Promise<BinaryResponse> {
        return this.screenshot({ url });
    }

    // ─── 2. /pdf ─────────────────────────────────────────────────────────────

    /**
     * Generate a PDF of a URL or raw HTML.
     * @see https://developers.cloudflare.com/browser-rendering/rest-api/pdf-endpoint/
     */
    async pdf(req: PdfRequest): Promise<BinaryResponse> {
        logInfo('CF Browser', `pdf: ${req.url || '(html)'}`);
        const res = await this.postBinary('pdf', req as unknown as Record<string, unknown>);
        res.mimeType = 'application/pdf';
        return res;
    }

    /** Convenience alias kept for backwards compatibility */
    async generatePDF(req: PdfRequest): Promise<BinaryResponse> {
        return this.pdf(req);
    }

    // ─── 3. /content ─────────────────────────────────────────────────────────

    /**
     * Fetch fully rendered HTML of a URL (after JS execution).
     * @see https://developers.cloudflare.com/browser-rendering/rest-api/content-endpoint/
     */
    async content(req: CommonRequestFields): Promise<JsonApiResponse<string>> {
        logInfo('CF Browser', `content: ${req.url || '(html)'}`);
        return this.postJson<string>('content', req as unknown as Record<string, unknown>);
    }

    // ─── 4. /markdown ────────────────────────────────────────────────────────

    /**
     * Extract Markdown from a webpage.
     * @see https://developers.cloudflare.com/browser-rendering/rest-api/markdown-endpoint/
     */
    async markdown(req: CommonRequestFields): Promise<JsonApiResponse<string>> {
        logInfo('CF Browser', `markdown: ${req.url || '(html)'}`);
        return this.postJson<string>('markdown', req as unknown as Record<string, unknown>);
    }

    // ─── 5. /snapshot ────────────────────────────────────────────────────────

    /**
     * Take a full page snapshot (accessibility tree / DOM snapshot).
     * @see https://developers.cloudflare.com/browser-rendering/rest-api/snapshot/
     */
    async snapshot(req: CommonRequestFields): Promise<JsonApiResponse<unknown>> {
        logInfo('CF Browser', `snapshot: ${req.url || '(html)'}`);
        return this.postJson('snapshot', req as unknown as Record<string, unknown>);
    }

    // ─── 6. /scrape ──────────────────────────────────────────────────────────

    /**
     * Scrape HTML elements by CSS selectors.
     * Returns structured data: text, html, attributes, dimensions.
     * @see https://developers.cloudflare.com/browser-rendering/rest-api/scrape-endpoint/
     */
    async scrape(req: ScrapeRequest): Promise<JsonApiResponse<ScrapeResult[]>> {
        logInfo('CF Browser', `scrape: ${req.url || '(html)'} [${req.elements.length} selectors]`);
        return this.postJson<ScrapeResult[]>('scrape', req as unknown as Record<string, unknown>);
    }

    // ─── 7. /json ────────────────────────────────────────────────────────────

    /**
     * Capture structured data using AI (natural language prompt).
     * @see https://developers.cloudflare.com/browser-rendering/rest-api/json-endpoint/
     */
    async json(req: JsonRequest): Promise<JsonApiResponse<unknown>> {
        logInfo('CF Browser', `json (AI): ${req.url || '(html)'} prompt="${req.prompt.slice(0, 50)}..."`);
        return this.postJson('json', req as unknown as Record<string, unknown>);
    }

    // ─── 8. /links ───────────────────────────────────────────────────────────

    /**
     * Retrieve all links from a webpage.
     * @see https://developers.cloudflare.com/browser-rendering/rest-api/links-endpoint/
     */
    async links(req: CommonRequestFields): Promise<JsonApiResponse<Array<{ href: string; text: string }>>> {
        logInfo('CF Browser', `links: ${req.url || '(html)'}`);
        return this.postJson<Array<{ href: string; text: string }>>('links', req as unknown as Record<string, unknown>);
    }

    // ─── Utility ─────────────────────────────────────────────────────────────

    /** Quick connection test against example.com */
    async testConnection(): Promise<boolean> {
        logInfo('CF Browser', 'Testing connectivity...');
        const res = await this.content({ url: 'https://example.com' });
        if (res.success) {
            logInfo('CF Browser', `Connection OK (${res.browserMs}ms browser time, ${res.executionTime}ms total)`);
        } else {
            logError('CF Browser', `Connection failed: ${res.error}`);
        }
        return res.success;
    }

    /** Get the base URL (for debugging) */
    getBaseUrl(): string { return this.baseUrl; }
}