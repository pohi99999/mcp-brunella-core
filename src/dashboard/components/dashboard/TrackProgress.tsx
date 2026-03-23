import { useCallback, useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import {
  getTracks,
  getTrackTodos,
  toggleTrackTodo,
  type Track,
  type TrackTodoItem,
  type TrackTodosResponse,
} from "@/lib/apiService";
import { useSystemSignal } from "@/hooks/useSystemSignal";
import {
  ArrowsClockwise,
  ListChecks,
  ClockCountdown,
  HardDrives,
} from "@phosphor-icons/react";

type TrackTodosState = {
  trackId: string;
  title: string;
  todos: TrackTodoItem[];
  progress: number;
  completedCount: number;
  totalCount: number;
  updatedAt: string;
};

const PRIORITY_BADGES: Record<string, { label: string; className: string }> = {
  P0: "bg-red-500/20 text-red-400 border-red-500/40",
  P1: "bg-orange-500/20 text-orange-400 border-orange-500/40",
  P2: "bg-yellow-500/20 text-yellow-400 border-yellow-500/40",
};

const getPriorityBadge = (priority?: string) => {
  const label = priority ?? "P2";
  return {
    label,
    className: PRIORITY_BADGES[label] || PRIORITY_BADGES.P2,
  };
};

export function TrackProgressWidget() {
  const { socket, isConnected } = useSystemSignal();

  const [isLoadingTracks, setIsLoadingTracks] = useState(false);
  const [isLoadingTodos, setIsLoadingTodos] = useState(false);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [todosByTrack, setTodosByTrack] = useState<
    Record<string, TrackTodosState>
  >({});
  const [error, setError] = useState<string | null>(null);
  const [showWaitingTracks, setShowWaitingTracks] = useState(false);

  const refreshTracks = useCallback(async () => {
    setIsLoadingTracks(true);
    setError(null);
    try {
      const list = await getTracks();
      setTracks(list.tracks || []);
    } catch (e: unknown) {
      const message =
        e instanceof Error ? e.message : "Nem sikerült betölteni a trackeket";
      setError(message);
      toast.error(message);
      setTracks([]);
    } finally {
      setIsLoadingTracks(false);
    }
  }, []);

  const refreshTodosForTracks = useCallback(async (activeTracks: Track[]) => {
    if (activeTracks.length === 0) {
      setTodosByTrack({});
      return;
    }

    setIsLoadingTodos(true);
    const results = await Promise.allSettled(
      activeTracks.map(async (track) => {
        const data = await getTrackTodos(track.id);
        return { trackId: track.id, data };
      }),
    );

    const next: Record<string, TrackTodosState> = {};
    for (const result of results) {
      if (result.status === "fulfilled") {
        const payload = result.value;
        const data: TrackTodosResponse = payload.data;
        next[payload.trackId] = {
          trackId: data.trackId,
          title: data.title,
          todos: data.todos,
          progress: data.progress,
          completedCount: data.completedCount,
          totalCount: data.totalCount,
          updatedAt: data.updatedAt,
        };
      } else {
        const reason =
          result.reason instanceof Error
            ? result.reason.message
            : "Nem sikerült betölteni a TODO-kat";
        toast.error(reason);
      }
    }

    setTodosByTrack(next);
    setIsLoadingTodos(false);
  }, []);

  useEffect(() => {
    refreshTracks();
  }, [refreshTracks]);

  useEffect(() => {
    const active = tracks.filter(
      (track) => track.progress > 0 && track.progress < 100,
    );
    refreshTodosForTracks(active);
  }, [tracks, refreshTodosForTracks]);

  useEffect(() => {
    if (!socket) return;

    const onChanged = () => {
      refreshTracks();
    };

    socket.on("track:changed", onChanged);
    socket.on("track:todo_updated", onChanged);

    return () => {
      socket.off("track:changed", onChanged);
      socket.off("track:todo_updated", onChanged);
    };
  }, [socket, refreshTracks]);

  const toggle = async (
    trackId: string,
    todoId: string,
    completed: boolean,
  ) => {
    const current = todosByTrack[trackId];
    if (!current) return;

    setTodosByTrack((prev) => ({
      ...prev,
      [trackId]: {
        ...current,
        todos: current.todos.map((todo) =>
          todo.id === todoId ? { ...todo, completed } : todo,
        ),
      },
    }));

    try {
      const response = await toggleTrackTodo({
        trackId,
        todoId,
        completed,
      });

      setTodosByTrack((prev) => ({
        ...prev,
        [trackId]: {
          trackId: response.trackId,
          title: response.title,
          todos: response.todos,
          progress: response.progress,
          completedCount: response.completedCount,
          totalCount: response.totalCount,
          updatedAt: response.updatedAt,
        },
      }));
      refreshTracks();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Nem sikerült menteni");
      refreshTracks();
    }
  };

  const connectionBadge = useMemo(() => {
    if (isConnected) {
      return { label: "LIVE", variant: "default" as const };
    }
    if (socket?.active) {
      return { label: "RECONNECT", variant: "secondary" as const };
    }
    return { label: "OFFLINE", variant: "secondary" as const };
  }, [isConnected, socket]);

  const waitingTracks = useMemo(
    () => tracks.filter((track) => track.progress === 0),
    [tracks],
  );

  const activeTracks = useMemo(
    () => tracks.filter((track) => track.progress > 0 && track.progress < 100),
    [tracks],
  );

  return (
    <Card className="glass-card border-white/10 overflow-hidden">
      <CardHeader className="pb-3 border-b border-border/50 bg-muted/20">
        <CardTitle className="flex items-center justify-between text-sm font-bold tracking-wider uppercase text-zinc-500">
          <span className="flex items-center gap-2">
            <ListChecks size={16} className="text-emerald-400" />
            Track Haladás
          </span>
          <span className="flex items-center gap-2">
            <Badge variant={connectionBadge.variant}>
              {connectionBadge.label}
            </Badge>
            <Button
              variant="ghost"
              size="sm"
              onClick={refreshTracks}
              disabled={isLoadingTracks || isLoadingTodos}
              title="Frissítés"
              aria-label="Track lista frissítése"
            >
              <ArrowsClockwise
                size={16}
                className={
                  isLoadingTracks || isLoadingTodos ? "animate-spin" : ""
                }
              />
            </Button>
          </span>
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-4 p-4">
        {error && <div className="text-xs text-red-400">❌ {error}</div>}

        {/* Várakozó track-ek - Collapsible, alapból összecsukva */}
        {waitingTracks.length > 0 && (
          <div className="space-y-2">
            <button
              onClick={() => setShowWaitingTracks(!showWaitingTracks)}
              className="flex items-center gap-2 text-xs font-semibold text-zinc-500 w-full hover:text-foreground transition-colors"
            >
              <ClockCountdown size={14} className="text-blue-400" />
              Várakozó fejlesztésre
              <Badge variant="outline" className="ml-auto">
                {waitingTracks.length}
              </Badge>
              <span className="text-[10px]">{showWaitingTracks ? "▼" : "▶"}</span>
            </button>
            {showWaitingTracks && (
              <div className="space-y-2 pl-5">
                {waitingTracks.map((track) => {
                  const badge = getPriorityBadge(track.priority);
                  return (
                    <div
                      key={track.id}
                      className="rounded-md border border-border/40 bg-background/40 p-2"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-xs font-medium">
                            {track.title}
                          </p>
                          <p className="text-[10px] text-zinc-500">
                            0% • NAP
                          </p>
                        </div>
                        <Badge
                          variant="outline"
                          className={`text-[9px] px-1 py-0 ${badge.className}`}
                        >
                          {badge.label}
                        </Badge>
                      </div>
                      <Progress value={0} className="mt-1.5 h-1" />
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs font-semibold text-zinc-500">
            <HardDrives size={14} className="text-amber-400" />
            Fejlesztés alatt
            <Badge variant="outline" className="ml-auto">
              {activeTracks.length}
            </Badge>
          </div>
          {activeTracks.length === 0 ? (
            <div className="text-xs text-zinc-500 pl-5">
              Nincs aktív fejlesztés
            </div>
          ) : (
            <div className="space-y-2 pl-5">
              {activeTracks.map((track) => {
                const badge = getPriorityBadge(track.priority);
                const todoState = todosByTrack[track.id];
                const progress = todoState?.progress ?? track.progress;
                const remaining = todoState
                  ? Math.max(
                    todoState.totalCount - todoState.completedCount,
                    0,
                  )
                  : null;

                return (
                  <div
                    key={track.id}
                    className="rounded-md border border-border/40 bg-background/40 p-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-xs font-medium">
                          {track.title}
                        </p>
                        <p className="text-[10px] text-zinc-500">
                          {progress}%
                          {remaining !== null ? ` • ${remaining} hátra` : ""}
                        </p>
                      </div>
                      <Badge
                        variant="outline"
                        className={`text-[9px] px-1 py-0 ${badge.className}`}
                      >
                        {badge.label}
                      </Badge>
                    </div>

                    <Progress value={progress} className="mt-1.5 h-1" />

                    <div className="mt-2 space-y-1">
                      {todoState?.todos?.length ? (
                        <ul className="space-y-0.5 text-[10px]">
                          {todoState.todos.slice(0, 2).map((todo) => (
                            <li
                              key={todo.id}
                              className="flex items-start gap-2"
                            >
                              <Checkbox
                                checked={todo.completed}
                                onCheckedChange={(checked) =>
                                  toggle(track.id, todo.id, Boolean(checked))
                                }
                                aria-label={`TODO: ${todo.text}`}
                              />
                              <span
                                className={
                                  todo.completed
                                    ? "line-through text-zinc-500"
                                    : "text-foreground"
                                }
                              >
                                {todo.text}
                              </span>
                            </li>
                          ))}
                          {todoState.todos.length > 4 && (
                            <li className="text-zinc-500">
                              +{todoState.todos.length - 4} további feladat
                            </li>
                          )}
                        </ul>
                      ) : (
                        <div className="text-xs text-zinc-500">
                          {isLoadingTodos
                            ? "TODO betöltése..."
                            : "Nincs TODO elem"}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}