import { useEffect, useRef } from 'react'
import { io, Socket } from 'socket.io-client'
import { useMcpStore } from '@/lib/mcpStore'
import { LogEntry, ServerMetrics } from '@/lib/types'

const BACKEND_URL = 'http://localhost:3000'

export function useMCP() {
  const socketRef = useRef<Socket | null>(null)
  const { 
    setConnected, 
    addLog, 
    setServerState, 
    setMetrics,
    setAgentTools
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

    // Listen for tool updates
    socket.on('tools_update', (tools: any[]) => {
      setAgentTools(tools)
    })

    return () => {
      socket.disconnect()
    }
  }, [])

  const sendMessage = (text: string) => {
    if (socketRef.current) {
      socketRef.current.emit('user_message', { text })
    }
  }

  return {
    sendMessage,
    isConnected: socketRef.current?.connected ?? false
  }
}
