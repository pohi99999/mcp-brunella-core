import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ServerMetrics } from '@/lib/types'
import { ChartLine, Plugs, Warning, Lightning } from '@phosphor-icons/react'

interface MetricsCardProps {
  metrics: ServerMetrics
}

export function MetricsCard({ metrics }: MetricsCardProps) {
  return (
    <Card className="border-border/50">
      <CardHeader>
        <CardTitle className="text-lg">Teljesítmény Metrikák</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-zinc-500 text-xs">
              <ChartLine size={16} />
              <span>Kérések/perc</span>
            </div>
            <p className="text-xl font-mono font-medium text-accent">
              {metrics.requestsPerMinute}
            </p>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2 text-zinc-500 text-xs">
              <Plugs size={16} />
              <span>Aktív kapcsolatok</span>
            </div>
            <p className="text-xl font-mono font-medium text-accent">
              {metrics.activeConnections}
            </p>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2 text-zinc-500 text-xs">
              <Warning size={16} />
              <span>Hibaarány</span>
            </div>
            <p className="text-xl font-mono font-medium text-accent">
              {metrics.errorRate.toFixed(2)}%
            </p>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2 text-zinc-500 text-xs">
              <Lightning size={16} />
              <span>Átl. válaszidő</span>
            </div>
            <p className="text-xl font-mono font-medium text-accent">
              {metrics.averageResponseTime}ms
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
