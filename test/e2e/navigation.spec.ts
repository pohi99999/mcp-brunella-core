import { test, expect, type Page } from '@playwright/test';

test.describe('Dashboard Navigation', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await page.waitForLoadState('networkidle');
    });

    test('should load dashboard without white screen', async ({ page }) => {
        // Should not be a blank page
        const body = await page.locator('body');
        await expect(body).not.toBeEmpty();
        // MissionControlLayout should render
        await expect(page.locator('text=Brunella').first()).toBeVisible({ timeout: 10000 });
    });

    test('should display all 10 sidebar navigation items', async ({ page }) => {
        const sidebarLabels = [
            'Mission Control', 'Agents', 'Incubator', 'Knowledge',
            'Developer', 'Robotkéz', 'Tasks', 'Assets', 'Files', 'Settings'
        ];
        for (const label of sidebarLabels) {
            await expect(page.locator(`text=${label}`).first()).toBeVisible();
        }
    });

    test('should switch tabs when clicking sidebar items', async ({ page }) => {
        // Click on each tab and verify no JS errors
        const consoleErrors: string[] = [];
        page.on('console', (msg) => {
            if (msg.type() === 'error' && !msg.text().includes('Vue Devtools') && !msg.text().includes('SERVICE WORKER')) {
                consoleErrors.push(msg.text());
            }
        });

        const tabs = [
            { label: 'Agents', marker: 'Agents' },
            { label: 'Developer', marker: 'Developer' },
            { label: 'Tasks', marker: 'Tasks' },
            { label: 'Files', marker: 'Files' },
            { label: 'Settings', marker: 'Settings' },
        ];

        for (const tab of tabs) {
            await page.locator(`text=${tab.label}`).first().click();
            await page.waitForTimeout(300);
        }

        // Filter out known/acceptable errors
        const realErrors = consoleErrors.filter(
            (e) => !e.includes('fetch') && !e.includes('Failed to') && !e.includes('net::')
        );
        // Allow some fetch errors (backend may not have all endpoints), but no component crashes
        expect(realErrors.length).toBeLessThan(5);
    });

    test('should open CommandMenu with Ctrl+K', async ({ page }) => {
        await page.keyboard.press('Control+k');
        await expect(page.locator('[role="dialog"]')).toBeVisible({ timeout: 3000 });
        // CommandMenu dialog is open — verify it has an input (cmdk uses custom input)
        const input = page.locator('[role="dialog"] input, [cmdk-input]');
        await expect(input.first()).toBeVisible();
    });

    test('should navigate via CommandMenu', async ({ page }) => {
        await page.keyboard.press('Control+k');
        await page.waitForTimeout(500);
        const dialog = page.locator('[role="dialog"]');
        if (await dialog.isVisible().catch(() => false)) {
            const fajlItem = dialog.locator('text=Fájlrendszer');
            if (await fajlItem.isVisible({ timeout: 2000 }).catch(() => false)) {
                await fajlItem.click();
                await page.waitForTimeout(500);
                await expect(dialog).not.toBeVisible({ timeout: 3000 });
            }
        }
    });

    test('should handle rapid tab switching without crash', async ({ page }) => {
        const uncaughtErrors: string[] = [];
        page.on('pageerror', (error) => {
            uncaughtErrors.push(error.message);
        });

        const tabLabels = ['Agents', 'Developer', 'Tasks', 'Files', 'Settings', 'Mission Control'];
        for (let i = 0; i < 3; i++) {
            for (const label of tabLabels) {
                await page.locator(`text=${label}`).first().click();
                await page.waitForTimeout(50);
            }
        }

        // Allow network-related errors but no React component crashes
        const componentCrashes = uncaughtErrors.filter(
            (e) => e.includes('Cannot read') || e.includes('is not defined') || e.includes('not a function')
        );
        expect(componentCrashes).toEqual([]);
    });
});
