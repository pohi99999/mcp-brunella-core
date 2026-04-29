import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CloudflareBrowser } from '@packages/utils/cloudflareBrowser.js';
import { getRobotkezBrowserEngine, getRobotkezEngineName } from '@packages/utils/browserEngine.js';
import { persistentBrowser } from '@packages/utils/persistentBrowser.js';
import { cloudflareBrowser } from '@packages/utils/cloudflareBrowser.js';

describe('CloudflareBrowser adapter', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('should send command and cache screenshot', async () => {
    const browser = new CloudflareBrowser();
    const screenshotBase64 = Buffer.from('fake-image').toString('base64');

    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        text: async () =>
          JSON.stringify({
            status: 'success',
            message: 'ok',
            url: 'https://example.com',
            screenshot: screenshotBase64,
          }),
      })) as unknown as typeof fetch,
    );

    const result = await browser.sendCommand({ action: 'screenshot' });

    expect(result.status).toBe('success');
    expect(result.url).toBe('https://example.com');
    expect(browser.getLastScreenshot()).toBeInstanceOf(Uint8Array);
  });

  it('should return error status when worker request fails', async () => {
    const browser = new CloudflareBrowser();

    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: false,
        status: 500,
        text: async () => JSON.stringify({ message: 'boom' }),
      })) as unknown as typeof fetch,
    );

    const result = await browser.sendCommand({ action: 'navigate', url: 'https://example.com' });

    expect(result.status).toBe('error');
    expect(result.message).toContain('boom');
  });
});

describe('Robotkez browser engine selector', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('should select local engine by default', () => {
    delete process.env.ROBOTKEZ_ENGINE;
    expect(getRobotkezEngineName()).toBe('local');
    expect(getRobotkezBrowserEngine()).toBe(persistentBrowser);
  });

  it('should select cloudflare engine when env is set', () => {
    process.env.ROBOTKEZ_ENGINE = 'cloudflare';
    expect(getRobotkezEngineName()).toBe('cloudflare');
    expect(getRobotkezBrowserEngine()).toBe(cloudflareBrowser);
  });
});
