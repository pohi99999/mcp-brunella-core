import { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  CalendarClock,
  Plus,
  Trash,
  Play,
  RefreshCw,
  Clock,
} from "lucide-react";

interface ScheduledTask {
  id: string;
  title: string;
  prompt: string;
  cron_expression: string;
  handler: string;
  enabled: boolean;
  last_run_at?: string;
  last_status?: string;
  next_run_at?: string;
}

export function ScheduledTasksPanel() {
  const [tasks, setTasks] = useState<ScheduledTask[]>([]);
  const [loading, setLoading] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  // New task form state
  const [newTask, setNewTask] = useState({
    title: "",
    cron_expression: "0 0 * * *",
    prompt: "",
    handler: "default",
  });

  const fetchTasks = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/v1/scheduled-tasks");
      if (!res.ok) throw new Error("Failed to fetch tasks");
      const data = await res.json();
      setTasks(data.data || []);
    } catch (err: any) {
      toast.error(err.message || "Error loading tasks");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();
    const interval = setInterval(fetchTasks, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleCreate = async () => {
    try {
      const res = await fetch("/api/v1/scheduled-tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newTask),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to create task");
      }
      toast.success("Task scheduled successfully");
      setIsDialogOpen(false);
      setNewTask({ title: "", cron_expression: "0 0 * * *", prompt: "", handler: "default" });
      fetchTasks();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure?")) return;
    try {
      await fetch(`/api/v1/scheduled-tasks/${id}`, { method: "DELETE" });
      toast.success("Task deleted");
      fetchTasks();
    } catch (err) {
      toast.error("Failed to delete");
    }
  };

  const handleTrigger = async (id: string) => {
    try {
      toast.info("Triggering task...");
      const res = await fetch(`/api/v1/scheduled-tasks/${id}/trigger`, { method: "POST" });
      if (!res.ok) throw new Error("Trigger failed");
      toast.success("Task executed");
      fetchTasks();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <CalendarClock className="h-4 w-4 text-purple-500" />
          Scheduled AI Tasks
        </CardTitle>
        <div className="flex gap-2">
          <Button variant="ghost" size="icon" onClick={fetchTasks} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline" className="h-8 gap-1">
                <Plus className="h-3.5 w-3.5" />
                Add Task
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Schedule New Task</DialogTitle>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label>Title</Label>
                  <Input
                    value={newTask.title}
                    onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
                    placeholder="e.g. Daily Code Cleanup"
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Cron Expression</Label>
                  <Input
                    value={newTask.cron_expression}
                    onChange={(e) => setNewTask({ ...newTask, cron_expression: e.target.value })}
                    placeholder="0 0 * * *"
                  />
                  <p className="text-xs text-muted-foreground">Standard cron syntax (min hr dom mon dow)</p>
                </div>
                <div className="grid gap-2">
                  <Label>Prompt / Instruction</Label>
                  <Input
                    value={newTask.prompt}
                    onChange={(e) => setNewTask({ ...newTask, prompt: e.target.value })}
                    placeholder="What should the generic handler do?"
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Handler ID</Label>
                  <Input
                    value={newTask.handler}
                    onChange={(e) => setNewTask({ ...newTask, handler: e.target.value })}
                    placeholder="default or scan-todos"
                  />
                </div>
                <Button onClick={handleCreate}>Create Schedule</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent className="flex-1 overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Title</TableHead>
              <TableHead>Schedule</TableHead>
              <TableHead>Last Run</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tasks.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground h-24">
                  No scheduled tasks found.
                </TableCell>
              </TableRow>
            ) : (
              tasks.map((task) => (
                <TableRow key={task.id}>
                  <TableCell>
                    <div className="font-medium">{task.title}</div>
                    <div className="text-xs text-muted-foreground truncate max-w-[200px]">
                      {task.prompt}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="font-mono text-xs">
                      {task.cron_expression}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col text-xs">
                      <span className={task.last_status === 'success' ? 'text-green-500' : task.last_status === 'failed' ? 'text-red-500' : ''}>
                        {task.last_run_at ? new Date(task.last_run_at).toLocaleString() : 'Never'}
                      </span>
                      {task.next_run_at && (
                        <span className="text-muted-foreground flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {new Date(task.next_run_at).toLocaleTimeString()}
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 hover:text-blue-500"
                        onClick={() => handleTrigger(task.id)}
                        title="Run Now"
                      >
                        <Play className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 hover:text-destructive"
                        onClick={() => handleDelete(task.id)}
                      >
                        <Trash className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
