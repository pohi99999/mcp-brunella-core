/**
 * CEAN Analytics Engine
 * Provides event building and pipeline analytics
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
