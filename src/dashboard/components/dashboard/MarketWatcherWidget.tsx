import React, { useState, useEffect, useMemo } from 'react';
import { 
    Eye, 
    Zap, 
    ArrowRight, 
    Download, 
    RefreshCw, 
    Search,
    MessageSquare,
    ExternalLink,
    History,
    CheckCircle2,
    XCircle,
    Loader2,
    TrendingUp,
    TrendingDown,
    AlertTriangle
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

export function MarketWatcherWidget() {
    const [query, setQuery] = useState('');
    const { jobs, isLoading, fetchJobs, createJob } = useBusinessStore();
    const { socket } = useSocket();
    const [selectedJobId, setSelectedJobId] = useState<string | null>(null);

    const marketJobs = useMemo(() => jobs.filter(j => j.type === 'monitor_market' || j.type === 'machine_hunt'), [jobs]);

    useEffect(() => {
        fetchJobs();
    }, [fetchJobs]);

    useEffect(() => {
        if (!socket) return;

        const handleJobUpdate = (data: { jobId: string, status: string }) => {
            fetchJobs();
            if (data.status === 'completed') {
                toast.success("Piaci elemzés sikeresen befejeződött!");
            } else if (data.status === 'failed') {
                toast.error("Piaci elemzés sikertelen.");
            }
        };

        socket.on('business_job:updated', handleJobUpdate);
        return () => {
            socket.off('business_job:updated', handleJobUpdate);
        };
    }, [socket, fetchJobs]);

    const handleStartMonitor = async () => {
        if (!query.trim()) {
            toast.error("Kérlek adj meg egy keresési kifejezést!");
            return;
        }
        
        // Default to machine hunt for demonstration, but can be switched
        const jobId = await createJob('machine_hunt', query);
        if (jobId) {
            toast.info("Gépvadászat elindítva...");
            setQuery('');
        }
    };

    const activeJob = jobs.find(j => j.id === selectedJobId) || marketJobs[0];
    const results = activeJob?.results_json ? JSON.parse(activeJob.results_json) : [];

    return (
        <Card className="w-full shadow-xl border-primary/20 bg-card/50 backdrop-blur-md">
            <CardHeader className="pb-3">
                <div className="flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-green-500/10 rounded-full">
                            <Eye className="w-5 h-5 text-green-500" />
                        </div>
                        <div>
                            <CardTitle>Market Watcher</CardTitle>
                            <CardDescription>Piaci trendek & Arbitrázs vadászat</CardDescription>
                        </div>
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                <div className="flex gap-2 mb-6">
                    <Input 
                        placeholder="Pl: CNC machine, Laptop, Tesla Model 3" 
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        className="bg-secondary/20 border-primary/10"
                        onKeyPress={(e) => e.key === 'Enter' && handleStartMonitor()}
                    />
                    <Button 
                        onClick={handleStartMonitor} 
                        disabled={isLoading}
                        className="bg-green-600 hover:bg-green-700 min-w-[140px] text-white"
                    >
                        {isLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Zap className="w-4 h-4 mr-2" />}
                        Vadászat
                    </Button>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Előzmények */}
                    <div className="lg:col-span-1 border-r border-primary/10 pr-4">
                        <h3 className="text-xs font-semibold uppercase text-muted-foreground mb-3 flex items-center gap-2">
                            <History className="w-3 h-3" />
                            Vadászat Előzmények
                        </h3>
                        <ScrollArea className="h-[400px]">
                            <div className="space-y-2">
                                {marketJobs.length === 0 ? (
                                    <p className="text-xs text-muted-foreground italic">Nincsenek korábbi adatok.</p>
                                ) : (
                                    marketJobs.map((job) => (
                                        <div 
                                            key={job.id}
                                            onClick={() => setSelectedJobId(job.id)}
                                            className={`p-3 rounded-lg border cursor-pointer transition-all ${
                                                selectedJobId === job.id || (!selectedJobId && marketJobs[0].id === job.id)
                                                    ? 'bg-green-500/10 border-green-500/30' 
                                                    : 'bg-secondary/5 border-transparent hover:border-green-500/20'
                                            }`}
                                        >
                                            <div className="flex justify-between items-start mb-1">
                                                <span className="font-bold text-xs truncate max-w-[120px]">{job.query}</span>
                                                <CheckCircle2 className="w-3 h-3 text-green-500" />
                                            </div>
                                            <div className="text-[10px] text-muted-foreground">
                                                {format(new Date(job.created_at), 'MMM d. HH:mm')}
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </ScrollArea>
                    </div>

                    {/* Eredmények */}
                    <div className="lg:col-span-2">
                        {activeJob ? (
                            <div className="space-y-4">
                                <h3 className="text-sm font-bold flex items-center gap-2">
                                    Lehetőségek: {activeJob.query}
                                    <Badge variant="outline" className="text-[10px]">{Array.isArray(results) ? results.length : 0} találat</Badge>
                                </h3>

                                <ScrollArea className="h-[360px] pr-4">
                                    {activeJob.status === 'running' ? (
                                        <div className="h-full flex flex-col items-center justify-center py-20 text-muted-foreground">
                                            <Loader2 className="w-10 h-10 mb-4 animate-spin text-green-500" />
                                            <p className="animate-pulse">Piaci adatok elemzése...</p>
                                        </div>
                                    ) : Array.isArray(results) && results.length > 0 ? (
                                        <div className="space-y-3">
                                            {results.map((item: any, i: number) => (
                                                <div 
                                                    key={i}
                                                    className="p-4 rounded-lg border border-primary/10 bg-secondary/5 hover:border-green-500/30 transition-all"
                                                >
                                                    <div className="flex justify-between items-start mb-2">
                                                        <div className="flex-1 min-w-0">
                                                            <h4 className="font-bold text-sm truncate">{item.title}</h4>
                                                            <div className="flex items-center gap-2 mt-1">
                                                                <span className="text-lg font-mono font-bold text-green-500">{item.price} {item.currency}</span>
                                                                {item.potential_score > 0.7 && (
                                                                    <Badge className="bg-red-500/10 text-red-500 border-red-500/20 text-[9px] animate-pulse">
                                                                        <AlertTriangle className="w-2 h-2 mr-1" />
                                                                        ALULÁRAZOTT
                                                                    </Badge>
                                                                )}
                                                            </div>
                                                        </div>
                                                        <Button variant="ghost" size="xs" asChild>
                                                            <a href={item.url} target="_blank" rel="noopener noreferrer">
                                                                <ExternalLink className="w-3 h-3" />
                                                            </a>
                                                        </Button>
                                                    </div>
                                                    
                                                    <div className="grid grid-cols-2 gap-2 mt-3">
                                                        <div className="p-2 rounded bg-black/20 flex flex-col">
                                                            <span className="text-[8px] text-zinc-500 uppercase font-mono">Piaci Átlag</span>
                                                            <span className="text-xs font-bold">{Math.round(item.market_average)} {item.currency}</span>
                                                        </div>
                                                        <div className="p-2 rounded bg-black/20 flex flex-col">
                                                            <span className="text-[8px] text-zinc-500 uppercase font-mono">Potenciál</span>
                                                            <div className="flex items-center gap-1">
                                                                <span className="text-xs font-bold">{Math.round(item.potential_score * 100)}%</span>
                                                                {item.potential_score > 0.5 ? <TrendingUp className="w-3 h-3 text-green-500" /> : <TrendingDown className="w-3 h-3 text-red-500" />}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="h-full flex flex-col items-center justify-center py-20 text-muted-foreground">
                                            <p>Nincsenek adatok.</p>
                                        </div>
                                    )}
                                </ScrollArea>
                            </div>
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center py-20 text-muted-foreground opacity-40">
                                <Search className="w-16 h-16 mb-4" />
                                <p>Indíts egy piaci elemzést!</p>
                            </div>
                        )}
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
