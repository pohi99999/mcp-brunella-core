/**
 * CEAN Orchestrator - Browser Rendering Handler
 *
 * Purpose: Cloudflare Browser Rendering API for Robotkez agent
 * - Navigate, click, type, extract, screenshot
 * - Google consent bypass (managed Chrome environment)
 * - No bot detection / CAPTCHA issues
 *
 * Route: POST /browser
 *
 * Phase: Robotkez CF Browser Engine
 */
import puppeteer from '@cloudflare/puppeteer';
const COOKIE_TTL_SECONDS = 24 * 60 * 60; // 24 hours
/**
 * Save cookies to KV for session persistence
 */
async function saveCookiesToKV(kv, sessionId, page, url) {
    if (!kv) {
        console.warn('[BROWSER] KV not available, skipping cookie persistence');
        return;
    }
    try {
        const cookies = await page.cookies();
        const state = {
            cookies,
            url,
            timestamp: new Date().toISOString()
        };
        const key = `browser_session:${sessionId}`;
        await kv.put(key, JSON.stringify(state), {
            expirationTtl: COOKIE_TTL_SECONDS
        });
        console.log(`[BROWSER] Saved ${cookies.length} cookies for session ${sessionId}`);
    }
    catch (error) {
        console.error('[BROWSER] Failed to save cookies to KV:', error);
        // Don't fail the request if cookie save fails
    }
}
/**
 * Load cookies from KV and restore to page
 */
async function loadCookiesFromKV(kv, sessionId, page) {
    if (!kv) {
        console.warn('[BROWSER] KV not available, skipping cookie restore');
        return false;
    }
    try {
        const key = `browser_session:${sessionId}`;
        const stateJson = await kv.get(key);
        if (!stateJson) {
            console.log(`[BROWSER] No saved session for ${sessionId}`);
            return false;
        }
        const state = JSON.parse(stateJson);
        if (state.cookies && state.cookies.length > 0) {
            await page.setCookie(...state.cookies);
            console.log(`[BROWSER] Restored ${state.cookies.length} cookies for session ${sessionId}`);
            return true;
        }
        return false;
    }
    catch (error) {
        console.error('[BROWSER] Failed to load cookies from KV:', error);
        return false;
    }
}
/**
 * Handle Google consent popups automatically
 * Cloudflare Browser Rendering typically bypasses these, but we handle them just in case
 */
async function handleConsent(page) {
    try {
        // Common consent selectors
        const consentSelectors = [
            'button[aria-label*="Accept"]',
            'button[aria-label*="Agree"]',
            'button:has-text("Accept all")',
            'button:has-text("I agree")',
            '#L2AGLb', // Google's "Accept all" button
            'button[id*="accept"]',
            'button[class*="accept"]'
        ];
        for (const selector of consentSelectors) {
            try {
                const button = await page.$(selector);
                if (button) {
                    await button.click();
                    await page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 3000 }).catch(() => { });
                    console.log('[BROWSER] Consent handled:', selector);
                    return;
                }
            }
            catch (e) {
                // Selector not found or click failed, continue
            }
        }
    }
    catch (error) {
        // Consent handling is best-effort; don't fail the whole request
        console.warn('[BROWSER] Consent handling failed:', error);
    }
}
/**
 * Execute browser command via Cloudflare Puppeteer
 */
export async function executeBrowserCommand(browser, command, kv) {
    const startTime = Date.now();
    let page;
    const consoleMessages = [];
    const networkErrors = [];
    try {
        // Wrap binding fetch to ensure absolute URL for nodejs_compat fetch
        const endpoint = {
            fetch: (input, init) => {
                if (typeof input === 'string' && input.startsWith('/')) {
                    return browser.fetch(`https://browser${input}`, init);
                }
                return browser.fetch(input, init);
            }
        };
        // Launch browser session
        const browserInstance = await puppeteer.launch(endpoint);
        page = await browserInstance.newPage();
        // Restore cookies from KV if sessionId provided
        if (command.sessionId) {
            await loadCookiesFromKV(kv, command.sessionId, page);
        }
        // Capture console logs
        page.on('console', (msg) => {
            consoleMessages.push(`[${msg.type()}] ${msg.text()}`);
        });
        // Capture network errors
        page.on('requestfailed', (request) => {
            networkErrors.push(`Failed: ${request.url()}`);
        });
        // Set reasonable timeout
        const timeout = command.options?.timeout || 15000;
        page.setDefaultTimeout(timeout);
        // Execute action based on command
        switch (command.action) {
            case 'navigate': {
                if (!command.url) {
                    throw new Error('URL is required for navigate action');
                }
                const waitUntil = command.options?.waitUntil || 'networkidle0';
                await page.goto(command.url, { waitUntil, timeout });
                // Handle consent popups
                await handleConsent(page);
                // Save cookies to KV for session persistence
                if (command.sessionId) {
                    await saveCookiesToKV(kv, command.sessionId, page, page.url());
                }
                const screenshot = await page.screenshot({
                    encoding: 'base64',
                    fullPage: command.options?.fullPage || false
                });
                const duration = Date.now() - startTime;
                await browserInstance.close();
                return {
                    status: 'success',
                    url: page.url(),
                    screenshot,
                    duration_ms: duration,
                    consoleMessages,
                    networkErrors
                };
            }
            case 'click': {
                if (!command.selector) {
                    throw new Error('Selector is required for click action');
                }
                await page.waitForSelector(command.selector, { timeout });
                await page.click(command.selector);
                // Wait for navigation if it occurs
                await page.waitForNavigation({
                    waitUntil: 'networkidle0',
                    timeout: 3000
                }).catch(() => { });
                const screenshot = await page.screenshot({
                    encoding: 'base64',
                    fullPage: command.options?.fullPage || false
                });
                const duration = Date.now() - startTime;
                await browserInstance.close();
                return {
                    status: 'success',
                    url: page.url(),
                    screenshot,
                    duration_ms: duration,
                    consoleMessages,
                    networkErrors
                };
            }
            case 'type': {
                if (!command.selector || !command.text) {
                    throw new Error('Selector and text are required for type action');
                }
                await page.waitForSelector(command.selector, { timeout });
                await page.type(command.selector, command.text);
                const screenshot = await page.screenshot({
                    encoding: 'base64',
                    fullPage: command.options?.fullPage || false
                });
                const duration = Date.now() - startTime;
                await browserInstance.close();
                return {
                    status: 'success',
                    url: page.url(),
                    screenshot,
                    duration_ms: duration,
                    consoleMessages,
                    networkErrors
                };
            }
            case 'extract': {
                if (!command.extractSelector) {
                    throw new Error('extractSelector is required for extract action');
                }
                const element = await page.$(command.extractSelector);
                if (!element) {
                    throw new Error(`Element not found: ${command.extractSelector}`);
                }
                const text = await page.evaluate((el) => el.textContent, element);
                const html = await page.evaluate((el) => el.innerHTML, element);
                const screenshot = await page.screenshot({
                    encoding: 'base64',
                    fullPage: command.options?.fullPage || false
                });
                const duration = Date.now() - startTime;
                await browserInstance.close();
                return {
                    status: 'success',
                    url: page.url(),
                    extractedText: text,
                    extractedHtml: html,
                    screenshot,
                    duration_ms: duration,
                    consoleMessages,
                    networkErrors
                };
            }
            case 'screenshot': {
                const screenshot = await page.screenshot({
                    encoding: 'base64',
                    fullPage: command.options?.fullPage || false
                });
                const duration = Date.now() - startTime;
                await browserInstance.close();
                return {
                    status: 'success',
                    url: page.url(),
                    screenshot,
                    duration_ms: duration,
                    consoleMessages,
                    networkErrors
                };
            }
            case 'wait': {
                const waitTime = command.waitTime || 1000;
                await new Promise(resolve => setTimeout(resolve, waitTime));
                const screenshot = await page.screenshot({
                    encoding: 'base64',
                    fullPage: command.options?.fullPage || false
                });
                const duration = Date.now() - startTime;
                await browserInstance.close();
                return {
                    status: 'success',
                    url: page.url(),
                    screenshot,
                    duration_ms: duration,
                    consoleMessages,
                    networkErrors
                };
            }
            default:
                throw new Error(`Unknown action: ${command.action}`);
        }
    }
    catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        const duration = Date.now() - startTime;
        // Try to capture error screenshot if page exists
        let errorScreenshot;
        try {
            if (page) {
                errorScreenshot = await page.screenshot({
                    encoding: 'base64',
                    fullPage: false
                });
            }
        }
        catch (screenshotError) {
            // Ignore screenshot errors
        }
        return {
            status: 'error',
            error: errorMsg,
            screenshot: errorScreenshot,
            duration_ms: duration,
            consoleMessages,
            networkErrors
        };
    }
}
/**
 * Validate browser command
 */
export function validateBrowserCommand(command) {
    if (!command || typeof command !== 'object') {
        return false;
    }
    const validActions = ['navigate', 'click', 'type', 'extract', 'screenshot', 'wait'];
    if (!validActions.includes(command.action)) {
        return false;
    }
    // Action-specific validation
    if (command.action === 'navigate' && !command.url) {
        return false;
    }
    if (command.action === 'click' && !command.selector) {
        return false;
    }
    if (command.action === 'type' && (!command.selector || !command.text)) {
        return false;
    }
    if (command.action === 'extract' && !command.extractSelector) {
        return false;
    }
    return true;
}
//# sourceMappingURL=browser.js.map