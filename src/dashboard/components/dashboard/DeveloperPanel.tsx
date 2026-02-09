/**
 * DeveloperPanel.tsx — Developer Agent 3.0 Dashboard Panel
 *
 * Tartalom:
 * 1. Prompt input + „Generálj" gomb
 * 2. Pipeline progress (fázisonkénti vizualizáció)
 * 3. One-Click műveletek (Generate, Test, Fix, Heal)
 * 4. Feladat történet táblázat
 */

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Code2,
  Play,
  TestTube2,
  Wrench,
  HeartPulse,
  Send,
  RefreshCw,
  Clock,
  CheckCircle2,
  XCircle,
  Activity,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { DeveloperPipeline, type PipelinePhaseView } from './DeveloperPipeline'
import { toast } from 'sonner'

// ==================== Types ====================

interface PipelineData {
  taskId: string
  task: string
  status: string
  phases: PipelinePhaseView[]
  createdAt: number
  completedAt?: number
  error?: string
}

interface DevStatus {
  activeTasks: number
  completedTasks: number
  failedTasks: number
  totalTasks: number
}

interface HistoryEntry {
  taskId: string
  task: string
  status: string
  createdAt: number
  completedAt?: number
}

// ==================== API helpers ====================

const API_PREFIX = '/api/v1/developer'

async function devApiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_PREFIX}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  const data = await response.json()
  if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`)
  return data as T
}

async function executeDeveloperTask(
  task: string,
  context?: Record<string, unknown>
): Promise<{ taskId: string }> {
  return devApiFetch('/execute', {
    method: 'POST',
    body: JSON.stringify({ task, context }),
  })
}

// ==================== Component ====================

export function DeveloperPanel() {
  const [prompt, setPrompt] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [activePipeline, setActivePipeline] = useState<PipelineData | null>(null)
  const [history, setHistory] = useState<HistoryEntry[]>([])
  const [status, setStatus] = useState<DevStatus | null>(null)

  // Fetch status and history on mount
  const refreshData = useCallback(async () => {
    try {
      const [statusResult, historyResult] = await Promise.all([
        devApiFetch<DevStatus>('/status').catch(() => null),
        devApiFetch<{ history: HistoryEntry[] }>('/history?limit=15').catch(() => ({ history: [] })),
      ])
      if (statusResult) setStatus(statusResult)
      setHistory(historyResult.history)
    } catch {
      // ignore
    }
  }, [])

  useEffect(() => {
    refreshData()
    const interval = setInterval(refreshData, 5000)
    return () => clearInterval(interval)
  }, [refreshData])

  // Poll active pipeline
  useEffect(() => {
    if (!activePipeline || activePipeline.status === 'done' || activePipeline.status === 'error') return

    const interval = setInterval(async () => {
      try {
        const result = await devApiFetch<{ pipeline: PipelineData }>(
          `/pipeline/${activePipeline.taskId}`
        )
        setActivePipeline(result.pipeline)

        if (result.pipeline.status === 'done') {
          toast.success('Task completed!')
          refreshData()
        } else if (result.pipeline.status === 'error') {
          toast.error(`Task failed: ${result.pipeline.error || 'Unknown error'}`)
          refreshData()
        }
      } catch {
        // ignore polling errors
      }
    }, 1000)

    return () => clearInterval(interval)
  }, [activePipeline, refreshData])

  const handleSubmit = async (taskOverride?: string) => {
    const task = taskOverride || prompt.trim()
    if (!task) return

    setIsLoading(true)
    try {
      const { taskId } = await executeDeveloperTask(task)
      toast.info(`Pipeline started: ${taskId.slice(0, 15)}...`)

      // Fetch initial pipeline state
      const result = await devApiFetch<{ pipeline: PipelineData }>(`/pipeline/${taskId}`)
      setActivePipeline(result.pipeline)
      setPrompt('')
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to start task')
    } finally {
      setIsLoading(false)
    }
  }

  const handleQuickAction = (action: string) => {
    handleSubmit(action)
  }

  const calculateProgress = (pipeline: PipelineData): number => {
    const total = pipeline.phases.length
    const done = pipeline.phases.filter(p => p.status === 'done' || p.status === 'skipped').length
    const running = pipeline.phases.filter(p => p.status === 'running').length
    return Math.round(((done + running * 0.5) / total) * 100)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-lg font-bold">
          <Code2 size={20} className="text-primary" />
          Developer Agent
        </h2>
        <div className="flex items-center gap-2">
          {status && (
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Activity size={12} className="text-blue-500" />
                {status.activeTasks} active
              </span>
              <span className="flex items-center gap-1">
                <CheckCircle2 size={12} className="text-green-500" />
                {status.completedTasks} done
              </span>
              <span className="flex items-center gap-1">
                <XCircle size={12} className="text-red-500" />
                {status.failedTasks} failed
              </span>
            </div>
          )}
          <Button variant="ghost" size="sm" onClick={refreshData}>
            <RefreshCw size={14} />
          </Button>
        </div>
      </div>

      {/* Prompt Input */}
      <Card className="glass-card">
        <CardContent className="p-4">
          <div className="flex gap-2">
            <input
              type="text"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSubmit()}
              placeholder="Describe what you want to build... (e.g., 'generate a REST API for user management')"
              className="flex-1 bg-transparent border border-border rounded-lg px-4 py-2.5 text-sm
                         focus:outline-none focus:ring-2 focus:ring-primary/50 placeholder:text-muted-foreground/50"
              disabled={isLoading}
            />
            <Button
              onClick={() => handleSubmit()}
              disabled={!prompt.trim() || isLoading}
              className="gap-2"
            >
              <Send size={14} />
              Generate
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Button
          variant="outline"
          className="gap-2 h-auto py-3"
          onClick={() => handleQuickAction('generate code: create a utility module')}
          disabled={isLoading}
        >
          <Play size={16} className="text-green-500" />
          <div className="text-left">
            <div className="text-xs font-medium">Generate</div>
            <div className="text-[10px] text-muted-foreground">Create code</div>
          </div>
        </Button>
        <Button
          variant="outline"
          className="gap-2 h-auto py-3"
          onClick={() => handleQuickAction('generate vitest tests for the latest changes')}
          disabled={isLoading}
        >
          <TestTube2 size={16} className="text-blue-500" />
          <div className="text-left">
            <div className="text-xs font-medium">Test</div>
            <div className="text-[10px] text-muted-foreground">Write tests</div>
          </div>
        </Button>
        <Button
          variant="outline"
          className="gap-2 h-auto py-3"
          onClick={() => handleQuickAction('fix all build errors automatically')}
          disabled={isLoading}
        >
          <Wrench size={16} className="text-orange-500" />
          <div className="text-left">
            <div className="text-xs font-medium">Fix</div>
            <div className="text-[10px] text-muted-foreground">Auto-repair</div>
          </div>
        </Button>
        <Button
          variant="outline"
          className="gap-2 h-auto py-3"
          onClick={() => handleQuickAction('self-heal: fix all build errors and ensure npm run build succeeds')}
          disabled={isLoading}
        >
          <HeartPulse size={16} className="text-red-500" />
          <div className="text-left">
            <div className="text-xs font-medium">Heal</div>
            <div className="text-[10px] text-muted-foreground">Self-repair</div>
          </div>
        </Button>
      </div>

      {/* Active Pipeline */}
      {activePipeline && activePipeline.status !== 'done' && activePipeline.status !== 'error' && (
        <Card className="glass-card border-blue-500/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Activity size={14} className="text-blue-500 animate-pulse" />
              Active Pipeline
              <span className="text-xs text-muted-foreground font-normal ml-auto">
                {activePipeline.taskId.slice(0, 20)}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <p className="text-xs text-muted-foreground mb-3 truncate">
              {activePipeline.task}
            </p>
            <DeveloperPipeline
              phases={activePipeline.phases}
              progress={calculateProgress(activePipeline)}
            />
          </CardContent>
        </Card>
      )}

      {/* Last completed pipeline */}
      {activePipeline && (activePipeline.status === 'done' || activePipeline.status === 'error') && (
        <Card className={cn(
          'glass-card',
          activePipeline.status === 'done' ? 'border-green-500/30' : 'border-red-500/30'
        )}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              {activePipeline.status === 'done' ? (
                <CheckCircle2 size={14} className="text-green-500" />
              ) : (
                <XCircle size={14} className="text-red-500" />
              )}
              Last Result: {activePipeline.status === 'done' ? 'Success' : 'Failed'}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <p className="text-xs text-muted-foreground mb-3 truncate">
              {activePipeline.task}
            </p>
            <DeveloperPipeline
              phases={activePipeline.phases}
              progress={calculateProgress(activePipeline)}
            />
            {activePipeline.error && (
              <p className="text-xs text-red-400 mt-2">{activePipeline.error}</p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Task History */}
      <Card className="glass-card">
        <CardHeader className="pb-3 border-b border-border/50">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Clock size={14} className="text-muted-foreground" />
            Task History
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="h-[280px]">
            {history.length === 0 ? (
              <div className="p-6 text-center text-sm text-muted-foreground">
                No developer tasks yet. Use the prompt above to start.
              </div>
            ) : (
              <div className="divide-y divide-border/50">
                {history.map((entry) => (
                  <div
                    key={entry.taskId}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-muted/50 transition-colors"
                  >
                    <div className="shrink-0">
                      {entry.status === 'done' ? (
                        <CheckCircle2 size={14} className="text-green-500" />
                      ) : entry.status === 'error' ? (
                        <XCircle size={14} className="text-red-500" />
                      ) : (
                        <Clock size={14} className="text-yellow-500" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm truncate">{entry.task}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(entry.createdAt).toLocaleTimeString()}
                        {entry.completedAt && (
                          <span className="ml-2">
                            ({((entry.completedAt - entry.createdAt) / 1000).toFixed(1)}s)
                          </span>
                        )}
                      </p>
                    </div>
                    <span
                      className={cn(
                        'text-xs font-medium px-2 py-0.5 rounded-full',
                        entry.status === 'done' && 'bg-green-500/10 text-green-500',
                        entry.status === 'error' && 'bg-red-500/10 text-red-500',
                        !['done', 'error'].includes(entry.status) && 'bg-yellow-500/10 text-yellow-500'
                      )}
                    >
                      {entry.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  )
}
