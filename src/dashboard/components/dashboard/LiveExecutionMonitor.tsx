import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  CheckCircle, 
  Circle, 
  XCircle, 
  StopCircle, 
  Clock, 
  Eye,
  ArrowRight
} from 'lucide-react';
import { useSocket, RobotkezStep } from '@/context/SocketContext';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

export function LiveExecutionMonitor() {
  const { robotkezPlan, robotkezSteps, socket } = useSocket();
  const [selectedScreenshot, setSelectedScreenshot] = useState<string | null>(null);

  if (!robotkezPlan) return null;

  const totalSteps = robotkezSteps.length;
  const completedSteps = robotkezSteps.filter(s => s.status === 'completed').length;
  const progress = totalSteps > 0 ? (completedSteps / totalSteps) * 100 : 0;
  const isRunning = robotkezSteps.some(s => s.status === 'working');
  const isFinished = completedSteps === totalSteps || robotkezSteps.some(s => s.status === 'error');

  const handleAbort = () => {
    if (socket) {
      socket.emit('robotkez:abort');
      toast.warning('Megszakítás elküldve...');
    }
  };

  const getStatusIcon = (status: RobotkezStep['status']) => {
    switch (status) {
      case 'completed': return <CheckCircle className="w-4 h-4 text-emerald-500" />;
      case 'working': return <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />;
      case 'error': return <XCircle className="w-4 h-4 text-red-500" />;
      default: return <Circle className="w-4 h-4 text-zinc-600" />;
    }
  };

  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-top-4 duration-500">
      <Card className="glass-panel border-primary/20 bg-primary/5">
        <CardHeader className="p-4 border-b border-white/5 flex flex-row items-center justify-between">
          <div className="space-y-1">
            <CardTitle className="text-sm font-bold tracking-widest uppercase flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
              Live Execution Monitor
            </CardTitle>
            <p className="text-[10px] font-mono text-zinc-500">MISSION_ID: {robotkezPlan.taskId}</p>
          </div>
          
          {!isFinished && (
            <Button 
              variant="destructive" 
              size="sm" 
              className="h-8 gap-2 bg-red-500/20 hover:bg-red-500 text-red-500 hover:text-white border border-red-500/30"
              onClick={handleAbort}
            >
              <StopCircle size={14} />
              STOP
            </Button>
          )}
        </CardHeader>
        
        <CardContent className="p-4 space-y-4">
          {/* Progress Section */}
          <div className="space-y-2">
            <div className="flex justify-between text-[10px] font-mono text-zinc-400 uppercase">
              <span>Progress</span>
              <span>{Math.round(progress)}% ({completedSteps}/{totalSteps})</span>
            </div>
            <Progress value={progress} className="h-1.5 bg-white/5" indicatorClassName="bg-primary shadow-[0_0_10px_rgba(var(--primary),0.5)]" />
          </div>

          {/* Steps List */}
          <ScrollArea className="h-[300px] pr-4">
            <div className="space-y-3">
              {robotkezSteps.map((step, idx) => (
                <div 
                  key={idx} 
                  className={cn(
                    "flex items-start gap-3 p-3 rounded-xl border transition-all duration-300",
                    step.status === 'working' ? "bg-primary/10 border-primary/30" : 
                    step.status === 'completed' ? "bg-white/5 border-emerald-500/20" :
                    "bg-black/20 border-white/5 opacity-60"
                  )}
                >
                  <div className="mt-0.5 shrink-0">
                    {getStatusIcon(step.status)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={cn(
                      "text-xs font-medium leading-none",
                      step.status === 'completed' ? "text-emerald-400" : "text-zinc-200"
                    )}>
                      {step.description}
                    </p>
                    {step.error && (
                      <p className="text-[10px] text-red-400 mt-1 font-mono">ERR: {step.error}</p>
                    )}
                  </div>
                  {step.screenshot && (
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-6 w-6 rounded-full hover:bg-white/10"
                      onClick={() => setSelectedScreenshot(step.screenshot || null)}
                    >
                      <Eye size={12} className="text-zinc-400" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </ScrollArea>

          {/* Estimated Time */}
          <div className="pt-2 border-t border-white/5 flex items-center justify-between text-[10px] font-mono text-zinc-500 uppercase">
            <div className="flex items-center gap-1.5">
              <Clock size={12} />
              <span>Est. Remaining: {Math.round((robotkezPlan.plan.estimatedDuration * (1 - progress/100)) / 1000)}s</span>
            </div>
            {isFinished && (
              <Button 
                variant="link" 
                size="sm" 
                className="h-auto p-0 text-[10px] text-zinc-400 hover:text-primary"
                onClick={() => { /* Potential clear/archive logic */ }}
              >
                DISMISS MONITOR
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Screenshot Modal/Overlay */}
      {selectedScreenshot && (
        <div 
          className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-8 animate-in fade-in duration-300"
          onClick={() => setSelectedScreenshot(null)}
        >
          <div className="relative max-w-5xl w-full max-h-full flex flex-col items-center gap-4">
            <img 
              src={selectedScreenshot.startsWith('data:') ? selectedScreenshot : `data:image/png;base64,${selectedScreenshot}`} 
              alt="Step Screenshot" 
              className="max-w-full max-h-[85vh] rounded-lg border border-white/10 shadow-2xl"
            />
            <Button variant="outline" className="bg-white/5 border-white/10 text-white hover:bg-white/10">
              CLOSE PREVIEW
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
