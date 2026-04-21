import { create } from 'zustand'
import { ServerState, LogEntry, ConfigItem, ServerMetrics, AgentTool, ChatMessage, ExecutionPlan, PlanStep } from './types'

interface McpState {
  serverState: ServerState
  logs: LogEntry[]
  chatMessages: ChatMessage[]
  config: ConfigItem[]
  agentTools: AgentTool[]
  metrics: ServerMetrics
  isConnected: boolean
  currentPlan: ExecutionPlan | null
  mcpServers: any[]
  
  setServerState: (state: Partial<ServerState>) => void
  addLog: (log: LogEntry) => void
  setLogs: (logs: LogEntry[]) => void
  addChatMessage: (message: ChatMessage) => void
  setChatMessages: (messages: ChatMessage[]) => void
  appendChunkToLastMessage: (chunk: string) => void
  setLastMessageStreaming: (streaming: boolean) => void
  updateLastChatMessage: (content: string) => void
  setConfig: (config: ConfigItem[]) => void
  setAgentTools: (tools: AgentTool[]) => void
  setMetrics: (metrics: ServerMetrics) => void
  setConnected: (connected: boolean) => void
  setCurrentPlan: (plan: ExecutionPlan | null) => void
  updatePlanStep: (stepUpdate: Partial<PlanStep> & { id: string }) => void
  setMcpServers: (servers: any[]) => void
}

export const useMcpStore = create<McpState>((set) => ({
  serverState: {
    status: 'stopped',
    uptime: 0,
    cpuUsage: 0,
    memoryUsage: 0,
    lastUpdated: new Date().toISOString(),
    version: '1.0.0'
  },
  logs: [],
  chatMessages: [],
  config: [],
  agentTools: [],
  metrics: {
    requestsPerMinute: 0,
    activeConnections: 0,
    errorRate: 0,
    averageResponseTime: 0
  },
  isConnected: false,
  currentPlan: null,
  mcpServers: [],

  setServerState: (state) => set((s) => ({ 
    serverState: { ...s.serverState, ...state } 
  })),
  
  addLog: (log) => set((s) => ({ 
    logs: [log, ...s.logs].slice(0, 200) 
  })),
  
  setLogs: (logs) => set({ logs }),

  addChatMessage: (msg) => set((s) => ({ 
    chatMessages: [...s.chatMessages, msg] 
  })),

  setChatMessages: (chatMessages) => set({ chatMessages }),

  appendChunkToLastMessage: (chunk) => set((s) => {
    const newMessages = [...s.chatMessages];
    if (newMessages.length > 0) {
      const lastIndex = newMessages.length - 1;
      const last = newMessages[lastIndex];
      if (last.role === 'assistant') {
        newMessages[lastIndex] = { ...last, content: last.content + chunk };
      }
    }
    return { chatMessages: newMessages };
  }),

  setLastMessageStreaming: (isStreaming) => set((s) => {
    const newMessages = [...s.chatMessages];
    if (newMessages.length > 0) {
      const lastIndex = newMessages.length - 1;
      newMessages[lastIndex] = { ...newMessages[lastIndex], isStreaming };
    }
    return { chatMessages: newMessages };
  }),

  updateLastChatMessage: (content) => set((s) => {
    const newMessages = [...s.chatMessages];
    if (newMessages.length > 0) {
      const lastIndex = newMessages.length - 1;
      const last = newMessages[lastIndex];
      if (last.role === 'assistant') {
        newMessages[lastIndex] = { ...last, content };
      }
    }
    return { chatMessages: newMessages };
  }),
  
  setConfig: (config) => set({ config }),
  
  setAgentTools: (agentTools) => set({ agentTools }),
  
  setMetrics: (metrics) => set({ metrics }),
  
  setConnected: (isConnected) => set({ isConnected }),

  setCurrentPlan: (currentPlan) => set({ currentPlan }),

  updatePlanStep: (stepUpdate) => set((s) => {
    if (!s.currentPlan) return s;
    const newSteps = s.currentPlan.steps.map(step => 
      step.id === stepUpdate.id ? { ...step, ...stepUpdate } : step
    );
    return { 
      currentPlan: { ...s.currentPlan, steps: newSteps } 
    };
  }),

  setMcpServers: (mcpServers) => set({ mcpServers })
}))
