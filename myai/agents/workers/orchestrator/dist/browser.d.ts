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
import { BrowserCommand, BrowserResponse } from './types.js';
/**
 * Execute browser command via Cloudflare Puppeteer
 */
export declare function executeBrowserCommand(browser: any, command: BrowserCommand): Promise<BrowserResponse>;
/**
 * Validate browser command
 */
export declare function validateBrowserCommand(command: any): command is BrowserCommand;
//# sourceMappingURL=browser.d.ts.map