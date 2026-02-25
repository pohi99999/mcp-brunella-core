import { test, expect } from '@playwright/test';
import axios from 'axios';

test.describe('🎯 Dashboard Functional Integrity Test', () => {
  
  test('Action: Send message to Orchestrator should trigger backend task', async ({ page }) => {
    // 1. Dashboard betöltése
    await page.goto('http://localhost:5173');
    await page.waitForTimeout(5000); // Splash screen megvárása
    await page.keyboard.press('Escape');

    // 2. Chat ablak megkeresése (ha nincs ott, átváltunk rá)
    const chatTab = page.locator('button:has-text("Neural Chat"), [data-nav-id="chat"]').first();
    if (await chatTab.isVisible()) {
      await chatTab.click();
      await page.waitForTimeout(1000);
    }

    // 3. Üzenet beírása
    const input = page.locator('textarea[placeholder*="Üzenet az Orchestratornak"], [data-testid="neural-chat-input"]').first();
    await input.fill('TEST_TASK_INTEGRITY_CHECK');
    
    // 4. Küldés gomb megnyomása
    const sendBtn = page.locator('button[aria-label="Send message"], [data-testid="neural-chat-send-button"]').first();
    await sendBtn.click();
    console.log("  Message sent via UI...");

    // 5. ELLENŐRZÉS: Megnézzük a Backenden, hogy bekerült-e a feladat
    // Várunk egy kicsit, hogy a szerver feldolgozza
    await page.waitForTimeout(3000);

    try {
      const response = await axios.get('http://localhost:3000/api/v1/tasks?limit=5');
      const tasks = response.data.tasks;
      
      const foundTask = tasks.find((t: any) => 
        t.task.includes('TEST_TASK_INTEGRITY_CHECK') || 
        t.description?.includes('TEST_TASK_INTEGRITY_CHECK')
      );

      if (foundTask) {
        console.log(`  ✅ SUCCESS: Task found in DB with ID: ${foundTask.id}, Status: ${foundTask.status}`);
      } else {
        console.error("  ❌ FAILURE: Message was sent but no task appeared in the backend queue.");
      }

      expect(foundTask, "A beküldött feladatnak meg kell jelennie a backend várólistáján").toBeDefined();
    } catch (e) {
      console.error("  ❌ ERROR: Could not connect to backend to verify task creation.");
      throw e;
    }
  });
});
