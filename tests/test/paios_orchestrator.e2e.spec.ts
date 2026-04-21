import { test, expect } from '@playwright/test';

test.describe('PAIOS Orchestrator Chat E2E', () => {
    test.beforeEach(async ({ page }) => {
        // Mock a backend response to simulate the Orchestrator's reply
        await page.route('/api/paios/chat', async (route) => {
            await new Promise(resolve => setTimeout(resolve, 500)); // Szimulált késleltetés
            const json = {
                success: true,
                reply: 'Sikeresen delegáltam a feladatot az n8n workflow-nak.',
                actionsTriggered: [{ agent: 'automatizalas', task: 'n8n trigger', taskId: 101, status: 'completed' }],
                provider: 'github',
                model: 'gpt-4o',
                missionTimeline: [
                    { phase: 'Tervezés', status: 'completed', detail: 'Azonosítottam a szándékot.', timestamp: new Date().toISOString() }
                ]
            };
            await route.fulfill({ json });
        });

        await page.goto('/'); // Assuming dashboard runs on /
    });

    test('Tud küldeni egy magyar promptot és reagál az orchestrator visszajelzésére', async ({ page }) => {
        // Navigáció a PAIOS Chat fülre, ha szükséges (vagy már ott van)
        // Megkeressük a chat inputot
        const inputField = page.getByPlaceholder('Írd be a feladatot magyarul... (Enter = küldés)');
        await expect(inputField).toBeVisible();

        // Beírunk egy teszt szöveget
        const testPrompt = 'Futtass egy rendszerellenőrzést a Cloudflare Edge-en.';
        await inputField.fill(testPrompt);
        
        // Küldés (Enter nyomás)
        await inputField.press('Enter');

        // Ellenőrizzük, hogy megjelent-e a felhasználó üzenete
        await expect(page.locator('.max-w-[80%]', { hasText: testPrompt })).toBeVisible();

        // Ellenőrizzük a töltő állapotot (Orchestrator gondolkodik)
        const loadingIndicator = page.locator('text=Orchestrator gondolkodik...');
        await expect(loadingIndicator).toBeVisible();

        // Várunk a mockolt válaszra
        const assistantReply = page.locator('text=Sikeresen delegáltam a feladatot az n8n workflow-nak.');
        await expect(assistantReply).toBeVisible({ timeout: 5000 });

        // Ellenőrizzük a metainformációkat (pl. Modell badge)
        const modelBadge = page.locator('text=gpt-4o');
        await expect(modelBadge).toBeVisible();

        // A töltő állapot eltűnt
        await expect(loadingIndicator).toBeHidden();
    });
});
