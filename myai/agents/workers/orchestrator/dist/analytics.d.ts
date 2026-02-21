/**
 * CEAN Analytics Engine Integration
 * Writes real-time metrics to Cloudflare Analytics Engine
 *
 * Usage:
 * - Pipeline completion events
 * - Error events
 * - Latency tracking
 * - Cache performance
 */
import type { AnalyticsEngineDataset } from '@cloudflare/workers-types';
export interface PipelineEvent {
    timestamp: number;
    event_type: 'pipeline_start' | 'pipeline_complete' | 'pipeline_error' | 'cache_hit' | 'cache_miss';
    agent_type: string;
    task_id: string;
    status: string;
    latency_ms?: number;
    error_message?: string;
    success?: boolean;
}
/**
 * Write a pipeline event to Analytics Engine
 * Non-blocking: errors are logged but don't fail the request
 */
export declare function writeAnalyticsEvent(cae: AnalyticsEngineDataset, event: PipelineEvent): Promise<void>;
/**
 * Write a batch of events
 */
export declare function writeAnalyticsBatch(cae: AnalyticsEngineDataset, events: PipelineEvent[]): Promise<void>;
/**
 * Event builders for common pipeline events
 */
export declare const PipelineEventBuilder: {
    /**
     * Build pipeline start event
     */
    start(taskId: string, agentType: string): PipelineEvent;
    /**
     * Build pipeline completion event
     */
    complete(taskId: string, agentType: string, latencyMs: number, success: boolean): PipelineEvent;
    /**
     * Build error event
     */
    error(taskId: string, agentType: string, errorMessage: string): PipelineEvent;
    /**
     * Build cache hit event
     */
    cacheHit(agentType: string): PipelineEvent;
    /**
     * Build cache miss event
     */
    cacheMiss(agentType: string): PipelineEvent;
};
//# sourceMappingURL=analytics.d.ts.map