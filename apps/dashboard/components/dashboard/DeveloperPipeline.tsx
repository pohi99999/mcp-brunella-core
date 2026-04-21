/**
 * DeveloperPipeline.tsx — Pipeline vizualizáció komponens
 *
 * Fázisonkénti progress bar a Developer Agent feladatokhoz.
 */

import { cn } from '@/lib/utils'
import { CheckCircle2, XCircle, Loader2, Clock, SkipForward } from 'lucide-react'

export interface PipelinePhaseView {
  id: string
  label: string
  status: 'pending' | 'running' | 'done' | 'error' | 'skipped'
}

interface DeveloperPipelineProps {
  phases: PipelinePhaseView[]
  progress: number
  className?: string
}

const STATUS_CONFIG: Record<string, { icon: typeof CheckCircle2; color: string; bgColor: string }> = {
  pending: { icon: Clock, color: 'text-zinc-500', bgColor: 'bg-muted' },
  running: { icon: Loader2, color: 'text-blue-500', bgColor: 'bg-blue-500/10' },
  done: { icon: CheckCircle2, color: 'text-green-500', bgColor: 'bg-green-500/10' },
  error: { icon: XCircle, color: 'text-red-500', bgColor: 'bg-red-500/10' },
  skipped: { icon: SkipForward, color: 'text-yellow-500', bgColor: 'bg-yellow-500/10' },
}

export function DeveloperPipeline({ phases, progress, className }: DeveloperPipelineProps) {
  return (
    <div className={cn('space-y-3', className)}>
      {/* Overall progress bar */}
      <div className="flex items-center gap-3">
        <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
          <div
            className={cn(
              'h-full rounded-full transition-all duration-500 ease-out',
              progress === 100 ? 'bg-green-500' : 'bg-blue-500'
            )}
            style={{ width: `${progress}%` }}
          />
        </div>
        <span className="text-xs font-mono text-zinc-500 w-10 text-right">
          {progress}%
        </span>
      </div>

      {/* Phase steps */}
      <div className="flex items-center gap-1">
        {phases.map((phase, index) => {
          const config = STATUS_CONFIG[phase.status] || STATUS_CONFIG.pending
          const Icon = config.icon
          const isLast = index === phases.length - 1

          return (
            <div key={phase.id} className="flex items-center flex-1">
              <div
                className={cn(
                  'flex items-center gap-1.5 px-2 py-1.5 rounded-md text-xs font-medium flex-1 min-w-0',
                  config.bgColor,
                  config.color
                )}
              >
                <Icon
                  className={cn(
                    'h-3.5 w-3.5 shrink-0',
                    phase.status === 'running' && 'animate-spin'
                  )}
                />
                <span className="truncate">{phase.label}</span>
              </div>
              {!isLast && (
                <div className="w-2 h-px bg-border mx-0.5 shrink-0" />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
