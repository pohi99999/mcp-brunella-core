import { useState, useEffect, useRef } from 'react'
import { Brain, Terminal, Play, Activity, CheckCircle2, AlertCircle, Clock, Trash2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Progress } from '@/components/ui/progress'
import { toast } from 'sonner'
import { getAgentStatuses, executeAgent, API_BASE } from '@/lib/apiService'
import { formatAgentResponse } from '@/lib/agentResponseFormatter'
import { cn } from '@/lib/utils'

interface AgentStatus {
    name: string;
    description: string;
    status: 'idle' | 'working' | 'error' | 'loaded';
    lastTask?: string;
    executionCount?: number;
}

export function AgentManagementPanel() {
    const [agents, setAgents] = useState<AgentStatus[]>([])
    const [selectedAgent, setSelectedAgent] = useState<string | null>(null)
    const [logs, setLogs] = useState<string[]>([])
    const [taskInput, setTaskInput] = useState('')
    const [executing, setExecuting] = useState(false)
    const [loading, setLoading] = useState(true)
    const eventSourceRef = useRef<EventSource | null>(null)
    const logEndRef = useRef<HTMLDivElement>(null)
    const logScrollAreaRef = useRef<HTMLDivElement>(null)
    const stickToBottomRef = useRef(true)

    const fetchAgents = async () => {
        try {
            const data = await getAgentStatuses()
            setAgents(data as AgentStatus[])
        } catch (err: unknown) {
            toast.error(`Nem sikerült betölteni az ügynököket: ${err instanceof Error ? err.message : String(err)}`)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchAgents()
        const interval = setInterval(fetchAgents, 5000)
        return () => clearInterval(interval)
    }, [])

    useEffect(() => {
        const viewport = logScrollAreaRef.current?.querySelector('[data-slot="scroll-area-viewport"]') as HTMLDivElement | null
        if (!viewport) return

        const updateStickiness = () => {
            stickToBottomRef.current =
                viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight <= 80
        }

        updateStickiness()
        viewport.addEventListener('scroll', updateStickiness)

        return () => viewport.removeEventListener('scroll', updateStickiness)
    }, [])

    useEffect(() => {
        if (stickToBottomRef.current && logEndRef.current) {
            logEndRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' })
        }
    }, [logs.length])

    const subscribeToLogs = (agentName: string) => {
        if (eventSourceRef.current) {
            eventSourceRef.current.close()
        }

        setLogs([`--- Feliratkozva a(z) ${agentName} naplójára ---`])
        const es = new EventSource(`${API_BASE}/api/agents/${encodeURIComponent(agentName)}/logs`)

        es.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data)
                const timestamp = new Date().toLocaleTimeString()
                const message = data.message || formatAgentResponse(data, agentName)
                setLogs((prev: string[]) => [...prev, `[${timestamp}] ${message}`])
            } catch (e) {
                setLogs((prev: string[]) => [...prev, event.data])
            }
        }

        es.onerror = () => {
            setLogs((prev: string[]) => [...prev, 'CSATLAKOZÁSI HIBA A NAPLÓHOZ'])
            es.close()
        }

        eventSourceRef.current = es
    }

    const handleExecute = async () => {
        if (!selectedAgent || !taskInput.trim()) return
        setExecuting(true)
        setLogs((prev: string[]) => [...prev, `\n>>> Végrehajtás: ${taskInput}`])
        try {
            const result = await executeAgent(selectedAgent, taskInput)
            toast.success('Feladat sikeresen beküldve')
            const formattedResult = formatAgentResponse(result, selectedAgent)
            setLogs((prev: string[]) => [...prev, `<<< Eredmény:\n${formattedResult}`])
            setTaskInput('')
        } catch (err: unknown) {
            toast.error(`Végrehajtási hiba: ${err instanceof Error ? err.message : String(err)}`)
            setLogs((prev: string[]) => [...prev, `!!! HIBA: ${err instanceof Error ? err.message : String(err)}`])
        } finally {
            setExecuting(false)
        }
    }

    const clearLogs = () => setLogs([])

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="flex items-end justify-between gap-4">
                <div>
                    <p className="text-[10px] uppercase tracking-[0.22em] text-zinc-500">Agent Control</p>
                    <h2 className="text-2xl font-semibold text-zinc-100">Agent Management</h2>
                    <p className="mt-1 text-sm text-zinc-500">AI ügynökök felügyelete és közvetlen vezérlése.</p>
                </div>
                <Button onClick={fetchAgents} variant="outline" size="sm" className="gap-2 rounded-full border-white/10 bg-white/[0.02] text-zinc-100 hover:bg-white/[0.05]">
                    <Clock className="w-4 h-4" /> Frissítés
                </Button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Registry & Status List */}
                <div className="lg:col-span-1 space-y-4">
                    <Card className="glass-card border-white/10 overflow-hidden">
                        <CardHeader className="pb-3 border-b border-white/[0.05] bg-white/[0.015]">
                            <CardTitle className="flex items-center gap-2 text-[11px] font-mono font-semibold uppercase tracking-[0.28em] text-zinc-400">
                                <Brain className="w-4 h-4 text-cyan-300" />
                                Regisztrált Ügynökök
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-0">
                            <ScrollArea className="h-[500px]">
                                <div className="divide-y divide-white/[0.05]">
                                    {loading ? (
                                        <div className="p-4 text-center text-zinc-500">Betöltés...</div>
                                    ) : agents.map((agent) => (
                                        <div
                                            key={agent.name}
                                            onClick={() => {
                                                setSelectedAgent(agent.name)
                                                subscribeToLogs(agent.name)
                                            }}
                                            className={cn(
                                                'p-4 cursor-pointer transition-colors hover:bg-white/[0.03]',
                                                selectedAgent === agent.name ? 'bg-white/[0.04] border-l-4 border-cyan-400' : ''
                                            )}
                                        >
                                            <div className="flex items-center justify-between mb-1">
                                                <span className="font-semibold text-sm text-zinc-100">{agent.name}</span>
                                                <Badge
                                                    variant={agent.status === 'working' ? 'default' : 'secondary'}
                                                    className="text-[10px] uppercase tracking-[0.18em] bg-white/[0.06] text-zinc-100 border border-white/[0.08]"
                                                >
                                                    {agent.status}
                                                </Badge>
                                            </div>
                                            <p className="text-xs text-zinc-500 line-clamp-1">{agent.description}</p>
                                        </div>
                                    ))}
                                </div>
                            </ScrollArea>
                        </CardContent>
                    </Card>
                </div>

                {/* Control & Logs Panel */}
                <div className="lg:col-span-2 space-y-6">
                    {selectedAgent ? (
                        <>
                            <Card className="glass-card border-white/10 overflow-hidden">
                                <CardHeader className="bg-white/[0.015] border-b border-white/[0.05]">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <CardTitle className="text-lg font-semibold text-zinc-100">{selectedAgent}</CardTitle>
                                            <CardDescription className="text-zinc-500">Közvetlen feladat végrehajtás</CardDescription>
                                        </div>
                                        <Badge variant="outline" className="gap-1 border-cyan-400/20 bg-cyan-400/10 text-cyan-100">
                                            <Activity className="w-3 h-3 text-cyan-300" /> Aktív
                                        </Badge>
                                    </div>
                                </CardHeader>
                                <CardContent className="p-6 space-y-4">
                                    <div className="flex gap-2">
                                        <input
                                            type="text"
                                            placeholder="Írd be a feladatot (pl. 'Írj egy hello world scriptet')"
                                            className="flex-1 rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-cyan-400/50"
                                            value={taskInput}
                                            onChange={(e) => setTaskInput(e.target.value)}
                                            onKeyDown={(e) => e.key === 'Enter' && handleExecute()}
                                            disabled={executing}
                                        />
                                        <Button onClick={handleExecute} disabled={executing || !taskInput.trim()} className="gap-2 rounded-xl bg-cyan-500 text-slate-950 hover:bg-cyan-400">
                                            <Play className="w-4 h-4 fill-current" />
                                            {executing ? 'Futtatás...' : 'Küldés'}
                                        </Button>
                                    </div>
                                    {executing && <Progress value={100} className="h-1 animate-pulse" />}
                                </CardContent>
                            </Card>

                            <Card className="glass-card border-white/10 flex flex-col min-h-[400px] overflow-hidden">
                                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3 border-b border-white/[0.05] bg-white/[0.015]">
                                    <CardTitle className="text-[11px] font-mono font-semibold flex items-center gap-2 text-zinc-400 uppercase tracking-[0.28em]">
                                        <Terminal className="w-4 h-4 text-violet-300" />
                                        Agent Logs: {selectedAgent}
                                    </CardTitle>
                                    <Button variant="ghost" size="icon" onClick={clearLogs} className="h-8 w-8 text-zinc-500 hover:text-destructive" aria-label="Clear logs" title="Clear logs">
                                        <Trash2 className="w-4 h-4" />
                                    </Button>
                                </CardHeader>
                                <CardContent className="p-0 flex-1 relative">
                                    <ScrollArea
                                        ref={logScrollAreaRef}
                                        className="h-[350px] w-full bg-white/[0.02] p-4 font-mono text-[12px]"
                                    >
                                        <div className="space-y-1">
                                            {logs.map((log, i) => (
                                                <div key={i} className={`whitespace-pre-wrap ${log.includes('HIBA') || log.includes('error') ? 'text-red-400' :
                                                    log.includes('---') ? 'text-cyan-400' :
                                                        log.includes('<<<') ? 'text-green-400' :
                                                            'text-slate-300'
                                                    }`}>
                                                    {log}
                                                </div>
                                            ))}
                                            <div ref={logEndRef} />
                                        </div>
                                    </ScrollArea>
                                </CardContent>
                            </Card>
                        </>
                    ) : (
                        <Card className="glass-card h-full flex flex-col items-center justify-center p-12 text-center text-zinc-500">
                            <Brain className="w-16 h-16 mb-4 opacity-20" />
                            <h3 className="text-lg font-medium">Nincs kiválasztott ügynök</h3>
                            <p className="max-w-xs mt-2">Válassz egy ügynököt a bal oldali listából a vezérléshez és a naplók megtekintéséhez.</p>
                        </Card>
                    )}
                </div>
            </div>
        </div>
    )
}
