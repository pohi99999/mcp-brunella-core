import React, { useState, useEffect, useMemo } from 'react';
import {
    FileText,
    Coins,
    Calendar,
    CheckCircle2,
    XCircle,
    Loader2,
    Search,
    ExternalLink,
    History,
    AlertCircle,
    ArrowUpRight
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

export function GrantHunterWidget() {
    const [query, setQuery] = useState('');
    const { jobs, isLoading, fetchJobs, createJob } = useBusinessStore();
    const { socket } = useSocket();
    const [selectedJobId, setSelectedJobId] = useState<string | null>(null);

    const grantJobs = useMemo(() => jobs.filter(j => j.type === 'grant_hunter'), [jobs]);

    useEffect(() => {
        fetchJobs('grant_hunter');
    }, [fetchJobs]);

    useEffect(() => {
        if (!socket) return;

        const handleJobUpdate = (data: { jobId: string, status: string }) => {
            fetchJobs('grant_hunter');
            if (data.status === 'completed') {
                toast.success("Pályázatfigyelés sikeresen lefutott!");
            }
        };

        socket.on('business_job:updated', handleJobUpdate);
        return () => {
            socket.off('business_job:updated', handleJobUpdate);
        };
    }, [socket, fetchJobs]);

    const handleStartScan = async () => {
        const jobId = await createJob('grant_hunter', query || 'Aktuális KKV pályázatok');
        if (jobId) {
            toast.info("Pályázatok keresése folyamatban...");
            setQuery('');
        }
    };

    const activeJob = jobs.find(j => j.id === selectedJobId) || grantJobs[0];
    const grants = activeJob?.results_json ? JSON.parse(activeJob.results_json) : [];

    return (
        <Card className="w-full shadow-xl border-orange-500/20 bg-card/50 backdrop-blur-md">
            <CardHeader className="pb-3 border-b border-white/5">
                <div className="flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-orange-500/10 rounded-full">
                            <FileText className="w-5 h-5 text-orange-500" />
                        </div>
                        <div>
                            <CardTitle>Grant Hunter</CardTitle>
                            <CardDescription>Automata pályázatfigyelő és előminősítő</CardDescription>
                        </div>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="pt-6">
                <div className="flex gap-2 mb-8">
                    <Input
                        placeholder="Szűrés (pl. digitalizáció, napelem, TEÁOR kód)"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        className="bg-secondary/20 border-orange-500/10 h-12"
                    />
                    <Button
                        onClick={handleStartScan}
                        disabled={isLoading}
                        className="bg-orange-600 hover:bg-orange-700 min-w-[160px] h-12 text-white font-bold"
                    >
                        {isLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Search className="w-4 h-4 mr-2" />}
                        Keresés
                    </Button>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Előzmények */}
                    <div className="lg:col-span-1 border-r border-white/5 pr-4 flex flex-col gap-4">
                        <h3 className="text-xs font-semibold uppercase text-muted-foreground flex items-center gap-2">
                            <History size={12} />
                            Előzmények
                        </h3>
                        <ScrollArea className="h-[400px]">
                            <div className="space-y-2">
                                {grantJobs.length === 0 ? (
                                    <p className="text-xs text-muted-foreground italic">Nincs korábbi adat.</p>
                                ) : (
                                    grantJobs.map((job) => (
                                        <div
                                            key={job.id}
                                            onClick={() => setSelectedJobId(job.id)}
                                            className={`p-3 rounded-lg border cursor-pointer transition-all ${selectedJobId === job.id || (!selectedJobId && grantJobs[0].id === job.id)
                                                    ? 'bg-orange-500/10 border-orange-500/30'
                                                    : 'bg-secondary/5 border-transparent hover:border-orange-500/20'
                                                }`}
                                        >
                                            <div className="font-bold text-xs truncate mb-1">{job.query}</div>
                                            <div className="flex justify-between items-center text-[9px] text-zinc-500 font-mono">
                                                {format(new Date(job.created_at), 'MM.dd HH:mm')}
                                                {job.status === 'completed' && <CheckCircle2 size={10} className="text-orange-500" />}
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </ScrollArea>
                    </div>

                    {/* Találatok */}
                    <div className="lg:col-span-2">
                        {activeJob ? (
                            <div className="space-y-4">
                                <h3 className="text-sm font-bold">Talált Pályázatok ({grants.length})</h3>
                                <ScrollArea className="h-[400px] pr-4">
                                    {activeJob.status === 'running' ? (
                                        <div className="h-full flex flex-col items-center justify-center py-20 text-muted-foreground">
                                            <Loader2 className="w-10 h-10 mb-4 animate-spin text-orange-500" />
                                            <p className="animate-pulse text-xs">Pályázati portálok átvizsgálása...</p>
                                        </div>
                                    ) : (
                                        <div className="space-y-4">
                                            {grants.map((grant: any, i: number) => (
                                                <div
                                                    key={i}
                                                    className="p-4 rounded-xl border border-white/5 bg-white/5 hover:border-orange-500/30 transition-all group"
                                                >
                                                    <div className="flex justify-between items-start mb-3">
                                                        <h4 className="font-bold text-sm text-orange-100 leading-tight group-hover:text-orange-400 transition-colors">{grant.title}</h4>
                                                        <Badge variant={grant.eligible ? "default" : "outline"} className={grant.eligible ? "bg-green-600 text-white" : "text-zinc-500"}>
                                                            {grant.eligible ? 'RELEVÁNS' : 'NEM IGAZOLT'}
                                                        </Badge>
                                                    </div>

                                                    <div className="grid grid-cols-2 gap-4 mb-4">
                                                        <div className="flex items-center gap-2 text-xs text-zinc-400">
                                                            <Coins size={14} className="text-yellow-500" />
                                                            {grant.fundingAmount?.toLocaleString()} {grant.currency || 'HUF'}
                                                        </div>
                                                        <div className="flex items-center gap-2 text-xs text-zinc-400">
                                                            <Calendar size={14} className="text-blue-400" />
                                                            Határidő: {grant.deadline || 'N/A'}
                                                        </div>
                                                    </div>

                                                    <div className="flex justify-between items-center mt-2">
                                                        <div className="flex items-center gap-1 text-[10px] font-bold text-green-500">
                                                            <ArrowUpRight size={12} />
                                                            Match: {grant.score}%
                                                        </div>
                                                        <Button size="xs" variant="ghost" className="h-7 text-[10px] gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
                                                            onClick={() => (grant as any).url ? window.open((grant as any).url, '_blank') : toast.info("Részletek nem elérhetők")}>
                                                            Részletek <ExternalLink size={10} />
                                                        </Button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </ScrollArea>
                            </div>
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center py-20 text-muted-foreground opacity-40">
                                <AlertCircle className="w-16 h-16 mb-4" />
                                <p>Nincsenek megjeleníthető adatok.</p>
                            </div>
                        )}
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
