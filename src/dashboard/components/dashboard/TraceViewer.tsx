// FILE: src/dashboard/components/dashboard/TraceViewer.tsx
// PURPOSE: G5.3 — Agent trace hierarchy visualization (RULE-OB1→OB2)

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

interface TraceSpan {
  traceId: string
  spanId: string
  parentSpanId?: string
  agentName: string
  operation: string
  startTime: number
  endTime?: number
  duration?: number
  status: 'running' | 'success' | 'error'
  metadata: Record<string, unknown>
  tokenUsage?: { input: number; output: number }
  error?: string
}

interface TraceSummary {
  traceId: string
  rootAgent: string
  operation: string
  status: string
  startTime: number
  duration?: number
  spanCount: number
}

function StatusBadge({ status }: { status: string }) {
  const variant = status === 'success' ? 'default' : status === 'error' ? 'destructive' : 'secondary'
  return <Badge variant={variant}>{status}</Badge>
}

function SpanRow({ span, depth = 0 }: { span: TraceSpan; depth?: number }) {
  const durStr = span.duration != null
    ? span.duration < 1000
      ? `${span.duration}ms`
      : `${(span.duration / 1000).toFixed(1)}s`
    : '…'

  return (
    <div
      className="flex items-center gap-2 py-1 px-2 hover:bg-muted/50 rounded text-sm font-mono"
      style={{ paddingLeft: `${depth * 24 + 8}px` }}
    >
      <span className="text-muted-foreground w-6">{depth > 0 ? '└' : '●'}</span>
      <span className="font-medium text-accent">{span.agentName}</span>
      <span className="text-muted-foreground">::{span.operation}</span>
      <StatusBadge status={span.status} />
      <span className="ml-auto text-muted-foreground text-xs">{durStr}</span>
      {span.tokenUsage && (
        <span className="text-xs text-muted-foreground">
          {span.tokenUsage.input}↓ {span.tokenUsage.output}↑
        </span>
      )}
    </div>
  )
}

function buildTree(spans: TraceSpan[]): { span: TraceSpan; children: TraceSpan[]; depth: number }[] {
  const childMap = new Map<string, TraceSpan[]>()
  const roots: TraceSpan[] = []

  for (const span of spans) {
    if (span.parentSpanId) {
      const siblings = childMap.get(span.parentSpanId) || []
      siblings.push(span)
      childMap.set(span.parentSpanId, siblings)
    } else {
      roots.push(span)
    }
  }

  const result: { span: TraceSpan; children: TraceSpan[]; depth: number }[] = []
  function walk(span: TraceSpan, depth: number) {
    const children = childMap.get(span.spanId) || []
    result.push({ span, children, depth })
    for (const child of children) {
      walk(child, depth + 1)
    }
  }

  for (const root of roots) {
    walk(root, 0)
  }

  return result
}

export function TraceViewer() {
  const [traces, setTraces] = useState<TraceSummary[]>([])
  const [selectedTrace, setSelectedTrace] = useState<string | null>(null)
  const [spans, setSpans] = useState<TraceSpan[]>([])
  const [loading, setLoading] = useState(false)

  const fetchTraces = useCallback(async () => {
    try {
      const res = await fetch('/api/telemetry/traces?limit=20')
      if (res.ok) {
        const data = await res.json()
        setTraces(data.traces || [])
      }
    } catch {
      // silently fail
    }
  }, [])

  const fetchSpans = useCallback(async (traceId: string) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/telemetry/traces/${traceId}`)
      if (res.ok) {
        const data = await res.json()
        setSpans(data.spans || [])
      }
    } catch {
      // silently fail
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchTraces()
    const interval = setInterval(fetchTraces, 10000)
    return () => clearInterval(interval)
  }, [fetchTraces])

  useEffect(() => {
    if (selectedTrace) fetchSpans(selectedTrace)
  }, [selectedTrace, fetchSpans])

  const tree = buildTree(spans)

  return (
    <Card className="border-border/50">
      <CardHeader>
        <CardTitle className="text-lg">Agent Trace Viewer</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Trace list */}
          <div className="space-y-1 max-h-96 overflow-y-auto">
            {traces.length === 0 && (
              <p className="text-muted-foreground text-sm">No traces yet.</p>
            )}
            {traces.map(t => (
              <button
                key={t.traceId}
                onClick={() => setSelectedTrace(t.traceId)}
                className={`w-full text-left p-2 rounded text-sm hover:bg-muted/50 ${
                  selectedTrace === t.traceId ? 'bg-muted' : ''
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium">{t.rootAgent}</span>
                  <StatusBadge status={t.status} />
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {t.spanCount} spans • {t.duration ? `${t.duration}ms` : '…'}
                </div>
              </button>
            ))}
          </div>

          {/* Span hierarchy */}
          <div className="md:col-span-2 max-h-96 overflow-y-auto">
            {!selectedTrace && (
              <p className="text-muted-foreground text-sm">Select a trace to view spans.</p>
            )}
            {loading && <p className="text-muted-foreground text-sm">Loading…</p>}
            {selectedTrace && !loading && tree.length === 0 && (
              <p className="text-muted-foreground text-sm">No spans found.</p>
            )}
            {tree.map(({ span, depth }) => (
              <SpanRow key={span.spanId} span={span} depth={depth} />
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export default TraceViewer
