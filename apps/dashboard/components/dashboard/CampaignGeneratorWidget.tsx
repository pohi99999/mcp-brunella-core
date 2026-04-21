import { useMemo, useState, useEffect } from "react";
import { BarChart3, CheckCircle2, History, Loader2, Megaphone, MessageCircle, MonitorPlay, Send, Target, Video, Zap } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { ScrollArea } from "../ui/scroll-area";
import { Textarea } from "../ui/textarea";

interface CampaignJob {
    id: string;
    query: string;
    created_at: string;
    status: "running" | "completed" | "queued";
    metadata?: string;
    results_json?: string;
}

const SAMPLE_JOBS: CampaignJob[] = [
    { id: "campaign-1", query: "Prémium kávégép irodáknak", created_at: new Date().toISOString(), status: "completed", results_json: JSON.stringify({ actionPlan: "B2B kampány, landing page, demo ajánlat.", socialPosts: "LinkedIn és X posztok.", videoScript: "60 másodperces reklámspot." }) },
    { id: "campaign-2", query: "AI dashboard redesign", created_at: new Date().toISOString(), status: "running", metadata: "Marketing anyagok és stúdió projekt generálása..." },
];

export function CampaignGeneratorWidget() {
    const [productInfo, setProductInfo] = useState("");
    const [jobs] = useState<CampaignJob[]>(SAMPLE_JOBS);
    const [isLoading] = useState(false);
    const [selectedJobId, setSelectedJobId] = useState<string | null>(null);

    useEffect(() => {
        setSelectedJobId((current) => current ?? jobs[0]?.id ?? null);
    }, [jobs]);

    const campaignJobs = useMemo(() => jobs, [jobs]);
    const activeJob = campaignJobs.find((job) => job.id === selectedJobId) ?? campaignJobs[0];
    const data = activeJob?.results_json ? JSON.parse(activeJob.results_json) : null;

    function handleStartCampaign() {
        if (!productInfo.trim()) {
            toast.error("Kérlek add meg a termék vagy szolgáltatás leírását!");
            return;
        }
        toast.info("Kampány tervezés elindítva... Ágensek felébresztve.");
        setProductInfo("");
    }

    return (
        <Card className="min-h-[600px] w-full border-primary/20 bg-slate-950/70 shadow-xl shadow-black/20 backdrop-blur-xl">
            <CardHeader className="border-b border-white/[0.04] bg-white/[0.02] pb-3">
                <div className="flex items-center gap-3">
                    <div className="rounded-full bg-primary/10 p-2">
                        <Megaphone className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                        <CardTitle>Campaign Generator</CardTitle>
                        <CardDescription>Automatizált Marketing, Posztok & Weboldal Készítés</CardDescription>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="space-y-6 p-4">
                <div className="flex flex-col gap-2 lg:flex-row">
                    <Textarea
                        placeholder="Termék/szolgáltatás leírása, előnyök, célközönség..."
                        value={productInfo}
                        onChange={(event) => setProductInfo(event.target.value)}
                        className="min-h-[80px] flex-1 border-white/10 bg-white/[0.03]"
                    />
                    <Button onClick={handleStartCampaign} disabled={isLoading} className="min-w-[200px] font-bold text-white">
                        {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Zap className="mr-2 h-4 w-4" />}
                        Kampány Generálása
                    </Button>
                </div>

                <div className="grid gap-6 lg:grid-cols-4">
                    <div className="flex flex-col gap-4 lg:col-span-1">
                        <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                            <History className="h-3 w-3" /> Korábbi Kampányok
                        </h3>
                        <ScrollArea className="h-[450px]">
                            <div className="space-y-2 pr-2">
                                {campaignJobs.map((job) => (
                                    <button
                                        key={job.id}
                                        onClick={() => setSelectedJobId(job.id)}
                                        className={`w-full rounded-xl border p-3 text-left transition ${selectedJobId === job.id ? "border-primary/30 bg-primary/10" : "border-transparent bg-white/[0.03] hover:border-primary/20"}`}
                                    >
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

                    <div className="lg:col-span-3">
                        {activeJob ? (
                            <div className="space-y-6">
                                {activeJob.status === "running" ? (
                                    <div className="flex flex-col items-center justify-center py-20 text-slate-500">
                                        <Loader2 className="mb-4 h-10 w-10 animate-spin text-primary" />
                                        <p className="max-w-[250px] text-center text-xs text-slate-400">{activeJob.metadata ?? "Marketing anyagok és stúdió projekt generálása..."}</p>
                                    </div>
                                ) : data ? (
                                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                        <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                                            <h4 className="mb-3 flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-primary">
                                                <Target className="h-3 w-3" /> Akcióterv
                                            </h4>
                                            <p className="text-xs leading-relaxed text-slate-300">{data.actionPlan}</p>
                                        </section>
                                        <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                                            <h4 className="mb-3 flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-blue-300">
                                                <MessageCircle className="h-3 w-3" /> Közösségi Média
                                            </h4>
                                            <p className="text-xs leading-relaxed text-slate-300">{data.socialPosts}</p>
                                        </section>
                                        <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                                            <h4 className="mb-3 flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-violet-300">
                                                <Video className="h-3 w-3" /> Videó Forgatókönyv
                                            </h4>
                                            <p className="text-xs leading-relaxed text-slate-300">{data.videoScript}</p>
                                        </section>
                                        <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                                            <h4 className="mb-3 flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-emerald-300">
                                                <MonitorPlay className="h-3 w-3" /> Kampány állapot
                                            </h4>
                                            <p className="text-xs leading-relaxed text-slate-300">A jelenlegi dashboard változat statikus preview módban fut.</p>
                                        </section>
                                    </div>
                                ) : null}
                            </div>
                        ) : null}
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
