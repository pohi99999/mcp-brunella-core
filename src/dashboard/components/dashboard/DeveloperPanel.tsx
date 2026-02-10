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
import { Badge } from '@/components/ui/badge'
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
  Search,
  FileSearch,
  AlertTriangle,
  Info,
  Lightbulb,
  ShieldAlert,
  FolderOpen,
  ChevronDown,
  ChevronRight,
  BarChart3,
  ListTodo,
  X,
  RotateCw,
  Gauge,
  Bell,
  History,
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

// ==================== P4: Review Types & API ====================

interface ReviewFinding {
  severity: 'critical' | 'warning' | 'info' | 'suggestion'
  line?: number
  message: string
  rule?: string
  suggestion?: string
}

interface ReviewResult {
  filePath: string
  fileName: string
  language: string
  score: number
  summary: string
  findings: ReviewFinding[]
  stats: {
    critical: number
    warning: number
    info: number
    suggestion: number
    total: number
  }
  reviewedAt: number
}

async function reviewFile(filePath: string): Promise<ReviewResult> {
  const data = await devApiFetch<{ review: ReviewResult }>('/review', {
    method: 'POST',
    body: JSON.stringify({ filePath }),
  })
  return data.review
}

// ==================== P5: Context Types & API ====================

interface ContextFile {
  relativePath: string
  reason: string
  size: number
}

interface ContextResult {
  targetFile: string
  totalSize: number
  truncated: boolean
  files: ContextFile[]
}

async function gatherContext(filePath: string): Promise<ContextResult> {
  const data = await devApiFetch<{ context: ContextResult }>('/context', {
    method: 'POST',
    body: JSON.stringify({ filePath }),
  })
  return data.context
}

const SEVERITY_CONFIG: Record<string, { icon: typeof ShieldAlert; color: string; bg: string }> = {
  critical: { icon: ShieldAlert, color: 'text-red-500', bg: 'bg-red-500/10' },
  warning: { icon: AlertTriangle, color: 'text-yellow-500', bg: 'bg-yellow-500/10' },
  info: { icon: Info, color: 'text-blue-500', bg: 'bg-blue-500/10' },
  suggestion: { icon: Lightbulb, color: 'text-purple-400', bg: 'bg-purple-500/10' },
}

// ==================== P6: Coverage Types & API ====================

interface CoverageMetricData {
  total: number
  covered: number
  pct: number
}

interface CoverageSummaryData {
  totalFiles: number
  filesWithTests: number
  filesWithoutTests: number
  aggregate: {
    statements: CoverageMetricData
    branches: CoverageMetricData
    functions: CoverageMetricData
    lines: CoverageMetricData
  }
  worstFiles: Array<{
    relativePath: string
    lines: CoverageMetricData
    functions: CoverageMetricData
    uncoveredLines: number[]
  }>
  untestedFiles: string[]
  collectedAt: number
}

async function fetchCoverage(mode: 'run' | 'parse' = 'parse'): Promise<CoverageSummaryData> {
  const data = await devApiFetch<{ coverage: CoverageSummaryData }>('/coverage', {
    method: 'POST',
    body: JSON.stringify({ mode }),
  })
  return data.coverage
}

function CoverageBar({ pct }: { pct: number }) {
  const color = pct >= 80 ? 'bg-green-500' : pct >= 60 ? 'bg-yellow-500' : 'bg-red-500'
  return (
    <div className="w-20 h-2 bg-muted rounded-full overflow-hidden">
      <div className={cn('h-full rounded-full transition-all', color)} style={{ width: `${pct}%` }} />
    </div>
  )
}

// ==================== P7: Queue Types & API ====================

type QueueTaskStatus = 'queued' | 'running' | 'completed' | 'failed' | 'cancelled'
type QueueTaskPriority = 'high' | 'medium' | 'low'

interface QueuedTaskData {
  id: string
  type: string
  description: string
  priority: QueueTaskPriority
  status: QueueTaskStatus
  createdAt: number
  startedAt?: number
  completedAt?: number
  error?: string
}

interface QueueStatsData {
  total: number
  queued: number
  running: number
  completed: number
  failed: number
  cancelled: number
  avgWaitTime: number
  avgExecutionTime: number
}

async function fetchQueueTasks(filters?: { status?: string }): Promise<{ tasks: QueuedTaskData[]; stats: QueueStatsData }> {
  const params = filters?.status ? `?status=${filters.status}` : ''
  const data = await devApiFetch<{ tasks: QueuedTaskData[]; stats: QueueStatsData }>(`/queue${params}`)
  return data
}

async function cancelQueueTask(taskId: string): Promise<void> {
  await devApiFetch<{ task: QueuedTaskData; message: string }>(`/queue/${taskId}`, {
    method: 'PUT',
    body: JSON.stringify({ action: 'cancel' }),
  })
}

async function retryQueueTask(taskId: string): Promise<QueuedTaskData> {
  const data = await devApiFetch<{ task: QueuedTaskData; message: string }>(`/queue/${taskId}/retry`, {
    method: 'POST',
  })
  return data.task
}

// ==================== P10: Metrics Types & API ====================

type MetricsHistoryType = 'task' | 'build' | 'test'
type MetricsStatus = 'success' | 'fail' | 'error'

interface MetricsHistoryEntry {
  type: MetricsHistoryType
  status: MetricsStatus
  details: string
  durationMs: number
  timestamp: number
}

interface MetricsData {
  builds: {
    total: number
    success: number
    fail: number
    lastStatus: 'success' | 'fail' | 'unknown'
    lastDurationMs: number
    lastTimestamp?: number
  }
  tests: {
    totalRuns: number
    lastPassRate: number
    lastDurationMs: number
    lastTimestamp?: number
  }
  tasks: {
    total: number
    success: number
    error: number
    avgDurationMs: number
  }
  ai: {
    totalTokenUsage: number
    estimatedCost: number
  }
  history: MetricsHistoryEntry[]
}

async function fetchMetrics(): Promise<MetricsData> {
  const data = await devApiFetch<{ metrics: MetricsData }>('/metrics')
  return data.metrics
}

// ==================== P11: Approval Types & API ====================

type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'expired'

interface ApprovalRequest {
  id: string
  type: 'file_edit' | 'command_exec' | 'critical_action'
  description: string
  metadata?: Record<string, unknown>
  status: ApprovalStatus
  createdAt: number
  expiresAt: number
  response?: unknown
  respondedAt?: number
}

async function fetchApprovals(status?: ApprovalStatus): Promise<ApprovalRequest[]> {
  const qs = status ? `?status=${status}` : ''
  const data = await devApiFetch<{ requests: ApprovalRequest[] }>(`/approval${qs}`)
  return data.requests
}

async function respondApproval(id: string, action: 'approve' | 'reject', response?: unknown): Promise<void> {
  await devApiFetch(`/approval/${id}/respond`, {
    method: 'POST',
    body: JSON.stringify({ action, response }),
  })
}

// ==================== P12: Activity Feed Types & API ====================

type ActivityType = 'info' | 'success' | 'warning' | 'error' | 'approval'
type ActivitySource = 'system' | 'agent' | 'user' | 'pipeline' | 'git' | 'queue'

interface ActivityItem {
  id: string
  type: ActivityType
  source: ActivitySource
  message: string
  metadata?: Record<string, unknown>
  timestamp: string
}

async function fetchActivity(limit: number = 50): Promise<ActivityItem[]> {
  const data = await devApiFetch<{ activities: ActivityItem[] }>(`/feed?limit=${limit}`)
  return data.activities
}

// ==================== Component ====================

export function DeveloperPanel() {
  const [prompt, setPrompt] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [activePipeline, setActivePipeline] = useState<PipelineData | null>(null)
  const [history, setHistory] = useState<HistoryEntry[]>([])
  const [status, setStatus] = useState<DevStatus | null>(null)
  // P4: Code Review state
  const [reviewPath, setReviewPath] = useState('')
  const [isReviewing, setIsReviewing] = useState(false)
  const [reviewResult, setReviewResult] = useState<ReviewResult | null>(null)
  const [activeTab, setActiveTab] = useState<'build' | 'review' | 'coverage' | 'queue' | 'metrics' | 'approvals' | 'activity'>('build')
  // P5: Context state
  const [contextPath, setContextPath] = useState('')
  const [isGatheringContext, setIsGatheringContext] = useState(false)
  const [contextResult, setContextResult] = useState<ContextResult | null>(null)
  const [contextExpanded, setContextExpanded] = useState(false)
  // P6: Coverage state
  const [coverageData, setCoverageData] = useState<CoverageSummaryData | null>(null)
  const [isLoadingCoverage, setIsLoadingCoverage] = useState(false)
  // P7: Queue state
  const [queueTasks, setQueueTasks] = useState<QueuedTaskData[]>([])
  const [queueStats, setQueueStats] = useState<QueueStatsData | null>(null)
  const [isLoadingQueue, setIsLoadingQueue] = useState(false)
  // P10: Metrics state
  const [metricsData, setMetricsData] = useState<MetricsData | null>(null)
  const [isLoadingMetrics, setIsLoadingMetrics] = useState(false)
  // P11: Approvals state
  const [approvalFilter, setApprovalFilter] = useState<ApprovalStatus | undefined>('pending')
  const [approvals, setApprovals] = useState<ApprovalRequest[]>([])
  const [isLoadingApprovals, setIsLoadingApprovals] = useState(false)
  const [respondingId, setRespondingId] = useState<string | null>(null)
  // P12: Activity Feed state
  const [activities, setActivities] = useState<ActivityItem[]>([])
  const [isLoadingActivity, setIsLoadingActivity] = useState(false)
  const [activityLimit, setActivityLimit] = useState(30)

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

  const loadMetrics = useCallback(async () => {
    setIsLoadingMetrics(true)
    try {
      const data = await fetchMetrics()
      setMetricsData(data)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load metrics'
      toast.error(msg)
    } finally {
      setIsLoadingMetrics(false)
    }
  }, [])

  const loadApprovals = useCallback(async (status: ApprovalStatus | undefined = approvalFilter) => {
    setIsLoadingApprovals(true)
    try {
      const items = await fetchApprovals(status)
      setApprovals(items)
      if (status !== approvalFilter) {
        setApprovalFilter(status)
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load approvals'
      toast.error(msg)
    } finally {
      setIsLoadingApprovals(false)
    }
  }, [approvalFilter])

  const handleApprovalAction = async (id: string, action: 'approve' | 'reject') => {
    setRespondingId(id)
    try {
      await respondApproval(id, action)
      toast.success(action === 'approve' ? 'Approved' : 'Rejected')
      await loadApprovals(approvalFilter)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Action failed'
      toast.error(msg)
    } finally {
      setRespondingId(null)
    }
  }

  const loadActivity = useCallback(async (limit: number = activityLimit) => {
    setIsLoadingActivity(true)
    try {
      const data = await fetchActivity(limit)
      setActivities(data)
      setActivityLimit(limit)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load activity feed'
      toast.error(msg)
    } finally {
      setIsLoadingActivity(false)
    }
  }, [activityLimit])

  // Tab-change data loading effects (must be after useCallback definitions)
  useEffect(() => {
    if (activeTab === 'metrics') {
      if (!metricsData && !isLoadingMetrics) {
        loadMetrics()
      }
    } else if (activeTab === 'approvals') {
      if (!isLoadingApprovals) {
        loadApprovals(approvalFilter)
      }
    } else if (activeTab === 'activity') {
      if (!isLoadingActivity) {
        loadActivity(activityLimit)
      }
    }
  }, [activeTab, activityLimit, approvalFilter, isLoadingActivity, isLoadingApprovals, isLoadingMetrics, loadActivity, loadApprovals, loadMetrics, metricsData])

  useEffect(() => {
    if (activeTab !== 'activity') return
    const interval = setInterval(() => {
      loadActivity(activityLimit)
    }, 5000)
    return () => clearInterval(interval)
  }, [activeTab, activityLimit, loadActivity])

  // P4: Submit code review
  const handleReview = async () => {
    const path = reviewPath.trim()
    if (!path) return

    setIsReviewing(true)
    setReviewResult(null)
    try {
      const result = await reviewFile(path)
      setReviewResult(result)
      toast.success(`Review complete: ${result.score}/100`)
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Review failed')
    } finally {
      setIsReviewing(false)
    }
  }

  // Score color helper
  const getScoreColor = (score: number): string => {
    if (score >= 80) return 'text-green-500'
    if (score >= 60) return 'text-yellow-500'
    return 'text-red-500'
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

      {/* Tab Switcher */}
      <div className="flex gap-1 p-1 bg-muted/50 rounded-lg w-fit">
        <button
          onClick={() => setActiveTab('build')}
          className={cn(
            'px-4 py-1.5 rounded-md text-sm font-medium transition-colors',
            activeTab === 'build'
              ? 'bg-background shadow text-foreground'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          <span className="flex items-center gap-1.5">
            <Code2 size={14} /> Build
          </span>
        </button>
        <button
          onClick={() => setActiveTab('review')}
          className={cn(
            'px-4 py-1.5 rounded-md text-sm font-medium transition-colors',
            activeTab === 'review'
              ? 'bg-background shadow text-foreground'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          <span className="flex items-center gap-1.5">
            <FileSearch size={14} /> Review
          </span>
        </button>
        <button
          onClick={() => setActiveTab('coverage')}
          className={cn(
            'px-4 py-1.5 rounded-md text-sm font-medium transition-colors',
            activeTab === 'coverage'
              ? 'bg-background shadow text-foreground'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          <span className="flex items-center gap-1.5">
            <BarChart3 size={14} /> Coverage
          </span>
        </button>
        <button
          onClick={() => setActiveTab('queue')}
          className={cn(
            'px-4 py-1.5 rounded-md text-sm font-medium transition-colors',
            activeTab === 'queue'
              ? 'bg-background shadow text-foreground'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          <span className="flex items-center gap-1.5">
            <ListTodo size={14} /> Queue
          </span>
        </button>
        <button
          onClick={() => setActiveTab('metrics')}
          className={cn(
            'px-4 py-1.5 rounded-md text-sm font-medium transition-colors',
            activeTab === 'metrics'
              ? 'bg-background shadow text-foreground'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          <span className="flex items-center gap-1.5">
            <Gauge size={14} /> Metrics
          </span>
        </button>
        <button
          onClick={() => setActiveTab('approvals')}
          className={cn(
            'px-4 py-1.5 rounded-md text-sm font-medium transition-colors',
            activeTab === 'approvals'
              ? 'bg-background shadow text-foreground'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          <span className="flex items-center gap-1.5">
            <Bell size={14} /> Approvals
          </span>
        </button>
        <button
          onClick={() => setActiveTab('activity')}
          className={cn(
            'px-4 py-1.5 rounded-md text-sm font-medium transition-colors',
            activeTab === 'activity'
              ? 'bg-background shadow text-foreground'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          <span className="flex items-center gap-1.5">
            <History size={14} /> Activity
          </span>
        </button>
      </div>

      {/* ==================== BUILD TAB ==================== */}
      {activeTab === 'build' && (<>

        {/* P5: Context Gatherer */}
        <Card className="glass-card">
          <CardContent className="p-3">
            <button
              onClick={() => setContextExpanded(!contextExpanded)}
              className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors w-full"
            >
              {contextExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              <FolderOpen size={14} className="text-primary" />
              Context Files
              {contextResult && (
                <span className="text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded-full ml-auto">
                  {contextResult.files.length} files
                </span>
              )}
            </button>
            {contextExpanded && (
              <div className="mt-3 space-y-2">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={contextPath}
                    onChange={(e) => setContextPath(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        setIsGatheringContext(true)
                        gatherContext(contextPath)
                          .then((r) => { setContextResult(r); toast.success(`Found ${r.files.length} context files`) })
                          .catch((err: unknown) => { toast.error(err instanceof Error ? err.message : 'Context failed') })
                          .finally(() => setIsGatheringContext(false))
                      }
                    }}
                    placeholder="Enter file path to discover related files..."
                    className="flex-1 bg-transparent border border-border rounded-md px-3 py-1.5 text-xs
                             focus:outline-none focus:ring-1 focus:ring-primary/50 placeholder:text-muted-foreground/50"
                    disabled={isGatheringContext}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={!contextPath.trim() || isGatheringContext}
                    onClick={() => {
                      setIsGatheringContext(true)
                      gatherContext(contextPath)
                        .then((r) => { setContextResult(r); toast.success(`Found ${r.files.length} context files`) })
                        .catch((err: unknown) => { toast.error(err instanceof Error ? err.message : 'Context failed') })
                        .finally(() => setIsGatheringContext(false))
                    }}
                  >
                    {isGatheringContext ? <Activity size={12} className="animate-spin" /> : <Search size={12} />}
                  </Button>
                </div>
                {contextResult && contextResult.files.length > 0 && (
                  <ScrollArea className="h-[140px]">
                    <div className="space-y-1">
                      {contextResult.files.map((f, i) => (
                        <div
                          key={i}
                          className="flex items-center justify-between text-xs px-2 py-1.5 rounded hover:bg-muted/50 transition-colors"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <Code2 size={10} className="text-primary shrink-0" />
                            <span className="truncate font-mono">{f.relativePath}</span>
                          </div>
                          <div className="flex items-center gap-2 shrink-0 ml-2">
                            <span className="text-[10px] text-muted-foreground">{f.reason}</span>
                            <span className="text-[10px] text-muted-foreground/60">
                              {(f.size / 1024).toFixed(1)}K
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                )}
                {contextResult && (
                  <div className="flex items-center justify-between text-[10px] text-muted-foreground px-1">
                    <span>Total: {(contextResult.totalSize / 1024).toFixed(1)} KB</span>
                    {contextResult.truncated && (
                      <span className="text-yellow-500">⚠ Truncated</span>
                    )}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

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

      </>)}

      {/* ==================== REVIEW TAB ==================== */}
      {activeTab === 'review' && (<>

        {/* Review Input */}
        <Card className="glass-card">
          <CardContent className="p-4">
            <div className="flex gap-2">
              <input
                type="text"
                value={reviewPath}
                onChange={(e) => setReviewPath(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleReview()}
                placeholder="Enter file path to review (e.g., src/agents/DeveloperAgent.ts)"
                className="flex-1 bg-transparent border border-border rounded-lg px-4 py-2.5 text-sm
                         focus:outline-none focus:ring-2 focus:ring-primary/50 placeholder:text-muted-foreground/50"
                disabled={isReviewing}
              />
              <Button
                onClick={handleReview}
                disabled={!reviewPath.trim() || isReviewing}
                className="gap-2"
              >
                <Search size={14} />
                Review
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Review Loading */}
        {isReviewing && (
          <Card className="glass-card border-blue-500/30">
            <CardContent className="p-6 text-center">
              <Activity size={24} className="text-blue-500 animate-spin mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">Analyzing code quality...</p>
            </CardContent>
          </Card>
        )}

        {/* Review Results */}
        {reviewResult && !isReviewing && (
          <>
            {/* Score & Summary */}
            <Card className="glass-card">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <FileSearch size={14} className="text-primary" />
                    {reviewResult.fileName}
                    <span className="text-xs font-normal text-muted-foreground">
                      ({reviewResult.language})
                    </span>
                  </span>
                  <span className={cn('text-2xl font-bold', getScoreColor(reviewResult.score))}>
                    {reviewResult.score}/100
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <p className="text-sm text-muted-foreground mb-3">{reviewResult.summary}</p>
                {/* Stats row */}
                <div className="flex gap-3 text-xs">
                  <span className="flex items-center gap-1">
                    <ShieldAlert size={12} className="text-red-500" />
                    {reviewResult.stats.critical} critical
                  </span>
                  <span className="flex items-center gap-1">
                    <AlertTriangle size={12} className="text-yellow-500" />
                    {reviewResult.stats.warning} warnings
                  </span>
                  <span className="flex items-center gap-1">
                    <Info size={12} className="text-blue-500" />
                    {reviewResult.stats.info} info
                  </span>
                  <span className="flex items-center gap-1">
                    <Lightbulb size={12} className="text-purple-400" />
                    {reviewResult.stats.suggestion} suggestions
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* Findings List */}
            {reviewResult.findings.length > 0 && (
              <Card className="glass-card">
                <CardHeader className="pb-3 border-b border-border/50">
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <Search size={14} className="text-muted-foreground" />
                    Findings ({reviewResult.findings.length})
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <ScrollArea className="h-[340px]">
                    <div className="divide-y divide-border/50">
                      {reviewResult.findings.map((finding, i) => {
                        const config = SEVERITY_CONFIG[finding.severity] || SEVERITY_CONFIG.info
                        const Icon = config.icon
                        return (
                          <div key={i} className="px-4 py-3 hover:bg-muted/50 transition-colors">
                            <div className="flex items-start gap-2">
                              <span className={cn('shrink-0 mt-0.5', config.color)}>
                                <Icon size={14} />
                              </span>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className={cn(
                                    'text-[10px] font-medium px-1.5 py-0.5 rounded-full uppercase',
                                    config.bg, config.color
                                  )}>
                                    {finding.severity}
                                  </span>
                                  {finding.line && (
                                    <span className="text-xs text-muted-foreground">
                                      Line {finding.line}
                                    </span>
                                  )}
                                  {finding.rule && (
                                    <span className="text-[10px] text-muted-foreground font-mono">
                                      [{finding.rule}]
                                    </span>
                                  )}
                                </div>
                                <p className="text-sm mt-1">{finding.message}</p>
                                {finding.suggestion && (
                                  <p className="text-xs text-muted-foreground mt-1 italic">
                                    → {finding.suggestion}
                                  </p>
                                )}
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            )}
          </>
        )}

        {/* Empty state for review */}
        {!reviewResult && !isReviewing && (
          <Card className="glass-card">
            <CardContent className="p-8 text-center">
              <FileSearch size={32} className="text-muted-foreground/50 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">
                Enter a file path above to start an AI-powered code review.
              </p>
              <p className="text-xs text-muted-foreground/70 mt-1">
                The review analyzes code quality, security, patterns, and suggests improvements.
              </p>
            </CardContent>
          </Card>
        )}

      </>)}

      {/* ==================== COVERAGE TAB ==================== */}
      {activeTab === 'coverage' && (<>

        {/* Coverage Controls */}
        <Card className="glass-card">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BarChart3 size={16} className="text-primary" />
                <span className="text-sm font-medium">Test Coverage Analysis</span>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={isLoadingCoverage}
                  onClick={async () => {
                    setIsLoadingCoverage(true)
                    try {
                      const result = await fetchCoverage('parse')
                      setCoverageData(result)
                      toast.success('Coverage data loaded')
                    } catch (err: unknown) {
                      toast.error(err instanceof Error ? err.message : 'Failed to load coverage')
                    } finally {
                      setIsLoadingCoverage(false)
                    }
                  }}
                >
                  {isLoadingCoverage ? <Activity size={12} className="animate-spin" /> : <RefreshCw size={12} />}
                  <span className="ml-1.5">Load Existing</span>
                </Button>
                <Button
                  size="sm"
                  disabled={isLoadingCoverage}
                  onClick={async () => {
                    setIsLoadingCoverage(true)
                    try {
                      const result = await fetchCoverage('run')
                      setCoverageData(result)
                      toast.success('Coverage run complete')
                    } catch (err: unknown) {
                      toast.error(err instanceof Error ? err.message : 'Coverage run failed')
                    } finally {
                      setIsLoadingCoverage(false)
                    }
                  }}
                >
                  <Play size={12} />
                  <span className="ml-1.5">Run Coverage</span>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Coverage Loading */}
        {isLoadingCoverage && (
          <Card className="glass-card border-blue-500/30">
            <CardContent className="p-6 text-center">
              <Activity size={24} className="text-blue-500 animate-spin mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">Analyzing coverage...</p>
            </CardContent>
          </Card>
        )}

        {/* Coverage Results */}
        {coverageData && !isLoadingCoverage && (
          <>
            {/* Aggregate Metrics */}
            <Card className="glass-card">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <BarChart3 size={14} className="text-primary" />
                  Aggregate Coverage
                  <span className="ml-auto text-xs text-muted-foreground">
                    {coverageData.filesWithTests} / {coverageData.totalFiles} files
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0 space-y-2">
                {(['statements', 'branches', 'functions', 'lines'] as const).map(metric => {
                  const d = coverageData.aggregate[metric]
                  return (
                    <div key={metric} className="flex items-center gap-3 text-xs">
                      <span className="w-20 text-muted-foreground capitalize">{metric}</span>
                      <CoverageBar pct={d.pct} />
                      <span className={cn(
                        'w-10 text-right font-medium',
                        d.pct >= 80 ? 'text-green-500' : d.pct >= 60 ? 'text-yellow-500' : 'text-red-500'
                      )}>
                        {d.pct}%
                      </span>
                      <span className="text-muted-foreground/60">{d.covered}/{d.total}</span>
                    </div>
                  )
                })}
              </CardContent>
            </Card>

            {/* Worst Files */}
            {coverageData.worstFiles.length > 0 && (
              <Card className="glass-card">
                <CardHeader className="pb-3 border-b border-border/50">
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <AlertTriangle size={14} className="text-yellow-500" />
                    Lowest Coverage ({coverageData.worstFiles.length})
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <ScrollArea className="h-[200px]">
                    <div className="divide-y divide-border/50">
                      {coverageData.worstFiles.map((f, i) => (
                        <div key={i} className="px-4 py-2 hover:bg-muted/50 transition-colors">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-mono truncate flex-1">{f.relativePath}</span>
                            <div className="flex items-center gap-2 ml-2">
                              <CoverageBar pct={f.lines.pct} />
                              <span className={cn(
                                'text-xs font-medium w-10 text-right',
                                f.lines.pct >= 80 ? 'text-green-500' : f.lines.pct >= 60 ? 'text-yellow-500' : 'text-red-500'
                              )}>
                                {f.lines.pct}%
                              </span>
                            </div>
                          </div>
                          {f.uncoveredLines.length > 0 && f.uncoveredLines.length <= 10 && (
                            <p className="text-[10px] text-muted-foreground mt-0.5">
                              Uncovered: L{f.uncoveredLines.join(', L')}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            )}

            {/* Untested Files */}
            {coverageData.untestedFiles.length > 0 && (
              <Card className="glass-card border-red-500/20">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <XCircle size={14} className="text-red-500" />
                    Untested Files ({coverageData.untestedFiles.length})
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <ScrollArea className="h-[120px]">
                    <div className="space-y-1">
                      {coverageData.untestedFiles.map((f, i) => (
                        <div key={i} className="text-xs text-red-400 font-mono">{f}</div>
                      ))}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            )}
          </>
        )}

        {/* Empty state for coverage */}
        {!coverageData && !isLoadingCoverage && (
          <Card className="glass-card">
            <CardContent className="p-8 text-center">
              <BarChart3 size={32} className="text-muted-foreground/50 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">
                Click &quot;Load Existing&quot; to parse coverage data, or &quot;Run Coverage&quot; to generate fresh results.
              </p>
              <p className="text-xs text-muted-foreground/70 mt-1">
                Coverage analysis shows statement, branch, function, and line coverage metrics.
              </p>
            </CardContent>
          </Card>
        )}

      </>)}

      {/* ==================== P7: Queue Tab ==================== */}
      {activeTab === 'queue' && (<>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-semibold mb-1">Task Queue</h2>
            <p className="text-sm text-muted-foreground">
              Manage concurrent developer tasks (max 3 workers)
            </p>
          </div>
          <Button
            onClick={async () => {
              setIsLoadingQueue(true)
              try {
                const data = await fetchQueueTasks()
                setQueueTasks(data.tasks)
                setQueueStats(data.stats)
                toast.success('Queue refreshed')
              } catch (err: unknown) {
                const errMsg = err instanceof Error ? err.message : String(err)
                toast.error('Failed to load queue', { description: errMsg })
              } finally {
                setIsLoadingQueue(false)
              }
            }}
            disabled={isLoadingQueue}
            size="sm"
            variant="outline"
          >
            {isLoadingQueue ? 'Loading...' : 'Refresh Queue'}
          </Button>
        </div>

        {/* Queue Stats Cards */}
        {queueStats && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <Card className="glass-card">
              <CardContent className="p-4">
                <div className="text-sm text-muted-foreground mb-1">Queued</div>
                <div className="text-2xl font-bold text-yellow-500">{queueStats.queued}</div>
              </CardContent>
            </Card>
            <Card className="glass-card">
              <CardContent className="p-4">
                <div className="text-sm text-muted-foreground mb-1">Running</div>
                <div className="text-2xl font-bold text-blue-500">{queueStats.running}</div>
              </CardContent>
            </Card>
            <Card className="glass-card">
              <CardContent className="p-4">
                <div className="text-sm text-muted-foreground mb-1">Completed</div>
                <div className="text-2xl font-bold text-green-500">{queueStats.completed}</div>
              </CardContent>
            </Card>
            <Card className="glass-card">
              <CardContent className="p-4">
                <div className="text-sm text-muted-foreground mb-1">Failed</div>
                <div className="text-2xl font-bold text-red-500">{queueStats.failed}</div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Task List */}
        {queueTasks.length > 0 && (
          <Card className="glass-card">
            <CardContent className="p-0">
              <ScrollArea className="h-[500px]">
                <div className="divide-y divide-border">
                  {queueTasks.map((task) => (
                    <div key={task.id} className="p-4 hover:bg-accent/50 transition-colors">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-2">
                            <Badge
                              variant={
                                task.status === 'completed' ? 'default' :
                                  task.status === 'failed' ? 'destructive' :
                                    task.status === 'running' ? 'default' :
                                      task.status === 'cancelled' ? 'secondary' :
                                        'outline'
                              }
                              className={cn(
                                'text-xs',
                                task.status === 'queued' && 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
                                task.status === 'running' && 'bg-blue-500/10 text-blue-500 border-blue-500/20',
                                task.status === 'completed' && 'bg-green-500/10 text-green-500 border-green-500/20'
                              )}
                            >
                              {task.status.toUpperCase()}
                            </Badge>
                            <Badge variant="outline" className={cn(
                              'text-xs',
                              task.priority === 'high' && 'bg-red-500/10 text-red-500 border-red-500/30',
                              task.priority === 'medium' && 'bg-yellow-500/10 text-yellow-500 border-yellow-500/30',
                              task.priority === 'low' && 'bg-gray-500/10 text-gray-500 border-gray-500/30'
                            )}>
                              {task.priority === 'high' ? 'HIGH' : task.priority === 'medium' ? 'MED' : 'LOW'}
                            </Badge>
                            <span className="text-xs text-muted-foreground">{task.type}</span>
                          </div>
                          <p className="text-sm font-medium mb-1 truncate">{task.description}</p>
                          <div className="flex items-center gap-3 text-xs text-muted-foreground">
                            <span>ID: {task.id.slice(0, 8)}</span>
                            <span>Created: {new Date(task.createdAt).toLocaleTimeString()}</span>
                            {task.completedAt && (
                              <span>Duration: {Math.round((task.completedAt - (task.startedAt || task.createdAt)) / 1000)}s</span>
                            )}
                          </div>
                          {task.error && (
                            <div className="mt-2 p-2 bg-destructive/10 border border-destructive/20 rounded text-xs text-destructive">
                              {task.error}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          {(task.status === 'queued' || task.status === 'running') && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={async () => {
                                try {
                                  await cancelQueueTask(task.id)
                                  toast.success('Task cancelled')
                                  const data = await fetchQueueTasks()
                                  setQueueTasks(data.tasks)
                                  setQueueStats(data.stats)
                                } catch (err: unknown) {
                                  const errMsg = err instanceof Error ? err.message : String(err)
                                  toast.error('Failed to cancel task', { description: errMsg })
                                }
                              }}
                            >
                              <X size={16} />
                            </Button>
                          )}
                          {task.status === 'failed' && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={async () => {
                                try {
                                  await retryQueueTask(task.id)
                                  toast.success('Task retried')
                                  const data = await fetchQueueTasks()
                                  setQueueTasks(data.tasks)
                                  setQueueStats(data.stats)
                                } catch (err: unknown) {
                                  const errMsg = err instanceof Error ? err.message : String(err)
                                  toast.error('Failed to retry task', { description: errMsg })
                                }
                              }}
                            >
                              <RotateCw size={16} />
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        )}

        {/* Empty State */}
        {queueTasks.length === 0 && !isLoadingQueue && (
          <Card className="glass-card">
            <CardContent className="p-8 text-center">
              <ListTodo size={32} className="text-muted-foreground/50 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">
                No tasks in queue. Use CLI to add tasks: <code className="text-xs bg-muted px-1 py-0.5 rounded">brunella dev queue add</code>
              </p>
              <p className="text-xs text-muted-foreground/70 mt-1">
                Queue supports concurrent task execution with priority scheduling.
              </p>
            </CardContent>
          </Card>
        )}
      </>)}

      {/* ==================== P10: Metrics Tab ==================== */}
      {activeTab === 'metrics' && (
        <>
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold">Developer Metrics</h2>
              <p className="text-sm text-muted-foreground">Build, test, and task performance snapshots</p>
            </div>
            <Button
              size="sm"
              variant="outline"
              disabled={isLoadingMetrics}
              onClick={loadMetrics}
            >
              {isLoadingMetrics ? <Activity size={14} className="animate-spin" /> : <RefreshCw size={14} />}
              <span className="ml-1.5">Refresh</span>
            </Button>
          </div>

          {isLoadingMetrics && (
            <Card className="glass-card border-blue-500/20">
              <CardContent className="p-6 text-center">
                <Activity size={20} className="animate-spin text-blue-500 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">Loading metrics...</p>
              </CardContent>
            </Card>
          )}

          {metricsData && !isLoadingMetrics && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="glass-card">
                  <CardContent className="p-4 space-y-2">
                    <div className="flex items-center justify-between text-sm text-muted-foreground">
                      <span className="flex items-center gap-2"><Gauge size={14} className="text-primary" /> Builds</span>
                      <Badge variant="outline" className="text-[10px]">
                        {metricsData.builds.lastStatus === 'unknown' ? 'n/a' : metricsData.builds.lastStatus}
                      </Badge>
                    </div>
                    <div className="text-3xl font-bold">{metricsData.builds.total}</div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="text-green-500">{metricsData.builds.success} success</span>
                      <span className="text-red-500">{metricsData.builds.fail} fail</span>
                    </div>
                    {metricsData.builds.lastDurationMs > 0 && (
                      <p className="text-[11px] text-muted-foreground">
                        Last duration: {(metricsData.builds.lastDurationMs / 1000).toFixed(1)}s
                      </p>
                    )}
                  </CardContent>
                </Card>
                <Card className="glass-card">
                  <CardContent className="p-4 space-y-2">
                    <div className="flex items-center justify-between text-sm text-muted-foreground">
                      <span className="flex items-center gap-2"><TestTube2 size={14} className="text-primary" /> Tests</span>
                      <Badge variant="outline" className="text-[10px]">{metricsData.tests.totalRuns} runs</Badge>
                    </div>
                    <div className="text-3xl font-bold">{metricsData.tests.lastPassRate}%</div>
                    <p className="text-[11px] text-muted-foreground">
                      Last duration: {(metricsData.tests.lastDurationMs / 1000).toFixed(1)}s
                    </p>
                  </CardContent>
                </Card>
                <Card className="glass-card">
                  <CardContent className="p-4 space-y-2">
                    <div className="flex items-center justify-between text-sm text-muted-foreground">
                      <span className="flex items-center gap-2"><Activity size={14} className="text-primary" /> Tasks</span>
                      <Badge variant="outline" className="text-[10px]">Avg {Math.round(metricsData.tasks.avgDurationMs / 1000)}s</Badge>
                    </div>
                    <div className="text-3xl font-bold">{metricsData.tasks.total}</div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="text-green-500">{metricsData.tasks.success} success</span>
                      <span className="text-red-500">{metricsData.tasks.error} error</span>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {metricsData.history.length > 0 ? (
                <Card className="glass-card">
                  <CardHeader className="pb-3 border-b border-border/50">
                    <CardTitle className="flex items-center gap-2 text-sm">
                      <History size={14} className="text-muted-foreground" /> Recent Runs
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <ScrollArea className="h-[260px]">
                      <div className="divide-y divide-border/60">
                        {metricsData.history.map((entry, idx) => (
                          <div key={idx} className="px-4 py-3 flex items-center gap-3">
                            <Badge
                              variant="outline"
                              className={cn(
                                'text-[10px]',
                                entry.status === 'success' && 'bg-green-500/10 text-green-500 border-green-500/30',
                                entry.status !== 'success' && 'bg-red-500/10 text-red-500 border-red-500/30'
                              )}
                            >
                              {entry.type.toUpperCase()}
                            </Badge>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm truncate">{entry.details}</p>
                              <p className="text-[11px] text-muted-foreground">
                                {(entry.durationMs / 1000).toFixed(1)}s • {new Date(entry.timestamp).toLocaleTimeString()}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </CardContent>
                </Card>
              ) : (
                <Card className="glass-card">
                  <CardContent className="p-6 text-center text-sm text-muted-foreground">
                    No metrics recorded yet. Run builds or tasks to populate history.
                  </CardContent>
                </Card>
              )}
            </>
          )}

          {!metricsData && !isLoadingMetrics && (
            <Card className="glass-card">
              <CardContent className="p-6 text-center text-sm text-muted-foreground">
                No metrics data available. Trigger a build/test/task to start tracking.
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* ==================== P11: Approvals Tab ==================== */}
      {activeTab === 'approvals' && (
        <>
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold">Approval Requests</h2>
              <p className="text-sm text-muted-foreground">Human-in-the-loop confirmations for critical actions</p>
            </div>
            <div className="flex items-center gap-2">
              {(['pending', 'approved', 'rejected', 'expired'] as ApprovalStatus[]).map((status) => (
                <Button
                  key={status}
                  variant={approvalFilter === status ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => loadApprovals(status)}
                >
                  {status}
                </Button>
              ))}
              <Button size="sm" variant="ghost" onClick={() => loadApprovals(approvalFilter)} disabled={isLoadingApprovals}>
                {isLoadingApprovals ? <Activity size={14} className="animate-spin" /> : <RefreshCw size={14} />}
              </Button>
            </div>
          </div>

          {isLoadingApprovals && (
            <Card className="glass-card border-blue-500/20">
              <CardContent className="p-6 text-center text-sm text-muted-foreground">
                <Activity size={18} className="animate-spin text-blue-500 mx-auto mb-2" />
                Loading approvals...
              </CardContent>
            </Card>
          )}

          {approvals.length > 0 && !isLoadingApprovals && (
            <Card className="glass-card">
              <CardContent className="p-0">
                <ScrollArea className="h-[420px]">
                  <div className="divide-y divide-border/60">
                    {approvals.map((req) => (
                      <div key={req.id} className="p-4 flex items-start gap-3">
                        <Badge
                          variant="outline"
                          className={cn(
                            'text-[10px] mt-0.5',
                            req.status === 'pending' && 'bg-yellow-500/10 text-yellow-500 border-yellow-500/40',
                            req.status === 'approved' && 'bg-green-500/10 text-green-500 border-green-500/40',
                            req.status === 'rejected' && 'bg-red-500/10 text-red-500 border-red-500/40',
                            req.status === 'expired' && 'bg-muted/60 text-muted-foreground border-border'
                          )}
                        >
                          {req.status.toUpperCase()}
                        </Badge>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <span className="font-mono">{req.id.slice(0, 8)}</span>
                            <span>Type: {req.type}</span>
                            <span>Created: {new Date(req.createdAt).toLocaleTimeString()}</span>
                          </div>
                          <p className="text-sm mt-1">{req.description}</p>
                          {req.metadata && (
                            <p className="text-[11px] text-muted-foreground mt-1 truncate">
                              Meta: {JSON.stringify(req.metadata)}
                            </p>
                          )}
                          {req.response && (
                            <p className="text-[11px] text-muted-foreground mt-1">
                              Response: {JSON.stringify(req.response)}
                            </p>
                          )}
                          <div className="flex items-center gap-2 mt-2">
                            {req.status === 'pending' && (
                              <>
                                <Button
                                  size="sm"
                                  variant="default"
                                  disabled={respondingId === req.id}
                                  onClick={() => handleApprovalAction(req.id, 'approve')}
                                  className="h-7"
                                >
                                  {respondingId === req.id ? '...' : 'Approve'}
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  disabled={respondingId === req.id}
                                  onClick={() => handleApprovalAction(req.id, 'reject')}
                                  className="h-7"
                                >
                                  Reject
                                </Button>
                              </>
                            )}
                            {req.status !== 'pending' && req.respondedAt && (
                              <span className="text-[11px] text-muted-foreground">
                                Resolved {new Date(req.respondedAt).toLocaleTimeString()}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          )}

          {approvals.length === 0 && !isLoadingApprovals && (
            <Card className="glass-card">
              <CardContent className="p-6 text-center text-sm text-muted-foreground">
                No approval requests in this state.
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* ==================== P12: Activity Feed Tab ==================== */}
      {activeTab === 'activity' && (
        <>
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold">Activity Feed</h2>
              <p className="text-sm text-muted-foreground">Recent system, agent, queue, and approval events</p>
            </div>
            <div className="flex items-center gap-2">
              <select
                className="border border-border rounded-md bg-transparent text-sm px-2 py-1"
                value={activityLimit}
                onChange={(e) => loadActivity(parseInt(e.target.value, 10))}
              >
                {[20, 30, 50, 100].map((n) => (
                  <option key={n} value={n}>{n} items</option>
                ))}
              </select>
              <Button size="sm" variant="outline" onClick={() => loadActivity(activityLimit)} disabled={isLoadingActivity}>
                {isLoadingActivity ? <Activity size={14} className="animate-spin" /> : <RefreshCw size={14} />}
              </Button>
            </div>
          </div>

          {isLoadingActivity && (
            <Card className="glass-card border-blue-500/20">
              <CardContent className="p-6 text-center text-sm text-muted-foreground">
                <Activity size={18} className="animate-spin text-blue-500 mx-auto mb-2" />
                Loading activity...
              </CardContent>
            </Card>
          )}

          {activities.length > 0 && !isLoadingActivity && (
            <Card className="glass-card">
              <CardContent className="p-0">
                <ScrollArea className="h-[480px]">
                  <div className="divide-y divide-border/60">
                    {activities.map((item) => {
                      const color = item.type === 'success'
                        ? 'text-green-500'
                        : item.type === 'warning'
                          ? 'text-yellow-500'
                          : item.type === 'error'
                            ? 'text-red-500'
                            : item.type === 'approval'
                              ? 'text-blue-500'
                              : 'text-muted-foreground'
                      return (
                        <div key={item.id} className="p-4 flex items-start gap-3">
                          <div className={cn('mt-0.5 h-2 w-2 rounded-full',
                            item.type === 'success' ? 'bg-green-500' :
                              item.type === 'warning' ? 'bg-yellow-500' :
                                item.type === 'error' ? 'bg-red-500' :
                                  item.type === 'approval' ? 'bg-blue-500' : 'bg-muted-foreground'
                          )} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <span className={color}>{item.type}</span>
                              <span className="uppercase text-[10px]">{item.source}</span>
                              <span>{new Date(item.timestamp).toLocaleTimeString()}</span>
                            </div>
                            <p className="text-sm mt-1">{item.message}</p>
                            {item.metadata && (
                              <p className="text-[11px] text-muted-foreground mt-1 truncate">
                                Meta: {JSON.stringify(item.metadata)}
                              </p>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          )}

          {activities.length === 0 && !isLoadingActivity && (
            <Card className="glass-card">
              <CardContent className="p-6 text-center text-sm text-muted-foreground">
                No activity recorded yet.
              </CardContent>
            </Card>
          )}
        </>
      )}

    </div>
  )
}
