import { ServerStatus } from '@/lib/types'
import { cn } from '@/lib/utils'

interface LiveIndicatorProps {
  status: ServerStatus
  className?: string
}

export function LiveIndicator({ status, className }: LiveIndicatorProps) {
  const getStatusColor = () => {
    switch (status) {
      case 'running':
        return 'bg-[var(--success)]'
      case 'stopped':
        return 'bg-destructive'
      case 'starting':
      case 'stopping':
        return 'bg-[var(--warning)]'
      case 'error':
        return 'bg-destructive'
      default:
        return 'bg-muted'
    }
  }

  const shouldPulse = status === 'running' || status === 'starting' || status === 'stopping'

  return (
    <span className={cn('flex items-center gap-2', className)}>
      <span className="relative flex h-3 w-3">
        {shouldPulse && (
          <span className={cn(
            'absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping',
            getStatusColor()
          )} />
        )}
        <span className={cn(
          'relative inline-flex rounded-full h-3 w-3',
          getStatusColor()
        )} />
      </span>
    </span>
  )
}
