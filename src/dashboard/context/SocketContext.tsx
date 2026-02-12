import { createContext, useContext, useEffect, useReducer, useState, type ReactNode } from 'react'
import { io, type Socket } from 'socket.io-client'

export type LogType = 'info' | 'error' | 'success'

export interface LogEntry {
  id: string
  message: string
  type: LogType
  timestamp: number
  source?: string
}

export type AgentStatusPayload = 'idle' | 'working' | 'error'

export interface AgentStatusEntry {
  name: string
  status: AgentStatusPayload
  taskDescription?: string
  lastUpdated: number
}

interface SocketState {
  isConnected: boolean
  logs: LogEntry[]
  agents: Map<string, AgentStatusEntry>
}

type SocketAction =
  | { type: 'connect' }
  | { type: 'disconnect' }
  | { type: 'log'; payload: Omit<LogEntry, 'id'> }
  | { type: 'agent_update'; payload: { agentName: string; status: AgentStatusPayload; taskDescription?: string } }

const MAX_LOGS = 200
let logIdCounter = 0

function socketReducer(state: SocketState, action: SocketAction): SocketState {
  switch (action.type) {
    case 'connect':
      return { ...state, isConnected: true }
    case 'disconnect':
      return { ...state, isConnected: false }
    case 'log': {
      const newLog: LogEntry = { ...action.payload, id: `log-${++logIdCounter}` }
      const logs = [newLog, ...state.logs].slice(0, MAX_LOGS)
      return { ...state, logs }
    }
    case 'agent_update': {
      const { agentName, status, taskDescription } = action.payload
      const agents = new Map(state.agents)
      agents.set(agentName, {
        name: agentName,
        status,
        taskDescription,
        lastUpdated: Date.now(),
      })
      return { ...state, agents }
    }
    default:
      return state
  }
}

const initialState: SocketState = {
  isConnected: false,
  logs: [],
  agents: new Map(),
}

interface SocketContextValue extends SocketState {
  socket: Socket | null
}

const SocketContext = createContext<SocketContextValue | null>(null)

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || (import.meta.env.DEV ? 'http://localhost:3000' : window.location.origin)

export function SocketProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(socketReducer, initialState)
  const [socketInstance, setSocketInstance] = useState<Socket | null>(null)

  useEffect(() => {
    const socket = io(SOCKET_URL, {
      path: '/socket.io',
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    })

    setSocketInstance(socket)

    socket.on('connect', () => {
      console.log('[Socket] Connected to server')
      dispatch({ type: 'connect' })
    })

    socket.on('disconnect', (reason) => {
      console.log('[Socket] Disconnected:', reason)
      dispatch({ type: 'disconnect' })
    })

    socket.on('connect_error', (error) => {
      console.error('[Socket] Connection error:', error.message)
      dispatch({
        type: 'log',
        payload: {
          message: `Socket kapcsolódási hiba: ${error.message}`,
          type: 'error',
          timestamp: Date.now(),
          source: 'SocketContext',
        },
      })
    })

    socket.on('error', (error) => {
      console.error('[Socket] Error:', error)
      dispatch({
        type: 'log',
        payload: {
          message: `Socket hiba: ${error}`,
          type: 'error',
          timestamp: Date.now(),
          source: 'SocketContext',
        },
      })
    })

    socket.on('system:log', (data: { message: string; type: LogType; timestamp?: number; source?: string }) => {
      dispatch({
        type: 'log',
        payload: {
          message: data.message,
          type: data.type ?? 'info',
          timestamp: data.timestamp ?? Date.now(),
          source: data.source,
        },
      })
    })

    socket.on('agent:update', (data: { agentName: string; status: AgentStatusPayload; taskDescription?: string }) => {
      if (data.agentName && data.status) {
        dispatch({
          type: 'agent_update',
          payload: {
            agentName: data.agentName,
            status: data.status,
            taskDescription: data.taskDescription,
          },
        })
      }
    })

    return () => {
      socket.off('connect')
      socket.off('disconnect')
      socket.off('connect_error')
      socket.off('error')
      socket.off('system:log')
      socket.off('agent:update')
      socket.disconnect()
      setSocketInstance(null)
    }
  }, [])

  const value: SocketContextValue = {
    ...state,
    socket: socketInstance,
  }

  return <SocketContext.Provider value={value}>{children}</SocketContext.Provider>
}

export function useSocket() {
  const ctx = useContext(SocketContext)
  if (!ctx) throw new Error('useSocket must be used within SocketProvider')
  return ctx
}
