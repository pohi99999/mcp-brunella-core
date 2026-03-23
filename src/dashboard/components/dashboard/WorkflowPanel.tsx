import { useCallback, useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Play, RefreshCw, Workflow } from "lucide-react";
import {
    getWorkflowStatuses,
    previewWorkflow,
    runWorkflow,
    type WorkflowExecutionResult,
    type WorkflowPreviewResponse,
    type WorkflowStatusItem,
} from "@/lib/apiService";

function statusColor(status: string): string {
    switch (status) {
        case "success":
            return "text-green-500";
        case "error":
            return "text-red-500";
        case "partial":
        case "timeout":
        case "budget_exceeded":
            return "text-yellow-500";
        default:
            return "text-blue-500";
    }
}

export function WorkflowPanel() {
    const [task, setTask] = useState("Készíts specifikációt, majd implementáld a megoldást párhuzamosan a tesztekkel, végül validáld az eredményt.");
    const [defaultAgent, setDefaultAgent] = useState("Developer");
    const [preview, setPreview] = useState<WorkflowPreviewResponse["workflow"] | null>(null);
    const [result, setResult] = useState<WorkflowExecutionResult | null>(null);
    const [statuses, setStatuses] = useState<WorkflowStatusItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState("");

    const refreshStatuses = useCallback(async () => {
        try {
            setStatuses(await getWorkflowStatuses());
        } catch (error) {
            setMessage(error instanceof Error ? error.message : String(error));
        }
    }, []);

    useEffect(() => {
        void refreshStatuses();
    }, [refreshStatuses]);

    const handlePreview = useCallback(async () => {
        setLoading(true);
        try {
            const response = await previewWorkflow(task, defaultAgent);
            setPreview(response.workflow);
            setResult(null);
            setMessage(`Workflow preview elkészült (${response.workflow.nodes.length} node).`);
        } catch (error) {
            setMessage(error instanceof Error ? error.message : String(error));
        } finally {
            setLoading(false);
        }
    }, [defaultAgent, task]);

    const handleRun = useCallback(async () => {
        setLoading(true);
        try {
            const response = await runWorkflow({ task, workflow: preview ?? undefined, defaultAgent });
            setPreview(response.workflow);
            setResult(response.result);
            setMessage(`Workflow futás kész: ${response.result.status}`);
            await refreshStatuses();
        } catch (error) {
            setMessage(error instanceof Error ? error.message : String(error));
        } finally {
            setLoading(false);
        }
    }, [defaultAgent, preview, refreshStatuses, task]);

    const workflowNodes = useMemo(() => preview?.nodes ?? [], [preview]);

    return (
        <div className="space-y-4 p-4">
            <div className="flex items-center justify-between gap-3">
                <h2 className="flex items-center gap-2 text-xl font-bold">
                    <Workflow className="h-5 w-5 text-violet-500" /> DAG Orchestráció
                </h2>
                <button onClick={ () => void refreshStatuses() } className="rounded-md p-2 hover:bg-accent" title="Státusz frissítése">
                    <RefreshCw className="h-4 w-4" />
                </button>
            </div>

            { message ? <div className="rounded-md border border-violet-500/30 bg-violet-500/10 px-3 py-2 text-sm">{ message }</div> : null }

            <Card>
                <CardHeader><CardTitle className="text-sm">Workflow generálás és futtatás</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                    <textarea
                        className="min-h-32 w-full rounded-md border bg-background p-3 text-sm"
                        value={ task }
                        onChange={ (event) => setTask(event.target.value) }
                    />
                    <div className="flex flex-wrap gap-3">
                        <input
                            className="rounded-md border bg-background px-3 py-2 text-sm"
                            value={ defaultAgent }
                            onChange={ (event) => setDefaultAgent(event.target.value) }
                            placeholder="Default agent"
                        />
                        <button onClick={ () => void handlePreview() } disabled={ loading } className="rounded-md border px-3 py-2 text-sm hover:bg-accent disabled:opacity-50">
                            Preview DAG
                        </button>
                        <button onClick={ () => void handleRun() } disabled={ loading } className="rounded-md border px-3 py-2 text-sm hover:bg-accent disabled:opacity-50">
                            <Play className="mr-2 inline h-4 w-4" /> Futtatás
                        </button>
                    </div>
                </CardContent>
            </Card>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-[2fr,1fr]">
                <Card>
                    <CardHeader><CardTitle className="text-sm">DAG vizualizáció</CardTitle></CardHeader>
                    <CardContent>
                        { workflowNodes.length === 0 ? (
                            <p className="text-sm text-muted-foreground">Előbb generálj preview workflow-t.</p>
                        ) : (
                            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                                { workflowNodes.map((node) => {
                                    const nodeResult = result?.nodeResults[node.id];
                                    return (
                                        <div key={ node.id } className="rounded-md border p-3">
                                            <div className="flex items-center justify-between gap-2">
                                                <div className="font-semibold">{ node.id }</div>
                                                <div className={ `text-xs font-medium ${statusColor(nodeResult?.status ?? "pending")}` }>
                                                    { nodeResult?.status ?? "pending" }
                                                </div>
                                            </div>
                                            <div className="mt-2 text-sm">{ node.label }</div>
                                            <div className="mt-2 text-xs text-muted-foreground">Agent: { node.agentName ?? "auto" }</div>
                                            <div className="mt-2 text-xs text-muted-foreground">Depends on: { (node.dependsOn ?? []).length > 0 ? (node.dependsOn ?? []).join(", ") : "—" }</div>
                                            { nodeResult?.error ? <div className="mt-2 text-xs text-red-500">{ nodeResult.error }</div> : null }
                                        </div>
                                    );
                                }) }
                            </div>
                        ) }
                    </CardContent>
                </Card>

                <div className="space-y-4">
                    <Card>
                        <CardHeader><CardTitle className="text-sm">Legutóbbi workflow futások</CardTitle></CardHeader>
                        <CardContent>
                            { statuses.length === 0 ? (
                                <p className="text-sm text-muted-foreground">Még nincs workflow futás.</p>
                            ) : (
                                <div className="space-y-2">
                                    { statuses.map((status) => (
                                        <div key={ `${status.id}-${status.startedAt}` } className="rounded-md border p-3 text-sm">
                                            <div className="flex items-center justify-between gap-2">
                                                <span className="font-medium">{ status.name }</span>
                                                <span className={ statusColor(status.status) }>{ status.status }</span>
                                            </div>
                                            <div className="mt-1 text-xs text-muted-foreground">{ status.nodeCount } node · { status.durationMs ?? 0 } ms</div>
                                            <div className="mt-1 text-xs text-muted-foreground">{ new Date(status.startedAt).toLocaleString() }</div>
                                        </div>
                                    )) }
                                </div>
                            ) }
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader><CardTitle className="text-sm">Legutóbbi eredmény</CardTitle></CardHeader>
                        <CardContent className="space-y-2 text-sm">
                            { result ? (
                                <>
                                    <div className="flex justify-between"><span className="text-muted-foreground">Status</span><span className={ statusColor(result.status) }>{ result.status }</span></div>
                                    <div className="flex justify-between"><span className="text-muted-foreground">Duration</span><span>{ result.durationMs } ms</span></div>
                                    <div className="flex justify-between"><span className="text-muted-foreground">Tokens</span><span>{ result.totalTokens }</span></div>
                                    <div className="flex justify-between"><span className="text-muted-foreground">Cost</span><span>${ result.totalCostUSD.toFixed(4) }</span></div>
                                    <div className="text-xs text-muted-foreground">Warnings: { result.warnings.length > 0 ? result.warnings.join(" | ") : "nincs" }</div>
                                </>
                            ) : (
                                <p className="text-sm text-muted-foreground">Még nincs futtatási eredmény.</p>
                            ) }
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
