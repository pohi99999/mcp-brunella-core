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
    <Card className="border-border/50 hover:border-border transition-colors">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="text-lg">Szerver Állapot</span>
          <div className="flex items-center gap-2">
            <LiveIndicator status={serverState.status} />
            <span className="text-sm font-medium">{getStatusText()}</span>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-zinc-500 text-sm">
              <Timer size={18} />
              <span>Üzemidő</span>
            </div>
            <p className="text-2xl font-mono font-medium">
              {formatUptime(serverState.uptime)}
            </p>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2 text-zinc-500 text-sm">
              <Cpu size={18} />
              <span>CPU Használat</span>
            </div>
            <p className={cn(
              "text-2xl font-mono font-medium",
              serverState.cpuUsage > 80 && "text-[var(--warning)]",
              serverState.cpuUsage > 90 && "text-destructive"
            )}>
              {serverState.cpuUsage.toFixed(1)}%
            </p>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2 text-zinc-500 text-sm">
              <HardDrive size={18} />
              <span>Memória Használat</span>
            </div>
            <p className={cn(
              "text-2xl font-mono font-medium",
              serverState.memoryUsage > 80 && "text-[var(--warning)]",
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
