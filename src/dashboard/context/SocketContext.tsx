import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { io, type Socket } from "socket.io-client";
import { useSystemSignalStore } from "../store/systemSignalStore";
import {
  getTasks,
  getTaskStats,
  checkHealth,
  getDeveloperMetrics,
} from "../lib/apiService";

export type LogType = "info" | "error" | "success";

export interface LogEntry {
  id: string;
  message: string;
  type: LogType;
  timestamp: number;
  source?: string;
}

export type AgentStatusPayload = "idle" | "working" | "error";

export interface RobotkezStep {
  index: number;
  status: 'pending' | 'working' | 'completed' | 'error';
  description: string;
  screenshot?: string;
  error?: string;
}

export interface RobotkezPlan {
  taskId: string;
  plan: {
    plan: RobotkezStep[];
    estimatedDuration: number;
  };
}

export interface AgentStatusEntry {
  name: string;
  status: AgentStatusPayload;
  taskDescription?: string;
  lastUpdated: number;
}

export interface ChatterEntry {
  id: string;
  sender: string;
  receiver?: string;
  message: string;
  context?: any;
  timestamp: number;
}

interface SocketContextValue {
  socket: Socket | null;
}

const SocketContext = createContext<SocketContextValue | null>(null);

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || "";

export function SocketProvider({ children }: { children: ReactNode }) {
  const [socketInstance, setSocketInstance] = useState<Socket | null>(null);

  // Get actions from the store
  const setConnected = useSystemSignalStore((state) => state.setConnected);
  const addLog = useSystemSignalStore((state) => state.addLog);
  const addChatter = useSystemSignalStore((state) => state.addChatter);
  const updateAgentStatus = useSystemSignalStore((state) => state.updateAgentStatus);
  const setAllAgentStatuses = useSystemSignalStore((state) => state.setAllAgentStatuses);
  const setRobotkezPlan = useSystemSignalStore((state) => state.setRobotkezPlan);
  const updateRobotkezStep = useSystemSignalStore((state) => state.updateRobotkezStep);
  const clearRobotkez = useSystemSignalStore((state) => state.clearRobotkez);
  const addMachineAlert = useSystemSignalStore((state) => state.addMachineAlert);
  const setError = useSystemSignalStore((state) => state.setError);
  const setLoading = useSystemSignalStore((state) => state.setLoading);
  const setTasks = useSystemSignalStore((state) => state.setTasks);
  const setTaskStats = useSystemSignalStore((state) => state.setTaskStats);
  const setHealthStatus = useSystemSignalStore((state) => state.setHealthStatus);
  const setDeveloperMetrics = useSystemSignalStore((state) => state.setDeveloperMetrics);

  // Initial REST fetch
  useEffect(() => {
    let isMounted = true;
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const [tasksRes, taskStatsRes, healthRes, devMetricsRes] = await Promise.allSettled([
          getTasks(50, 0, "running"),
          getTaskStats(),
          checkHealth(),
          getDeveloperMetrics(),
        ]);

        if (!isMounted) return;

        if (tasksRes.status === "fulfilled") setTasks(tasksRes.value.tasks);
        else setError(tasksRes.reason.message);

        if (taskStatsRes.status === "fulfilled") setTaskStats(taskStatsRes.value);
        else setError(taskStatsRes.reason.message);

        if (healthRes.status === "fulfilled") setHealthStatus(healthRes.value);
        else setError(healthRes.reason.message);

        if (devMetricsRes.status === "fulfilled") setDeveloperMetrics(devMetricsRes.value);
        else setError(devMetricsRes.reason.message);

      } catch (err: any) {
        if (!isMounted) return;
        setError(err.message || "Adatlekérdezési hiba");
        addLog({ message: `REST adatlekérdezési hiba: ${err.message}`, type: "error", source: "SystemSignal" });
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [setLoading, setError, setTasks, setTaskStats, setHealthStatus, setDeveloperMetrics, addLog]);

  useEffect(() => {
    const socket = io(SOCKET_URL, {
      path: "/socket.io",
      transports: ["polling", "websocket"],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    setSocketInstance(socket);

    // Expose socket to window for E2E testing
    if (typeof window !== 'undefined') {
      (window as any).__BRUNELLA_SOCKET__ = socket;
    }

    const getErrorMessage = (error: unknown): string => {
      if (error instanceof Error) return error.message;
      if (typeof error === "string") return error;
      if (typeof error === "object" && error !== null) {
        const maybe = (error as { message?: unknown }).message;
        if (typeof maybe === "string") return maybe;
      }
      return "ismeretlen hiba";
    };

    const log = (message: string, type: LogType = "info") => {
      addLog({
        message,
        type,
        timestamp: Date.now(),
        source: "Socket",
      });
    };

    const onConnect = () => {
      setConnected(true);
      log("Socket csatlakozva ✅", "success");
    };

    const onDisconnect = (reason: unknown) => {
      setConnected(false);
      const r = typeof reason === "string" ? reason : "unknown";
      log(`Socket bontva: ${r}`, "error");
    };

    const onConnectError = (error: unknown) => {
      log(`Socket kapcsolódási hiba: ${getErrorMessage(error)}`, "error");
    };

    const onError = (error: unknown) => {
      const msg = getErrorMessage(error);
      log(`Socket hiba: ${msg}`, "error");
    };

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("connect_error", onConnectError);
    socket.on("error", onError);

    // Reconnect UX (manager events)
    const manager = socket.io;
    const onReconnectAttempt = (attempt: unknown) => {
      const n = typeof attempt === "number" ? attempt : undefined;
      log(`Socket újrapróbálkozás...${n ? ` (#${n})` : ""}`);
    };
    const onReconnect = (attempt: unknown) => {
      const n = typeof attempt === "number" ? attempt : undefined;
      log(`Socket újracsatlakozott ✅${n ? ` (#${n})` : ""}`, "success");
    };
    const onReconnectError = (_err: unknown) => {
      log("Socket újracsatlakozás sikertelen (próbálkozás fut)", "error");
    };
    const onReconnectFailed = () => {
      log("Socket újracsatlakozás feladva (max próbálkozás)", "error");
    };

    manager.on("reconnect_attempt", onReconnectAttempt);
    manager.on("reconnect", onReconnect);
    manager.on("reconnect_error", onReconnectError);
    manager.on("reconnect_failed", onReconnectFailed);

    socket.on(
      "system:log",
      (data: {
        message: string;
        type: LogType;
        timestamp?: number;
        source?: string;
      }) => {
        addLog({
          message: data.message,
          type: data.type ?? "info",
          timestamp: data.timestamp ?? Date.now(),
          source: data.source,
        });
      },
    );

    socket.on(
      "agent:chatter",
      (data: {
        sender: string;
        receiver?: string;
        message: string;
        context?: any;
        timestamp?: number;
      }) => {
        addChatter({
          sender: data.sender,
          receiver: data.receiver,
          message: data.message,
          context: data.context,
          timestamp: data.timestamp ?? Date.now(),
        });
      },
    );

    socket.on(
      "agent:update",
      (data: {
        agentName: string;
        status: AgentStatusPayload;
        taskDescription?: string;
      }) => {
        if (data.agentName && data.status) {
          updateAgentStatus(data.agentName, data.status, data.taskDescription);
        }
      },
    );

    socket.on("robotkez:plan", (data: RobotkezPlan) => {
      setRobotkezPlan(data);
    });

    socket.on("robotkez:step", (data: Partial<RobotkezStep> & { index: number }) => {
      updateRobotkezStep(data);
    });

    socket.on("robotkez:aborted", () => {
      clearRobotkez();
    });

    socket.on("agents:snapshot", (data: AgentStatusEntry[]) => {
      if (Array.isArray(data)) {
        setAllAgentStatuses(data);
      }
    });

    socket.on("machine:alert", (data: any) => {
      addMachineAlert(data);
    });

    // Developer pipeline progress → rendszernapló + chatter
    socket.on("developer:progress", (data: {
      taskId?: string;
      phaseId?: string;
      status?: string;
      progress?: number;
      message?: string;
    }) => {
      if (data.message) {
        addLog({
          message: `[Pipeline] ${data.message}`,
          type: data.status === 'error' ? 'error' : 'info',
          source: 'DeveloperPipeline',
        });
        addChatter({
          sender: 'DeveloperPipeline',
          message: data.message,
          timestamp: Date.now(),
        });
      }
    });

    // Task lista valós idejű frissítése (szerver 5mp-enként küldi)
    socket.on("tasks_update", (data: any[]) => {
      if (Array.isArray(data)) {
        setTasks(data);
      }
    });

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("connect_error", onConnectError);
      socket.off("error", onError);

      manager.off("reconnect_attempt", onReconnectAttempt);
      manager.off("reconnect", onReconnect);
      manager.off("reconnect_error", onReconnectError);
      manager.off("reconnect_failed", onReconnectFailed);

      socket.off("system:log");
      socket.off("agent:update");
      socket.off("agent:chatter");
      socket.off("robotkez:plan");
      socket.off("robotkez:step");
      socket.off("robotkez:aborted");
      socket.off("agents:snapshot");
      socket.off("machine:alert");
      socket.off("developer:progress");
      socket.off("tasks_update");
      socket.disconnect();
      setSocketInstance(null);
    };
  }, [setConnected, addLog, addChatter, updateAgentStatus, setAllAgentStatuses, setRobotkezPlan, updateRobotkezStep, clearRobotkez, addMachineAlert, setTasks]);

  const value: SocketContextValue = {
    socket: socketInstance,
  };

  return (
    <SocketContext.Provider value={value}>{children}</SocketContext.Provider>
  );
}

export function useSocket() {
  const ctx = useContext(SocketContext);
  if (!ctx) throw new Error("useSocket must be used within SocketProvider");
  return ctx;
}
