import { useState, useEffect } from 'react'
import { useKV } from '@github/spark/hooks'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Toaster, toast } from 'sonner'
import { StatusCard } from '@/components/dashboard/StatusCard'
import { ControlPanel } from '@/components/dashboard/ControlPanel'
import { MetricsCard } from '@/components/dashboard/MetricsCard'
import { LogViewer } from '@/components/dashboard/LogViewer'
import { ConfigEditor } from '@/components/dashboard/ConfigEditor'
import { ChatInterface } from '@/components/dashboard/ChatInterface'
import { AgentToolsManager } from '@/components/dashboard/AgentToolsManager'
import { LoginForm } from '@/components/auth/LoginForm'
import { UserProfile } from '@/components/auth/UserProfile'
import { ServerState, LogEntry, ConfigItem, ServerMetrics, User, AgentTool } from '@/lib/types'
import {
  generateMockServerState,
  generateMockLogs,
  generateMockConfig,
  generateMockMetrics,
  generateMockAgentTools
} from '@/lib/mockData'
import { canPerformAction } from '@/lib/auth'
import { externalApiService } from '@/lib/externalApiService'
import { ChartLine, Terminal, Gear, ChatCircle, Toolbox } from '@phosphor-icons/react'

function App() {
  const [user, setUser] = useKV<User | null>('auth-user', null)
  const [serverState, setServerState] = useKV<ServerState>('server-state', generateMockServerState())
  const [logs, setLogs] = useKV<LogEntry[]>('server-logs', generateMockLogs())
  const [config, setConfig] = useKV<ConfigItem[]>('server-config', generateMockConfig())
  const [agentTools, setAgentTools] = useKV<AgentTool[]>('agent-tools', generateMockAgentTools())
  const [metrics, setMetrics] = useState<ServerMetrics>(generateMockMetrics())

  const currentUser = user ?? null
  const currentServerState = serverState ?? generateMockServerState()
  const currentLogs = logs ?? []
  const currentConfig = config ?? []
  const currentAgentTools = agentTools ?? []

  const handleLogin = (authenticatedUser: User) => {
    setUser(authenticatedUser)
    toast.success('Sikeres bejelentkezés', { 
      description: `Üdvözöljük, ${authenticatedUser.displayName}!` 
    })

    const loginLog: LogEntry = {
      id: `log-${Date.now()}`,
      timestamp: new Date().toISOString(),
      level: 'info',
      message: `Felhasználó bejelentkezett: ${authenticatedUser.username}`,
      source: 'auth'
    }
    setLogs(currentLogs => [loginLog, ...(currentLogs ?? [])])
  }

  const handleLogout = () => {
    if (currentUser) {
      const logoutLog: LogEntry = {
        id: `log-${Date.now()}`,
        timestamp: new Date().toISOString(),
        level: 'info',
        message: `Felhasználó kijelentkezett: ${currentUser.username}`,
        source: 'auth'
      }
      setLogs(currentLogs => [logoutLog, ...(currentLogs ?? [])])
    }

    setUser(null)
    toast.info('Kijelentkeztél', { description: 'Viszlát!' })
  }

  useEffect(() => {
    if (!currentUser) return

    const interval = setInterval(() => {
      setServerState(current => {
        const state = current ?? generateMockServerState()
        return {
          ...state,
          uptime: state.status === 'running' ? state.uptime + 5 : state.uptime,
          cpuUsage: state.status === 'running' ? Math.random() * 100 : 0,
          memoryUsage: state.status === 'running' ? Math.random() * 100 : 0,
          lastUpdated: new Date().toISOString()
        }
      })

      if (currentServerState.status === 'running') {
        setMetrics(generateMockMetrics())

        if (Math.random() > 0.7) {
          const newLog: LogEntry = {
            id: `log-${Date.now()}`,
            timestamp: new Date().toISOString(),
            level: ['info', 'warning', 'error', 'debug'][Math.floor(Math.random() * 4)] as LogEntry['level'],
            message: [
              'Kérés feldolgozva sikeresen',
              'Új kapcsolat létrehozva',
              'Memória használat ellenőrizve',
              'CPU terhelés normál tartományban'
            ][Math.floor(Math.random() * 4)],
            source: Math.random() > 0.5 ? 'core' : 'api'
          }
          setLogs(currentLogs => [...(currentLogs ?? []), newLog].slice(-100))
        }
      }
    }, 5000)

    return () => clearInterval(interval)
  }, [currentUser, currentServerState.status])

  const handleStart = () => {
    setServerState(current => {
      const state = current ?? generateMockServerState()
      return { ...state, status: 'starting' }
    })
    toast.info('Szerver indítása...', { description: 'A folyamat hamarosan elindul' })

    setTimeout(() => {
      setServerState(current => {
        const state = current ?? generateMockServerState()
        return { 
          ...state, 
          status: 'running',
          uptime: 0
        }
      })
      toast.success('Szerver elindítva', { description: 'A szerver sikeresen fut' })
      
      const startLog: LogEntry = {
        id: `log-${Date.now()}`,
        timestamp: new Date().toISOString(),
        level: 'info',
        message: 'Szerver sikeresen elindítva',
        source: 'core'
      }
      setLogs(currentLogs => [startLog, ...(currentLogs ?? [])])
    }, 2000)
  }

  const handleStop = () => {
    setServerState(current => {
      const state = current ?? generateMockServerState()
      return { ...state, status: 'stopping' }
    })
    toast.info('Szerver leállítása...', { description: 'Várakozás az aktív kapcsolatok lezárására' })

    setTimeout(() => {
      setServerState(current => {
        const state = current ?? generateMockServerState()
        return { 
          ...state, 
          status: 'stopped',
          cpuUsage: 0,
          memoryUsage: 0
        }
      })
      toast.success('Szerver leállítva', { description: 'A szerver biztonságosan leállt' })
      
      const stopLog: LogEntry = {
        id: `log-${Date.now()}`,
        timestamp: new Date().toISOString(),
        level: 'info',
        message: 'Szerver leállítva',
        source: 'core'
      }
      setLogs(currentLogs => [stopLog, ...(currentLogs ?? [])])
    }, 1500)
  }

  const handleRestart = () => {
    setServerState(current => {
      const state = current ?? generateMockServerState()
      return { ...state, status: 'stopping' }
    })
    toast.info('Szerver újraindítása...', { description: 'Leállítás folyamatban' })

    setTimeout(() => {
      setServerState(current => {
        const state = current ?? generateMockServerState()
        return { ...state, status: 'starting' }
      })
      
      setTimeout(() => {
        setServerState(current => {
          const state = current ?? generateMockServerState()
          return { 
            ...state, 
            status: 'running',
            uptime: 0
          }
        })
        toast.success('Szerver újraindítva', { description: 'A szerver sikeresen újraindult' })
        
        const restartLog: LogEntry = {
          id: `log-${Date.now()}`,
          timestamp: new Date().toISOString(),
          level: 'info',
          message: 'Szerver újraindítva',
          source: 'core'
        }
        setLogs(currentLogs => [restartLog, ...(currentLogs ?? [])])
      }, 2000)
    }, 1000)
  }

  const handleClearLogs = () => {
    setLogs([])
    toast.success('Naplók törölve', { description: 'Minden naplóbejegyzés törölve lett' })
  }

  const handleSaveConfig = (updatedConfig: ConfigItem[]) => {
    setConfig(updatedConfig)
    toast.success('Konfiguráció mentve', { description: 'A beállítások sikeresen frissítve' })
    
    const configLog: LogEntry = {
      id: `log-${Date.now()}`,
      timestamp: new Date().toISOString(),
      level: 'info',
      message: 'Konfiguráció frissítve',
      source: 'core'
    }
    setLogs(currentLogs => [configLog, ...(currentLogs ?? [])])
  }

  const handleToolExecution = async (toolName: string, params: any): Promise<string> => {
    const tool = currentAgentTools.find(t => t.name === toolName)
    
    if (!tool) {
      return `Hiba: A tool "${toolName}" nem található`
    }

    if (!tool.enabled) {
      return `Hiba: A tool "${toolName}" le van tiltva`
    }

    if (tool.requiresPermission && !canPerformAction(currentUser, tool.requiresPermission)) {
      return `Hiba: Nincs jogosultságod a "${toolName}" tool használatához`
    }

    const toolLog: LogEntry = {
      id: `log-${Date.now()}`,
      timestamp: new Date().toISOString(),
      level: 'info',
      message: `AI Agent tool végrehajtva: ${toolName}`,
      source: 'ai-agent'
    }
    setLogs(currentLogs => [toolLog, ...(currentLogs ?? [])])

    if (tool.externalApi) {
      try {
        const result = await externalApiService.executeApiCall(tool.externalApi, params)
        
        if (result.success) {
          const successLog: LogEntry = {
            id: `log-${Date.now()}`,
            timestamp: new Date().toISOString(),
            level: 'info',
            message: `Külső API hívás sikeres: ${toolName} (${result.statusCode})`,
            source: 'external-api'
          }
          setLogs(currentLogs => [successLog, ...(currentLogs ?? [])])
          
          return typeof result.data === 'string' 
            ? result.data 
            : JSON.stringify(result.data, null, 2)
        } else {
          const errorLog: LogEntry = {
            id: `log-${Date.now()}`,
            timestamp: new Date().toISOString(),
            level: 'error',
            message: `Külső API hívás sikertelen: ${toolName} - ${result.error}`,
            source: 'external-api'
          }
          setLogs(currentLogs => [errorLog, ...(currentLogs ?? [])])
          
          return `Hiba az API hívás során: ${result.error}`
        }
      } catch (error) {
        const errorLog: LogEntry = {
          id: `log-${Date.now()}`,
          timestamp: new Date().toISOString(),
          level: 'error',
          message: `Külső API hiba: ${toolName} - ${error instanceof Error ? error.message : 'Ismeretlen hiba'}`,
          source: 'external-api'
        }
        setLogs(currentLogs => [errorLog, ...(currentLogs ?? [])])
        
        return `Hiba az API hívás során: ${error instanceof Error ? error.message : 'Ismeretlen hiba'}`
      }
    }

    switch (toolName) {
      case 'get_server_status':
        return `Szerver státusz:\n- Állapot: ${currentServerState.status}\n- CPU használat: ${currentServerState.cpuUsage.toFixed(1)}%\n- Memória használat: ${currentServerState.memoryUsage.toFixed(1)}%\n- Uptime: ${Math.floor(currentServerState.uptime / 60)} perc`
      
      case 'start_server':
        if (currentServerState.status === 'running') {
          return 'A szerver már fut'
        }
        handleStart()
        return 'Szerver indítása folyamatban...'
      
      case 'stop_server':
        if (currentServerState.status === 'stopped') {
          return 'A szerver már le van állítva'
        }
        handleStop()
        return 'Szerver leállítása folyamatban...'
      
      case 'get_logs':
        const level = params.level
        const limit = params.limit || 10
        let filteredLogs = currentLogs
        if (level) {
          filteredLogs = filteredLogs.filter(log => log.level === level)
        }
        const logMessages = filteredLogs.slice(0, limit).map(log => 
          `[${log.level.toUpperCase()}] ${new Date(log.timestamp).toLocaleTimeString('hu-HU')}: ${log.message}`
        ).join('\n')
        return `Legutóbbi ${limit} napló:\n${logMessages}`
      
      case 'update_config':
        const { key, value } = params
        const configItem = currentConfig.find(c => c.key === key)
        if (!configItem) {
          return `Hiba: A konfigurációs kulcs "${key}" nem található`
        }
        const updatedConfig = currentConfig.map(c => 
          c.key === key ? { ...c, value } : c
        )
        handleSaveConfig(updatedConfig)
        return `Konfiguráció frissítve: ${key} = ${value}`
      
      case 'get_metrics':
        return `Teljesítmény metrikák:\n- Kérések/perc: ${metrics.requestsPerMinute}\n- Aktív kapcsolatok: ${metrics.activeConnections}\n- Hibaarány: ${metrics.errorRate.toFixed(2)}%\n- Átlagos válaszidő: ${metrics.averageResponseTime}ms`
      
      default:
        return `A "${toolName}" tool végrehajtása még nincs implementálva. Ez egy custom tool, amely külső integrációt igényel.`
    }
  }

  if (!currentUser) {
    return (
      <>
        <Toaster position="top-right" theme="dark" />
        <LoginForm onLogin={handleLogin} />
      </>
    )
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Toaster position="top-right" theme="dark" />
      
      <div className="container mx-auto p-6 space-y-6">
        <header className="flex items-center justify-between">
          <div className="space-y-2">
            <h1 className="text-3xl font-bold tracking-tight">MCP Brunella Core</h1>
            <p className="text-muted-foreground">
              Professzionális szerver irányítópult
            </p>
          </div>
          <UserProfile user={currentUser} onLogout={handleLogout} />
        </header>

        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="grid w-full max-w-3xl grid-cols-5">
            <TabsTrigger value="overview" className="flex items-center gap-2">
              <ChartLine size={18} />
              Áttekintés
            </TabsTrigger>
            <TabsTrigger value="chat" className="flex items-center gap-2">
              <ChatCircle size={18} />
              Chat
            </TabsTrigger>
            <TabsTrigger value="logs" className="flex items-center gap-2">
              <Terminal size={18} />
              Naplók
            </TabsTrigger>
            <TabsTrigger value="config" className="flex items-center gap-2">
              <Gear size={18} />
              Beállítások
            </TabsTrigger>
            <TabsTrigger value="agents" className="flex items-center gap-2">
              <Toolbox size={18} />
              Agent Tools
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <StatusCard serverState={currentServerState} />
            <ControlPanel
              status={currentServerState.status}
              user={currentUser}
              onStart={handleStart}
              onStop={handleStop}
              onRestart={handleRestart}
            />
            <MetricsCard metrics={metrics} />
          </TabsContent>

          <TabsContent value="chat">
            <ChatInterface
              user={currentUser}
              agentTools={currentAgentTools}
              onToolExecution={handleToolExecution}
            />
          </TabsContent>

          <TabsContent value="logs">
            <LogViewer 
              logs={currentLogs} 
              user={currentUser}
              onClearLogs={handleClearLogs} 
            />
          </TabsContent>

          <TabsContent value="config">
            <ConfigEditor 
              config={currentConfig} 
              user={currentUser}
              onSave={handleSaveConfig} 
            />
          </TabsContent>

          <TabsContent value="agents">
            <AgentToolsManager
              tools={currentAgentTools}
              user={currentUser}
              onUpdateTools={setAgentTools}
            />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}

export default App
