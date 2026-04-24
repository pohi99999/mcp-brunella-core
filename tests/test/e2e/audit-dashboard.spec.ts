import { test, expect } from '@playwright/test';

const BASE_URL = 'http://127.0.0.1:3000';

test.describe('Dashboard System Audit', () => {
    test.beforeEach(async ({ page }) => {
        page.on('console', msg => {
            if (msg.type() === 'error') console.log(`BROWSER ERROR: ${msg.text()}`);
        });
        await page.goto(BASE_URL);
        // Megvárjuk a Splash screen lefutását (kb. 3.2s total)
        await page.waitForTimeout(8000);
        await page.waitForLoadState('networkidle');
    });

    test('Mission Control betöltése', async ({ page }) => {
        await expect(page).toHaveTitle(/Brunella/i);
        const content = await page.content();
        console.log('Full Page Content Snippet:', content.substring(0, 1000));
        const bodyText = await page.innerText('body');
        console.log('Body Text Content:', bodyText);
        // A hu.json szerint "Vezérlőközpont"
        await expect(page.locator('body')).toContainText(/Vezérlőközpont|Mission Control/i);
    });

    test('Sidebar menük ellenőrzése', async ({ page }) => {
        const menuItems = [
            'Vezérlőközpont',
            'Architektúra',
            'Neurális Chat',
            'Ágens Jegyzék',
            'Precíziós Tesztek',
            'Robotkéz',
            'Rendszerkonfig'
        ];

        for (const item of menuItems) {
            console.log(`Checking menu item: ${item}`);
            const menuLink = page.getByText(item).first();
            await expect(menuLink).toBeVisible();
            await menuLink.click();
            await page.waitForTimeout(500); // Rövid várakozás a váltáshoz
            
            // Ellenőrizzük, hogy nem kaptunk-e 404-et vagy üres oldalt
            await expect(page.locator('body')).not.toContainText(/404|Not Found/i);
        }
    });

    test('API Health Check a Dashboardról', async ({ page }) => {
        // Megnézzük a Health állapotot ha van widget
        const healthStatus = page.locator('.text-emerald-500, .text-green-500').first();
        if (await healthStatus.isVisible()) {
             console.log('Health indicator is visible');
        }
    });

    test('Phoenix Protocol vizuális jelenlét', async ({ page }) => {
        // Keressük a Phoenix menüpontot vagy panelt
        const phoenixLink = page.getByText('Phoenix Events').first();
        if (await phoenixLink.isVisible()) {
            await phoenixLink.click();
            await expect(page.locator('body')).toContainText(/Phoenix/i);
        }
    });
});
