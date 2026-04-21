/**
 * PipelineExecutor Durable Object
 *
 * Manages state and execution of a single pipeline
 * - Maintains node execution states
 * - Coordinates task execution
 * - Aggregates results
 * - Handles retries
 */
import { getReadyNodes, } from './PipelineDAG.js';
/**
 * Durable Object for Pipeline Execution
 */
export class PipelineExecutor {
    constructor(state, env) {
        this.data = null;
        this.state = state;
        this.env = env;
    }
    /**
     * Initialize a new pipeline execution
     */
    async initPipeline(pipeline) {
        const executionId = `exec_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
        const nodeStates = new Map();
        pipeline.nodes.forEach((node) => {
            nodeStates.set(node.id, {
                nodeId: node.id,
                status: 'pending',
                retryCount: 0,
            });
        });
        const execution = {
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
    async loadPipeline() {
        if (this.data)
            return this.data;
        const stored = await this.state.storage?.get('data');
        if (!stored)
            return null;
        try {
            this.data = JSON.parse(stored);
            return this.data;
        }
        catch {
            return null;
        }
    }
    /**
     * Get next ready nodes for execution
     */
    async getReadyNodes() {
        const data = await this.loadPipeline();
        if (!data)
            return [];
        return getReadyNodes(data.pipeline.nodes, data.pipeline.edges, data.execution.nodeStates);
    }
    /**
     * Mark node as running
     */
    async markNodeRunning(nodeId, taskId) {
        const data = await this.loadPipeline();
        if (!data)
            return false;
        const state = data.execution.nodeStates.get(nodeId);
        if (!state)
            return false;
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
    async markNodeCompleted(nodeId, result) {
        const data = await this.loadPipeline();
        if (!data)
            return false;
        const state = data.execution.nodeStates.get(nodeId);
        if (!state)
            return false;
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
    async markNodeFailed(nodeId, error) {
        const data = await this.loadPipeline();
        if (!data)
            return false;
        const state = data.execution.nodeStates.get(nodeId);
        if (!state)
            return false;
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
        }
        else {
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
    async getExecutionStatus() {
        const data = await this.loadPipeline();
        return data?.execution || null;
    }
    /**
     * Finalize pipeline execution
     */
    async finalizePipeline(result) {
        const data = await this.loadPipeline();
        if (!data)
            return;
        data.execution.status = 'completed';
        data.execution.completedAt = new Date().toISOString();
        data.execution.result = result;
        await this.state.storage?.put('data', JSON.stringify(data));
    }
    /**
     * Get execution history/events
     */
    async getExecutionEvents() {
        const data = await this.loadPipeline();
        return data?.events || [];
    }
    /**
     * Get node data for dependency mapping
     */
    async getNodeData(nodeId) {
        const data = await this.loadPipeline();
        if (!data)
            return null;
        const state = data.execution.nodeStates.get(nodeId);
        return state?.output || null;
    }
    /**
     * Get all node data for aggregation
     */
    async getAllNodeData() {
        const data = await this.loadPipeline();
        const result = new Map();
        if (!data)
            return result;
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
    async isPipelineComplete() {
        const data = await this.loadPipeline();
        if (!data)
            return false;
        if (data.execution.status !== 'running') {
            return true;
        }
        // Check if all nodes are completed or failed
        return Array.from(data.execution.nodeStates.values()).every((state) => state.status === 'completed' ||
            state.status === 'failed' ||
            state.status === 'skipped');
    }
    /**
     * Record execution event
     */
    recordEvent(event) {
        if (!this.data)
            return;
        this.data.events.push(event);
    }
    /**
     * Fetch handler (if exposed as HTTP endpoint)
     */
    async fetch(request) {
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
                const body = (await request.json());
                if (path === '/init') {
                    const pipeline = body;
                    const execution = await this.initPipeline(pipeline);
                    return new Response(JSON.stringify(execution), {
                        headers: { 'Content-Type': 'application/json' },
                        status: 201,
                    });
                }
                if (path === '/node-running') {
                    const { nodeId, taskId } = body;
                    const success = await this.markNodeRunning(nodeId, taskId);
                    return new Response(JSON.stringify({ success }), {
                        headers: { 'Content-Type': 'application/json' },
                    });
                }
                if (path === '/node-completed') {
                    const { nodeId, result } = body;
                    const success = await this.markNodeCompleted(nodeId, result);
                    return new Response(JSON.stringify({ success }), {
                        headers: { 'Content-Type': 'application/json' },
                    });
                }
                if (path === '/node-failed') {
                    const { nodeId, error } = body;
                    const success = await this.markNodeFailed(nodeId, error);
                    return new Response(JSON.stringify({ success }), {
                        headers: { 'Content-Type': 'application/json' },
                    });
                }
                if (path === '/finalize') {
                    const { result } = body;
                    await this.finalizePipeline(result);
                    return new Response('Pipeline finalized', { status: 200 });
                }
                return new Response('Not found', { status: 404 });
            }
            return new Response('Method not allowed', { status: 405 });
        }
        catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            return new Response(JSON.stringify({ error: errorMsg }), {
                headers: { 'Content-Type': 'application/json' },
                status: 500,
            });
        }
    }
}
export default new PipelineExecutor({}, {});
//# sourceMappingURL=PipelineExecutor.js.map