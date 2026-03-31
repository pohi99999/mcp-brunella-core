import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
    Zap,
    RefreshCcw,
    CheckCircle2,
    XCircle,
    Activity,
    Cpu,
    Globe,
    Github
} from 'lucide-react'
import { getProvidersStatus, type ProviderStatus } from '@/lib/apiService'
import { toast } from 'sonner'
import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/utils'

export function LLMProvidersPanel() {
    const [providers, setProviders] = useState<ProviderStatus[]>([])
    const [loading, setLoading] = useState(true)

    const fetchStatus = async () => {
        setLoading(true)
        try {
            const results = await getProvidersStatus()
            setProviders(results)
        } catch (err: any) {
            toast.error(`Hiba a lekérdezés során: ${err.message}`)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchStatus()
        const interval = setInterval(fetchStatus, 30000) // Refresh every 30s
        return () => clearInterval(interval)
    }, [])

    const getProviderIcon = (id: string) => {
        switch (id) {
            case 'ollama': return <Cpu className="text-orange-300" size={20} />
            case 'gemini': return <Globe className="text-cyan-300" size={20} />
            case 'github': return <Github className="text-zinc-100" size={20} />
            default: return <Zap className="text-violet-300" size={20} />
        }
    }

    return (
        <div className="space-y-6">
            <div className="flex items-end justify-between gap-4">
                <div>
                    <p className="text-[10px] uppercase tracking-[0.22em] text-zinc-500">Provider telemetry</p>
                    <h2 className="text-2xl font-semibold text-zinc-100">LLM Providers</h2>
                    <p className="text-zinc-500 text-sm">Monitor connectivity and latency for neural engines.</p>
                </div>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={fetchStatus}
                    disabled={loading}
                    className="gap-2 rounded-full border-white/10 bg-white/[0.02] text-zinc-100 hover:bg-white/[0.05]"
                >
                    <RefreshCcw size={14} className={loading ? "animate-spin" : ""} />
                    Refresh
                </Button>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
                {providers.map((p) => (
                    <Card key={p.id} className="glass-card border-white/10 overflow-hidden group hover:border-cyan-400/40 transition-all">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 border-b border-white/[0.05] bg-white/[0.015]">
                            <div className="flex items-center gap-3">
                                <div className="p-2 rounded-lg bg-white/[0.03] border border-white/[0.05]">
                                    {getProviderIcon(p.id)}
                                </div>
                                <div>
                                    <CardTitle className="text-sm font-semibold text-zinc-100">{p.name}</CardTitle>
                                    <CardDescription className="text-[10px] uppercase tracking-[0.24em] text-zinc-500">{p.id === 'ollama' ? 'Local Compute' : 'Cloud Compute'}</CardDescription>
                                </div>
                            </div>
                            <Badge variant={p.status === 'online' ? 'default' : 'destructive'} className="h-5 px-1.5 py-0 uppercase tracking-[0.16em]">
                                {p.status === 'online' ? <CheckCircle2 size={10} className="mr-1" /> : <XCircle size={10} className="mr-1" />}
                                {p.status}
                            </Badge>
                        </CardHeader>
                        <CardContent className="p-4">
                            <div className="mt-4 space-y-3">
                                <div className="flex justify-between items-end">
                                    <span className="text-xs text-zinc-500 flex items-center gap-1">
                                        <Activity size={10} /> Latency
                                    </span>
                                    <span className={cn(p.status === 'online' ? "text-sm font-mono text-emerald-300" : "text-sm font-mono text-zinc-500")}>
                                        {p.status === 'online' ? `${p.latency}ms` : 'N/A'}
                                    </span>
                                </div>
                                <Progress value={p.status === 'online' ? Math.max(10, 100 - (p.latency || 0) / 10) : 0} className="h-1 bg-white/[0.04]" />

                                {p.error && (
                                    <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-2 mt-2">
                                        <p className="text-[10px] text-destructive leading-tight truncate">{p.error}</p>
                                    </div>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                ))}
                {providers.length === 0 && loading && (
                    Array.from({ length: 3 }).map((_, i) => (
                        <Card key={i} className="glass-card animate-pulse h-[160px] border-white/10" />
                    ))
                )}
            </div>
        </div>
    )
}
