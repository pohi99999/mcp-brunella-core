import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ServerState } from '@/lib/types'
import { formatUptime } from '@/lib/mockData'
import { LiveIndicator } from './LiveIndicator'
import { Cpu, Timer, HardDrive } from '@phosphor-icons/react'
import { cn } from '@/lib/utils'

interface StatusCardProps {
  serverState: ServerState
}

export function StatusCard({ serverState }: StatusCardProps) {
  const getStatusText = () => {
    switch (serverState.status) {
      case 'running':
        return 'Fut'
      case 'stopped':
        return 'Leállítva'
      case 'starting':
        return 'Indítás...'
      case 'stopping':
        return 'Leállítás...'
      case 'error':
        return 'Hiba'
      default:
        return 'Ismeretlen'
    }
  }

  return (
    <Card className="glass-card border-white/10 overflow-hidden shadow-[0_16px_60px_-36px_rgba(0,0,0,0.85)]">
      <CardHeader className="pb-3 border-b border-white/[0.05] bg-white/[0.015]">
        <CardTitle className="flex items-center justify-between gap-3 text-[11px] font-mono font-semibold tracking-[0.28em] uppercase text-zinc-400">
          <span>Szerver Állapot</span>
          <div className="flex items-center gap-2 text-white">
            <LiveIndicator status={serverState.status} />
            <span className="text-[10px] tracking-[0.24em] text-zinc-300">{getStatusText()}</span>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 p-4 lg:p-5">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="rounded-2xl border border-white/[0.05] bg-white/[0.02] p-3 space-y-2 transition-all duration-200 hover:border-white/10">
            <div className="flex items-center gap-2 text-zinc-500 text-xs uppercase tracking-[0.22em]">
              <Timer size={18} />
              <span>Üzemidő</span>
            </div>
            <p className="text-2xl font-semibold font-mono text-white tracking-tight">
              {formatUptime(serverState.uptime)}
            </p>
          </div>

          <div className="rounded-2xl border border-white/[0.05] bg-white/[0.02] p-3 space-y-2 transition-all duration-200 hover:border-white/10">
            <div className="flex items-center gap-2 text-zinc-500 text-xs uppercase tracking-[0.22em]">
              <Cpu size={18} />
              <span>CPU Használat</span>
            </div>
            <p className={cn(
              "text-2xl font-semibold font-mono tracking-tight",
              serverState.cpuUsage > 80 && "text-amber-300",
              serverState.cpuUsage > 90 && "text-destructive"
            )}>
              {serverState.cpuUsage.toFixed(1)}%
            </p>
          </div>

          <div className="rounded-2xl border border-white/[0.05] bg-white/[0.02] p-3 space-y-2 transition-all duration-200 hover:border-white/10">
            <div className="flex items-center gap-2 text-zinc-500 text-xs uppercase tracking-[0.22em]">
              <HardDrive size={18} />
              <span>Memória Használat</span>
            </div>
            <p className={cn(
              "text-2xl font-semibold font-mono tracking-tight",
              serverState.memoryUsage > 80 && "text-amber-300",
              serverState.memoryUsage > 90 && "text-destructive"
            )}>
              {serverState.memoryUsage.toFixed(1)}%
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
