import type { AgentId } from './agentCoordinator.js';

export class DeadlockDetector {
  // waitForGraph: key = waiter agent, value = set of agents it's waiting for
  private waitForGraph: Map<AgentId, Set<AgentId>> = new Map();

  addEdge(waiter: AgentId, owner: AgentId) {
    if (!this.waitForGraph.has(waiter)) this.waitForGraph.set(waiter, new Set());
    this.waitForGraph.get(waiter)!.add(owner);
  }

  removeEdge(waiter: AgentId, owner: AgentId) {
    const s = this.waitForGraph.get(waiter);
    if (!s) return;
    s.delete(owner);
    if (s.size === 0) this.waitForGraph.delete(waiter);
  }

  clear() {
    this.waitForGraph.clear();
  }

  // Detect cycles using DFS
  detectCycles(): AgentId[][] {
    const visited = new Set<AgentId>();
    const stack = new Set<AgentId>();
    const result: AgentId[][] = [];

    const dfs = (node: AgentId, path: AgentId[]) => {
      if (stack.has(node)) {
        const idx = path.indexOf(node);
        if (idx >= 0) result.push(path.slice(idx));
        return;
      }
      if (visited.has(node)) return;
      visited.add(node);
      stack.add(node);
      const edges = this.waitForGraph.get(node) ?? new Set();
      for (const nb of edges) dfs(nb, path.concat(nb));
      stack.delete(node);
    };

    for (const node of Array.from(this.waitForGraph.keys())) {
      dfs(node, [node]);
    }
    return result;
  }

  // Simple resolution strategy: choose the lowest-priority agent among nodes in cycles
  resolveDeadlock(priorities: Record<AgentId, number> = {}): AgentId | null {
    const cycles = this.detectCycles();
    if (!cycles || cycles.length === 0) return null;
    // Flatten nodes and pick lowest priority
    const nodes = new Set<AgentId>();
    for (const c of cycles) for (const n of c) nodes.add(n);
    let victim: AgentId | null = null;
    let lowest = Number.POSITIVE_INFINITY;
    for (const n of nodes) {
      const p = priorities[n] ?? 0;
      if (p < lowest) {
        lowest = p;
        victim = n;
      }
    }
    return victim;
  }
}

export default DeadlockDetector;
