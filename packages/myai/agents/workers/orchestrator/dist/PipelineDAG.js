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
// ═══════════════════════════════════════════════════════════════════
// DAG VALIDATION & UTILITIES
// ═══════════════════════════════════════════════════════════════════
/**
 * Validate DAG for cycles and other issues
 */
export function validatePipeline(pipeline) {
    const errors = [];
    // Check for empty pipeline
    if (pipeline.nodes.length === 0) {
        errors.push('Pipeline must contain at least one node');
    }
    // Check for duplicate node IDs
    const nodeIds = new Set();
    pipeline.nodes.forEach((node) => {
        if (nodeIds.has(node.id)) {
            errors.push(`Duplicate node ID: ${node.id}`);
        }
        nodeIds.add(node.id);
    });
    // Check edges reference valid nodes
    pipeline.edges.forEach((edge) => {
        if (!nodeIds.has(edge.from)) {
            errors.push(`Edge references non-existent source node: ${edge.from}`);
        }
        if (!nodeIds.has(edge.to)) {
            errors.push(`Edge references non-existent target node: ${edge.to}`);
        }
    });
    // Check for cycles using DFS
    const hasCycle = detectCycle(pipeline.nodes, pipeline.edges);
    if (hasCycle) {
        errors.push('Pipeline contains a cycle (not a valid DAG)');
    }
    // Check for orphan nodes (nodes with no edges and no root)
    const connectednodeIds = new Set();
    pipeline.edges.forEach((edge) => {
        connectednodeIds.add(edge.from);
        connectednodeIds.add(edge.to);
    });
    const orphans = pipeline.nodes.filter((n) => !connectednodeIds.has(n.id) && pipeline.nodes.length > 1);
    if (orphans.length > 0) {
        orphans.forEach((n) => {
            if (n.type !== 'root') {
                errors.push(`Orphan node (not connected): ${n.id}`);
            }
        });
    }
    return {
        valid: errors.length === 0,
        errors,
    };
}
/**
 * DFS-based cycle detection
 */
function detectCycle(nodes, edges) {
    const adjList = new Map();
    // Build adjacency list
    nodes.forEach((node) => {
        adjList.set(node.id, []);
    });
    edges.forEach((edge) => {
        const neighbors = adjList.get(edge.from) || [];
        neighbors.push(edge.to);
        adjList.set(edge.from, neighbors);
    });
    // DFS visit states: 'white' (unvisited), 'gray' (visiting), 'black' (visited)
    const color = new Map();
    nodes.forEach((node) => {
        color.set(node.id, 'white');
    });
    function dfs(nodeId) {
        color.set(nodeId, 'gray');
        const neighbors = adjList.get(nodeId) || [];
        for (const neighbor of neighbors) {
            const neighborColor = color.get(neighbor) || 'white';
            if (neighborColor === 'gray') {
                return true; // Back edge found = cycle
            }
            if (neighborColor === 'white' && dfs(neighbor)) {
                return true;
            }
        }
        color.set(nodeId, 'black');
        return false;
    }
    for (const node of nodes) {
        if (color.get(node.id) === 'white') {
            if (dfs(node.id)) {
                return true;
            }
        }
    }
    return false;
}
/**
 * Get topological order of nodes for execution
 */
export function getTopologicalOrder(nodes, edges) {
    const inDegree = new Map();
    const adjList = new Map();
    // Initialize
    nodes.forEach((node) => {
        inDegree.set(node.id, 0);
        adjList.set(node.id, []);
    });
    // Build adjacency list and in-degrees
    edges.forEach((edge) => {
        const neighbors = adjList.get(edge.from) || [];
        neighbors.push(edge.to);
        adjList.set(edge.from, neighbors);
        const currentInDegree = inDegree.get(edge.to) || 0;
        inDegree.set(edge.to, currentInDegree + 1);
    });
    // Kahn's algorithm
    const queue = [];
    const result = [];
    inDegree.forEach((degree, nodeId) => {
        if (degree === 0) {
            queue.push(nodeId);
        }
    });
    while (queue.length > 0) {
        const nodeId = queue.shift();
        result.push(nodeId);
        const neighbors = adjList.get(nodeId) || [];
        neighbors.forEach((neighbor) => {
            const degree = (inDegree.get(neighbor) || 0) - 1;
            inDegree.set(neighbor, degree);
            if (degree === 0) {
                queue.push(neighbor);
            }
        });
    }
    return result;
}
/**
 * Get nodes ready for execution (all dependencies met)
 */
export function getReadyNodes(nodes, edges, nodeStates) {
    const readyNodes = [];
    nodes.forEach((node) => {
        const state = nodeStates.get(node.id);
        if (!state)
            return; // Node not in execution yet
        if (state.status !== 'pending')
            return; // Already started or completed
        // Check if all dependencies are completed
        const dependencyIds = node.dependencies;
        const allDepsCompleted = dependencyIds.every((depId) => {
            const depState = nodeStates.get(depId);
            return depState?.status === 'completed';
        });
        if (allDepsCompleted || dependencyIds.length === 0) {
            readyNodes.push(node.id);
        }
    });
    return readyNodes;
}
/**
 * Map data from parent node output to child node input
 */
export function mapNodeData(parentOutput, mapping) {
    if (!mapping) {
        return parentOutput; // Pass all parent output through
    }
    const result = {};
    Object.entries(mapping).forEach(([childKey, parentKey]) => {
        result[childKey] = parentOutput[parentKey];
    });
    return result;
}
/**
 * Aggregate results from multiple parallel nodes
 */
export function aggregateResults(nodeResults, mode = 'array') {
    const resultArray = Array.from(nodeResults.values());
    switch (mode) {
        case 'array':
            return { results: resultArray };
        case 'object': {
            const resultObj = {};
            nodeResults.forEach((result, nodeId) => {
                resultObj[nodeId] = result;
            });
            return resultObj;
        }
        case 'merge':
            return Object.assign({}, ...resultArray);
        default:
            return { results: resultArray };
    }
}
/**
 * Calculate pipeline execution cost
 */
export function calculatePipelineCost(pipeline, costPerTask = 0.0001) {
    return pipeline.nodes.length * costPerTask;
}
/**
 * Calculate estimated execution time
 */
export function estimateExecutionTime(pipeline, avgTaskDuration = 1000) {
    // Simplified: depends heavily on execution mode and dependencies
    // For sequential: sum of all task times
    // For parallel: critical path
    if (pipeline.executionMode === 'sequential') {
        return pipeline.nodes.length * avgTaskDuration;
    }
    // For parallel/mixed, estimate critical path length
    const maxDepth = Math.max(...pipeline.nodes.map((n) => estimateNodeDepth(n.id, pipeline.edges)));
    return maxDepth * avgTaskDuration;
}
function estimateNodeDepth(nodeId, edges) {
    const incomingEdges = edges.filter((e) => e.to === nodeId);
    if (incomingEdges.length === 0) {
        return 1; // Leaf node
    }
    const maxParentDepth = Math.max(...incomingEdges.map((e) => estimateNodeDepth(e.from, edges)));
    return maxParentDepth + 1;
}
/**
 * Generate execution plan from DAG
 */
export function generateExecutionPlan(pipeline) {
    const topologicalOrder = getTopologicalOrder(pipeline.nodes, pipeline.edges);
    // Group into execution phases (all nodes in same phase can run in parallel)
    const phases = [];
    const processedSet = new Set();
    // Build parent map
    const parentMap = new Map();
    pipeline.nodes.forEach((node) => {
        parentMap.set(node.id, new Set(node.dependencies));
    });
    while (processedSet.size < pipeline.nodes.length) {
        const currentPhase = [];
        topologicalOrder.forEach((nodeId) => {
            if (processedSet.has(nodeId))
                return;
            const parents = parentMap.get(nodeId) || new Set();
            const allParentsProcessed = Array.from(parents).every((p) => processedSet.has(p));
            if (allParentsProcessed) {
                currentPhase.push(nodeId);
            }
        });
        if (currentPhase.length > 0) {
            phases.push(currentPhase);
            currentPhase.forEach((n) => processedSet.add(n));
        }
        else {
            break; // Prevent infinite loop
        }
    }
    return { phases, topologicalOrder };
}
//# sourceMappingURL=PipelineDAG.js.map