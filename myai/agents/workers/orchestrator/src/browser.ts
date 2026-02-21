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
import { BrowserCommand, BrowserResponse, BrowserAction } from './types.js';

/**
 * Handle Google consent popups automatically
 * Cloudflare Browser Rendering typically bypasses these, but we handle them just in case
 */
async function handleConsent(page: any): Promise<void> {
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
          await page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 3000 }).catch(() => {});
          console.log('[BROWSER] Consent handled:', selector);
          return;
        }
      } catch (e) {
        // Selector not found or click failed, continue
      }
    }
  } catch (error) {
    // Consent handling is best-effort; don't fail the whole request
    console.warn('[BROWSER] Consent handling failed:', error);
  }
}

/**
 * Execute browser command via Cloudflare Puppeteer
 */
export async function executeBrowserCommand(
  browser: any,
  command: BrowserCommand
): Promise<BrowserResponse> {
  const startTime = Date.now();
  let page: any;
  const consoleMessages: string[] = [];
  const networkErrors: string[] = [];

  try {
    // Launch browser session
    const browserInstance = await puppeteer.launch(browser);
    page = await browserInstance.newPage();

    // Capture console logs
    page.on('console', (msg: any) => {
      consoleMessages.push(`[${msg.type()}] ${msg.text()}`);
    });

    // Capture network errors
    page.on('requestfailed', (request: any) => {
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
        }).catch(() => {});
        
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
        
        const text = await page.evaluate((el: any) => el.textContent, element);
        const html = await page.evaluate((el: any) => el.innerHTML, element);
        
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
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    const duration = Date.now() - startTime;
    
    // Try to capture error screenshot if page exists
    let errorScreenshot: string | undefined;
    try {
      if (page) {
        errorScreenshot = await page.screenshot({ 
          encoding: 'base64',
          fullPage: false
        });
      }
    } catch (screenshotError) {
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
export function validateBrowserCommand(command: any): command is BrowserCommand {
  if (!command || typeof command !== 'object') {
    return false;
  }

  const validActions: BrowserAction[] = ['navigate', 'click', 'type', 'extract', 'screenshot', 'wait'];
  
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
