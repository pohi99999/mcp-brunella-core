import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { 
    Bridge, 
    Lightbulb,
    Zap,
    Search,
    History,
    CheckCircle2,
    XCircle,
    Loader2,
    BookOpen,
    ArrowRightLeft,
    Globe
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

export function InnovationBridgeWidget() {
    const { t } = useTranslation();
    const [problem, setProblem] = useState('');
    const { jobs, isLoading, fetchJobs, createJob } = useBusinessStore();
    const { socket } = useSocket();
    const [selectedJobId, setSelectedJobId] = useState<string | null>(null);

    useEffect(() => {
        fetchJobs('innovation_bridge');
    }, [fetchJobs]);

    useEffect(() => {
        if (!socket) return;

        const handleJobUpdate = (data: { jobId: string, status: string }) => {
            fetchJobs('innovation_bridge');
            if (data.status === 'completed') {
                toast.success(t("innovation.success_message", "Innovációs kutatás sikeresen befejeződött!"));
            } else if (data.status === 'failed') {
                toast.error(t("innovation.error_message", "Innovációs kutatás sikertelen."));       
            }
        };

        socket.on('business_job:updated', handleJobUpdate);
        return () => {
            socket.off('business_job:updated', handleJobUpdate);        
        };
    }, [socket, fetchJobs, t]);

    const handleStartInnovation = async () => {
        if (!problem.trim()) {
            toast.error(t("innovation.required_error", "Kérlek írd le a technikai problémát!"));    
            return;
        }

        const jobId = await createJob('innovation_bridge', problem);    
        if (jobId) {
            toast.info(t("innovation.starting_message", "TRIZ elemzés és kutatás elindítva..."));     
            setProblem('');
        }
    };

    const activeJob = jobs.find(j => j.id === selectedJobId) || jobs[0];
    const results = activeJob?.results_json ? JSON.parse(activeJob.results_json) : null;

    return (
        <Card className="w-full shadow-xl border-primary/20 bg-card/50 backdrop-blur-md">
            <CardHeader className="pb-3">
                <div className="flex justify-between items-center">     
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-primary/10 rounded-full">
                            <ArrowRightLeft className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                            <CardTitle>{t("innovation.title")}</CardTitle>    
                            <CardDescription>{t("innovation.description")}</CardDescription>
                        </div>
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                <div className="flex gap-2 mb-6">
                    <Input
                        placeholder={t("innovation.placeholder", "Pl: Hogyan hűtsünk szoftveresen egy túlmelegedő szervert?")}
                        value={problem}
                        onChange={(e) => setProblem(e.target.value)}    
                        className="bg-secondary/20 border-primary/10"   
                        onKeyPress={(e) => e.key === 'Enter' && handleStartInnovation()}
                    />
                    <Button
                        onClick={handleStartInnovation}
                        disabled={isLoading}
                        className="bg-primary hover:bg-primary/90 min-w-[140px]"
                    >
                        {isLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Lightbulb className="w-4 h-4 mr-2" />}
                        {t("innovation.analyze")}
                    </Button>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6"> 
                    {/* Előzmények */}
                    <div className="lg:col-span-1 border-r border-primary/10 pr-4">
                        <h3 className="text-xs font-semibold uppercase text-zinc-500 mb-3 flex items-center gap-2">
                            <History className="w-3 h-3" />
                            {t("innovation.history", "Korábbi lekérdezések")}
                        </h3>
                        <ScrollArea className="h-[400px]">
                            <div className="space-y-2">
                                {jobs.filter(j => j.type === 'innovation_bridge').length === 0 ? (
                                    <p className="text-xs text-zinc-500 italic">{t("innovation.no_history", "Nincsenek korábbi futások.")}</p>
                                ) : (
                                    jobs.filter(j => j.type === 'innovation_bridge').map((job) => (
                                        <div
                                            key={job.id}
                                            onClick={() => setSelectedJobId(job.id)}
                                            className={`p-3 rounded-lg border cursor-pointer transition-all ${
                                                selectedJobId === job.id || (!selectedJobId && (jobs[0] && jobs[0].id === job.id))
                                                    ? 'bg-primary/10 border-primary/30'
                                                    : 'bg-secondary/5 border-transparent hover:border-primary/20'
                                            }`}
                                        >
                                            <div className="flex justify-between items-start mb-1">
                                                <span className="font-bold text-xs truncate max-w-[120px]">{job.query}</span>
                                                {job.status === 'completed' ? (
                                                    <CheckCircle2 className="w-3 h-3 text-green-500" />
                                                ) : job.status === 'failed' ? (
                                                    <XCircle className="w-3 h-3 text-red-500" />
                                                ) : (
                                                    <Loader2 className="w-3 h-3 text-blue-500 animate-spin" />
                                                )}
                                            </div>
                                            <div className="text-[10px] text-zinc-500">
                                                {format(new Date(job.created_at), 'MMM d. HH:mm')}
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </ScrollArea>
                    </div>

                    {/* Analógia riport */}
                    <div className="lg:col-span-2">
                        {activeJob && activeJob.type === 'innovation_bridge' ? (
                            <div className="space-y-4">
                                <div className="flex justify-between items-center">
                                    <h3 className="text-sm font-bold flex items-center gap-2">
                                        {t("innovation.analysis_prefix", "Elemzés")}: {activeJob.query}     
                                    </h3>
                                    <Badge variant="outline" className="text-[10px] uppercase">{activeJob.status}</Badge>
                                </div>

                                <ScrollArea className="h-[360px] pr-4"> 
                                    {activeJob.status === 'running' ? ( 
                                        <div className="h-full flex flex-col items-center justify-center py-20 text-zinc-500">
                                            <Loader2 className="w-10 h-10 mb-4 animate-spin text-primary" />
                                            <p className="animate-pulse text-center px-4">{t("innovation.analyzing_desc", "A TRIZ motor elemzi az ellentmondásokat és kutatja a távoli iparágak analógiáit...")}</p>
                                        </div>
                                    ) : !results ? (
                                        <div className="h-full flex flex-col items-center justify-center py-20 text-zinc-500">
                                            <ArrowRightLeft className="w-10 h-10 mb-4 opacity-20" />
                                            <p>{t("innovation.no_data", "Nincsenek megjeleníthető adatok.")}</p>
                                        </div>
                                    ) : (
                                        <div className="space-y-6">     
                                            {/* TRIZ Ellentmondás */}  
                                            {results.trizAnalysis && (  
                                                <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
                                                    <h4 className="text-xs font-bold uppercase text-primary mb-2 flex items-center gap-2">      
                                                        <Zap className="w-3 h-3" /> {t("innovation.contradictions_title", "Technikai Ellentmondás")}
                                                    </h4>
                                                    <div className="flex items-center gap-4 text-sm font-medium">
                                                        <span className="text-green-500">↑ {results.trizAnalysis.improvedParam}</span>        
                                                        <span className="text-zinc-500">vs</span>
                                                        <span className="text-red-500">↓ {results.trizAnalysis.worsenedParam}</span>
                                                    </div>
                                                    <p className="mt-2 text-xs text-zinc-500 italic">"{results.trizAnalysis.reasoning}"</p>     
                                                </div>
                                            )}

                                            {/* Alapelvek */}
                                            <div className="space-y-3"> 
                                                <h4 className="text-xs font-bold uppercase text-zinc-500 flex items-center gap-2">
                                                    <BookOpen className="w-3 h-3" /> {t("innovation.principles")}
                                                </h4>
                                                {results.suggestedPrinciples?.map((p: any, i: number) => (
                                                    <div key={i} className="p-3 rounded border border-primary/10 bg-secondary/5">
                                                        <div className="font-bold text-xs mb-1">{p.id}. {p.name}</div>
                                                        <p className="text-xs text-zinc-500">{p.description}</p>
                                                    </div>
                                                ))}
                                            </div>

                                            {/* Kutatási Találatok */}
                                            <div className="space-y-3"> 
                                                <h4 className="text-xs font-bold uppercase text-zinc-500 flex items-center gap-2">
                                                    <Globe className="w-3 h-3" /> {t("innovation.analogies")}
                                                </h4>
                                                {results.swarmResults?.map((r: any, i: number) => (
                                                    <div key={i} className="p-4 rounded-lg border border-primary/10 bg-card/30">
                                                        <div className="text-xs leading-relaxed whitespace-pre-wrap">
                                                            {typeof r === 'string' ? r : r.message}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </ScrollArea>
                            </div>
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center py-20 text-zinc-500 opacity-40">
                                <Search className="w-16 h-16 mb-4" />   
                                <p>{t("innovation.prompt_selection", "Válassz ki egy korábbi elemzést vagy írj be egy technikai problémát!")}</p>
                            </div>
                        )}
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
