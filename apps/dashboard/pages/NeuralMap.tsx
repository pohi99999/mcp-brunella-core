import { useEffect, useMemo, useState } from "react";
import { Network, ShieldCheck, Lock, Unlock } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getRegistry, type RegistryAgent } from "@/lib/apiService";
import { cn } from "@/lib/utils";

const AGENT_COLORS: Record<string, string> = {
  orchestrator: "from-indigo-500/20 to-cyan-500/10 border-indigo-400/30",
  researcher: "from-blue-500/20 to-sky-500/10 border-blue-400/30",
  developer: "from-emerald-500/20 to-green-500/10 border-emerald-400/30",
  evaluator: "from-rose-500/20 to-pink-500/10 border-rose-400/30",
  robotkez: "from-cyan-500/20 to-teal-500/10 border-cyan-400/30",
  default: "from-slate-500/20 to-slate-400/10 border-white/10",
};

function agentColor(name: string) {
  return AGENT_COLORS[name.toLowerCase()] ?? AGENT_COLORS.default;
}

export function NeuralMap() {
  const [agents, setAgents] = useState<RegistryAgent[]>([]);
  const [locked, setLocked] = useState(false);

  useEffect(() => {
    void getRegistry()
      .then((registry) => {
        const nextAgents = Array.isArray(registry.agents) ? registry.agents : [];
        setAgents(nextAgents);
      })
      .catch((error: unknown) => {
        console.error("Failed to load agent registry for Neural Map:", error);
        setAgents([]);
      });
  }, []);

  const topAgents = useMemo(() => agents.slice(0, 8), [agents]);

  return (
    <Card className="h-full border-border/40 bg-background/80 shadow-xl shadow-black/20 backdrop-blur-xl">
      <CardHeader className="flex flex-row items-center justify-between gap-4 border-b border-border/40 bg-gradient-to-r from-slate-950/90 via-slate-900/70 to-slate-950/90">
        <div className="space-y-1">
          <CardTitle className="flex items-center gap-2 text-sm uppercase tracking-[0.22em] text-slate-100">
            <Network className="h-4 w-4 text-cyan-400" />
            Neural Map
          </CardTitle>
          <p className="text-xs text-slate-400">Compact registry view for agent relationships and status.</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className={cn(
            "gap-2 border-white/10 bg-white/5 text-slate-200 hover:bg-white/10",
            locked && "border-amber-400/30 bg-amber-500/10 text-amber-200",
          )}
          onClick={() => setLocked((value) => !value)}
        >
          {locked ? <Lock className="h-4 w-4" /> : <Unlock className="h-4 w-4" />}
          {locked ? "Locked" : "Unlocked"}
        </Button>
      </CardHeader>

      <CardContent className="space-y-4 p-4">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-4">
            <p className="text-[11px] uppercase tracking-[0.24em] text-slate-400">Registered agents</p>
            <p className="mt-2 text-2xl font-semibold text-white">{agents.length}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-4">
            <p className="text-[11px] uppercase tracking-[0.24em] text-slate-400">Visible nodes</p>
            <p className="mt-2 text-2xl font-semibold text-white">{topAgents.length}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-4">
            <p className="text-[11px] uppercase tracking-[0.24em] text-slate-400">Primary hub</p>
            <p className="mt-2 text-2xl font-semibold text-white">Orchestrator</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-4">
            <p className="text-[11px] uppercase tracking-[0.24em] text-slate-400">Mode</p>
            <p className="mt-2 flex items-center gap-2 text-2xl font-semibold text-white">
              <ShieldCheck className="h-5 w-5 text-emerald-400" />
              Live
            </p>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <AnimatePresence>
            {topAgents.map((agent, index) => (
              <motion.article
                key={agent.name}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2, delay: index * 0.03 }}
                className={cn(
                  "rounded-2xl border bg-gradient-to-br p-4 shadow-lg shadow-black/20 backdrop-blur-sm",
                  agentColor(agent.name),
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.24em] text-slate-400">{agent.role || "Agent"}</p>
                    <h3 className="mt-2 text-base font-semibold text-white">{agent.name}</h3>
                  </div>
                  <span className="rounded-full border border-white/10 bg-black/20 px-2 py-1 text-[10px] uppercase tracking-[0.2em] text-slate-300">
                    Node {index + 1}
                  </span>
                </div>
                <p className="mt-3 line-clamp-3 text-sm text-slate-300">{agent.description}</p>
              </motion.article>
            ))}
          </AnimatePresence>
        </div>
      </CardContent>
    </Card>
  );
}
