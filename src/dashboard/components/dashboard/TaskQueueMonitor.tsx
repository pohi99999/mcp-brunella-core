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
            toast.error(`Fetch error: ${err.message}`)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchData()
        const interval = setInterval(fetchData, 5000)
        return () => clearInterval(interval)
    }, [page])

    const handleExecuteNext = async () => {
        setExecuting(true)
        try {
            await executePendingTask()
            toast.success('Task execution initialized')
            fetchData()
        } catch (err: any) {
            toast.error(`Execution error: ${err.message}`)
        } finally {
            setExecuting(false)
        }
    }

    const handleCancel = async (taskId: number) => {
        try {
            await cancelTask(taskId)
            toast.info('Task cancelled')
            fetchData()
        } catch (err: any) {
            toast.error(`Error: ${err.message}`)
        }
    }

    const handleRetry = async (taskId: number) => {
        try {
            await retryTask(taskId)
            toast.success('Task re-queued')
            fetchData()
        } catch (err: any) {
            toast.error(`Error: ${err.message}`)
        }
    }

    const getStatusBadge = (status: TaskItem['status']) => {
        switch (status) {
            case 'done':
                return <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 gap-1 border-emerald-500/20 text-[9px] uppercase tracking-tighter"><CheckCircle2 size={10} /> DONE</Badge>
            case 'running':
                return <Badge variant="outline" className="bg-cyan-500/10 text-cyan-400 gap-1 border-cyan-500/20 animate-pulse text-[9px] uppercase tracking-tighter"><PlayCircle size={10} /> RUN</Badge>
            case 'error':
                return <Badge variant="destructive" className="gap-1 text-[9px] uppercase tracking-tighter bg-rose-500/20 text-rose-400 border-rose-500/30"><AlertCircle size={10} /> FAIL</Badge>
            case 'cancelled':
                return <Badge variant="secondary" className="gap-1 text-zinc-500 text-[9px] uppercase tracking-tighter"><XCircle size={10} /> VOID</Badge>
            default:
                return <Badge variant="secondary" className="gap-1 text-zinc-400 text-[9px] uppercase tracking-tighter"><Clock size={10} /> WAIT</Badge>
        }
    }

    const totalPages = Math.ceil(total / limit)

  return (
    <div className="h-full flex flex-col overflow-hidden gap-4">
      {/* ── Mini Stats ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 px-1">
        {[
          { label: "Throughput", value: stats?.total || 0, color: "cyan" },
          { label: "Active Nodes", value: `${stats?.pendingCount || 0}/${stats?.runningCount || 0}`, color: "blue" },
          { label: "Success Rate", value: `${stats?.successRate || 0}%`, color: "emerald" },
          { label: "Latency", value: `${stats?.avgDurationMs || 0}ms`, color: "violet" },
        ].map((stat) => (
          <div key={stat.label} className="bg-zinc-900/40 border border-white/[0.03] rounded-lg px-4 py-3 shadow-sm">
            <p className="text-[8px] font-bold uppercase tracking-[0.2em] text-zinc-500 mb-1">{stat.label}</p>
            <p className={cn("text-lg font-bold font-mono tracking-tighter", `text-${stat.color}-400/90`)}>{stat.value}</p>
          </div>
        ))}
      </div>

      <Card className="flex-1 bg-zinc-950/20 backdrop-blur-xl border-white/[0.04] rounded-xl overflow-hidden flex flex-col shadow-2xl">
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between px-5 py-4 border-b border-white/[0.03]">
          <div className="flex items-center gap-3">
            <div className="p-1.5 rounded-md bg-white/[0.03] border border-white/[0.05]">
              <ListTodo size={14} className="text-cyan-400" />
            </div>
            <div>
              <h3 className="text-[10px] font-bold tracking-[0.2em] text-zinc-200 uppercase leading-none">Task Stream</h3>
              <p className="text-[9px] text-zinc-500 font-mono mt-1 leading-none uppercase tracking-widest">Job Processor</p>
            </div>
          </div>

          <Button
            onClick={handleExecuteNext}
            disabled={executing || !stats?.pendingCount}
            size="sm"
            className="h-8 px-4 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 border border-cyan-500/20 text-[10px] font-bold uppercase tracking-wider transition-all"
          >
            {executing ? <Loader2 className="w-3 h-3 animate-spin mr-2" /> : <Play className="w-3 h-3 mr-2" />}
            Execute Next
          </Button>
        </CardHeader>
        
        <CardContent className="p-0 flex-1 overflow-hidden">
          <div className="h-full overflow-x-auto custom-scrollbar">
            <Table>
              <TableHeader className="bg-white/[0.01]">
                <TableRow className="border-white/[0.03] hover:bg-transparent">
                  <TableHead className="w-[60px] text-[9px] font-bold uppercase tracking-[0.2em] text-zinc-500 pl-5">ID</TableHead>
                  <TableHead className="text-[9px] font-bold uppercase tracking-[0.2em] text-zinc-500">Agent</TableHead>
                  <TableHead className="text-[9px] font-bold uppercase tracking-[0.2em] text-zinc-500">Operation</TableHead>
                  <TableHead className="text-[9px] font-bold uppercase tracking-[0.2em] text-zinc-500">Status</TableHead>
                  <TableHead className="text-right text-[9px] font-bold uppercase tracking-[0.2em] text-zinc-500 pr-5">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading && tasks.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="h-32 text-center text-[10px] text-zinc-600 font-mono">LOADING_SEQUENCE...</TableCell></TableRow>
                ) : tasks.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="h-32 text-center text-[10px] text-zinc-600 font-mono uppercase tracking-widest">Queue_Empty</TableCell></TableRow>
                ) : (
                  tasks.map((task) => (
                    <TableRow key={task.id} className="border-white/[0.02] hover:bg-white/[0.015] transition-colors group">
                      <TableCell className="font-mono text-[10px] text-zinc-500 pl-5">#{task.id}</TableCell>
                      <TableCell>
                        <span className="text-[10px] font-bold text-zinc-300 uppercase tracking-tight">{task.agent}</span>
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate">
                        <span className="text-[11px] text-zinc-400 group-hover:text-zinc-200 transition-colors" title={task.task}>{task.task}</span>
                      </TableCell>
                      <TableCell>{getStatusBadge(task.status)}</TableCell>
                      <TableCell className="text-right pr-5">
                        <div className="flex justify-end gap-1 opacity-40 group-hover:opacity-100 transition-opacity">
                          <Button
                            variant="ghost" size="icon"
                            aria-label="View task details"
                            className="h-7 w-7 text-zinc-500 hover:text-white hover:bg-white/5"
                            onClick={() => setSelectedTask(task)}
                          >
                            <Eye size={12} />
                          </Button>
                          {(task.status === 'pending' || task.status === 'running') && (
                            <Button
                              variant="ghost" size="icon"
                              aria-label="Cancel task"
                              className="h-7 w-7 text-zinc-500 hover:text-rose-400 hover:bg-white/5"
                              onClick={() => handleCancel(task.id)}
                            >
                              <XCircle size={12} />
                            </Button>
                          )}
                          {(task.status === 'error' || task.status === 'cancelled') && (
                            <Button
                              variant="ghost" size="icon"
                              aria-label="Retry task"
                              className="h-7 w-7 text-zinc-500 hover:text-cyan-400 hover:bg-white/5"
                              onClick={() => handleRetry(task.id)}
                            >
                              <RotateCw size={12} />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>

        <div className="px-5 py-3 border-t border-white/[0.03] bg-white/[0.01] flex items-center justify-between">
          <div className="flex items-center gap-4">
            <span className="text-[8px] font-bold text-zinc-600 uppercase tracking-widest font-mono">Sequence Control</span>
            <span className="text-[9px] text-zinc-500 font-mono">PAGE {page}/{totalPages || 1}</span>
          </div>
          <div className="flex gap-1.5">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="h-6 px-2 text-[9px] text-zinc-500 hover:text-white hover:bg-white/5 uppercase font-bold"
            >
              Prev
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages || totalPages === 0}
              className="h-6 px-2 text-[9px] text-zinc-500 hover:text-white hover:bg-white/5 uppercase font-bold"
            >
              Next
            </Button>
          </div>
        </div>
      </Card>

      <Dialog open={!!selectedTask} onOpenChange={(open) => !open && setSelectedTask(null)}>
        <DialogContent className="max-w-2xl bg-zinc-950 border-white/[0.05] shadow-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3 text-zinc-100 text-base">
              <div className="p-1 rounded bg-white/[0.03] border border-white/[0.05]">
                <ListTodo size={14} className="text-cyan-400" />
              </div>
              <span>Job Details <span className="text-zinc-600 ml-1">#{selectedTask?.id}</span></span>
            </DialogTitle>
            <div className="flex items-center gap-3 mt-4 px-1">
              <div className="px-2 py-0.5 rounded-[2px] bg-white/[0.03] border border-white/[0.05]">
                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-tight">{selectedTask?.agent}</span>
              </div>
              {selectedTask && getStatusBadge(selectedTask.status)}
            </div>
          </DialogHeader>

          <div className="grid gap-5 py-4">
            <div className="space-y-2">
              <h4 className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Instruction</h4>
              <div className="rounded-lg border border-white/[0.03] p-4 bg-zinc-900/50 font-mono text-[11px] text-zinc-300 leading-relaxed">
                {selectedTask?.task}
              </div>
            </div>

            <div className="space-y-2">
              <h4 className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Context Pipeline</h4>
              <ScrollArea className="h-[120px] w-full rounded-lg border border-white/[0.03] p-4 bg-zinc-900/50 font-mono text-[10px] text-zinc-400">
                {selectedTask?.context ? (
                  <pre className="whitespace-pre-wrap">{selectedTask.context}</pre>
                ) : (
                  <span className="italic opacity-50">Empty sequence...</span>
                )}
              </ScrollArea>
            </div>

            <div className="space-y-2">
              <h4 className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Return Data</h4>
              <ScrollArea className="h-[180px] w-full rounded-lg border border-white/[0.03] p-4 bg-zinc-900/50 font-mono text-[10px] text-zinc-400">
                {selectedTask?.result ? (
                  <pre className="whitespace-pre-wrap">{selectedTask.result}</pre>
                ) : (
                  <span className="italic opacity-50">No data returned.</span>
                )}
              </ScrollArea>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
    )
}
