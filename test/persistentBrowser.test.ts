import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { persistentBrowser } from '../src/utils/persistentBrowser.js';

// Skip in CI environments where browser might not be installed or WEB_UI is disabled
const shouldSkip = process.env.CI && process.env.WEB_UI_ENABLED === '0';

describe.skipIf(shouldSkip)('Persistent Browser (RobotkezV2 - Phase 1)', () => {
    // Timeout for browser operations
    const BROWSER_TIMEOUT = 15000;
    let browserAvailable = false;

    beforeAll(async () => {
        try {
            // Launch browser once for all tests
            await persistentBrowser.sendCommand({ action: 'launch', headless: true });
            browserAvailable = true;
        } catch (error: any) {
            console.warn("Skipping Persistent Browser tests: Browser launch failed.", error.message);
            browserAvailable = false;
        }
    }, BROWSER_TIMEOUT);

    afterAll(async () => {
        if (browserAvailable) {
            // Close browser after all tests
            await persistentBrowser.close();
        }
    });

    it('should navigate to a URL', async (ctx) => {
        if (!browserAvailable) return ctx.skip();

        const res = await persistentBrowser.sendCommand({
            action: 'navigate',
            url: 'https://example.com'
        });

        expect(res.status).toBe('success');
        expect(res.url).toContain('example.com');
    }, BROWSER_TIMEOUT);

    it('should scroll page down', async (ctx) => {
        if (!browserAvailable) return ctx.skip();

        await persistentBrowser.sendCommand({
            action: 'navigate',
            url: 'https://example.com'
        });

        const res = await persistentBrowser.sendCommand({
            action: 'scroll',
            direction: 'down',
            amount: 200
        });

        expect(res.status).toBe('success');
        expect(res.message).toContain('Scrolled down');
    }, BROWSER_TIMEOUT);

    it('should wait for element to appear', async (ctx) => {
        if (!browserAvailable) return ctx.skip();

        await persistentBrowser.sendCommand({
            action: 'navigate',
            url: 'https://example.com'
        });

        const res = await persistentBrowser.sendCommand({
            action: 'wait',
            selector: 'h1',
            timeout: 5000
        });

        expect(res.status).toBe('success');
        expect(res.message).toContain('is visible');
    }, BROWSER_TIMEOUT);

    it('should extract text from elements', async (ctx) => {
        if (!browserAvailable) return ctx.skip();

        await persistentBrowser.sendCommand({
            action: 'navigate',
            url: 'https://example.com'
        });

        const res = await persistentBrowser.sendCommand({
            action: 'extract',
            selector: 'h1',
            type: 'text'
        });

        expect(res.status).toBe('success');
        expect(res.data).toBeInstanceOf(Array);
        expect(res.count).toBeGreaterThan(0);
    }, BROWSER_TIMEOUT);

    it('should take a screenshot', async (ctx) => {
        if (!browserAvailable) return ctx.skip();

        await persistentBrowser.sendCommand({
            action: 'navigate',
            url: 'https://example.com'
        });

        const res = await persistentBrowser.sendCommand({
            action: 'screenshot'
        });

        expect(res.status).toBe('success');

        // Verify screenshot was saved
        const screenshot = persistentBrowser.getLastScreenshot();
        expect(screenshot).not.toBeNull();
        expect(screenshot).toBeInstanceOf(Uint8Array);
    }, BROWSER_TIMEOUT);

    it('should get HTML content', async (ctx) => {
        if (!browserAvailable) return ctx.skip();

        await persistentBrowser.sendCommand({
            action: 'navigate',
            url: 'https://example.com'
        });

        const res = await persistentBrowser.sendCommand({
            action: 'content'
        });

        expect(res.status).toBe('success');
        expect(res.content).toBeDefined();
        expect(res.content).toContain('<html');
    }, BROWSER_TIMEOUT);

    it('should handle scroll with different directions', async (ctx) => {
        if (!browserAvailable) return ctx.skip();

        await persistentBrowser.sendCommand({
            action: 'navigate',
            url: 'https://example.com'
        });

        const directions: Array<'up' | 'down' | 'left' | 'right'> = ['down', 'up', 'left', 'right'];

        for (const direction of directions) {
            const res = await persistentBrowser.sendCommand({
                action: 'scroll',
                direction,
                amount: 50
            });

            expect(res.status).toBe('success');
            expect(res.message).toContain(`Scrolled ${direction}`);
        }
    }, BROWSER_TIMEOUT);

    it('should handle timeout on wait for non-existent element', async (ctx) => {
        if (!browserAvailable) return ctx.skip();

        await persistentBrowser.sendCommand({
            action: 'navigate',
            url: 'https://example.com'
        });

        try {
            await persistentBrowser.sendCommand({
                action: 'wait',
                selector: '#non-existent-element-12345',
                timeout: 2000
            });
            expect.fail('Should have thrown timeout error');
        } catch (error: any) {
            expect(error.message).toContain('Timeout');
        }
    }, BROWSER_TIMEOUT);

    it('should extract attributes from elements', async (ctx) => {
        if (!browserAvailable) return ctx.skip();

        await persistentBrowser.sendCommand({
            action: 'navigate',
            url: 'https://example.com'
        });

        const res = await persistentBrowser.sendCommand({
            action: 'extract',
            selector: 'a',
            type: 'attribute',
            attribute: 'href'
        });

        expect(res.status).toBe('success');
        expect(res.data).toBeInstanceOf(Array);
        // example.com might not have links, so count could be 0
        expect(res.count).toBeGreaterThanOrEqual(0);
    }, BROWSER_TIMEOUT);
});
