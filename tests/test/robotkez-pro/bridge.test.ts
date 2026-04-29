import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { RobotkezBridge } from '@packages/core-logic/robotkez_bridge.js';

describe('RobotkezBridge', () => {
  let bridge: RobotkezBridge;

  beforeEach(() => {
    bridge = new RobotkezBridge();
    // Mock global fetch
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should handle generic messages', async () => {
    const response = await bridge.handleMessage('Hello robot!');
    expect(response).toContain('Megértettem az utasítást: "Hello robot!"');
  });

  it('should handle navigation command and call python API', async () => {
    // Mock successful fetch
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ status: 'success', action: 'navigate' })
    });

    const response = await bridge.handleMessage('menj a google oldalra');
    expect(response).toBe('Navigálok a Google-ra.');

    // Verify fetch was called correctly
    expect(global.fetch).toHaveBeenCalledTimes(1);
    const [url, options] = (global.fetch as any).mock.calls[0];
    expect(url).toContain('/api/robotkez/action');
    expect(options.method).toBe('POST');
    expect(JSON.parse(options.body)).toEqual({
      action: 'navigate',
      params: { url: 'https://www.google.com' }
    });
  });

  it('should handle fetch errors gracefully', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error'
    });

    const response = await bridge.handleMessage('menj a google oldalra');
    expect(response).toContain('Hiba történt az utasítás végrehajtása közben');
  });
});
