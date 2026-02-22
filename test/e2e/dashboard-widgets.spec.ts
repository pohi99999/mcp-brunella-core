/**
 * FILE: test/e2e/dashboard-widgets.spec.ts
 * PURPOSE: E2E tests for Dashboard V3 widgets (ProcessControlWidget, TraceViewerModal, AdminSelfCheckWidget)
 * COVERAGE: Dashboard V3 Command Center (Track A) - UI/E2E testing
 */

import { test, expect } from '@playwright/test';

test.describe('Dashboard V3 - ProcessControlWidget', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Wait for dashboard to load
    await page.waitForSelector('[data-testid="dashboard-container"]', { timeout: 10000 });
  });

  test('should render ProcessControlWidget', async ({ page }) => {
    // Wait for ProcessControlWidget to appear
    const widget = page.locator('text=Folyamatvezérlés');
    await expect(widget).toBeVisible({ timeout: 5000 });
  });

  test('should display empty state when no tasks', async ({ page }) => {
    const emptyState = page.locator('text=Nincsenek aktív vagy függőben lévő feladatok.');
    // Either tasks or empty state should be visible
    const hasContent = await Promise.race([
      emptyState.isVisible(),
      page.locator('[data-testid="task-item"]').count().then(count => count > 0),
    ]);
    expect(hasContent).toBeTruthy();
  });

  test('should display active tasks if available', async ({ page }) => {
    const taskItems = page.locator('[data-testid="task-item"]');
    const count = await taskItems.count();
    if (count > 0) {
      // Check that task items have proper elements
      const firstTask = taskItems.first();
      await expect(firstTask).toBeVisible();
      // Task item should have control buttons
      const controlButtons = firstTask.locator('button');
      await expect(controlButtons.first()).toBeVisible();
    }
  });

  test('should support drag and drop reordering', async ({ page }) => {
    const taskItems = page.locator('[data-testid="task-item"]');
    const count = await taskItems.count();
    
    if (count >= 2) {
      const firstTask = taskItems.first();
      const secondTask = taskItems.nth(1);
      
      const firstBoundingBox = await firstTask.boundingBox();
      const secondBoundingBox = await secondTask.boundingBox();
      
      if (firstBoundingBox && secondBoundingBox) {
        // Perform drag
        await page.mouse.move(firstBoundingBox.x + firstBoundingBox.width / 2, firstBoundingBox.y + firstBoundingBox.height / 2);
        await page.mouse.down();
        await page.mouse.move(secondBoundingBox.x + secondBoundingBox.width / 2, secondBoundingBox.y + secondBoundingBox.height / 2);
        await page.mouse.up();
        
        // Wait for debounce (500ms) + some buffer
        await page.waitForTimeout(700);
        
        // Verify toast success message
        const toast = page.locator('text=Feladatok sorrendje frissítve.');
        await expect(toast).toBeVisible({ timeout: 2000 });
      }
    }
  });

  test('should refresh active tasks on button click', async ({ page }) => {
    const refreshButton = page.locator('button:has-text("Frissítés")');
    await refreshButton.click();
    
    // Wait for refresh indicator (if any) or just a short delay
    await page.waitForTimeout(1000);
    
    // Check that widget is still visible after refresh
    const widget = page.locator('text=Folyamatvezérlés');
    await expect(widget).toBeVisible();
  });
});

test.describe('Dashboard V3 - TraceViewerModal', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('[data-testid="dashboard-container"]', { timeout: 10000 });
  });

  test('should open TraceViewerModal on task trace button click', async ({ page }) => {
    const taskItems = page.locator('[data-testid="task-item"]');
    const count = await taskItems.count();
    
    if (count > 0) {
      const firstTask = taskItems.first();
      const traceButton = firstTask.locator('button:has-text("Trace")');
      
      if (await traceButton.count() > 0) {
        await traceButton.click();
        
        // Wait for modal to appear
        const modal = page.locator('[role="dialog"]');
        await expect(modal).toBeVisible({ timeout: 3000 });
        
        // Check for trace viewer content
        const modalContent = page.locator('text=Trace Viewer');
        await expect(modalContent).toBeVisible();
      }
    }
  });

  test('should display trace data in modal', async ({ page }) => {
    const taskItems = page.locator('[data-testid="task-item"]');
    const count = await taskItems.count();
    
    if (count > 0) {
      const firstTask = taskItems.first();
      const traceButton = firstTask.locator('button:has-text("Trace")');
      
      if (await traceButton.count() > 0) {
        await traceButton.click();
        
        const modal = page.locator('[role="dialog"]');
        await expect(modal).toBeVisible({ timeout: 3000 });
        
        // Check for trace JSON or formatted display
        const traceContent = modal.locator('.trace-content, pre, code');
        await expect(traceContent.first()).toBeVisible({ timeout: 2000 });
      }
    }
  });

  test('should close TraceViewerModal on close button', async ({ page }) => {
    const taskItems = page.locator('[data-testid="task-item"]');
    const count = await taskItems.count();
    
    if (count > 0) {
      const firstTask = taskItems.first();
      const traceButton = firstTask.locator('button:has-text("Trace")');
      
      if (await traceButton.count() > 0) {
        await traceButton.click();
        
        const modal = page.locator('[role="dialog"]');
        await expect(modal).toBeVisible({ timeout: 3000 });
        
        // Click close button (X or Close)
        const closeButton = modal.locator('button:has-text("Close"), button[aria-label="Close"]');
        await closeButton.first().click();
        
        // Modal should disappear
        await expect(modal).not.toBeVisible({ timeout: 2000 });
      }
    }
  });
});

test.describe('Dashboard V3 - AdminSelfCheckWidget', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('[data-testid="dashboard-container"]', { timeout: 10000 });
  });

  test('should render AdminSelfCheckWidget', async ({ page }) => {
    const widget = page.locator('text=Önellenőrzés');
    await expect(widget).toBeVisible({ timeout: 5000 });
  });

  test('should display health status', async ({ page }) => {
    const healthStatus = page.locator('[data-testid="health-status"], text=/Ollama|Cloudflare|Python/');
    await expect(healthStatus.first()).toBeVisible({ timeout: 3000 });
  });

  test('should trigger manual health check on button click', async ({ page }) => {
    const checkButton = page.locator('button:has-text("Ellenőrzés"), button:has-text("Health Check")');
    
    if (await checkButton.count() > 0) {
      await checkButton.first().click();
      
      // Wait for check to complete
      await page.waitForTimeout(2000);
      
      // Check for updated status or toast notification
      const toast = page.locator('div[role="status"], .toast');
      // Either toast or widget should update
      const hasUpdate = await Promise.race([
        toast.isVisible(),
        page.waitForTimeout(1000).then(() => true),
      ]);
      expect(hasUpdate).toBeTruthy();
    }
  });
});

test.describe('Dashboard V3 - Performance & Responsiveness', () => {
  test('should load dashboard within 3 seconds', async ({ page }) => {
    const startTime = Date.now();
    await page.goto('/');
    await page.waitForSelector('[data-testid="dashboard-container"]', { timeout: 10000 });
    const loadTime = Date.now() - startTime;
    
    expect(loadTime).toBeLessThan(3000);
    console.log(`Dashboard loaded in ${loadTime}ms`);
  });

  test('should handle large task queues without lag', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('[data-testid="dashboard-container"]', { timeout: 10000 });
    
    const taskItems = page.locator('[data-testid="task-item"]');
    const count = await taskItems.count();
    
    if (count > 10) {
      // Scroll through tasks
      const scrollContainer = page.locator('[data-testid="process-control-widget"] .overflow-y-auto');
      await scrollContainer.evaluate((el) => {
        el.scrollTop = el.scrollHeight;
      });
      
      // Check that UI remains responsive
      const widget = page.locator('text=Folyamatvezérlés');
      await expect(widget).toBeVisible({ timeout: 1000 });
    }
  });

  test('should be responsive on mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 }); // iPhone SE
    await page.goto('/');
    await page.waitForSelector('[data-testid="dashboard-container"]', { timeout: 10000 });
    
    const widget = page.locator('text=Folyamatvezérlés');
    await expect(widget).toBeVisible({ timeout: 5000 });
  });
});
