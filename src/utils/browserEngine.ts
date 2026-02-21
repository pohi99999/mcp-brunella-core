import type { BrowserCommand, BrowserResponse } from './persistentBrowser.js';
import { persistentBrowser } from './persistentBrowser.js';
import { cloudflareBrowser } from './cloudflareBrowser.js';

export interface BrowserEngine {
  sendCommand(command: BrowserCommand): Promise<BrowserResponse>;
  getLastScreenshot(): Uint8Array | null;
  close(): Promise<void>;
  forceKill(): void;
}

export function getRobotkezEngineName(): 'cloudflare' | 'local' {
  return process.env.ROBOTKEZ_ENGINE === 'cloudflare' ? 'cloudflare' : 'local';
}

export function getRobotkezBrowserEngine(): BrowserEngine {
  return getRobotkezEngineName() === 'cloudflare'
    ? cloudflareBrowser
    : persistentBrowser;
}
