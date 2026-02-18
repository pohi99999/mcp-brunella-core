/**
 * PipelineDAG - Directed Acyclic Graph support for Orchestrator
 *
 * Features:
 * - Sequential pipeline execution (Task A → Task B → Task C)
 * - Parallel fan-out/fan-in patterns (1 parent → N jobs → 1 aggregator)
 * - DAG validation (no cycles, no orphans)
 * - State management via Durable Objects
 * - Result aggregation
 */
export type TaskNodeType = 'sequential' | 'parallel' | 'aggregator' | 'root';
export type ExecutionMode = 'sequential' | 'parallel' | 'mixed';
/**
 * DAG Node representing a single task or operation
 */
export interface DAGNode {
    id: string;
    type: TaskNodeType;
    agentType: 'research' | 'grant' | 'harvester' | 'analyzer' | 'aggregator';
    name: string;
    description?: string;
    payload: Record<string, unknown>;
    dependencies: string[];
    timeoutMs?: number;
    maxRetries?: number;
    priority?: 'low' | 'normal' | 'high';
}
/**
 * DAG Edge representing dependency between nodes
 */
export interface DAGEdge {
    from: string;
    to: string;
    condition?: 'always' | 'on_success' | 'on_failure';
    dataMapping?: Record<string, string>;
}
/**
 * Complete DAG structure (Directed Acyclic Graph)
 */
export interface Pipeline {
    id: string;
    name: string;
    description?: string;
    version: string;
    createdAt: string;
    nodes: DAGNode[];
    edges: DAGEdge[];
    executionMode: ExecutionMode;
    metadata?: {
        estimatedDuration?: number;
        estimatedCost?: number;
        tags?: string[];
    };
}
/**
 * Node execution state (tracked in Durable Objects)
 */
export interface NodeExecutionState {
    nodeId: string;
    status: 'pending' | 'ready' | 'running' | 'completed' | 'failed' | 'skipped';
    taskId?: string;
    result?: Record<string, unknown>;
    error?: string;
    startedAt?: string;
    completedAt?: string;
    retryCount: number;
    output?: Record<string, unknown>;
}
/**
 * Pipeline execution record
 */
export interface PipelineExecution {
    executionId: string;
    pipelineId: string;
    pipelineName: string;
    status: 'running' | 'completed' | 'failed' | 'paused';
    nodeStates: Map<string, NodeExecutionState>;
    startedAt: string;
    completedAt?: string;
    error?: string;
    result?: Record<string, unknown>;
}
/**
 * Execution event for tracking
 */
export interface ExecutionEvent {
    timestamp: string;
    nodeId: string;
    type: 'started' | 'completed' | 'failed' | 'retrying' | 'skipped';
    details?: Record<string, unknown>;
}
/**
 * Validate DAG for cycles and other issues
 */
export declare function validatePipeline(pipeline: Pipeline): {
    valid: boolean;
    errors: string[];
};
/**
 * Get topological order of nodes for execution
 */
export declare function getTopologicalOrder(nodes: DAGNode[], edges: DAGEdge[]): string[];
/**
 * Get nodes ready for execution (all dependencies met)
 */
export declare function getReadyNodes(nodes: DAGNode[], edges: DAGEdge[], nodeStates: Map<string, NodeExecutionState>): string[];
/**
 * Map data from parent node output to child node input
 */
export declare function mapNodeData(parentOutput: Record<string, unknown>, mapping?: Record<string, string>): Record<string, unknown>;
/**
 * Aggregate results from multiple parallel nodes
 */
export declare function aggregateResults(nodeResults: Map<string, Record<string, unknown>>, mode?: 'array' | 'object' | 'merge'): Record<string, unknown>;
/**
 * Calculate pipeline execution cost
 */
export declare function calculatePipelineCost(pipeline: Pipeline, costPerTask?: number): number;
/**
 * Calculate estimated execution time
 */
export declare function estimateExecutionTime(pipeline: Pipeline, avgTaskDuration?: number): number;
/**
 * Generate execution plan from DAG
 */
export declare function generateExecutionPlan(pipeline: Pipeline): {
    phases: string[][];
    topologicalOrder: string[];
};
//# sourceMappingURL=PipelineDAG.d.ts.map