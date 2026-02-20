import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { QueuedTask } from "@/lib/apiService";

interface TaskDetailsModalProps {
  task: QueuedTask | null;
  isOpen: boolean;
  onClose: () => void;
}

export function TaskDetailsModal({ task, isOpen, onClose }: TaskDetailsModalProps) {
  if (!task) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[800px]">
        <DialogHeader>
          <DialogTitle>Feladat Részletei: {task.description}</DialogTitle>
          <DialogDescription>
            Task ID: {task.id}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <p className="text-sm text-zinc-500">Ügynök: <span className="font-semibold text-white">{task.agent}</span></p>
          <p className="text-sm text-zinc-500">Státusz: <span className="font-semibold text-white">{task.status}</span></p>
          <p className="text-sm text-zinc-500">Létrehozva: <span className="font-semibold text-white">{new Date(task.created_at).toLocaleString()}</span></p>
          {task.startedAt && <p className="text-sm text-zinc-500">Indítva: <span className="font-semibold text-white">{new Date(task.startedAt).toLocaleString()}</span></p>}
          {task.completed_at && <p className="text-sm text-zinc-500">Befejezve: <span className="font-semibold text-white">{new Date(task.completed_at).toLocaleString()}</span></p>}
          {task.context && (
            <div>
              <p className="text-sm font-semibold text-white">Kontextus:</p>
              <pre className="mt-2 p-2 bg-black/10 rounded text-xs overflow-x-auto custom-scrollbar">
                {JSON.stringify(JSON.parse(task.context), null, 2)}
              </pre>
            </div>
          )}
          {task.result && (
            <div>
              <p className="text-sm font-semibold text-white">Eredmény:</p>
              <pre className="mt-2 p-2 bg-black/10 rounded text-xs overflow-x-auto custom-scrollbar">
                {task.result}
              </pre>
            </div>
          )}
          {/* Placeholder for future trace visualization */}
          <div className="mt-4 p-4 border border-dashed border-zinc-700 rounded text-zinc-500 text-center text-sm">
            LangSmith / OpenTelemetry Trace vizualizáció jön ide...
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default TaskDetailsModal;
