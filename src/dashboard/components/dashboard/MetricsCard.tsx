import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ServerMetrics } from '@/lib/types'
import { ChartLine, Plugs, Warning, Lightning } from '@phosphor-icons/react'

interface MetricsCardProps {
  metrics: ServerMetrics
}

export function MetricsCard({ metrics }: MetricsCardProps) {
  return (
    <Card className="glass-card border-white/10 overflow-hidden shadow-[0_16px_60px_-36px_rgba(0,0,0,0.85)]">
      <CardHeader className="pb-3 border-b border-white/[0.05] bg-white/[0.015]">
        <CardTitle className="text-[11px] font-mono font-semibold tracking-[0.28em] uppercase text-zinc-400">
          Teljesítmény Metrikák
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4 lg:p-5">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="rounded-2xl border border-white/[0.05] bg-white/[0.02] p-3 space-y-2 transition-all duration-200 hover:border-white/10">
            <div className="flex items-center gap-2 text-zinc-500 text-[10px] uppercase tracking-[0.22em]">
              <ChartLine size={16} />
              <span>Kérések/perc</span>
            </div>
            <p className="text-xl font-semibold font-mono tracking-tight text-cyan-300">
              {metrics.requestsPerMinute}
            </p>
          </div>

          <div className="rounded-2xl border border-white/[0.05] bg-white/[0.02] p-3 space-y-2 transition-all duration-200 hover:border-white/10">
            <div className="flex items-center gap-2 text-zinc-500 text-[10px] uppercase tracking-[0.22em]">
              <Plugs size={16} />
              <span>Aktív kapcsolatok</span>
            </div>
            <p className="text-xl font-semibold font-mono tracking-tight text-violet-300">
              {metrics.activeConnections}
            </p>
          </div>

          <div className="rounded-2xl border border-white/[0.05] bg-white/[0.02] p-3 space-y-2 transition-all duration-200 hover:border-white/10">
            <div className="flex items-center gap-2 text-zinc-500 text-[10px] uppercase tracking-[0.22em]">
              <Warning size={16} />
              <span>Hibaarány</span>
            </div>
            <p className="text-xl font-semibold font-mono tracking-tight text-amber-300">
              {metrics.errorRate.toFixed(2)}%
            </p>
          </div>

          <div className="rounded-2xl border border-white/[0.05] bg-white/[0.02] p-3 space-y-2 transition-all duration-200 hover:border-white/10">
            <div className="flex items-center gap-2 text-zinc-500 text-[10px] uppercase tracking-[0.22em]">
              <Lightning size={16} />
              <span>Átl. válaszidő</span>
            </div>
            <p className="text-xl font-semibold font-mono tracking-tight text-emerald-300">
              {metrics.averageResponseTime}ms
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
