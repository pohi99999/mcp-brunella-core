/**
 * PipelineExecutor Durable Object
 *
 * Manages state and execution of a single pipeline
 * - Maintains node execution states
 * - Coordinates task execution
 * - Aggregates results
 * - Handles retries
 */
import { Pipeline, PipelineExecution, ExecutionEvent } from './PipelineDAG.js';
interface PipelineData {
    pipeline: Pipeline;
    execution: PipelineExecution;
    events: ExecutionEvent[];
}
/**
 * Durable Object for Pipeline Execution
 */
export declare class PipelineExecutor {
    private state;
    private env;
    private data;
    constructor(state: DurableObjectState, env: unknown);
    /**
     * Initialize a new pipeline execution
     */
    initPipeline(pipeline: Pipeline): Promise<PipelineExecution>;
    /**
     * Load persisted pipeline data
     */
    loadPipeline(): Promise<PipelineData | null>;
    /**
     * Get next ready nodes for execution
     */
    getReadyNodes(): Promise<string[]>;
    /**
     * Mark node as running
     */
    markNodeRunning(nodeId: string, taskId: string): Promise<boolean>;
    /**
     * Mark node as completed with result
     */
    markNodeCompleted(nodeId: string, result: Record<string, unknown>): Promise<boolean>;
    /**
     * Mark node as failed
     */
    markNodeFailed(nodeId: string, error: string): Promise<boolean>;
    /**
     * Get execution status
     */
    getExecutionStatus(): Promise<PipelineExecution | null>;
    /**
     * Finalize pipeline execution
     */
    finalizePipeline(result: Record<string, unknown>): Promise<void>;
    /**
     * Get execution history/events
     */
    getExecutionEvents(): Promise<ExecutionEvent[]>;
    /**
     * Get node data for dependency mapping
     */
    getNodeData(nodeId: string): Promise<Record<string, unknown> | null>;
    /**
     * Get all node data for aggregation
     */
    getAllNodeData(): Promise<Map<string, Record<string, unknown>>>;
    /**
     * Check if pipeline is complete
     */
    isPipelineComplete(): Promise<boolean>;
    /**
     * Record execution event
     */
    private recordEvent;
    /**
     * Fetch handler (if exposed as HTTP endpoint)
     */
    fetch(request: Request): Promise<Response>;
}
declare const _default: PipelineExecutor;
export default _default;
//# sourceMappingURL=PipelineExecutor.d.ts.map