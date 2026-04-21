/**
 * PipelineExecutor Durable Object
 * 
 * Manages state and execution of a single pipeline
 * - Maintains node execution states
 * - Coordinates task execution
 * - Aggregates results
 * - Handles retries
 */

import {
  Pipeline,
  PipelineExecution,
  NodeExecutionState,
  ExecutionEvent,
  getReadyNodes,
  getTopologicalOrder,
  mapNodeData,
} from './PipelineDAG.js';

interface PipelineData {
  pipeline: Pipeline;
  execution: PipelineExecution;
  events: ExecutionEvent[];
}

/**
 * Durable Object for Pipeline Execution
 */
export class PipelineExecutor {
  private state: DurableObjectState;
  private env: unknown;
  private data: PipelineData | null = null;

  constructor(state: DurableObjectState, env: unknown) {
    this.state = state;
    this.env = env;
  }

  /**
   * Initialize a new pipeline execution
   */
  async initPipeline(pipeline: Pipeline): Promise<PipelineExecution> {
    const executionId = `exec_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    const nodeStates = new Map<string, NodeExecutionState>();

    pipeline.nodes.forEach((node) => {
      nodeStates.set(node.id, {
        nodeId: node.id,
        status: 'pending',
        retryCount: 0,
      });
    });

    const execution: PipelineExecution = {
      executionId,
      pipelineId: pipeline.id,
      pipelineName: pipeline.name,
      status: 'running',
      nodeStates,
      startedAt: new Date().toISOString(),
    };

    this.data = {
      pipeline,
      execution,
      events: [],
    };

    // Persist to Durable Object storage
    await this.state.storage?.put('data', JSON.stringify(this.data));

    return execution;
  }

  /**
   * Load persisted pipeline data
   */
  async loadPipeline(): Promise<PipelineData | null> {
    if (this.data) return this.data;

    const stored = await this.state.storage?.get('data');
    if (!stored) return null;

    try {
      this.data = JSON.parse(stored as string);
      return this.data;
    } catch {
      return null;
    }
  }

  /**
   * Get next ready nodes for execution
   */
  async getReadyNodes(): Promise<string[]> {
    const data = await this.loadPipeline();
    if (!data) return [];

    return getReadyNodes(
      data.pipeline.nodes,
      data.pipeline.edges,
      data.execution.nodeStates,
    );
  }

  /**
   * Mark node as running
   */
  async markNodeRunning(
    nodeId: string,
    taskId: string,
  ): Promise<boolean> {
    const data = await this.loadPipeline();
    if (!data) return false;

    const state = data.execution.nodeStates.get(nodeId);
    if (!state) return false;

    state.status = 'running';
    state.taskId = taskId;
    state.startedAt = new Date().toISOString();

    this.recordEvent({
      timestamp: new Date().toISOString(),
      nodeId,
      type: 'started',
      details: { taskId },
    });

    await this.state.storage?.put('data', JSON.stringify(data));
    return true;
  }

  /**
   * Mark node as completed with result
   */
  async markNodeCompleted(
    nodeId: string,
    result: Record<string, unknown>,
  ): Promise<boolean> {
    const data = await this.loadPipeline();
    if (!data) return false;

    const state = data.execution.nodeStates.get(nodeId);
    if (!state) return false;

    state.status = 'completed';
    state.result = result;
    state.output = result;
    state.completedAt = new Date().toISOString();

    this.recordEvent({
      timestamp: new Date().toISOString(),
      nodeId,
      type: 'completed',
      details: { resultKeys: Object.keys(result) },
    });

    await this.state.storage?.put('data', JSON.stringify(data));
    return true;
  }

  /**
   * Mark node as failed
   */
  async markNodeFailed(
    nodeId: string,
    error: string,
  ): Promise<boolean> {
    const data = await this.loadPipeline();
    if (!data) return false;

    const state = data.execution.nodeStates.get(nodeId);
    if (!state) return false;

    // Check if we can retry
    const node = data.pipeline.nodes.find((n) => n.id === nodeId);
    const maxRetries = node?.maxRetries || 0;

    if (state.retryCount < maxRetries) {
      state.status = 'pending';
      state.retryCount++;
      this.recordEvent({
        timestamp: new Date().toISOString(),
        nodeId,
        type: 'retrying',
        details: { retryCount: state.retryCount, maxRetries },
      });
    } else {
      state.status = 'failed';
      state.error = error;
      state.completedAt = new Date().toISOString();
      data.execution.status = 'failed';
      data.execution.error = error;

      this.recordEvent({
        timestamp: new Date().toISOString(),
        nodeId,
        type: 'failed',
        details: { error },
      });
    }

    await this.state.storage?.put('data', JSON.stringify(data));
    return true;
  }

  /**
   * Get execution status
   */
  async getExecutionStatus(): Promise<PipelineExecution | null> {
    const data = await this.loadPipeline();
    return data?.execution || null;
  }

  /**
   * Finalize pipeline execution
   */
  async finalizePipeline(
    result: Record<string, unknown>,
  ): Promise<void> {
    const data = await this.loadPipeline();
    if (!data) return;

    data.execution.status = 'completed';
    data.execution.completedAt = new Date().toISOString();
    data.execution.result = result;

    await this.state.storage?.put('data', JSON.stringify(data));
  }

  /**
   * Get execution history/events
   */
  async getExecutionEvents(): Promise<ExecutionEvent[]> {
    const data = await this.loadPipeline();
    return data?.events || [];
  }

  /**
   * Get node data for dependency mapping
   */
  async getNodeData(nodeId: string): Promise<Record<string, unknown> | null> {
    const data = await this.loadPipeline();
    if (!data) return null;

    const state = data.execution.nodeStates.get(nodeId);
    return state?.output || null;
  }

  /**
   * Get all node data for aggregation
   */
  async getAllNodeData(): Promise<Map<string, Record<string, unknown>>> {
    const data = await this.loadPipeline();
    const result = new Map<string, Record<string, unknown>>();

    if (!data) return result;

    data.execution.nodeStates.forEach((state) => {
      if (state.output) {
        result.set(state.nodeId, state.output);
      }
    });

    return result;
  }

  /**
   * Check if pipeline is complete
   */
  async isPipelineComplete(): Promise<boolean> {
    const data = await this.loadPipeline();
    if (!data) return false;

    if (data.execution.status !== 'running') {
      return true;
    }

    // Check if all nodes are completed or failed
    return Array.from(data.execution.nodeStates.values()).every(
      (state) =>
        state.status === 'completed' ||
        state.status === 'failed' ||
        state.status === 'skipped',
    );
  }

  /**
   * Record execution event
   */
  private recordEvent(event: ExecutionEvent): void {
    if (!this.data) return;
    this.data.events.push(event);
  }

  /**
   * Fetch handler (if exposed as HTTP endpoint)
   */
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname.replace('/pipeline', '');

    try {
      if (request.method === 'GET') {
        if (path === '/status') {
          const status = await this.getExecutionStatus();
          return new Response(JSON.stringify(status), {
            headers: { 'Content-Type': 'application/json' },
          });
        }

        if (path === '/events') {
          const events = await this.getExecutionEvents();
          return new Response(JSON.stringify(events), {
            headers: { 'Content-Type': 'application/json' },
          });
        }

        if (path === '/ready-nodes') {
          const ready = await this.getReadyNodes();
          return new Response(JSON.stringify({ ready }), {
            headers: { 'Content-Type': 'application/json' },
          });
        }

        return new Response('Not found', { status: 404 });
      }

      if (request.method === 'POST') {
        const body = (await request.json()) as Record<string, unknown>;

        if (path === '/init') {
          const pipeline = body as unknown as Pipeline;
          const execution = await this.initPipeline(pipeline);
          return new Response(JSON.stringify(execution), {
            headers: { 'Content-Type': 'application/json' },
            status: 201,
          });
        }

        if (path === '/node-running') {
          const { nodeId, taskId } = body as {
            nodeId: string;
            taskId: string;
          };
          const success = await this.markNodeRunning(nodeId, taskId);
          return new Response(JSON.stringify({ success }), {
            headers: { 'Content-Type': 'application/json' },
          });
        }

        if (path === '/node-completed') {
          const { nodeId, result } = body as {
            nodeId: string;
            result: Record<string, unknown>;
          };
          const success = await this.markNodeCompleted(nodeId, result);
          return new Response(JSON.stringify({ success }), {
            headers: { 'Content-Type': 'application/json' },
          });
        }

        if (path === '/node-failed') {
          const { nodeId, error } = body as {
            nodeId: string;
            error: string;
          };
          const success = await this.markNodeFailed(nodeId, error);
          return new Response(JSON.stringify({ success }), {
            headers: { 'Content-Type': 'application/json' },
          });
        }

        if (path === '/finalize') {
          const { result } = body as {
            result: Record<string, unknown>;
          };
          await this.finalizePipeline(result);
          return new Response('Pipeline finalized', { status: 200 });
        }

        return new Response('Not found', { status: 404 });
      }

      return new Response('Method not allowed', { status: 405 });
    } catch (error: unknown) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      return new Response(JSON.stringify({ error: errorMsg }), {
        headers: { 'Content-Type': 'application/json' },
        status: 500,
      });
    }
  }
}

export default new PipelineExecutor({} as DurableObjectState, {});
