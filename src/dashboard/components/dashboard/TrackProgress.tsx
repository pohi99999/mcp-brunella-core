import { useCallback, useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  getActiveTrackTodoSummaries,
  getTrackTodos,
  toggleTrackTodo,
  type TrackTodoItem,
  type TrackTodoSummary,
} from "@/lib/apiService";
import { useSocket } from "@/context/SocketContext";
import { ArrowsClockwise, ListChecks } from "@phosphor-icons/react";

type TrackTodosState = {
  trackId: string;
  title: string;
  todos: TrackTodoItem[];
  progress: number;
  completedCount: number;
  totalCount: number;
  updatedAt: string;
};

export function TrackProgressWidget() {
  const { socket, isConnected } = useSocket();

  const [isLoadingTracks, setIsLoadingTracks] = useState(false);
  const [tracks, setTracks] = useState<TrackTodoSummary[]>([]);
  const [selectedTrackId, setSelectedTrackId] = useState<string>("");

  const [isLoadingTodos, setIsLoadingTodos] = useState(false);
  const [todosState, setTodosState] = useState<TrackTodosState | null>(null);

  const selectedTrack = useMemo(
    () => tracks.find((t) => t.trackId === selectedTrackId) || null,
    [tracks, selectedTrackId],
  );

  const refreshTracks = useCallback(async () => {
    setIsLoadingTracks(true);
    try {
      const list = await getActiveTrackTodoSummaries();
      setTracks(list);
      if (!selectedTrackId && list.length > 0) {
        setSelectedTrackId(list[0].trackId);
      }
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Nem sikerült betölteni a trackeket");
      setTracks([]);
    } finally {
      setIsLoadingTracks(false);
    }
  }, [selectedTrackId]);

  const refreshTodos = useCallback(async (trackId: string) => {
    if (!trackId) return;
    setIsLoadingTodos(true);
    try {
      const r = await getTrackTodos(trackId);
      setTodosState({
        trackId: r.trackId,
        title: r.title,
        todos: r.todos,
        progress: r.progress,
        completedCount: r.completedCount,
        totalCount: r.totalCount,
        updatedAt: r.updatedAt,
      });
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Nem sikerült betölteni a TODO-kat");
      setTodosState(null);
    } finally {
      setIsLoadingTodos(false);
    }
  }, []);

  useEffect(() => {
    refreshTracks();
  }, [refreshTracks]);

  useEffect(() => {
    if (!selectedTrackId) return;
    refreshTodos(selectedTrackId);
  }, [selectedTrackId, refreshTodos]);

  // Real-time-ish updates via Socket.IO events from backend watcher / toggles
  useEffect(() => {
    if (!socket) return;

    const onChanged = (payload: { trackId?: string }) => {
      const tid = String(payload?.trackId || "");
      if (!tid) return;

      // Update list (counts might change)
      refreshTracks();
      if (tid === selectedTrackId) refreshTodos(tid);
    };

    socket.on("track:changed", onChanged);
    socket.on("track:todo_updated", onChanged);

    return () => {
      socket.off("track:changed", onChanged);
      socket.off("track:todo_updated", onChanged);
    };
  }, [socket, selectedTrackId]);

  const toggle = async (todoId: string, completed: boolean) => {
    if (!todosState) return;

    // Optimistic UI
    setTodosState({
      ...todosState,
      todos: todosState.todos.map((t) =>
        t.id === todoId ? { ...t, completed } : t,
      ),
    });

    try {
      const r = await toggleTrackTodo({
        trackId: todosState.trackId,
        todoId,
        completed,
      });

      setTodosState({
        trackId: r.trackId,
        title: r.title,
        todos: r.todos,
        progress: r.progress,
        completedCount: r.completedCount,
        totalCount: r.totalCount,
        updatedAt: r.updatedAt,
      });
      refreshTracks();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Nem sikerült menteni");
      // rollback: reload authoritative state
      refreshTodos(todosState.trackId);
    }
  };

  const pct = todosState?.progress ?? selectedTrack?.progress ?? 0;

  return (
    <Card className="glass-card border-white/10 overflow-hidden">
      <CardHeader className="pb-3 border-b border-border/50 bg-muted/20">
        <CardTitle className="flex items-center justify-between text-sm font-bold tracking-wider uppercase text-muted-foreground">
          <span className="flex items-center gap-2">
            <ListChecks size={16} className="text-emerald-400" />
            Track TODO
          </span>
          <span className="flex items-center gap-2">
            <Badge variant={isConnected ? "default" : "secondary"}>
              {isConnected ? "LIVE" : "OFFLINE"}
            </Badge>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                refreshTracks();
                if (selectedTrackId) refreshTodos(selectedTrackId);
              }}
              disabled={isLoadingTracks || isLoadingTodos}
              title="Frissítés"
            >
              <ArrowsClockwise
                size={16}
                className={isLoadingTracks || isLoadingTodos ? "animate-spin" : ""}
              />
            </Button>
          </span>
        </CardTitle>
      </CardHeader>

      <CardContent className="p-4 space-y-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <Select value={selectedTrackId} onValueChange={setSelectedTrackId}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Válassz aktív tracket" />
              </SelectTrigger>
              <SelectContent>
                {tracks.length === 0 ? (
                  <SelectItem value="__none" disabled>
                    Nincs aktív track
                  </SelectItem>
                ) : (
                  tracks.map((t) => (
                    <SelectItem key={t.trackId} value={t.trackId}>
                      {t.title} ({t.progress}%)
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="truncate">
              {todosState?.title || selectedTrack?.title || "-"}
            </span>
            <span className="font-mono">{pct}%</span>
          </div>
          <Progress value={pct} className="h-2 bg-white/5" />
          <div className="text-[11px] text-muted-foreground font-mono">
            {todosState
              ? `${todosState.completedCount}/${todosState.totalCount} kész`
              : selectedTrack
                ? `${selectedTrack.completedCount}/${selectedTrack.totalCount} kész`
                : "-"}
          </div>
        </div>

        <div className="space-y-2 max-h-[260px] overflow-auto pr-1">
          {isLoadingTodos ? (
            <div className="text-sm text-muted-foreground">Betöltés...</div>
          ) : !todosState ? (
            <div className="text-sm text-muted-foreground">
              Válassz egy tracket a TODO-khoz.
            </div>
          ) : todosState.todos.length === 0 ? (
            <div className="text-sm text-muted-foreground">
              Nincs checkbox TODO a track.md-ben.
            </div>
          ) : (
            todosState.todos.map((t) => (
              <label
                key={t.id}
                className="flex items-start gap-2 rounded-md px-2 py-1.5 hover:bg-muted/30 transition-colors"
              >
                <Checkbox
                  checked={t.completed}
                  onCheckedChange={(v) => toggle(t.id, v === true)}
                />
                <span
                  className={
                    "text-sm leading-snug " +
                    (t.completed
                      ? "line-through text-muted-foreground"
                      : "text-foreground")
                  }
                >
                  {t.text}
                </span>
              </label>
            ))
          )}
        </div>

        {todosState?.updatedAt ? (
          <div className="text-[10px] text-muted-foreground font-mono">
            updated: {todosState.updatedAt.slice(0, 19).replace("T", " ")}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
