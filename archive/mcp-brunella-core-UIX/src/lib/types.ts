export type ServerStatus = 'running' | 'stopped' | 'starting' | 'stopping' | 'error'

export interface ServerState {
  status: ServerStatus
  uptime: number
  cpuUsage: number
  memoryUsage: number
  lastUpdated: string
}

export interface LogEntry {
  id: string
  timestamp: string
  level: 'info' | 'warning' | 'error' | 'debug'
  message: string
  source?: string
}

export interface ConfigItem {
  key: string
  value: string | number | boolean
  type: 'string' | 'number' | 'boolean'
  description: string
  category: string
}

export interface ServerMetrics {
  requestsPerMinute: number
  activeConnections: number
  errorRate: number
  averageResponseTime: number
}

export type UserRole = 'admin' | 'operator' | 'viewer'

export interface User {
  id: string
  username: string
  role: UserRole
  displayName: string
  email?: string
  avatarUrl?: string
  createdAt: string
  lastLogin?: string
}

export interface AuthState {
  isAuthenticated: boolean
  user: User | null
}

export interface Permission {
  startServer: boolean
  stopServer: boolean
  restartServer: boolean
  viewLogs: boolean
  clearLogs: boolean
  viewConfig: boolean
  editConfig: boolean
  viewMetrics: boolean
  useChat: boolean
  configureAgents: boolean
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: string
  toolCalls?: ToolCall[]
  isStreaming?: boolean
}

export interface ToolCall {
  id: string
  toolName: string
  parameters: Record<string, any>
  result?: string
  error?: string
  timestamp: string
}

export interface AgentTool {
  id: string
  name: string
  description: string
  enabled: boolean
  parameters: AgentToolParameter[]
  category: 'server' | 'monitoring' | 'configuration' | 'custom'
  requiresPermission?: keyof Permission
  createdAt: string
  updatedAt?: string
  externalApi?: ExternalApiConfig
}

export interface ExternalApiConfig {
  url: string
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'
  headers?: Record<string, string>
  authType?: 'none' | 'bearer' | 'apikey' | 'basic'
  authValue?: string
  bodyTemplate?: string
  responseMapping?: string
  timeout?: number
}

export interface AgentToolParameter {
  name: string
  type: 'string' | 'number' | 'boolean' | 'object' | 'array'
  description: string
  required: boolean
  defaultValue?: any
}

export interface OllamaStatus {
  isConnected: boolean
  model: string | null
  version?: string
  lastChecked: string
}
