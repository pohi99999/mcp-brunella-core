import { useEffect } from 'react'
import { io, Socket } from 'socket.io-client'
import { useMcpStore } from '@/lib/mcpStore'
import { LogEntry, ServerMetrics, AgentTool, AgentToolParameter, ExecutionPlan } from '@/lib/types'
import { getSocketOrigin } from '@/lib/backendOrigin'

const SOCKET_ORIGIN = getSocketOrigin()
let socket: Socket | null = null;

type LegacyLogEntry = Partial<LogEntry> & {
  type?: 'info' | 'warning' | 'error' | 'success' | 'debug'
  level?: LogEntry['level']
  timestamp?: string | number
}

type LegacyToolDefinition = {
  id?: string
  name: string
  description?: string
  category?: AgentTool['category']
  inputSchema?: {
    properties?: Record<string, { type?: AgentToolParameter['type']; description?: string }>
    required?: string[]
  }
  parameters?: Array<{
    name: string
    type?: AgentToolParameter['type'] | string
    description?: string
    required?: boolean
  }>
}

type RobotkezPlanPayload = {
  taskId?: string
  plan?: {
    plan?: Array<{ index?: number; description?: string; status?: string }>
    estimatedDuration?: number
  }
}

type RobotkezStepPayload = {
  index?: number
  status?: string
  description?: string
  error?: string
  screenshot?: string
}

function toIsoTimestamp(value?: string | number): string {
  if (typeof value === 'string') {
    return value
  }
  if (typeof value === 'number') {
    return new Date(value).toISOString()
  }
  return new Date().toISOString()
}

function toLogLevel(value?: LegacyLogEntry['type'] | LegacyLogEntry['level']): LogEntry['level'] {
  if (value === 'error') return 'error'
  if (value === 'warning') return 'warning'
  if (value === 'debug') return 'debug'
  return 'info'
}

function normalizeLogEntry(log: LegacyLogEntry): LogEntry {
  const timestamp = toIsoTimestamp(log.timestamp)
  return {
    id: log.id ?? `log-${timestamp}-${Math.random().toString(36).slice(2, 8)}`,
    timestamp,
    level: toLogLevel(log.level ?? log.type),
    message: log.message ?? '',
    source: log.source,
  }
}

function normalizeAgentTools(tools: LegacyToolDefinition[]): AgentTool[] {
  return tools.map((tool) => {
    const schema = tool.inputSchema ?? {}
    const schemaProperties = schema.properties ?? {}
    const schemaRequired = new Set(schema.required ?? [])
    const parameters: AgentToolParameter[] = Array.isArray(tool.parameters) && tool.parameters.length > 0
      ? tool.parameters.map((parameter) => ({
          name: parameter.name,
          type: (parameter.type as AgentToolParameter['type']) || 'string',
          description: parameter.description || '',
          required: Boolean(parameter.required),
        }))
      : Object.keys(schemaProperties).map((key) => {
          const property = schemaProperties[key]
          return {
            name: key,
            type: property?.type || 'string',
            description: property?.description || '',
            required: schemaRequired.has(key),
          }
        })

    return {
      id: tool.id ?? tool.name,
      name: tool.name,
      description: tool.description ?? '',
      enabled: true,
      parameters,
      category: tool.category ?? 'server',
      createdAt: new Date().toISOString(),
    }
  })
}

function normalizePlan(plan: ExecutionPlan | RobotkezPlanPayload): ExecutionPlan {
  if ('steps' in plan && Array.isArray(plan.steps)) {
    return plan
  }

  const robotkezPlan = plan as RobotkezPlanPayload
  const steps = (robotkezPlan.plan?.plan ?? []).map((step, index) => ({
    id: `robotkez-step-${step.index ?? index}`,
    agent: 'robotkez',
    description: step.description ?? `Lépés ${index + 1}`,
    status: step.status === 'working' ? 'running' : step.status === 'error' ? 'failed' : step.status === 'completed' ? 'completed' : 'pending',
  }))

  return {
    id: robotkezPlan.taskId ?? `robotkez-plan-${Date.now()}`,
    task: 'Robotkéz végrehajtási terv',
    steps,
  }
}

function normalizePlanStep(step: RobotkezStepPayload & { id?: string }) {
  const stepIndex = step.index ?? 0
  return {
    id: step.id ?? `robotkez-step-${stepIndex}`,
    agent: 'robotkez',
    description: step.description ?? `Lépés ${stepIndex + 1}`,
    status: step.status === 'working' ? 'running' : step.status === 'error' ? 'failed' : step.status === 'completed' ? 'completed' : 'pending',
    result: step.error ?? step.screenshot,
  }
}

export function useMCP() {
  const {
    isConnected,
    setConnected,
    addLog,
    setServerState,
    setMetrics,
    setAgentTools,
    setCurrentPlan,
    updatePlanStep,
    setMcpServers
  } = useMcpStore()

  useEffect(() => {
    if (!socket) {
      socket = io(SOCKET_ORIGIN, { path: '/socket.io' })
    }

    const listeners: Array<{ event: string; handler: (...args: any[]) => void }> = []
    const listen = (events: string[], handler: (...args: any[]) => void) => {
      events.forEach((event) => {
        socket?.on(event, handler)
        listeners.push({ event, handler })
      })
    }

    listen(['connect'], () => {
      setConnected(true)
      setServerState({ status: 'running' })
      useMcpStore.getState().addLog({
        id: `log-${Date.now()}`,
        timestamp: new Date().toISOString(),
        level: 'info',
        message: 'Csatlakozva a Core szerverhez',
        source: 'dashboard'
      })
    })

    listen(['disconnect'], () => {
      setConnected(false)
      setServerState({ status: 'stopped' })
    })

    listen(['system:log', 'system_log'], (log: LegacyLogEntry) => {
      useMcpStore.getState().addLog(normalizeLogEntry(log))
    })

    listen(['mcp_servers_status'], (servers: any[]) => {
      useMcpStore.getState().setMcpServers(Array.isArray(servers) ? servers : [])
    })

    listen(['bot_message_start'], (data: { isUser?: boolean }) => {
      useMcpStore.getState().addChatMessage({
        id: `msg-${Date.now()}`,
        role: data.isUser ? 'user' : 'assistant',
        content: '',
        timestamp: new Date().toISOString(),
        isStreaming: true
      });
    })

    listen(['bot_message_chunk'], (data: { text?: string }) => {
      useMcpStore.getState().appendChunkToLastMessage(data.text ?? '');
    })

    listen(['bot_message_end'], () => {
      useMcpStore.getState().setLastMessageStreaming(false);
    })

    listen(['metrics_update'], (metrics: ServerMetrics) => {
      useMcpStore.getState().setMetrics(metrics)
    })

    listen(['plan_created', 'robotkez:plan'], (rawPlan: ExecutionPlan | RobotkezPlanPayload) => {
      const plan = normalizePlan(rawPlan)
      useMcpStore.getState().setCurrentPlan(plan)
      useMcpStore.getState().addChatMessage({
        id: `plan-${Date.now()}`,
        role: 'system',
        content: `🧭 Terv készült: ${plan.task} (${plan.steps.length} lépés)`,
        timestamp: new Date().toISOString(),
        isStreaming: false
      })
    })

    listen(['plan_step_update', 'robotkez:step'], (rawStep: any) => {
      const step = normalizePlanStep(rawStep)
      useMcpStore.getState().updatePlanStep(step)
      const statusLabel = step.status === 'running'
        ? '▶'
        : step.status === 'completed'
          ? '✔'
          : step.status === 'failed'
            ? '✖'
            : '•'
      const resultSnippet = step.result
        ? `\n${String(step.result).substring(0, 160)}`
        : ''
      useMcpStore.getState().addChatMessage({
        id: `step-${step.id}-${Date.now()}`,
        role: 'system',
        content: `${statusLabel} [${step.agent}] ${step.description}${resultSnippet}`,
        timestamp: new Date().toISOString(),
        isStreaming: false
      })
    })

    listen(['agent:update', 'agent_update', 'agents:snapshot'], (_agents: any) => {
      // Reserved for dashboard consumers that subscribe to agent status via SocketContext.
      // Keep the listeners here for backward compatibility so event-name drift does not
      // silently break hook consumers, but do not duplicate that store logic.
    })

    listen(['tools_update'], (payload: LegacyToolDefinition[] | { tools?: LegacyToolDefinition[] }) => {
      const tools = Array.isArray(payload) ? payload : payload.tools ?? []
      useMcpStore.getState().setAgentTools(normalizeAgentTools(tools))
    })

    listen(['tool_result'], (data: { name?: string; result?: unknown }) => {
      const fullResult = JSON.stringify(data.result, null, 2)
      useMcpStore.getState().addChatMessage({
        id: `tool-${data.name}-${Date.now()}`,
        role: 'system',
        content: `🛠️ Tool eredmény: ${data.name}\n${fullResult}`,
        timestamp: new Date().toISOString(),
        isStreaming: false
      })
    })

    listen(['tool_error'], (data: { name?: string; error?: string }) => {
      useMcpStore.getState().addChatMessage({
        id: `tool-${data.name}-err-${Date.now()}`,
        role: 'system',
        content: `⚠️ Tool hiba: ${data.name}\n${data.error}`,
        timestamp: new Date().toISOString(),
        isStreaming: false
      })
    })

    return () => {
      listeners.forEach(({ event, handler }) => {
        socket?.off(event, handler)
      })
    }
  }, [])

  const sendMessage = (text: string, tools?: string[], model?: string, provider?: string) => {
    if (socket) {
      socket.emit('user_message', { text, tools, model, provider })
    }
  }

  const runTool = (name: string, args: any) => {
    if (socket) {
      const id = `req-${Date.now()}`;
      socket.emit('run_tool', { name, args, id });
      return id;
    }
    return null;
  }

  const startMcpServer = (name: string) => {
    if (socket) {
      socket.emit('mcp_server:start', name);
    }
  }

  const stopMcpServer = (name: string) => {
    if (socket) {
      socket.emit('mcp_server:stop', name);
    }
  }

  return {
    sendMessage,
    runTool,
    startMcpServer,
    stopMcpServer,
    isConnected
  }
}
