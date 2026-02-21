import { logError } from './logger.js';

/**
 * Cloudflare Vectorize wrapper (with no-op fallback)
 * @track cloudflare_vectorize_rag_20260221
 */
export interface VectorizeMatch {
  id: string;
  score: number;
  metadata?: Record<string, unknown>;
}

export interface VectorizeUpsertItem {
  id: string;
  values: number[];
  metadata?: Record<string, unknown>;
}

export class VectorizeClient {
  private readonly baseUrl: string;
  private readonly accountId?: string;
  private readonly apiToken?: string;
  private readonly globalApiKey?: string;
  private readonly email?: string;
  private readonly indexName: string;

  constructor() {
    this.baseUrl = 'https://api.cloudflare.com/client/v4';
    this.accountId = process.env.CLOUDFLARE_ACCOUNT_ID || process.env.CF_ACCOUNT_ID;
    this.apiToken = process.env.CF_AI_API_TOKEN || process.env.CLOUDFLARE_API_TOKEN;
    this.globalApiKey = process.env.CLOUDFLARE_GLOBAL_API_KEY || process.env.CF_GLOBAL_API_KEY;
    this.email = process.env.CLOUDFLARE_EMAIL || process.env.CF_EMAIL;
    this.indexName = process.env.CF_VECTORIZE_INDEX || 'brunella-agent-memory';
  }

  private get enabled(): boolean {
    return Boolean(this.accountId && (this.apiToken || (this.globalApiKey && this.email)));
  }

  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (this.globalApiKey && this.email) {
      headers['X-Auth-Key'] = this.globalApiKey;
      headers['X-Auth-Email'] = this.email;
    } else if (this.apiToken) {
      headers['Authorization'] = `Bearer ${this.apiToken}`;
    }
    return headers;
  }

  async embed(text: string): Promise<number[]> {
    if (!this.enabled) return [];

    try {
      const response = await fetch(
        `${this.baseUrl}/accounts/${this.accountId}/ai/run/@cf/baai/bge-small-en-v1.5`,
        {
          method: 'POST',
          headers: this.getHeaders(),
          body: JSON.stringify({ text }),
        },
      );

      if (!response.ok) {
        const err = await response.text();
        throw new Error(`Embedding failed: ${response.status} ${err}`);
      }

      const data = (await response.json()) as {
        result?: { data?: number[][] };
      };

      return data.result?.data?.[0] || [];
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      logError('VectorizeClient', `embed failed: ${msg}`);
      return [];
    }
  }

  async upsert(items: VectorizeUpsertItem[]): Promise<boolean> {
    if (!this.enabled || items.length === 0) return false;

    try {
      const response = await fetch(
        `${this.baseUrl}/accounts/${this.accountId}/vectorize/v2/indexes/${this.indexName}/upsert`,
        {
          method: 'POST',
          headers: this.getHeaders(),
          body: JSON.stringify({ vectors: items }),
        },
      );

      if (!response.ok) {
        const err = await response.text();
        throw new Error(`Upsert failed: ${response.status} ${err}`);
      }

      return true;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      logError('VectorizeClient', `upsert failed: ${msg}`);
      return false;
    }
  }

  async query(values: number[], topK = 5): Promise<VectorizeMatch[]> {
    if (!this.enabled || values.length === 0) return [];

    try {
      const response = await fetch(
        `${this.baseUrl}/accounts/${this.accountId}/vectorize/v2/indexes/${this.indexName}/query`,
        {
          method: 'POST',
          headers: this.getHeaders(),
          body: JSON.stringify({ vector: values, topK, returnMetadata: 'all' }),
        },
      );

      if (!response.ok) {
        const err = await response.text();
        throw new Error(`Query failed: ${response.status} ${err}`);
      }

      const data = (await response.json()) as {
        result?: { matches?: Array<{ id: string; score: number; metadata?: Record<string, unknown> }> };
      };

      return data.result?.matches || [];
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      logError('VectorizeClient', `query failed: ${msg}`);
      return [];
    }
  }

  async upsertText(id: string, text: string, metadata?: Record<string, unknown>): Promise<boolean> {
    const vector = await this.embed(text);
    if (vector.length === 0) return false;
    return this.upsert([{ id, values: vector, metadata: { ...metadata, text } }]);
  }

  async searchText(query: string, topK = 5): Promise<VectorizeMatch[]> {
    const vector = await this.embed(query);
    if (vector.length === 0) return [];
    return this.query(vector, topK);
  }

  getStatus(): { enabled: boolean; indexName: string } {
    return {
      enabled: this.enabled,
      indexName: this.indexName,
    };
  }
}

export const vectorizeClient = new VectorizeClient();
