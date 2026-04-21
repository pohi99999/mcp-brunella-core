import React, { useEffect, useState } from "react";
import { Progress } from "@/components/ui/progress";
import { Cpu, Terminal, ShieldCheck, Database, Radio, Globe } from "lucide-react";

interface BootStep {
  id: number;
  message: string;
  icon: React.ReactNode;
  duration: number;
}

const BOOT_STEPS: BootStep[] = [
  { id: 1, message: "INITIALIZING KERNEL...", icon: <Cpu className="w-4 h-4 text-primary" />, duration: 800 },
  { id: 2, message: "LOADING NEURAL MODULES...", icon: <DatasetIcon className="w-4 h-4 text-purple-400" />, duration: 1200 },
  { id: 3, message: "ESTABLISHING SECURE LINK...", icon: <ShieldCheck className="w-4 h-4 text-emerald-400" />, duration: 1000 },
  { id: 4, message: "MOUNTING FILE SYSTEMS...", icon: <Database className="w-4 h-4 text-blue-400" />, duration: 800 },
  { id: 5, message: "CONNECTING TO MCP AGENTS...", icon: <Radio className="w-4 h-4 text-amber-400" />, duration: 1500 },
  { id: 6, message: "SYNCING GLOBAL STATE...", icon: <Globe className="w-4 h-4 text-cyan-400" />, duration: 1000 },
];

function DatasetIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M3 3v18h18" />
      <path d="M18.7 8l-5.1 5.2-2.8-2.7L7 14.3" />
    </svg>
  );
}

interface SystemBootSequenceProps {
  onComplete: () => void;
}

export function SystemBootSequence({ onComplete }: SystemBootSequenceProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [progress, setProgress] = useState(0);
  const [logs, setLogs] = useState<string[]>([]);

  useEffect(() => {
    let mounted = true;
    let stepIndex = 0;
    
    const runBootSequence = async () => {
      // Small initial delay
      await new Promise(r => setTimeout(r, 500));

      while (stepIndex < BOOT_STEPS.length && mounted) {
        const step = BOOT_STEPS[stepIndex];
        setCurrentStep(stepIndex);
        
        // Add log
        setLogs(prev => [...prev, `> ${step.message}`]);
        
        // Animate progress bar for this step
        const startTime = Date.now();
        const endTime = startTime + step.duration;
        
        while (Date.now() < endTime && mounted) {
          const now = Date.now();
          const elapsed = now - startTime;
          const stepProgress = Math.min(100, (elapsed / step.duration) * 100);
          
          // Calculate total progress: completed steps + current step progress
          const totalProgress = ((stepIndex * 100) + stepProgress) / BOOT_STEPS.length;
          setProgress(totalProgress);
          
          await new Promise(r => requestAnimationFrame(r));
        }
        
        stepIndex++;
      }

      setLogs(prev => [...prev, "> SYSTEM READY."]);
      setProgress(100);
      
      // Final delay before completion
      await new Promise(r => setTimeout(r, 800));
      if (mounted) onComplete();
    };

    runBootSequence();

    return () => { mounted = false; };
  }, [onComplete]);

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col items-center justify-center font-mono text-xs overflow-hidden">
        {/* Matrix Rain / Grid Background Effect */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(0,255,100,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(0,255,100,0.03)_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,black_100%)] pointer-events-none" />

        <div className="w-full max-w-md relative z-10 p-6">
            {/* Header */}
            <div className="flex items-center justify-between mb-8 border-b border-white/10 pb-4">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-primary/20 rounded flex items-center justify-center animate-pulse">
                        <Terminal className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                        <div className="text-lg font-bold tracking-[0.2em] text-white">BRUNELLA</div>
                        <div className="text-[10px] text-primary/60">CORTEX OS v2.0.4</div>
                    </div>
                </div>
                <div className="text-right">
                    <div className="text-[10px] text-muted-foreground">BOOT SEQ</div>
                    <div className="text-emerald-500 font-bold animate-pulse">RUNNING</div>
                </div>
            </div>

            {/* Current Step Display */}
            <div className="mb-8 min-h-[60px] flex items-center gap-4">
                 {BOOT_STEPS[currentStep] && (
                     <>
                        <div className="w-12 h-12 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center shadow-[0_0_15px_rgba(255,255,255,0.1)]">
                             {BOOT_STEPS[currentStep].icon}
                        </div>
                        <div className="flex-1">
                            <div className="text-primary font-bold text-sm mb-1 typing-cursor">
                                {BOOT_STEPS[currentStep].message}
                            </div>
                            <div className="h-1 w-full bg-white/10 rounded-full overflow-hidden">
                                <div className="h-full bg-primary/50 animate-progress-indeterminate" />
                            </div>
                        </div>
                     </>
                 )}
            </div>

            {/* Main Progress Bar */}
            <div className="space-y-2 mb-8">
                <div className="flex justify-between text-[10px] text-muted-foreground">
                    <span>SYSTEM INTEGRITY CHECK</span>
                    <span>{Math.round(progress)}%</span>
                </div>
                <Progress value={progress} className="h-2 rounded-none bg-white/5 border border-white/10" />
            </div>

            {/* Terminal Logs */}
            <div className="h-32 border border-white/10 bg-black/50 rounded-lg p-3 overflow-hidden relative font-mono text-[10px] text-muted-foreground/80">
                <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-white/20 to-transparent" />
                <div className="flex flex-col justify-end h-full gap-1">
                    {logs.slice(-5).map((log, i) => (
                        <div key={i} className="flex gap-2">
                             <span className="text-white/20">{(Date.now() + i).toString().slice(-4)}</span>
                             <span className={log.includes("READY") ? "text-emerald-400" : "text-zinc-400"}>{log}</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
        
        <div className="absolute bottom-8 text-[10px] text-white/10 tracking-widest uppercase">
            Initialize Neural Interface Protocol
        </div>
    </div>
  );
}
