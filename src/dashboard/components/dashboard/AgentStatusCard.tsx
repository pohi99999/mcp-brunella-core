import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { CaretDown, CaretUp, Lightning, Play, ShareNetwork, PencilSimple, Plus, X } from '@phosphor-icons/react'
import { cn } from '@/lib/utils'
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
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'

export type AgentStatus = 'idle' | 'working' | 'error'

interface AgentStatusCardProps {
  agent: RegistryAgent
  status: AgentStatus
  taskDescription?: string
  onExecute?: (agentName: string, task: string) => void
  allAgents?: RegistryAgent[] // For delegation list
}

export function AgentStatusCard({ agent, status, taskDescription, onExecute, allAgents = [] }: AgentStatusCardProps) {
  const [expanded, setExpanded] = useState(false)
  const [quickTask, setQuickTask] = useState('')
  const [delegateOpen, setDelegateOpen] = useState(false)
  const [selectedDelegate, setSelectedDelegate] = useState<string>('')
  const [delegateTask, setDelegateTask] = useState('')

  // Capability Editing State
  const [capabilities, setCapabilities] = useState<string[]>(agent.capabilities || [])
  const [newCapability, setNewCapability] = useState('')
  const [isEditingCaps, setIsEditingCaps] = useState(false)

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
      const response = await fetch(`/api/agents/${agent.name}/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          task: `Delegate to ${selectedDelegate}: ${delegateTask}`,
          context: { delegatedTo: selectedDelegate }
        })
      });

      if (!response.ok) throw new Error('Delegation failed')

      toast.success(`Feladat delegálva ${selectedDelegate}-nek!`)
      setDelegateOpen(false)
      setDelegateTask('')
      setSelectedDelegate('')
    } catch {
      toast.error('Delegálás sikertelen')
    }
  }

  const handleAddCapability = async () => {
    if (!newCapability.trim()) return
    const updated = [...capabilities, newCapability.trim()]
    setCapabilities(updated)
    setNewCapability('')
    await saveCapabilities(updated)
  }

  const handleRemoveCapability = async (cap: string) => {
    const updated = capabilities.filter(c => c !== cap)
    setCapabilities(updated)
    await saveCapabilities(updated)
  }

  const saveCapabilities = async (caps: string[]) => {
    try {
      await fetch(`/api/agents/${agent.name}/capabilities`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ capabilities: caps })
      })
      toast.success('Képességek frissítve')
    } catch {
      toast.error('Hiba a mentéskor')
    }
  }

  return (
    <Card
      className={cn(
        'glass-card group',
        status === 'working' ? 'border-primary/30 shadow-[0_0_15px_rgba(139,92,246,0.1)]' : 'border-white/5'
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
              <span className="font-space font-bold tracking-wide text-zinc-100 group-hover:text-primary transition-colors">{agent.name}</span>
              <span className="text-[10px] font-mono text-zinc-500 uppercase">{agent.role || 'Agent'}</span>
            </div>
          </div>
          <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
            <Dialog open={delegateOpen} onOpenChange={setDelegateOpen}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <DialogTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-zinc-400 hover:text-accent hover:bg-accent/10 rounded-full" aria-label="Delegálás">
                      <ShareNetwork size={16} />
                    </Button>
                  </DialogTrigger>
                </TooltipTrigger>
                <TooltipContent>Delegálás</TooltipContent>
              </Tooltip>
              <DialogContent className="glass-panel border-white/10 sm:max-w-[425px]">
                <DialogHeader>
                  <DialogTitle className="text-foreground">Feladat Delegálás</DialogTitle>
                  <DialogDescription>
                    Válassz célügynököt és add meg a feladatot. {agent.name} fogja továbbítani.
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

            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  className="rounded-full p-1 text-zinc-500 hover:bg-white/5 hover:text-zinc-300 transition-colors cursor-pointer"
                  onClick={() => setExpanded(!expanded)}
                  aria-label={expanded ? 'Összecsuk' : 'Részletek'}
                >
                  {expanded ? <CaretUp size={18} /> : <CaretDown size={18} />}
                </button>
              </TooltipTrigger>
              <TooltipContent>{expanded ? 'Összecsuk' : 'Részletek'}</TooltipContent>
            </Tooltip>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0 space-y-2">
        {(taskDescription || agent.description) && (
          <p className="text-sm text-zinc-400 line-clamp-2 px-1 font-mono leading-relaxed">{taskDescription || agent.description}</p>
        )}

        {expanded && (
          <div className="space-y-4 pt-3 border-t border-white/5 mt-2 animate-in slide-in-from-top-2 duration-300" onClick={(e) => e.stopPropagation()}>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                  <Lightning size={10} className="text-yellow-500" />
                  Capabilities
                </span>
                <Popover open={isEditingCaps} onOpenChange={setIsEditingCaps}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <PopoverTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-5 w-5 text-zinc-500 hover:text-zinc-300" aria-label="Képességek szerkesztése">
                          <PencilSimple size={12} />
                        </Button>
                      </PopoverTrigger>
                    </TooltipTrigger>
                    <TooltipContent>Képességek szerkesztése</TooltipContent>
                  </Tooltip>
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
                        {capabilities.map(cap => (
                          <Badge key={cap} variant="secondary" className="text-[10px] gap-1 pr-1">
                            {cap}
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <button
                                  type="button"
                                  className="cursor-pointer hover:text-red-400 focus:outline-none focus:text-red-400 rounded-sm"
                                  onClick={() => handleRemoveCapability(cap)}
                                  aria-label={`Törlés: ${cap}`}
                                >
                                  <X size={10} />
                                </button>
                              </TooltipTrigger>
                              <TooltipContent>Képesség törlése</TooltipContent>
                            </Tooltip>
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {capabilities?.length > 0 ? (
                  capabilities.map((cap) => (
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
                    placeholder="Execute quick task..."
                    className="w-full rounded-md border border-white/10 bg-black/20 px-3 py-1.5 text-xs text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-primary/50 transition-colors font-mono"
                    value={quickTask}
                    onChange={(e) => setQuickTask(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleQuickRun()}
                  />
                  <div className="absolute right-1 top-1/2 -translate-y-1/2 text-[10px] text-zinc-600 font-mono pointer-events-none">
                    ENTER
                  </div>
                </div>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span tabIndex={(!quickTask.trim() || status === 'working') ? 0 : -1} className="inline-flex outline-none">
                      <Button
                        size="sm"
                        variant="default"
                        className="shrink-0 h-auto py-1 bg-primary hover:bg-primary/90 text-primary-foreground"
                        onClick={handleQuickRun}
                        disabled={!quickTask.trim() || status === 'working'}
                        aria-label="Gyors futtatás"
                      >
                        <Play size={12} weight="fill" />
                      </Button>
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>Gyors futtatás</TooltipContent>
                </Tooltip>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
