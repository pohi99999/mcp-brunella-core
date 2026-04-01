import React from "react";
import { motion } from "framer-motion";
import { WIDGET_REGISTRY } from "@/lib/widgetRegistry";
import { RotateCcw, ShieldCheck, Bot, ListTodo, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLayout } from "@/lib/layout/LayoutContext";
import { useSystemSignal } from "@/hooks/useSystemSignal";
import { cn } from "@/lib/utils";

export function WidgetGrid ()
{
  const { currentLayout, setLayoutMode } = useLayout();
  const { agents, taskStats, healthStatus } = useSystemSignal();

  const widgets = Object.entries( currentLayout.widgetAssignments )
    .map( ( [widgetId] ) =>
    {
      const widget = WIDGET_REGISTRY[widgetId];
      if ( !widget ) return null;
      return { id: widgetId, ...widget };
    } )
    .filter( Boolean );

  const agentsList = agents ? Array.from( agents.values() ) : [];
  const activeAgents = agentsList.filter( ( agent ) => agent.status === "working" ).length;
  const totalAgents = agentsList.length;
  const pendingTasks = taskStats?.pendingCount ?? 0;
  const runningTasks = taskStats?.runningCount ?? 0;
  const successRate = taskStats?.successRate ?? 0;
  const totalTasks = taskStats?.total ?? 0;
  const healthyServices = healthStatus
    ? Object.values( healthStatus.services ).filter( ( service ) =>
    {
      if ( typeof service === "string" ) return service === "healthy" || service === "ok";
      if ( service && typeof service === "object" && "status" in service )
      {
        return ( service as { status?: string } ).status === "healthy" || ( service as { status?: string } ).status === "ok";
      }
      return false;
    } ).length
    : 0;
  const serviceCount = healthStatus ? Object.keys( healthStatus.services ).length : 0;

  const statCards = [
    {
      label: "System Health",
      value: `${ healthyServices }/${ serviceCount || "—" }`,
      icon: Sparkles,
      color: "indigo",
    },
    {
      label: "Agent Cluster",
      value: `${ activeAgents }/${ totalAgents || "—" }`,
      icon: Bot,
      color: "violet",
    },
    {
      label: "Queue Load",
      value: ( pendingTasks + runningTasks ).toString(),
      icon: ListTodo,
      color: "cyan",
    },
    {
      label: "Success",
      value: `${ Math.round( successRate ) }%`,
      icon: ShieldCheck,
      color: "emerald",
    },
  ];

  return (
    <div className="flex flex-col gap-5 h-full">
      {/* ── Cockpit Header ── */ }
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-1">
        <div className="flex items-center gap-4">
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-cyan-400 shadow-[0_0_12px_rgba(34,211,238,0.8)] animate-pulse" />
              <h2 className="text-sm font-bold tracking-tight text-white uppercase">
                Mission Control
              </h2>
            </div>
            <span className="text-[10px] text-zinc-500 font-mono tracking-widest mt-0.5">
              { currentLayout.name.toUpperCase().replaceAll( " ", "_" ) } v2.6.0
            </span>
          </div>
          <div className="h-8 w-px bg-white/[0.06]" />
          <div className="flex items-center gap-3">
            { statCards.map( ( stat ) => (
              <div key={ stat.label } className="group flex flex-col gap-0.5">
                <span className="text-[9px] uppercase tracking-wider text-zinc-500 group-hover:text-zinc-400 transition-colors">
                  { stat.label }
                </span>
                <div className="flex items-center gap-1.5">
                  <stat.icon size={ 10 } className={`text-${stat.color}-400/80`} />
                  <span className="text-xs font-bold text-zinc-200 tabular-nums">
                    { stat.value }
                  </span>
                </div>
              </div>
            ) ) }
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={ () => setLayoutMode( "default-dashboard" ) }
            className="h-8 px-3 border-white/[0.06] bg-white/[0.02] text-zinc-400 hover:text-white hover:bg-white/[0.08] hover:border-white/[0.1] transition-all gap-2"
          >
            <RotateCcw size={ 12 } />
            <span className="text-[10px] font-medium uppercase tracking-wide">Reset View</span>
          </Button>
        </div>
      </div>

      {/* ── Bento Grid ── */ }
      <div
        className="flex-1 grid gap-4 min-h-0 overflow-y-auto custom-scrollbar pr-1 pb-6"
        style={ {
          gridTemplateAreas: currentLayout.gridTemplateAreas.map( ( row: string ) => row ).join( " " ),
          gridTemplateColumns: currentLayout.gridTemplateColumns,
          gridTemplateRows: currentLayout.gridTemplateRows,
        } }
      >
        { widgets.map( ( w, index ) =>
        {
          if ( !w ) return null;
          const Component = w.component;
          const area = currentLayout.widgetAssignments[w.id];
          return (
            <motion.div
              key={ w.id }
              className="bg-zinc-900/40 border border-white/[0.04] rounded-xl overflow-hidden shadow-2xl flex flex-col"
              style={ { gridArea: area } }
              initial={ { opacity: 0, scale: 0.98, y: 10 } }
              animate={ { opacity: 1, scale: 1, y: 0 } }
              transition={ { 
                duration: 0.4, 
                delay: index * 0.04, 
                ease: [0.23, 1, 0.32, 1] 
              } }
            >
              <Component />
            </motion.div>
          );
        } ) }
      </div>
    </div>
  );
}
