/**
 * BAS Comprehensive Test Protocol - Socket.IO Reconnect E2E
 *
 * Tests the Socket.IO reconnection behavior with direct socket state verification.
 * Validates that the Socket.IO client correctly handles disconnections and reconnections.
 */

import { test, expect } from "@playwright/test";

const DASHBOARD_URL = "http://localhost:3000";

test.describe("Socket.IO Reconnect Protocol", () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to dashboard
    await page.goto(DASHBOARD_URL);

    // Wait for initial connection and React hydration
    await page.waitForTimeout(2000);
  });

  test("should establish initial socket connection", async ({ page }) => {
    // Check that dashboard loads successfully
    await expect(page).toHaveTitle(/Brunella|Mission Control/i);

    // Verify socket is connected
    const isConnected = await page.evaluate(() => {
      const socket = (window as any).__BRUNELLA_SOCKET__;
      return socket && socket.connected;
    });

    expect(isConnected).toBe(true);
  });

  test("should handle socket disconnect", async ({ page }) => {
    // 1. Verify initial connection
    let isConnected = await page.evaluate(() => {
      const socket = (window as any).__BRUNELLA_SOCKET__;
      return socket && socket.connected;
    });
    expect(isConnected).toBe(true);

    // 2. Force disconnect the socket
    await page.evaluate(() => {
      const socket = (window as any).__BRUNELLA_SOCKET__;
      if (socket && socket.disconnect) {
        socket.disconnect();
      }
    });

    // 3. Verify disconnected state
    await page.waitForTimeout(500);
    isConnected = await page.evaluate(() => {
      const socket = (window as any).__BRUNELLA_SOCKET__;
      return socket && socket.connected;
    });
    expect(isConnected).toBe(false);
  });

  test("should reconnect after manual disconnect", async ({ page }) => {
    // 1. Verify initial connection
    let isConnected = await page.evaluate(() => {
      const socket = (window as any).__BRUNELLA_SOCKET__;
      return socket && socket.connected;
    });
    expect(isConnected).toBe(true);

    // 2. Disconnect
    await page.evaluate(() => {
      const socket = (window as any).__BRUNELLA_SOCKET__;
      if (socket && socket.disconnect) {
        socket.disconnect();
      }
    });

    await page.waitForTimeout(500);
    isConnected = await page.evaluate(() => {
      const socket = (window as any).__BRUNELLA_SOCKET__;
      return socket && socket.connected;
    });
    expect(isConnected).toBe(false);

    // 3. Manually reconnect
    await page.evaluate(() => {
      const socket = (window as any).__BRUNELLA_SOCKET__;
      if (socket && socket.connect) {
        socket.connect();
      }
    });

    // 4. Verify reconnection (allow time for connection)
    await page.waitForTimeout(2000);
    isConnected = await page.evaluate(() => {
      const socket = (window as any).__BRUNELLA_SOCKET__;
      return socket && socket.connected;
    });
    expect(isConnected).toBe(true);
  });

  test("should handle multiple reconnection cycles", async ({ page }) => {
    // Test multiple disconnect/reconnect cycles
    for (let i = 0; i < 3; i++) {
      // Disconnect
      await page.evaluate(() => {
        const socket = (window as any).__BRUNELLA_SOCKET__;
        if (socket && socket.disconnect) {
          socket.disconnect();
        }
      });

      await page.waitForTimeout(300);

      // Verify disconnected
      let isConnected = await page.evaluate(() => {
        const socket = (window as any).__BRUNELLA_SOCKET__;
        return socket && socket.connected;
      });
      expect(isConnected).toBe(false);

      // Reconnect
      await page.evaluate(() => {
        const socket = (window as any).__BRUNELLA_SOCKET__;
        if (socket && socket.connect) {
          socket.connect();
        }
      });

      await page.waitForTimeout(1500);

      // Verify reconnected
      isConnected = await page.evaluate(() => {
        const socket = (window as any).__BRUNELLA_SOCKET__;
        return socket && socket.connected;
      });
      expect(isConnected).toBe(true);
    }
  });

  test("should maintain socket object integrity after reconnection", async ({
    page,
  }) => {
    // 1. Get socket ID before disconnect
    const socketIdBefore = await page.evaluate(() => {
      const socket = (window as any).__BRUNELLA_SOCKET__;
      return socket ? socket.id : null;
    });

    expect(socketIdBefore).toBeTruthy();

    // 2. Disconnect and reconnect
    await page.evaluate(() => {
      const socket = (window as any).__BRUNELLA_SOCKET__;
      if (socket) {
        socket.disconnect();
        setTimeout(() => {
          if (socket.connect) socket.connect();
        }, 500);
      }
    });

    // 3. Wait for reconnection
    await page.waitForTimeout(2000);

    // 4. Verify socket has new ID (new connection)
    const socketIdAfter = await page.evaluate(() => {
      const socket = (window as any).__BRUNELLA_SOCKET__;
      return socket ? socket.id : null;
    });

    expect(socketIdAfter).toBeTruthy();
    // New socket ID indicates new connection was established
    expect(socketIdAfter).not.toBe(socketIdBefore);

    // 5. Verify socket is connected
    const isConnected = await page.evaluate(() => {
      const socket = (window as any).__BRUNELLA_SOCKET__;
      return socket && socket.connected;
    });
    expect(isConnected).toBe(true);
  });
});
