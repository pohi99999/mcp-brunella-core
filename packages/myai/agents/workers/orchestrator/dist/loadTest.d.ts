import { Env } from './types';
/**
 * Load Test Configuration
 */
export interface LoadTestConfig {
    pipelineCount: number;
    concurrency: number;
    minNodeCount: number;
    maxNodeCount: number;
    duration: number;
    rampUp: boolean;
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
    throughput: number;
    errorRate: number;
    startTime: number;
    endTime: number;
    duration: number;
    costEstimate: number;
    memoryPeak: number;
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
export declare class LoadTestSuite {
    private env;
    private executions;
    private startTime;
    private config;
    constructor(env: Env, config: LoadTestConfig);
    /**
     * Generate random pipeline with given node count
     */
    private generatePipeline;
    /**
     * Run a single pipeline execution
     */
    private executePipeline;
    /**
     * Run load test with specified configuration
     */
    run(): Promise<LoadTestMetrics>;
    /**
     * Calculate metrics from executions
     */
    private calculateMetrics;
    /**
     * Export metrics as JSON
     */
    exportMetrics(metrics: LoadTestMetrics): string;
    /**
     * Export detailed execution log
     */
    exportExecutions(): string;
}
/**
 * Load Test Endpoint Handler
 */
export declare function handleLoadTest(request: Request, env: Env): Promise<Response>;
//# sourceMappingURL=loadTest.d.ts.map