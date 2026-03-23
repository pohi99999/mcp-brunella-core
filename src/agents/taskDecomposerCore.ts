import type { DAGWorkflow } from '../core/dagEngine.js';

export interface MicroTask {
  id: string;
  agent: string;
  task: string;
  dependencies: string[];
  parallel: boolean;
  retries: number;
  timeoutMs: number;
}

export interface DecompositionDag {
  nodes: Array<{ id: string; label: string }>;
  edges: Array<{ from: string; to: string }>;
}

export interface DecompositionResult {
  originalTask: string;
  tasks: MicroTask[];
  dag: DecompositionDag;
}

function clampInt(n: number, min: number, max: number): number {
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, Math.trunc(n)));
}

function normalizeLine(line: string): string {
  // Remove common bullets / numbering.
  return line
    .replace(/^\s*[-*]\s+/, "")
    .replace(/^\s*\d+[.)]\s+/, "")
    .trim();
}

function splitIntoCandidateTasks(text: string): string[] {
  const raw = String(text || "").trim();
  if (!raw) return [];

  const lines = raw
    .split(/\r?\n/)
    .map((l) => normalizeLine(l))
    .filter(Boolean);

  // If user already gave bullet/line structure, prefer that.
  if (lines.length >= 2) return lines.slice(0, 12);

  // Otherwise, try splitting into sentences.
  const sentences = raw
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);

  if (sentences.length >= 2) return sentences.slice(0, 8);

  // Fallback: split by " and ", " then ", or commas.
  const chunks = raw
    .split(/\s+(?:and|then)\s+|,\s+/i)
    .map((c) => c.trim())
    .filter(Boolean);

  return (chunks.length > 1 ? chunks : [raw]).slice(0, 8);
}

/**
 * LLM fallback: ha a regex csak 1 blokkot adott vissza (= komplex egydarabos utasítás),
 * az LLM segítségével bontja fel lépésekre (max 6).
 */
async function splitWithLLMFallback(text: string): Promise<string[]> {
  try {
    const { llmGenerate } = await import('../utils/aiGateway.js');
    const prompt = `Bontsd fel az alábbi feladatot konkrét, végrehajtható lépésekre (maximum 6 lépés). Minden lépés egy sorban álljon, sorszámozás nélkül:\n\n${text}`;
    const raw = await llmGenerate(prompt, { maxTokens: 512, temperature: 0.3 });
    const lines = raw
      .split('\n')
      .map((l: string) => normalizeLine(l))
      .filter((l: string) => l.length > 5);
    return lines.length > 1 ? lines.slice(0, 6) : [text];
  } catch {
    return [text];
  }
}

export function buildMicroTasks(
  originalTask: string,
  opts?: {
    defaultAgent?: string;
    retries?: number;
    timeoutMs?: number;
  },
): MicroTask[] {
  const agent = String(opts?.defaultAgent || "Developer");
  const retries = clampInt(opts?.retries ?? 1, 0, 5);
  const timeoutMs = clampInt(opts?.timeoutMs ?? 60000, 1000, 10 * 60 * 1000);

  const parts = splitIntoCandidateTasks(originalTask);
  if (parts.length === 0) return [];

  const tasks: MicroTask[] = parts.map((p, idx) => {
    const id = `t${idx + 1}`;
    const lower = p.toLowerCase();
    const parallel = lower.includes("parallel") || lower.includes("párhuzamos");

    return {
      id,
      agent,
      task: p,
      dependencies: [],
      parallel,
      retries,
      timeoutMs,
    };
  });

  // Default dependency strategy: sequential unless explicitly parallel.
  for (let i = 1; i < tasks.length; i++) {
    if (!tasks[i].parallel) {
      tasks[i].dependencies.push(tasks[i - 1].id);
    }
  }

  return tasks;
}

/**
 * Async változat: ha a regex csak 1 blokkot ad, LLM-mel bontja fel a feladatot.
 * Komplex egydarabos magyar utasítások esetén használd ezt.
 */
export async function buildMicroTasksAsync(
  originalTask: string,
  opts?: {
    defaultAgent?: string;
    retries?: number;
    timeoutMs?: number;
  },
): Promise<MicroTask[]> {
  const agent = String(opts?.defaultAgent || "Developer");
  const retries = clampInt(opts?.retries ?? 1, 0, 5);
  const timeoutMs = clampInt(opts?.timeoutMs ?? 60000, 1000, 10 * 60 * 1000);

  const regexParts = splitIntoCandidateTasks(originalTask);
  // Ha regex csak 1 blokkot ad → LLM fallback
  const parts = regexParts.length <= 1
    ? await splitWithLLMFallback(originalTask)
    : regexParts;

  if (parts.length === 0) return [];

  const tasks: MicroTask[] = parts.map((p, idx) => {
    const id = `t${idx + 1}`;
    const lower = p.toLowerCase();
    const parallel = lower.includes("parallel") || lower.includes("párhuzamos");
    return { id, agent, task: p, dependencies: [], parallel, retries, timeoutMs };
  });

  for (let i = 1; i < tasks.length; i++) {
    if (!tasks[i].parallel) tasks[i].dependencies.push(tasks[i - 1].id);
  }

  return tasks;
}

export function buildDag(tasks: MicroTask[]): DecompositionDag {
  const nodes = tasks.map((t) => ({ id: t.id, label: `${t.id}: ${t.task}` }));
  const edges: Array<{ from: string; to: string }> = [];
  for (const t of tasks) {
    for (const dep of t.dependencies) {
      edges.push({ from: dep, to: t.id });
    }
  }
  return { nodes, edges };
}

export function detectCycle(tasks: MicroTask[]): string[] | null {
  const byId = new Map(tasks.map((t) => [t.id, t] as const));
  const visiting = new Set<string>();
  const visited = new Set<string>();

  const stack: string[] = [];

  const dfs = (id: string): string[] | null => {
    if (visited.has(id)) return null;
    if (visiting.has(id)) {
      const idx = stack.indexOf(id);
      return idx >= 0 ? stack.slice(idx).concat(id) : [id, id];
    }

    visiting.add(id);
    stack.push(id);

    const t = byId.get(id);
    for (const dep of t?.dependencies || []) {
      if (!byId.has(dep)) continue;
      const cycle = dfs(dep);
      if (cycle) return cycle;
    }

    stack.pop();
    visiting.delete(id);
    visited.add(id);
    return null;
  };

  for (const t of tasks) {
    const cycle = dfs(t.id);
    if (cycle) return cycle;
  }
  return null;
}

/**
 * Dekompozíció + Kahn-rendezés → ChainStep[] az OrchestratorAgent számára.
 * preview=false módban ezt hívja a TaskDecomposerAgent.
 */
export interface ChainStepCompact {
  agentName: string;
  task: string;
}

export function decomposeToChain(
  originalTask: string,
  kahnSortFn: (tasks: MicroTask[]) => MicroTask[],
  opts?: { defaultAgent?: string },
): ChainStepCompact[] {
  const tasks = buildMicroTasks(originalTask, {
    defaultAgent: opts?.defaultAgent ?? 'Developer',
  });

  const cycle = detectCycle(tasks);
  if (cycle) {
    throw new Error(`Dependency cycle: ${cycle.join(' -> ')}`);
  }

  const sorted = kahnSortFn(tasks);

  return sorted.map(t => ({
    agentName: t.agent,
    task: t.task,
  }));
}

export function decomposePreview(
  originalTask: string,
  opts?: { defaultAgent?: string },
): DecompositionResult {
  const tasks = buildMicroTasks(originalTask, {
    defaultAgent: opts?.defaultAgent ?? "Developer",
  });

  const cycle = detectCycle(tasks);
  if (cycle) {
    throw new Error(`Dependency cycle detected: ${cycle.join(" -> ")}`);
  }

  const dag = buildDag(tasks);

  return {
    originalTask,
    tasks,
    dag,
  };
}

function microTasksToWorkflow(originalTask: string, tasks: MicroTask[]): DAGWorkflow {
  return {
    id: `workflow_${Date.now()}`,
    name: originalTask.slice(0, 80) || 'Generated Workflow',
    nodes: tasks.map((task) => ({
      id: task.id,
      label: task.task,
      type: 'agent',
      agentName: task.agent,
      instruction: task.task,
      dependsOn: task.dependencies,
      timeoutMs: task.timeoutMs,
      metadata: {
        retries: task.retries,
        parallel: task.parallel,
      },
    })),
    edges: tasks.flatMap((task) => task.dependencies.map((dependency) => ({ from: dependency, to: task.id }))),
  };
}

export function decomposeToDAG(
  originalTask: string,
  opts?: { defaultAgent?: string },
): DAGWorkflow {
  const tasks = buildMicroTasks(originalTask, {
    defaultAgent: opts?.defaultAgent ?? 'Developer',
  });

  const cycle = detectCycle(tasks);
  if (cycle) {
    throw new Error(`Dependency cycle detected: ${cycle.join(' -> ')}`);
  }

  return microTasksToWorkflow(originalTask, tasks);
}

export async function decomposeToDAGAsync(
  originalTask: string,
  opts?: { defaultAgent?: string },
): Promise<DAGWorkflow> {
  const tasks = await buildMicroTasksAsync(originalTask, {
    defaultAgent: opts?.defaultAgent ?? 'Developer',
  });

  const cycle = detectCycle(tasks);
  if (cycle) {
    throw new Error(`Dependency cycle detected: ${cycle.join(' -> ')}`);
  }

  return microTasksToWorkflow(originalTask, tasks);
}
