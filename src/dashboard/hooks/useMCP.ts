import { useEffect } from 'react'
import { io, Socket } from 'socket.io-client'
import { useMcpStore } from '@/lib/mcpStore'
import { LogEntry, ServerMetrics, AgentTool, AgentToolParameter, ExecutionPlan } from '@/lib/types'

const BACKEND_URL = window.location.hostname === 'localhost' ? 'http://localhost:3000' : window.location.origin;
let socket: Socket | null = null;

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
      socket = io(BACKEND_URL)

      socket.on('connect', () => {
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

      socket.on('disconnect', () => {
        setConnected(false)
        setServerState({ status: 'stopped' })
      })

      // Listen for real logs from backend
      socket.on('system_log', (log: LogEntry) => {
        useMcpStore.getState().addLog(log)
      })

      // Listen for MCP servers status
      socket.on('mcp_servers_status', (servers: any[]) => {
        useMcpStore.getState().setMcpServers(servers)
      })

      // Streaming support
      socket.on('bot_message_start', (data: { isUser: boolean }) => {
        useMcpStore.getState().addChatMessage({
          id: `msg-${Date.now()}`,
          role: data.isUser ? 'user' : 'assistant',
          content: '',
          timestamp: new Date().toISOString(),
          isStreaming: true
        });
      });

      socket.on('bot_message_chunk', (data: { text: string }) => {
        useMcpStore.getState().appendChunkToLastMessage(data.text);
      });

      socket.on('bot_message_end', () => {
        useMcpStore.getState().setLastMessageStreaming(false);
      });

      // Listen for metrics
      socket.on('metrics_update', (metrics: ServerMetrics) => {
        useMcpStore.getState().setMetrics(metrics)
      })

      // Listen for Plan events
      socket.on('plan_created', (plan: ExecutionPlan) => {
        useMcpStore.getState().setCurrentPlan(plan)
        useMcpStore.getState().addChatMessage({
          id: `plan-${Date.now()}`,
          role: 'system',
          content: `🧭 Terv készült: ${plan.task} (${plan.steps.length} lépés)`,
          timestamp: new Date().toISOString(),
          isStreaming: false
        })
      })

      socket.on('plan_step_update', (step: any) => {
        useMcpStore.getState().updatePlanStep(step)
        const statusLabel = step.status === 'running'
          ? '▶'
          : step.status === 'completed'
            ? '✔'
            : step.status === 'failed'
              ? '✖'
              : '•'
        const resultSnippet = step.result
          ? `\n${step.result.toString().substring(0, 160)}`
          : ''
        useMcpStore.getState().addChatMessage({
          id: `step-${step.id}-${Date.now()}`,
          role: 'system',
          content: `${statusLabel} [${step.agent}] ${step.description}${resultSnippet}`,
          timestamp: new Date().toISOString(),
          isStreaming: false
        })
      })

      socket.on('agent_update', (agents: any[]) => {
        console.log('Agents updated:', agents);
      });

      // Listen for tool updates and adapt Schema
      socket.on('tools_update', (tools: any[]) => {
        const frontendTools: AgentTool[] = tools.map((t) => {
          const schema = t.inputSchema || {};
          const params: AgentToolParameter[] = [];

          if (schema.properties) {
            Object.keys(schema.properties).forEach(key => {
              const prop = schema.properties[key];
              params.push({
                name: key,
                type: prop.type || 'string',
                description: prop.description || '',
                required: (schema.required || []).includes(key)
              });
            });
          }

          return {
            id: t.name,
            name: t.name,
            description: t.description,
            enabled: true,
            parameters: params,
            category: 'server',
            createdAt: new Date().toISOString()
          };
        });
        useMcpStore.getState().setAgentTools(frontendTools)
      })

      socket.on('tool_result', (data) => {
        const fullResult = JSON.stringify(data.result, null, 2)
        useMcpStore.getState().addChatMessage({
          id: `tool-${data.name}-${Date.now()}`,
          role: 'system',
          content: `🛠️ Tool eredmény: ${data.name}\n${fullResult}`,
          timestamp: new Date().toISOString(),
          isStreaming: false
        })
      });

      socket.on('tool_error', (data) => {
        useMcpStore.getState().addChatMessage({
          id: `tool-${data.name}-err-${Date.now()}`,
          role: 'system',
          content: `⚠️ Tool hiba: ${data.name}\n${data.error}`,
          timestamp: new Date().toISOString(),
          isStreaming: false
        })
      });
    }

    return () => {
      // In a singleton pattern, we might not want to disconnect on every unmount
      // or we handle it differently. For now, keep it alive.
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
