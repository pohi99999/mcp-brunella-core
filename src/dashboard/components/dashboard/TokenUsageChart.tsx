// FILE: src/dashboard/components/dashboard/TokenUsageChart.tsx
// PURPOSE: G5.3 — Token usage trend chart (Recharts)

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

interface TokenUsageData {
  today: { input: number; output: number; total: number }
  week: { input: number; output: number; total: number }
  month: { input: number; output: number; total: number }
  byAgent: Record<string, { input: number; output: number }>
  byModel: Record<string, { input: number; output: number }>
}

interface CostData {
  totalCost: number
  breakdown: Record<string, number>
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="space-y-1">
      <p className="text-xs text-zinc-500">{label}</p>
      <p className="text-xl font-mono font-medium text-accent">{value}</p>
      {sub && <p className="text-xs text-zinc-500">{sub}</p>}
    </div>
  )
}

export function TokenUsageChart() {
  const [usage, setUsage] = useState<TokenUsageData | null>(null)
  const [cost, setCost] = useState<CostData | null>(null)

  const fetchData = useCallback(async () => {
    try {
      const [usageRes, costRes] = await Promise.all([
        fetch('/api/telemetry/usage'),
        fetch('/api/telemetry/cost'),
      ])

      if (usageRes.ok) setUsage(await usageRes.json())
      if (costRes.ok) setCost(await costRes.json())
    } catch {
      // silently fail
    }
  }, [])

  useEffect(() => {
    fetchData()
    const interval = setInterval(fetchData, 15000)
    return () => clearInterval(interval)
  }, [fetchData])

  const agentEntries = usage ? Object.entries(usage.byAgent) : []
  const modelEntries = usage ? Object.entries(usage.byModel) : []
  const costEntries = cost ? Object.entries(cost.breakdown) : []

  return (
    <Card className="border-border/50">
      <CardHeader>
        <CardTitle className="text-lg">Token Usage & Cost</CardTitle>
      </CardHeader>
      <CardContent>
        {!usage ? (
          <p className="text-zinc-500 text-sm">Loading token data…</p>
        ) : (
          <div className="space-y-6">
            {/* Summary row */}
            <div className="grid grid-cols-3 gap-4">
              <StatCard
                label="Today"
                value={formatNumber(usage.today.total)}
                sub={`↓${formatNumber(usage.today.input)} ↑${formatNumber(usage.today.output)}`}
              />
              <StatCard
                label="This Week"
                value={formatNumber(usage.week.total)}
                sub={`↓${formatNumber(usage.week.input)} ↑${formatNumber(usage.week.output)}`}
              />
              <StatCard
                label="All Time"
                value={formatNumber(usage.month.total)}
                sub={cost ? `~$${cost.totalCost.toFixed(4)}` : ''}
              />
            </div>

            {/* By Agent */}
            {agentEntries.length > 0 && (
              <div>
                <p className="text-xs text-zinc-500 mb-2 font-medium">By Agent</p>
                <div className="space-y-1">
                  {agentEntries.map(([agent, tokens]) => (
                    <div key={agent} className="flex items-center justify-between text-sm">
                      <span className="font-mono">{agent}</span>
                      <span className="text-zinc-500">
                        {formatNumber(tokens.input + tokens.output)} tokens
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* By Model */}
            {modelEntries.length > 0 && (
              <div>
                <p className="text-xs text-zinc-500 mb-2 font-medium">By Model</p>
                <div className="space-y-1">
                  {modelEntries.map(([model, tokens]) => (
                    <div key={model} className="flex items-center justify-between text-sm">
                      <span className="font-mono">{model}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-zinc-500">
                          {formatNumber(tokens.input + tokens.output)}
                        </span>
                        {costEntries.find(([m]) => m === model) && (
                          <Badge variant="secondary" className="text-xs">
                            ${costEntries.find(([m]) => m === model)![1].toFixed(4)}
                          </Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export default TokenUsageChart
