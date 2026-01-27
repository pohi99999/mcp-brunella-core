import React, { useState } from 'react'
import { Check, Loader2, X, Circle, ChevronDown, ChevronUp } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { motion, AnimatePresence } from 'framer-motion'

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
  const [isExpanded, setIsExpanded] = useState(true);

  if (!plan || !plan.steps) return null;

  return (
    <Card className="w-full mb-4 bg-muted/20 border-dashed overflow-hidden">
      <CardHeader 
        className="py-3 px-4 cursor-pointer hover:bg-muted/30 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <CardTitle className="text-sm font-medium flex items-center justify-between text-muted-foreground">
          <div className="flex items-center gap-2">
            <span className="text-lg">🗺️</span> Műveleti Terv
          </div>
          {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </CardTitle>
      </CardHeader>
      
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
          >
            <CardContent className="py-2 px-4 space-y-1 pb-4">
              {plan.steps.map((step, index) => (
                <motion.div 
                  key={step.id} 
                  initial={{ x: -10, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ delay: index * 0.1 }}
                  className="group flex items-start gap-3 p-2 rounded-md transition-all duration-200 hover:bg-muted/50 border border-transparent hover:border-border/40"
                >
                  <div className="mt-0.5 shrink-0">
                      {step.status === 'pending' && <Circle className="h-4 w-4 text-muted-foreground/30" />}
                      {step.status === 'running' && <Loader2 className="h-4 w-4 text-primary animate-spin" />}
                      {step.status === 'completed' && <Check className="h-4 w-4 text-green-500 shadow-sm" />}
                      {step.status === 'failed' && <X className="h-4 w-4 text-destructive" />}
                  </div>
                  <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-foreground leading-tight">
                          {step.description}
                      </div>
                      <div className="mt-1 flex items-center gap-2">
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-primary/10 text-primary uppercase tracking-wider border border-primary/20">
                              {step.agent}
                          </span>
                          {step.status === 'running' && (
                              <span className="text-[10px] text-muted-foreground animate-pulse font-medium">FOLYAMATBAN...</span>
                          )}
                      </div>
                      
                      <AnimatePresence>
                        {step.result && (
                          <motion.div 
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            className={`mt-2 text-xs p-2 rounded border font-mono whitespace-pre-wrap max-h-32 overflow-y-auto shadow-inner ${
                              step.status === 'failed' 
                                ? 'text-destructive bg-destructive/5 border-destructive/20' 
                                : 'text-muted-foreground bg-black/20 border-border/50'
                            }`}
                          >
                              {step.result}
                          </motion.div>
                        )}
                      </AnimatePresence>
                  </div>
                </motion.div>
              ))}
            </CardContent>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  )
}
