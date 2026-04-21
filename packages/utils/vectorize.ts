import { logError } from './logger.js';
import { getBasCloudflareAccountId, getBasCloudflareApiToken } from './cloudflareConfig.js';

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
  private readonly gatewayId: string;
  private readonly vectorDim: number;

  constructor() {
    this.baseUrl = 'https://api.cloudflare.com/client/v4';
    this.accountId = getBasCloudflareAccountId();
    this.apiToken = getBasCloudflareApiToken() || process.env.CF_AI_API_TOKEN;
    this.globalApiKey = process.env.CLOUDFLARE_GLOBAL_API_KEY || process.env.CF_GLOBAL_API_KEY;
    this.email = process.env.CLOUDFLARE_EMAIL || process.env.CF_EMAIL;
    this.indexName = process.env.CF_VECTORIZE_INDEX || 'brunella-agent-memory';
    this.gatewayId = process.env.CF_GATEWAY_ID || 'brunella-gateway';
    this.vectorDim = Number(process.env.CF_VECTOR_DIM ?? '384');
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
      // Use direct API if Global Key is available (as Gateway requires Token)
      const useDirectApi = Boolean(this.globalApiKey && this.email);
      const model = '@cf/baai/bge-large-en-v1.5';
      
      const url = useDirectApi
        ? `https://api.cloudflare.com/client/v4/accounts/${this.accountId}/ai/run/${model}`
        : `https://gateway.ai.cloudflare.com/v1/${this.accountId}/${this.gatewayId}/workers-ai/${model}`;
      
      const response = await fetch(url, {
          method: 'POST',
          headers: this.getHeaders(),
          body: JSON.stringify({ text: [text] }),
        },
      );

      if (!response) {
        throw new Error('No response from embedding endpoint');
      }

      if (!response.ok) {
        const err = await response.text();
        throw new Error(`Embedding failed: ${response.status} ${err}`);
      }

      const data = (await response.json()) as {
        result?: { data?: number[][] };
      };

      const vec = data.result?.data?.[0] || [];

      if (Array.isArray(vec) && this.vectorDim && vec.length !== this.vectorDim) {
        // Log mismatch — do not crash here; upstream upsert will validate and skip if needed
        logError('VectorizeClient', `embedding dimension mismatch: expected ${this.vectorDim}, got ${vec.length}`);
      }

      return vec;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      logError('VectorizeClient', `embed failed: ${msg}`);
      return [];
    }
  }

  async upsert(items: VectorizeUpsertItem[]): Promise<boolean> {
    if (!this.enabled || items.length === 0) return false;

    try {
      // Validate vector dimension consistency
      const invalid = items.filter((it) => !Array.isArray(it.values) || (this.vectorDim && it.values.length !== this.vectorDim));
      if (invalid.length > 0) {
        const ids = invalid.map((i) => i.id).join(', ');
        logError('VectorizeClient', `Skipping upsert: ${invalid.length} vectors with invalid dimension (expected ${this.vectorDim}). IDs: ${ids}`);
      }

      const validItems = items.filter((it) => Array.isArray(it.values) && (!this.vectorDim || it.values.length === this.vectorDim));
      if (validItems.length === 0) {
        return false;
      }

      const response = await fetch(
        `${this.baseUrl}/accounts/${this.accountId}/vectorize/v2/indexes/${this.indexName}/upsert`,
        {
          method: 'POST',
          headers: this.getHeaders(),
          body: JSON.stringify({ vectors: validItems }),
        },
      );

      if (!response) {
        throw new Error('No response from vector upsert endpoint');
      }

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
      if (this.vectorDim && values.length !== this.vectorDim) {
        logError('VectorizeClient', `Query aborted: vector dimension mismatch (expected ${this.vectorDim}, got ${values.length})`);
        return [];
      }
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

  getStatus(): { enabled: boolean; indexName: string; vectorDim: number } {
    return {
      enabled: this.enabled,
      indexName: this.indexName,
      vectorDim: this.vectorDim,
    };
  }
}

export const vectorizeClient = new VectorizeClient();
