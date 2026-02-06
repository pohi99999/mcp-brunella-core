import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Cloud, Globe, RefreshCcw } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { Skeleton } from '@/components/ui/skeleton'

interface EdgeAgent {
    name: string
    status: 'active' | 'idle' | 'error'
    tasks: number
}

interface CloudflareStatus {
    status: 'connected' | 'error' | 'disabled'
    agents: EdgeAgent[]
}

export function CloudflareAgentsCard() {
    const [data, setData] = useState<CloudflareStatus | null>(null)
    const [loading, setLoading] = useState(true)

    const fetchData = async () => {
        try {
            const res = await fetch('/api/cloudflare/agents')
            const json = await res.json()
            setData(json)
        } catch (e) {
            console.error(e)
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

    if (loading && !data) {
        return (
            <Card className="glass-card border-white/5 overflow-hidden mt-4">
                <CardHeader className="pb-3 border-b border-white/5 bg-white/5 flex flex-row items-center justify-between">
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

    if (!data || data.status === 'disabled') return null

    return (
        <Card className="glass-card border-white/5 overflow-hidden mt-4">
            <CardHeader className="pb-3 border-b border-white/5 bg-white/5 flex flex-row items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-sm font-bold tracking-wider uppercase text-muted-foreground">
                    <Cloud size={16} className="text-orange-400" />
                    Cloudflare Edge Agents
                </CardTitle>
                <div className="flex items-center gap-2">
                    <Badge variant={data.status === 'connected' ? 'default' : 'destructive'} className="text-[10px]">
                        {data.status}
                    </Badge>
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={fetchData} disabled={loading}>
                        <RefreshCcw size={12} className={loading ? "animate-spin" : ""} />
                    </Button>
                </div>
            </CardHeader>
            <CardContent className="p-0">
                <div className="divide-y divide-white/5">
                    {data.agents.map(agent => (
                        <div key={agent.name} className="flex items-center justify-between px-4 py-3 hover:bg-white/5 transition-colors">
                            <div className="flex items-center gap-3">
                                <Globe size={16} className="text-muted-foreground" />
                                <div className="flex flex-col">
                                    <span className="text-sm font-mono text-zinc-200">{agent.name}</span>
                                    <span className="text-[10px] text-zinc-500">Tasks: {agent.tasks}</span>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className={`h-2 w-2 rounded-full ${agent.status === 'active' ? 'bg-green-500 animate-pulse' : 'bg-zinc-500'}`} />
                                <span className="text-xs text-zinc-400 capitalize">{agent.status}</span>
                            </div>
                        </div>
                    ))}
                    {data.agents.length === 0 && (
                        <div className="p-4 text-center text-xs text-zinc-500">
                            No active agents on the edge.
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    )
}
