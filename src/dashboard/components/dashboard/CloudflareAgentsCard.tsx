import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Cloud, Globe, RefreshCcw } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import { Skeleton } from '@/components/ui/skeleton'
import { submitCloudflareWorkerTask } from '@/lib/apiService'

interface EdgeAgent {
    id: string
    name: string
    kind: 'public' | 'internal'
    url?: string
    status: 'online' | 'offline' | 'unknown'
    latencyMs?: number
    statusCode?: number
    error?: string
}

interface CloudflareStatus {
    status: 'connected' | 'degraded' | 'error'
    summary: {
        total: number
        online: number
        offline: number
        unknown: number
    }
    workers: EdgeAgent[]
}

export function CloudflareAgentsCard() {
    const [data, setData] = useState<CloudflareStatus | null>(null)
    const [loading, setLoading] = useState(true)
    const [instruction, setInstruction] = useState('health check')
    const [runningWorkerId, setRunningWorkerId] = useState<string | null>(null)

    const fetchData = async () => {
        try {
            const res = await fetch('/api/cloudflare/agents')
            if (!res.ok) {
                throw new Error(`HTTP ${res.status}`)
            }
            const json = await res.json()
            setData(json)
        } catch (e) {
            toast.error('Failed to fetch Cloudflare status')
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchData()
        const interval = setInterval(fetchData, 10000) // Poll every 10s
        return () => clearInterval(interval)
    }, [])

    const handleWorkerTask = async (workerId: string, workerName: string) => {
        if (!instruction.trim()) {
            toast.error('Adj meg egy feladatot a workerhez')
            return
        }

        setRunningWorkerId(workerId)
        try {
            const result = await submitCloudflareWorkerTask(workerId, instruction.trim(), {})
            toast.success(`Feladat elküldve: ${workerName}`, {
                description: result.endpoint ? `endpoint: ${result.endpoint}` : 'worker task accepted',
            })
        } catch (e: any) {
            toast.error(`Worker dispatch hiba: ${workerName}`, {
                description: e.message,
            })
        } finally {
            setRunningWorkerId(null)
        }
    }

    if (loading && !data) {
        return (
            <Card className="glass-card border-white/[0.04] overflow-hidden mt-4">
                <CardHeader className="pb-3 border-b border-white/[0.04] bg-white/[0.04] flex flex-row items-center justify-between">
                    <CardTitle className="flex items-center gap-2 text-sm font-bold tracking-wider uppercase text-muted-foreground">
                        <Skeleton className="h-4 w-4 rounded-full" />
                        <Skeleton className="h-4 w-32" />
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="p-4 space-y-3">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <Skeleton className="h-4 w-4 rounded-full" />
                                <div className="space-y-1">
                                    <Skeleton className="h-3 w-24" />
                                    <Skeleton className="h-2 w-16" />
                                </div>
                            </div>
                            <Skeleton className="h-2 w-12" />
                        </div>
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <Skeleton className="h-4 w-4 rounded-full" />
                                <div className="space-y-1">
                                    <Skeleton className="h-3 w-24" />
                                    <Skeleton className="h-2 w-16" />
                                </div>
                            </div>
                            <Skeleton className="h-2 w-12" />
                        </div>
                    </div>
                </CardContent>
            </Card>
        )
    }

    if (!data) return null

    return (
        <Card className="glass-card border-white/[0.04] overflow-hidden mt-4">
            <CardHeader className="pb-3 border-b border-white/[0.04] bg-white/[0.04] flex flex-row items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-sm font-bold tracking-wider uppercase text-muted-foreground">
                    <Cloud size={16} className="text-orange-400" />
                    Cloudflare Edge Agents
                </CardTitle>
                <div className="flex items-center gap-2">
                    <Badge variant={data.status === 'connected' ? 'default' : data.status === 'degraded' ? 'secondary' : 'destructive'} className="text-[10px]">
                        {data.status}
                    </Badge>
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={fetchData} disabled={loading}>
                        <RefreshCcw size={12} className={loading ? "animate-spin" : ""} />
                    </Button>
                </div>
            </CardHeader>
            <CardContent className="p-0">
                <div className="px-4 py-3 border-b border-white/[0.04] bg-white/[0.02] flex flex-col gap-2">
                    <span className="text-[11px] text-zinc-400">Direkt worker task</span>
                    <div className="flex gap-2">
                        <Input
                            value={instruction}
                            onChange={(e) => setInstruction(e.target.value)}
                            placeholder="Pl.: health check vagy status report"
                            className="h-8 text-xs"
                        />
                    </div>
                </div>
                <div className="px-4 py-2 text-[11px] text-zinc-400 border-b border-white/[0.04] bg-white/[0.02]">
                    total: {data.summary.total} • online: {data.summary.online} • offline: {data.summary.offline} • unknown: {data.summary.unknown}
                </div>
                <div className="divide-y divide-white/5">
                    {data.workers.map(agent => (
                        <div key={agent.id} className="flex items-center justify-between px-4 py-3 hover:bg-white/[0.03] transition-colors">
                            <div className="flex items-center gap-3">
                                <Globe size={16} className="text-muted-foreground" />
                                <div className="flex flex-col">
                                    <span className="text-sm font-mono text-zinc-200">{agent.name}</span>
                                    <span className="text-[10px] text-zinc-500">
                                        {agent.kind} • {agent.url || 'not configured'}
                                    </span>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className={`h-2 w-2 rounded-full ${agent.status === 'online' ? 'bg-green-500 animate-pulse' : agent.status === 'offline' ? 'bg-red-500' : 'bg-yellow-500'}`} />
                                <span className="text-xs text-zinc-400 capitalize">
                                    {agent.status}
                                    {typeof agent.latencyMs === 'number' ? ` (${agent.latencyMs}ms)` : ''}
                                </span>
                                <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-7 px-2 text-[10px]"
                                    disabled={!agent.url || runningWorkerId === agent.id}
                                    onClick={() => handleWorkerTask(agent.id, agent.name)}
                                >
                                    {runningWorkerId === agent.id ? 'Küldés...' : 'Task küldés'}
                                </Button>
                            </div>
                        </div>
                    ))}
                    {data.workers.length === 0 && (
                        <div className="p-4 text-center text-xs text-zinc-500">
                            No active agents on the edge.
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    )
}
