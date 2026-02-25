import React, { useState, useEffect, useMemo } from 'react';
import { 
    Users, 
    FileText, 
    Upload, 
    CheckCircle2, 
    XCircle, 
    Loader2, 
    Search,
    Mail,
    UserCheck,
    BarChart3,
    History,
    ExternalLink
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

export function DigitalHRWidget() {
    const [jobDescription, setJobDescription] = useState('');
    const { jobs, isLoading, fetchJobs, createJob } = useBusinessStore();
    const { socket } = useSocket();
    const [selectedJobId, setSelectedJobId] = useState<string | null>(null);

    const hrJobs = useMemo(() => jobs.filter(j => j.type === 'digital_hr'), [jobs]);

    useEffect(() => {
        fetchJobs('digital_hr');
    }, [fetchJobs]);

    useEffect(() => {
        if (!socket) return;

        const handleJobUpdate = (data: { jobId: string, status: string }) => {
            fetchJobs('digital_hr');
            if (data.status === 'completed') {
                toast.success("Önéletrajz elemzése sikeresen befejeződött!");
            }
        };

        socket.on('business_job:updated', handleJobUpdate);
        return () => {
            socket.off('business_job:updated', handleJobUpdate);
        };
    }, [socket, fetchJobs]);

    const handleStartScreening = async () => {
        if (!jobDescription.trim()) {
            toast.error("Kérlek add meg a munkaköri leírást!");
            return;
        }
        
        const jobId = await createJob('digital_hr', jobDescription);
        if (jobId) {
            toast.info("HR szűrés elindítva... PDF parsolása Vision MI-vel.");
            setJobDescription('');
        }
    };

    const activeJob = jobs.find(j => j.id === selectedJobId) || hrJobs[0];
    const candidate = activeJob?.results_json ? JSON.parse(activeJob.results_json) : null;

    return (
        <Card className="w-full shadow-xl border-blue-500/20 bg-card/50 backdrop-blur-md">
            <CardHeader className="pb-3 border-b border-white/5">
                <div className="flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-500/10 rounded-full">
                            <Users className="w-5 h-5 text-blue-500" />
                        </div>
                        <div>
                            <CardTitle>Digital HR & CV Screening</CardTitle>
                            <CardDescription>Vision OCR alapú jelölt szűrés és MI pontozás</CardDescription>
                        </div>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="pt-6">
                <div className="flex flex-col gap-4 mb-8">
                    <div className="flex gap-2">
                        <Input 
                            placeholder="Milyen pozícióra keresünk? (pl. Senior React Fejlesztő)" 
                            value={jobDescription}
                            onChange={(e) => setJobDescription(e.target.value)}
                            className="bg-secondary/20 border-blue-500/10 h-12"
                        />
                        <Button 
                            onClick={handleStartScreening} 
                            disabled={isLoading}
                            className="bg-blue-600 hover:bg-blue-700 min-w-[160px] h-12 text-white font-bold"
                        >
                            {isLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Search className="w-4 h-4 mr-2" />}
                            Szűrés Indítása
                        </Button>
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-zinc-500 italic">
                        <Upload size={12} />
                        Tipp: Másold be a munkaköri leírást, Brunella pedig átnézi a beérkezett PDF-eket.
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Előzmények */}
                    <div className="lg:col-span-1 border-r border-white/5 pr-4">
                        <h3 className="text-xs font-semibold uppercase text-muted-foreground mb-3 flex items-center gap-2">
                            <History className="w-3 h-3" />
                            Korábbi Jelöltek
                        </h3>
                        <ScrollArea className="h-[400px]">
                            <div className="space-y-2">
                                {hrJobs.length === 0 ? (
                                    <p className="text-xs text-muted-foreground italic">Nincsenek korábbi szűrések.</p>
                                ) : (
                                    hrJobs.map((job) => {
                                        const res = job.results_json ? JSON.parse(job.results_json) : {};
                                        return (
                                            <div 
                                                key={job.id}
                                                onClick={() => setSelectedJobId(job.id)}
                                                className={`p-3 rounded-lg border cursor-pointer transition-all ${
                                                    selectedJobId === job.id || (!selectedJobId && hrJobs[0].id === job.id)
                                                        ? 'bg-blue-500/10 border-blue-500/30' 
                                                        : 'bg-secondary/5 border-transparent hover:border-blue-500/20'
                                                }`}
                                            >
                                                <div className="flex justify-between items-start mb-1">
                                                    <span className="font-bold text-xs truncate">{res.name || job.query}</span>
                                                    {res.matchScore && (
                                                        <Badge className={res.matchScore >= 80 ? "bg-green-500/20 text-green-500" : "bg-yellow-500/20 text-yellow-500"}>
                                                            {res.matchScore}%
                                                        </Badge>
                                                    )}
                                                </div>
                                                <div className="text-[9px] text-zinc-500">
                                                    {format(new Date(job.created_at), 'yyyy.MM.dd HH:mm')}
                                                </div>
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        </ScrollArea>
                    </div>

                    {/* Részletek */}
                    <div className="lg:col-span-2">
                        {activeJob ? (
                            <div className="space-y-6">
                                {activeJob.status === 'running' ? (
                                    <div className="h-full flex flex-col items-center justify-center py-20 text-muted-foreground">
                                        <Loader2 className="w-10 h-10 mb-4 animate-spin text-blue-500" />
                                        <p className="animate-pulse">CV elemzése Vision MI-vel...</p>
                                    </div>
                                ) : candidate ? (
                                    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <h3 className="text-2xl font-black text-white">{candidate.name}</h3>
                                                <p className="text-sm text-blue-400 font-mono">{candidate.contact}</p>
                                            </div>
                                            <div className="text-right">
                                                <div className="text-[10px] text-zinc-500 uppercase font-bold tracking-tighter mb-1">Match Score</div>
                                                <div className={`text-4xl font-black ${candidate.matchScore >= 80 ? 'text-green-500' : 'text-yellow-500'}`}>
                                                    {candidate.matchScore}%
                                                </div>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="p-4 rounded-xl bg-white/5 border border-white/5">
                                                <div className="text-[10px] font-bold text-zinc-500 uppercase mb-2 flex items-center gap-2">
                                                    <BarChart3 size={12} /> Tapasztalat
                                                </div>
                                                <div className="text-lg font-bold text-white">{candidate.experience} év</div>
                                            </div>
                                            <div className="p-4 rounded-xl bg-white/5 border border-white/5">
                                                <div className="text-[10px] font-bold text-zinc-500 uppercase mb-2 flex items-center gap-2">
                                                    <UserCheck size={12} /> Státusz
                                                </div>
                                                <Badge className={candidate.status === 'priority' ? "bg-red-500 text-white" : "bg-blue-500 text-white"}>
                                                    {candidate.status === 'priority' ? 'KIEMELT JELÖLT' : 'INTERJÚRA AJÁNLOTT'}
                                                </Badge>
                                            </div>
                                        </div>

                                        <div className="space-y-2">
                                            <div className="text-[10px] font-bold text-zinc-500 uppercase">Képességek</div>
                                            <div className="flex flex-wrap gap-2">
                                                {candidate.skills?.split(',').map((s: string, i: number) => (
                                                    <Badge key={i} variant="outline" className="border-blue-500/20 bg-blue-500/5 text-blue-200">
                                                        {s.trim()}
                                                    </Badge>
                                                ))}
                                            </div>
                                        </div>

                                        <div className="flex gap-2 pt-4 border-t border-white/5">
                                            <Button size="sm" className="flex-1 gap-2">
                                                <Mail size={14} /> Email küldése
                                            </Button>
                                            <Button size="sm" variant="outline" className="flex-1 gap-2">
                                                <History size={14} /> Interjú ütemezése
                                            </Button>
                                        </div>
                                    </div>
                                ) : null}
                            </div>
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center py-20 text-muted-foreground opacity-40">
                                <UserCheck className="w-16 h-16 mb-4" />
                                <p>Válassz ki egy jelöltet az elemzéshez.</p>
                            </div>
                        )}
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
