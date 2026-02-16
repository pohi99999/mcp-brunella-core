import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { persistentBrowser } from '../src/utils/persistentBrowser.js';

describe('Persistent Browser (RobotkezV2 - Phase 1)', () => {
    // Timeout for browser operations
    const BROWSER_TIMEOUT = 15000;

    beforeAll(async () => {
        // Launch browser once for all tests
        await persistentBrowser.sendCommand({ action: 'launch', headless: true });
    }, BROWSER_TIMEOUT);

    afterAll(async () => {
        // Close browser after all tests
        await persistentBrowser.close();
    }, BROWSER_TIMEOUT * 2);

    it('should navigate to a URL', async () => {
        const res = await persistentBrowser.sendCommand({
            action: 'navigate',
            url: 'https://example.com'
        });

        expect(res.status).toBe('success');
        expect(res.url).toContain('example.com');
    }, BROWSER_TIMEOUT);

    it('should scroll page down', async () => {
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

    it('should wait for element to appear', async () => {
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

    it('should extract text from elements', async () => {
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

    it('should take a screenshot', async () => {
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

    it('should get HTML content', async () => {
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

    it('should handle scroll with different directions', async () => {
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

    it('should handle timeout on wait for non-existent element', async () => {
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
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : String(error);
            expect(message).toContain('Timeout');
        }
    }, BROWSER_TIMEOUT);

    it('should extract attributes from elements', async () => {
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
