import React from "react";
import { motion } from "framer-motion";
import { WIDGET_REGISTRY } from "@/lib/widgetRegistry";
import { RotateCcw, ShieldCheck, Bot, ListTodo, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLayout } from "@/lib/layout/LayoutContext";
import { useSystemSignal } from "@/hooks/useSystemSignal";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function WidgetGrid() {
  const { currentLayout, setLayoutMode } = useLayout();
  const { agents, taskStats, healthStatus } = useSystemSignal();

  const widgets = Object.entries(currentLayout.widgetAssignments)
    .map(([widgetId]) => {
      const widget = WIDGET_REGISTRY[widgetId];
      if (!widget) return null;
      return { id: widgetId, ...widget };
    })
    .filter(Boolean);

  const agentsList = agents ? Array.from(agents.values()) : [];
  const activeAgents = agentsList.filter((agent) => agent.status === "working").length;
  const totalAgents = agentsList.length;
  const pendingTasks = taskStats?.pendingCount ?? 0;
  const runningTasks = taskStats?.runningCount ?? 0;
  const successRate = taskStats?.successRate ?? 0;
  const totalTasks = taskStats?.total ?? 0;
  const healthyServices = healthStatus
    ? Object.values(healthStatus.services).filter((service) => {
        if (typeof service === "string") return service === "healthy" || service === "ok";
        if (service && typeof service === "object" && "status" in service) {
          return (service as { status?: string }).status === "healthy" || (service as { status?: string }).status === "ok";
        }
        return false;
      }).length
    : 0;
  const serviceCount = healthStatus ? Object.keys(healthStatus.services).length : 0;

  const statCards = [
    {
      label: "Total Tasks",
      value: totalTasks.toLocaleString("hu-HU"),
      detail: `${pendingTasks + runningTasks} aktív`,
      icon: ListTodo,
      accent: "text-cyan-400",
    },
    {
      label: "Success Rate",
      value: `${successRate.toFixed(1)}%`,
      detail: `${taskStats?.errorCount ?? 0} hibás`,
      icon: ShieldCheck,
      accent: "text-emerald-400",
    },
    {
      label: "Agent State",
      value: `${activeAgents}/${totalAgents || "—"}`,
      detail: `${agentsList.length ? "élő" : "nincs adat"}`,
      icon: Bot,
      accent: "text-violet-400",
    },
    {
      label: "System Health",
      value: `${healthyServices}/${serviceCount || "—"}`,
      detail: "szolgáltatás egészség",
      icon: Sparkles,
      accent: "text-indigo-400",
    },
  ];

  return (
    <div className="flex flex-col gap-5 h-full">
      <Card className="glass-card border-white/10 overflow-hidden">
        <CardContent className="p-5 lg:p-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="h-2.5 w-2.5 rounded-full bg-cyan-400 shadow-[0_0_18px_rgba(34,211,238,0.55)]" />
                <span className="text-[10px] font-mono tracking-[0.35em] text-cyan-300/80 uppercase">
                  Mission Control
                </span>
              </div>
              <div className="space-y-1">
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <h2 className="text-2xl lg:text-3xl font-semibold tracking-tight text-white">
                    Brunella Mission Control
                  </h2>
                  <span className="text-[11px] font-mono tracking-[0.3em] text-zinc-500 uppercase">
                    {widgets.length} widgets
                  </span>
                </div>
                <p className="max-w-2xl text-sm text-zinc-400">
                  Premium dark cockpit view for operators and developers — system health, agent state,
                  and task throughput in a single bento-grid.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
              {statCards.map((stat) => {
                const Icon = stat.icon;
                return (
                  <div
                    key={stat.label}
                    className={cn(
                      "rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5",
                      "shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]",
                    )}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-[10px] font-medium uppercase tracking-[0.24em] text-zinc-500">
                        {stat.label}
                      </span>
                      <Icon size={14} className={stat.accent} />
                    </div>
                    <div className="mt-2 flex items-end justify-between gap-3">
                      <span className="text-xl font-semibold text-white tracking-tight">
                        {stat.value}
                      </span>
                      <span className="text-[10px] text-zinc-500 font-mono">
                        {stat.detail}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono tracking-[0.3em] text-zinc-500 uppercase">
            {currentLayout.name}
          </span>
          <span className="h-1 w-1 rounded-full bg-zinc-600" />
          <span className="text-[10px] text-zinc-500 font-mono tracking-widest">
            {currentLayout.description}
          </span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setLayoutMode("default-dashboard")}
          className="text-zinc-500 hover:text-zinc-200 gap-1.5 h-8 text-xs"
        >
          <RotateCcw size={12} />
          Reset layout
        </Button>
      </div>

      <div
        className="widget-grid flex-1 min-h-0 overflow-y-auto custom-scrollbar pb-4 px-1"
        style={{
          gridTemplateAreas: currentLayout.gridTemplateAreas.join(" "),
          gridTemplateColumns: currentLayout.gridTemplateColumns,
          gridTemplateRows: currentLayout.gridTemplateRows,
        }}
      >
        {widgets.map((w, index) => {
          if (!w) return null;
          const Component = w.component;
          const area = currentLayout.widgetAssignments[w.id];
          return (
            <motion.div
              key={w.id}
              className="widget-card min-h-0"
              style={{ gridArea: area }}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.28, delay: index * 0.03, ease: "easeOut" }}
            >
              <Component />
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
