export type AgentId = string;
export type ResourceId = string;

export interface ResourceLock {
  resource: ResourceId;
  owner: AgentId;
  expiresAt: number; // epoch ms
}

export interface NegotiationResult {
  winner: AgentId | null;
  reason?: string;
}

export class AgentCoordinator {
  private locks: Map<ResourceId, ResourceLock> = new Map();
  private loads: Map<AgentId, number> = new Map();

  constructor() {}

  // For tests / instrumentation
  setLoad(agent: AgentId, load: number) {
    this.loads.set(agent, load);
  }

  getLoad(agent: AgentId) {
    return this.loads.get(agent) ?? 0;
  }

  acquireLock(resource: ResourceId, agent: AgentId, ttlMs = 30_000): boolean {
    const now = Date.now();
    const existing = this.locks.get(resource);
    if (existing && existing.expiresAt > now) return false;
    this.locks.set(resource, { resource, owner: agent, expiresAt: now + ttlMs });
    return true;
  }

  releaseLock(resource: ResourceId, agent: AgentId): boolean {
    const lock = this.locks.get(resource);
    if (!lock) return false;
    if (lock.owner !== agent) return false;
    this.locks.delete(resource);
    return true;
  }

  // Remove expired locks (optionally provide 'now' for deterministic tests)
  cleanupExpiredLocks(now = Date.now()): void {
    for (const [res, lock] of this.locks.entries()) {
      if (lock.expiresAt <= now) this.locks.delete(res);
    }
  }

  getActiveLocks(): ResourceLock[] {
    this.cleanupExpiredLocks();
    return Array.from(this.locks.values());
  }

  // Simple negotiation: choose highest priority, tiebreaker lowest load
  negotiateTask(candidates: AgentId[], priorities: Record<AgentId, number> = {}): NegotiationResult {
    if (!candidates || candidates.length === 0) return { winner: null, reason: 'no candidates' };
    let best: AgentId | null = null;
    let bestPriority = Number.NEGATIVE_INFINITY;
    let bestLoad = Number.POSITIVE_INFINITY;
    for (const a of candidates) {
      const p = priorities[a] ?? 0;
      const l = this.getLoad(a);
      if (p > bestPriority || (p === bestPriority && l < bestLoad)) {
        best = a;
        bestPriority = p;
        bestLoad = l;
      }
    }
    if (best) {
      // increment winner load for accounting
      this.setLoad(best, this.getLoad(best) + 1);
      return { winner: best, reason: 'selected by priority and load' };
    }
    return { winner: null, reason: 'no winner' };
  }

  // Resolve conflict for a resource by comparing priorities and loads
  resolveConflict(resource: ResourceId, contenders: AgentId[], priorities: Record<AgentId, number> = {}): NegotiationResult {
    // If resource not locked, just negotiate among contenders
    const lock = this.locks.get(resource);
    if (!lock) return this.negotiateTask(contenders, priorities);
    // If locked, include current owner among contenders
    const all = new Set<AgentId>(contenders);
    all.add(lock.owner);
    return this.negotiateTask(Array.from(all), priorities);
  }
}

export default AgentCoordinator;
