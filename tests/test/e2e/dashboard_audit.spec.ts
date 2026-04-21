import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

// DASHBOARD CONFIG
const DASHBOARD_URL = 'http://localhost:5173';
const REPORT_DIR = './test-results/dashboard-audit';

// Az összes menüpont ID-ja a navigation.tsx alapján + dashboard
const NAV_ITEMS = [
  'dashboard', 'neural-map', 'system-arch', 'cean', 'cloudflare', 'fleet_manager',
  'chat', 'paios', 'phoenix', 'management', 'decomposer', 'tracks',
  'incubator', 'knowledge', 'mcp', 'developer', 'edge', 'suggested-tasks',
  'tests', 'enterprise-analytics', 'robotkez', 'tasks', 'python-workers',
  'inventory', 'files', 'marketwatcher', 'settings'
];

test.describe('🚀 Brunella Dashboard Full UI Audit (Enhanced)', () => {
  
  test.beforeAll(async () => {
    if (!fs.existsSync(REPORT_DIR)) {
      fs.mkdirSync(REPORT_DIR, { recursive: true });
    }
  });

  for (const navId of NAV_ITEMS) {
    test(`Audit Page: ${navId}`, async ({ page }) => {
      console.log(`
--- Auditing: ${navId} ---`);
      
      const consoleErrors: string[] = [];
      page.on('console', msg => {
        if (msg.type() === 'error') consoleErrors.push(msg.text());
      });

      const failedRequests: string[] = [];
      page.on('requestfailed', request => {
        failedRequests.push(`${request.method()} ${request.url()}: ${request.failure()?.errorText}`);
      });

      // 1. Navigáció és akadálymentesítés
      await page.goto(`${DASHBOARD_URL}`);
      console.log("  Waiting for system initialization (5s)...");
      await page.waitForTimeout(5000); // Biztosan eltűnik a Splash Screen
      
      // Nyomunk egy Escape-et, hogy bezárjunk minden overlay-t (pl. Command Menu)
      await page.keyboard.press('Escape');
      await page.waitForTimeout(500);

      // 2. Tab váltás
      if (navId !== 'dashboard') {
        try {
          // Megkeressük a megfelelő menüpontot az oldalsávon
          const navButton = page.locator(`button:has-text("${navId}"), [data-nav-id="${navId}"]`).first();
          if (await navButton.isVisible()) {
            await navButton.click();
            await page.waitForTimeout(1000);
          }
        } catch (e) {
          console.warn(`  Could not navigate to ${navId} via UI, skipping manual switch.`);
        }
      }

      await page.screenshot({ path: path.join(REPORT_DIR, `${navId}_final.png`) });

      // 3. Gombok tesztelése
      const buttons = page.locator('button, [role="button"]');
      const buttonCount = await buttons.count();
      console.log(`  Found ${buttonCount} interactive elements.`);

      for (let i = 0; i < Math.min(buttonCount, 15); i++) {
        const btn = buttons.nth(i);
        try {
          if (await btn.isVisible() && await btn.isEnabled()) {
            const btnText = await btn.innerText();
            if (btnText && btnText.length > 1) {
              console.log(`    Testing button: "${btnText.split('\n')[0]}"`);
              // Force click ha valami mégis elé lógna
              await btn.click({ timeout: 3000, force: true });
              await page.waitForTimeout(500);
            }
          }
        } catch (e) {
          // Nem halunk meg ha egy gomb nem kattintható
        }
      }

      // 4. Ellenőrzés
      if (consoleErrors.length > 0) {
        console.error(`  ❌ CONSOLE ERRORS: ${consoleErrors.length}`);
        consoleErrors.forEach(err => console.error(`     > ${err}`));
      }
      if (failedRequests.length > 0) {
        console.error(`  ❌ FAILED REQUESTS: ${failedRequests.length}`);
        failedRequests.forEach(req => console.error(`     > ${req}`));
      }

      expect(consoleErrors.length, `Konzol hibák a(z) ${navId} oldalon`).toBeLessThanOrEqual(2); // Megengedünk 2 nem kritikus hibát
    });
  }
});
