import { buildZeroPromptEdgeSummary } from '../core/zeroPromptEdgeMirrorSummary.js';
import {
  phoenixEventBus,
  type PhoenixApprovalRequestedEvent,
  type PhoenixApprovalResolvedEvent,
  type PhoenixRemediationRunUpdatedEvent,
} from '../core/phoenixEventBus.js';
import { cloudflareClient } from './cloudflareClient.js';
import { getCeanApiKey, getCloudflareApiToken } from './cloudflareConfig.js';
import { logInfo, logWarn } from './logger.js';

const SYNC_INTERVAL_MS = 30_000;
const SYNC_DEBOUNCE_MS = 1_000;

class ZeroPromptEdgeMirrorService {
  private started = false;
  private syncInFlight = false;
  private resyncRequested = false;
  private intervalHandle: ReturnType<typeof setInterval> | null = null;
  private debounceHandle: ReturnType<typeof setTimeout> | null = null;

  private readonly onApprovalRequested = (_event: PhoenixApprovalRequestedEvent): void => {
    this.scheduleSync('approval_requested');
  };

  private readonly onApprovalResolved = (_event: PhoenixApprovalResolvedEvent): void => {
    this.scheduleSync('approval_resolved');
  };

  private readonly onRemediationRunUpdated = (_event: PhoenixRemediationRunUpdatedEvent): void => {
    this.scheduleSync('remediation_run_updated');
  };

  private isEnabled(): boolean {
    return (
      process.env.EDGE_ENABLED === 'true' &&
      Boolean(getCloudflareApiToken() || getCeanApiKey())
    );
  }

  start(): void {
    if (this.started) {
      return;
    }

    if (!this.isEnabled()) {
      logInfo('ZeroPromptEdgeMirrorService', 'Edge mirror sync disabled (EDGE_ENABLED or worker auth missing)');
      return;
    }

    this.started = true;
    phoenixEventBus.subscribe('phoenix:approval_requested', this.onApprovalRequested);
    phoenixEventBus.subscribe('phoenix:approval_resolved', this.onApprovalResolved);
    phoenixEventBus.subscribe('phoenix:remediation_run_updated', this.onRemediationRunUpdated);

    this.intervalHandle = setInterval(() => {
      void this.syncNow('interval');
    }, SYNC_INTERVAL_MS);
    this.intervalHandle.unref?.();

    logInfo(
      'ZeroPromptEdgeMirrorService',
      `Zero-Prompt edge mirror sync started -> ${cloudflareClient.getResolvedBaseUrl()}`,
    );
    void this.syncNow('startup');
  }

  stop(): void {
    if (!this.started) {
      return;
    }

    phoenixEventBus.unsubscribe('phoenix:approval_requested', this.onApprovalRequested);
    phoenixEventBus.unsubscribe('phoenix:approval_resolved', this.onApprovalResolved);
    phoenixEventBus.unsubscribe('phoenix:remediation_run_updated', this.onRemediationRunUpdated);

    if (this.intervalHandle) {
      clearInterval(this.intervalHandle);
      this.intervalHandle = null;
    }

    if (this.debounceHandle) {
      clearTimeout(this.debounceHandle);
      this.debounceHandle = null;
    }

    this.started = false;
  }

  private scheduleSync(reason: string): void {
    if (!this.started) {
      return;
    }

    if (this.debounceHandle) {
      clearTimeout(this.debounceHandle);
    }

    this.debounceHandle = setTimeout(() => {
      this.debounceHandle = null;
      void this.syncNow(reason);
    }, SYNC_DEBOUNCE_MS);
    this.debounceHandle.unref?.();
  }

  private async syncNow(reason: string): Promise<void> {
    if (!this.started || !this.isEnabled()) {
      return;
    }

    if (this.syncInFlight) {
      this.resyncRequested = true;
      return;
    }

    this.syncInFlight = true;
    try {
      const summary = await buildZeroPromptEdgeSummary();
      await cloudflareClient.pushZeroPromptSummary(summary);
      if (reason === 'startup') {
        logInfo('ZeroPromptEdgeMirrorService', 'Initial Zero-Prompt edge mirror sync completed');
      }
    } catch (error: unknown) {
      logWarn(
        'ZeroPromptEdgeMirrorService',
        `Edge mirror sync failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    } finally {
      this.syncInFlight = false;
      if (this.resyncRequested) {
        this.resyncRequested = false;
        this.scheduleSync('queued');
      }
    }
  }
}

export const zeroPromptEdgeMirrorService = new ZeroPromptEdgeMirrorService();
