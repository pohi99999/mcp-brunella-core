import { expect, test, type Page } from '@playwright/test';

async function openMissionControl(page: Page) {
  await page.goto('/');
  await expect(page.getByTestId('mc-shell')).toBeVisible({ timeout: 15000 });
}

test.describe('Mission Control shell smoke', () => {
  test('loads the operator cockpit and the backend health endpoint', async ({ page, request }) => {
    const healthResponse = await request.get('http://localhost:3000/api/health');
    expect(healthResponse.ok()).toBeTruthy();

    await openMissionControl(page);

    await expect(page.getByTestId('mc-topbar')).toBeVisible();
    await expect(page.getByTestId('mc-sidebar')).toBeVisible();
    await expect(page.getByTestId('mc-core-status')).toBeVisible();
    await expect(page.getByTestId('mc-dashboard-home')).toBeVisible();
    await expect(page.getByTestId('mc-summary-strip')).toBeVisible();
    await expect(page.getByTestId('mc-widget-grid')).toBeVisible();
    await expect(page.getByTestId('mc-shell')).toHaveAttribute('data-active-panel', 'dashboard');
  });

  test('supports quick-access navigation without rendering a blank shell', async ({ page }) => {
    await openMissionControl(page);

    await page.getByTestId('mc-nav-item-tracks').first().click();
    await expect(page.getByTestId('mc-shell')).toHaveAttribute('data-active-panel', 'tracks');
    await expect(page.getByTestId('mc-panel-tracks')).toHaveAttribute('data-panel-state', 'ready');

    await page.getByTestId('mc-nav-item-cloudflare').first().click();
    await expect(page.getByTestId('mc-shell')).toHaveAttribute('data-active-panel', 'cloudflare');
    await expect(page.getByTestId('mc-panel-cloudflare')).toHaveAttribute('data-panel-state', 'ready');
  });

  test('opens command menu search and the utility drawer interactions', async ({ page }) => {
    await openMissionControl(page);

    await page.getByTestId('mc-command-trigger').click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    const commandInput = dialog.locator('input, [cmdk-input]').first();
    await expect(commandInput).toBeVisible();
    await commandInput.fill('Tracks');
    await dialog.getByText('Tracks').last().click();

    await expect(page.getByTestId('mc-shell')).toHaveAttribute('data-active-panel', 'tracks');

    const drawer = page.getByTestId('mc-utility-drawer');
    await expect(drawer).toHaveAttribute('data-open', 'false');

    await page.getByTestId('mc-drawer-toggle').click();
    await expect(drawer).toHaveAttribute('data-open', 'true');

    await page.getByTestId('mc-drawer-toggle').click();
    await expect(drawer).toHaveAttribute('data-open', 'false');
  });
});
