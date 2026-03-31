import { useState, useEffect } from 'react'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from '@/components/ui/table'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
    ListTodo,
    ChevronLeft,
    ChevronRight,
    Eye,
    Clock,
    CheckCircle2,
    AlertCircle,
    PlayCircle,
    XCircle,
    RotateCw,
    Play,
    Loader2
} from 'lucide-react'
import {
    getTasks,
    getTaskStats,
    executePendingTask,
    cancelTask,
    retryTask,
    type TaskStats
} from '@/lib/apiService'
import { TaskItem } from '../../types/dashboard'
import { toast } from 'sonner'
import { format } from 'date-fns'
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription
} from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"

export function TaskQueueMonitor() {
    const [tasks, setTasks] = useState<TaskItem[]>([])
    const [total, setTotal] = useState(0)
    const [stats, setStats] = useState<TaskStats | null>(null)
    const [page, setPage] = useState(1)
    const [loading, setLoading] = useState(true)
    const [executing, setExecuting] = useState(false)
    const [selectedTask, setSelectedTask] = useState<TaskItem | null>(null)
    const limit = 10

    const fetchData = async () => {
        setLoading(true)
        try {
            const offset = (page - 1) * limit
            const [tasksRes, statsRes] = await Promise.all([
                getTasks(limit, offset),
                getTaskStats()
            ])
            setTasks(tasksRes.tasks)
            setTotal(tasksRes.total)
            setStats(statsRes.stats)
        } catch (err: any) {
            toast.error(`Nem sikerült betölteni az adatokat: ${err.message}`)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchData()
        const interval = setInterval(fetchData, 5000) // Refresh every 5s
        return () => clearInterval(interval)
    }, [page])

    const handleExecuteNext = async () => {
        setExecuting(true)
        try {
            const result = await executePendingTask()
            toast.success('Feladat végrehajtása elindult')
            fetchData()
        } catch (err: any) {
            toast.error(`Végrehajtási hiba: ${err.message}`)
        } finally {
            setExecuting(false)
        }
    }

    const handleCancel = async (taskId: number) => {
        try {
            await cancelTask(taskId)
            toast.info('Feladat visszavonva')
            fetchData()
        } catch (err: any) {
            toast.error(`Hiba: ${err.message}`)
        }
    }

    const handleRetry = async (taskId: number) => {
        try {
            await retryTask(taskId)
            toast.success('Feladat újra sorba állítva')
            fetchData()
        } catch (err: any) {
            toast.error(`Hiba: ${err.message}`)
        }
    }

    const getStatusBadge = (status: TaskItem['status']) => {
        switch (status) {
            case 'done':
                return <Badge variant="outline" className="bg-green-500/10 text-green-500 gap-1 border-green-500/20"><CheckCircle2 size={12} /> Done</Badge>
            case 'running':
                return <Badge variant="outline" className="bg-blue-500/10 text-blue-500 gap-1 border-blue-500/20 animate-pulse"><PlayCircle size={12} /> Running</Badge>
            case 'error':
                return <Badge variant="destructive" className="gap-1"><AlertCircle size={12} /> Error</Badge>
            case 'cancelled':
                return <Badge variant="secondary" className="gap-1 text-zinc-500"><XCircle size={12} /> Cancelled</Badge>
            default:
                return <Badge variant="secondary" className="gap-1"><Clock size={12} /> Pending</Badge>
        }
    }

    const totalPages = Math.ceil(total / limit)

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            label: "Total Tasks",
            value: stats?.total || 0,
            detail: `Success ${stats?.successRate || 0}%`,
            accent: "text-cyan-300",
          },
          {
            label: "Pending / Running",
            value: `${stats?.pendingCount || 0} / ${stats?.runningCount || 0}`,
            detail: "Queue depth",
            accent: "text-blue-300",
          },
          {
            label: "Success / Error",
            value: `${stats?.successCount || 0} / ${stats?.errorCount || 0}`,
            detail: "Completion status",
            accent: "text-emerald-300",
          },
          {
            label: "Avg Duration",
            value: `${stats?.avgDurationMs || 0}ms`,
            detail: "Per task",
            accent: "text-violet-300",
          },
        ].map((stat) => (
          <Card key={stat.label} className="glass-card border-white/10 overflow-hidden">
            <CardHeader className="pb-2 pt-3 px-4">
              <CardTitle className="text-[10px] font-mono uppercase tracking-[0.28em] text-zinc-500">
                {stat.label}
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <div className={cn("text-2xl font-semibold font-mono tracking-tight", stat.accent)}>
                {stat.value}
              </div>
              <p className="text-[10px] uppercase tracking-[0.22em] text-zinc-500 mt-1">
                {stat.detail}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="glass-card border-white/10 overflow-hidden">
        <CardHeader className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between pb-4 px-4 pt-4">
          <div className="space-y-1">
            <CardTitle className="text-[11px] font-mono font-semibold tracking-[0.28em] uppercase text-zinc-400 flex items-center gap-2">
              <ListTodo className="text-cyan-400" size={15} />
              Task Queue
            </CardTitle>
            <CardDescription className="text-sm text-zinc-500">
              Real-time view of agent task execution queue
            </CardDescription>
          </div>

          <Button
            onClick={handleExecuteNext}
            disabled={executing || !stats?.pendingCount}
            className="gap-2 bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-100 border border-cyan-400/20 shadow-[0_0_24px_rgba(34,211,238,0.08)]"
          >
            {executing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
            Execute Next Pending
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-white/[0.02]">
                <TableRow className="border-white/[0.05] hover:bg-transparent">
                  <TableHead className="w-[60px] text-[10px] uppercase tracking-[0.24em] text-zinc-500">ID</TableHead>
                  <TableHead className="text-[10px] uppercase tracking-[0.24em] text-zinc-500">Agent</TableHead>
                  <TableHead className="max-w-[300px] text-[10px] uppercase tracking-[0.24em] text-zinc-500">Description</TableHead>
                  <TableHead className="text-[10px] uppercase tracking-[0.24em] text-zinc-500">Status</TableHead>
                  <TableHead className="text-[10px] uppercase tracking-[0.24em] text-zinc-500">Created</TableHead>
                  <TableHead className="text-right text-[10px] uppercase tracking-[0.24em] text-zinc-500">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading && tasks.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-32 text-center text-zinc-500">
                      <div className="flex items-center justify-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin" /> Betöltés...
                      </div>
                    </TableCell>
                  </TableRow>
                ) : tasks.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-32 text-center text-zinc-500 italic">
                      Nincsenek feladatok a várólistán.
                    </TableCell>
                  </TableRow>
                ) : (
                  tasks.map((task) => (
                    <TableRow key={task.id} className="border-white/[0.04] hover:bg-white/[0.03] transition-colors">
                      <TableCell className="font-mono text-xs text-zinc-500">#{task.id}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="font-mono text-[10px] border-white/10 bg-white/[0.02]">
                          {task.agent}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-[300px] truncate group">
                        <span className="text-sm font-medium text-zinc-100" title={task.task}>{task.task}</span>
                      </TableCell>
                      <TableCell>{getStatusBadge(task.status)}</TableCell>
                      <TableCell className="text-xs text-zinc-500 font-mono">
                        {format(new Date(task.created_at), 'HH:mm:ss')}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          {(task.status === 'pending' || task.status === 'running') && (
                            <Button
                              variant="ghost" size="icon"
                              className="h-8 w-8 text-zinc-500 hover:text-destructive hover:bg-white/[0.03]"
                              onClick={() => handleCancel(task.id)}
                              title="Cancel task"
                              aria-label="Cancel task"
                            >
                              <XCircle size={14} />
                            </Button>
                          )}
                          {(task.status === 'error' || task.status === 'cancelled') && (
                            <Button
                              variant="ghost" size="icon"
                              className="h-8 w-8 text-zinc-500 hover:text-cyan-300 hover:bg-white/[0.03]"
                              onClick={() => handleRetry(task.id)}
                              title="Retry task"
                              aria-label="Retry task"
                            >
                              <RotateCw size={14} />
                            </Button>
                          )}
                          <Button
                            variant="ghost" size="icon"
                            className="h-8 w-8 text-zinc-500 hover:text-foreground hover:bg-white/[0.03]"
                            onClick={() => setSelectedTask(task)}
                            title="View task details"
                            aria-label="View task details"
                          >
                            <Eye size={14} />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-4 border-t border-white/[0.04] bg-white/[0.015]">
              <p className="text-xs text-zinc-500">
                Page {page} of {totalPages}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="h-8 border-white/10 bg-white/[0.02] hover:bg-white/[0.05]"
                >
                  <ChevronLeft size={14} className="mr-1" /> Prev
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="h-8 border-white/10 bg-white/[0.02] hover:bg-white/[0.05]"
                >
                  Next <ChevronRight size={14} className="ml-1" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!selectedTask} onOpenChange={(open) => !open && setSelectedTask(null)}>
        <DialogContent className="max-w-2xl glass-card border-white/10">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-white">
              <span className="text-zinc-500">#{selectedTask?.id}</span>
              {selectedTask?.task}
            </DialogTitle>
            <DialogDescription className="flex items-center gap-4 pt-2 text-zinc-500">
              <Badge variant="outline" className="border-white/10">{selectedTask?.agent}</Badge>
              {selectedTask && getStatusBadge(selectedTask.status)}
              <span className="text-xs text-zinc-500 font-mono">
                Created: {selectedTask?.created_at && format(new Date(selectedTask.created_at), 'yyyy-MM-dd HH:mm:ss')}
              </span>
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <h4 className="text-sm font-medium leading-none text-zinc-200">Context</h4>
              <ScrollArea className="h-[100px] w-full rounded-xl border border-white/10 p-4 bg-white/[0.02] font-mono text-xs">
                {selectedTask?.context ? (
                  <pre className="whitespace-pre-wrap">{selectedTask.context}</pre>
                ) : (
                  <span className="text-zinc-500 italic">No context provided</span>
                )}
              </ScrollArea>
            </div>

            <div className="space-y-2">
              <h4 className="text-sm font-medium leading-none text-zinc-200">Result</h4>
              <ScrollArea className="h-[200px] w-full rounded-xl border border-white/10 p-4 bg-white/[0.02] font-mono text-xs">
                {selectedTask?.result ? (
                  <pre className="whitespace-pre-wrap">{selectedTask.result}</pre>
                ) : (
                  <span className="text-zinc-500 italic">No result available</span>
                )}
              </ScrollArea>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
    )
}
