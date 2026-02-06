import { ScrollArea } from '@/components/ui/scroll-area'
import { Terminal } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { LogEntry, LogType } from '@/context/SocketContext'

interface TerminalLogProps {
  /** Real-time logs from SocketContext. If empty, shows placeholder. */
  logs?: LogEntry[]
  className?: string
}

const placeholderLines: { id: string; text: string; type: 'output' | 'info' }[] = [
  { id: 'p1', text: '> brunella --status', type: 'output' },
  { id: 'p2', text: 'MCP Brunella Core v1.0.0', type: 'output' },
  { id: 'p3', text: 'Várakozás kapcsolatra...', type: 'info' },
]

function logTypeToTerminalType(type: LogType): 'output' | 'command' | 'error' | 'info' {
  switch (type) {
    case 'error':
      return 'error'
    case 'success':
      return 'command'
    default:
      return 'info'
  }
}

export function TerminalLog({ logs = [], className }: TerminalLogProps) {
  const displayLines =
    logs.length > 0
      ? logs.map((log) => ({
          id: log.id,
          text: log.source ? `[${log.source}] ${log.message}` : log.message,
          type: logTypeToTerminalType(log.type),
        }))
      : placeholderLines

  const getLineClass = (type: string) => {
    switch (type) {
      case 'command':
        return 'text-emerald-400'
      case 'error':
        return 'text-red-400'
      case 'info':
        return 'text-cyan-400'
      default:
        return 'text-zinc-300'
    }
  }

  return (
    <div
      className={cn(
        'flex flex-col rounded-lg border border-zinc-800 bg-black/90 overflow-hidden',
        className,
      )}
    >
      <div className="flex items-center gap-2 border-b border-zinc-800 bg-zinc-900/80 px-3 py-2">
        <Terminal size={14} className="text-emerald-500" />
        <span className="text-xs font-mono text-zinc-500">terminal — mission-control</span>
      </div>
      <ScrollArea className="h-[280px] flex-1 font-mono text-sm">
        <div className="space-y-0.5 p-3">
          {displayLines.map((line) => (
            <div
              key={line.id}
              className={cn(
                'whitespace-pre-wrap break-all',
                line.text ? getLineClass(line.type) : 'text-zinc-600',
              )}
            >
              {line.text || ' '}
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  )
}
