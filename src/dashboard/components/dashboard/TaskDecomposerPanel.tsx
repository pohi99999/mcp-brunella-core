import { useMemo, useState } from "react";
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  MarkerType,
  type Node,
  type Edge,
} from "reactflow";
import "reactflow/dist/style.css";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { executeAgent } from "@/lib/apiService";

type MicroTask = {
  id: string;
  agent: string;
  task: string;
  dependencies: string[];
  parallel: boolean;
  retries: number;
  timeoutMs: number;
};

type DecompositionDag = {
  nodes: Array<{ id: string; label: string }>;
  edges: Array<{ from: string; to: string }>;
};

type DecompositionResult = {
  originalTask: string;
  tasks: MicroTask[];
  dag: DecompositionDag;
};

type AgentResponse = {
  status: "success" | "error" | "delegated";
  data?: unknown;
  error?: string;
};

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

function isMicroTask(v: unknown): v is MicroTask {
  if (!isRecord(v)) return false;
  return (
    typeof v.id === "string" &&
    typeof v.agent === "string" &&
    typeof v.task === "string" &&
    Array.isArray(v.dependencies) &&
    typeof v.parallel === "boolean" &&
    typeof v.retries === "number" &&
    typeof v.timeoutMs === "number"
  );
}

function isDecompositionResult(v: unknown): v is DecompositionResult {
  if (!isRecord(v)) return false;
  if (typeof v.originalTask !== "string") return false;
  if (!Array.isArray(v.tasks) || !v.tasks.every(isMicroTask)) return false;
  if (!isRecord(v.dag)) return false;
  if (!Array.isArray(v.dag.nodes) || !Array.isArray(v.dag.edges)) return false;
  return true;
}

function buildLayout(
  tasks: MicroTask[],
): Record<string, { x: number; y: number }> {
  const byId = new Map(tasks.map((t) => [t.id, t] as const));
  const levelById = new Map<string, number>();

  const getLevel = (id: string): number => {
    const existing = levelById.get(id);
    if (typeof existing === "number") return existing;
    const t = byId.get(id);
    const deps = t?.dependencies || [];
    if (deps.length === 0) {
      levelById.set(id, 0);
      return 0;
    }
    const depLevels = deps.filter((d) => byId.has(d)).map((d) => getLevel(d));
    const lvl = (depLevels.length ? Math.max(...depLevels) : -1) + 1;
    levelById.set(id, lvl);
    return lvl;
  };

  for (const t of tasks) getLevel(t.id);

  const buckets = new Map<number, string[]>();
  for (const [id, lvl] of levelById.entries()) {
    const arr = buckets.get(lvl) || [];
    arr.push(id);
    buckets.set(lvl, arr);
  }

  const positions: Record<string, { x: number; y: number }> = {};
  const xStep = 260;
  const yStep = 120;

  const levels = Array.from(buckets.keys()).sort((a, b) => a - b);
  for (const lvl of levels) {
    const ids = (buckets.get(lvl) || []).sort();
    ids.forEach((id, idx) => {
      positions[id] = {
        x: lvl * xStep,
        y: idx * yStep,
      };
    });
  }

  return positions;
}

export function TaskDecomposerPanel() {
  const [prompt, setPrompt] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const [result, setResult] = useState<DecompositionResult | null>(null);

  const { nodes, edges } = useMemo(() => {
    const tasks = result?.tasks || [];
    const positions = buildLayout(tasks);

    const nodes: Node[] = tasks.map((t) => ({
      id: t.id,
      position: positions[t.id] || { x: 0, y: 0 },
      data: {
        label: (
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono text-xs font-bold">{t.id}</span>
              <Badge variant={t.parallel ? "secondary" : "outline"}>
                {t.parallel ? "parallel" : "seq"}
              </Badge>
            </div>
            <div className="text-xs leading-snug opacity-90 max-w-[220px]">
              {t.task}
            </div>
            <div className="text-[10px] text-zinc-500 font-mono">
              agent: {t.agent}
            </div>
          </div>
        ),
      },
      className:
        "glass-card p-3 rounded-xl border border-white/10 shadow-xl overflow-visible",
    }));

    const edges: Edge[] = [];
    for (const t of tasks) {
      for (const dep of t.dependencies || []) {
        edges.push({
          id: `e-${dep}-${t.id}`,
          source: dep,
          target: t.id,
          markerEnd: {
            type: MarkerType.ArrowClosed,
            width: 18,
            height: 18,
            color: "#64748b",
          },
          style: { stroke: "#64748b", strokeWidth: 1.5 },
        });
      }
    }

    return { nodes, edges };
  }, [result]);

  const run = async () => {
    const text = prompt.trim();
    if (!text) return;

    setIsRunning(true);
    try {
      const resp = (await executeAgent("task_decomposer", text)) as AgentResponse;
      if (resp.status !== "success") {
        throw new Error(resp.error || "Task decomposition failed");
      }

      if (!isDecompositionResult(resp.data)) {
        throw new Error("Unexpected response format");
      }

      const data = resp.data;
      setResult(data);
      toast.success(`Dekompozíció kész (${data.tasks.length} task)`);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Hiba");
      setResult(null);
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <Card className="glass-card border-cyan-500/20 overflow-hidden shadow-[0_16px_60px_-36px_rgba(0,0,0,0.85)]">
      <CardHeader className="flex flex-row items-center justify-between border-b border-white/[0.05] bg-white/[0.015]">
        <CardTitle className="flex items-center gap-2 text-[11px] font-mono font-semibold uppercase tracking-[0.28em] text-cyan-300">
          🧩 Task Decomposer (preview)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 p-4 lg:p-5">
        <div className="space-y-2">
          <Textarea
            placeholder="Írd be a komplex feladatot (pl. 'Adj hozzá új API route-ot, írj teszteket, frissítsd a dashboardot')..."
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            className="glass-card border-white/10 bg-white/[0.03] min-h-[110px]"
          />
          <div className="flex justify-end gap-2">
            <Button
              onClick={run}
              disabled={isRunning || !prompt.trim()}
              className="rounded-full bg-cyan-600 hover:bg-cyan-700"
            >
              {isRunning ? "Fut..." : "Dekomponálás"}
            </Button>
          </div>
        </div>

        <div className="rounded-3xl overflow-hidden border border-white/10 bg-white/[0.03]">
          <div className="flex items-center justify-between px-3 py-2 bg-white/[0.04] border-b border-white/[0.05]">
            <div className="text-[10px] uppercase tracking-[0.24em] text-zinc-500">
              DAG vizualizáció
            </div>
            <div className="text-xs text-zinc-500 font-mono">
              {result?.tasks?.length ? `${result.tasks.length} node` : "-"}
            </div>
          </div>
          <div className="w-full h-[420px]">
            <ReactFlow nodes={nodes} edges={edges} fitView>
              <Controls className="bg-background/80 backdrop-blur-sm border rounded-md" />
              <MiniMap
                className="bg-background/80 backdrop-blur-sm border rounded-md"
                nodeColor={() => "#06b6d4"}
              />
              <Background gap={18} size={1} color="rgba(255,255,255,0.05)" />
            </ReactFlow>
          </div>
        </div>

        {result?.tasks?.length ? (
          <div className="text-xs text-zinc-500">
            Tipp: ez még csak <span className="font-semibold">preview</span> —
            nem futtatja a mikro-taskokat.
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
