import { useSystemSignal } from "@/hooks/useSystemSignal";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Brain, Activity, AlertCircle, CheckCircle2, Clock } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

export function AgentStatusMonitor() {
  const { agents } = useSystemSignal();

  const agentsList = agents ? Array.from(agents.values()) : [];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'working': return "bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.5)]";
      case 'error': return "bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.5)]";
      default: return "bg-zinc-600";
    }
  };

  return (
    <div className="flex flex-col h-full bg-zinc-950/20 backdrop-blur-xl">
      <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-white/[0.03]">
        <div className="flex items-center gap-3">
          <div className="p-1.5 rounded-md bg-white/[0.03] border border-white/[0.05]">
            <Brain size={14} className="text-violet-400" />
          </div>
          <div>
            <h3 className="text-[10px] font-bold tracking-[0.2em] text-zinc-200 uppercase leading-none">
              Agent Cluster
            </h3>
            <p className="text-[9px] text-zinc-500 font-mono mt-1 leading-none uppercase tracking-widest">
              Neural State
            </p>
          </div>
        </div>
        <div className="px-2 py-0.5 rounded bg-zinc-900 border border-white/[0.06] flex items-center gap-2">
          <span className="text-[9px] font-bold text-zinc-400 font-mono">ACTIVE</span>
          <span className="text-[10px] font-bold text-violet-400 font-mono">
            { agentsList.filter(a => a.status === 'working').length }
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar">
        <div className="divide-y divide-white/[0.03]">
          {agentsList.length === 0 ? (
            <div className="p-10 text-center">
              <span className="text-[9px] font-mono text-zinc-600 uppercase tracking-widest">
                Scanning_for_signals...
              </span>
            </div>
          ) : agentsList.map((agent) => (
            <div
              key={agent.name}
              className="group px-5 py-4 hover:bg-white/[0.02] transition-all duration-200"
            >
              <div className="flex items-center justify-between gap-4 mb-2">
                <div className="flex items-center gap-3 min-w-0">
                  <div className={cn("h-1.5 w-1.5 rounded-full shrink-0", getStatusColor(agent.status))} />
                  <span className="font-bold text-[11px] text-zinc-200 uppercase tracking-wide truncate group-hover:text-white transition-colors">
                    {agent.name}
                  </span>
                </div>
                <div className="px-1.5 py-0.5 rounded-[2px] bg-white/[0.03] border border-white/[0.05] shrink-0">
                  <span className="text-[8px] font-bold text-zinc-500 uppercase tracking-tighter">
                    {agent.status}
                  </span>
                </div>
              </div>
              
              {agent.taskDescription && (
                <div className="flex items-start gap-2 px-3 py-2 bg-zinc-900/50 rounded-lg border border-white/[0.03] group-hover:border-white/[0.06] transition-colors">
                  <div className="mt-1 h-1 w-1 rounded-full bg-zinc-700 shrink-0" />
                  <p className="text-[10px] text-zinc-500 font-mono leading-relaxed line-clamp-2 italic">
                    {agent.taskDescription}
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="px-5 py-3 border-t border-white/[0.03] bg-white/[0.01]">
        <div className="flex items-center justify-between">
          <span className="text-[8px] font-bold text-zinc-600 uppercase tracking-widest font-mono">
            Cluster Integrity
          </span>
          <span className="text-[9px] text-zinc-500 font-mono">
            { agentsList.length } REGISTERED
          </span>
        </div>
      </div>
    </div>
  );
}
