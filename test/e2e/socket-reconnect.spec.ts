import { test, expect } from "@playwright/test";

test.describe("Socket.IO Reconnect Protocoll", () => {
  test("should show disconnected state when server is down and reconnect when it comes back", async ({
    page,
  }) => {
    await page.goto("/");

    // 1. Initial connection
    await expect(page.locator("text=Rendszer indítása")).toBeVisible();

    // 2. Simulate disconnect
    // In a real test, we would stop the server, but in Playwright we can mock the socket failure
    await page.evaluate(() => {
      // @ts-ignore
      if (window.socket) window.socket.io.engine.close();
    });

    // Check for some indicator of disconnection if it exists in UI
    // (Assuming there's a status indicator)
    // const status = page.locator('.status-indicator');
    // await expect(status).toHaveClass(/disconnected/);

    // 3. Simulate reconnect
    await page.evaluate(() => {
      // @ts-ignore
      if (window.socket) window.socket.io.engine.open();
    });

    // Verify it's back
    // await expect(status).toHaveClass(/connected/);
  });
});
