import { test, expect } from '@playwright/test';

test.describe('Dashboard V3 Smoke Test', () => {
    test('should display layout switcher and essential widgets', async ({ page }) => {
        // Navigáljunk a főoldalra
        await page.goto('/');
        
        // Várjunk a boot sequence végére (max 15s)
        await page.waitForSelector('text=NEURAL NETWORK OS', { timeout: 15000 });
        
        // Ellenőrizzük a Mission Control címet
        await expect(page.locator('h2:has-text("Mission Control")').first()).toBeVisible();

        // Ellenőrizzük a LAYOUT gombot
        const layoutBtn = page.locator('button:has-text("LAYOUT:")');
        await expect(layoutBtn).toBeVisible();
        
        // Kattintsunk a LAYOUT gombra
        await layoutBtn.click();
        
        // Ellenőrizzük a menüpontokat
        await expect(page.locator('text=Developer Mode')).toBeVisible();
        await expect(page.locator('text=Operations Mode')).toBeVisible();
        
        // Váltsunk Developer Mode-ra
        await page.locator('text=Developer Mode').click();
        
        // Ellenőrizzük, hogy a Terminal/Logs megjelent (dev-main terület)
        await expect(page.locator('text=terminal — mission-control')).toBeVisible();
        
        // Ellenőrizzük a Jules AI jelenlétét
        await expect(page.locator('text=Jules AI')).toBeVisible();
    });
});
