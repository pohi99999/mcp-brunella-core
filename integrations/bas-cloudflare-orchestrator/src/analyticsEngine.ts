/**
 * BAS Analytics Engine — Agent telemetria és metrikák
 *
 * Cloudflare Analytics Engine-t használ egyedi metrikák rögzítésére:
 * - Agent futási idő, token usage, cost
 * - Task típus eloszlás
 * - Error rate per agent
 * - Model performance összehasonlítás
 *
 * @track cf_analytics_engine_20260323
 */

export interface AgentMetric {
  /** Agent neve (pl: CoderAgent, ResearchAgent) */
  agentId: string;
  /** Task típus (code, research, data, browser, general) */
  taskType: string;
  /** Használt AI modell */
  model: string;
  /** Futási eredmény */
  status: "success" | "failure" | "timeout" | "fallback";
  /** Futási idő ms-ben */
  durationMs: number;
  /** Felhasznált tokenek */
  tokensUsed: number;
  /** Becsült költség USD-ben */
  estimatedCostUsd?: number;
  /** Task ID a nyomon követéshez */
  taskId?: string;
}

export interface SystemMetric {
  /** Metrika típus */
  type: "queue_depth" | "active_swarms" | "cache_hit_rate" | "error_rate" | "latency_p99";
  /** Metrika értéke */
  value: number;
  /** Forrás komponens */
  source: string;
}

/**
 * Analytics Engine writer — egységes metrika interfész
 */
export class BASAnalytics {
  constructor(private readonly dataset: AnalyticsEngineDataset | null) {}

  /**
   * Record agent execution metric
   *
   * Schema:
   *   blobs[0]: agentId
   *   blobs[1]: taskType
   *   blobs[2]: model
   *   blobs[3]: status
   *   blobs[4]: taskId (optional)
   *   doubles[0]: durationMs
   *   doubles[1]: tokensUsed
   *   doubles[2]: estimatedCostUsd
   *   indexes[0]: agentId (for fast filtering)
   */
  recordAgentExecution(metric: AgentMetric): void {
    if (!this.dataset) return;

    this.dataset.writeDataPoint({
      blobs: [
        metric.agentId,
        metric.taskType,
        metric.model,
        metric.status,
        metric.taskId || "",
      ],
      doubles: [
        metric.durationMs,
        metric.tokensUsed,
        metric.estimatedCostUsd || 0,
      ],
      indexes: [metric.agentId],
    });
  }

  /**
   * Record system-level metric
   *
   * Schema:
   *   blobs[0]: type
   *   blobs[1]: source
   *   doubles[0]: value
   *   indexes[0]: type
   */
  recordSystemMetric(metric: SystemMetric): void {
    if (!this.dataset) return;

    this.dataset.writeDataPoint({
      blobs: [metric.type, metric.source],
      doubles: [metric.value],
      indexes: [metric.type],
    });
  }

  /**
   * Record queue processing metric
   */
  recordQueueMetric(
    queueName: string,
    batchSize: number,
    processedCount: number,
    failedCount: number,
    totalDurationMs: number,
  ): void {
    if (!this.dataset) return;

    this.dataset.writeDataPoint({
      blobs: [queueName, "queue_batch"],
      doubles: [batchSize, processedCount, failedCount, totalDurationMs],
      indexes: ["queue"],
    });
  }

  /**
   * Record model performance for comparison
   */
  recordModelPerformance(
    model: string,
    taskType: string,
    durationMs: number,
    tokensUsed: number,
    success: boolean,
  ): void {
    if (!this.dataset) return;

    this.dataset.writeDataPoint({
      blobs: [model, taskType, success ? "success" : "failure"],
      doubles: [durationMs, tokensUsed],
      indexes: [model],
    });
  }

  /**
   * Becsült költség számítás modell alapján (Workers AI pricing: ~$0.011/1M neurons)
   * Approximáció: 1 token ≈ 1 neuron a legtöbb modellnél
   */
  static estimateCost(model: string, tokensUsed: number): number {
    const COST_PER_MILLION_NEURONS = 0.011;
    const multipliers: Record<string, number> = {
      "@cf/meta/llama-3.3-70b-instruct-fp8-fast": 1.5,
      "@cf/deepseek/deepseek-r1-distill-qwen-32b": 1.2,
      "@cf/google/gemma-4-26b-a4b-it": 0.5,
      "@cf/microsoft/phi-4": 0.3,
    };

    const multiplier = multipliers[model] || 1.0;
    return (tokensUsed / 1_000_000) * COST_PER_MILLION_NEURONS * multiplier;
  }
}
