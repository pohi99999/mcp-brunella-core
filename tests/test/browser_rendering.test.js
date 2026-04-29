/**
 * Tests for Cloudflare Browser Rendering REST API Client
 * Tests all 8 endpoints: /screenshot, /pdf, /content, /markdown, /snapshot, /scrape, /json, /links
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
// Mock environment first
vi.stubEnv('CF_API_TOKEN', 'test-token-abc123');
vi.stubEnv('CLOUDFLARE_ACCOUNT_ID', 'test-account-id-xyz');
// Mock logger to prevent side effects
vi.mock('@packages/utils/logger.js', () => ({
    logInfo: vi.fn(),
    logError: vi.fn(),
    logWarn: vi.fn(),
}));
// Mock global fetch
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);
import { CloudflareBrowserAPI } from '@packages/utils/browserRendering.js';
describe('CloudflareBrowserAPI', () => {
    let api;
    beforeEach(() => {
        mockFetch.mockReset();
        api = new CloudflareBrowserAPI('test-token-abc123', 'test-account-id-xyz');
    });
    afterEach(() => {
        vi.restoreAllMocks();
    });
    // ─── Constructor ───────────────────────────────────────────────────────
    describe('constructor', () => {
        it('should initialize with provided credentials', () => {
            const instance = new CloudflareBrowserAPI('tok', 'acc');
            expect(instance.getBaseUrl()).toBe('https://api.cloudflare.com/client/v4/accounts/acc/browser-rendering');
        });
        it('should throw if API token is missing', () => {
            // Explicitly clear ALL auth-related environment variables
            const originals = {
                CF_API_TOKEN: process.env.CF_API_TOKEN,
                CLOUDFLARE_API_TOKEN: process.env.CLOUDFLARE_API_TOKEN,
                CF_GLOBAL_API_KEY: process.env.CF_GLOBAL_API_KEY,
                CLOUDFLARE_GLOBAL_API_KEY: process.env.CLOUDFLARE_GLOBAL_API_KEY,
                CF_EMAIL: process.env.CF_EMAIL,
                CLOUDFLARE_EMAIL: process.env.CLOUDFLARE_EMAIL
            };
            // Delete all possible auth env vars
            delete process.env.CF_API_TOKEN;
            delete process.env.CLOUDFLARE_API_TOKEN;
            delete process.env.CF_GLOBAL_API_KEY;
            delete process.env.CLOUDFLARE_GLOBAL_API_KEY;
            delete process.env.CF_EMAIL;
            delete process.env.CLOUDFLARE_EMAIL;
            try {
                expect(() => new CloudflareBrowserAPI('', 'acc')).toThrow('Either CF_API_TOKEN or (CF_GLOBAL_API_KEY + CF_EMAIL) environment variables are required');
            }
            finally {
                // Restore original values
                Object.entries(originals).forEach(([key, value]) => {
                    if (value !== undefined)
                        process.env[key] = value;
                });
            }
        });
        it('should throw if account ID is missing', () => {
            // Save and clear account ID env var
            const origAccId = process.env.CLOUDFLARE_ACCOUNT_ID;
            delete process.env.CLOUDFLARE_ACCOUNT_ID;
            try {
                expect(() => new CloudflareBrowserAPI('tok', '')).toThrow('CLOUDFLARE_ACCOUNT_ID environment variable is required');
            }
            finally {
                // Restore original value
                if (origAccId !== undefined)
                    process.env.CLOUDFLARE_ACCOUNT_ID = origAccId;
            }
        });
    });
    // ─── /screenshot ──────────────────────────────────────────────────────
    describe('screenshot', () => {
        it('should POST to /screenshot and return binary data', async () => {
            const pngBuffer = Buffer.from('fake-png-data');
            mockFetch.mockResolvedValueOnce({
                ok: true,
                headers: new Headers({ 'X-Browser-Ms-Used': '1234' }),
                arrayBuffer: async () => pngBuffer.buffer,
            });
            const result = await api.screenshot({ url: 'https://example.com' });
            expect(mockFetch).toHaveBeenCalledOnce();
            const [url, opts] = mockFetch.mock.calls[0];
            expect(url).toContain('/browser-rendering/screenshot');
            expect(opts.method).toBe('POST');
            expect(JSON.parse(opts.body)).toMatchObject({ url: 'https://example.com' });
            expect(result.success).toBe(true);
            expect(result.mimeType).toBe('image/png');
            expect(result.browserMs).toBe(1234);
        });
        it('should return jpeg mimeType when type=jpeg', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                headers: new Headers(),
                arrayBuffer: async () => Buffer.from('fake').buffer,
            });
            const result = await api.screenshot({
                url: 'https://example.com',
                screenshotOptions: { type: 'jpeg', quality: 80 },
            });
            expect(result.success).toBe(true);
            expect(result.mimeType).toBe('image/jpeg');
        });
        it('should handle API errors gracefully', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: false,
                status: 403,
                headers: new Headers(),
                json: async () => ({ errors: [{ message: 'Forbidden' }] }),
            });
            const result = await api.screenshot({ url: 'https://example.com' });
            expect(result.success).toBe(false);
            expect(result.error).toBe('Forbidden');
        });
        it('should handle network errors', async () => {
            mockFetch.mockRejectedValueOnce(new Error('Network failed'));
            const result = await api.screenshot({ url: 'https://example.com' });
            expect(result.success).toBe(false);
            expect(result.error).toBe('Network failed');
        });
    });
    // ─── /pdf ─────────────────────────────────────────────────────────────
    describe('pdf', () => {
        it('should POST to /pdf and return binary data with PDF mimeType', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                headers: new Headers({ 'X-Browser-Ms-Used': '2000' }),
                arrayBuffer: async () => Buffer.from('%PDF-fake').buffer,
            });
            const result = await api.pdf({ url: 'https://example.com', pdfOptions: { format: 'a4', landscape: true } });
            expect(mockFetch).toHaveBeenCalledOnce();
            const [url] = mockFetch.mock.calls[0];
            expect(url).toContain('/browser-rendering/pdf');
            expect(result.success).toBe(true);
            expect(result.mimeType).toBe('application/pdf');
        });
        it('generatePDF should be an alias for pdf', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                headers: new Headers(),
                arrayBuffer: async () => Buffer.from('%PDF').buffer,
            });
            const result = await api.generatePDF({ url: 'https://example.com' });
            expect(result.success).toBe(true);
            expect(result.mimeType).toBe('application/pdf');
        });
    });
    // ─── /content ─────────────────────────────────────────────────────────
    describe('content', () => {
        it('should POST to /content and return rendered HTML', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                headers: new Headers({ 'X-Browser-Ms-Used': '500' }),
                json: async () => '<html><body>Rendered</body></html>',
            });
            const result = await api.content({ url: 'https://example.com' });
            const [url] = mockFetch.mock.calls[0];
            expect(url).toContain('/browser-rendering/content');
            expect(result.success).toBe(true);
            expect(result.result).toContain('Rendered');
        });
    });
    // ─── /markdown ────────────────────────────────────────────────────────
    describe('markdown', () => {
        it('should POST to /markdown and return markdown text', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                headers: new Headers(),
                json: async () => '# Hello World\n\nSome paragraph text.',
            });
            const result = await api.markdown({ url: 'https://example.com' });
            expect(result.success).toBe(true);
            expect(result.result).toContain('# Hello World');
        });
    });
    // ─── /snapshot ────────────────────────────────────────────────────────
    describe('snapshot', () => {
        it('should POST to /snapshot and return DOM structure', async () => {
            const snapshotData = { title: 'Example', tree: [{ role: 'heading', text: 'Hello' }] };
            mockFetch.mockResolvedValueOnce({
                ok: true,
                headers: new Headers(),
                json: async () => snapshotData,
            });
            const result = await api.snapshot({ url: 'https://example.com' });
            expect(result.success).toBe(true);
            expect(result.result).toMatchObject(snapshotData);
        });
    });
    // ─── /scrape ──────────────────────────────────────────────────────────
    describe('scrape', () => {
        it('should POST to /scrape with selectors and return structured data', async () => {
            const scrapeResult = [
                { selector: 'h1', results: [{ text: 'Hello', html: 'Hello', attributes: [], height: 40, width: 600, top: 100, left: 100 }] },
            ];
            mockFetch.mockResolvedValueOnce({
                ok: true,
                headers: new Headers({ 'X-Browser-Ms-Used': '800' }),
                json: async () => scrapeResult,
            });
            const result = await api.scrape({
                url: 'https://example.com',
                elements: [{ selector: 'h1' }, { selector: 'a' }],
            });
            const body = JSON.parse(mockFetch.mock.calls[0][1].body);
            expect(body.elements).toHaveLength(2);
            expect(body.elements[0].selector).toBe('h1');
            expect(result.success).toBe(true);
        });
    });
    // ─── /json ────────────────────────────────────────────────────────────
    describe('json (AI extraction)', () => {
        it('should POST to /json with a prompt and return structured data', async () => {
            const aiResult = { products: [{ name: 'Widget', price: '$9.99' }] };
            mockFetch.mockResolvedValueOnce({
                ok: true,
                headers: new Headers(),
                json: async () => aiResult,
            });
            const result = await api.json({
                url: 'https://example.com/shop',
                prompt: 'Extract all product names and prices',
            });
            const body = JSON.parse(mockFetch.mock.calls[0][1].body);
            expect(body.prompt).toContain('product names');
            expect(result.success).toBe(true);
            expect(result.result).toMatchObject(aiResult);
        });
    });
    // ─── /links ───────────────────────────────────────────────────────────
    describe('links', () => {
        it('should POST to /links and return href+text array', async () => {
            const linksData = [
                { href: 'https://example.com/about', text: 'About' },
                { href: 'https://example.com/contact', text: 'Contact' },
            ];
            mockFetch.mockResolvedValueOnce({
                ok: true,
                headers: new Headers(),
                json: async () => linksData,
            });
            const result = await api.links({ url: 'https://example.com' });
            expect(result.success).toBe(true);
            expect(result.result).toHaveLength(2);
            expect(result.result[0].href).toBe('https://example.com/about');
        });
    });
    // ─── testConnection ───────────────────────────────────────────────────
    describe('testConnection', () => {
        it('should return true when content endpoint works', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                headers: new Headers({ 'X-Browser-Ms-Used': '300' }),
                json: async () => '<html>OK</html>',
            });
            const ok = await api.testConnection();
            expect(ok).toBe(true);
        });
        it('should return false when API fails', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: false,
                status: 401,
                headers: new Headers(),
                json: async () => ({ errors: [{ message: 'Unauthorized' }] }),
            });
            const ok = await api.testConnection();
            expect(ok).toBe(false);
        });
    });
    // ─── Shared features ─────────────────────────────────────────────────
    describe('shared features', () => {
        it('should include correct auth headers in all requests', async () => {
            // Clear ALL global key env vars to force Bearer token usage
            const originals = {
                CF_GLOBAL_API_KEY: process.env.CF_GLOBAL_API_KEY,
                CLOUDFLARE_GLOBAL_API_KEY: process.env.CLOUDFLARE_GLOBAL_API_KEY,
                CF_EMAIL: process.env.CF_EMAIL,
                CLOUDFLARE_EMAIL: process.env.CLOUDFLARE_EMAIL
            };
            delete process.env.CF_GLOBAL_API_KEY;
            delete process.env.CLOUDFLARE_GLOBAL_API_KEY;
            delete process.env.CF_EMAIL;
            delete process.env.CLOUDFLARE_EMAIL;
            try {
                // Create fresh instance with explicit token (not global key)
                const tokenApi = new CloudflareBrowserAPI('test-token-xyz', 'test-account');
                mockFetch.mockResolvedValueOnce({
                    ok: true,
                    headers: new Headers(),
                    json: async () => 'html',
                });
                await tokenApi.content({ url: 'https://example.com' });
                // Get the fetch call arguments
                const fetchCall = mockFetch.mock.calls[0];
                const requestInit = fetchCall[1];
                const headers = requestInit.headers;
                // Check the headers object directly
                expect(headers['Authorization']).toBe('Bearer test-token-xyz');
                expect(headers['Content-Type']).toBe('application/json');
            }
            finally {
                // Restore original values
                Object.entries(originals).forEach(([key, value]) => {
                    if (value !== undefined)
                        process.env[key] = value;
                });
            }
        });
        it('should use correct base URL with account ID', () => {
            expect(api.getBaseUrl()).toBe('https://api.cloudflare.com/client/v4/accounts/test-account-id-xyz/browser-rendering');
        });
        it('should pass gotoOptions correctly', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                headers: new Headers(),
                json: async () => 'html',
            });
            await api.content({
                url: 'https://example.com',
                gotoOptions: { waitUntil: 'networkidle0', timeout: 10000 },
            });
            const body = JSON.parse(mockFetch.mock.calls[0][1].body);
            expect(body.gotoOptions).toMatchObject({
                waitUntil: 'networkidle0',
                timeout: 10000,
            });
        });
    });
});
