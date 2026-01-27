import { useEffect, useRef } from 'react'
import { io, Socket } from 'socket.io-client'
import { useMcpStore } from '@/lib/mcpStore'
import { LogEntry, ServerMetrics, AgentTool, AgentToolParameter, ExecutionPlan } from '@/lib/types'

const BACKEND_URL = 'http://localhost:3000'

export function useMCP() {
  const socketRef = useRef<Socket | null>(null)
  const { 
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
    const socket = io(BACKEND_URL)
    socketRef.current = socket

    socket.on('connect', () => {
      setConnected(true)
      setServerState({ status: 'running' })
      addLog({
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
      addLog(log)
    })

    // Listen for MCP servers status
    socket.on('mcp_servers_status', (servers: any[]) => {
      setMcpServers(servers)
    })

    // Listen for chat messages from backend
    socket.on('bot_message', (data: { text: string, isUser: boolean, isLog: boolean }) => {
      useMcpStore.getState().addChatMessage({
        id: `msg-${Date.now()}`,
        role: data.isUser ? 'user' : 'assistant',
        content: data.text,
        timestamp: new Date().toISOString(),
        isStreaming: false
      })
    })

    // Listen for metrics
    socket.on('metrics_update', (metrics: ServerMetrics) => {
      setMetrics(metrics)
    })

    // Listen for Plan events
    socket.on('plan_created', (plan: ExecutionPlan) => {
        setCurrentPlan(plan)
    })

    socket.on('plan_step_update', (step: any) => {
        updatePlanStep(step)
    })

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
      setAgentTools(frontendTools)
    })

    // Listen for tool results (optional, can be handled in UI via chat or specific store)
    socket.on('tool_result', (data) => {
        addLog({
            id: `res-${Date.now()}`,
            timestamp: new Date().toISOString(),
            level: 'info',
            message: `Tool [${data.name}] result: ${JSON.stringify(data.result).substring(0, 100)}...`,
            source: 'system'
        });
    });

    socket.on('tool_error', (data) => {
        addLog({
            id: `err-${Date.now()}`,
            timestamp: new Date().toISOString(),
            level: 'error',
            message: `Tool [${data.name}] failed: ${data.error}`,
            source: 'system'
        });
    });

    return () => {
      socket.disconnect()
    }
  }, [])

  const sendMessage = (text: string) => {
    if (socketRef.current) {
      socketRef.current.emit('user_message', { text })
    }
  }

  const runTool = (name: string, args: any) => {
      if (socketRef.current) {
          const id = `req-${Date.now()}`;
          socketRef.current.emit('run_tool', { name, args, id });
          return id;
      }
      return null;
  }

  const startMcpServer = (name: string) => {
    if (socketRef.current) {
      socketRef.current.emit('mcp_server:start', name);
    }
  }

  const stopMcpServer = (name: string) => {
    if (socketRef.current) {
      socketRef.current.emit('mcp_server:stop', name);
    }
  }

  return {
    sendMessage,
    runTool,
    startMcpServer,
    stopMcpServer,
    isConnected: socketRef.current?.connected ?? false
  }
}