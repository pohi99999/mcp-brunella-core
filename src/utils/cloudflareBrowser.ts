import { logError, logInfo } from './logger.js';
import type { BrowserCommand, BrowserResponse } from './persistentBrowser.js';

/**
 * Cloudflare Browser Rendering adapter
 * Uses Worker /browser endpoint and keeps local screenshot cache for API parity.
 */
export class CloudflareBrowser {
  private lastScreenshot: Uint8Array | null = null;

  private getWorkerBaseUrl(): string {
    return (
      process.env.CLOUDFLARE_WORKER_URL ||
      'https://bas-orchestrator.iam-dd1.workers.dev'
    );
  }

  private getAuthHeader(): Record<string, string> {
    const secret = process.env.CF_WORKER_SECRET;
    return secret ? { 'X-Auth': secret } : {};
  }

  async sendCommand(command: BrowserCommand): Promise<BrowserResponse> {
    const baseUrl = this.getWorkerBaseUrl().replace(/\/+$/, '');
    const url = `${baseUrl}/browser`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), command.timeout || 60000);

    try {
      logInfo('CloudflareBrowser', `Sending command to CF Browser API: ${command.action}`);

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...this.getAuthHeader(),
        },
        body: JSON.stringify(command),
        signal: controller.signal,
      });

      const text = await response.text();
      let data: unknown = {};
      try {
        data = text ? (JSON.parse(text) as unknown) : {};
      } catch {
        data = { status: 'error', message: text || 'Invalid JSON from worker' };
      }

      if (!response.ok) {
        const msg =
          typeof data === 'object' && data && 'message' in data
            ? String((data as { message?: unknown }).message ?? `HTTP ${response.status}`)
            : `HTTP ${response.status}`;
        throw new Error(msg);
      }

      const payload = data as {
        status?: string;
        error?: string;
        url?: string;
        screenshot?: string;
        extractedText?: string;
        extractedHtml?: string;
        duration_ms?: number;
        consoleMessages?: string[];
        networkErrors?: string[];
      };

      if (payload.status === 'error') {
        throw new Error(payload.error || 'Cloudflare browser command failed');
      }

      if (payload.screenshot) {
        try {
          // CF Worker returns base64 directly (not data URI)
          this.lastScreenshot = Buffer.from(payload.screenshot, 'base64');
        } catch {
          logError('CloudflareBrowser', 'Failed to decode screenshot from worker');
        }
      }

      // Map extractedText/extractedHtml to content for API parity
      const content = payload.extractedText || payload.extractedHtml;

      return {
        status: 'success',
        message: `Command executed in ${payload.duration_ms || 0}ms`,
        url: payload.url,
        content,
        data: {
          duration_ms: payload.duration_ms,
          consoleMessages: payload.consoleMessages,
          networkErrors: payload.networkErrors,
        },
      };
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      logError('CloudflareBrowser', `Command failed: ${msg}`);
      return {
        status: 'error',
        message: msg,
      };
    } finally {
      clearTimeout(timeout);
    }
  }

  getLastScreenshot(): Uint8Array | null {
    return this.lastScreenshot;
  }

  async close(): Promise<void> {
    await this.sendCommand({ action: 'close' });
  }

  forceKill(): void {
    // No local process to kill in Cloudflare mode.
  }
}

export const cloudflareBrowser = new CloudflareBrowser();
