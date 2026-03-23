import React, { useState, useEffect, useMemo } from 'react';
import { 
    Home, 
    Zap, 
    ArrowRight, 
    History,
    CheckCircle2,
    XCircle,
    Loader2,
    Search,
    MapPin,
    Target,
    Users,
    MessageSquare,
    ExternalLink,
    Building2,
    BarChart
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { ScrollArea } from '../ui/scroll-area';
import { Input } from '../ui/input';
import { toast } from 'sonner';
import { useSocket } from '../../context/SocketContext';
import { useBusinessStore } from '../../lib/businessStore';
import { format } from 'date-fns';

export function PropertyVisionaryWidget() {
    const [propertyInfo, setPropertyInfo] = useState('');
    const { jobs, isLoading, fetchJobs, createJob } = useBusinessStore();
    const { socket } = useSocket();
    const [selectedJobId, setSelectedJobId] = useState<string | null>(null);

    const propertyJobs = useMemo(() => jobs.filter(j => j.type === 'property_visionary'), [jobs]);

    useEffect(() => {
        fetchJobs('property_visionary');
    }, [fetchJobs]);

    useEffect(() => {
        if (!socket) return;

        const handleJobUpdate = (data: { jobId: string, status: string }) => {
            fetchJobs('property_visionary');
            if (data.status === 'completed') {
                toast.success("Ingatlan elemzés és vevőkutatás sikeres!", {
                    icon: <Home className="w-4 h-4 text-primary" />
                });
            }
        };

        socket.on('business_job:updated', handleJobUpdate);
        return () => {
            socket.off('business_job:updated', handleJobUpdate);
        };
    }, [socket, fetchJobs]);

    const handleStartHunt = async () => {
        if (!propertyInfo.trim()) {
            toast.error("Kérlek írd le az ingatlan vagy terület paramétereit!");
            return;
        }
        
        const jobId = await createJob('property_visionary', propertyInfo);
        if (jobId) {
            toast.info("Vevővadászat elindítva... Elemzem a piacot.");
            setPropertyInfo('');
        }
    };

    const handleCreateDraft = (lead: any) => {
        toast.info(`Email piszkozat generálása: ${lead.companyName}...`);
        
        const draftBody = `Tisztelt ${lead.contactRole}!\n\n${lead.openingLine}\n\n${lead.valueProposition}\n\nÜdvözlettel,\nBrunella AI`;
        
        socket?.emit('run_tool', {
            name: 'google_workspace',
            args: {
                operation: 'email_draft',
                params: {
                    to: ["investor@example.com"],
                    subject: `Befektetési Lehetőség: ${lead.companyName}`,
                    body: draftBody
                }
            },
            id: `draft_${Date.now()}`
        });

        toast.success("Piszkozat sikeresen létrehozva a Gmailben!");
    };

    const activeJob = jobs.find(j => j.id === selectedJobId) || propertyJobs[0];
    const data = activeJob?.results_json ? JSON.parse(activeJob.results_json) : null;

    return (
        <Card className="w-full shadow-xl border-primary/20 bg-card/50 backdrop-blur-md">
            <CardHeader className="pb-3 border-b border-white/[0.04]">
                <div className="flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-primary/10 rounded-full">
                            <Building2 className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                            <CardTitle>Property Visionary</CardTitle>
                            <CardDescription>Ingatlanstratégia & Intelligens Vevőfelkutatás</CardDescription>
                        </div>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="pt-6">
                <div className="flex gap-2 mb-8">
                    <Input 
                        placeholder="Ingatlan leírása (pl. 10ha iparterület M0 mellett, lakópark projekt Budaörsön)" 
                        value={propertyInfo}
                        onChange={(e) => setPropertyInfo(e.target.value)}
                        className="bg-secondary/20 border-primary/10 h-12"
                        onKeyPress={(e) => e.key === 'Enter' && handleStartHunt()}
                    />
                    <Button 
                        onClick={handleStartHunt} 
                        disabled={isLoading}
                        className="bg-primary hover:bg-primary/90 min-w-[160px] h-12 text-white font-bold"
                    >
                        {isLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Target className="w-4 h-4 mr-2" />}
                        Vevővadászat
                    </Button>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Előzmények */}
                    <div className="lg:col-span-1 border-r border-white/[0.04] pr-4 flex flex-col gap-4">
                        <h3 className="text-xs font-semibold uppercase text-zinc-500 flex items-center gap-2">
                            <History size={12} />
                            Ingatlan Portfólió
                        </h3>
                        <ScrollArea className="h-[450px]">
                            <div className="space-y-2">
                                {propertyJobs.length === 0 ? (
                                    <p className="text-xs text-zinc-500 italic">Nincsenek korábbi projektek.</p>
                                ) : (
                                    propertyJobs.map((job) => (
                                        <div 
                                            key={job.id}
                                            onClick={() => setSelectedJobId(job.id)}
                                            className={`p-3 rounded-lg border cursor-pointer transition-all ${
                                                selectedJobId === job.id || (!selectedJobId && propertyJobs[0].id === job.id)
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
                    <div className="lg:col-span-2">
                        {activeJob ? (
                            <div className="space-y-6">
                                {activeJob.status === 'running' ? (
                                    <div className="h-full flex flex-col items-center justify-center py-20 text-zinc-500">
                                        <Loader2 className="w-10 h-10 mb-4 animate-spin text-primary" />
                                        <p className="animate-pulse text-xs text-center max-w-[200px]">Ideális vevők felkutatása és megkeresési stratégia alkotása...</p>
                                    </div>
                                ) : data ? (
                                    <div className="space-y-6 animate-in fade-in duration-500">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div className="p-4 rounded-xl bg-primary/5 border border-primary/10">
                                                <h4 className="text-[10px] font-bold text-primary uppercase tracking-widest mb-2 flex items-center gap-2">
                                                    <Target size={12} /> MI Vevőprofil
                                                </h4>
                                                <p className="text-sm text-zinc-200 leading-relaxed italic line-clamp-3">"{data.analysis?.buyerProfile || data.buyerProfile}"</p>
                                            </div>
                                            <div className="p-4 rounded-xl bg-white/[0.04] border border-white/[0.04]">
                                                <h4 className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2 flex items-center gap-2">
                                                    <Zap size={12} /> Fő Előnyök (USP)
                                                </h4>
                                                <div className="flex flex-wrap gap-1.5">
                                                    {data.analysis?.usp?.map((usp: string, i: number) => (
                                                        <Badge key={i} variant="outline" className="text-[9px] bg-primary/5 border-primary/20 text-primary-foreground/80">
                                                            {usp}
                                                        </Badge>
                                                    )) || <span className="text-xs text-zinc-500">Nincs USP generálva.</span>}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="space-y-4">
                                            <h4 className="text-sm font-bold flex items-center justify-between">
                                                <span className="flex items-center gap-2">Azonosított Vevőjelöltek <Badge variant="outline" className="text-[10px]">{data.leads?.length || 0}</Badge></span>
                                                <Badge className={data.analysis?.riskProfile === 'low' ? 'bg-green-500/20 text-green-500' : 'bg-yellow-500/20 text-yellow-500'}>
                                                    Risk: {data.analysis?.riskProfile?.toUpperCase() || 'N/A'}
                                                </Badge>
                                            </h4>
                                            
                                            <ScrollArea className="h-[350px] pr-4">
                                                <div className="space-y-4">
                                                    {data.leads?.map((lead: any, i: number) => (
                                                        <div key={i} className="p-4 rounded-xl border border-white/[0.04] bg-white/[0.04] hover:border-primary/20 transition-all group">
                                                            <div className="flex justify-between items-start mb-2">
                                                                <div>
                                                                    <h5 className="font-bold text-sm text-white group-hover:text-primary transition-colors">{lead.companyName}</h5>
                                                                    <div className="text-[10px] text-zinc-500 font-mono uppercase mt-0.5">{lead.contactRole}</div>
                                                                </div>
                                                                <div className="flex flex-col items-end gap-1">
                                                                    <Badge className="bg-green-500/10 text-green-500 text-[9px]">{lead.outreachChannel || 'EMAIL'}</Badge>
                                                                    <span className="text-[9px] font-mono text-zinc-600">{lead.linkedinHint || ''}</span>
                                                                </div>
                                                            </div>
                                                            
                                                            <p className="text-xs text-zinc-400 mb-3 leading-snug">{lead.reason}</p>
                                                            
                                                            <div className="p-3 rounded-lg bg-white/[0.02] border border-white/[0.04] space-y-2">
                                                                <div className="text-[9px] font-bold text-primary uppercase flex items-center gap-1">
                                                                    <MessageSquare size={10} /> Nyitó stratégia
                                                                </div>
                                                                <p className="text-xs text-zinc-200 italic leading-relaxed">"{lead.openingLine}"</p>
                                                                <div className="pt-2 mt-2 border-t border-white/[0.04]">
                                                                    <div className="text-[9px] font-bold text-zinc-500 uppercase mb-1">Értékajánlat (Proposition)</div>
                                                                    <p className="text-[10px] text-zinc-400">{lead.valueProposition}</p>
                                                                </div>
                                                            </div>

                                                            <div className="flex gap-2 mt-4 opacity-0 group-hover:opacity-100 transition-opacity">
                                                                <Button size="xs" variant="outline" className="h-7 text-[9px] flex-1">Profil Megtekintése</Button>
                                                                <Button size="xs" onClick={() => handleCreateDraft(lead)} className="h-7 text-[9px] flex-1 bg-primary/20 text-primary border-primary/20 hover:bg-primary/30">Piszkozat Generálása</Button>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </ScrollArea>
                                        </div>
                                    </div>
                                ) : null}
                            </div>
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center py-20 text-zinc-500 opacity-40">
                                <Building2 className="w-16 h-16 mb-4" />
                                <p className="text-center">Adj meg egy ingatlant az induláshoz.<br/><span className="text-[10px]">Példa: "Ipari csarnok engedéllyel Győr mellett"</span></p>
                            </div>
                        )}
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
