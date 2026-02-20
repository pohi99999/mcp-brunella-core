import { useEffect, useRef } from "react";
import { io, type Socket } from "socket.io-client";
import { useSystemSignalStore } from "../store/systemSignalStore";
import { 
  LogType, 
  AgentStatusPayload, 
  RobotkezPlan, 
  RobotkezStep 
} from "../context/SocketContext";
import { 
  getTasks, 
  getTaskStats, 
  checkHealth, 
  getDeveloperMetrics, 
  QueuedTask, 
  TaskStats, 
  HealthStatus, 
  DeveloperMetricsData 
} from "../lib/apiService";

const SOCKET_URL =
  import.meta.env.VITE_SOCKET_URL ||
  (import.meta.env.DEV ? "http://localhost:3000" : window.location.origin);

interface UseSystemSignalOptions {
  enablePolling?: boolean;
  pollingInterval?: number; // Not implemented yet, for future REST polling fallback
}

export function useSystemSignal(options?: UseSystemSignalOptions) {
  const setConnected = useSystemSignalStore((state) => state.setConnected);
  const addLog = useSystemSignalStore((state) => state.addLog);
  const addChatter = useSystemSignalStore((state) => state.addChatter);
  const updateAgentStatus = useSystemSignalStore((state) => state.updateAgentStatus);
  const setRobotkezPlan = useSystemSignalStore((state) => state.setRobotkezPlan);
  const updateRobotkezStep = useSystemSignalStore((state) => state.updateRobotkezStep);
  const clearRobotkez = useSystemSignalStore((state) => state.clearRobotkez);
  const setError = useSystemSignalStore((state) => state.setError);
  const setLoading = useSystemSignalStore((state) => state.setLoading);
  const setTasks = useSystemSignalStore((state) => state.setTasks);
  const setTaskStats = useSystemSignalStore((state) => state.setTaskStats);
  const setHealthStatus = useSystemSignalStore((state) => state.setHealthStatus);
  const setDeveloperMetrics = useSystemSignalStore((state) => state.setDeveloperMetrics);

  const socketRef = useRef<Socket | null>(null);
  const isConnected = useSystemSignalStore((state) => state.isConnected);

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

      if (tasksRes.status === "fulfilled") setTasks(tasksRes.value.tasks);
      else setError(tasksRes.reason.message);

      if (taskStatsRes.status === "fulfilled") setTaskStats(taskStatsRes.value);
      else setError(taskStatsRes.reason.message);

      if (healthRes.status === "fulfilled") setHealthStatus(healthRes.value);
      else setError(healthRes.reason.message);

      if (devMetricsRes.status === "fulfilled") setDeveloperMetrics(devMetricsRes.value);
      else setError(devMetricsRes.reason.message);

    } catch (err: any) {
      setError(err.message || "Adatlekérdezési hiba");
      addLog({ message: `REST adatlekérdezési hiba: ${err.message}`, type: "error", source: "SystemSignal" });
    } finally {
      setLoading(false);
    }
  };

  // Initial fetch and polling setup
  useEffect(() => {
    if (!isConnected || options?.enablePolling) {
      fetchData(); // Initial fetch
      const interval = setInterval(fetchData, options?.pollingInterval || 5000);
      return () => clearInterval(interval);
    }
  }, [isConnected, options?.enablePolling, options?.pollingInterval]);

  useEffect(() => {
    const socket = io(SOCKET_URL, {
      path: "/socket.io",
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    socketRef.current = socket;

    const getErrorMessage = (error: unknown): string => {
      if (error instanceof Error) return error.message;
      if (typeof error === "string") return error;
      if (typeof error === "object" && error !== null) {
        const maybe = (error as { message?: unknown }).message;
        if (typeof maybe === "string") return maybe;
      }
      return "ismeretlen hiba";
    };

    // Connection events
    const onConnect = () => {
      setConnected(true);
      addLog({ message: "Socket csatlakozva ✅", type: "success", source: "Socket" });
    };
    const onDisconnect = (reason: unknown) => {
      setConnected(false);
      addLog({ message: `Socket bontva: ${reason}`, type: "error", source: "Socket" });
    };
    const onConnectError = (error: unknown) => {
      const msg = getErrorMessage(error);
      addLog({ message: `Socket kapcsolódási hiba: ${msg}`, type: "error", source: "Socket" });
      setError(msg); 
    };
    const onError = (error: unknown) => {
      const msg = getErrorMessage(error);
      addLog({ message: `Socket hiba: ${msg}`, type: "error", source: "Socket" });
      setError(msg);
    };

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("connect_error", onConnectError);
    socket.on("error", onError);

    // System & Agent events
    socket.on(
      "system:log",
      (data: { message: string; type: LogType; timestamp?: number; source?: string }) => {
        addLog({ ...data, type: data.type ?? "info", timestamp: data.timestamp ?? Date.now() });
      },
    );

    socket.on(
      "agent:chatter",
      (data: { sender: string; receiver?: string; message: string; context?: any; timestamp?: number }) => {
        addChatter({ ...data, timestamp: data.timestamp ?? Date.now() });
      },
    );

    socket.on(
      "agent:update",
      (data: { agentName: string; status: AgentStatusPayload; taskDescription?: string }) => {
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

    // Cleanup
    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("connect_error", onConnectError);
      socket.off("error", onError);
      socket.off("system:log");
      socket.off("agent:chatter");
      socket.off("agent:update");
      socket.off("robotkez:plan");
      socket.off("robotkez:step");
      socket.off("robotkez:aborted");
      socket.disconnect();
      socketRef.current = null;
    };
  }, [addChatter, addLog, clearRobotkez, setConnected, setError, setRobotkezPlan, updateAgentStatus, updateRobotkezStep]);

      // Return state and actions from the store, or specific derived values
      return {
        ...useSystemSignalStore((state) => ({
          isConnected: state.isConnected,
          logs: state.logs,
          agents: state.agents,
          chatter: state.chatter,
          robotkezPlan: state.robotkezPlan,
          robotkezSteps: state.robotkezSteps,
          tasks: state.tasks,
          taskStats: state.taskStats,
          healthStatus: state.healthStatus,
          developerMetrics: state.developerMetrics,
          error: state.error,
          isLoading: state.isLoading,
        })),
        refetchData: fetchData, // Expose fetchData for manual refetch
      };
    }
  
