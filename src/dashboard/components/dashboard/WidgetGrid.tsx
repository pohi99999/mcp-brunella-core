import React, { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { WIDGET_REGISTRY } from "@/lib/widgetRegistry";
import { RotateCcw, ShieldCheck, Bot, ListTodo, Sparkles, Activity } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLayout } from "@/lib/layout/LayoutContext";
import { useSystemSignal } from "@/hooks/useSystemSignal";

export function WidgetGrid ()
{
  const { t } = useTranslation();
  const { currentLayout, setLayoutMode } = useLayout();
  const { agents, taskStats, healthStatus } = useSystemSignal();
  const [useCompactLayout, setUseCompactLayout] = useState( false );

  useEffect( () =>
  {
    if ( typeof window === "undefined" ) return;

    const mediaQuery = window.matchMedia( "(max-width: 1279px)" );
    const syncLayout = () => setUseCompactLayout( mediaQuery.matches );

    syncLayout();

    if ( typeof mediaQuery.addEventListener === "function" )
    {
      mediaQuery.addEventListener( "change", syncLayout );
      return () => mediaQuery.removeEventListener( "change", syncLayout );
    }

    mediaQuery.addListener( syncLayout );
    return () => mediaQuery.removeListener( syncLayout );
  }, [] );

  const definedGridAreas = useMemo( () =>
    new Set(
      currentLayout.gridTemplateAreas
        .flatMap( ( row ) => row.replaceAll( '"', '' ).trim().split( /\s+/ ) )
        .filter( ( area ) => area.length > 0 && area !== '.' )
    ),
    [currentLayout.gridTemplateAreas]
  );

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
      label: t("dashboard.stats.health"),
      value: `${ healthyServices }/${ serviceCount || "—" }`,
      icon: Sparkles,
      colorClass: "text-white/76",
      detail: healthStatus?.status?.toUpperCase() ? t(`dashboard.stats.${healthStatus.status.toLowerCase()}`, healthStatus.status.toUpperCase()) : t("dashboard.stats.no_signal"),
    },
    {
      label: t("dashboard.stats.agents"),
      value: `${ activeAgents }/${ totalAgents || "—" }`,
      icon: Bot,
      colorClass: "text-white/76",
      detail: activeAgents > 0 ? t("dashboard.stats.active") : t("dashboard.stats.standby"),
    },
    {
      label: t("dashboard.stats.queue"),
      value: ( pendingTasks + runningTasks ).toString(),
      icon: ListTodo,
      colorClass: "text-white/76",
      detail: `${ totalTasks } ${t("dashboard.stats.total")}`,
    },
    {
      label: t("dashboard.stats.success"),
      value: `${ Math.round( successRate ) }%`,
      icon: ShieldCheck,
      colorClass: successRate >= 90 ? "text-emerald-300" : "text-amber-300",
      detail: pendingTasks > 0 ? `${ pendingTasks } ${t("dashboard.stats.pending")}` : t("dashboard.stats.stable"),
    },
  ];

  return (
    <div className="flex h-full w-full flex-col gap-5">
      {/* ── Cockpit Header ── */ }
      <section className="command-strip gap-4 rounded-[1.5rem]" data-testid="mc-command-strip">
        <div className="flex min-w-0 flex-1 flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/[0.08] bg-white/[0.03] shadow-[0_22px_52px_-40px_rgba(0,0,0,0.96)]">
              <Activity size={ 16 } className="text-white" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <div className="h-1.5 w-1.5 rounded-full bg-white/80 shadow-[0_0_10px_rgba(255,255,255,0.2)]" />
                <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-white">
                  {t("dashboard.mission_control")}
                </h2>
              </div>
              <p className="mt-1 max-w-2xl text-sm leading-relaxed text-white/56">
                {t("dashboard.cockpit_description")}
              </p>
              <span className="mt-2 inline-flex rounded-full border border-white/[0.07] bg-white/[0.025] px-2.5 py-1 text-[10px] font-mono tracking-[0.26em] text-white/42">
                { currentLayout.name.toUpperCase().replaceAll( " ", "_" ) }
              </span>
            </div>
          </div>

          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            { statCards.map( ( stat ) => (
              <div key={ stat.label } className="stat-pill min-w-[7.25rem]">
                <div className="stat-pill__header">
                  <stat.icon size={ 11 } className={ stat.colorClass } />
                  <span className="stat-pill__label">{ stat.label }</span>
                </div>
                <span className="stat-pill__value tabular-nums">{ stat.value }</span>
                <span className="stat-pill__detail max-w-none">{ stat.detail }</span>
              </div>
            ) ) }
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2 self-start lg:self-center">
          <Button
            variant="outline"
            size="sm"
            onClick={ () => setLayoutMode( "default-dashboard" ) }
            className="h-10 gap-2 rounded-xl border-white/[0.08] bg-white/[0.025] px-3.5 text-white/68 transition-all hover:border-white/[0.14] hover:bg-white/[0.05] hover:text-white"
          >
            <RotateCcw size={ 12 } />
            <span className="text-[10px] font-medium uppercase tracking-[0.26em]">{t("dashboard.reset_view")}</span>
          </Button>
        </div>
      </section>

      {/* ── Bento Grid ── */ }
      <div
        className="flex-1 grid w-full min-h-0 min-w-0 gap-4 overflow-y-auto custom-scrollbar pr-1 pb-6"
        style={ {
          ...( useCompactLayout
            ? {
                gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 20rem), 1fr))",
                gridAutoRows: "minmax(16rem, auto)",
              }
            : {
                gridTemplateAreas: currentLayout.gridTemplateAreas.map( ( row: string ) => row ).join( " " ),
                gridTemplateColumns: currentLayout.gridTemplateColumns,
                gridTemplateRows: currentLayout.gridTemplateRows,
              } ),
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
              className="widget-card flex min-h-0 min-w-0 flex-col"
              style={ !useCompactLayout && definedGridAreas.has( area ) ? { gridArea: area } : undefined }
              initial={ { opacity: 0, scale: 0.985, y: 10 } }
              animate={ { opacity: 1, scale: 1, y: 0 } }
              transition={ { 
                duration: 0.36, 
                delay: index * 0.035, 
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
