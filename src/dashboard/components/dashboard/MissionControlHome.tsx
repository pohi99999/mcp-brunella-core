import type { ComponentType } from "react";
import { motion } from "framer-motion";
import
    {
        Activity,
        Bot,
        Cpu,
        ListTodo,
        RefreshCcw,
        ShieldCheck,
        Sparkles,
    } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLayout } from "@/lib/layout/LayoutContext";
import { WIDGET_REGISTRY } from "@/lib/widgetRegistry";
import { useSystemSignal } from "@/hooks/useSystemSignal";
import { cn } from "@/lib/utils";

type WidgetPriority = "hero" | "primary" | "secondary";

interface SummaryCardProps
{
    label: string;
    value: string;
    detail: string;
    icon: ComponentType<{ size?: number; className?: string }>;
    accent: string;
    testId: string;
}

function SummaryCard ( { accent, detail, icon: Icon, label, testId, value }: SummaryCardProps )
{
    return (
        <div
            className="relative overflow-hidden rounded-2xl border border-white/[0.07] bg-[linear-gradient(180deg,rgba(13,13,14,0.94),rgba(8,8,9,0.9))] px-4 pb-4 pt-3.5 shadow-[0_22px_52px_-38px_rgba(0,0,0,0.98)] transition-all duration-200 hover:border-white/[0.12] hover:bg-[linear-gradient(180deg,rgba(15,15,16,0.96),rgba(10,10,11,0.92))]"
            data-testid={ testId }
        >
            <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/12 to-transparent" />
            <div className="flex items-center justify-between gap-2">
                <span className="text-[9.5px] font-semibold uppercase tracking-[0.22em] text-white/35">
                    { label }
                </span>
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl border border-white/[0.07] bg-white/[0.025]">
                    <Icon size={ 13 } className={ accent } />
                </span>
            </div>
            <div className="mt-3.5 text-[1.85rem] font-semibold leading-none tracking-tight text-white">
                { value }
            </div>
            <p className="mt-1.5 truncate text-[10.5px] text-white/42">{ detail }</p>
        </div>
    );
}

function resolveWidget ( widgetId: string )
{
    return WIDGET_REGISTRY[widgetId] ?? null;
}

export function MissionControlHome ()
{
    const { currentLayout, setLayoutMode } = useLayout();
    const { agents, developerMetrics, healthStatus, isConnected, taskStats } = useSystemSignal();

    const agentsList = Array.from( agents?.values() ?? [] );
    const activeAgents = agentsList.filter( ( agent ) => agent.status === "working" ).length;
    const totalAgents = agentsList.length;
    const healthyServices = healthStatus
        ? Object.values( healthStatus.services ).filter( ( service ) =>
        {
            if ( typeof service === "string" )
            {
                return service === "healthy" || service === "ok";
            }

            if ( service && typeof service === "object" && "status" in service )
            {
                const { status } = service as { status?: unknown };
                return status === "healthy" || status === "ok";
            }

            return false;
        } ).length
        : 0;
    const serviceCount = healthStatus ? Object.keys( healthStatus.services ).length : 0;
    const summaryCards: SummaryCardProps[] = [
        {
            label: "Queue",
            value: `${ ( taskStats?.runningCount ?? 0 ) + ( taskStats?.pendingCount ?? 0 ) }`,
            detail: `${ taskStats?.total ?? 0 } összes task`,
            icon: ListTodo,
            accent: "text-white",
            testId: "mc-kpi-queue",
        },
        {
            label: "Success rate",
            value: `${ ( taskStats?.successRate ?? 0 ).toFixed( 1 ) }%`,
            detail: `${ taskStats?.errorCount ?? 0 } hibás futás`,
            icon: ShieldCheck,
            accent: "text-emerald-300",
            testId: "mc-kpi-success-rate",
        },
        {
            label: "Agents",
            value: `${ activeAgents }/${ totalAgents || 0 }`,
            detail: isConnected ? "socket él" : "offline telemetria",
            icon: Bot,
            accent: "text-sky-200",
            testId: "mc-kpi-agents",
        },
        {
            label: "Health",
            value: `${ healthyServices }/${ serviceCount || 0 }`,
            detail: healthStatus?.status ?? "nincs health adat",
            icon: Sparkles,
            accent: "text-zinc-100",
            testId: "mc-kpi-health",
        },
        {
            label: "Build",
            value: developerMetrics?.builds.lastStatus?.toUpperCase() ?? "N/A",
            detail: developerMetrics?.builds.lastDurationMs
                ? `${ Math.round( developerMetrics.builds.lastDurationMs / 1000 ) }s utolsó build`
                : "nincs build telemetria",
            icon: Cpu,
            accent: developerMetrics?.builds.lastStatus === "success" ? "text-emerald-300" : "text-amber-300",
            testId: "mc-kpi-build",
        },
    ];

    const renderWidgetCard = (
        widgetId: string,
        index: number,
        className?: string,
        priority: WidgetPriority = "primary",
    ) =>
    {
        const widget = resolveWidget( widgetId );
        if ( !widget )
        {
            return null;
        }

        const Component = widget.component;

        return (
            <motion.section
                key={ widgetId }
                className={ cn( "widget-card min-h-0", className ) }
                data-testid={ `mc-widget-${ widgetId }` }
                data-widget-id={ widgetId }
                data-priority={ priority }
                initial={ { opacity: 0, y: 16 } }
                animate={ { opacity: 1, y: 0 } }
                transition={ { duration: 0.25, delay: index * 0.03, ease: "easeOut" } }
            >
                <Component />
            </motion.section>
        );
    };

    if ( currentLayout.id !== "default-dashboard" )
    {
        const widgets = Object.keys( currentLayout.widgetAssignments )
            .map( ( widgetId ) => ( {
                widgetId,
                gridArea: currentLayout.widgetAssignments[widgetId],
                widget: resolveWidget( widgetId ),
            } ) )
            .filter(
                ( entry ): entry is { widgetId: string; gridArea: string; widget: NonNullable<ReturnType<typeof resolveWidget>> } =>
                    entry.widget !== null,
            );

        return (
            <div className="widget-grid min-h-full pb-4" data-testid="mc-widget-grid">
                { widgets.map( ( entry, index ) =>
                {
                    const Component = entry.widget.component;
                    return (
                        <motion.section
                            key={ entry.widgetId }
                            className="widget-card min-h-0"
                            style={ { gridArea: entry.gridArea } }
                            data-testid={ `mc-widget-${ entry.widgetId }` }
                            data-widget-id={ entry.widgetId }
                            data-grid-area={ entry.gridArea }
                            data-priority="secondary"
                            initial={ { opacity: 0, y: 16 } }
                            animate={ { opacity: 1, y: 0 } }
                            transition={ { duration: 0.25, delay: index * 0.03, ease: "easeOut" } }
                        >
                            <Component />
                        </motion.section>
                    );
                } ) }
            </div>
        );
    }

    return (
        <div className="flex min-h-full flex-col gap-4" data-testid="mc-dashboard-home">
            { /* Header strip */ }
            <section className="command-strip block rounded-[1.75rem] p-5" data-testid="mc-summary-strip">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                        <div className="flex items-center gap-1.5 text-[9.5px] font-semibold uppercase tracking-[0.22em] text-white/38">
                            <Activity size={ 10 } className="text-white/72" />
                            Operator overview
                        </div>
                        <h2 className="mt-1.5 text-xl font-semibold tracking-tight text-white">
                            Mission Control cockpit
                        </h2>
                        <p className="mt-1.5 max-w-2xl text-[12px] leading-relaxed text-white/54">
                            Rendszer-egészség, agent aktivitás és task queue egy letisztult, magas kontrasztú cockpit nézetben.
                        </p>
                    </div>
                    <Button
                        variant="outline"
                        size="sm"
                        className="h-10 shrink-0 gap-2 rounded-xl border-white/[0.08] bg-white/[0.025] px-3.5 text-[12px] text-white/68 hover:bg-white/[0.05] hover:text-white"
                        onClick={ () => setLayoutMode( "default-dashboard" ) }
                    >
                        <RefreshCcw size={ 12 } />
                        Reset cockpit
                    </Button>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-2 2xl:grid-cols-5">
                    { summaryCards.map( ( card ) => (
                        <SummaryCard key={ card.label } { ...card } />
                    ) ) }
                </div>
            </section>

            { /* Widget grid */ }
            <section
                className="grid min-h-0 gap-4 xl:grid-cols-12 xl:auto-rows-[minmax(17rem,auto)]"
                data-testid="mc-widget-grid"
            >
                { renderWidgetCard( "health", 0, "xl:col-span-5 xl:row-span-2", "hero" ) }
                { renderWidgetCard( "agent_status", 1, "xl:col-span-4 xl:row-span-1", "primary" ) }
                { renderWidgetCard( "task_queue", 2, "xl:col-span-3 xl:row-span-1", "primary" ) }
                { renderWidgetCard( "jules", 3, "xl:col-span-7 xl:row-span-2", "primary" ) }
                { renderWidgetCard( "agent_chatter", 4, "xl:col-span-5 xl:row-span-2", "primary" ) }

                <div className="grid gap-4 xl:col-span-6 xl:row-span-2">
                    { renderWidgetCard( "track_progress", 5, "min-h-[16rem]", "secondary" ) }
                    { renderWidgetCard( "suggested_tasks", 6, "min-h-[16rem]", "secondary" ) }
                </div>

                <div className="grid gap-4 xl:col-span-6 xl:row-span-2">
                    { renderWidgetCard( "cloudflare_agents", 7, "min-h-[16rem]", "secondary" ) }
                    { renderWidgetCard( "harvest_pipeline", 8, "min-h-[16rem]", "secondary" ) }
                </div>
            </section>
        </div>
    );
}
