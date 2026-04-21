/**
 * dagSort.ts — Kahn-algoritmus topológiai rendezéshez
 * Track: bas_orchestration_chain_20260221 / Phase 2
 *
 * A DFS-alapú detectCycle() mellé ez a BFS-alapú Kahn-sort garantálja
 * a determinisztikus végrehajtási sorrendet DAG-okban.
 */

import type { MicroTask } from '@packages/agents/taskDecomposerCore.js';

/**
 * Kahn-algoritmus: topológiai rendezés irányított aciklikus gráfon.
 *
 * @param tasks - MicroTask[] ahol minden task tartalmaz `dependencies: string[]`
 * @returns Topológiailag rendezett MicroTask[] (dependencies előbb, dependensek később)
 * @throws Error ha kör van a gráfban
 */
export function kahnSort(tasks: MicroTask[]): MicroTask[] {
  if (tasks.length === 0) return [];

  const byId = new Map<string, MicroTask>(tasks.map(t => [t.id, t]));

  // In-degree: hány bejövő él van minden csomópontnak
  const inDegree = new Map<string, number>();
  for (const t of tasks) {
    if (!inDegree.has(t.id)) inDegree.set(t.id, 0);
  }
  for (const t of tasks) {
    for (const dep of t.dependencies) {
      // dep → t él: t in-degree-je nő
      inDegree.set(t.id, (inDegree.get(t.id) ?? 0) + 1);
    }
  }

  // Kezdőpont: 0 in-degree csomópontok (nincs függőségük)
  const queue: string[] = [];
  for (const [id, deg] of inDegree) {
    if (deg === 0) queue.push(id);
  }

  const sorted: MicroTask[] = [];

  while (queue.length > 0) {
    const id = queue.shift()!;
    const task = byId.get(id);
    if (task) sorted.push(task);

    // Csökkentjük az erre a csomópontra támaszkodó taskok in-degree-jét
    for (const t of tasks) {
      if (t.dependencies.includes(id)) {
        const newDeg = (inDegree.get(t.id) ?? 0) - 1;
        inDegree.set(t.id, newDeg);
        if (newDeg === 0) queue.push(t.id);
      }
    }
  }

  // Ha nem minden csomópontot rendeztünk → kör van
  if (sorted.length !== tasks.length) {
    const remaining = tasks
      .filter(t => !sorted.some(s => s.id === t.id))
      .map(t => t.id);
    throw new Error(
      `DAG kör detektálva (Kahn): érintett csomópontok → ${remaining.join(', ')}`,
    );
  }

  return sorted;
}

