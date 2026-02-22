/**
 * CEAN Analytics Engine (Phase 3: D1 Integration)
 * Provides event building and pipeline analytics with cloud-first D1 storage
 */

export interface PipelineEvent {
  task_id: string;
  event_type: 'pipeline_start' | 'pipeline_complete' | 'pipeline_error' | 'cache_hit';
  agent_type?: string;
  status?: string;
  latency_ms?: number;
  error_message?: string;
  success?: boolean;
  timestamp: number; // Unix timestamp in seconds
}

/**
 * Pipeline Event Builder
 * Constructs consistent event objects for analytics
 */
export class PipelineEventBuilder {
  /**
   * Build a pipeline start event
   */
  static start(taskId: string, agentType: string): PipelineEvent {
    return {
      task_id: taskId,
      event_type: 'pipeline_start',
      agent_type: agentType,
      status: 'started',
      success: true,
      timestamp: Math.floor(Date.now() / 1000),
    };
  }

  /**
   * Build a pipeline completion event
   */
  static complete(
    taskId: string,
    agentType: string,
    latencyMs: number,
    success: boolean
  ): PipelineEvent {
    return {
      task_id: taskId,
      event_type: 'pipeline_complete',
      agent_type: agentType,
      status: 'completed',
      latency_ms: latencyMs,
      success,
      timestamp: Math.floor(Date.now() / 1000),
    };
  }

  /**
   * Build an error event
   */
  static error(
    taskId: string,
    agentType: string,
    errorMessage: string
  ): PipelineEvent {
    return {
      task_id: taskId,
      event_type: 'pipeline_error',
      agent_type: agentType,
      status: 'failed',
      error_message: errorMessage,
      success: false,
      timestamp: Math.floor(Date.now() / 1000),
    };
  }

  /**
   * Build a cache hit event
   */
  static cacheHit(agentType: string): PipelineEvent {
    return {
      task_id: `cache_hit_${Date.now()}`,
      event_type: 'cache_hit',
      agent_type: agentType,
      status: 'hit',
      success: true,
      timestamp: Math.floor(Date.now() / 1000),
    };
  }
}

/**
 * Analytics Service (D1-powered)
 * Tracks all pipeline events to D1 cloud storage
 */
export class AnalyticsService {
  /**
   * Track a pipeline event to D1 (async, non-blocking)
   */
  static async trackEvent(event: PipelineEvent): Promise<void> {
    try {
      // Import dynamically to avoid circular deps
      const { getD1Adapter } = await import('./utils/globalDb.js');
      const d1Adapter = getD1Adapter();

      if (!d1Adapter) {
        // Silently skip if D1 not available (non-critical)
        return;
      }

      // Convert PipelineEvent to EnterpriseEvent format for D1
      await d1Adapter.insertEnterpriseEvent({
        id: `analytics_${event.task_id}_${Date.now()}`,
        type: event.event_type,
        payload: {
          task_id: event.task_id,
          agent_type: event.agent_type,
          latency_ms: event.latency_ms,
          error_message: event.error_message,
        },
        source_module: event.agent_type || 'analytics',
        priority: event.success === false ? 'HIGH' : 'LOW',
        status: event.success === false ? 'FAILED' : 'COMPLETED',
      });
    } catch (error) {
      // Non-critical: analytics tracking should never break the main flow
      const { logWarn } = await import('./utils/logger.js');
      const message = error instanceof Error ? error.message : String(error);
      logWarn('AnalyticsService', `Analytics tracking failed: ${message}`);
    }
  }

  /**
   * Track agent execution (convenience wrapper)
   */
  static async trackAgentExecution(
    agentName: string,
    taskId: string,
    success: boolean,
    latencyMs: number,
    errorMessage?: string
  ): Promise<void> {
    if (success) {
      await this.trackEvent(
        PipelineEventBuilder.complete(taskId, agentName, latencyMs, true)
      );
    } else {
      await this.trackEvent(
        PipelineEventBuilder.error(taskId, agentName, errorMessage || 'Unknown error')
      );
    }
  }
}
