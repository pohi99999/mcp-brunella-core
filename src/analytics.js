export class PipelineEventBuilder {
  static start(taskId, agentType) {
    return {
      task_id: taskId,
      event_type: 'pipeline_start',
      agent_type: agentType,
      status: 'started',
      success: true,
      timestamp: Math.floor(Date.now() / 1000),
    };
  }

  static complete(taskId, agentType, latencyMs, success) {
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

  static error(taskId, agentType, errorMessage) {
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

  static cacheHit(agentType) {
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

export class AnalyticsService {
  static async trackEvent(event) {
    try {
      const { getD1Adapter } = await import('./utils/globalDb.js');
      const d1Adapter = getD1Adapter();
      if (!d1Adapter) {
        return;
      }
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
      const { logWarn } = await import('./utils/logger.js');
      const message = error instanceof Error ? error.message : String(error);
      logWarn('AnalyticsService', `Analytics tracking failed: ${message}`);
    }
  }

  static async trackAgentExecution(agentName, taskId, success, latencyMs, errorMessage) {
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
