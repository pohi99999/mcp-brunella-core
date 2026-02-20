import { test, expect } from '@playwright/test';
test.describe('Mission Control Tab', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await page.waitForLoadState('networkidle');
    });
    test('should display agent cards or empty state', async ({ page }) => {
        // Wait for the main content to load
        await page.waitForTimeout(2000);
        // Should have either agent cards or a loading/empty indicator
        const agentCards = page.locator('[class*="agent"], [class*="card"]');
        const count = await agentCards.count();
        expect(count).toBeGreaterThan(0);
    });
    test('should toggle between list and graph view', async ({ page }) => {
        // Look for the view toggle buttons
        const listBtn = page.locator('button').filter({ hasText: /list/i }).or(page.locator('button[aria-label*="list"], button[title*="list"]'));
        const graphBtn = page.locator('button').filter({ hasText: /graph/i }).or(page.locator('button[aria-label*="graph"], button[title*="graph"]'));
        // If toggle buttons exist, click them
        if (await listBtn.count() > 0) {
            await listBtn.first().click();
            await page.waitForTimeout(300);
        }
        if (await graphBtn.count() > 0) {
            await graphBtn.first().click();
            await page.waitForTimeout(300);
            // ReactFlow canvas should appear
            const canvas = page.locator('.react-flow, [class*="reactflow"]');
            if (await canvas.count() > 0) {
                await expect(canvas.first()).toBeVisible();
            }
        }
    });
    test('should display SystemHealthCard widget', async ({ page }) => {
        // SystemHealthCard should show service status
        await page.waitForTimeout(2000);
        const healthTexts = ['Ollama', 'AnythingLLM', 'healthy', 'offline', 'Rendszer'];
        let found = false;
        for (const text of healthTexts) {
            if (await page.locator(`text=${text}`).first().isVisible().catch(() => false)) {
                found = true;
                break;
            }
        }
        expect(found).toBe(true);
    });
    test('should show terminal log section', async ({ page }) => {
        // TerminalLog component should exist
        const logArea = page.locator('[class*="terminal"], [class*="log"], [class*="scroll"]');
        await expect(logArea.first()).toBeVisible({ timeout: 5000 });
    });
});
