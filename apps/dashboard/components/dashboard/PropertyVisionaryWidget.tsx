import { useMemo, useState } from "react";
import { Building2, CheckCircle2, History, Loader2, Target } from "lucide-react";
import { format } from "date-fns";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { ScrollArea } from "../ui/scroll-area";
import { toast } from "sonner";

interface PropertyJob {
    id: string;
    query: string;
    created_at: string;
    status: "running" | "completed";
    results_json?: string;
}

const SAMPLE_JOBS: PropertyJob[] = [
    { id: "prop-1", query: "10ha iparterület M0 mellett", created_at: new Date().toISOString(), status: "completed", results_json: JSON.stringify({ buyerProfile: "Logisztikai és ipari beruházók.", marketNotes: "Erős kereslet a jól megközelíthető területekre." }) },
    { id: "prop-2", query: "lakópark projekt Budaörsön", created_at: new Date().toISOString(), status: "running" },
];

export function PropertyVisionaryWidget() {
    const [propertyInfo, setPropertyInfo] = useState("");
    const [jobs] = useState<PropertyJob[]>(SAMPLE_JOBS);
    const [selectedJobId, setSelectedJobId] = useState<string | null>(null);

    const propertyJobs = useMemo(() => jobs, [jobs]);
    const activeJob = propertyJobs.find((job) => job.id === selectedJobId) ?? propertyJobs[0];
    const data = activeJob?.results_json ? JSON.parse(activeJob.results_json) : null;

    function handleStartHunt() {
        if (!propertyInfo.trim()) {
            toast.error("Kérlek írd le az ingatlan vagy terület paramétereit!");
            return;
        }
        toast.info("Vevővadászat elindítva... Elemzem a piacot.");
        setPropertyInfo("");
    }

    return (
        <Card className="w-full border-primary/20 bg-slate-950/70 shadow-xl shadow-black/20 backdrop-blur-xl">
            <CardHeader className="border-b border-white/[0.04]">
                <div className="flex items-center gap-3">
                    <div className="rounded-full bg-primary/10 p-2"><Building2 className="h-5 w-5 text-primary" /></div>
                    <div>
                        <CardTitle>Property Visionary</CardTitle>
                        <CardDescription>Ingatlanstratégia & Intelligens Vevőfelkutatás</CardDescription>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="p-4">
                <div className="mb-6 flex gap-2">
                    <Input value={propertyInfo} onChange={(e) => setPropertyInfo(e.target.value)} placeholder="Ingatlan leírása..." className="h-12 border-white/10 bg-white/[0.03]" />
                    <Button onClick={handleStartHunt} className="h-12 min-w-[160px] bg-primary text-white font-bold">
                        <Target className="mr-2 h-4 w-4" /> Vevővadászat
                    </Button>
                </div>
                <div className="grid gap-6 lg:grid-cols-3">
                    <div className="flex flex-col gap-4 pr-4 lg:col-span-1">
                        <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-400"><History className="h-3 w-3" /> Ingatlan Portfólió</h3>
                        <ScrollArea className="h-[450px]">
                            <div className="space-y-2 pr-2">
                                {propertyJobs.map((job) => (
                                    <button key={job.id} onClick={() => setSelectedJobId(job.id)} className="w-full rounded-xl border border-white/10 bg-white/[0.03] p-3 text-left">
                                        <div className="text-xs font-bold text-white truncate">{job.query}</div>
                                        <div className="mt-1 flex items-center justify-between text-[9px] font-mono text-slate-500">
                                            {format(new Date(job.created_at), "MM.dd HH:mm")}
                                            {job.status === "completed" && <CheckCircle2 className="h-3 w-3 text-primary" />}
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </ScrollArea>
                    </div>
                    <div className="lg:col-span-2">
                        {activeJob?.status === "running" ? (
                            <div className="flex flex-col items-center justify-center py-20 text-slate-500">
                                <Loader2 className="mb-4 h-10 w-10 animate-spin text-primary" />
                                <p className="max-w-[200px] text-center text-xs">Ideális vevők felkutatása és megkeresési stratégia alkotása...</p>
                            </div>
                        ) : data ? (
                            <div className="space-y-4">
                                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                                    <p className="text-xs uppercase tracking-[0.2em] text-slate-400">MI Vevőprofil</p>
                                    <p className="mt-2 text-sm text-slate-200">{data.buyerProfile}</p>
                                </div>
                                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                                    <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Piaci megjegyzés</p>
                                    <p className="mt-2 text-sm text-slate-200">{data.marketNotes}</p>
                                </div>
                            </div>
                        ) : null}
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
