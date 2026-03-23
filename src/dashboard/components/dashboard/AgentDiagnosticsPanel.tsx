import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Cpu, RefreshCcw, Router, Wrench } from "lucide-react";
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
            toast.error( `Agent diagnosztika betöltési hiba: ${ message }` );
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
            <div className="flex items-center justify-between gap-4">
                <div>
                    <h2 className="text-3xl font-space font-bold text-foreground">Agent Diagnostics</h2>
                    <p className="text-zinc-500 mt-1">Registry validáció, export loader állapot és routing metadata egy helyen.</p>
                </div>
                <Button onClick={ () => void loadDiagnostics() } variant="outline" size="sm" className="gap-2">
                    <RefreshCcw className="w-4 h-4" /> Frissítés
                </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card className="glass-card">
                    <CardHeader className="pb-2">
                        <CardDescription>Registry állapot</CardDescription>
                        <CardTitle className="flex items-center gap-2 text-lg">
                            { data?.validation.valid ? <CheckCircle2 className="w-5 h-5 text-emerald-400" /> : <AlertTriangle className="w-5 h-5 text-amber-400" /> }
                            { data?.validation.valid ? "Valid" : "Figyelmet kér" }
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-xs text-zinc-500">Ellenőrizve: { data?.validation.checkedAt ?? "-" }</p>
                    </CardContent>
                </Card>

                <Card className="glass-card">
                    <CardHeader className="pb-2">
                        <CardDescription>Összes agent</CardDescription>
                        <CardTitle className="text-2xl">{ summary?.totalAgents ?? 0 }</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-xs text-zinc-500">Aktív: { summary?.activeAgents ?? 0 }</p>
                    </CardContent>
                </Card>

                <Card className="glass-card">
                    <CardHeader className="pb-2">
                        <CardDescription>Validációs hibák</CardDescription>
                        <CardTitle className="text-2xl">{ data?.validation.errors.length ?? 0 }</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-xs text-zinc-500">Warningok: { data?.validation.warnings.length ?? 0 }</p>
                    </CardContent>
                </Card>

                <Card className="glass-card">
                    <CardHeader className="pb-2">
                        <CardDescription>Default agent</CardDescription>
                        <CardTitle className="text-lg">{ summary?.defaultAgent ?? "-" }</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-xs text-zinc-500">Routing fallback cél</p>
                    </CardContent>
                </Card>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                <Card className="glass-card xl:col-span-1">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2"><Wrench className="w-4 h-4 text-primary" /> Registry Validation</CardTitle>
                        <CardDescription>A normalizáló és schema validáló összesítése.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div>
                            <div className="text-xs uppercase tracking-wide text-zinc-500 mb-2">Errors</div>
                            <div className="space-y-2">
                                { ( data?.validation.errors.length ?? 0 ) === 0 ? (
                                    <div className="text-sm text-emerald-400">Nincs blokkoló schema hiba.</div>
                                ) : (
                                    data?.validation.errors.map( ( error ) => (
                                        <div key={ error } className="rounded-md border border-red-500/30 bg-red-500/10 p-2 text-sm text-red-200">{ error }</div>
                                    ) )
                                ) }
                            </div>
                        </div>
                        <div>
                            <div className="text-xs uppercase tracking-wide text-zinc-500 mb-2">Warnings</div>
                            <div className="space-y-2">
                                { ( data?.validation.warnings.length ?? 0 ) === 0 ? (
                                    <div className="text-sm text-zinc-500">Nincs aktív figyelmeztetés.</div>
                                ) : (
                                    data?.validation.warnings.map( ( warning ) => (
                                        <div key={ warning } className="rounded-md border border-amber-500/30 bg-amber-500/10 p-2 text-sm text-amber-100">{ warning }</div>
                                    ) )
                                ) }
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card className="glass-card xl:col-span-2">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2"><Router className="w-4 h-4 text-primary" /> Agent Loader & Routing Metadata</CardTitle>
                        <CardDescription>Betöltési stratégia, runtime státusz, cost/execution profil.</CardDescription>
                    </CardHeader>
                    <CardContent className="p-0">
                        <ScrollArea className="h-[640px]">
                            <div className="divide-y divide-border/50">
                                { loading && !data ? (
                                    <div className="p-4 text-zinc-500">Betöltés...</div>
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
                                                <div className="font-medium flex items-center gap-2"><Cpu className="w-4 h-4 text-cyan-400" /> Loader</div>
                                                <div><span className="text-zinc-500">Resolved export:</span> { agent.resolvedExportName ?? "-" }</div>
                                                <div><span className="text-zinc-500">Strategy:</span> { agent.resolutionStrategy ?? "-" }</div>
                                                <div><span className="text-zinc-500">Exports:</span> { agent.availableExports.join( ", " ) || "-" }</div>
                                                { agent.error ? <div className="text-red-300">{ agent.error }</div> : null }
                                            </div>
                                            <div className="rounded-md border border-border/50 bg-background/40 p-3 space-y-2">
                                                <div className="font-medium">Metadata standard</div>
                                                <div><span className="text-zinc-500">Category:</span> { agent.metadata.category }</div>
                                                <div><span className="text-zinc-500">Lifecycle:</span> { agent.metadata.status }</div>
                                                <div><span className="text-zinc-500">Runtime:</span> { agent.metadata.runtimeCompatibility }</div>
                                                <div><span className="text-zinc-500">Priority:</span> { agent.metadata.priority }</div>
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
                                            Success: { agent.runtime.successCount } · Error: { agent.runtime.errorCount } · Last task: { agent.runtime.lastTask ?? "-" }
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
