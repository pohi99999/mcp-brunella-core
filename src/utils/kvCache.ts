import { logError, logInfo } from './logger.js';

/**
 * KV Cache adapter (Cloudflare KV + local memory fallback)
 * @track cloudflare_d1_kv_storage_20260221
 */
export class KvCache {
  private readonly baseUrl: string;
  private readonly token?: string;
  private readonly namespace?: string;
  private readonly memory = new Map<string, { value: string; expiresAt?: number }>();

  constructor() {
    this.baseUrl = (process.env.CLOUDFLARE_WORKER_URL || '').replace(/\/+$/, '');
    this.token = process.env.CF_AI_API_TOKEN || process.env.CLOUDFLARE_API_TOKEN;
    this.namespace = process.env.CF_KV_NAMESPACE || process.env.CF_KV_NAMESPACE_ID;
  }

  private get hasRemote(): boolean {
    return Boolean(this.baseUrl && this.namespace && this.token);
  }

  async get(key: string): Promise<string | null> {
    if (this.hasRemote) {
      try {
        const response = await fetch(`${this.baseUrl}/kv/get?key=${encodeURIComponent(key)}`, {
          method: 'GET',
          headers: { Authorization: `Bearer ${this.token}` },
        });
        if (response.ok) {
          const data = (await response.json()) as { value?: string | null };
          return data.value ?? null;
        }
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        logError('KvCache', `Remote get failed, fallback to memory: ${msg}`);
      }
    }

    const record = this.memory.get(key);
    if (!record) return null;
    if (record.expiresAt && record.expiresAt < Date.now()) {
      this.memory.delete(key);
      return null;
    }
    return record.value;
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    if (this.hasRemote) {
      try {
        const response = await fetch(`${this.baseUrl}/kv/set`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.token}`,
          },
          body: JSON.stringify({ key, value, ttlSeconds, namespace: this.namespace }),
        });

        if (response.ok) return;
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        logError('KvCache', `Remote set failed, fallback to memory: ${msg}`);
      }
    }

    this.memory.set(key, {
      value,
      expiresAt: typeof ttlSeconds === 'number' ? Date.now() + ttlSeconds * 1000 : undefined,
    });
  }

  async del(key: string): Promise<void> {
    if (this.hasRemote) {
      try {
        await fetch(`${this.baseUrl}/kv/delete`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.token}`,
          },
          body: JSON.stringify({ key, namespace: this.namespace }),
        });
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        logError('KvCache', `Remote delete failed: ${msg}`);
      }
    }

    this.memory.delete(key);
  }

  status(): { mode: 'remote' | 'memory'; size: number } {
    const mode = this.hasRemote ? 'remote' : 'memory';
    logInfo('KvCache', `Cache mode: ${mode}`);
    return { mode, size: this.memory.size };
  }

  /**
   * Cache wrapper for expensive operations
   * Returns cached value if exists and not expired, otherwise computes and caches
   */
  async getOrCompute<T>(
    key: string,
    compute: () => Promise<T>,
    ttlSeconds = 3600
  ): Promise<T> {
    const cached = await this.get(key);
    if (cached !== null) {
      try {
        logInfo('KvCache', `Cache HIT: ${key}`);
        return JSON.parse(cached) as T;
      } catch {
        logError('KvCache', `Failed to parse cached value for ${key}, recomputing`);
      }
    }

    logInfo('KvCache', `Cache MISS: ${key}, computing...`);
    const value = await compute();
    await this.set(key, JSON.stringify(value), ttlSeconds);
    return value;
  }

  /**
   * Invalidate keys by prefix (useful for bulk cache invalidation)
   */
  async invalidateByPrefix(prefix: string): Promise<void> {
    const keysToDelete: string[] = [];
    for (const [key] of this.memory.entries()) {
      if (key.startsWith(prefix)) {
        keysToDelete.push(key);
      }
    }

    for (const key of keysToDelete) {
      await this.del(key);
    }

    logInfo('KvCache', `Invalidated ${keysToDelete.length} keys with prefix: ${prefix}`);
  }
}

export const kvCache = new KvCache();
