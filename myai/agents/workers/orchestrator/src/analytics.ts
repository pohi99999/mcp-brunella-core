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
export async function writeAnalyticsEvent(
  cae: AnalyticsEngineDataset,
  event: PipelineEvent
): Promise<void> {
  try {
    cae.writeDataPoint({
      indexes: [event.event_type, event.agent_type, event.status],
      blobs: [event.task_id, event.error_message || ''],
      doubles: [event.latency_ms || 0],
    });
  } catch (error) {
    // Analytics Engine write failures are non-critical
    console.error('[CAE] Write error:', error instanceof Error ? error.message : String(error));
  }
}

/**
 * Write a batch of events
 */
export async function writeAnalyticsBatch(
  cae: AnalyticsEngineDataset,
  events: PipelineEvent[]
): Promise<void> {
  for (const event of events) {
    await writeAnalyticsEvent(cae, event);
  }
}

/**
 * Event builders for common pipeline events
 */
export const PipelineEventBuilder = {
  /**
   * Build pipeline start event
   */
  start(taskId: string, agentType: string): PipelineEvent {
    return {
      timestamp: Date.now() / 1000,
      event_type: 'pipeline_start',
      agent_type: agentType,
      task_id: taskId,
      status: 'started',
      success: true,
    };
  },

  /**
   * Build pipeline completion event
   */
  complete(
    taskId: string,
    agentType: string,
    latencyMs: number,
    success: boolean
  ): PipelineEvent {
    return {
      timestamp: Date.now() / 1000,
      event_type: 'pipeline_complete',
      agent_type: agentType,
      task_id: taskId,
      status: success ? 'completed' : 'failed',
      latency_ms: latencyMs,
      success,
    };
  },

  /**
   * Build error event
   */
  error(
    taskId: string,
    agentType: string,
    errorMessage: string
  ): PipelineEvent {
    return {
      timestamp: Date.now() / 1000,
      event_type: 'pipeline_error',
      agent_type: agentType,
      task_id: taskId,
      status: 'error',
      error_message: errorMessage,
      success: false,
    };
  },

  /**
   * Build cache hit event
   */
  cacheHit(agentType: string): PipelineEvent {
    return {
      timestamp: Date.now() / 1000,
      event_type: 'cache_hit',
      agent_type: agentType,
      task_id: 'cache_metric',
      status: 'hit',
      success: true,
    };
  },

  /**
   * Build cache miss event
   */
  cacheMiss(agentType: string): PipelineEvent {
    return {
      timestamp: Date.now() / 1000,
      event_type: 'cache_miss',
      agent_type: agentType,
      task_id: 'cache_metric',
      status: 'miss',
      success: true,
    };
  },
};
