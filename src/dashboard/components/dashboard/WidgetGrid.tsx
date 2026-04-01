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
    <div className="flex flex-col gap-4 h-full">
      {/* ── Command Strip ── */}
      <div className="command-strip shrink-0 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex items-center gap-2 shrink-0">
            <div className="h-1.5 w-1.5 rounded-full bg-cyan-300 shadow-[0_0_10px_rgba(34,211,238,0.65)] animate-pulse" />
            <span className="text-[9px] font-mono tracking-[0.34em] text-cyan-200/80 uppercase leading-none">
              BRUNELLA
            </span>
          </div>
          <div className="h-3.5 w-px bg-white/[0.06] hidden sm:block" />
          <span className="text-[9px] text-zinc-500 font-mono tracking-[0.22em] hidden sm:inline truncate">
            {currentLayout.name.toUpperCase().replaceAll(" ", "_")} · {widgets.length} WIDGETS
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <div className="hidden md:flex items-center gap-2">
            {statCards.map((stat) => {
              const Icon = stat.icon;
              return (
                <div key={stat.label} className="stat-pill min-w-[88px]">
                  <div className="stat-pill__header">
                    <Icon size={9} className={cn(stat.accent)} />
                    <span className="stat-pill__label">
                      {stat.label}
                    </span>
                  </div>
                  <div className="flex items-baseline gap-1 mt-0.5">
                    <span className="stat-pill__value">
                      {stat.value}
                    </span>
                    <span className="stat-pill__detail">
                      {stat.detail}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="h-5 w-px bg-white/[0.06] hidden md:block" />
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setLayoutMode("default-dashboard")}
            className="text-zinc-500 hover:text-zinc-200 h-8 w-8 hover:bg-white/[0.06]"
            title="Reset layout"
            aria-label="Reset layout"
          >
            <RotateCcw size={12} />
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
