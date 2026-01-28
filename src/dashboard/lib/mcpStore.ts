import { create } from 'zustand'
import { ServerState, LogEntry, ConfigItem, ServerMetrics, AgentTool } from './types'

interface McpState {
  serverState: ServerState
  logs: LogEntry[]
  chatMessages: ChatMessage[]
  config: ConfigItem[]
  agentTools: AgentTool[]
  metrics: ServerMetrics
  isConnected: boolean
  
  setServerState: (state: Partial<ServerState>) => void
  addLog: (log: LogEntry) => void
  setLogs: (logs: LogEntry[]) => void
  addChatMessage: (message: ChatMessage) => void
  setChatMessages: (messages: ChatMessage[]) => void
  updateLastChatMessage: (content: string) => void
  setConfig: (config: ConfigItem[]) => void
  setAgentTools: (tools: AgentTool[]) => void
  setMetrics: (metrics: ServerMetrics) => void
  setConnected: (connected: boolean) => void
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

  updateLastChatMessage: (content) => set((s) => {
    const newMessages = [...s.chatMessages];
    if (newMessages.length > 0) {
      const last = newMessages[newMessages.length - 1];
      if (last.role === 'assistant') {
        newMessages[newMessages.length - 1] = { ...last, content };
      }
    }
    return { chatMessages: newMessages };
  }),
  
  setConfig: (config) => set({ config }),
  
  setAgentTools: (agentTools) => set({ agentTools }),
  
  setMetrics: (metrics) => set({ metrics }),
  
  setConnected: (isConnected) => set({ isConnected })
}))
