import { useSystemSignal } from "@/hooks/useSystemSignal";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Brain, Activity, AlertCircle, CheckCircle2, Clock } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

export function AgentStatusMonitor() {
  const { agents } = useSystemSignal();

  // agents is a Map<string, AgentStatusEntry> — Array.from is required, Object.values(Map) returns []
  const agentsList = agents ? Array.from(agents.values()) : [];

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'working': return <Activity size={14} className="text-emerald-500 animate-pulse" />;
      case 'error': return <AlertCircle size={14} className="text-red-500" />;
      default: return <CheckCircle2 size={14} className="text-zinc-500" />;
    }
  };

  return (
    <Card className="glass-card border-white/10 h-full flex flex-col">
      <CardHeader className="pb-2 border-b border-white/5 shrink-0">
        <CardTitle className="text-sm font-space font-bold tracking-tight uppercase text-muted-foreground flex items-center gap-2">
          <Brain size={16} className="text-primary" />
          Agent Status Monitor
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0 flex-1 min-h-0">
        <ScrollArea className="h-full">
          <div className="divide-y divide-white/5">
            {agentsList.length === 0 ? (
              <div className="p-8 text-center text-xs text-zinc-500 font-mono italic">
                NO_AGENTS_DETECTED
              </div>
            ) : agentsList.map((agent) => (
              <div key={agent.name} className="p-3 hover:bg-white/5 transition-colors group">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      "w-1.5 h-1.5 rounded-full",
                      agent.status === 'working' ? "bg-emerald-500 shadow-[0_0_5px_rgba(16,185,129,0.5)]" : 
                      agent.status === 'error' ? "bg-red-500" : "bg-zinc-600"
                    )} />
                    <span className="font-bold text-xs font-mono group-hover:text-primary transition-colors uppercase tracking-tight">
                      {agent.name}
                    </span>
                  </div>
                  <Badge variant={agent.status === 'working' ? 'default' : 'secondary'} className="text-[9px] h-4 px-1 font-mono">
                    {agent.status.toUpperCase()}
                  </Badge>
                </div>
                {agent.taskDescription && (
                  <div className="flex items-start gap-1.5 mt-1 px-3 py-1 bg-white/5 rounded border border-white/5">
                    <Clock size={10} className="text-zinc-500 mt-0.5 shrink-0" />
                    <p className="text-[10px] text-zinc-400 font-mono line-clamp-1 italic leading-tight">
                      {agent.taskDescription}
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
      <div className="p-2 bg-black/20 border-t border-white/5 shrink-0">
        <div className="flex justify-between items-center px-2">
          <span className="text-[9px] font-mono text-zinc-500 uppercase tracking-widest">Active: {agentsList.filter(a => a.status === 'working').length}</span>
          <span className="text-[9px] font-mono text-zinc-500 uppercase tracking-widest">Total: {agentsList.length}</span>
        </div>
      </div>
    </Card>
  );
}
