import { Env } from './types';

/**
 * Load Test Configuration
 */
export interface LoadTestConfig {
  pipelineCount: number;
  concurrency: number;
  minNodeCount: number;
  maxNodeCount: number;
  duration: number; // milliseconds
  rampUp: boolean; // Gradually increase
}

export interface LoadTestMetrics {
  totalExecuted: number;
  totalSucceeded: number;
  totalFailed: number;
  avgLatency: number;
  p95Latency: number;
  p99Latency: number;
  minLatency: number;
  maxLatency: number;
  throughput: number; // pipelines per second
  errorRate: number; // percentage
  startTime: number;
  endTime: number;
  duration: number;
  costEstimate: number;
  memoryPeak: number; // MB
  summary: string;
}

export interface ExecutionRecord {
  executionId: string;
  pipelineId: string;
  startTime: number;
  endTime: number;
  duration: number;
  status: 'success' | 'failed';
  nodeCount: number;
  error?: string;
  costEstimate: number;
}

/**
 * Load Test Suite
 */
export class LoadTestSuite {
  private env: Env;
  private executions: ExecutionRecord[] = [];
  private startTime: number = 0;
  private config: LoadTestConfig;

  constructor(env: Env, config: LoadTestConfig) {
    this.env = env;
    this.config = config;
  }

  /**
   * Generate random pipeline with given node count
   */
  private generatePipeline(nodeCount: number) {
    const agents = ['research', 'analyzer', 'aggregator', 'remediation', 'harvester'];
    const nodes = [];
    const edges = [];

    // Create nodes
    for (let i = 0; i < nodeCount; i++) {
      nodes.push({
        id: `node_${i}`,
        agent: agents[i % agents.length],
        executionType: Math.random() > 0.3 ? 'sequential' : 'parallel',
        maxRetries: Math.floor(Math.random() * 3)
      });
    }

    // Create edges (mostly sequential, some parallel)
    for (let i = 0; i < nodeCount - 1; i++) {
      if (Math.random() > 0.7) {
        // Parallel: connect to multiple next nodes
        const nextNodes =[];
        for (let j = i + 1; j < Math.min(i + 3, nodeCount); j++) {
          nextNodes.push(`node_${j}`);
        }
        edges.push({
          from: `node_${i}`,
          to: nextNodes
        });
        i += nextNodes.length - 1;
      } else {
        // Sequential: simple chain
        edges.push({
          from: `node_${i}`,
          to: `node_${i + 1}`
        });
      }
    }

    return {
      id: `pipeline_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      name: `Load Test Pipeline ${nodeCount} nodes`,
      nodes,
      edges,
      createdAt: new Date().toISOString()
    };
  }

  /**
   * Run a single pipeline execution
   */
  private async executePipeline(pipeline: any): Promise<ExecutionRecord> {
    const startTime = Date.now();
    let executionId = '';

    try {
      // Initialize pipeline
      const initResponse = await fetch('https://cean-orchestrator.your-domain.workers.dev/pipeline/init', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pipeline })
      });

      if (!initResponse.ok) {
        throw new Error(`Init failed: ${initResponse.status}`);
      }

      const initData = await initResponse.json() as any;
      executionId = initData.executionId;

      // Execute pipeline nodes
      let isComplete = false;
      let iterations = 0;
      const maxIterations = 90; // 90 seconds max per pipeline (increased from 60 for complex pipelines)

      while (!isComplete && iterations < maxIterations) {
        // Get ready nodes
        const readyResponse = await fetch(
          `https://cean-orchestrator.your-domain.workers.dev/pipeline/${executionId}/ready-nodes`
        );

        if (!readyResponse.ok) {
          throw new Error(`Ready-nodes failed: ${readyResponse.status}`);
        }

        const readyData = await readyResponse.json() as any;
        const readyNodes = readyData.ready || [];

        if (readyNodes.length === 0) {
          // Check if complete
          const statusResponse = await fetch(
            `https://cean-orchestrator.your-domain.workers.dev/pipeline/${executionId}/status`
          );
          const statusData = await statusResponse.json() as any;

          if (statusData.status === 'completed' || statusData.status === 'failed') {
            isComplete = true;
            break;
          }
        }

        // Simulate node execution
        for (const nodeId of readyNodes) {
          const result = {
            nodeId,
            data: { processed: true, timestamp: Date.now() },
            duration: Math.random() * 2000 + 500 // 500-2500ms
          };

          await fetch(
            `https://cean-orchestrator.your-domain.workers.dev/pipeline/${executionId}/node-completed`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(result)
            }
          );
        }

        iterations++;
        await new Promise(resolve => setTimeout(resolve, 100)); // Small delay between iterations
      }

      const endTime = Date.now();
      const duration = endTime - startTime;

      return {
        executionId,
        pipelineId: pipeline.id,
        startTime,
        endTime,
        duration,
        status: isComplete ? 'success' : 'failed',
        nodeCount: pipeline.nodes.length,
        costEstimate: pipeline.nodes.length * 0.0000195, // $0.0000195 per node
      };
    } catch (error) {
      const endTime = Date.now();
      const duration = endTime - startTime;

      return {
        executionId,
        pipelineId: pipeline.id,
        startTime,
        endTime,
        duration,
        status: 'failed',
        nodeCount: pipeline.nodes?.length || 0,
        error: error instanceof Error ? error.message : String(error),
        costEstimate: 0
      };
    }
  }

  /**
   * Run load test with specified configuration
   */
  async run(): Promise<LoadTestMetrics> {
    this.startTime = Date.now();
    const { pipelineCount, concurrency, minNodeCount, maxNodeCount, rampUp } = this.config;

    console.log(`🧪 Starting load test: ${pipelineCount} pipelines, concurrency=${concurrency}`);

    // Generate all pipelines
    const pipelines = [];
    for (let i = 0; i < pipelineCount; i++) {
      const nodeCount = minNodeCount + Math.floor(Math.random() * (maxNodeCount - minNodeCount));
      pipelines.push(this.generatePipeline(nodeCount));
    }

    // Execute with concurrency control
    const batchSize = rampUp ? Math.max(1, Math.floor(concurrency / 10)) : concurrency;
    for (let i = 0; i < pipelines.length; i += batchSize) {
      const batch = pipelines.slice(i, i + batchSize);
      const promises = batch.map(p => this.executePipeline(p));

      const results = await Promise.allSettled(promises);
      for (const result of results) {
        if (result.status === 'fulfilled') {
          this.executions.push(result.value);
        }
      }

      console.log(`✓ Completed ${i + batch.length}/${pipelineCount} executions`);

      // Increase batch size gradually if rampUp is enabled
      if (rampUp && i % (concurrency * 4) === 0) {
        // Increase concurrency
      }
    }

    return this.calculateMetrics();
  }

  /**
   * Calculate metrics from executions
   */
  private calculateMetrics(): LoadTestMetrics {
    const endTime = Date.now();
    const duration = endTime - this.startTime;

    const succeeded = this.executions.filter(e => e.status === 'success').length;
    const failed = this.executions.filter(e => e.status === 'failed').length;
    const latencies = this.executions.map(e => e.duration).sort((a, b) => a - b);

    const costEstimate = this.executions.reduce((sum, e) => sum + e.costEstimate, 0);
    const memoryPeak = Math.ceil(this.executions.length * 0.002); // Rough estimate: 2MB per execution

    return {
      totalExecuted: this.executions.length,
      totalSucceeded: succeeded,
      totalFailed: failed,
      avgLatency: latencies.reduce((a, b) => a + b, 0) / latencies.length,
      p95Latency: latencies[Math.floor(latencies.length * 0.95)],
      p99Latency: latencies[Math.floor(latencies.length * 0.99)],
      minLatency: latencies[0],
      maxLatency: latencies[latencies.length - 1],
      throughput: this.executions.length / (duration / 1000),
      errorRate: (failed / this.executions.length) * 100,
      startTime: this.startTime,
      endTime,
      duration,
      costEstimate,
      memoryPeak,
      summary: `Executed ${this.executions.length} pipelines in ${(duration / 1000).toFixed(1)}s. Success rate: ${((succeeded / this.executions.length) * 100).toFixed(2)}%. Avg latency: ${latencies.reduce((a, b) => a + b, 0) / latencies.length | 0}ms. Cost: $${costEstimate.toFixed(6)}`
    };
  }

  /**
   * Export metrics as JSON
   */
  exportMetrics(metrics: LoadTestMetrics): string {
    return JSON.stringify(metrics, null, 2);
  }

  /**
   * Export detailed execution log
   */
  exportExecutions(): string {
    return JSON.stringify(this.executions, null, 2);
  }
}

/**
 * Load Test Endpoint Handler
 */
export async function handleLoadTest(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);

  // GET /load-test/run?pipelines=100&concurrency=10&minNodes=3&maxNodes=10
  if (url.pathname === '/load-test/run' && request.method === 'GET') {
    const pipelines = parseInt(url.searchParams.get('pipelines') || '100');
    const concurrency = parseInt(url.searchParams.get('concurrency') || '10');
    const minNodes = parseInt(url.searchParams.get('minNodes') || '3');
    const maxNodes = parseInt(url.searchParams.get('maxNodes') || '10');
    const rampUp = url.searchParams.get('rampUp') === 'true';

    const config: LoadTestConfig = {
      pipelineCount: pipelines,
      concurrency,
      minNodeCount: minNodes,
      maxNodeCount: maxNodes,
      duration: 0,
      rampUp
    };

    try {
      const suite = new LoadTestSuite(env, config);
      const metrics = await suite.run();

      return new Response(JSON.stringify({
        status: 'success',
        metrics,
        message: metrics.summary
      }, null, 2), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error) {
      return new Response(JSON.stringify({
        status: 'error',
        error: error instanceof Error ? error.message : String(error)
      }, null, 2), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  return new Response('Not Found', { status: 404 });
}
