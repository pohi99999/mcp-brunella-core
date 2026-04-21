import { useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, History, Loader2, Scale, Search, ShieldAlert } from "lucide-react";
import { format } from "date-fns";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { ScrollArea } from "../ui/scroll-area";
import { Input } from "../ui/input";

interface LawChange {
    title: string;
    category: string;
    date: string;
    relevanceScore: number;
    summary: string;
    businessImpact: string;
}

const SAMPLE_CHANGES: LawChange[] = [
    { title: "KATA változás összefoglaló", category: "adózás", date: "2026-03-04", relevanceScore: 91, summary: "Emlékeztető a kötelezettségekről.", businessImpact: "Revizió a számlázási folyamatokra." },
    { title: "Minimálbér emelés", category: "munkaügy", date: "2026-03-03", relevanceScore: 78, summary: "Jelentés a bérszintek módosításáról.", businessImpact: "Kalkuláció frissítése szükséges." },
];

export function LawDetectiveWidget() {
    const [keywords, setKeywords] = useState("KKV adózás és munkaügy");
    const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
    const lawJobs = useMemo(() => [
        { id: "law-1", query: "KATA, ÁFA", created_at: new Date().toISOString(), status: "completed", results: SAMPLE_CHANGES },
        { id: "law-2", query: "munkaügy, minimálbér", created_at: new Date().toISOString(), status: "running", results: [] as LawChange[] },
    ], []);
    const activeJob = lawJobs.find((job) => job.id === selectedJobId) ?? lawJobs[0];
    const changes = activeJob?.results ?? [];

    return (
        <Card className="w-full border-blue-500/20 bg-slate-950/70 shadow-xl shadow-black/20 backdrop-blur-xl">
            <CardHeader className="border-b border-white/[0.04]">
                <div className="flex items-center gap-3">
                    <div className="rounded-full bg-blue-500/10 p-2"><Scale className="h-5 w-5 text-blue-500" /></div>
                    <div>
                        <CardTitle>Law Detective</CardTitle>
                        <CardDescription>Jogszabály-monitoring és automatikus hatásvizsgálat</CardDescription>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="p-4">
                <div className="mb-6 flex gap-2">
                    <Input value={keywords} onChange={(e) => setKeywords(e.target.value)} className="h-12 border-blue-500/10 bg-white/[0.03]" />
                    <Button className="h-12 min-w-[160px] bg-blue-600 text-white">
                        <Search className="mr-2 h-4 w-4" /> Figyelés
                    </Button>
                </div>
                <div className="grid gap-6 lg:grid-cols-3">
                    <div className="lg:col-span-1 flex flex-col gap-4 pr-4">
                        <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-400"><History className="h-3 w-3" /> Utolsó Vizsgálatok</h3>
                        <ScrollArea className="h-[400px]">
                            <div className="space-y-2 pr-2">
                                {lawJobs.map((job) => (
                                    <button key={job.id} onClick={() => setSelectedJobId(job.id)} className="w-full rounded-xl border border-white/10 bg-white/[0.03] p-3 text-left">
                                        <div className="text-[10px] font-bold uppercase tracking-widest text-white truncate">{job.query}</div>
                                        <div className="mt-1 flex items-center justify-between text-[9px] font-mono text-slate-500">
                                            {format(new Date(job.created_at), "MM.dd HH:mm")}
                                            {job.status === "completed" && <CheckCircle2 className="h-3 w-3 text-blue-400" />}
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </ScrollArea>
                    </div>
                    <div className="lg:col-span-2 space-y-4">
                        <h3 className="flex items-center gap-2 text-sm font-bold"><ShieldAlert className="h-4 w-4 text-blue-400" /> Releváns Változások</h3>
                        {activeJob.status === "running" ? (
                            <div className="flex flex-col items-center justify-center py-20 text-slate-500">
                                <Loader2 className="mb-4 h-10 w-10 animate-spin text-blue-500" />
                                <p className="text-xs text-slate-400">Magyar Közlöny PDF-ek elemzése...</p>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {changes.map((law) => (
                                    <article key={law.title} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                                        <div className="flex items-start justify-between gap-3">
                                            <h4 className="text-sm font-semibold text-white">{law.title}</h4>
                                            <Badge className="bg-blue-500/10 text-blue-300">{law.relevanceScore}%</Badge>
                                        </div>
                                        <p className="mt-2 text-xs text-slate-400">{law.category} • {law.date}</p>
                                        <p className="mt-3 text-xs text-slate-300 italic">{law.summary}</p>
                                        <div className="mt-4 rounded-xl border border-red-500/10 bg-red-500/5 p-3 text-xs text-slate-200">{law.businessImpact}</div>
                                    </article>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
