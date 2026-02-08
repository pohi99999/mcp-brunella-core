import { useState, useEffect } from 'react'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from '@/components/ui/table'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
    PlayCircle
} from 'lucide-react'
import { getTasks, type QueuedTask } from '@/lib/apiService'
import { toast } from 'sonner'
import { format } from 'date-fns'

export function TaskQueueMonitor() {
    const [tasks, setTasks] = useState<QueuedTask[]>([])
    const [total, setTotal] = useState(0)
    const [page, setPage] = useState(1)
    const [loading, setLoading] = useState(true)
    const limit = 10

    const fetchTasks = async () => {
        setLoading(true)
        try {
            const offset = (page - 1) * limit
            const response = await getTasks(limit, offset)
            setTasks(response.tasks)
            setTotal(response.total)
        } catch (err: any) {
            toast.error(`Nem sikerült betölteni a feladatokat: ${err.message}`)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchTasks()
        const interval = setInterval(fetchTasks, 10000) // Refresh every 10s
        return () => clearInterval(interval)
    }, [page])

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'done':
                return <Badge variant="outline" className="bg-green-500/10 text-green-500 gap-1"><CheckCircle2 size={12} /> Done</Badge>
            case 'running':
                return <Badge variant="outline" className="bg-blue-500/10 text-blue-500 gap-1 animate-pulse"><PlayCircle size={12} /> Running</Badge>
            case 'error':
                return <Badge variant="destructive" className="gap-1"><AlertCircle size={12} /> Error</Badge>
            default:
                return <Badge variant="secondary" className="gap-1"><Clock size={12} /> Pending</Badge>
        }
    }

    const totalPages = Math.ceil(total / limit)

    return (
        <Card className="glass-card border-white/10">
            <CardHeader className="flex flex-row items-center justify-between border-b border-white/5 pb-4">
                <CardTitle className="flex items-center gap-2 text-lg font-space font-bold">
                    <ListTodo className="text-primary" />
                    Task Queue Explorer
                </CardTitle>
                <div className="flex items-center gap-2 text-xs text-muted-foreground font-mono">
                    Total Tasks: {total}
                </div>
            </CardHeader>
            <CardContent className="p-0">
                <div className="overflow-x-auto">
                    <Table>
                        <TableHeader className="bg-muted/30">
                            <TableRow>
                                <TableHead className="w-[80px]">ID</TableHead>
                                <TableHead>Agent</TableHead>
                                <TableHead className="max-w-[300px]">Description</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Timestamp</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading && tasks.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                                        Betöltés...
                                    </TableCell>
                                </TableRow>
                            ) : tasks.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="h-32 text-center text-muted-foreground italic">
                                        Nincsenek feladatok a várólistán.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                tasks.map((task) => (
                                    <TableRow key={task.id} className="hover:bg-white/5 transition-colors">
                                        <TableCell className="font-mono text-xs">#{task.id}</TableCell>
                                        <TableCell>
                                            <Badge variant="outline" className="font-mono text-[10px]">{task.agent_name}</Badge>
                                        </TableCell>
                                        <TableCell className="max-w-[300px] truncate group">
                                            <span className="text-sm" title={task.description}>{task.description}</span>
                                        </TableCell>
                                        <TableCell>{getStatusBadge(task.status)}</TableCell>
                                        <TableCell className="text-xs text-muted-foreground">
                                            {format(new Date(task.created_at), 'MM/dd HH:mm:ss')}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <Button variant="ghost" size="icon" className="h-8 w-8 hover:text-primary">
                                                <Eye size={14} />
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </div>

                {totalPages > 1 && (
                    <div className="flex items-center justify-between px-4 py-4 border-t border-white/5">
                        <p className="text-xs text-muted-foreground">
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
    )
}
