/**
 * SelfReplication — Controlled node replication lifecycle for autonomous infrastructure
 * Phase 7: Autonomous Superintelligent Infrastructure
 *
 * This module models self-replication as a safe, policy-bound workflow.
 * It does NOT perform real infrastructure provisioning; instead it tracks
 * plans, approvals, bootstrap states, and active replica topology.
 */

import { EventEmitter } from 'events';
import { logInfo, logWarn } from '@packages/utils/logger.js';

export interface ReplicaResources {
  cpu: number;
  memoryGb: number;
  storageGb: number;
}

export interface ReplicaNode {
  nodeId: string;
  region: string;
  capabilities: string[];
  status: 'active' | 'bootstrapping' | 'failed' | 'retired';
  load: number;
  resources: ReplicaResources;
  createdAt: number;
  lastHeartbeatAt: number;
  parentNodeId?: string;
  replicas: string[];
}

export interface RegionCapacity {
  region: string;
  availableSlots: number;
  maxNodes: number;
  latencyBudgetMs: number;
}

export interface ReplicationConstraints {
  maxReplicasPerSource: number;
  allowedRegions: string[];
  requireApproval: boolean;
  maxConcurrentBootstraps: number;
  maxRiskLevel: 'low' | 'medium' | 'high';
}

export interface ReplicationPlan {
  planId: string;
  sourceNodeId: string;
  targetNodeId: string;
  targetRegion: string;
  requestedBy: string;
  reason: string;
  risk: 'low' | 'medium' | 'high';
  status: 'planned' | 'approved' | 'bootstrapping' | 'active' | 'failed' | 'cancelled';
  notes: string[];
  createdAt: number;
  approvedAt?: number;
  approvedBy?: string;
  activatedAt?: number;
}

export interface ReplicationAnalysis {
  activeNodes: number;
  bootstrappingNodes: number;
  plansPendingApproval: number;
  plansInFlight: number;
  replicasByRegion: Record<string, number>;
}

const DEFAULT_CONSTRAINTS: ReplicationConstraints = {
  maxReplicasPerSource: 3,
  allowedRegions: ['eu-central', 'eu-west', 'us-east', 'ap-southeast'],
  requireApproval: false,
  maxConcurrentBootstraps: 2,
  maxRiskLevel: 'high',
};

const RISK_SCORE: Record<ReplicationPlan['risk'], number> = {
  low: 1,
  medium: 2,
  high: 3,
};

export class SelfReplication extends EventEmitter {
  private readonly constraints: ReplicationConstraints;
  private readonly nodes = new Map<string, ReplicaNode>();
  private readonly plans = new Map<string, ReplicationPlan>();
  private planCounter = 0;
  private capacityProvider: (() => RegionCapacity[]) | null = null;

  constructor(constraints?: Partial<ReplicationConstraints>) {
    super();
    this.constraints = { ...DEFAULT_CONSTRAINTS, ...constraints };
  }

  setCapacityProvider(provider: () => RegionCapacity[]): void {
    this.capacityProvider = provider;
  }

  registerNode(node: Omit<ReplicaNode, 'createdAt' | 'lastHeartbeatAt' | 'replicas'> & Partial<Pick<ReplicaNode, 'createdAt' | 'lastHeartbeatAt' | 'replicas'>>): ReplicaNode {
    const now = Date.now();
    const full: ReplicaNode = {
      ...node,
      createdAt: node.createdAt ?? now,
      lastHeartbeatAt: node.lastHeartbeatAt ?? now,
      replicas: node.replicas ? [...node.replicas] : [],
    };
    this.nodes.set(full.nodeId, full);
    this.emit('node:registered', full);
    return full;
  }

  heartbeat(nodeId: string, load?: number): boolean {
    const node = this.nodes.get(nodeId);
    if (!node) return false;
    node.lastHeartbeatAt = Date.now();
    if (typeof load === 'number') {
      node.load = Math.max(0, Math.min(1, load));
    }
    this.emit('node:heartbeat', node);
    return true;
  }

  requestReplication(sourceNodeId: string, targetRegion: string, reason: string, requestedBy = 'hyperkernel'): ReplicationPlan | null {
    const source = this.nodes.get(sourceNodeId);
    if (!source) {
      logWarn('SelfReplication', `Replication request rejected: source ${sourceNodeId} not found`);
      return null;
    }

    if (!this.constraints.allowedRegions.includes(targetRegion)) {
      logWarn('SelfReplication', `Replication request rejected: region ${targetRegion} is not allowed`);
      return null;
    }

    const existingReplicaCount = Array.from(this.nodes.values()).filter(node => node.parentNodeId === sourceNodeId && node.status !== 'retired').length;
    if (existingReplicaCount >= this.constraints.maxReplicasPerSource) {
      logWarn('SelfReplication', `Replication request rejected: source ${sourceNodeId} already has ${existingReplicaCount} replicas`);
      return null;
    }

    const bootstrappingCount = Array.from(this.plans.values()).filter(plan => plan.status === 'bootstrapping').length;
    if (bootstrappingCount >= this.constraints.maxConcurrentBootstraps) {
      logWarn('SelfReplication', 'Replication request rejected: bootstrap concurrency limit reached');
      return null;
    }

    const capacity = this.getRegionCapacity(targetRegion);
    if (capacity && capacity.availableSlots <= 0) {
      logWarn('SelfReplication', `Replication request rejected: no available slots in ${targetRegion}`);
      return null;
    }

    const risk = this.assessRisk(source, targetRegion);
    if (RISK_SCORE[risk] > RISK_SCORE[this.constraints.maxRiskLevel]) {
      logWarn('SelfReplication', `Replication request rejected: risk ${risk} exceeds max ${this.constraints.maxRiskLevel}`);
      return null;
    }

    const plan: ReplicationPlan = {
      planId: `rp-${++this.planCounter}-${Date.now()}`,
      sourceNodeId,
      targetNodeId: `${sourceNodeId}-replica-${this.planCounter}`,
      targetRegion,
      requestedBy,
      reason,
      risk,
      status: 'planned',
      notes: [`Requested by ${requestedBy}`, `Reason: ${reason}`],
      createdAt: Date.now(),
    };

    this.plans.set(plan.planId, plan);
    this.emit('plan:created', plan);
    logInfo('SelfReplication', `Replication plan created ${plan.planId} (${sourceNodeId} -> ${targetRegion})`);
    return plan;
  }

  approvePlan(planId: string, approvedBy = 'system'): boolean {
    const plan = this.plans.get(planId);
    if (!plan || plan.status !== 'planned') return false;
    plan.status = 'approved';
    plan.approvedAt = Date.now();
    plan.approvedBy = approvedBy;
    plan.notes.push(`Approved by ${approvedBy}`);
    this.emit('plan:approved', plan);
    return true;
  }

  executePlan(planId: string): ReplicaNode | null {
    const plan = this.plans.get(planId);
    if (!plan) return null;

    if (plan.status === 'planned' && this.constraints.requireApproval) {
      logWarn('SelfReplication', `Plan ${planId} requires approval before execution`);
      return null;
    }

    if (plan.status === 'planned' && !this.constraints.requireApproval) {
      this.approvePlan(planId, 'auto-policy');
    }

    if (plan.status !== 'approved') return null;

    const source = this.nodes.get(plan.sourceNodeId);
    if (!source) {
      plan.status = 'failed';
      plan.notes.push('Source node vanished before execution');
      return null;
    }

    const node = this.registerNode({
      nodeId: plan.targetNodeId,
      region: plan.targetRegion,
      parentNodeId: source.nodeId,
      capabilities: [...source.capabilities],
      resources: { ...source.resources },
      load: Math.min(0.35, Math.max(0.05, source.load * 0.4)),
      status: 'bootstrapping',
    });

    plan.status = 'bootstrapping';
    plan.notes.push('Bootstrap initiated');
    this.emit('plan:executing', plan);
    logInfo('SelfReplication', `Plan ${planId} entered bootstrap for ${node.nodeId}`);
    return node;
  }

  completeBootstrap(planId: string, success: boolean, note?: string): boolean {
    const plan = this.plans.get(planId);
    if (!plan) return false;

    const node = this.nodes.get(plan.targetNodeId);
    if (!node) {
      plan.status = 'failed';
      plan.notes.push('Target node missing during bootstrap completion');
      return false;
    }

    if (success) {
      node.status = 'active';
      node.lastHeartbeatAt = Date.now();
      plan.status = 'active';
      plan.activatedAt = Date.now();
      const parent = this.nodes.get(plan.sourceNodeId);
      if (parent && !parent.replicas.includes(node.nodeId)) {
        parent.replicas.push(node.nodeId);
      }
      plan.notes.push(note ?? 'Bootstrap completed successfully');
      this.emit('node:active', node);
      return true;
    }

    node.status = 'failed';
    plan.status = 'failed';
    plan.notes.push(note ?? 'Bootstrap failed');
    this.emit('node:failed', node);
    return true;
  }

  retireNode(nodeId: string, reason = 'retired-by-policy'): boolean {
    const node = this.nodes.get(nodeId);
    if (!node) return false;
    node.status = 'retired';
    node.lastHeartbeatAt = Date.now();
    this.emit('node:retired', { nodeId, reason });
    return true;
  }

  getNode(nodeId: string): ReplicaNode | undefined {
    return this.nodes.get(nodeId);
  }

  getNodes(status?: ReplicaNode['status']): ReplicaNode[] {
    const values = Array.from(this.nodes.values());
    return status ? values.filter(node => node.status === status) : values;
  }

  getPlan(planId: string): ReplicationPlan | undefined {
    return this.plans.get(planId);
  }

  getPlans(status?: ReplicationPlan['status']): ReplicationPlan[] {
    const values = Array.from(this.plans.values());
    return status ? values.filter(plan => plan.status === status) : values;
  }

  analyze(): ReplicationAnalysis {
    const replicasByRegion: Record<string, number> = {};
    for (const node of this.nodes.values()) {
      replicasByRegion[node.region] = (replicasByRegion[node.region] ?? 0) + 1;
    }

    return {
      activeNodes: this.getNodes('active').length,
      bootstrappingNodes: this.getNodes('bootstrapping').length,
      plansPendingApproval: this.getPlans('planned').length,
      plansInFlight: this.getPlans('bootstrapping').length,
      replicasByRegion,
    };
  }

  getStats(): { nodes: number; active: number; plans: number; constraints: ReplicationConstraints } {
    return {
      nodes: this.nodes.size,
      active: this.getNodes('active').length,
      plans: this.plans.size,
      constraints: { ...this.constraints },
    };
  }

  private getRegionCapacity(region: string): RegionCapacity | undefined {
    return this.capacityProvider?.().find(item => item.region === region);
  }

  private assessRisk(source: ReplicaNode, targetRegion: string): ReplicationPlan['risk'] {
    const regionPenalty = source.region === targetRegion ? 0 : 0.5;
    const loadScore = source.load + regionPenalty;
    if (loadScore >= 1.1) return 'high';
    if (loadScore >= 0.7) return 'medium';
    return 'low';
  }
}

