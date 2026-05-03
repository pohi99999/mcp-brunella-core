import { create } from 'zustand';
import type {
  AgentStatusEntry,
  ChatterEntry,
  RobotkezPlan,
  RobotkezStep,
} from '@/context/SocketContext';
import type {
  DeveloperMetricsData,
  HealthStatus,
  QueuedTask,
  TaskStats,
} from '@/lib/apiService';
import type { LogEntry, MachineAlert } from '../types/dashboard';

interface SystemSignalState {
  // WebSocket-től származó adatok
  isConnected: boolean;
  logs: LogEntry[];
  agents: Map<string, AgentStatusEntry>;
  chatter: ChatterEntry[];
  robotkezPlan: RobotkezPlan | null;
  robotkezSteps: RobotkezStep[];
  machineAlerts: MachineAlert[];

  // REST API-ból származó adatok
  tasks: QueuedTask[];
  taskStats: TaskStats | null;
  healthStatus: HealthStatus | null;
  developerMetrics: DeveloperMetricsData | null;

  // Általános állapotkezelés
  error: string | null;
  isLoading: boolean;
}

interface SystemSignalActions {
  // WebSocket actionök
  setConnected: (isConnected: boolean) => void;
  addLog: (log: Omit<LogEntry, 'id'>) => void;
  addChatter: (chatter: Omit<ChatterEntry, 'id'>) => void;
  updateAgentStatus: (agentName: string, status: AgentStatusEntry['status'], taskDescription?: string) => void;
  setRobotkezPlan: (plan: RobotkezPlan) => void;
  updateRobotkezStep: (step: Partial<RobotkezStep> & { index: number }) => void;
  clearRobotkez: () => void;
  setAllAgentStatuses: (statuses: AgentStatusEntry[]) => void;
  addMachineAlert: (alert: MachineAlert) => void;
  clearMachineAlerts: () => void;

  // REST API actionök
  setTasks: (tasks: QueuedTask[]) => void;
  setTaskStats: (stats: TaskStats) => void;
  setHealthStatus: (status: HealthStatus) => void;
  setDeveloperMetrics: (metrics: DeveloperMetricsData) => void;

  // Általános actionök
  setError: (error: string | null) => void;
  setLoading: (isLoading: boolean) => void;

  // Clear all data (e.g., on logout or system reset)
  clearAllData: () => void;
}

const MAX_LOGS = 200;
const MAX_CHATTER = 100;
let logIdCounter = 0;
let chatterIdCounter = 0;

export const useSystemSignalStore = create<SystemSignalState & SystemSignalActions>()((set) => ({
  // Initial state
  isConnected: false,
  logs: [],
  agents: new Map(),
  chatter: [],
  robotkezPlan: null,
  robotkezSteps: [],
  machineAlerts: [],
  tasks: [],
  taskStats: null,
  healthStatus: null,
  developerMetrics: null,
  error: null,
  isLoading: false,

  // Actions
  setConnected: (isConnected) => set({ isConnected }),
  addLog: (payload) => set((state) => ({
    logs: [{ ...payload, id: `log-${++logIdCounter}` }, ...state.logs].slice(0, MAX_LOGS),
  })),
  addChatter: (payload) => set((state) => ({
    chatter: [{ ...payload, id: `chat-${++chatterIdCounter}` }, ...state.chatter].slice(0, MAX_CHATTER),
  })),
  updateAgentStatus: (agentName, status, taskDescription) => set((state) => {
    const agents = new Map(state.agents);
    agents.set(agentName, { name: agentName, status, taskDescription, lastUpdated: Date.now() });
    return { agents };
  }),
  setRobotkezPlan: (plan) => set(() => ({
    robotkezPlan: plan,
    robotkezSteps: plan.plan.plan.map((s, i) => ({ ...s, index: i, status: 'pending' }))
  })),
  updateRobotkezStep: (payload) => set((state) => {
    const steps = [...state.robotkezSteps];
    const idx = payload.index;
    if (steps[idx]) {
      steps[idx] = { ...steps[idx], ...payload };
    }
    return { robotkezSteps: steps };
  }),
  clearRobotkez: () => set({ robotkezPlan: null, robotkezSteps: [] }),

  setAllAgentStatuses: (statuses) => set(() => {
    const newAgents = new Map<string, AgentStatusEntry>();
    statuses.forEach(s => newAgents.set(s.name, { ...s, lastUpdated: Date.now() }));
    return { agents: newAgents };
  }),

  addMachineAlert: (alert) => set((state) => ({
    machineAlerts: [alert, ...state.machineAlerts].slice(0, 50)
  })),
  clearMachineAlerts: () => set({ machineAlerts: [] }),

  setTasks: (tasks) => set({ tasks }),
  setTaskStats: (taskStats) => set({ taskStats }),
  setHealthStatus: (healthStatus) => set({ healthStatus }),
  setDeveloperMetrics: (developerMetrics) => set({ developerMetrics }),

  setError: (error) => set({ error }),
  setLoading: (isLoading) => set({ isLoading }),

  clearAllData: () => set({
    isConnected: false,
    logs: [],
    agents: new Map(),
    chatter: [],
    robotkezPlan: null,
    robotkezSteps: [],
    machineAlerts: [],
    tasks: [],
    taskStats: null,
    healthStatus: null,
    developerMetrics: null,
    error: null,
    isLoading: false,
  }),
}));
