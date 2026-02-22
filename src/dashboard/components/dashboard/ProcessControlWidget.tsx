import React, { useState, useEffect } from "react";
import { useSystemSignalStore } from "@/store/systemSignalStore";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Zap, Pause, Play, XCircle, RefreshCcw, Info } from "lucide-react";
import { toast } from "sonner";
import { cancelTask, retryTask, pauseTask, resumeTask, updateTaskOrder, QueuedTask } from "@/lib/apiService";
import { useSystemSignal } from "@/hooks/useSystemSignal";
import { TaskDetailsModal } from "./TaskDetailsModal";
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
  onControlAction: (taskId: number, action: 'pause' | 'resume' | 'kill' | 'retry') => void;
  onViewDetails: (task: QueuedTask) => void;
}

function SortableItem({ task, onControlAction, onViewDetails }: SortableItemProps) {
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
        <span className="text-sm font-semibold text-white">{task.description}</span>
        <span className="text-xs text-zinc-500">Ügynök: {task.agent}</span>
        <span className="text-xs text-zinc-600">Státusz: {task.status}</span>
      </div>
      <div className="flex items-center gap-2" {...listeners}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="sm" onClick={() => onControlAction(task.id, 'pause')} aria-label="Szüneteltetés">
              <Pause size={16} />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Szüneteltetés</p>
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="sm" onClick={() => onControlAction(task.id, 'resume')} aria-label="Folytatás">
              <Play size={16} />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Folytatás</p>
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="sm" onClick={() => onControlAction(task.id, 'kill')} aria-label="Leállítás">
              <XCircle size={16} />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Leállítás</p>
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="sm" onClick={() => onControlAction(task.id, 'retry')} aria-label="Újrapróbálkozás">
              <RefreshCcw size={16} />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Újrapróbálkozás</p>
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="sm" onClick={() => onViewDetails(task)} aria-label="Részletek">
              <Info size={16} />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Részletek</p>
          </TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
}

export function ProcessControlWidget() {
  const tasks = useSystemSignalStore((state) => state.tasks);
  const { refetchData } = useSystemSignal();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<QueuedTask | null>(null);
  const [sortedTasks, setSortedTasks] = useState<QueuedTask[]>([]);

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

  const handleViewDetails = (task: QueuedTask) => {
    setSelectedTask(task);
    setIsModalOpen(true);
  };

  const handleControlAction = async (taskId: number, action: 'pause' | 'resume' | 'kill' | 'retry') => {
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
          await retryTask(taskId);
          toast.success(`Feladat ${taskId} újrapróbálva.`);
          break;
        default:
          toast.error(`Ismeretlen akció: ${action}`);
          return;
      }
      refetchData(); // Refresh tasks after action
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      toast.error(`Sikertelen akció ${action} a feladaton ${taskId}: ${errorMessage}`);
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
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          toast.error(`Sikertelen sorrendfrissítés: ${errorMessage}`);
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
                    onViewDetails={handleViewDetails}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}
      </CardContent>
      <TaskDetailsModal task={selectedTask} isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </Card>
  );
}

export default ProcessControlWidget;
