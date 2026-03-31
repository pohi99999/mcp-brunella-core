import React from "react";
import { motion } from "framer-motion";
import { WIDGET_REGISTRY } from "@/lib/widgetRegistry";
import { RotateCcw, ShieldCheck, Bot, ListTodo, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLayout } from "@/lib/layout/LayoutContext";
import { useSystemSignal } from "@/hooks/useSystemSignal";
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
    <div className="flex flex-col gap-3 h-full">
      {/* ── Command Strip ── */}
      <div className="shrink-0 flex items-center justify-between px-4 py-2.5 rounded-2xl border border-white/[0.07] bg-slate-950/60 backdrop-blur-xl shadow-[0_4px_20px_-8px_rgba(0,0,0,0.5)]">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex items-center gap-2 shrink-0">
            <div className="h-1.5 w-1.5 rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.65)] animate-pulse" />
            <span className="text-[9px] font-mono tracking-[0.38em] text-cyan-300/80 uppercase leading-none">
              BRUNELLA
            </span>
          </div>
          <div className="h-3.5 w-px bg-white/[0.06] hidden sm:block" />
          <span className="text-[9px] text-zinc-600 font-mono tracking-widest hidden sm:inline truncate">
            {currentLayout.name.toUpperCase().replaceAll(" ", "_")} · {widgets.length} WIDGETS
          </span>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <div className="hidden sm:flex items-center gap-1.5">
            {statCards.map((stat) => {
              const Icon = stat.icon;
              return (
                <div
                  key={stat.label}
                  className="flex flex-col gap-0.5 px-2.5 py-1.5 rounded-xl border border-white/[0.07] bg-white/[0.025] min-w-[74px]"
                >
                  <div className="flex items-center gap-1">
                    <Icon size={9} className={cn(stat.accent)} />
                    <span className="text-[8px] font-mono uppercase tracking-[0.22em] text-zinc-600 leading-none">
                      {stat.label}
                    </span>
                  </div>
                  <div className="flex items-baseline gap-1 mt-0.5">
                    <span className="text-[13px] font-semibold text-white tracking-tight leading-none">
                      {stat.value}
                    </span>
                    <span className="text-[8px] text-zinc-600 font-mono leading-none truncate max-w-[40px]">
                      {stat.detail}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="h-5 w-px bg-white/[0.06] hidden sm:block" />
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setLayoutMode("default-dashboard")}
            className="text-zinc-600 hover:text-zinc-300 h-7 w-7"
            title="Reset layout"
          >
            <RotateCcw size={11} />
          </Button>
        </div>
      </div>

      {/* ── Bento Widget Grid ── */}
      <div
        className="widget-grid flex-1 min-h-0 overflow-y-auto custom-scrollbar pb-4"
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
