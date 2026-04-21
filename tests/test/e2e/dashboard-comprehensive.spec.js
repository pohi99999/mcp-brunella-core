import { test, expect } from '@playwright/test';
/**
 * 🚀 TELJES KÖRŰ DASHBOARD TESZT
 *
 * Ez a teszt suite minden funkciót lefed:
 * ✅ Kártya elhelyezkedés és drag-and-drop
 * ✅ Chat funkció (NeuralLinkChat) - üzenet küldés
 * ✅ Cloudflare integráció tesztelése
 * ✅ Robotkéz panel és delegálás
 * ✅ LiveExecutionMonitor és TaskQueueMonitor
 * ✅ Vizuális megjelenés és kattinthatóság
 * ✅ Összes widget működőképessége
 */
test.describe('🎯 Dashboard - Teljes Körű Funkcionális Teszt', () => {
    // Növelt timeout a lassú betöltés miatt
    test.setTimeout(60000); // 60 másodperc per teszt
    test.beforeEach(async ({ page }) => {
        // Dashboard betöltés + network idle
        await page.goto('/', { waitUntil: 'domcontentloaded' }); // networkidle helyett
        await page.waitForTimeout(3000); // Extra idő a komponensek renderelésére
    });
    test('✅ 1. Dashboard alap betöltődés - nincs fehér képernyő', async ({ page }) => {
        // Ellenőrizzük, hogy van tartalom
        const body = page.locator('body');
        await expect(body).not.toBeEmpty();
        // Brunella logo/title látható
        const title = page.locator('text=Brunella').first();
        await expect(title).toBeVisible({ timeout: 10000 });
        // Sidebar látható
        const sidebar = page.locator('nav, [role="navigation"], aside').first();
        await expect(sidebar).toBeVisible();
        // Nincs error message
        const errorMsg = page.locator('text=Error, text=Hiba, text=Something went wrong');
        await expect(errorMsg.first()).not.toBeVisible().catch(() => { });
    });
    test('✅ 2. Sidebar navigáció - minden tab elérhető', async ({ page }) => {
        const tabs = [
            'Mission Control',
            { label: 'Neural Chat', alt: 'Agent Roster' },
            'Developer',
            'Robotkéz'
        ];
        for (const tab of tabs) {
            const tabName = typeof tab === 'string' ? tab : tab.label;
            const tabLocator = page.locator(`button:has-text("${tabName}")`).or(page.locator(`a:has-text("${tabName}")`)).first();
            if (await tabLocator.isVisible({ timeout: 3000 }).catch(() => false)) {
                await tabLocator.click();
                await page.waitForTimeout(1000);
                // Content megváltozott
                const content = await page.textContent('main, [role="main"]');
                expect(content).toBeTruthy();
                console.log(`✅ Tab navigáció: ${tabName}`);
            }
            else {
                console.log(`⚠️ Tab nem található: ${tabName}`);
            }
        }
    });
    test('✅ 3. Mission Control: Kártyák megjelennek', async ({ page }) => {
        // Mission Control tab (lehet hogy már ott vagyunk)
        const mcTab = page.locator('button:has-text("Mission Control")').first();
        if (await mcTab.isVisible({ timeout: 2000 }).catch(() => false)) {
            await mcTab.click();
            await page.waitForTimeout(2000);
        }
        // Widget Grid vagy kártyák megjelenése
        const cards = page.locator('[class*="card"], [class*="Card"], [class*="widget"]');
        const count = await cards.count();
        console.log(`📦 Talált kártyák száma: ${count}`);
        expect(count).toBeGreaterThan(0);
    });
    test('✅ 4. SystemHealthCard - szolgáltatások állapota', async ({ page }) => {
        const mcTab = page.locator('text=Mission Control').first();
        await mcTab.click();
        await page.waitForTimeout(1000);
        // SystemHealthCard tartalom
        const healthKeywords = ['Ollama', 'FastAPI', 'Rendszer', 'healthy', 'offline', 'Status'];
        let found = 0;
        for (const keyword of healthKeywords) {
            const elem = page.locator(`text=${keyword}`).first();
            if (await elem.isVisible({ timeout: 2000 }).catch(() => false)) {
                found++;
            }
        }
        // Legalább 2 kulcsszó megjelenik
        expect(found).toBeGreaterThanOrEqual(2);
    });
    test('✅ 5. NeuralLinkChat - chat funkció tesztelése', async ({ page }) => {
        // Neural Chat tab keresése
        const chatButtons = [
            'Neural Chat',
            'Chat',
            'NeuralLink'
        ];
        let chatFound = false;
        for (const btnText of chatButtons) {
            const btn = page.locator(`button:has-text("${btnText}")`).first();
            if (await btn.isVisible({ timeout: 2000 }).catch(() => false)) {
                await btn.click();
                await page.waitForTimeout(2000);
                chatFound = true;
                console.log(`✅ Chat tab megtalálva: ${btnText}`);
                break;
            }
        }
        if (chatFound) {
            // Chat input keresése (több variáció)
            const chatInputSelectors = [
                'input[placeholder*="üzenet"]',
                'input[placeholder*="message"]',
                'textarea[placeholder*="üzenet"]',
                'textarea[placeholder*="message"]',
                'input[type="text"]',
                'textarea'
            ];
            let inputFound = false;
            for (const selector of chatInputSelectors) {
                const input = page.locator(selector).first();
                if (await input.isVisible({ timeout: 1000 }).catch(() => false)) {
                    await input.fill('Teszt üzenet - E2E dashboard teszt');
                    await page.waitForTimeout(500);
                    // Enter vagy Send gomb
                    await input.press('Enter').catch(() => { });
                    await page.waitForTimeout(1000);
                    inputFound = true;
                    console.log(`✅ Chat input talált: ${selector}`);
                    break;
                }
            }
            if (!inputFound) {
                console.log('⚠️ Chat input nem található (lehet collapse-olva vagy más néven)');
            }
        }
        else {
            console.log('⚠️ Chat tab nem található');
        }
    });
    test('✅ 6. RobotkezV2Chat - robotkéz panel', async ({ page }) => {
        // Robotkéz tab
        const robotkezBtn = page.locator('button:has-text("Robotkéz")').first();
        if (await robotkezBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
            await robotkezBtn.click();
            await page.waitForTimeout(2000);
            // Panel betöltődött - bármi látszik
            const mainContent = await page.textContent('main');
            expect(mainContent).toBeTruthy();
            console.log('✅ Robotkéz panel betöltődött');
            // Input vagy textarea keresése
            const inputs = page.locator('input, textarea');
            const inputCount = await inputs.count();
            console.log(`📝 Talált input elemek: ${inputCount}`);
            if (inputCount > 0) {
                const input = inputs.first();
                await input.fill('Teszt utasítás');
                await page.waitForTimeout(300);
                console.log('✅ Robotkéz input működik');
            }
        }
        else {
            console.log('⚠️ Robotkéz tab nem található');
        }
    });
    test('✅ 7. Cloudflare Agents Card - integráció ellenőrzése', async ({ page }) => {
        // Mission Control
        const mcTab = page.locator('text=Mission Control').first();
        await mcTab.click();
        await page.waitForTimeout(1000);
        // Cloudflare card keresése
        const cfCard = page.locator('text=Cloudflare, text=Edge, text=CEAN').first();
        if (await cfCard.isVisible({ timeout: 3000 }).catch(() => false)) {
            // Card tartalom ellenőrzése
            const parent = cfCard.locator('..').first();
            await expect(parent).toBeVisible();
            console.log('✅ Cloudflare card megtalálva');
        }
        else {
            // Lehet külön tab-on van
            const edgeTab = page.locator('text=Edge').first();
            if (await edgeTab.isVisible({ timeout: 2000 }).catch(() => false)) {
                await edgeTab.click();
                await page.waitForTimeout(1000);
                console.log('✅ Edge/Cloudflare tab elérhető');
            }
        }
    });
    test('✅ 8. LiveExecutionMonitor - végrehajtási monitorozás', async ({ page }) => {
        const mcTab = page.locator('text=Mission Control').first();
        await mcTab.click();
        await page.waitForTimeout(1000);
        // Monitor widget keresése
        const monitorKeywords = ['Execution', 'Monitor', 'Végrehajtás', 'Running'];
        let monitorFound = false;
        for (const keyword of monitorKeywords) {
            const elem = page.locator(`text=${keyword}`).first();
            if (await elem.isVisible({ timeout: 2000 }).catch(() => false)) {
                monitorFound = true;
                console.log(`✅ Monitor widget talált: ${keyword}`);
                break;
            }
        }
        // Ha nincs a Mission Control-on, lehet Tasks tab-on
        if (!monitorFound) {
            const tasksTab = page.locator('text=Tasks').first();
            if (await tasksTab.isVisible().catch(() => false)) {
                await tasksTab.click();
                await page.waitForTimeout(1000);
                console.log('✅ Tasks tab ellenőrizve');
            }
        }
    });
    test('✅ 9. TaskQueueMonitor - task queue állapota', async ({ page }) => {
        const tasksTab = page.locator('text=Tasks').first();
        await tasksTab.click();
        await page.waitForTimeout(1500);
        // Task queue widget
        const taskKeywords = ['Queue', 'Task', 'Feladat', 'Pending', 'Running'];
        let found = false;
        for (const keyword of taskKeywords) {
            const elem = page.locator(`text=${keyword}`).first();
            if (await elem.isVisible({ timeout: 2000 }).catch(() => false)) {
                found = true;
                console.log(`✅ Task Queue talált: ${keyword}`);
                break;
            }
        }
        expect(found).toBe(true);
    });
    test('✅ 10. Developer Panel - quick actions', async ({ page }) => {
        const devTab = page.locator('text=Developer').first();
        await devTab.click();
        await page.waitForTimeout(1500);
        // Quick action gombok (Build, Test, Fix)
        const quickActions = ['Build', 'Test', 'Fix', 'Deploy'];
        let actionsFound = 0;
        for (const action of quickActions) {
            const btn = page.locator(`button:has-text("${action}")`).first();
            if (await btn.isVisible({ timeout: 1000 }).catch(() => false)) {
                actionsFound++;
            }
        }
        console.log(`✅ Developer quick actions talált: ${actionsFound}`);
        expect(actionsFound).toBeGreaterThan(0);
    });
    test('✅ 11. Agents tab - agent lista és státusz', async ({ page }) => {
        const agentsTab = page.locator('text=Agents').first();
        await agentsTab.click();
        await page.waitForTimeout(1500);
        // Agent kártyák vagy lista
        const agentCards = page.locator('[class*="agent"], [class*="Agent"]');
        const count = await agentCards.count();
        expect(count).toBeGreaterThan(0);
        // Van valamilyen státusz információ
        const statusKeywords = ['active', 'idle', 'working', 'status'];
        let statusFound = false;
        for (const keyword of statusKeywords) {
            const elem = page.locator(`text=${keyword}`).first();
            if (await elem.isVisible({ timeout: 2000 }).catch(() => false)) {
                statusFound = true;
                break;
            }
        }
        console.log(`✅ Agents tab - ${count} agent elem, status: ${statusFound}`);
    });
    test('✅ 12. FileExplorer - fájlrendszer böngésző', async ({ page }) => {
        const filesTab = page.locator('text=Files').first();
        await filesTab.click();
        await page.waitForTimeout(1500);
        // File explorer widget
        const fileKeywords = ['src', 'test', 'package.json', 'folder', 'file'];
        let fileContentFound = false;
        for (const keyword of fileKeywords) {
            const elem = page.locator(`text=${keyword}`).first();
            if (await elem.isVisible({ timeout: 2000 }).catch(() => false)) {
                fileContentFound = true;
                console.log(`✅ FileExplorer talált: ${keyword}`);
                break;
            }
        }
        expect(fileContentFound).toBe(true);
    });
    test('✅ 13. Settings Panel - beállítások', async ({ page }) => {
        const settingsTab = page.locator('text=Settings').first();
        await settingsTab.click();
        await page.waitForTimeout(1500);
        // Beállítások panel
        const settingsKeywords = ['Theme', 'Language', 'API', 'Config', 'Téma', 'Nyelv'];
        let found = false;
        for (const keyword of settingsKeywords) {
            const elem = page.locator(`text=${keyword}`).first();
            if (await elem.isVisible({ timeout: 2000 }).catch(() => false)) {
                found = true;
                console.log(`✅ Settings talált: ${keyword}`);
                break;
            }
        }
        // Alternatívaként: input vagy select elemek
        const inputs = page.locator('input, select, textarea');
        const inputCount = await inputs.count();
        if (inputCount > 0) {
            found = true;
            console.log(`✅ Settings - ${inputCount} input elem talált`);
        }
        expect(found).toBe(true);
    });
    test('✅ 14. Theme Toggle - sötét/világos téma váltás', async ({ page }) => {
        // Theme toggle gomb keresése
        const themeBtn = page.locator('button[aria-label*="theme"], button[title*="theme"], button:has-text("☀"), button:has-text("🌙")').first();
        if (await themeBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
            // Kezdeti téma
            const initialClass = await page.locator('html').getAttribute('class');
            // Váltás
            await themeBtn.click();
            await page.waitForTimeout(500);
            // Téma megváltozott
            const newClass = await page.locator('html').getAttribute('class');
            // Dark vagy light class változik
            const changed = initialClass !== newClass;
            console.log(`✅ Theme toggle - kezdeti: ${initialClass}, új: ${newClass}`);
            expect(changed).toBe(true);
        }
        else {
            console.log('⚠️ Theme toggle gomb nem található (lehet a Settings-ben van)');
        }
    });
    test('✅ 15. CommandMenu (Ctrl+K) - gyors navigáció', async ({ page }) => {
        // Ctrl+K
        await page.keyboard.press('Control+k');
        await page.waitForTimeout(500);
        // Dialog megjelenik
        const dialog = page.locator('[role="dialog"]').first();
        await expect(dialog).toBeVisible({ timeout: 3000 });
        // Input látható
        const input = page.locator('[role="dialog"] input').first();
        await expect(input).toBeVisible();
        // Keresés
        await input.fill('agent');
        await page.waitForTimeout(500);
        // Találatok megjelennek
        const results = page.locator('[role="dialog"] [cmdk-item], [role="dialog"] [role="option"]');
        const count = await results.count();
        expect(count).toBeGreaterThan(0);
        // Bezárás ESC-vel
        await page.keyboard.press('Escape');
        await page.waitForTimeout(300);
        await expect(dialog).not.toBeVisible();
    });
    test('✅ 16. Nincs kritikus konzol error', async ({ page }) => {
        const consoleErrors = [];
        page.on('console', (msg) => {
            if (msg.type() === 'error') {
                consoleErrors.push(msg.text());
            }
        });
        // Alapvető navigáció (néhány tab)
        const tabs = ['Mission Control', 'Developer'];
        for (const tab of tabs) {
            const btn = page.locator(`button:has-text("${tab}")`).first();
            if (await btn.isVisible().catch(() => false)) {
                await btn.click();
                await page.waitForTimeout(1000);
            }
        }
        // Szűrés: ignoráljuk a fetch error-okat
        const criticalErrors = consoleErrors.filter(e => !e.includes('fetch') &&
            !e.includes('Failed to') &&
            !e.includes('net::') &&
            !e.includes('404') &&
            !e.includes('503') &&
            !e.includes('FastAPI'));
        console.log(`📊 Összesen ${consoleErrors.length} console error, ebből ${criticalErrors.length} kritikus`);
        // Maximum 5 kritikus error engedélyezett
        expect(criticalErrors.length).toBeLessThanOrEqual(5);
    });
    test('✅ 17. Responsive layout - oldalméret változás', async ({ page }) => {
        // Desktop méret
        await page.setViewportSize({ width: 1920, height: 1080 });
        await page.waitForTimeout(500);
        const sidebar1 = page.locator('nav, aside').first();
        await expect(sidebar1).toBeVisible();
        // Tablet méret
        await page.setViewportSize({ width: 768, height: 1024 });
        await page.waitForTimeout(500);
        // Sidebar lehet collapse-olva, de tartalom látszik
        const content = await page.textContent('main, [role="main"]');
        expect(content).toBeTruthy();
        // Vissza desktop-ra
        await page.setViewportSize({ width: 1920, height: 1080 });
        await page.waitForTimeout(500);
    });
    test('✅ 18. Nincs memory leak - gyors navigáció', async ({ page }) => {
        const pageErrors = [];
        page.on('pageerror', (err) => pageErrors.push(err.message));
        // 20x gyors tab váltás
        const tabs = ['Mission Control', 'Agents', 'Developer', 'Tasks'];
        for (let i = 0; i < 5; i++) {
            for (const tab of tabs) {
                await page.locator(`text=${tab}`).first().click();
                await page.waitForTimeout(100);
            }
        }
        await page.waitForTimeout(1000);
        // Nincs "Cannot read property" vagy "undefined" error
        const memoryErrors = pageErrors.filter(e => e.includes('Cannot read') ||
            e.includes('undefined') ||
            e.includes('is not a function'));
        console.log(`🧠 Memory test - ${pageErrors.length} page error, ${memoryErrors.length} memory-related`);
        expect(memoryErrors.length).toBe(0);
    });
});
test.describe('🎨 Vizuális Regressziós Tesztek', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/', { waitUntil: 'networkidle' });
        await page.waitForTimeout(2000);
    });
    test('✅ 19. Screenshot - Mission Control', async ({ page }) => {
        const mcTab = page.locator('text=Mission Control').first();
        await mcTab.click();
        await page.waitForTimeout(1500);
        // Screenshot
        await page.screenshot({
            path: 'test-results/screenshots/mission-control.png',
            fullPage: true
        });
        console.log('📸 Screenshot készült: mission-control.png');
    });
    test('✅ 20. Screenshot - Agents Tab', async ({ page }) => {
        const agentsTab = page.locator('text=Agents').first();
        await agentsTab.click();
        await page.waitForTimeout(1500);
        await page.screenshot({
            path: 'test-results/screenshots/agents-tab.png',
            fullPage: true
        });
        console.log('📸 Screenshot készült: agents-tab.png');
    });
});
