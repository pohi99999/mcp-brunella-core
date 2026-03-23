import React, { useState } from 'react';
import {
    ShieldAlert,
    Target,
    Zap,
    Mail,
    BarChart3,
    Globe,
    FileCode,
    CheckCircle2,
    Loader2,
    AlertCircle,
    Clock,
    Phone,
    ExternalLink,
    Send
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from '../ui/select';
import { Progress } from '../ui/progress';
import { toast } from 'sonner';
import { useSocket } from '../../context/SocketContext';
import { ScrollArea } from '../ui/scroll-area';

// === WAVE 1 — Verifikálva 2026-03-04 Playwright böngészővel ===
const WAVE1_AGENCIES = [
    { id: 1, name: 'Marketing21', web: 'marketing21.hu', email: '❌ CONTACT FORM ONLY', status: 'bounce', phone: '', note: 'Nincs email a weboldalon! Csak contact form.', wave: 1 },
    { id: 2, name: 'DLX MEDIA', web: 'dlxmedia.hu', email: '❌ CONTACT FORM ONLY', status: 'bounce', phone: '', note: '/kapcsolat oldal 404. Csak contact form.', wave: 1 },
    { id: 3, name: 'Chiro Marketing', web: 'chiro.hu', email: 'info@chiro.hu', status: 'resend', phone: '', note: '✅ Verifikált — contact form is van', wave: 1 },
    { id: 4, name: 'Meraki Marketing', web: 'meraki.hu', email: 'ugyfelszolgalat@meraki.hu', status: 'bounce', phone: '+36 20 402 2717', note: 'Régi info@ NEM LÉTEZIK! Javított cím.', wave: 1 },
    { id: 5, name: 'WOIMS', web: 'ertekesitesfejlesztes.hu', email: 'hello@woims.de', status: 'unknown', phone: '', note: '.de domain — SPF probléma lehetséges', wave: 1 },
    { id: 6, name: 'SOLID Agency', web: 'solidagency.hu', email: 'hello@solidagency.hu', status: 'resend', phone: '', note: '✅ Verifikált — mailto link', wave: 1 },
    { id: 7, name: 'Online Ügynökség', web: 'onlineugynokseg.hu', email: 'info@onlineugynokseg.hu', status: 'resend', phone: '+36 30 160 8488', note: '✅ Verifikált', wave: 1 },
    { id: 8, name: 'BDA', web: 'bda.hu', email: 'info@bda.hu', status: 'resend', phone: '+36 30 637 1229', note: '✅ Verifikált (3x az oldalon)', wave: 1 },
    { id: 9, name: 'Vantgard Digital', web: 'vantgarddigital.hu', email: 'hello@vantgarddigital.hu', status: 'resend', phone: '+36 1 618 0290', note: '✅ Verifikált', wave: 1 },
    { id: 10, name: 'Aida Media', web: 'aidamedia.hu', email: 'info@aidamedia.hu', status: 'resend', phone: '+36 30 247 3345', note: '✅ Verifikált', wave: 1 },
];

const WAVE2_AGENCIES = [
    { id: 11, name: 'Webdesign.hu', web: 'webdesign.hu', email: 'info@webdesign.hu', status: 'pending', phone: '', note: 'Wave 2 — Webdesign', wave: 2 },
    { id: 12, name: '2B Digital', web: '2bdigital.hu', email: 'hello@2bdigital.hu', status: 'pending', phone: '', note: 'Wave 2 — Webdesign', wave: 2 },
    { id: 13, name: 'WEBerfolg', web: 'weberfolg.hu', email: 'info@weberfolg.hu', status: 'pending', phone: '', note: 'Wave 2 — Webdesign', wave: 2 },
    { id: 14, name: 'Netfoglalo', web: 'netfoglalo.hu', email: 'info@netfoglalo.hu', status: 'pending', phone: '', note: 'Wave 2 — Webdesign', wave: 2 },
    { id: 15, name: 'Progresszív Studio', web: 'progressziv.hu', email: 'info@progressziv.hu', status: 'pending', phone: '', note: 'Wave 2 — Webdesign', wave: 2 },
    { id: 16, name: 'Ranking.hu', web: 'ranking.hu', email: 'hello@ranking.hu', status: 'pending', phone: '', note: 'Wave 2 — SEO/PPC', wave: 2 },
    { id: 17, name: 'Growww Digital', web: 'growww.hu', email: 'hello@growww.hu', status: 'pending', phone: '', note: 'Wave 2 — SEO/PPC', wave: 2 },
    { id: 18, name: 'Adsolutions', web: 'adsolutions.hu', email: 'info@adsolutions.hu', status: 'pending', phone: '', note: 'Wave 2 — SEO/PPC', wave: 2 },
    { id: 19, name: 'Klixio', web: 'klixio.hu', email: 'hello@klixio.hu', status: 'pending', phone: '', note: 'Wave 2 — SEO/PPC', wave: 2 },
    { id: 20, name: 'iSEO', web: 'iseo.hu', email: 'info@iseo.hu', status: 'pending', phone: '', note: 'Wave 2 — SEO/PPC', wave: 2 },
    { id: 21, name: 'PR Herald', web: 'prherald.hu', email: 'info@prherald.hu', status: 'pending', phone: '', note: 'Wave 2 — PR', wave: 2 },
    { id: 22, name: 'Kreativ PR', web: 'kreativpr.hu', email: 'hello@kreativpr.hu', status: 'pending', phone: '', note: 'Wave 2 — PR', wave: 2 },
    { id: 23, name: 'Meditor', web: 'meditor.hu', email: 'info@meditor.hu', status: 'pending', phone: '', note: 'Wave 2 — PR', wave: 2 },
    { id: 24, name: 'BIG', web: 'big.hu', email: 'info@big.hu', status: 'pending', phone: '', note: 'Wave 2 — PR', wave: 2 },
    { id: 25, name: 'Pulse Comm.', web: 'pulse.hu', email: 'hello@pulse.hu', status: 'pending', phone: '', note: 'Wave 2 — PR', wave: 2 },
];

const ALL_AGENCIES = [...WAVE1_AGENCIES, ...WAVE2_AGENCIES];

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
    resend: { label: 'Újraküldendő', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30', icon: <Send className="w-3 h-3" /> },
    bounce: { label: 'Bounce', color: 'bg-red-500/20 text-red-400 border-red-500/30', icon: <AlertCircle className="w-3 h-3" /> },
    unknown: { label: 'Kérdéses', color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30', icon: <Clock className="w-3 h-3" /> },
    pending: { label: 'Várakozik', color: 'bg-zinc-500/20 text-zinc-400 border-zinc-500/30', icon: <Clock className="w-3 h-3" /> },
    sent: { label: 'Elküldve', color: 'bg-purple-500/20 text-purple-400 border-purple-500/30', icon: <Mail className="w-3 h-3" /> },
    responded: { label: 'Válaszolt', color: 'bg-green-500/20 text-green-400 border-green-500/30', icon: <CheckCircle2 className="w-3 h-3" /> },
};

export function TrojanHorseCommandCenter() {
    const [industry, setIndustry] = useState('');
    const [targetUrl, setTargetUrl] = useState('');
    const [isRunning, setIsRunning] = useState(false);
    const [step, setStep] = useState(0); // 0: Idle, 1: Scraping, 2: Validating, 3: Generating Demo, 4: Ready
    const { socket } = useSocket();

    const handleStartCampaign = () => {
        if (!industry || !targetUrl) {
            toast.error("Kérlek válassz iparágat és adj meg egy cél URL-t!");
            return;
        }

        setIsRunning(true);
        setStep(1);
        toast.info("Trójai Faló kampány elindítva...");

        // Simulate the process steps for the UI
        setTimeout(() => setStep(2), 2000);
        setTimeout(() => setStep(3), 4000);
        setTimeout(() => {
            setStep(4);
            setIsRunning(false);
            toast.success("A személyre szabott demo elkészült!");
        }, 7000);

        socket?.emit('agent:execute', {
            agent: 'orchestrator',
            task: `Indíts trójai faló kampányt a ${targetUrl} cégnek a ${industry} szektorban.`
        });
    };

    const getProgressValue = () => {
        switch (step) {
            case 1: return 25;
            case 2: return 50;
            case 3: return 75;
            case 4: return 100;
            default: return 0;
        }
    };

    const getStepLabel = () => {
        switch (step) {
            case 1: return "Adatgyűjtés és elemzés...";
            case 2: return "E-mail validáció folyamatban...";
            case 3: return "Személyre szabott demo generálása...";
            case 4: return "Kampány előkészítve!";
            default: return "Készen áll az indításra";
        }
    };

    const verifiedCount = ALL_AGENCIES.filter(a => a.status === 'resend').length;
    const bounceCount = ALL_AGENCIES.filter(a => a.status === 'bounce').length;
    const pendingCount = ALL_AGENCIES.filter(a => a.status === 'pending').length;
    const [activeWave, setActiveWave] = useState<1 | 2 | 0>(0);

    const filteredAgencies = activeWave === 0 ? ALL_AGENCIES : ALL_AGENCIES.filter(a => a.wave === activeWave);

    return (
        <div className="space-y-4 md:space-y-6 pb-20 md:pb-0">
            {/* Stats Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 md:gap-4">
                <Card className="bg-blue-500/5 border-blue-500/20">
                    <CardHeader className="p-3 md:pb-2">
                        <CardDescription className="text-[10px] md:text-xs uppercase">Verifikált</CardDescription>
                        <CardTitle className="text-xl md:text-2xl font-bold text-blue-400">{verifiedCount}</CardTitle>
                    </CardHeader>
                </Card>
                <Card className="bg-red-500/5 border-red-500/20">
                    <CardHeader className="p-3 md:pb-2">
                        <CardDescription className="text-[10px] md:text-xs uppercase">Bounce</CardDescription>
                        <CardTitle className="text-xl md:text-2xl font-bold text-red-400">{bounceCount}</CardTitle>
                    </CardHeader>
                </Card>
                <Card className="bg-zinc-500/5 border-zinc-500/20">
                    <CardHeader className="p-3 md:pb-2">
                        <CardDescription className="text-[10px] md:text-xs uppercase">Wave 2 (Várakozik)</CardDescription>
                        <CardTitle className="text-xl md:text-2xl font-bold text-zinc-400">{pendingCount}</CardTitle>
                    </CardHeader>
                </Card>
                <Card className="bg-green-500/5 border-green-500/20">
                    <CardHeader className="p-3 md:pb-2">
                        <CardDescription className="text-[10px] md:text-xs uppercase">Összes Cél</CardDescription>
                        <CardTitle className="text-xl md:text-2xl font-bold text-green-400">{ALL_AGENCIES.length}</CardTitle>
                    </CardHeader>
                </Card>
            </div>

            {/* Outreach Tracker */}
            <Card className="shadow-xl border-primary/20">
                <CardHeader className="p-4 md:p-6 border-b border-white/[0.04]">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-primary/10 rounded-full text-primary shrink-0">
                                <ShieldAlert className="w-5 h-5 md:w-6 md:h-6" />
                            </div>
                            <div>
                                <CardTitle className="text-base md:text-xl">Trójai Faló — Outreach Tracker</CardTitle>
                                <CardDescription className="text-xs md:text-sm">Verifikálva: 2026-03-04 | Wave 1: 10 cég | Wave 2: 15 cég</CardDescription>
                            </div>
                        </div>
                        <div className="flex gap-1.5">
                            <Button variant={activeWave === 0 ? "default" : "outline"} size="sm" className="h-7 text-xs" onClick={() => setActiveWave(0)}>Mind ({ALL_AGENCIES.length})</Button>
                            <Button variant={activeWave === 1 ? "default" : "outline"} size="sm" className="h-7 text-xs" onClick={() => setActiveWave(1)}>Wave 1 (10)</Button>
                            <Button variant={activeWave === 2 ? "default" : "outline"} size="sm" className="h-7 text-xs" onClick={() => setActiveWave(2)}>Wave 2 (15)</Button>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <ScrollArea className="h-[500px]">
                        <table className="w-full text-xs">
                            <thead className="sticky top-0 bg-secondary/80 backdrop-blur-sm z-10">
                                <tr className="border-b border-white/[0.04]">
                                    <th className="text-left p-2 pl-4 font-medium text-zinc-500">#</th>
                                    <th className="text-left p-2 font-medium text-zinc-500">Ügynökség</th>
                                    <th className="text-left p-2 font-medium text-zinc-500 hidden md:table-cell">Email</th>
                                    <th className="text-left p-2 font-medium text-zinc-500 hidden lg:table-cell">Telefon</th>
                                    <th className="text-left p-2 font-medium text-zinc-500">Státusz</th>
                                    <th className="text-left p-2 font-medium text-zinc-500 hidden md:table-cell">Megjegyzés</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredAgencies.map((agency) => {
                                    const statusConf = STATUS_CONFIG[agency.status] || STATUS_CONFIG.pending;
                                    return (
                                        <tr key={agency.id} className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors">
                                            <td className="p-2 pl-4 text-zinc-600 font-mono">{agency.id}</td>
                                            <td className="p-2">
                                                <div className="flex flex-col">
                                                    <span className="font-semibold text-white">{agency.name}</span>
                                                    <a href={`https://${agency.web}`} target="_blank" rel="noopener noreferrer" className="text-[10px] text-zinc-500 hover:text-primary flex items-center gap-1">
                                                        {agency.web} <ExternalLink className="w-2.5 h-2.5" />
                                                    </a>
                                                </div>
                                            </td>
                                            <td className="p-2 hidden md:table-cell">
                                                <span className={`font-mono text-[11px] ${agency.email.startsWith('❌') ? 'text-red-400' : 'text-zinc-300'}`}>
                                                    {agency.email}
                                                </span>
                                            </td>
                                            <td className="p-2 hidden lg:table-cell">
                                                {agency.phone ? (
                                                    <a href={`tel:${agency.phone}`} className="flex items-center gap-1 text-zinc-400 hover:text-primary">
                                                        <Phone className="w-3 h-3" /> {agency.phone}
                                                    </a>
                                                ) : <span className="text-zinc-700">—</span>}
                                            </td>
                                            <td className="p-2">
                                                <Badge variant="outline" className={`text-[10px] ${statusConf.color} border`}>
                                                    {statusConf.icon}
                                                    <span className="ml-1">{statusConf.label}</span>
                                                </Badge>
                                            </td>
                                            <td className="p-2 hidden md:table-cell text-[10px] text-zinc-500 max-w-[200px] truncate">{agency.note}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </ScrollArea>
                </CardContent>
            </Card>

            {/* Campaign Launcher */}
            <Card className="shadow-xl border-primary/20">
                <CardHeader className="p-4 md:p-6">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-primary/10 rounded-full text-primary shrink-0">
                            <Target className="w-5 h-5 md:w-6 md:h-6" />
                        </div>
                        <div>
                            <CardTitle className="text-base md:text-xl">Új Kampány Indítása</CardTitle>
                            <CardDescription className="text-xs md:text-sm">Személyre szabott AI megoldások prezentálása</CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-4 md:p-6 space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                        <div className="space-y-2">
                            <label className="text-xs md:text-sm font-medium">Cél Iparág</label>
                            <Select onValueChange={setIndustry} value={industry}>
                                <SelectTrigger className="h-9 md:h-10 text-sm">
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
                        <div className="space-y-2">
                            <label className="text-xs md:text-sm font-medium">Célcég URL / Domain</label>
                            <div className="flex flex-col sm:flex-row gap-2">
                                <Input
                                    placeholder="pl. pelda-ceg.hu"
                                    value={targetUrl}
                                    onChange={(e) => setTargetUrl(e.target.value)}
                                    className="h-9 md:h-10 text-sm"
                                />
                                <Button
                                    onClick={handleStartCampaign}
                                    disabled={isRunning}
                                    className="bg-primary hover:bg-primary/90 h-9 md:h-10 whitespace-nowrap"
                                >
                                    {isRunning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Target className="w-4 h-4 mr-2" />}
                                    Indítás
                                </Button>
                            </div>
                        </div>
                    </div>

                    {isRunning || step > 0 ? (
                        <div className="p-4 md:p-6 rounded-xl bg-secondary/10 border border-primary/10 space-y-4">
                            <div className="flex justify-between items-center text-xs md:text-sm">
                                <span className="font-medium flex items-center gap-2">
                                    {step < 4 ? <Loader2 className="w-3 h-3 md:w-4 md:h-4 animate-spin text-primary" /> : <CheckCircle2 className="w-3 h-3 md:w-4 md:h-4 text-green-500" />}
                                    {getStepLabel()}
                                </span>
                                <span className="text-muted-foreground font-mono">{getProgressValue()}%</span>
                            </div>
                            <Progress value={getProgressValue()} className="h-1.5 md:h-2" />

                            <div className="grid grid-cols-4 gap-1.5 md:gap-2 pt-1 md:pt-2">
                                <div className={`h-1 rounded-full ${step >= 1 ? 'bg-primary' : 'bg-muted'}`} />
                                <div className={`h-1 rounded-full ${step >= 2 ? 'bg-primary' : 'bg-muted'}`} />
                                <div className={`h-1 rounded-full ${step >= 3 ? 'bg-primary' : 'bg-muted'}`} />
                                <div className={`h-1 rounded-full ${step >= 4 ? 'bg-primary' : 'bg-muted'}`} />
                            </div>
                        </div>
                    ) : null}

                    {step === 4 && (
                        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <Card className="border-green-500/30 bg-green-500/5">
                                <CardContent className="p-3 md:p-4 flex flex-col gap-4">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-green-500/20 rounded-lg text-green-600 shrink-0">
                                            <Globe className="w-4 h-4 md:w-5 md:h-5" />
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <div className="text-[10px] text-muted-foreground font-medium uppercase tracking-tight">Generált Demo URL</div>
                                            <div className="text-xs md:text-sm font-mono font-bold truncate">https://demo.brunella.ai/preview/xyz-123</div>
                                        </div>
                                    </div>
                                    <div className="flex flex-col sm:flex-row gap-2">
                                        <Button variant="outline" size="sm" className="h-8 md:h-9 flex-1">
                                            <FileCode className="w-3.5 h-3.5 mr-2" />
                                            Megtekintés
                                        </Button>
                                        <Button size="sm" className="h-8 md:h-9 bg-green-600 hover:bg-green-700 flex-1">
                                            <Mail className="w-3.5 h-3.5 mr-2" />
                                            Email Kiküldése
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
