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
            case 'ollama': return <Cpu className="text-orange-500" size={20} />
            case 'gemini': return <Globe className="text-blue-500" size={20} />
            case 'github': return <Github className="text-white" size={20} />
            default: return <Zap className="text-primary" size={20} />
        }
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-space font-bold text-foreground">LLM Providers</h2>
                    <p className="text-muted-foreground text-sm">Monitor connectivity and latency for neural engines.</p>
                </div>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={fetchStatus}
                    disabled={loading}
                    className="gap-2"
                >
                    <RefreshCcw size={14} className={loading ? "animate-spin" : ""} />
                    Refresh
                </Button>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
                {providers.map((p) => (
                    <Card key={p.id} className="glass-card border-white/10 overflow-hidden group hover:border-primary/50 transition-all">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-muted/50 rounded-lg">
                                    {getProviderIcon(p.id)}
                                </div>
                                <div>
                                    <CardTitle className="text-sm font-bold">{p.name}</CardTitle>
                                    <CardDescription className="text-[10px] uppercase tracking-wider">{p.id === 'ollama' ? 'Local Compute' : 'Cloud Compute'}</CardDescription>
                                </div>
                            </div>
                            <Badge variant={p.status === 'online' ? 'default' : 'destructive'} className="h-5 px-1.5 py-0">
                                {p.status === 'online' ? <CheckCircle2 size={10} className="mr-1" /> : <XCircle size={10} className="mr-1" />}
                                {p.status}
                            </Badge>
                        </CardHeader>
                        <CardContent>
                            <div className="mt-4 space-y-3">
                                <div className="flex justify-between items-end">
                                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                                        <Activity size={10} /> Latency
                                    </span>
                                    <span className={p.status === 'online' ? "text-sm font-mono text-green-400" : "text-sm font-mono text-muted-foreground"}>
                                        {p.status === 'online' ? `${p.latency}ms` : 'N/A'}
                                    </span>
                                </div>
                                <Progress value={p.status === 'online' ? Math.max(10, 100 - (p.latency || 0) / 10) : 0} className="h-1 bg-white/[0.04]" />

                                {p.error && (
                                    <div className="bg-destructive/10 border border-destructive/20 rounded p-2 mt-2">
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
