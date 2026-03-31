import { wrapWithSpan } from "../utils/otelTracing.js";
import { getOrchestrationConcurrencyLimit } from "../config/paiosConfig.js";

export type DAGNodeType = "agent" | "condition" | "loop" | "transform";
export type DAGExecutionStatus = "success" | "partial" | "error" | "budget_exceeded" | "timeout";

export interface DAGBudget {
  maxTokens?: number;
  maxCostUSD?: number;
  maxDurationMs?: number;
}

export interface DAGContext {
  input?: unknown;
  values: Record<string, unknown>;
  nodeResults: Record<string, NodeResult>;
  warnings: string[];
  totalTokens: number;
  totalCostUSD: number;
  startedAt: number;
}

export interface DAGNode {
  id: string;
  label: string;
  type: DAGNodeType;
  agentName?: string;
  instruction?: string;
  dependsOn?: string[];
  timeoutMs?: number;
  continueOnError?: boolean;
  predicate?: (context: DAGContext) => boolean | Promise<boolean>;
  conditionSourceId?: string;
  expectedCondition?: boolean;
  onErrorFrom?: string;
  loop?: {
    maxIterations: number;
    condition: (context: DAGContext) => boolean | Promise<boolean>;
    body: DAGWorkflow;
  };
  transform?: (context: DAGContext) => unknown | Promise<unknown>;
  metadata?: Record<string, unknown>;
}

export interface DAGEdge {
  from: string;
  to: string;
}

export interface DAGWorkflow {
  id: string;
  name: string;
  nodes: DAGNode[];
  edges?: DAGEdge[];
  budget?: DAGBudget;
  maxConcurrency?: number;
}

export interface NodeResult {
  nodeId: string;
  status: "success" | "error" | "skipped" | "timeout";
  output?: unknown;
  error?: string;
  durationMs: number;
  tokensUsed?: number;
  costUSD?: number;
  condition?: boolean;
  iterations?: number;
}

export interface DAGExecutionResult {
  workflowId: string;
  status: DAGExecutionStatus;
  nodeResults: Record<string, NodeResult>;
  totalTokens: number;
  totalCostUSD: number;
  durationMs: number;
  warnings: string[];
  completedNodeIds: string[];
}

export interface CopilotAgentExecutionContext {
  node: DAGNode;
  context: DAGContext;
  phase: 'before' | 'after';
  output?: unknown;
}

export interface DAGExecutor {
  executeAgent(node: DAGNode, context: DAGContext): Promise<unknown>;
  /**
   * Optional Copilot orchestration hook for agent execution.
   */
  copilotAgentExecutionHook?: (ctx: CopilotAgentExecutionContext) => void;
}

function withTimeout<T>(promise: Promise<T>, timeoutMs?: number): Promise<T> {
  if (!timeoutMs || timeoutMs <= 0) {
    return promise;
  }

  return Promise.race<T>([
    promise,
    new Promise<T>((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Node timeout after ${timeoutMs}ms`));
      }, timeoutMs);
    }),
  ]);
}

function shouldRunNode(node: DAGNode, context: DAGContext): boolean {
  if (node.conditionSourceId) {
    const source = context.nodeResults[node.conditionSourceId];
    const actual = Boolean(source?.condition);
    if (node.expectedCondition !== undefined) {
      return actual === node.expectedCondition;
    }
  }

  if (node.onErrorFrom) {
    return context.nodeResults[node.onErrorFrom]?.status === "error";
  }

  return true;
}

function updateBudget(context: DAGContext, result: NodeResult): void {
  context.totalTokens += result.tokensUsed ?? 0;
  context.totalCostUSD += result.costUSD ?? 0;
  context.nodeResults[result.nodeId] = result;
  context.values[result.nodeId] = result.output;
}

function checkBudgetExceeded(workflow: DAGWorkflow, context: DAGContext): string | null {
  const budget = workflow.budget;
  if (!budget) return null;

  if (budget.maxTokens !== undefined && context.totalTokens > budget.maxTokens) {
    return `Token budget exceeded (${context.totalTokens}/${budget.maxTokens})`;
  }
  if (budget.maxCostUSD !== undefined && context.totalCostUSD > budget.maxCostUSD) {
    return `Cost budget exceeded (${context.totalCostUSD.toFixed(4)}/${budget.maxCostUSD.toFixed(4)})`;
  }
  if (budget.maxDurationMs !== undefined && Date.now() - context.startedAt > budget.maxDurationMs) {
    return `Duration budget exceeded (${Date.now() - context.startedAt}/${budget.maxDurationMs}ms)`;
  }
  return null;
}

function computeIndegrees(workflow: DAGWorkflow): { inDegree: Map<string, number>; adjacency: Map<string, string[]> } {
  const adjacency = new Map<string, string[]>();
  const inDegree = new Map<string, number>();
  const nodeIds = new Set(workflow.nodes.map((node) => node.id));

  for (const node of workflow.nodes) {
    adjacency.set(node.id, []);
    inDegree.set(node.id, 0);
  }

  for (const node of workflow.nodes) {
    for (const dependency of node.dependsOn ?? []) {
      if (!nodeIds.has(dependency)) {
        continue;
      }
      adjacency.get(dependency)?.push(node.id);
      inDegree.set(node.id, (inDegree.get(node.id) ?? 0) + 1);
    }
  }

  return { inDegree, adjacency };
}

export function topologicalSort(nodes: DAGNode[]): DAGNode[] {
  const workflow: DAGWorkflow = { id: "topology", name: "topology", nodes };
  const { inDegree, adjacency } = computeIndegrees(workflow);
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const queue = nodes.filter((node) => (inDegree.get(node.id) ?? 0) === 0).map((node) => node.id);
  const sorted: DAGNode[] = [];

  while (queue.length > 0) {
    const nextId = queue.shift();
    if (!nextId) continue;
    const node = byId.get(nextId);
    if (!node) continue;
    sorted.push(node);

    for (const child of adjacency.get(nextId) ?? []) {
      const remaining = (inDegree.get(child) ?? 0) - 1;
      inDegree.set(child, remaining);
      if (remaining === 0) {
        queue.push(child);
      }
    }
  }

  if (sorted.length !== nodes.length) {
    throw new Error("Cycle detected in DAG workflow");
  }

  return sorted;
}

function getExecutionRounds(workflow: DAGWorkflow): DAGNode[][] {
  const sorted = topologicalSort(workflow.nodes);
  const byId = new Map(sorted.map((node) => [node.id, node]));
  const levelById = new Map<string, number>();

  for (const node of sorted) {
    const level = Math.max(0, ...((node.dependsOn ?? []).map((dependency) => (levelById.get(dependency) ?? -1) + 1)));
    levelById.set(node.id, level);
  }

  const rounds = new Map<number, DAGNode[]>();
  for (const [nodeId, level] of levelById.entries()) {
    const node = byId.get(nodeId);
    if (!node) continue;
    const existing = rounds.get(level) ?? [];
    existing.push(node);
    rounds.set(level, existing);
  }

  return [...rounds.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([, value]) => value);
}

async function executeNode(node: DAGNode, context: DAGContext, executor: DAGExecutor): Promise<NodeResult> {
  const start = Date.now();

  if (!shouldRunNode(node, context)) {
    return {
      nodeId: node.id,
      status: "skipped",
      durationMs: Date.now() - start,
      output: null,
    };
  }

  try {
    if (node.type === "condition") {
      const condition = Boolean(await node.predicate?.(context));
      return {
        nodeId: node.id,
        status: "success",
        condition,
        output: condition,
        durationMs: Date.now() - start,
      };
    }

    if (node.type === "loop") {
      const loopConfig = node.loop;
      if (!loopConfig) {
        throw new Error(`Loop node '${node.id}' missing loop config`);
      }

      let iterations = 0;
      let lastResult: DAGExecutionResult | undefined;
      while (iterations < loopConfig.maxIterations && await loopConfig.condition(context)) {
        iterations += 1;
        lastResult = await executeDAG(loopConfig.body, context, executor);
        context.warnings.push(...lastResult.warnings);
      }

      return {
        nodeId: node.id,
        status: "success",
        output: lastResult,
        iterations,
        durationMs: Date.now() - start,
      };
    }

    if (node.type === "transform") {
      const output = await withTimeout(Promise.resolve(node.transform?.(context)), node.timeoutMs);
      return {
        nodeId: node.id,
        status: "success",
        output,
        durationMs: Date.now() - start,
      };
    }

    // AGENT node execution
    if (typeof executor.copilotAgentExecutionHook === 'function') {
      executor.copilotAgentExecutionHook({ node, context, phase: 'before' });
    }
    const output = await withTimeout(executor.executeAgent(node, context), node.timeoutMs);
    if (typeof executor.copilotAgentExecutionHook === 'function') {
      executor.copilotAgentExecutionHook({ node, context, phase: 'after', output });
    }
    const outputRecord = typeof output === "object" && output !== null ? output as Record<string, unknown> : null;

    return {
      nodeId: node.id,
      status: "success",
      output,
      durationMs: Date.now() - start,
      tokensUsed: typeof outputRecord?.metadata === "object" && outputRecord.metadata !== null && typeof (outputRecord.metadata as Record<string, unknown>).tokensUsed === "number"
        ? Number((outputRecord.metadata as Record<string, unknown>).tokensUsed)
        : undefined,
      costUSD: typeof outputRecord?.metadata === "object" && outputRecord.metadata !== null && typeof (outputRecord.metadata as Record<string, unknown>).costUSD === "number"
        ? Number((outputRecord.metadata as Record<string, unknown>).costUSD)
        : undefined,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      nodeId: node.id,
      status: message.includes("timeout") ? "timeout" : "error",
      error: message,
      durationMs: Date.now() - start,
    };
  }
}

export async function executeDAG(
  workflow: DAGWorkflow,
  initialContext: Partial<DAGContext>,
  executor: DAGExecutor,
): Promise<DAGExecutionResult> {
  return wrapWithSpan(
    "bas-dag-engine",
    `${workflow.id}::workflow`,
    {
      "bas.workflow.id": workflow.id,
      "bas.workflow.name": workflow.name,
      "bas.workflow.node_count": workflow.nodes.length,
    },
    async () => {
      const context: DAGContext = {
        input: initialContext.input,
        values: initialContext.values ?? {},
        nodeResults: initialContext.nodeResults ?? {},
        warnings: initialContext.warnings ?? [],
        totalTokens: initialContext.totalTokens ?? 0,
        totalCostUSD: initialContext.totalCostUSD ?? 0,
        startedAt: initialContext.startedAt ?? Date.now(),
      };

      const rounds = getExecutionRounds(workflow);
      const configuredConcurrency = workflow.maxConcurrency ?? getOrchestrationConcurrencyLimit();
      const maxConcurrency = Math.max(1, configuredConcurrency);
      const completedNodeIds: string[] = [];
      let status: DAGExecutionStatus = "success";

      for (const round of rounds) {
        for (let index = 0; index < round.length; index += maxConcurrency) {
          const batch = round.slice(index, index + maxConcurrency);
          const settled = await Promise.allSettled(batch.map((node) => executeNode(node, context, executor)));

          for (const item of settled) {
            if (item.status === "rejected") {
              status = "error";
              context.warnings.push(item.reason instanceof Error ? item.reason.message : String(item.reason));
              continue;
            }

            const nodeResult = item.value;
            updateBudget(context, nodeResult);
            completedNodeIds.push(nodeResult.nodeId);

            if (nodeResult.status === "timeout") {
              status = status === "success" ? "timeout" : status;
              context.warnings.push(`Node timeout: ${nodeResult.nodeId}`);
              continue;
            }

            if (nodeResult.status === "error") {
              const node = workflow.nodes.find((candidate) => candidate.id === nodeResult.nodeId);
              if (node?.continueOnError) {
                status = status === "success" ? "partial" : status;
                continue;
              }
              status = "error";
            }
          }
        }

        const budgetMessage = checkBudgetExceeded(workflow, context);
        if (budgetMessage) {
          status = "budget_exceeded";
          context.warnings.push(budgetMessage);
          break;
        }

        if (status === "error") {
          const hasErrorHandlers = workflow.nodes.some((node) => node.onErrorFrom);
          if (!hasErrorHandlers) {
            break;
          }
        }
      }

      return {
        workflowId: workflow.id,
        status,
        nodeResults: context.nodeResults,
        totalTokens: context.totalTokens,
        totalCostUSD: context.totalCostUSD,
        durationMs: Date.now() - context.startedAt,
        warnings: context.warnings,
        completedNodeIds,
      };
    },
  );
}
