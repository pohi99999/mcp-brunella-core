import React, { useState, useEffect, useMemo } from 'react';
import { 
    Megaphone, 
    Zap, 
    ArrowRight, 
    History,
    CheckCircle2,
    Loader2,
    MonitorPlay,
    Video,
    MessageCircle,
    Target
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { ScrollArea } from '../ui/scroll-area';
import { Textarea } from '../ui/textarea';
import { toast } from 'sonner';
import { useSocket } from '../../context/SocketContext';
import { useBusinessStore } from '../../lib/businessStore';
import { format } from 'date-fns';

export function CampaignGeneratorWidget() {
    const [productInfo, setProductInfo] = useState('');
    const { jobs, isLoading, fetchJobs, createJob } = useBusinessStore();
    const { socket } = useSocket();
    const [selectedJobId, setSelectedJobId] = useState<string | null>(null);

    const campaignJobs = useMemo(() => jobs.filter(j => j.type === 'marketing_director'), [jobs]);

    useEffect(() => {
        fetchJobs('marketing_director');
    }, [fetchJobs]);

    useEffect(() => {
        if (!socket) return;

        const handleJobUpdate = (data: { jobId: string, status: string }) => {
            fetchJobs('marketing_director');
            if (data.status === 'completed') {
                toast.success("Marketing Kampány és Weboldal sikeresen elindítva!", {
                    icon: <Megaphone className="w-4 h-4 text-primary" />
                });
            }
        };

        socket.on('business_job:updated', handleJobUpdate);
        return () => {
            socket.off('business_job:updated', handleJobUpdate);
        };
    }, [socket, fetchJobs]);

    const handleStartCampaign = async () => {
        if (!productInfo.trim()) {
            toast.error("Kérlek add meg a termék vagy szolgáltatás leírását!");
            return;
        }
        
        const jobId = await createJob('marketing_director', productInfo);
        if (jobId) {
            toast.info("Kampány tervezés elindítva... Ágensek felébresztve.");
            setProductInfo('');
        }
    };

    const activeJob = jobs.find(j => j.id === selectedJobId) || campaignJobs[0];
    const data = activeJob?.results_json ? JSON.parse(activeJob.results_json) : null;

    return (
        <Card className="w-full shadow-xl border-primary/20 bg-card/50 backdrop-blur-md min-h-[600px]">
            <CardHeader className="pb-3 border-b border-white/[0.04] bg-secondary/10">
                <div className="flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-primary/10 rounded-full">
                            <Megaphone className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                            <CardTitle>Campaign Generator</CardTitle>
                            <CardDescription>Automatizált Marketing, Posztok & Weboldal Készítés</CardDescription>
                        </div>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="pt-6">
                <div className="flex gap-2 mb-8 flex-col lg:flex-row">
                    <Textarea 
                        placeholder="Termék/szolgáltatás leírása, előnyök, célközönség (pl. Prémium kávégép irodáknak, fókusz a gyorsaságon és minőségen)" 
                        value={productInfo}
                        onChange={(e) => setProductInfo(e.target.value)}
                        className="bg-secondary/20 border-primary/10 min-h-[80px] flex-1"
                    />
                    <Button 
                        onClick={handleStartCampaign} 
                        disabled={isLoading}
                        className="bg-primary hover:bg-primary/90 min-w-[200px] h-auto text-white font-bold"
                    >
                        {isLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Zap className="w-4 h-4 mr-2" />}
                        Kampány Generálása
                    </Button>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                    {/* Előzmények */}
                    <div className="lg:col-span-1 border-r border-white/[0.04] pr-4 flex flex-col gap-4">
                        <h3 className="text-xs font-semibold uppercase text-muted-foreground flex items-center gap-2">
                            <History size={12} />
                            Korábbi Kampányok
                        </h3>
                        <ScrollArea className="h-[450px]">
                            <div className="space-y-2">
                                {campaignJobs.length === 0 ? (
                                    <p className="text-xs text-muted-foreground italic">Nincsenek korábbi kampányok.</p>
                                ) : (
                                    campaignJobs.map((job) => (
                                        <div 
                                            key={job.id}
                                            onClick={() => setSelectedJobId(job.id)}
                                            className={`p-3 rounded-lg border cursor-pointer transition-all ${
                                                selectedJobId === job.id || (!selectedJobId && campaignJobs[0].id === job.id)
                                                    ? 'bg-primary/10 border-primary/30' 
                                                    : 'bg-secondary/5 border-transparent hover:border-primary/20'
                                            }`}
                                        >
                                            <div className="font-bold text-xs truncate mb-1">{job.query}</div>
                                            <div className="flex justify-between items-center text-[9px] text-zinc-500 font-mono">
                                                {format(new Date(job.created_at), 'MM.dd HH:mm')}
                                                {job.status === 'completed' && <CheckCircle2 size={10} className="text-primary" />}
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </ScrollArea>
                    </div>

                    {/* Részletek */}
                    <div className="lg:col-span-3">
                        {activeJob ? (
                            <div className="space-y-6 h-full">
                                {activeJob.status === 'running' ? (
                                    <div className="h-full flex flex-col items-center justify-center py-20 text-muted-foreground">
                                        <Loader2 className="w-10 h-10 mb-4 animate-spin text-primary" />
                                        <p className="animate-pulse text-xs text-center font-mono text-zinc-400 max-w-[250px]">
                                            {activeJob.metadata || "Marketing anyagok és stúdió projekt generálása..."}
                                        </p>
                                    </div>
                                ) : data ? (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 h-full animate-in fade-in duration-500">
                                        
                                        {/* Akcióterv */}
                                        <div className="p-4 rounded-xl border border-white/[0.04] bg-white/[0.02] flex flex-col">
                                            <h4 className="text-[10px] font-bold text-primary uppercase tracking-widest mb-3 flex items-center gap-2">
                                                <Target size={12} /> Akcióterv (GTM)
                                            </h4>
                                            <ScrollArea className="flex-1 h-[180px]">
                                                <div className="text-xs text-zinc-300 whitespace-pre-wrap leading-relaxed pr-3">
                                                    {data.actionPlan}
                                                </div>
                                            </ScrollArea>
                                        </div>

                                        {/* Közösségi Média */}
                                        <div className="p-4 rounded-xl border border-white/[0.04] bg-white/[0.02] flex flex-col">
                                            <h4 className="text-[10px] font-bold text-blue-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                                                <MessageCircle size={12} /> Közösségi Média
                                            </h4>
                                            <ScrollArea className="flex-1 h-[180px]">
                                                <div className="text-xs text-zinc-300 whitespace-pre-wrap leading-relaxed pr-3">
                                                    {data.socialPosts}
                                                </div>
                                            </ScrollArea>
                                        </div>

                                        {/* Videó Script */}
                                        <div className="p-4 rounded-xl border border-white/[0.04] bg-white/[0.02] flex flex-col">
                                            <h4 className="text-[10px] font-bold text-purple-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                                                <Video size={12} /> Videó Forgatókönyv
                                            </h4>
                                            <ScrollArea className="flex-1 h-[180px]">
                                                <div className="text-xs text-zinc-300 whitespace-pre-wrap leading-relaxed pr-3">
                                                    {data.videoScript}
                                                </div>
                                            </ScrollArea>
                                        </div>

                                        {/* Weboldal / Studio */}
                                        <div className="p-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5 flex flex-col items-center justify-center text-center gap-4 relative overflow-hidden group">
                                            <MonitorPlay className="w-12 h-12 text-emerald-500 opacity-80 group-hover:scale-110 transition-transform" />
                                            <div>
                                                <h4 className="text-sm font-bold text-emerald-500 mb-1">Landing Page Épül...</h4>
                                                <p className="text-[10px] text-zinc-400 max-w-[200px] leading-relaxed">
                                                    A specifikáció átadásra került a <b>Brunella Studio</b>-nak. Az ágensek jelenleg írják a kódot.
                                                </p>
                                            </div>
                                            <Button 
                                                variant="outline" 
                                                className="border-emerald-500/30 text-emerald-500 hover:bg-emerald-500 hover:text-white"
                                                onClick={() => {
                                                    // This assumes clicking it navigates to Studio tab. 
                                                    // In reality, user switches manually or we dispatch an event.
                                                    toast.info("Kérjük, nyisd meg a 'Brunella Studio' menüpontot a megtekintéshez!");
                                                }}
                                            >
                                                Tovább a Studio-ba <ArrowRight className="w-4 h-4 ml-2" />
                                            </Button>
                                        </div>
                                    </div>
                                ) : null}
                            </div>
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center py-20 text-muted-foreground opacity-40">
                                <Megaphone className="w-16 h-16 mb-4" />
                                <p className="text-center">Írd le a terméket az első kampány indításához.</p>
                            </div>
                        )}
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
