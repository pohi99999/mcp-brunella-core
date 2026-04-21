import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Cpu, RefreshCcw, Router, Wrench } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { getAgentDiagnostics, type AgentDiagnosticsResponse } from "@/lib/apiService";

function badgeVariantForLoadStatus ( status: AgentDiagnosticsResponse["agents"][number]["loadStatus"] ): "default" | "secondary" | "destructive" | "outline"
{
    if ( status === "loaded" ) return "default";
    if ( status === "error" ) return "destructive";
    if ( status === "skipped" ) return "outline";
    return "secondary";
}

function badgeVariantForRuntime ( status: AgentDiagnosticsResponse["agents"][number]["runtime"]["status"] ): "default" | "secondary" | "destructive" | "outline"
{
    if ( status === "idle" ) return "secondary";
    if ( status === "working" ) return "default";
    if ( status === "error" ) return "destructive";
    return "outline";
}

export function AgentDiagnosticsPanel ()
{
    const { t } = useTranslation();
    const [data, setData] = useState<AgentDiagnosticsResponse | null>( null );
    const [loading, setLoading] = useState( true );

    const loadDiagnostics = async () =>
    {
        try
        {
            const response = await getAgentDiagnostics();
            setData( response );
        } catch ( error: unknown )
        {
            const message = error instanceof Error ? error.message : String( error );
            toast.error( `${t("diagnostics.loading_error", "Agent diagnosztika betöltési hiba")}: ${ message }` );
        } finally
        {
            setLoading( false );
        }
    };

    useEffect( () =>
    {
        void loadDiagnostics();
        const interval = setInterval( () =>
        {
            void loadDiagnostics();
        }, 10000 );
        return () => clearInterval( interval );
    }, [] );

    const summary = useMemo( () => data?.validation.summary, [data] );

    return (
            <div className="space-y-6 animate-in fade-in duration-500">
            <div className="flex items-end justify-between gap-4">
                <div>
                    <p className="text-[10px] uppercase tracking-[0.22em] text-zinc-500">{t("diagnostics.subtitle")}</p>
                    <h2 className="text-2xl font-semibold text-zinc-100">{t("diagnostics.title")}</h2>
                    <p className="mt-1 text-sm text-zinc-500">{t("diagnostics.description")}</p>
                </div>
                <Button onClick={ () => void loadDiagnostics() } variant="outline" size="sm" className="gap-2 rounded-full border-white/10 bg-white/[0.02] text-zinc-100 hover:bg-white/[0.05]">
                    <RefreshCcw className="w-4 h-4" /> {t("diagnostics.refresh")}
                </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card className="glass-card border-white/10 overflow-hidden">
                    <CardHeader className="pb-2 border-b border-white/[0.05] bg-white/[0.015]">
                        <CardDescription className="text-zinc-500 uppercase tracking-[0.22em] text-[10px]">{t("diagnostics.registry_status")}</CardDescription>
                        <CardTitle className="flex items-center gap-2 text-lg text-zinc-100">
                            { data?.validation.valid ? <CheckCircle2 className="w-5 h-5 text-emerald-400" /> : <AlertTriangle className="w-5 h-5 text-amber-400" /> }
                            { data?.validation.valid ? t("diagnostics.valid") : t("diagnostics.attention") }
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-xs text-zinc-500">{t("diagnostics.checked_at")}: { data?.validation.checkedAt ?? "-" }</p>
                    </CardContent>
                </Card>

                <Card className="glass-card border-white/10 overflow-hidden">
                    <CardHeader className="pb-2 border-b border-white/[0.05] bg-white/[0.015]">
                        <CardDescription className="text-zinc-500 uppercase tracking-[0.22em] text-[10px]">{t("diagnostics.total_agents")}</CardDescription>
                        <CardTitle className="text-2xl font-mono text-zinc-100">{ summary?.totalAgents ?? 0 }</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-xs text-zinc-500">{t("diagnostics.active_agents")}: { summary?.activeAgents ?? 0 }</p>
                    </CardContent>
                </Card>

                <Card className="glass-card border-white/10 overflow-hidden">
                    <CardHeader className="pb-2 border-b border-white/[0.05] bg-white/[0.015]">
                        <CardDescription className="text-zinc-500 uppercase tracking-[0.22em] text-[10px]">{t("diagnostics.validation_errors")}</CardDescription>
                        <CardTitle className="text-2xl font-mono text-zinc-100">{ data?.validation.errors.length ?? 0 }</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-xs text-zinc-500">{t("diagnostics.warnings_count")}: { data?.validation.warnings.length ?? 0 }</p>
                    </CardContent>
                </Card>

                <Card className="glass-card border-white/10 overflow-hidden">
                    <CardHeader className="pb-2 border-b border-white/[0.05] bg-white/[0.015]">
                        <CardDescription className="text-zinc-500 uppercase tracking-[0.22em] text-[10px]">{t("diagnostics.default_agent")}</CardDescription>
                        <CardTitle className="text-lg text-zinc-100">{ summary?.defaultAgent ?? "-" }</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-xs text-zinc-500">{t("diagnostics.routing_fallback")}</p>
                    </CardContent>
                </Card>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                <Card className="glass-card border-white/10 xl:col-span-1 overflow-hidden">
                    <CardHeader className="pb-3 border-b border-white/[0.05] bg-white/[0.015]">
                        <CardTitle className="flex items-center gap-2 text-[11px] font-mono font-semibold uppercase tracking-[0.28em] text-zinc-400"><Wrench className="w-4 h-4 text-cyan-300" /> {t("diagnostics.registry_validation")}</CardTitle>
                        <CardDescription className="text-zinc-500">{t("diagnostics.registry_val_desc")}</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div>
                            <div className="text-xs uppercase tracking-wide text-zinc-500 mb-2">{t("diagnostics.errors")}</div>
                            <div className="space-y-2">
                                { ( data?.validation.errors.length ?? 0 ) === 0 ? (
                                    <div className="text-sm text-emerald-400">{t("diagnostics.no_errors")}</div>
                                ) : (
                                    data?.validation.errors.map( ( error ) => (
                                        <div key={ error } className="rounded-md border border-red-500/30 bg-red-500/10 p-2 text-sm text-red-200">{ error }</div>
                                    ) )
                                ) }
                            </div>
                        </div>
                        <div>
                            <div className="text-xs uppercase tracking-wide text-zinc-500 mb-2">{t("diagnostics.warnings_count")}</div>
                            <div className="space-y-2">
                                { ( data?.validation.warnings.length ?? 0 ) === 0 ? (
                                    <div className="text-sm text-zinc-500">{t("diagnostics.no_warnings")}</div>
                                ) : (
                                    data?.validation.warnings.map( ( warning ) => (
                                        <div key={ warning } className="rounded-md border border-amber-500/30 bg-amber-500/10 p-2 text-sm text-amber-100">{ warning }</div>
                                    ) )
                                ) }
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card className="glass-card border-white/10 xl:col-span-2 overflow-hidden">
                    <CardHeader className="pb-3 border-b border-white/[0.05] bg-white/[0.015]">
                        <CardTitle className="flex items-center gap-2 text-[11px] font-mono font-semibold uppercase tracking-[0.28em] text-zinc-400"><Router className="w-4 h-4 text-violet-300" /> {t("diagnostics.loader_routing")}</CardTitle>
                        <CardDescription className="text-zinc-500">{t("diagnostics.loader_routing_desc")}</CardDescription>
                    </CardHeader>
                    <CardContent className="p-0">
                        <ScrollArea className="h-[640px]">
                            <div className="divide-y divide-border/50">
                                { loading && !data ? (
                                    <div className="p-4 text-zinc-500">{t("diagnostics.loading")}</div>
                                ) : data?.agents.map( ( agent ) => (
                                    <div key={ agent.name } className="p-4 space-y-3">
                                        <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                                            <div>
                                                <div className="text-base font-semibold">{ agent.name }</div>
                                                <div className="text-xs text-zinc-500">{ agent.module } → { agent.configuredClass }</div>
                                            </div>
                                            <div className="flex flex-wrap gap-2">
                                                <Badge variant={ badgeVariantForLoadStatus( agent.loadStatus ) }>{ agent.loadStatus }</Badge>
                                                <Badge variant={ badgeVariantForRuntime( agent.runtime.status ) }>{ agent.runtime.status }</Badge>
                                                <Badge variant="outline">{ agent.metadata.executionMode }</Badge>
                                                <Badge variant="outline">{ agent.metadata.costTier }</Badge>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                                            <div className="rounded-md border border-border/50 bg-background/40 p-3 space-y-2">
                                                <div className="font-medium flex items-center gap-2"><Cpu className="w-4 h-4 text-cyan-400" /> {t("diagnostics.loader")}</div>
                                                <div><span className="text-zinc-500">{t("diagnostics.resolved_export")}:</span> { agent.resolvedExportName ?? "-" }</div>
                                                <div><span className="text-zinc-500">{t("diagnostics.strategy")}:</span> { agent.resolutionStrategy ?? "-" }</div>
                                                <div><span className="text-zinc-500">{t("diagnostics.exports")}:</span> { agent.availableExports.join( ", " ) || "-" }</div>
                                                { agent.error ? <div className="text-red-300">{ agent.error }</div> : null }
                                            </div>
                                            <div className="rounded-md border border-border/50 bg-background/40 p-3 space-y-2">
                                                <div className="font-medium">{t("diagnostics.metadata_standard")}</div>
                                                <div><span className="text-zinc-500">{t("diagnostics.category")}:</span> { agent.metadata.category }</div>
                                                <div><span className="text-zinc-500">{t("diagnostics.lifecycle")}:</span> { agent.metadata.status }</div>
                                                <div><span className="text-zinc-500">{t("diagnostics.runtime")}:</span> { agent.metadata.runtimeCompatibility }</div>
                                                <div><span className="text-zinc-500">{t("diagnostics.priority")}:</span> { agent.metadata.priority }</div>
                                            </div>
                                        </div>

                                        <div className="flex flex-wrap gap-2 text-xs">
                                            { agent.metadata.capabilities.slice( 0, 8 ).map( ( capability ) => (
                                                <Badge key={ `${ agent.name }-${ capability }` } variant="secondary">{ capability }</Badge>
                                            ) ) }
                                            { agent.metadata.tags.map( ( tag ) => (
                                                <Badge key={ `${ agent.name }-${ tag }` } variant="outline">#{ tag }</Badge>
                                            ) ) }
                                        </div>

                                        <div className="text-xs text-zinc-500">
                                            {t("diagnostics.success")}: { agent.runtime.successCount } · {t("diagnostics.errors")}: { agent.runtime.errorCount } · {t("diagnostics.last_task")}: { agent.runtime.lastTask ?? "-" }
                                        </div>
                                    </div>
                                ) ) }
                            </div>
                        </ScrollArea>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
