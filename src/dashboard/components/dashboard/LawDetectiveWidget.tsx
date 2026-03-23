import React, { useState, useEffect, useMemo } from 'react';
import { 
    ShieldAlert, 
    Scale, 
    Calendar, 
    CheckCircle2, 
    XCircle, 
    Loader2, 
    Search,
    ExternalLink,
    History,
    AlertTriangle,
    FileWarning,
    Briefcase
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

export function LawDetectiveWidget() {
    const [keywords, setKeywords] = useState('');
    const { jobs, isLoading, fetchJobs, createJob } = useBusinessStore();
    const { socket } = useSocket();
    const [selectedJobId, setSelectedJobId] = useState<string | null>(null);

    const lawJobs = useMemo(() => jobs.filter(j => j.type === 'law_detective'), [jobs]);

    useEffect(() => {
        fetchJobs('law_detective');
    }, [fetchJobs]);

    useEffect(() => {
        if (!socket) return;

        const handleJobUpdate = (data: { jobId: string, status: string }) => {
            fetchJobs('law_detective');
            if (data.status === 'completed') {
                toast.success("Jogszabály elemzés sikeresen befejeződött!", {
                    icon: <ShieldAlert className="w-4 h-4 text-blue-500" />
                });
            }
        };

        socket.on('business_job:updated', handleJobUpdate);
        return () => {
            socket.off('business_job:updated', handleJobUpdate);
        };
    }, [socket, fetchJobs]);

    const handleStartScan = async () => {
        const jobId = await createJob('law_detective', keywords || 'KKV adózás és munkaügy');
        if (jobId) {
            toast.info("Magyar Közlöny átvilágítása megkezdődött...");
            setKeywords('');
        }
    };

    const activeJob = jobs.find(j => j.id === selectedJobId) || lawJobs[0];
    const changes = activeJob?.results_json ? JSON.parse(activeJob.results_json) : [];

    return (
        <Card className="w-full shadow-xl border-blue-500/20 bg-card/50 backdrop-blur-md">
            <CardHeader className="pb-3 border-b border-white/[0.04]">
                <div className="flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-500/10 rounded-full">
                            <Scale className="w-5 h-5 text-blue-500" />
                        </div>
                        <div>
                            <CardTitle>Law Detective</CardTitle>
                            <CardDescription>Jogszabály-monitoring és automatikus hatásvizsgálat</CardDescription>
                        </div>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="pt-6">
                <div className="flex gap-2 mb-8">
                    <Input 
                        placeholder="Figyelt kulcsszavak (pl. KATA, ÁFA, minimálbér)" 
                        value={keywords}
                        onChange={(e) => setKeywords(e.target.value)}
                        className="bg-secondary/20 border-blue-500/10 h-12"
                    />
                    <Button 
                        onClick={handleStartScan} 
                        disabled={isLoading}
                        className="bg-blue-600 hover:bg-blue-700 min-w-[160px] h-12 text-white font-bold"
                    >
                        {isLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Search className="w-4 h-4 mr-2" />}
                        Figyelés
                    </Button>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Előzmények */}
                    <div className="lg:col-span-1 border-r border-white/[0.04] pr-4 flex flex-col gap-4">
                        <h3 className="text-xs font-semibold uppercase text-zinc-500 flex items-center gap-2">
                            <History size={12} />
                            Utolsó Vizsgálatok
                        </h3>
                        <ScrollArea className="h-[400px]">
                            <div className="space-y-2">
                                {lawJobs.length === 0 ? (
                                    <p className="text-xs text-zinc-500 italic">Nincs korábbi adat.</p>
                                ) : (
                                    lawJobs.map((job) => (
                                        <div 
                                            key={job.id}
                                            onClick={() => setSelectedJobId(job.id)}
                                            className={`p-3 rounded-lg border cursor-pointer transition-all ${
                                                selectedJobId === job.id || (!selectedJobId && lawJobs[0].id === job.id)
                                                    ? 'bg-blue-500/10 border-blue-500/30' 
                                                    : 'bg-secondary/5 border-transparent hover:border-blue-500/20'
                                            }`}
                                        >
                                            <div className="font-bold text-[10px] truncate mb-1 uppercase tracking-wider">{job.query}</div>
                                            <div className="flex justify-between items-center text-[9px] text-zinc-500 font-mono">
                                                {format(new Date(job.created_at), 'MM.dd HH:mm')}
                                                {job.status === 'completed' && <CheckCircle2 size={10} className="text-blue-500" />}
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </ScrollArea>
                    </div>

                    {/* Változások Idővonala */}
                    <div className="lg:col-span-2">
                        {activeJob ? (
                            <div className="space-y-4">
                                <h3 className="text-sm font-bold flex items-center gap-2">
                                    Releváns Változások
                                    <Badge variant="outline" className="text-[10px]">{changes.length}</Badge>
                                </h3>

                                <ScrollArea className="h-[400px] pr-4 text-zinc-100">
                                    {activeJob.status === 'running' ? (
                                        <div className="h-full flex flex-col items-center justify-center py-20 text-zinc-500">
                                            <Loader2 className="w-10 h-10 mb-4 animate-spin text-blue-500" />
                                            <p className="animate-pulse text-xs">Magyar Közlöny PDF-ek elemzése...</p>
                                        </div>
                                    ) : (
                                        <div className="space-y-6">
                                            {changes.map((law: any, i: number) => (
                                                <div 
                                                    key={i}
                                                    className="relative pl-6 border-l-2 border-blue-500/20 py-2"
                                                >
                                                    <div className="absolute -left-[9px] top-4 w-4 h-4 rounded-full bg-zinc-900 border-2 border-blue-500" />
                                                    
                                                    <div className="flex justify-between items-start mb-2">
                                                        <h4 className="font-bold text-sm text-blue-100 leading-tight">{law.title}</h4>
                                                        <Badge className={law.relevanceScore >= 80 ? "bg-red-500/20 text-red-500" : "bg-blue-500/20 text-blue-500"}>
                                                            {law.relevanceScore}%
                                                        </Badge>
                                                    </div>
                                                    
                                                    <div className="flex items-center gap-3 text-[10px] text-zinc-500 mb-3 font-mono uppercase">
                                                        <span>{law.category}</span>
                                                        <span>•</span>
                                                        <span>{law.date}</span>
                                                    </div>

                                                    <p className="text-xs text-zinc-400 mb-4 italic leading-relaxed">
                                                        "{law.summary}"
                                                    </p>

                                                    <div className="p-3 rounded-lg bg-red-500/5 border border-red-500/10 flex gap-3">
                                                        <Briefcase className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                                                        <div>
                                                            <div className="text-[10px] font-bold text-red-400 uppercase tracking-widest mb-1">Cégvezetői Teendő</div>
                                                            <div className="text-xs text-zinc-200 font-medium">{law.businessImpact}</div>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </ScrollArea>
                            </div>
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center py-20 text-zinc-500 opacity-40">
                                <FileWarning className="w-16 h-16 mb-4" />
                                <p>Indíts egy vizsgálatot a kulcsszavak alapján.</p>
                            </div>
                        )}
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
