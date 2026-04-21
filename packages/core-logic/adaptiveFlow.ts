/**
 * AdaptiveFlow — Metric-driven runtime workflow optimization
 * Phase 5: Adaptive Swarms & Workflow Intelligence
 *
 * Observes workflow step durations, success rates, and resource usage,
 * then reorders or replaces steps to improve overall throughput.
 */

import { EventEmitter } from 'events';
import { logInfo, logWarn } from '@packages/utils/logger.js';

export interface FlowStep {
  stepId: string;
  name: string;
  handler: (input: unknown) => Promise<unknown>;
  capabilities?: string[];
  weight?: number;  // priority/ordering hint
}

export interface StepMetrics {
  stepId: string;
  executions: number;
  totalDurationMs: number;
  avgDurationMs: number;
  successCount: number;
  failCount: number;
  successRate: number;
  lastExecutedAt: number;
}

export interface FlowDefinition {
  flowId: string;
  name: string;
  steps: FlowStep[];
}

export interface FlowOptimization {
  flowId: string;
  reorderedSteps: string[];
  reason: string;
  expectedImprovement: number;  // percentage
  timestamp: number;
}

export class AdaptiveFlow extends EventEmitter {
  private flows = new Map<string, FlowDefinition>();
  private metrics = new Map<string, StepMetrics>();   // stepId → metrics
  private optimizations: FlowOptimization[] = [];

  /** Register a workflow */
  registerFlow(flow: FlowDefinition): void {
    this.flows.set(flow.flowId, flow);
    for (const step of flow.steps) {
      if (!this.metrics.has(step.stepId)) {
        this.metrics.set(step.stepId, {
          stepId: step.stepId,
          executions: 0,
          totalDurationMs: 0,
          avgDurationMs: 0,
          successCount: 0,
          failCount: 0,
          successRate: 1,
          lastExecutedAt: 0,
        });
      }
    }
    logInfo('AdaptiveFlow', `Flow registered: ${flow.name} (${flow.flowId}), ${flow.steps.length} steps`);
  }

  /** Execute a flow with metrics tracking and adaptive reordering */
  async execute(flowId: string, input: unknown): Promise<{ results: unknown[]; durationMs: number }> {
    const flow = this.flows.get(flowId);
    if (!flow) throw new Error(`AdaptiveFlow: Flow ${flowId} not found`);

    const orderedSteps = this.getOptimalOrder(flow);
    const results: unknown[] = [];
    const start = Date.now();
    let current = input;

    for (const step of orderedSteps) {
      const stepStart = Date.now();
      const metrics = this.metrics.get(step.stepId)!;

      try {
        current = await step.handler(current);
        results.push(current);

        const dur = Date.now() - stepStart;
        metrics.executions++;
        metrics.successCount++;
        metrics.totalDurationMs += dur;
        metrics.avgDurationMs = metrics.totalDurationMs / metrics.executions;
        metrics.successRate = metrics.successCount / metrics.executions;
        metrics.lastExecutedAt = Date.now();
      } catch (err: unknown) {
        const dur = Date.now() - stepStart;
        metrics.executions++;
        metrics.failCount++;
        metrics.totalDurationMs += dur;
        metrics.avgDurationMs = metrics.totalDurationMs / metrics.executions;
        metrics.successRate = metrics.successCount / metrics.executions;
        metrics.lastExecutedAt = Date.now();

        const msg = err instanceof Error ? err.message : String(err);
        logWarn('AdaptiveFlow', `Step ${step.stepId} failed: ${msg}`);
        results.push({ error: msg });
      }
    }

    const totalDuration = Date.now() - start;
    this.emit('flow:completed', { flowId, durationMs: totalDuration, stepsRun: orderedSteps.length });
    return { results, durationMs: totalDuration };
  }

  /** Get the optimal step order based on observed metrics */
  getOptimalOrder(flow: FlowDefinition): FlowStep[] {
    const steps = [...flow.steps];

    // Score each step: fast + reliable steps first
    steps.sort((a, b) => {
      const ma = this.metrics.get(a.stepId);
      const mb = this.metrics.get(b.stepId);
      if (!ma || !mb || ma.executions < 3 || mb.executions < 3) {
        return (a.weight ?? 0) - (b.weight ?? 0);
      }

      // Composite score: higher success rate and lower avg duration = earlier
      const scoreA = ma.successRate * 100 - ma.avgDurationMs / 100;
      const scoreB = mb.successRate * 100 - mb.avgDurationMs / 100;
      return scoreB - scoreA;
    });

    return steps;
  }

  /** Analyze and suggest optimizations for a flow */
  analyze(flowId: string): FlowOptimization | null {
    const flow = this.flows.get(flowId);
    if (!flow) return null;

    const optimal = this.getOptimalOrder(flow);
    const originalOrder = flow.steps.map(s => s.stepId);
    const newOrder = optimal.map(s => s.stepId);

    // Check if reorder would help
    const hasChange = JSON.stringify(originalOrder) !== JSON.stringify(newOrder);
    if (!hasChange) return null;

    // Estimate improvement from moving slow/failing steps later
    let estimatedImprovement = 0;
    for (let i = 0; i < newOrder.length; i++) {
      if (newOrder[i] !== originalOrder[i]) {
        estimatedImprovement += 5; // rough 5% per swap
      }
    }

    const optimization: FlowOptimization = {
      flowId,
      reorderedSteps: newOrder,
      reason: `Reorder based on ${flow.steps.length} steps' success rates and durations`,
      expectedImprovement: Math.min(estimatedImprovement, 50),
      timestamp: Date.now(),
    };

    this.optimizations.push(optimization);
    this.emit('optimization:suggested', optimization);
    return optimization;
  }

  /** Apply an optimization (reorder the flow's steps) */
  applyOptimization(flowId: string): boolean {
    const flow = this.flows.get(flowId);
    if (!flow) return false;

    const optimal = this.getOptimalOrder(flow);
    flow.steps.splice(0, flow.steps.length, ...optimal);

    logInfo('AdaptiveFlow', `Optimization applied to ${flowId}`);
    this.emit('optimization:applied', { flowId });
    return true;
  }

  /** Get metrics for all steps of a flow */
  getFlowMetrics(flowId: string): StepMetrics[] {
    const flow = this.flows.get(flowId);
    if (!flow) return [];
    return flow.steps.map(s => this.metrics.get(s.stepId)).filter((m): m is StepMetrics => !!m);
  }

  /** Get step metrics by ID */
  getStepMetrics(stepId: string): StepMetrics | undefined {
    return this.metrics.get(stepId);
  }

  /** Get all optimization history */
  getOptimizations(): FlowOptimization[] {
    return [...this.optimizations];
  }
}

