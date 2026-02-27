import { useEffect, useState } from "react";
import { useSystemSignalStore } from "@/store/systemSignalStore";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Zap, Pause, Play, XCircle, RefreshCcw, Info, Bug, FileSearch } from "lucide-react";
import { toast } from "sonner";
import {
  cancelTask,
  retryTask,
  pauseTask,
  resumeTask,
  updateTaskOrder,
  getTasks,
  QueuedTask,
} from "@/lib/apiService";
import { TaskDetailsModal } from "./TaskDetailsModal";
import { TraceViewerModal } from "./TraceViewerModal";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface SortableItemProps {
  task: QueuedTask;
  onControlAction: (taskId: number, action: 'pause' | 'resume' | 'kill' | 'retry' | 'debugRetry') => void;
  onViewDetails: (task: QueuedTask) => void;
  onViewTrace: (taskId: number) => void;
}

function SortableItem({ task, onControlAction, onViewDetails, onViewTrace }: SortableItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: task.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      className="flex items-center justify-between p-3 border border-white/10 rounded-lg bg-black/10 touch-action-none"
    >
      <div className="flex flex-col cursor-pointer" onClick={() => onViewDetails(task)}>
        <span className="text-sm font-semibold text-white">{task.task}</span>
        <span className="text-xs text-zinc-500">Ügynök: {task.agent}</span>
        <span className="text-xs text-zinc-600">Státusz: {task.status}</span>
      </div>
      <div className="flex items-center gap-2" {...listeners}>
        <Button variant="ghost" size="sm" onClick={() => onControlAction(task.id, 'pause')} title="Szüneteltetés"><Pause size={16} /></Button>
        <Button variant="ghost" size="sm" onClick={() => onControlAction(task.id, 'resume')} title="Folytatás"><Play size={16} /></Button>
        <Button variant="ghost" size="sm" onClick={() => onControlAction(task.id, 'kill')} title="Leállítás"><XCircle size={16} /></Button>
        <Button variant="ghost" size="sm" onClick={() => onControlAction(task.id, 'retry')} title="Újrapróbálkozás"><RefreshCcw size={16} /></Button>
        <Button variant="ghost" size="sm" onClick={() => onControlAction(task.id, 'debugRetry')} title="Debug újrapróbálkozás"><Bug size={16} /></Button>
        <Button variant="ghost" size="sm" onClick={() => onViewTrace(task.id)} title="Trace megjelenítése"><FileSearch size={16} /></Button>
        <Button variant="ghost" size="sm" onClick={() => onViewDetails(task)} title="Részletek"><Info size={16} /></Button>
      </div>
    </div>
  );
}

export function ProcessControlWidget() {
  const { tasks, setTasks } = useSystemSignalStore((state) => ({
    tasks: state.tasks,
    setTasks: state.setTasks,
  }));
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isTraceModalOpen, setIsTraceModalOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<QueuedTask | null>(null);
  const [selectedTraceTaskId, setSelectedTraceTaskId] = useState<number | null>(null);
  const [sortedTasks, setSortedTasks] = useState<QueuedTask[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const refreshActiveTasks = async () => {
    setIsRefreshing(true);
    try {
      const response = await getTasks(50, 0);
      setTasks(response.tasks || []);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      toast.error(`Feladatlista frissítés hiba: ${message}`);
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    // Initialize sortedTasks with tasks from the store, filter for active/pending
    const active = tasks.filter(task => task.status === "running" || task.status === "pending" || task.status === "paused");
    setSortedTasks(active);
  }, [tasks]);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const handleControlAction = async (taskId: number, action: 'pause' | 'resume' | 'kill' | 'retry' | 'debugRetry') => {
    try {
      switch (action) {
        case 'pause':
          await pauseTask(taskId);
          toast.success(`Feladat ${taskId} szüneteltetve.`);
          break;
        case 'resume':
          await resumeTask(taskId);
          toast.success(`Feladat ${taskId} folytatva.`);
          break;
        case 'kill':
          await cancelTask(taskId);
          toast.success(`Feladat ${taskId} leállítva.`);
          break;
        case 'retry':
          await retryTask(taskId, false);
          toast.success(`Feladat ${taskId} újrapróbálva.`);
          break;
        case 'debugRetry':
          await retryTask(taskId, true);
          toast.success(`Feladat ${taskId} újrapróbálva debug móddal.`);
          break;
        default:
          toast.error(`Ismeretlen akció: ${action}`);
          return;
      }
      await refreshActiveTasks();
    } catch (error: any) {
      toast.error(`Sikertelen akció ${action} a feladaton ${taskId}: ${error.message}`);
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;

    if (active.id !== over.id) {
      const oldIndex = sortedTasks.findIndex((task) => task.id === active.id);
      const newIndex = sortedTasks.findIndex((task) => task.id === over.id);

      if (oldIndex !== -1 && newIndex !== -1) {
        const newSortedTasks = [...sortedTasks];
        const [removed] = newSortedTasks.splice(oldIndex, 1);
        newSortedTasks.splice(newIndex, 0, removed);
        setSortedTasks(newSortedTasks);

        // Update backend order
        try {
          const newOrderIds = newSortedTasks.map(task => task.id);
          await updateTaskOrder(newOrderIds); // This API call needs to be implemented
          toast.success("Feladatok sorrendje frissítve.");
        } catch (error: any) {
          toast.error(`Sikertelen sorrendfrissítés: ${error.message}`);
          // Revert UI on error
          setSortedTasks(tasks.filter(task => task.status === "running" || task.status === "pending" || task.status === "paused"));
        }
      }
    }
  };

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="text-xl font-bold flex items-center gap-2">
          <Zap size={20} className="text-primary" /> Folyamatvezérlés
        </CardTitle>
      </CardHeader>
      <CardContent className="h-[calc(100%-70px)] overflow-y-auto custom-scrollbar">
        {sortedTasks.length === 0 ? (
          <p className="text-sm text-zinc-500">Nincsenek aktív vagy függőben lévő feladatok.</p>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext items={sortedTasks.map(task => task.id)} strategy={verticalListSortingStrategy}>
              <div className="space-y-4">
                {sortedTasks.map((task) => (
                  <SortableItem
                    key={task.id}
                    task={task}
                    onControlAction={handleControlAction}
                    onViewDetails={(task) => {
                      setSelectedTask(task);
                      setIsModalOpen(true);
                    }}
                    onViewTrace={(taskId) => {
                      setSelectedTraceTaskId(taskId);
                      setIsTraceModalOpen(true);
                    }}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}
        <div className="mt-4 flex justify-end">
          <Button variant="outline" size="sm" onClick={refreshActiveTasks} disabled={isRefreshing}>
            <RefreshCcw size={14} className={isRefreshing ? "mr-2 animate-spin" : "mr-2"} />
            Frissítés
          </Button>
        </div>
      </CardContent>
      <TaskDetailsModal task={selectedTask} isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
      <TraceViewerModal taskId={selectedTraceTaskId} isOpen={isTraceModalOpen} onClose={() => setIsTraceModalOpen(false)} />
    </Card>
  );
}

export default ProcessControlWidget;
