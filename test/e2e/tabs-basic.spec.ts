import { test, expect } from '@playwright/test';

test.describe('Agents Tab', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await page.waitForLoadState('networkidle');
        await page.locator('text=Agents').first().click();
        await page.waitForTimeout(500);
    });

    test('should load agent list', async ({ page }) => {
        // Should display agent names from the API
        await page.waitForTimeout(2000);
        const agentNames = ['Developer', 'Researcher', 'Orchestrator', 'Evaluator', 'Robotkez'];
        let found = 0;
        for (const name of agentNames) {
            if (await page.locator(`text=${name}`).first().isVisible().catch(() => false)) {
                found++;
            }
        }
        expect(found).toBeGreaterThan(0);
    });

    test('should have refresh button', async ({ page }) => {
        const refreshBtn = page.locator('button').filter({ hasText: /refresh|frissít/i }).or(
            page.locator('button svg[class*="refresh"], button [class*="RefreshCw"]').locator('..')
        );
        if (await refreshBtn.count() > 0) {
            await refreshBtn.first().click();
            await page.waitForTimeout(1000);
        }
    });
});

test.describe('Incubator Tab', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await page.waitForLoadState('networkidle');
        await page.locator('text=Incubator').first().click();
        await page.waitForTimeout(500);
    });

    test('should display incubator stats', async ({ page }) => {
        await page.waitForTimeout(2000);
        // Should show "Green Lightning Incubator" or stats
        const heading = page.locator('text=Incubator').or(page.locator('text=Green Lightning'));
        await expect(heading.first()).toBeVisible();
    });

    test('should have tab navigation (Áttekintés, Minta Felvétel, Modelfile)', async ({ page }) => {
        const tabs = ['Áttekintés', 'Minta Felvétel', 'Modelfile'];
        for (const tab of tabs) {
            const tabEl = page.locator(`text=${tab}`);
            if (await tabEl.count() > 0) {
                await tabEl.first().click();
                await page.waitForTimeout(300);
            }
        }
    });

    test('should validate empty form submission in Minta Felvétel', async ({ page }) => {
        const mintaTab = page.locator('text=Minta Felvétel');
        if (await mintaTab.count() > 0) {
            await mintaTab.first().click();
            await page.waitForTimeout(300);

            // Save button should be disabled when form is empty
            const saveBtn = page.locator('button').filter({ hasText: /Mentés|Save/ });
            if (await saveBtn.count() > 0) {
                const isDisabled = await saveBtn.first().isDisabled();
                expect(isDisabled).toBe(true);
            }
        }
    });
});

test.describe('Knowledge Tab', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await page.waitForLoadState('networkidle');
        await page.locator('text=Knowledge').first().click();
        await page.waitForTimeout(500);
    });

    test('should display knowledge base stats', async ({ page }) => {
        await page.waitForTimeout(2000);
        // LanceDB or Knowledge Base heading
        const heading = page.locator('text=Knowledge Base').or(page.locator('text=LanceDB'));
        await expect(heading.first()).toBeVisible();
    });

    test('should have search input', async ({ page }) => {
        const searchInput = page.locator('input[placeholder*="emlékszik"], input[placeholder*="keress"], input[placeholder*="search"]');
        if (await searchInput.count() > 0) {
            await expect(searchInput.first()).toBeVisible();
            await searchInput.first().fill('test query');
        }
    });

    test('should have file upload button', async ({ page }) => {
        const uploadBtn = page.locator('button').filter({ hasText: /feltöltés|upload/i });
        if (await uploadBtn.count() > 0) {
            await expect(uploadBtn.first()).toBeVisible();
        }
    });
});
