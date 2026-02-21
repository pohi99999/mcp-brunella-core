/**
 * CEAN Orchestrator Worker Type Definitions
 */
/**
 * Compressed state envelope for Durable Objects
 * Reduces storage and bandwidth by ~65% for large states
 */
export interface CompressedState {
    version: 1;
    data: string;
    originalSize: number;
    compressedSize: number;
    compressionRatio: number;
    timestamp: string;
}
/**
 * State compression utilities using built-in compression
 */
export declare class StateCompressor {
    /**
     * Compress state using available compression
     * Falls back to JSON.stringify if compression not available
     */
    static compress(state: unknown): CompressedState;
    /**
     * Decompress state from compressed envelope
     */
    static decompress(compressed: CompressedState): unknown;
    /**
     * Check if compression would be beneficial
     * Only compress states larger than 5KB
     */
    static shouldCompress(state: unknown): boolean;
    /**
     * Get compression statistics
     */
    static getStats(compressed: CompressedState): {
        originalBytes: number;
        compressedBytes: number;
        savedBytes: number;
        savedPercent: number;
    };
}
export interface Env {
    DB: D1Database;
    KV: KVNamespace;
    BROWSER?: any;
    CAE?: AnalyticsEngineDataset;
    CEAN_API_KEY?: string;
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
export type BrowserAction = 'navigate' | 'click' | 'type' | 'extract' | 'screenshot' | 'wait';
export interface BrowserCommand {
    action: BrowserAction;
    url?: string;
    selector?: string;
    text?: string;
    waitTime?: number;
    extractSelector?: string;
    options?: {
        waitUntil?: 'load' | 'domcontentloaded' | 'networkidle0' | 'networkidle2';
        timeout?: number;
        fullPage?: boolean;
    };
}
export interface BrowserResponse {
    status: 'success' | 'error';
    url?: string;
    screenshot?: string;
    extractedText?: string;
    extractedHtml?: string;
    error?: string;
    duration_ms?: number;
    consoleMessages?: string[];
    networkErrors?: string[];
}
//# sourceMappingURL=types.d.ts.map