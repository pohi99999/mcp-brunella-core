import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Database, Download, RefreshCw, Trash2, Upload } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
    exportStructuredMemory,
    getStructuredMemoryStats,
    purgeStructuredMemory,
    syncGoldenMirror,
    type StructuredMemoryStatsResponse,
} from "@/lib/apiService";

function formatPct(value: number): string {
    return `${(value * 100).toFixed(1)}%`;
}

export function MemoryPanel() {
    const [stats, setStats] = useState<StructuredMemoryStatsResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [busyAction, setBusyAction] = useState<string | null>(null);
    const [message, setMessage] = useState<string>("");

    const load = useCallback(async (manualRefresh = false) => {
        if (manualRefresh) setIsRefreshing(true);
        else setLoading(true);
        try {
            const response = await getStructuredMemoryStats();
            setStats(response);
        } catch (error) {
            setMessage(error instanceof Error ? error.message : String(error));
        } finally {
            setLoading(false);
            setIsRefreshing(false);
        }
    }, []);

    useEffect(() => {
        void load(false);
    }, [load]);

    const handlePurge = useCallback(async () => {
        setBusyAction("purge");
        try {
            const result = await purgeStructuredMemory(0.5);
            setMessage(`Törölt elemek: ${result.removed}`);
            await load();
        } catch (error) {
            setMessage(error instanceof Error ? error.message : String(error));
        } finally {
            setBusyAction(null);
        }
    }, [load]);

    const handleExport = useCallback(async () => {
        setBusyAction("export");
        try {
            const content = await exportStructuredMemory("jsonl");
            const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.download = `structured-memory-${Date.now()}.jsonl`;
            link.click();
            URL.revokeObjectURL(url);
            setMessage("Structured memory export elkészült.");
        } catch (error) {
            setMessage(error instanceof Error ? error.message : String(error));
        } finally {
            setBusyAction(null);
        }
    }, []);

    const handleSync = useCallback(async () => {
        setBusyAction("sync");
        try {
            const result = await syncGoldenMirror();
            setMessage(`Golden mirror sync: ${result.synced} synced / ${result.failed} failed`);
            await load();
        } catch (error) {
            setMessage(error instanceof Error ? error.message : String(error));
        } finally {
            setBusyAction(null);
        }
    }, [load]);

    if (loading) {
        return <div className="p-4 text-zinc-500">Structured memory betöltése...</div>;
    }

    return (
        <div className="space-y-4 p-4">
            <div className="flex items-center justify-between gap-3">
                <h2 className="flex items-center gap-2 text-xl font-bold">
                    <Database className="h-5 w-5 text-cyan-500" />
                    Agent Memória & Tanulás
                </h2>
                <div className="flex items-center gap-2">
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <button
                                onClick={ () => void load(true) }
                                disabled={ isRefreshing }
                                className="rounded-md p-2 hover:bg-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50"
                                aria-label="Adatok frissítése"
                            >
                                <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                            </button>
                        </TooltipTrigger>
                        <TooltipContent>
                            <p>Frissítés</p>
                        </TooltipContent>
                    </Tooltip>
                    <button onClick={ () => void handlePurge() } disabled={ busyAction !== null } className="rounded-md border px-3 py-2 text-sm hover:bg-accent disabled:opacity-50 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
                        <Trash2 className="mr-2 inline h-4 w-4" /> Purge
                    </button>
                    <button onClick={ () => void handleExport() } disabled={ busyAction !== null } className="rounded-md border px-3 py-2 text-sm hover:bg-accent disabled:opacity-50 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
                        <Download className="mr-2 inline h-4 w-4" /> Export
                    </button>
                    <button onClick={ () => void handleSync() } disabled={ busyAction !== null } className="rounded-md border px-3 py-2 text-sm hover:bg-accent disabled:opacity-50 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
                        <Upload className="mr-2 inline h-4 w-4" /> Sync D1
                    </button>
                </div>
            </div>

            { message ? <div className="rounded-md border border-cyan-500/30 bg-cyan-500/10 px-3 py-2 text-sm">{ message }</div> : null }

            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <Card>
                    <CardHeader className="pb-2"><CardTitle className="text-sm">Memória sorok</CardTitle></CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold">{ stats?.summary.totalEntries ?? 0 }</div>
                        <p className="text-xs text-zinc-500">Aktív structured memory bejegyzések</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2"><CardTitle className="text-sm">Átlag confidence</CardTitle></CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold">{ (stats?.summary.avgConfidence ?? 0).toFixed(2) }</div>
                        <p className="text-xs text-zinc-500">Mentett eredmények minősége</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2"><CardTitle className="text-sm">Pattern reuse</CardTitle></CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold">{ stats?.summary.totalReuses ?? 0 }</div>
                        <p className="text-xs text-zinc-500">Összes cache shortcut</p>
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader><CardTitle className="text-sm">Per-agent memória statisztika</CardTitle></CardHeader>
                <CardContent>
                    <div className="space-y-3">
                        { (stats?.agents ?? []).length === 0 ? (
                            <p className="text-sm text-zinc-500">Még nincs structured memory adat.</p>
                        ) : (
                            stats?.agents.map((agent) => (
                                <div key={ agent.agentName } className="rounded-md border p-3">
                                    <div className="flex flex-wrap items-center justify-between gap-3">
                                        <div>
                                            <div className="font-semibold">{ agent.agentName }</div>
                                            <div className="text-xs text-zinc-500">Utolsó frissítés: { agent.lastUpdatedAt ? new Date(agent.lastUpdatedAt).toLocaleString() : "—" }</div>
                                        </div>
                                        <div className="grid grid-cols-2 gap-4 text-sm md:grid-cols-4">
                                            <div><span className="text-zinc-500">Entries:</span> { agent.totalEntries }</div>
                                            <div><span className="text-zinc-500">Avg conf:</span> { agent.avgConfidence.toFixed(2) }</div>
                                            <div><span className="text-zinc-500">Hits:</span> { agent.cache.hits }</div>
                                            <div><span className="text-zinc-500">Hit rate:</span> { formatPct(agent.cache.hitRate) }</div>
                                        </div>
                                    </div>
                                </div>
                            ))
                        ) }
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader><CardTitle className="text-sm">Legutóbbi pattern reuse találatok</CardTitle></CardHeader>
                <CardContent>
                    { (stats?.recentReuses ?? []).length === 0 ? (
                        <p className="text-sm text-zinc-500">Még nincs cache hit.</p>
                    ) : (
                        <div className="space-y-2">
                            { stats?.recentReuses.map((item) => (
                                <div key={ item.id } className="rounded-md border p-3 text-sm">
                                    <div className="flex items-center justify-between gap-3">
                                        <div className="font-medium">{ item.agentName }</div>
                                        <div className="text-xs text-zinc-500">reuse #{ item.reuseCount } · conf { item.confidence.toFixed(2) }</div>
                                    </div>
                                    <div className="mt-1 text-zinc-500">{ item.rawTask }</div>
                                    <div className="mt-1 text-xs text-zinc-500">{ item.lastReusedAt ? new Date(item.lastReusedAt).toLocaleString() : "—" }</div>
                                </div>
                            )) }
                        </div>
                    ) }
                </CardContent>
            </Card>
        </div>
    );
}
