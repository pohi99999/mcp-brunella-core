import { Activity, Terminal, Database, Brain, LayoutDashboard, FileText, Settings } from 'lucide-react'
import { cn } from '@/lib/utils'
import { AgentStatusCard, AgentStatus } from './AgentStatusCard'
import { TerminalLog } from './TerminalLog'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useSocket } from '@/context/SocketContext'

const SIDEBAR_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'files', label: 'Files', icon: FileText },
  { id: 'settings', label: 'Settings', icon: Settings },
] as const

const DEFAULT_AGENTS = [
  {
    id: '1',
    name: 'Researcher Agent',
    status: 'idle' as AgentStatus,
    taskDescription: 'AI innovációk gyűjtése (ArXiv, GitHub, HuggingFace)',
  },
  {
    id: '2',
    name: 'Data Scientist Agent',
    status: 'idle' as AgentStatus,
    taskDescription: 'JSON normalizálás vár',
  },
  {
    id: '3',
    name: 'Orchestrator Agent',
    status: 'idle' as AgentStatus,
    taskDescription: 'Folyamat koordináció',
  },
]

const DEFAULT_MEMORY_CONTEXT = [
  { id: '1', name: 'ai_innovations.json', size: '12 KB' },
  { id: '2', name: 'config.toml', size: '2 KB' },
  { id: '3', name: 'workflow.md', size: '4 KB' },
]

interface MemoryFile {
  id: string
  name: string
  size: string
}

export function MissionControlLayout() {
  const { logs, agents, isConnected } = useSocket()

  const agentsFromSocket = Array.from(agents.values())
  const agentsToShow =
    agentsFromSocket.length > 0
      ? agentsFromSocket.map((a, idx) => ({
          id: `socket-${a.name}-${idx}`,
          name: a.name,
          status: a.status as AgentStatus,
          taskDescription: a.taskDescription,
        }))
      : DEFAULT_AGENTS

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 antialiased">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-zinc-800/80 bg-zinc-950/80 backdrop-blur-xl">
        <div className="flex h-14 items-center justify-between px-4 lg:px-6">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Brain size={24} className="text-emerald-500" />
              <span className="font-mono text-lg font-semibold tracking-tight">Brunella</span>
              <span className="hidden rounded bg-zinc-800/80 px-2 py-0.5 font-mono text-xs text-zinc-500 sm:inline">
                Mission Control
              </span>
              {isConnected && (
                <span className="rounded bg-emerald-500/20 px-2 py-0.5 font-mono text-xs text-emerald-400">
                  Live
                </span>
              )}
            </div>
          </div>

          {/* System status dummy */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 rounded-lg border border-zinc-800/60 bg-zinc-900/50 px-3 py-1.5">
              <Activity size={14} className="text-emerald-500" />
              <span className="font-mono text-xs text-zinc-400">CPU</span>
              <span className="font-mono text-sm font-medium text-zinc-200">23%</span>
            </div>
            <div className="flex items-center gap-2 rounded-lg border border-zinc-800/60 bg-zinc-900/50 px-3 py-1.5">
              <Database size={14} className="text-cyan-500" />
              <span className="font-mono text-xs text-zinc-400">RAM</span>
              <span className="font-mono text-sm font-medium text-zinc-200">4.2 GB</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main grid */}
      <div className="flex h-[calc(100vh-3.5rem)]">
        {/* Sidebar */}
        <aside className="hidden w-52 shrink-0 border-r border-zinc-800/80 bg-zinc-950/60 lg:block">
          <nav className="flex flex-col gap-1 p-3">
            {SIDEBAR_ITEMS.map((item) => {
              const Icon = item.icon
              return (
                <button
                  key={item.id}
                  className={cn(
                    'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                    item.id === 'dashboard'
                      ? 'bg-zinc-800/80 text-zinc-100'
                      : 'text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200',
                  )}
                >
                  <Icon size={18} />
                  {item.label}
                </button>
              )
            })}
          </nav>
        </aside>

        {/* Center: Bento grid - agents + terminal */}
        <main className="flex-1 overflow-auto p-4 lg:p-6">
          <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[1fr_280px]">
            {/* Agents column */}
            <div className="space-y-4">
              <h2 className="flex items-center gap-2 text-sm font-medium text-zinc-400">
                <Activity size={16} />
                Aktív ügynökök
              </h2>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {agentsToShow.map((agent) => (
                  <AgentStatusCard
                    key={agent.id}
                    name={agent.name}
                    status={agent.status}
                    taskDescription={agent.taskDescription}
                  />
                ))}
              </div>

              {/* Terminal */}
              <div className="mt-6">
                <h2 className="mb-2 flex items-center gap-2 text-sm font-medium text-zinc-400">
                  <Terminal size={16} />
                  Live output
                </h2>
                <TerminalLog logs={logs} />
              </div>
            </div>

            {/* Right: Memory Context */}
            <div className="order-first lg:order-last">
              <Card className="border-zinc-800/80 bg-zinc-950/60 backdrop-blur-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-base font-medium">
                    <Brain size={18} className="text-cyan-500" />
                    Memory Context
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[320px]">
                    <ul className="space-y-2">
                      {DEFAULT_MEMORY_CONTEXT.map((file: MemoryFile) => (
                        <li
                          key={file.id}
                          className="flex items-center justify-between rounded-md px-2 py-2 font-mono text-sm hover:bg-zinc-800/50"
                        >
                          <span className="truncate text-zinc-300">{file.name}</span>
                          <span className="shrink-0 text-xs text-zinc-500">{file.size}</span>
                        </li>
                      ))}
                    </ul>
                  </ScrollArea>
                </CardContent>
              </Card>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
