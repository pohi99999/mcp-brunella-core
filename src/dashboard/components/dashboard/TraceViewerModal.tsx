import React, { useEffect, useState } from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { ScrollArea } from '../ui/scroll-area';
import { X, Copy, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';

interface TraceData {
    taskId: number;
    agentName: string;
    description: string;
    status: string;
    startedAt?: string;
    completedAt?: string;
    result?: any;
    error?: string;
    logs?: Array<{
        timestamp: string;
        level: string;
        message: string;
        agent?: string;
    }>;
    context?: any;
    priority?: number;
    retryCount?: number;
}

interface PerformanceMetrics {
    duration: string;
    avgLogInterval: string;
    errorRate: number;
}

interface TraceViewerModalProps {
    isOpen: boolean;
    onClose: () => void;
    taskId: number | null;
}

export function TraceViewerModal({ isOpen, onClose, taskId }: TraceViewerModalProps) {
    const [trace, setTrace] = useState<TraceData | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!isOpen || !taskId) {
            setTrace(null);
            setError(null);
            return;
        }

        const fetchTrace = async () => {
            setLoading(true);
            setError(null);
            try {
                const response = await fetch(`/api/tasks/${taskId}`);
                if (!response.ok) {
                    throw new Error(`Failed to fetch trace: ${response.statusText}`);
                }
                const data = await response.json();
                setTrace(data.task);
            } catch (err: unknown) {
                const msg = err instanceof Error ? err.message : String(err);
                setError(msg);
                toast.error(`Failed to load trace: ${msg}`);
            } finally {
                setLoading(false);
            }
        };

        fetchTrace();
    }, [isOpen, taskId]);

    const copyToClipboard = () => {
        if (!trace) return;
        navigator.clipboard.writeText(JSON.stringify(trace, null, 2));
        toast.success('Trace copied to clipboard');
    };

    const openInLangSmith = () => {
        // LangSmith integration - open trace in external viewer
        if (!trace?.taskId) return;
        const langsmithUrl = `https://smith.langchain.com/o/${process.env.LANGCHAIN_ORG || 'your-org'}/projects/p/${process.env.LANGCHAIN_PROJECT || 'default'}/traces/${trace.taskId}`;
        window.open(langsmithUrl, '_blank');
        toast.success('Opening in LangSmith...');
    };

    const calculateMetrics = (): PerformanceMetrics | null => {
        if (!trace || !trace.startedAt) return null;
        
        const start = new Date(trace.startedAt).getTime();
        const end = trace.completedAt ? new Date(trace.completedAt).getTime() : Date.now();
        const durationMs = end - start;
        
        const duration = durationMs < 1000 
            ? `${durationMs}ms` 
            : durationMs < 60000 
            ? `${(durationMs / 1000).toFixed(2)}s` 
            : `${(durationMs / 60000).toFixed(2)}min`;
        
        const errorCount = trace.logs?.filter(l => l.level === 'error').length || 0;
        const totalLogs = trace.logs?.length || 0;
        const errorRate = totalLogs > 0 ? (errorCount / totalLogs) * 100 : 0;
        
        let avgLogInterval = 'N/A';
        if (trace.logs && trace.logs.length > 1) {
            const intervals: number[] = [];
            for (let i = 1; i < trace.logs.length; i++) {
                const prev = new Date(trace.logs[i - 1].timestamp).getTime();
                const curr = new Date(trace.logs[i].timestamp).getTime();
                intervals.push(curr - prev);
            }
            const avg = intervals.reduce((a, b) => a + b, 0) / intervals.length;
            avgLogInterval = avg < 1000 ? `${avg.toFixed(0)}ms` : `${(avg / 1000).toFixed(2)}s`;
        }
        
        return { duration, avgLogInterval, errorRate };
    };

    const metrics = calculateMetrics();

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-w-4xl max-h-[80vh]">
                <DialogHeader>
                    <DialogTitle className="flex items-center justify-between">
                        <span>Deep Dive Trace - Task #{taskId}</span>
                        <div className="flex gap-2">
                            <Button size="sm" variant="outline" onClick={copyToClipboard}>
                                <Copy className="w-4 h-4 mr-1" />
                                Copy
                            </Button>
                            <Button size="sm" variant="outline" onClick={openInLangSmith}>
                                <ExternalLink className="w-4 h-4 mr-1" />
                                LangSmith
                            </Button>
                            <Button size="sm" variant="ghost" onClick={onClose}>
                                <X className="w-4 h-4" />
                            </Button>
                        </div>
                    </DialogTitle>
                </DialogHeader>

                <ScrollArea className="h-[60vh] w-full">
                    {loading && (
                        <div className="flex items-center justify-center h-full">
                            <div className="text-muted-foreground">Loading trace...</div>
                        </div>
                    )}

                    {error && (
                        <div className="p-4 bg-destructive/10 text-destructive rounded-md">
                            <strong>Error:</strong> {error}
                        </div>
                    )}

                    {trace && !loading && (
                        <div className="space-y-4 p-4">
                            {/* Task Overview */}
                            <div className="bg-card p-4 rounded-lg border">
                                <h3 className="font-semibold mb-2">Task Overview</h3>
                                <div className="grid grid-cols-2 gap-2 text-sm">
                                    <div>
                                        <span className="text-muted-foreground">Agent:</span>{' '}
                                        <span className="font-mono">{trace.agentName}</span>
                                    </div>
                                    <div>
                                        <span className="text-muted-foreground">Status:</span>{' '}
                                        <span className={`font-semibold ${trace.status === 'completed' ? 'text-green-500' :
                                            trace.status === 'failed' ? 'text-red-500' :
                                                trace.status === 'running' ? 'text-yellow-500' :
                                                    'text-muted-foreground'
                                            }`}>
                                            {trace.status}
                                        </span>
                                    </div>
                                    {trace.startedAt && (
                                        <div>
                                            <span className="text-muted-foreground">Started:</span>{' '}
                                            {new Date(trace.startedAt).toLocaleString()}
                                        </div>
                                    )}
                                    {trace.completedAt && (
                                        <div>
                                            <span className="text-muted-foreground">Completed:</span>{' '}
                                            {new Date(trace.completedAt).toLocaleString()}
                                        </div>
                                    )}
                                    {trace.priority !== undefined && (
                                        <div>
                                            <span className="text-muted-foreground">Priority:</span>{' '}
                                            <span className="font-semibold">{trace.priority}</span>
                                        </div>
                                    )}
                                    {trace.retryCount !== undefined && trace.retryCount > 0 && (
                                        <div>
                                            <span className="text-muted-foreground">Retries:</span>{' '}
                                            <span className="font-semibold text-orange-500">{trace.retryCount}</span>
                                        </div>
                                    )}
                                </div>
                                <div className="mt-2">
                                    <span className="text-muted-foreground">Description:</span>
                                    <p className="mt-1">{trace.description}</p>
                                </div>
                            </div>

                            {/* Performance Metrics */}
                            {metrics && (
                                <div className="bg-card p-4 rounded-lg border">
                                    <h3 className="font-semibold mb-2">Performance Metrics</h3>
                                    <div className="grid grid-cols-3 gap-4 text-sm">
                                        <div className="text-center">
                                            <div className="text-2xl font-bold text-blue-500">{metrics.duration}</div>
                                            <div className="text-xs text-muted-foreground">Duration</div>
                                        </div>
                                        <div className="text-center">
                                            <div className="text-2xl font-bold text-green-500">{metrics.avgLogInterval}</div>
                                            <div className="text-xs text-muted-foreground">Avg Log Interval</div>
                                        </div>
                                        <div className="text-center">
                                            <div className={`text-2xl font-bold ${metrics.errorRate > 30 ? 'text-red-500' : metrics.errorRate > 10 ? 'text-yellow-500' : 'text-green-500'}`}>
                                                {metrics.errorRate.toFixed(1)}%
                                            </div>
                                            <div className="text-xs text-muted-foreground">Error Rate</div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Context */}
                            {trace.context && Object.keys(trace.context).length > 0 && (
                                <div className="bg-card p-4 rounded-lg border">
                                    <h3 className="font-semibold mb-2">Context</h3>
                                    <pre className="text-xs bg-muted p-2 rounded overflow-x-auto">
                                        {JSON.stringify(trace.context, null, 2)}
                                    </pre>
                                </div>
                            )}

                            {/* Result */}
                            {trace.result && (
                                <div className="bg-card p-4 rounded-lg border">
                                    <h3 className="font-semibold mb-2">Result</h3>
                                    <pre className="text-xs bg-muted p-2 rounded overflow-x-auto">
                                        {JSON.stringify(trace.result, null, 2)}
                                    </pre>
                                </div>
                            )}

                            {/* Error */}
                            {trace.error && (
                                <div className="bg-destructive/10 p-4 rounded-lg border border-destructive">
                                    <h3 className="font-semibold mb-2 text-destructive">Error</h3>
                                    <pre className="text-xs whitespace-pre-wrap">{trace.error}</pre>
                                </div>
                            )}

                            {/* Logs */}
                            {trace.logs && trace.logs.length > 0 && (
                                <div className="bg-card p-4 rounded-lg border">
                                    <h3 className="font-semibold mb-2">Execution Logs</h3>
                                    <div className="space-y-1">
                                        {trace.logs.map((log, idx) => (
                                            <div
                                                key={idx}
                                                className={`text-xs p-2 rounded font-mono ${log.level === 'error' ? 'bg-red-500/10 text-red-500' :
                                                    log.level === 'warn' ? 'bg-yellow-500/10 text-yellow-500' :
                                                        'bg-muted'
                                                    }`}
                                            >
                                                <span className="text-muted-foreground">
                                                    [{new Date(log.timestamp).toLocaleTimeString()}]
                                                </span>{' '}
                                                {log.agent && <span className="font-semibold">[{log.agent}]</span>}{' '}
                                                {log.message}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </ScrollArea>
            </DialogContent>
        </Dialog>
    );
}
