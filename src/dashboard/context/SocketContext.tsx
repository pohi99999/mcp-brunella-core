import {
  createContext,
  useContext,
  useEffect,
  useReducer,
  useState,
  type ReactNode,
} from "react";
import { io, type Socket } from "socket.io-client";

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

interface SocketState {
  isConnected: boolean;
  logs: LogEntry[];
  agents: Map<string, AgentStatusEntry>;
  robotkezPlan: RobotkezPlan | null;
  robotkezSteps: RobotkezStep[];
}

type SocketAction =
  | { type: "connect" }
  | { type: "disconnect" }
  | { type: "log"; payload: Omit<LogEntry, "id"> }
  | {
      type: "agent_update";
      payload: {
        agentName: string;
        status: AgentStatusPayload;
        taskDescription?: string;
      };
    }
  | { type: "robotkez_plan"; payload: RobotkezPlan }
  | { type: "robotkez_step"; payload: Partial<RobotkezStep> & { index: number } }
  | { type: "robotkez_clear" };

const MAX_LOGS = 200;
let logIdCounter = 0;

function socketReducer(state: SocketState, action: SocketAction): SocketState {
  switch (action.type) {
    case "connect":
      return { ...state, isConnected: true };
    case "disconnect":
      return { ...state, isConnected: false };
    case "log": {
      const newLog: LogEntry = {
        ...action.payload,
        id: `log-${++logIdCounter}`,
      };
      const logs = [newLog, ...state.logs].slice(0, MAX_LOGS);
      return { ...state, logs };
    }
    case "agent_update": {
      const { agentName, status, taskDescription } = action.payload;
      const agents = new Map(state.agents);
      agents.set(agentName, {
        name: agentName,
        status,
        taskDescription,
        lastUpdated: Date.now(),
      });
      return { ...state, agents };
    }
    case "robotkez_plan": {
      return { 
        ...state, 
        robotkezPlan: action.payload,
        robotkezSteps: action.payload.plan.plan.map((s, i) => ({ ...s, index: i, status: 'pending' }))
      };
    }
    case "robotkez_step": {
      const steps = [...state.robotkezSteps];
      const idx = action.payload.index;
      if (steps[idx]) {
        steps[idx] = { ...steps[idx], ...action.payload };
      }
      return { ...state, robotkezSteps: steps };
    }
    case "robotkez_clear": {
      return { ...state, robotkezPlan: null, robotkezSteps: [] };
    }
    default:
      return state;
  }
}

const initialState: SocketState = {
  isConnected: false,
  logs: [],
  agents: new Map(),
  robotkezPlan: null,
  robotkezSteps: []
};

interface SocketContextValue extends SocketState {
  socket: Socket | null;
}

const SocketContext = createContext<SocketContextValue | null>(null);

const SOCKET_URL =
  import.meta.env.VITE_SOCKET_URL ||
  (import.meta.env.DEV ? "http://localhost:3000" : window.location.origin);

export function SocketProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(socketReducer, initialState);
  const [socketInstance, setSocketInstance] = useState<Socket | null>(null);

  useEffect(() => {
    const socket = io(SOCKET_URL, {
      path: "/socket.io",
      transports: ["websocket", "polling"],
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
      dispatch({
        type: "log",
        payload: {
          message,
          type,
          timestamp: Date.now(),
          source: "Socket",
        },
      });
    };

    const onConnect = () => {
      dispatch({ type: "connect" });
      log("Socket csatlakozva ✅", "success");
    };

    const onDisconnect = (reason: unknown) => {
      dispatch({ type: "disconnect" });
      const r = typeof reason === "string" ? reason : "unknown";
      // socket.io reasons: 'transport close', 'io client disconnect', 'io server disconnect', ...
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
        dispatch({
          type: "log",
          payload: {
            message: data.message,
            type: data.type ?? "info",
            timestamp: data.timestamp ?? Date.now(),
            source: data.source,
          },
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
                dispatch({
                  type: "agent_update",
                  payload: {
                    agentName: data.agentName,
                    status: data.status,
                    taskDescription: data.taskDescription,
                  },
                });
              }
            },
          );
    
          socket.on("robotkez:plan", (data: RobotkezPlan) => {
            dispatch({ type: "robotkez_plan", payload: data });
          });
    
          socket.on("robotkez:step", (data: Partial<RobotkezStep> & { index: number }) => {
            dispatch({ type: "robotkez_step", payload: data });
          });
    
          socket.on("robotkez:aborted", () => {
            dispatch({ type: "robotkez_clear" });
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
      socket.disconnect();
      setSocketInstance(null);
    };
  }, []);

  const value: SocketContextValue = {
    ...state,
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
