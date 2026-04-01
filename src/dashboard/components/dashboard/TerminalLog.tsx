import { useRef, useEffect } from 'react'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Terminal } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { LogEntry, LogType } from '@/context/SocketContext'
import { useSystemSignal } from '@/hooks/useSystemSignal'

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

export function TerminalLog({ logs: propLogs, className }: TerminalLogProps) {
  const { logs: signalLogs } = useSystemSignal();
  const logs = propLogs || signalLogs || [];
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs]);

  const displayLines =
    logs.length > 0
      ? logs.map((log) => ({
          id: log.id,
          text: log.source ? `[${log.source.toUpperCase()}] ${log.message}` : log.message,
          type: logTypeToTerminalType(log.type),
          timestamp: log.timestamp || new Date().toISOString()
        }))
      : placeholderLines.map(p => ({ ...p, timestamp: new Date().toISOString() }))

  const getLineClass = (type: string) => {
    switch (type) {
      case 'command':
        return 'text-emerald-400/90'
      case 'error':
        return 'text-rose-500/90'
      case 'info':
        return 'text-cyan-400/80'
      default:
        return 'text-zinc-400'
    }
  }

  return (
    <div
      className={cn(
        'flex flex-col h-full bg-zinc-950/40 backdrop-blur-md border border-white/[0.03] overflow-hidden rounded-xl shadow-inner',
        className,
      )}
    >
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/[0.03] bg-white/[0.01]">
        <div className="flex items-center gap-2.5">
          <Terminal size={12} className="text-emerald-500/70" />
          <span className="text-[10px] font-bold font-mono text-zinc-500 uppercase tracking-widest">System_Log_Stream</span>
        </div>
        <div className="flex gap-1">
          <div className="h-1.5 w-1.5 rounded-full bg-zinc-800" />
          <div className="h-1.5 w-1.5 rounded-full bg-zinc-800" />
          <div className="h-1.5 w-1.5 rounded-full bg-zinc-800" />
        </div>
      </div>
      
      <ScrollArea className="flex-1 font-mono text-[11px] leading-tight selection:bg-emerald-500/20">
        <div className="p-4 space-y-1">
          {displayLines.map((line) => (
            <div
              key={line.id}
              className={cn(
                'flex gap-3 group',
                getLineClass(line.type)
              )}
            >
              <span className="shrink-0 text-zinc-700 select-none opacity-0 group-hover:opacity-100 transition-opacity">
                {new Date(line.timestamp).toLocaleTimeString('hu-HU', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </span>
              <span className="whitespace-pre-wrap break-all">
                {line.text}
              </span>
            </div>
          ))}
          <div ref={scrollRef} />
        </div>
      </ScrollArea>
      
      <div className="px-4 py-1.5 bg-black/20 border-t border-white/[0.02]">
        <div className="flex items-center gap-2">
          <span className="text-[9px] text-emerald-500/50 font-mono animate-pulse">●</span>
          <span className="text-[8px] text-zinc-600 font-mono uppercase tracking-tighter italic">Streaming_Kernel_Events_Active</span>
        </div>
      </div>
    </div>
  )
}
