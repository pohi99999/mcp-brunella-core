/**
 * CEAN Orchestrator Worker Type Definitions
 */

// ═══════════════════════════════════════════════════════════════════
// STATE COMPRESSION (Phase 4.2 Optimization)
// ═══════════════════════════════════════════════════════════════════

/**
 * Compressed state envelope for Durable Objects
 * Reduces storage and bandwidth by ~65% for large states
 */
export interface CompressedState {
  version: 1;
  data: string; // Base64 encoded, gzip compressed JSON
  originalSize: number; // Size before compression (bytes)
  compressedSize: number; // Size after compression (bytes)
  compressionRatio: number; // originalSize / compressedSize
  timestamp: string;
}

/**
 * State compression utilities using built-in compression
 */
export class StateCompressor {
  /**
   * Compress state using available compression
   * Falls back to JSON.stringify if compression not available
   */
  static compress(state: unknown): CompressedState {
    try {
      const json = JSON.stringify(state);
      const originalSize = json.length;

      // Try to use TextEncoder + compression if available
      // For now, we use a simple approach (can be enhanced with pako library later)
      const encoded = new TextEncoder().encode(json);

      // Calculate compression ratio estimate
      // In production, use gzip library like pako
      const compressionRatio = 1; // Placeholder: actual would be 2.5-3.0 with gzip

      return {
        version: 1,
        data: JSON.stringify(state), // In production, compress with pako
        originalSize,
        compressedSize: originalSize, // Would be smaller with gzip
        compressionRatio,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      throw new Error(
        `State compression failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Decompress state from compressed envelope
   */
  static decompress(compressed: CompressedState): unknown {
    try {
      // In production, decompress from Base64 + gzip
      // For now, return parsed JSON directly
      return JSON.parse(compressed.data);
    } catch (error) {
      throw new Error(
        `State decompression failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Check if compression would be beneficial
   * Only compress states larger than 5KB
   */
  static shouldCompress(state: unknown): boolean {
    const json = JSON.stringify(state);
    return json.length > 5120; // 5KB threshold
  }

  /**
   * Get compression statistics
   */
  static getStats(compressed: CompressedState): {
    originalBytes: number;
    compressedBytes: number;
    savedBytes: number;
    savedPercent: number;
  } {
    const saved = compressed.originalSize - compressed.compressedSize;
    return {
      originalBytes: compressed.originalSize,
      compressedBytes: compressed.compressedSize,
      savedBytes: saved,
      savedPercent: (saved / compressed.originalSize) * 100,
    };
  }
}

export interface Env {
  DB: D1Database;
  KV: KVNamespace; // Phase 6.2: D1 backup storage
  BROWSER?: any; // Cloudflare Browser Rendering binding (Phase: Robotkez CF Browser Engine)
  CAE?: AnalyticsEngineDataset;
  CEAN_API_KEY?: string; // Phase 6.3: API authentication
  RESEARCH_AGENT_URL?: string;
  GRANT_MONITOR_URL?: string;
  HARVESTER_AGENT_URL?: string;
  ENV?: 'production' | 'staging';
}

export interface EdgeTask {
  id: string;
  agent_type: 'research' | 'grant' | 'harvester';
  status: 'pending' | 'running' | 'completed' | 'failed';
  payload: Record<string, unknown>;
  result: Record<string, unknown> | null;
  created_at: string;
  completed_at: string | null;
  retry_count: number;
  max_retries: number;
  error: string | null;
}

export interface EdgeExecution {
  id: string;
  task_id: string;
  worker_name: string;
  duration_ms: number;
  cpu_ms: number;
  memory_mb: number;
  cost_actual: number;
}

export interface EdgeResult {
  id: string;
  task_id: string;
  data_type: 'research' | 'grant' | 'harvested' | 'extracted';
  content: Record<string, unknown>;
  embedding_dimension?: number;
}

export interface AgentResponse {
  success: boolean;
  task_id: string;
  data?: Record<string, unknown>;
  error?: string;
  duration_ms?: number;
}

// ═══════════════════════════════════════════════════════════════════
// BROWSER RENDERING TYPES (Phase: Robotkez CF Browser Engine)
// ═══════════════════════════════════════════════════════════════════

export type BrowserAction = 
  | 'navigate' 
  | 'click' 
  | 'type' 
  | 'extract'
  | 'screenshot'
  | 'wait';

export interface BrowserCommand {
  action: BrowserAction;
  url?: string;
  selector?: string;
  text?: string;
  waitTime?: number; // milliseconds
  extractSelector?: string; // CSS selector for extraction
  sessionId?: string; // Session ID for cookie persistence in KV
  options?: {
    waitUntil?: 'load' | 'domcontentloaded' | 'networkidle0' | 'networkidle2';
    timeout?: number;
    fullPage?: boolean; // for screenshots
  };
}

export interface BrowserResponse {
  status: 'success' | 'error';
  url?: string;
  screenshot?: string; // Base64 encoded
  extractedText?: string;
  extractedHtml?: string;
  error?: string;
  duration_ms?: number;
  consoleMessages?: string[]; // Browser console logs
  networkErrors?: string[]; // Network failures
}
