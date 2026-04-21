import { test, expect } from '@playwright/test';

test.describe('Dashboard V3 Integrity & Visual Verification', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        // Várjunk, amíg a Mission Control cím látható lesz
        await expect(page.getByRole('heading', { name: 'Mission Control' })).toBeVisible({ timeout: 20000 });
    });

    test('should have the three-tier Integrated Shell structure', async ({ page }) => {
        // 1. Header Verification
        const header = page.locator('header');
        await expect(header).toBeVisible();
        const headerHeight = await header.evaluate((el) => el.getBoundingClientRect().height);
        expect(headerHeight).toBeCloseTo(64, 1);

        // 2. Main Content (Masonry) Verification
        const main = page.getByRole('main');
        await expect(main).toBeVisible();
        const masonryContainer = main.locator('div[class*="columns-"]');
        await expect(masonryContainer).toBeVisible();

        // 3. Docked Terminal Footer Verification
        const footer = page.getByRole('contentinfo');
        await expect(footer).toBeVisible();
        
        const footerStyles = await footer.evaluate((el) => {
            const style = window.getComputedStyle(el);
            return {
                borderTopWidth: style.borderTopWidth,
                backgroundColor: style.backgroundColor
            };
        });
        
        expect(footerStyles.borderTopWidth).toBe('1px');
        // Elfogadjuk az oklab, oklch, rgb és rgba formátumokat is
        expect(footerStyles.backgroundColor).toMatch(/(rgb|rgba|oklch|oklab)/);
    });

    test('should have ultra-minimalist card styling', async ({ page }) => {
        // Keressünk egy kártyát a belső szövege alapján (az elsőt használjuk a duplikációk elkerülésére)
        const healthText = page.getByText('SYSTEM ENGINE HEALTH').first();
        await expect(healthText).toBeVisible();

        const styles = await healthText.evaluate((el) => {
            const computed = window.getComputedStyle(el);
            return {
                textTransform: computed.textTransform,
                color: computed.color
            };
        });

        expect(styles.textTransform).toBe('uppercase');
        expect(styles.color).toMatch(/(rgb|rgba|oklch|oklab)/);
    });

    test('should handle layout switching correctly', async ({ page }) => {
        const layoutBtn = page.getByRole('button', { name: /LAYOUT:/ });
        await layoutBtn.click();
        
        const devModeOption = page.getByText('Developer Mode');
        await expect(devModeOption).toBeVisible();
        await devModeOption.click();

        await expect(layoutBtn).toContainText('DEVELOPER_MODE');
    });

    test('should have functional terminal monospace typography', async ({ page }) => {
        const terminalText = page.getByText('terminal — mission-control').first();
        await expect(terminalText).toBeVisible();

        const font = await terminalText.evaluate((el) => {
            const target = el.closest('.font-mono') || el;
            return window.getComputedStyle(target).fontFamily;
        });
        expect(font.toLowerCase()).toMatch(/(mono|consolas|courier|jetbrains)/);
    });
});
