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

    const fetchAgents = async () => {
        try {
            const data = await getAgentStatuses()
            setAgents(data as AgentStatus[])
        } catch (err: any) {
            toast.error(`Nem sikerült betölteni az ügynököket: ${err.message}`)
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
        if (logEndRef.current) {
            logEndRef.current.scrollIntoView({ behavior: 'smooth' })
        }
    }, [logs])

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
        } catch (err: any) {
            toast.error(`Végrehajtási hiba: ${err.message}`)
            setLogs((prev: string[]) => [...prev, `!!! HIBA: ${err.message}`])
        } finally {
            setExecuting(false)
        }
    }

    const clearLogs = () => setLogs([])

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-space font-bold text-foreground">Agent Management</h2>
                    <p className="text-muted-foreground mt-1">AI ügynökök felügyelete és közvetlen vezérlése.</p>
                </div>
                <Button onClick={fetchAgents} variant="outline" size="sm" className="gap-2">
                    <Clock className="w-4 h-4" /> Frissítés
                </Button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Registry & Status List */}
                <div className="lg:col-span-1 space-y-4">
                    <Card className="glass-card">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-sm uppercase tracking-wider text-muted-foreground">
                                <Brain className="w-4 h-4 text-primary" />
                                Regisztrált Ügynökök
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-0">
                            <ScrollArea className="h-[500px]">
                                <div className="divide-y divide-border/50">
                                    {loading ? (
                                        <div className="p-4 text-center text-muted-foreground">Betöltés...</div>
                                    ) : agents.map((agent) => (
                                        <div
                                            key={agent.name}
                                            onClick={() => {
                                                setSelectedAgent(agent.name)
                                                subscribeToLogs(agent.name)
                                            }}
                                            className={`p-4 cursor-pointer transition-colors hover:bg-muted/50 ${selectedAgent === agent.name ? 'bg-muted border-l-4 border-primary' : ''}`}
                                        >
                                            <div className="flex items-center justify-between mb-1">
                                                <span className="font-bold text-sm">{agent.name}</span>
                                                <Badge variant={agent.status === 'working' ? 'default' : 'secondary'} className="text-[10px]">
                                                    {agent.status}
                                                </Badge>
                                            </div>
                                            <p className="text-xs text-muted-foreground line-clamp-1">{agent.description}</p>
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
                            <Card className="glass-card overflow-hidden">
                                <CardHeader className="bg-muted/30 border-b border-border/50">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <CardTitle className="text-xl font-bold">{selectedAgent}</CardTitle>
                                            <CardDescription>Közvetlen feladat végrehajtás</CardDescription>
                                        </div>
                                        <Badge variant="outline" className="gap-1">
                                            <Activity className="w-3 h-3 text-cyan-400" /> Aktív
                                        </Badge>
                                    </div>
                                </CardHeader>
                                <CardContent className="p-6 space-y-4">
                                    <div className="flex gap-2">
                                        <input
                                            type="text"
                                            placeholder="Írd be a feladatot (pl. 'Írj egy hello world scriptet')"
                                            className="flex-1 bg-background border border-border/50 rounded-md px-4 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                                            value={taskInput}
                                            onChange={(e) => setTaskInput(e.target.value)}
                                            onKeyDown={(e) => e.key === 'Enter' && handleExecute()}
                                            disabled={executing}
                                        />
                                        <Button onClick={handleExecute} disabled={executing || !taskInput.trim()} className="gap-2">
                                            <Play className="w-4 h-4 fill-current" />
                                            {executing ? 'Futtatás...' : 'Küldés'}
                                        </Button>
                                    </div>
                                    {executing && <Progress value={100} className="h-1 animate-pulse" />}
                                </CardContent>
                            </Card>

                            <Card className="glass-card flex-1 flex flex-col min-h-[400px]">
                                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3 border-b border-border/50">
                                    <CardTitle className="text-sm font-medium flex items-center gap-2 text-muted-foreground uppercase tracking-wider">
                                        <Terminal className="w-4 h-4" />
                                        Agent Logs: {selectedAgent}
                                    </CardTitle>
                                    <Button variant="ghost" size="icon" onClick={clearLogs} className="h-8 w-8 text-muted-foreground hover:text-destructive">
                                        <Trash2 className="w-4 h-4" />
                                    </Button>
                                </CardHeader>
                                <CardContent className="p-0 flex-1 relative">
                                    <ScrollArea className="h-[350px] w-full bg-black/40 p-4 font-mono text-[12px]">
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
                        <Card className="glass-card h-full flex flex-col items-center justify-center p-12 text-center text-muted-foreground">
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
