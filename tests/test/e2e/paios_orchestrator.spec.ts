import { test, expect } from '@playwright/test';

test.describe('PAIOS Orchestrator Chat E2E', () => {
    test.beforeEach(async ({ page }) => {
        // Mock the config endpoint
        await page.route('**/api/paios/config', async (route) => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    voice: {
                        response_voice: 'nova',
                        tts_model: 'tts-1',
                        speed: 1,
                    }
                }),
            });
        });

        // Mock the LLM catalog endpoint
        await page.route('**/api/v1/llm/catalog', async (route) => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    providers: [
                        {
                            id: 'github',
                            label: 'GitHub Models',
                            enabled: true,
                            defaultModel: 'gpt-4.1',
                            models: [{ id: 'gpt-4.1', name: 'gpt-4.1', provider: 'github', source: 'default' }]
                        }
                    ]
                }),
            });
        });

        // Navigate to the dashboard
        await page.goto('/');
    });

    test('should handle complex Hungarian user requests and verify UI updates', async ({ page }) => {
        // Network state inspection (Chrome DevTools capability equivalent in Playwright)
        const requests: string[] = [];
        page.on('request', request => {
            if (request.url().includes('/api/paios/chat')) {
                requests.push(request.url());
            }
        });

        // Navigate to PAIOS Orchestrator tab
        await page.getByRole('button', { name: /PAIOS Orchestrator/i }).click();

        // 1. Verify initial state
        await expect(page.getByText('Adj egy feladatot magyarul...')).toBeVisible();

        // 2. Mock the chat API response
        await page.route('**/api/paios/chat', async (route) => {
            // Simulate network delay to see the loading state
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    success: true,
                    summary: 'A kérésedet megértettem. Létrehozom az új API endpointot TDD módszertannal.',
                    provider: 'github',
                    model: 'gpt-4.1',
                    role: 'orchestrator',
                    thinkingMs: 450,
                    plan: [
                        { phase: 'Tervezés', agent: 'architect', task: 'API specifikáció elkészítése' },
                        { phase: 'Tesztelés', agent: 'tester', task: 'Unit tesztek megírása' },
                        { phase: 'Implementáció', agent: 'coder', task: 'Endpoint kódolása' }
                    ],
                    taskIds: [101, 102, 103],
                    actionsTriggered: [
                        { agent: 'architect', task: 'API specifikáció elkészítése', taskId: 101, status: 'started' }
                    ],
                    missionTimeline: [
                        { phase: 'Tervezés', status: 'started', detail: 'Architect ügynök inicializálva', timestamp: new Date().toISOString() }
                    ]
                }),
            });
        });

        // 3. Type a Hungarian request
        const input = page.getByPlaceholder('Írd be a feladatot magyarul... (Enter = küldés)');
        await input.fill('Készíts egy új API endpointot TDD-vel');

        // 4. Click Send
        // The send button is the last button in the input area
        const sendButton = page.locator('button:has(svg.lucide-send)');
        await sendButton.click();

        // 5. Verify loading state ("Orchestrator gondolkodik...")
        await expect(page.getByText('⏳ Orchestrator gondolkodik...')).toBeVisible();

        // Verify network request was made
        expect(requests.length).toBeGreaterThan(0);

        // 6. Verify the final assistant response appears
        await expect(page.getByText('A kérésedet megértettem. Létrehozom az új API endpointot TDD módszertannal.')).toBeVisible();

        // 7. Verify the plan details are rendered (they are hidden behind a "Részletek" button)
        const detailsButton = page.getByRole('button', { name: /Részletek/i }).first();
        await detailsButton.click();

        await expect(page.getByText('📋 Execution Plan')).toBeVisible();
        await expect(page.getByText('API specifikáció elkészítése')).toBeVisible();
        await expect(page.getByText('Unit tesztek megírása')).toBeVisible();
        await expect(page.getByText('Endpoint kódolása')).toBeVisible();

        // 8. Verify task IDs are rendered
        await expect(page.getByText('#101')).toBeVisible();
        await expect(page.getByText('#102')).toBeVisible();
        await expect(page.getByText('#103')).toBeVisible();

        // 9. Verify actions triggered
        await expect(page.getByText('🤖 Delegált műveletek:')).toBeVisible();
        await expect(page.getByText('architect: API specifikáció elkészítése')).toBeVisible();

        // 10. Verify mission timeline
        await expect(page.getByText('🧭 Mission Timeline')).toBeVisible();
        await expect(page.getByText('[started] Architect ügynök inicializálva')).toBeVisible();
    });

    test('should handle API errors gracefully', async ({ page }) => {
        await page.getByRole('button', { name: /PAIOS Orchestrator/i }).click();

        await page.route('**/api/paios/chat', async (route) => {
            await new Promise(resolve => setTimeout(resolve, 500));
            await route.fulfill({
                status: 500,
                contentType: 'application/json',
                body: JSON.stringify({ error: 'Internal Server Error' }),
            });
        });

        const input = page.getByPlaceholder('Írd be a feladatot magyarul... (Enter = küldés)');
        await input.fill('Hibás kérés');
        
        const sendButton = page.locator('button:has(svg.lucide-send)');
        await sendButton.click();

        // Verify error message in chat
        await expect(page.getByText('❌ Hiba: Internal Server Error')).toBeVisible();
    });
});
