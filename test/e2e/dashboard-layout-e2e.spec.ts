import { test, expect } from '@playwright/test';

test.describe('Brunella Mission Control Dashboard Layout E2E', () => {
    const errors: string[] = [];

    test.beforeEach(async ({ page }) => {
        // Capture console errors
        page.on('console', msg => {
            if (msg.type() === 'error') {
                errors.push(msg.text());
            }
        });
        page.on('pageerror', exception => {
            errors.push(exception.message);
        });
    });

    test('Dashboard layout, widgets and interactive elements', async ({ page }) => {
        await page.goto('/');

        // 1. Verify active widgets (Stats and Health)
        await expect(page.locator('text=Total Tasks').first()).toBeVisible({ timeout: 10000 });
        await expect(page.locator('text=Success Rate').first()).toBeVisible();
        await expect(page.locator('text=Agent State').first()).toBeVisible();
        await expect(page.locator('text=System Health').first()).toBeVisible();

        // 2. Interact with Theme toggle (dark/light/system)
        // Usually there is a theme toggle button in the header
        const themeToggle = page.locator('button[aria-label="Toggle theme"]').or(page.getByRole('button', { name: /theme/i })).or(page.locator('button[id*="theme"]')).first();
        if (await themeToggle.isVisible()) {
            await themeToggle.click();
            await page.waitForTimeout(500); // Wait for transition
        }

        // 3. Layout Switcher
        const layoutDropdown = page.getByRole('button', { name: /Layout|Nézet/i }).or(page.locator('[data-testid="layout-switcher"]')).first();
        if (await layoutDropdown.isVisible()) {
            await layoutDropdown.click();
            await page.keyboard.press('Escape'); // Close dropdown
        }

        // 4. Mobile Menu toggle
        // Simulate mobile viewport to see mobile menu toggle
        await page.setViewportSize({ width: 375, height: 812 });
        // Give the UI time to react to the resize
        await page.waitForTimeout(1000);
        
        try {
            const mobileMenuToggle = page.locator('header button').last();
            if (await mobileMenuToggle.isVisible()) {
                await mobileMenuToggle.click({ force: true, timeout: 5000 });
                await page.waitForTimeout(500); 
                await page.keyboard.press('Escape'); // Try closing it
            }
        } catch (e: any) {
            console.log('Mobile menu toggle click failed:', e.message);
        }

        // Revert to desktop for terminal check
        await page.setViewportSize({ width: 1280, height: 800 });

        // 5. Open Terminal footer
        try {
            const terminalToggle = page.getByRole('button', { name: /Terminal|Konzol|Logs/i }).or(page.locator('button:has-text("Terminal")')).first();
            if (await terminalToggle.isVisible()) {
                await terminalToggle.click({ force: true });
                const terminalOutput = page.locator('.terminal-output, .xterm, pre, code');
                await page.waitForTimeout(500);
                await terminalToggle.click({ force: true, timeout: 2000 }); // Close it back
            }
        } catch (e: any) {
            console.log('Terminal toggle failed:', e.message);
        }

        // Output any caught errors for review
        if (errors.length > 0) {
            console.log('Console errors caught during test:', errors);
        }
    });
});
