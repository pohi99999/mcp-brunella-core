import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { CaretDown, CaretUp, Lightning, Play, ShareNetwork, PencilSimple, Plus, X } from '@phosphor-icons/react'
import { cn } from '@/lib/utils'
import * as api from '@/lib/apiService'
import type { RegistryAgent } from '@/lib/apiService'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import agentCapsHu from '../../data/agentCapabilities_hu.json'

export type AgentStatus = 'idle' | 'working' | 'error'

interface AgentStatusCardProps {
  agent?: RegistryAgent  // Optional to prevent crashes
  status?: AgentStatus
  taskDescription?: string
  onExecute?: (agentName: string, task: string) => void
  allAgents?: RegistryAgent[] // For delegation list
}

export function AgentStatusCard({ agent, status = 'idle', taskDescription, onExecute, allAgents = [] }: AgentStatusCardProps) {
  // All hooks MUST be called unconditionally (Rules of Hooks)
  const [expanded, setExpanded] = useState(false)
  const [quickTask, setQuickTask] = useState('')
  const [delegateOpen, setDelegateOpen] = useState(false)
  const [selectedDelegate, setSelectedDelegate] = useState<string>('')
  const [delegateTask, setDelegateTask] = useState('')
  const [capabilities, setCapabilities] = useState<string[]>([])
  const [newCapability, setNewCapability] = useState('')
  const [isEditingCaps, setIsEditingCaps] = useState(false)

  // Early return if no agent provided (after hooks)
  if (!agent) {
    return (
      <Card className="bg-zinc-950/40 border-zinc-800/50 rounded-lg">
        <CardHeader>
          <CardTitle className="text-[11px] font-medium tracking-wider uppercase text-zinc-500">No Agent Loaded</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-zinc-500">Agent data is not available</p>
        </CardContent>
      </Card>
    )
  }

  // Hungarian data fallback
  const huData = (agentCapsHu as Record<string, { title?: string; description?: string; capabilities?: string[] }>)[agent.name] || {};
  const displayTitle = huData.title || agent.name;
  const displayRole = huData.description ? "Specializált Ügynök" : (agent.role || 'Agent');
  const displayDescription = huData.description || agent.description;
  const displayCapabilities = huData.capabilities || agent.capabilities || [];

  // Sync capabilities from agent data if not yet set
  const effectiveCaps = capabilities.length > 0 ? capabilities : displayCapabilities;

  const statusConfig = {
    idle: {
      label: 'Idle',
      color: 'bg-zinc-500',
      pulse: false,
      badge: 'secondary',
    },
    working: {
      label: 'Working',
      color: 'bg-emerald-500',
      pulse: true,
      badge: 'default',
    },
    error: {
      label: 'Error',
      color: 'bg-red-500',
      pulse: false,
      badge: 'destructive',
    },
  }

  const config = statusConfig[status]

  const handleQuickRun = () => {
    if (quickTask.trim() && onExecute) {
      onExecute(agent.name, quickTask.trim())
      setQuickTask('')
    }
  }

  const handleDelegate = async () => {
    if (!selectedDelegate || !delegateTask.trim()) return

    try {
      await api.executeAgent(
        agent.name,
        `Delegate to ${selectedDelegate}: ${delegateTask}`,
        { delegatedTo: selectedDelegate }
      )
      toast.success(`Feladat delegálva ${selectedDelegate}-nek!`)
      setDelegateOpen(false)
      setDelegateTask('')
      setSelectedDelegate('')
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Delegálás sikertelen'
      toast.error(msg)
    }
  }

  const handleAddCapability = () => {
    if (!newCapability.trim()) return
    const updated = [...effectiveCaps, newCapability.trim()]
    setCapabilities(updated)
    setNewCapability('')
    toast.success('Képesség hozzáadva (session-szintű)')
  }

  const handleRemoveCapability = (cap: string) => {
    const updated = effectiveCaps.filter(c => c !== cap)
    setCapabilities(updated)
  }

  return (
    <Card
      className={cn(
        'bg-zinc-950/40 border-zinc-800/50 rounded-lg group h-full flex flex-col',
        status === 'working' ? 'border-primary/30 shadow-[0_0_15px_rgba(139,92,246,0.1)]' : ''
      )}
      onClick={() => setExpanded(!expanded)}
    >
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between gap-3 text-base font-medium">
          <div className="flex items-center gap-3">
            <span
              className={cn(
                'h-2.5 w-2.5 rounded-full shrink-0',
                config.color,
                config.pulse && 'animate-pulse shadow-[0_0_8px_currentColor]',
              )}
              aria-hidden
            />
            <div className="flex flex-col">
              <span className="text-[11px] font-medium tracking-wider uppercase text-zinc-500 group-hover:text-primary transition-colors">{displayTitle}</span>
              <span className="text-[10px] font-mono text-zinc-500 uppercase">{displayRole}</span>
            </div>
          </div>
          <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
            <Dialog open={delegateOpen} onOpenChange={setDelegateOpen}>
              <DialogTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-zinc-400 hover:text-accent hover:bg-accent/10 rounded-full" title="Delegálás" aria-label="Feladat delegálása">
                  <ShareNetwork size={16} />
                </Button>
              </DialogTrigger>
              <DialogContent className="glass-panel border-white/10 sm:max-w-[425px]">
                <DialogHeader>
                  <DialogTitle className="text-foreground">Feladat Delegálás</DialogTitle>
                  <DialogDescription>
                    Válassz célügynököt és add meg a feladatot. {displayTitle} fogja továbbítani.
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                    <Label htmlFor="target-agent" className="text-zinc-300">Cél Ügynök</Label>
                    <select
                      id="target-agent"
                      className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 text-zinc-100"
                      value={selectedDelegate}
                      onChange={(e) => setSelectedDelegate(e.target.value)}
                    >
                      <option value="" disabled>Válassz ügynököt...</option>
                      {allAgents.filter(a => a.name !== agent.name).map(a => (
                        <option key={a.name} value={a.name} className="bg-zinc-900">{a.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="task" className="text-zinc-300">Feladat</Label>
                    <Input
                      id="task"
                      value={delegateTask}
                      onChange={(e) => setDelegateTask(e.target.value)}
                      className="bg-white/5 border-white/10 text-zinc-100"
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button onClick={handleDelegate} className="bg-accent text-accent-foreground hover:bg-accent/90">Küldés</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <button
              className="rounded-full p-1 text-zinc-500 hover:bg-white/5 hover:text-zinc-300 transition-colors"
              aria-label={expanded ? 'Összecsuk' : 'Részletek'}
            >
              {expanded ? <CaretUp size={18} /> : <CaretDown size={18} />}
            </button>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0 space-y-2 flex-1 overflow-auto">
        {(taskDescription || displayDescription) && (
          <p className="text-sm text-zinc-400 line-clamp-2 px-1 font-mono leading-relaxed">{taskDescription || displayDescription}</p>
        )}

        {expanded && (
          <div className="space-y-4 pt-3 border-t border-white/5 mt-2 animate-in slide-in-from-top-2 duration-300" onClick={(e) => e.stopPropagation()}>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                  <Lightning size={10} className="text-yellow-500" />
                  Képességek (Capabilities)
                </span>
                <Popover open={isEditingCaps} onOpenChange={setIsEditingCaps}>
                  <PopoverTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-5 w-5 text-zinc-500 hover:text-zinc-300" title="Képességek szerkesztése" aria-label="Képességek szerkesztése">
                      <PencilSimple size={12} />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-80 glass-panel border-white/10 p-3">
                    <div className="space-y-3">
                      <h4 className="font-medium text-sm text-zinc-100">Képességek Szerkesztése</h4>
                      <div className="flex gap-2">
                        <Input
                          value={newCapability}
                          onChange={(e) => setNewCapability(e.target.value)}
                          placeholder="Új képesség..."
                          className="h-8 text-xs bg-white/5 border-white/10"
                        />
                        <Button size="sm" onClick={handleAddCapability} className="h-8 w-8 p-0"><Plus size={14} /></Button>
                      </div>
                      <div className="flex flex-wrap gap-1 max-h-[200px] overflow-y-auto">
                        {effectiveCaps.map(cap => (
                          <Badge key={cap} variant="secondary" className="text-[10px] gap-1 pr-1">
                            {cap}
                            <X
                              size={10}
                              className="cursor-pointer hover:text-red-400"
                              onClick={() => handleRemoveCapability(cap)}
                            />
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {effectiveCaps.length > 0 ? (
                  effectiveCaps.map((cap) => (
                    <Badge key={cap} variant="outline" className="text-[10px] font-mono text-cyan-400/90 border-cyan-500/20 bg-cyan-500/5 px-2 py-0.5">
                      {cap}
                    </Badge>
                  ))
                ) : (
                  <span className="text-xs text-zinc-600 italic">No capabilities listed</span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-4 text-xs text-zinc-500 pt-2 border-t border-white/5">
              <span className="flex items-center gap-1.5">
                <div className={`w-1.5 h-1.5 rounded-full ${agent.priority <= 1 ? 'bg-red-500' : 'bg-blue-500'}`} />
                Priority: <span className="text-zinc-300 font-mono">{agent.priority}</span>
              </span>
              {agent.autoStart && (
                <Badge variant="secondary" className="text-[10px] bg-white/10 text-zinc-300 hover:bg-white/20 border-0">
                  Auto-start
                </Badge>
              )}
            </div>

            {onExecute && (
              <div className="flex gap-2 pt-2">
                <div className="relative flex-1">
                  <input
                    type="text"
                    placeholder="Gyors parancs..."
                    className="w-full rounded-md border border-white/10 bg-black/20 px-3 py-1.5 text-xs text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-primary/50 transition-colors font-mono"
                    value={quickTask}
                    onChange={(e) => setQuickTask(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleQuickRun()}
                  />
                  <div className="absolute right-1 top-1/2 -translate-y-1/2 text-[10px] text-zinc-600 font-mono pointer-events-none">
                    ENTER
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="default"
                  className="shrink-0 h-auto py-1 bg-primary hover:bg-primary/90 text-primary-foreground"
                  onClick={handleQuickRun}
                  disabled={!quickTask.trim() || status === 'working'}
                >
                  <Play size={12} weight="fill" />
                </Button>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
