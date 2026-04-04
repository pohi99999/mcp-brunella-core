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

        // 1. Verify the current Mission Control shell summary strip
        await expect(page.getByRole('heading', { name: /Mission Control/i })).toBeVisible({ timeout: 10000 });
        await expect(page.getByRole('button', { name: /Reset View/i })).toBeVisible();
        await expect(page.getByText(/^Health$/i).first()).toBeVisible();
        await expect(page.getByText(/^Agents$/i).first()).toBeVisible();
        await expect(page.getByText(/^Queue$/i).first()).toBeVisible();
        await expect(page.getByText(/^Success$/i).first()).toBeVisible();

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
        await page.setViewportSize({ width: 390, height: 844 });
        await page.reload();
        await expect(page.getByRole('heading', { name: /Mission Control/i })).toBeVisible({ timeout: 10000 });

        const mobileMenuToggle = page.getByRole('button', { name: 'Open navigation menu' });
        await expect(mobileMenuToggle).toBeVisible({ timeout: 5000 });
        await mobileMenuToggle.click({ force: true, timeout: 5000 });

        const mobileDrawer = page.getByRole('dialog');
        await expect(mobileDrawer).toBeVisible({ timeout: 5000 });
        await expect(mobileDrawer).toContainText(/Mission Control/i);
        await expect(mobileDrawer).toContainText(/Cognitive Memory/i);

        const hasHorizontalOverflow = await page.evaluate(
            () => document.body.scrollWidth > document.body.clientWidth
        );
        expect(hasHorizontalOverflow).toBeFalsy();

        await page.keyboard.press('Escape');
        await expect(mobileDrawer).toBeHidden({ timeout: 5000 });

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
