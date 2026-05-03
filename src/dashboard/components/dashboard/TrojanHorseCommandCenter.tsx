import { useMemo, useState } from "react";
import { AlertCircle, CheckCircle2, Clock, ExternalLink, Globe, Loader2, Send, ShieldAlert, Target } from "lucide-react";
import { toast } from "sonner";
import { useSocket } from "../../context/SocketContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Progress } from "../ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { Badge } from "../ui/badge";

interface Agency {
    id: number;
    name: string;
    web: string;
    email: string;
    status: "resend" | "bounce" | "unknown" | "pending" | "sent" | "responded";
    wave: 1 | 2;
}

const WAVE1_AGENCIES: Agency[] = [
    { id: 1, name: "Marketing21", web: "marketing21.hu", email: "❌ CONTACT FORM ONLY", status: "bounce", wave: 1 },
    { id: 2, name: "DLX MEDIA", web: "dlxmedia.hu", email: "❌ CONTACT FORM ONLY", status: "bounce", wave: 1 },
    { id: 3, name: "Chiro Marketing", web: "chiro.hu", email: "info@chiro.hu", status: "resend", wave: 1 },
    { id: 4, name: "Meraki Marketing", web: "meraki.hu", email: "ugyfelszolgalat@meraki.hu", status: "bounce", wave: 1 },
    { id: 5, name: "WOIMS", web: "ertekesitesfejlesztes.hu", email: "hello@woims.de", status: "unknown", wave: 1 },
    { id: 6, name: "SOLID Agency", web: "solidagency.hu", email: "hello@solidagency.hu", status: "resend", wave: 1 },
    { id: 7, name: "Online Ügynökség", web: "onlineugynokseg.hu", email: "info@onlineugynokseg.hu", status: "resend", wave: 1 },
    { id: 8, name: "BDA", web: "bda.hu", email: "info@bda.hu", status: "resend", wave: 1 },
    { id: 9, name: "Vantgard Digital", web: "vantgarddigital.hu", email: "hello@vantgarddigital.hu", status: "resend", wave: 1 },
    { id: 10, name: "Aida Media", web: "aidamedia.hu", email: "info@aidamedia.hu", status: "resend", wave: 1 },
];

const WAVE2_AGENCIES: Agency[] = [
    { id: 11, name: "Webdesign.hu", web: "webdesign.hu", email: "info@webdesign.hu", status: "pending", wave: 2 },
    { id: 12, name: "2B Digital", web: "2bdigital.hu", email: "hello@2bdigital.hu", status: "pending", wave: 2 },
    { id: 13, name: "WEBerfolg", web: "weberfolg.hu", email: "info@weberfolg.hu", status: "pending", wave: 2 },
    { id: 14, name: "Netfoglalo", web: "netfoglalo.hu", email: "info@netfoglalo.hu", status: "pending", wave: 2 },
    { id: 15, name: "Progresszív Studio", web: "progressziv.hu", email: "info@progressziv.hu", status: "pending", wave: 2 },
    { id: 16, name: "Ranking.hu", web: "ranking.hu", email: "hello@ranking.hu", status: "pending", wave: 2 },
    { id: 17, name: "Growww Digital", web: "growww.hu", email: "hello@growww.hu", status: "pending", wave: 2 },
    { id: 18, name: "Adsolutions", web: "adsolutions.hu", email: "info@adsolutions.hu", status: "pending", wave: 2 },
    { id: 19, name: "Klixio", web: "klixio.hu", email: "hello@klixio.hu", status: "pending", wave: 2 },
    { id: 20, name: "iSEO", web: "iseo.hu", email: "info@iseo.hu", status: "pending", wave: 2 },
    { id: 21, name: "PR Herald", web: "prherald.hu", email: "info@prherald.hu", status: "pending", wave: 2 },
    { id: 22, name: "Kreativ PR", web: "kreativpr.hu", email: "hello@kreativpr.hu", status: "pending", wave: 2 },
    { id: 23, name: "Meditor", web: "meditor.hu", email: "info@meditor.hu", status: "pending", wave: 2 },
    { id: 24, name: "BIG", web: "big.hu", email: "info@big.hu", status: "pending", wave: 2 },
    { id: 25, name: "Pulse Comm.", web: "pulse.hu", email: "hello@pulse.hu", status: "pending", wave: 2 },
];

const ALL_AGENCIES = [...WAVE1_AGENCIES, ...WAVE2_AGENCIES];

const STATUS_META: Record<Agency["status"], { label: string; className: string; icon: typeof Send }> = {
    resend: { label: "Újraküldendő", className: "border-blue-500/30 bg-blue-500/10 text-blue-300", icon: Send },
    bounce: { label: "Bounce", className: "border-red-500/30 bg-red-500/10 text-red-300", icon: AlertCircle },
    unknown: { label: "Kérdéses", className: "border-amber-500/30 bg-amber-500/10 text-amber-300", icon: Clock },
    pending: { label: "Várakozik", className: "border-slate-500/30 bg-slate-500/10 text-slate-300", icon: Clock },
    sent: { label: "Elküldve", className: "border-violet-500/30 bg-violet-500/10 text-violet-300", icon: Send },
    responded: { label: "Válaszolt", className: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300", icon: CheckCircle2 },
};

export function TrojanHorseCommandCenter() {
    const { socket } = useSocket();
    const [industry, setIndustry] = useState("");
    const [targetUrl, setTargetUrl] = useState("");
    const [isRunning, setIsRunning] = useState(false);
    const [step, setStep] = useState(0);
    const [activeWave, setActiveWave] = useState<0 | 1 | 2>(0);

    const filteredAgencies = useMemo(
        () => (activeWave === 0 ? ALL_AGENCIES : ALL_AGENCIES.filter((agency) => agency.wave === activeWave)),
        [activeWave],
    );

    const stats = useMemo(() => ({
        verified: ALL_AGENCIES.filter((agency) => agency.status === "resend").length,
        bounce: ALL_AGENCIES.filter((agency) => agency.status === "bounce").length,
        pending: ALL_AGENCIES.filter((agency) => agency.status === "pending").length,
        total: ALL_AGENCIES.length,
    }), []);

    const progress = step === 1 ? 25 : step === 2 ? 50 : step === 3 ? 75 : step === 4 ? 100 : 0;

    function handleStartCampaign() {
        if (!industry || !targetUrl) {
            toast.error("Kérlek válassz iparágat és adj meg egy cél URL-t!");
            return;
        }

        setIsRunning(true);
        setStep(1);
        toast.info("Trójai Faló kampány elindítva...");

        window.setTimeout(() => setStep(2), 2000);
        window.setTimeout(() => setStep(3), 4000);
        window.setTimeout(() => {
            setStep(4);
            setIsRunning(false);
            toast.success("A személyre szabott demo elkészült!");
        }, 7000);

        socket?.emit("agent:execute", {
            agent: "orchestrator",
            task: `Indíts trójai faló kampányt a ${targetUrl} cégnek a ${industry} szektorban.`,
        });
    }

    return (
        <div className="space-y-4 md:space-y-6 pb-20 md:pb-0">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 md:gap-4">
                {[
                    { label: "Verifikált", value: stats.verified, tone: "text-cyan-300" },
                    { label: "Bounce", value: stats.bounce, tone: "text-rose-300" },
                    { label: "Wave 2", value: stats.pending, tone: "text-slate-300" },
                    { label: "Összes Cél", value: stats.total, tone: "text-emerald-300" },
                ].map((item) => (
                    <Card key={item.label} className="border-white/10 bg-slate-950/70 shadow-lg shadow-black/20 backdrop-blur-xl">
                        <CardHeader className="p-3 md:pb-2">
                            <CardDescription className="text-[10px] md:text-xs uppercase tracking-[0.22em] text-slate-400">{item.label}</CardDescription>
                            <CardTitle className={`text-xl md:text-2xl font-bold ${item.tone}`}>{item.value}</CardTitle>
                        </CardHeader>
                    </Card>
                ))}
            </div>

            <Card className="border-primary/20 bg-slate-950/70 shadow-xl shadow-black/20 backdrop-blur-xl">
                <CardHeader className="border-b border-white/5 p-4 md:p-6">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                        <div className="flex items-center gap-3">
                            <div className="rounded-full border border-primary/20 bg-primary/10 p-2 text-primary">
                                <ShieldAlert className="h-5 w-5" />
                            </div>
                            <div>
                                <CardTitle className="text-base md:text-xl">Trójai Faló — Outreach Tracker</CardTitle>
                                <CardDescription className="text-xs md:text-sm text-slate-400">
                                    Verifikálva: 2026-03-04 | Wave 1: 10 cég | Wave 2: 15 cég
                                </CardDescription>
                            </div>
                        </div>

                        <div className="flex flex-wrap gap-2">
                            <Button variant={activeWave === 0 ? "default" : "outline"} size="sm" onClick={() => setActiveWave(0)}>Mind ({ALL_AGENCIES.length})</Button>
                            <Button variant={activeWave === 1 ? "default" : "outline"} size="sm" onClick={() => setActiveWave(1)}>Wave 1 (10)</Button>
                            <Button variant={activeWave === 2 ? "default" : "outline"} size="sm" onClick={() => setActiveWave(2)}>Wave 2 (15)</Button>
                        </div>
                    </div>
                </CardHeader>

                <CardContent className="space-y-6 p-4 md:p-6">
                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                        <div className="space-y-2">
                            <label className="text-xs uppercase tracking-[0.22em] text-slate-400">Cél Iparág</label>
                            <Select onValueChange={setIndustry} value={industry}>
                                <SelectTrigger className="h-10 border-white/10 bg-slate-950/60">
                                    <SelectValue placeholder="Válassz iparágat..." />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="clinic">Magánklinika / Egészségügy</SelectItem>
                                    <SelectItem value="real-estate">Ingatlanközvetítő</SelectItem>
                                    <SelectItem value="accounting">Könyvelőiroda</SelectItem>
                                    <SelectItem value="ecommerce">B2B E-kereskedelem</SelectItem>
                                    <SelectItem value="other">Egyéb KKV</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2 xl:col-span-2">
                            <label className="text-xs uppercase tracking-[0.22em] text-slate-400">Célcég URL / Domain</label>
                            <div className="flex flex-col gap-2 sm:flex-row">
                                <Input
                                    placeholder="pl. pelda-ceg.hu"
                                    value={targetUrl}
                                    onChange={(event) => setTargetUrl(event.target.value)}
                                    className="h-10 border-white/10 bg-slate-950/60"
                                />
                                <Button onClick={handleStartCampaign} disabled={isRunning} className="h-10 whitespace-nowrap">
                                    {isRunning ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Target className="mr-2 h-4 w-4" />}
                                    Indítás
                                </Button>
                            </div>
                        </div>
                    </div>

                    {(isRunning || step > 0) && (
                        <div className="space-y-4 rounded-2xl border border-primary/10 bg-primary/5 p-4 md:p-6">
                            <div className="flex items-center justify-between gap-3 text-xs md:text-sm">
                                <span className="font-medium text-slate-200">
                                    {step < 4 ? "Kampány fut" : "Kampány kész"}
                                </span>
                                <span className="font-mono text-slate-400">{progress}%</span>
                            </div>
                            <Progress value={progress} className="h-2" />
                        </div>
                    )}

                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                        {filteredAgencies.map((agency) => {
                            const meta = STATUS_META[agency.status];
                            const Icon = meta.icon;
                            return (
                                <article key={agency.id} className="rounded-2xl border border-white/10 bg-slate-950/60 p-4 shadow-lg shadow-black/10 transition hover:-translate-y-0.5 hover:border-primary/30 hover:bg-slate-950/80">
                                    <div className="flex items-start justify-between gap-3">
                                        <div>
                                            <p className="text-xs uppercase tracking-[0.22em] text-slate-500">#{agency.id}</p>
                                            <h3 className="mt-2 text-base font-semibold text-white">{agency.name}</h3>
                                        </div>
                                        <Badge className={meta.className} variant="secondary">
                                            <Icon className="mr-1 h-3 w-3" />
                                            {meta.label}
                                        </Badge>
                                    </div>

                                    <div className="mt-4 space-y-2 text-sm text-slate-300">
                                        <a href={`https://${agency.web}`} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-cyan-300 transition hover:text-cyan-200">
                                            <Globe className="h-3.5 w-3.5" />
                                            {agency.web}
                                            <ExternalLink className="h-3 w-3" />
                                        </a>
                                        <div className="flex items-center gap-2 text-slate-400">
                                            <Send className="h-3.5 w-3.5" />
                                            {agency.email}
                                        </div>
                                    </div>
                                </article>
                            );
                        })}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
