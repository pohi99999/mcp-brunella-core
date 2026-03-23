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
            {/* Stats Overview */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <Card className="bg-transparent border-none shadow-none">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-xs font-medium text-zinc-500">Total Tasks</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold font-mono">{stats?.total || 0}</div>
                        <p className="text-xs text-zinc-500 mt-1">SUCCESS RATE: {stats?.successRate || 0}%</p>
                    </CardContent>
                </Card>
                <Card className="bg-transparent border-none shadow-none">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-xs font-medium text-zinc-500">Pending / Running</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold font-mono text-blue-400">
                            {stats?.pendingCount || 0} <span className="text-zinc-500 text-sm">/ {stats?.runningCount || 0}</span>
                        </div>
                        <p className="text-xs text-zinc-500 mt-1">QUEUE DEPTH</p>
                    </CardContent>
                </Card>
                <Card className="bg-transparent border-none shadow-none">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-xs font-medium text-zinc-500">Success / Error</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold font-mono">
                            <span className="text-green-500">{stats?.successCount || 0}</span> / <span className="text-red-500">{stats?.errorCount || 0}</span>
                        </div>
                        <p className="text-xs text-zinc-500 mt-1">COMPLETION STATUS</p>
                    </CardContent>
                </Card>
                <Card className="bg-transparent border-none shadow-none">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-xs font-medium text-zinc-500">Avg Duration</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold font-mono">{stats?.avgDurationMs || 0}ms</div>
                        <p className="text-xs text-zinc-500 mt-1">PER TASK</p>
                    </CardContent>
                </Card>
            </div>

            <Card className="bg-transparent border-none shadow-none">
                <CardHeader className="flex flex-row items-center justify-between pb-3 px-4 pt-4">
                    <div className="space-y-1">
                        <CardTitle className="text-xs font-medium tracking-wide text-zinc-400 flex items-center gap-2">
                            <ListTodo className="text-primary" />
                            Task Queue Explorer
                        </CardTitle>
                        <CardDescription>
                            Real-time view of agent task execution queue
                        </CardDescription>
                    </div>
                    
                    <Button 
                        onClick={handleExecuteNext} 
                        disabled={executing || !stats?.pendingCount}
                        className="gap-2 bg-blue-600 hover:bg-blue-700 text-white"
                    >
                        {executing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                        Execute Next Pending
                    </Button>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader className="bg-muted/30">
                                <TableRow>
                                    <TableHead className="w-[60px]">ID</TableHead>
                                    <TableHead>Agent</TableHead>
                                    <TableHead className="max-w-[300px]">Description</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Created At</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
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
                                        <TableRow key={task.id} className="hover:bg-white/[0.03] transition-colors">
                                            <TableCell className="font-mono text-xs text-zinc-500">#{task.id}</TableCell>
                                            <TableCell>
                                                <Badge variant="outline" className="font-mono text-[10px]">{task.agent}</Badge>
                                            </TableCell>
                                            <TableCell className="max-w-[300px] truncate group">
                                                <span className="text-sm font-medium" title={task.task}>{task.task}</span>
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
                                                            className="h-8 w-8 text-zinc-500 hover:text-destructive"
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
                                                            className="h-8 w-8 text-zinc-500 hover:text-primary"
                                                            onClick={() => handleRetry(task.id)}
                                                            title="Retry task"
                                                            aria-label="Retry task"
                                                        >
                                                            <RotateCw size={14} />
                                                        </Button>
                                                    )}
                                                    <Button 
                                                        variant="ghost" size="icon" 
                                                        className="h-8 w-8 text-zinc-500 hover:text-foreground"
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
                        <div className="flex items-center justify-between px-4 py-4 border-t border-white/[0.04]">
                            <p className="text-xs text-zinc-500">
                                Page {page} of {totalPages}
                            </p>
                            <div className="flex gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setPage(p => Math.max(1, p - 1))}
                                    disabled={page === 1}
                                    className="h-8"
                                >
                                    <ChevronLeft size={14} className="mr-1" /> Prev
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                                    disabled={page === totalPages}
                                    className="h-8"
                                >
                                    Next <ChevronRight size={14} className="ml-1" />
                                </Button>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>

            <Dialog open={!!selectedTask} onOpenChange={(open) => !open && setSelectedTask(null)}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <span className="text-zinc-500">#{selectedTask?.id}</span>
                            {selectedTask?.task}
                        </DialogTitle>
                        <DialogDescription className="flex items-center gap-4 pt-2">
                            <Badge variant="outline">{selectedTask?.agent}</Badge>
                            {selectedTask && getStatusBadge(selectedTask.status)}
                            <span className="text-xs text-zinc-500 font-mono">
                                Created: {selectedTask?.created_at && format(new Date(selectedTask.created_at), 'yyyy-MM-dd HH:mm:ss')}
                            </span>
                        </DialogDescription>
                    </DialogHeader>
                    
                    <div className="grid gap-4 py-4">
                        <div className="space-y-2">
                            <h4 className="text-sm font-medium leading-none">Context</h4>
                            <ScrollArea className="h-[100px] w-full rounded-md border p-4 bg-muted/50 font-mono text-xs">
                                {selectedTask?.context ? (
                                    <pre className="whitespace-pre-wrap">{selectedTask.context}</pre>
                                ) : (
                                    <span className="text-zinc-500 italic">No context provided</span>
                                )}
                            </ScrollArea>
                        </div>
                        
                        <div className="space-y-2">
                            <h4 className="text-sm font-medium leading-none">Result</h4>
                            <ScrollArea className="h-[200px] w-full rounded-md border p-4 bg-muted/50 font-mono text-xs">
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
