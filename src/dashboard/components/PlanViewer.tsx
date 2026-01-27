import React from 'react'
import { Check, Loader2, X, Circle } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface PlanStep {
    id: string
    description: string
    agent: string
    status: 'pending' | 'running' | 'completed' | 'failed'
    result?: string
}

export interface ExecutionPlan {
    task: string
    steps: PlanStep[]
}

export function PlanViewer({ plan }: { plan: ExecutionPlan }) {
  if (!plan || !plan.steps) return null;

  return (
    <Card className="w-full mb-4 bg-muted/30 border-dashed">
      <CardHeader className="py-3 px-4">
        <CardTitle className="text-sm font-medium flex items-center gap-2 text-muted-foreground">
          🗺️ Műveleti Terv
        </CardTitle>
      </CardHeader>
      <CardContent className="py-2 px-4 space-y-1">
        {plan.steps.map((step) => (
          <div key={step.id} className="group flex items-start gap-3 p-2 rounded-md transition-all duration-200 hover:bg-muted/50">
            <div className="mt-0.5 shrink-0">
                {step.status === 'pending' && <Circle className="h-4 w-4 text-muted-foreground/40" />}
                {step.status === 'running' && <Loader2 className="h-4 w-4 text-primary animate-spin" />}
                {step.status === 'completed' && <Check className="h-4 w-4 text-green-500" />}
                {step.status === 'failed' && <X className="h-4 w-4 text-destructive" />}
            </div>
            <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-foreground leading-tight">
                    {step.description}
                </div>
                <div className="mt-1 flex items-center gap-2">
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-primary/10 text-primary uppercase tracking-wider">
                        {step.agent}
                    </span>
                    {step.status === 'running' && (
                        <span className="text-xs text-muted-foreground animate-pulse">Végrehajtás...</span>
                    )}
                </div>
                {step.result && step.status === 'completed' && (
                    <div className="mt-2 text-xs text-muted-foreground bg-background/50 p-2 rounded border border-border/50 font-mono whitespace-pre-wrap max-h-20 overflow-y-auto">
                        {step.result}
                    </div>
                )}
                 {step.status === 'failed' && step.result && (
                    <div className="mt-2 text-xs text-destructive bg-destructive/10 p-2 rounded font-mono">
                        {step.result}
                    </div>
                )}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
