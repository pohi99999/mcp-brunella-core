import {
  clearFederationReplayNonces,
  hasFederationReplayNonce,
  saveFederationReplayNonce,
} from '../autonomyRuntimeStore.js';

export const FEDERATION_REPLAY_TTL_MS = 10 * 60_000;

export class FederationReplayGuard {
  private readonly seen = new Map<string, number>();

  consume(peerId: string, nonce: string, requestId?: string, nowMs = Date.now()): boolean {
    this.prune(nowMs);

    const keys = [
      `${peerId}:nonce:${nonce}`,
      requestId ? `${peerId}:request:${requestId}` : undefined,
    ].filter((value): value is string => Boolean(value));

    if (keys.some((key) => this.seen.has(key) || hasFederationReplayNonce(key, nowMs))) {
      return false;
    }

    const expiresAt = nowMs + FEDERATION_REPLAY_TTL_MS;
    for (const key of keys) {
      this.seen.set(key, expiresAt);
      saveFederationReplayNonce({
        replayKey: key,
        peerId,
        nonce,
        requestId,
        expiresAt,
        nowMs,
      });
    }

    return true;
  }

  clear(): void {
    this.seen.clear();
    clearFederationReplayNonces();
  }

  private prune(nowMs: number): void {
    for (const [key, expiresAt] of this.seen.entries()) {
      if (expiresAt <= nowMs) {
        this.seen.delete(key);
      }
    }
  }
}

export const federationReplayGuard = new FederationReplayGuard();
