import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Activity, Bot } from 'lucide-react'
import { cn } from '@/lib/utils'

export type AgentStatus = 'idle' | 'working' | 'error'

interface AgentStatusCardProps {
  name: string
  status: AgentStatus
  taskDescription?: string
}

export function AgentStatusCard({ name, status, taskDescription }: AgentStatusCardProps) {
  const statusConfig = {
    idle: {
      label: 'Idle',
      color: 'bg-zinc-500',
      pulse: false,
      badge: 'secondary',
    },
    working: {
      label: 'Working',
      color: 'bg-emerald-500',
      pulse: true,
      badge: 'default',
    },
    error: {
      label: 'Error',
      color: 'bg-red-500',
      pulse: false,
      badge: 'destructive',
    },
  }

  const config = statusConfig[status]

  return (
    <Card className="border-zinc-800/80 bg-zinc-950/60 backdrop-blur-sm transition-all hover:border-zinc-700/80">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-3 text-base font-medium">
          <div className="relative flex items-center gap-2">
            <span
              className={cn(
                'h-2.5 w-2.5 rounded-full',
                config.color,
                config.pulse && 'animate-pulse shadow-[0_0_8px_currentColor]',
              )}
              aria-hidden
            />
            <Bot size={18} className="text-zinc-400" />
            <span>{name}</span>
          </div>
          <Badge variant={config.badge as 'secondary' | 'default' | 'destructive'} className="ml-auto font-mono text-xs">
            {config.label}
          </Badge>
        </CardTitle>
      </CardHeader>
      {taskDescription && (
        <CardContent className="pt-0">
          <p className="text-sm text-zinc-400 line-clamp-2">{taskDescription}</p>
        </CardContent>
      )}
    </Card>
  )
}
