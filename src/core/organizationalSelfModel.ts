// src/core/organizationalSelfModel.ts

export interface OrgState {
  activeAgents: number;
  availableTools: number;
  systemHealth: string;
  knowledgeItems: number;
  goldenSamples: number;
  lastLearned: Date;
  dailyCostUsd: number;
  cpuUsagePercent: number;
  memoryUsageMb: number;
  tasksToday: number;
  successRate: number;
  topAgents: any[];
}

export interface CapabilityAssessment {
  feasible: boolean;
  confidence: number;
  bottleneck: string | null;
}

declare const agentRegistry: any;
declare const toolRegistry: any;
declare const selfDiagnostics: any;
declare const lanceDb: any;
declare const goldenDataset: any;
declare const costTracker: any;
declare const monitor: any;
declare const runLedger: any;
declare const taskAnalyzer: any;
declare const POLICIES: any;

export class OrganizationalSelfModel {
  async getCurrentState(): Promise<OrgState> {
    return {
      // Technical capacity
      activeAgents: await agentRegistry.countActive(),
      availableTools: await toolRegistry.listAvailable(),
      systemHealth: await selfDiagnostics.quickCheck(),
      // Knowledge base status
      knowledgeItems: await lanceDb.count(),
      goldenSamples: await goldenDataset.count(),
      lastLearned: await goldenDataset.getLastUpdate(),
      // Resource limits
      dailyCostUsd: await costTracker.getToday(),
      cpuUsagePercent: await monitor.getCpu(),
      memoryUsageMb: await monitor.getMemory(),
      // Business performance
      tasksToday: await runLedger.countToday(),
      successRate: await runLedger.getSuccessRate('7d'),
      topAgents: await runLedger.getTopPerformers(5)
    };
  }

  async calculateConfidence(task: string, state: OrgState): Promise<number> {
    return 0.85;
  }

  // "Can I do this task now?"
  async canHandle(task: string): Promise<CapabilityAssessment> {
    const state = await this.getCurrentState();
    const required = await taskAnalyzer.estimateRequirements(task);
    return {
      feasible: state.systemHealth === 'ok' && state.dailyCostUsd + required.estimatedCost < POLICIES.llm_cost_control.daily_budget_usd,
      confidence: await this.calculateConfidence(task, state),
      bottleneck: state.cpuUsagePercent > 80 ? 'cpu' : state.dailyCostUsd > 4 ? 'cost' : null
    };
  }
}
