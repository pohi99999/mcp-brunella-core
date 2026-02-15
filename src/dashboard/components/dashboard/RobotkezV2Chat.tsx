/**
 * RobotkezV2 Chat - Comet-style Agentic Browser UI
 *
 * Features:
 * - Chat interface (magyar natural language instructions)
 * - Execution Timeline (step-by-step progress)
 * - Live Browser View (screenshot auto-refresh)
 * - Background Tasks Panel (manage long-running tasks)
 *
 * @track robotkezv2-full-comet-20260215
 * @phase Phase 6 - Dashboard UI (Comet-style)
 */

import { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Send,
  User,
  Bot,
  CheckCircle,
  Loader,
  Circle,
  XCircle,
  Eye,
  EyeOff,
  RefreshCw,
  Activity,
  Clock,
  X
} from 'lucide-react';
import { toast } from 'sonner';
import * as api from '@/lib/apiService';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  plan?: api.ExecutionPlan;
  taskId?: string;
  backgroundTask?: boolean;
}

export function RobotkezV2Chat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState<api.RobotkezStatusResponse | null>(null);
  const [activePlan, setActivePlan] = useState<api.ExecutionPlan | null>(null);
  const [currentStep, setCurrentStep] = useState<number>(-1);
  const [showBrowserView, setShowBrowserView] = useState(true);
  const [screenshotUrl, setScreenshotUrl] = useState<string>('');
  const [backgroundTasks, setBackgroundTasks] = useState<api.BackgroundTask[]>([]);
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Refresh status, screenshot, and background tasks
  const refreshData = async () => {
    try {
      const statusData = await api.robotkezStatus();
      setStatus(statusData);

      // Refresh screenshot (if browser active)
      if (statusData.browser.active) {
        setScreenshotUrl(`/api/v1/robotkez/screenshot?t=${Date.now()}`);
      } else {
        setScreenshotUrl('');
      }

      // Refresh background tasks
      const tasksData = await api.robotkezGetTasks();
      setBackgroundTasks(tasksData.tasks);

      // Update active task details if expanded
      if (expandedTaskId) {
        const taskDetail = await api.robotkezGetTaskById(expandedTaskId);
        setBackgroundTasks(prev =>
          prev.map(t => t.id === expandedTaskId ? taskDetail.task : t)
        );
      }
    } catch (err) {
      console.error('Refresh error:', err);
    }
  };

  // Auto-refresh hook (2s interval)
  useEffect(() => {
    refreshData();
    const interval = setInterval(refreshData, 2000);
    return () => clearInterval(interval);
  }, [expandedTaskId]);

  // Send chat message
  const send = async () => {
    const text = input.trim();
    if (!text || isLoading) return;

    setInput('');
    const userMsg: ChatMessage = {
      role: 'user',
      content: text,
      timestamp: Date.now()
    };
    setMessages(prev => [...prev, userMsg]);
    setIsLoading(true);
    setActivePlan(null);
    setCurrentStep(-1);

    try {
      const result = await api.robotkezChat(text);

      // Check if task was delegated to background
      if (result.data?.taskId) {
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: result.message,
          timestamp: Date.now(),
          taskId: result.data.taskId,
          plan: result.data.plan,
          backgroundTask: true
        }]);
        toast.info('Háttérben fut - lásd Background Tasks');
      } else {
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: result.message || result.success ? 'Kész!' : 'Hiba történt',
          timestamp: Date.now()
        }]);
        toast.success('Feladat befejezve');
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Hiba történt';
      toast.error(msg);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `❌ Hiba: ${msg}`,
        timestamp: Date.now()
      }]);
    } finally {
      setIsLoading(false);
      refreshData();
    }
  };

  // Preview execution plan
  const previewPlan = async () => {
    const text = input.trim();
    if (!text) return;

    try {
      const planData = await api.robotkezPlan(text);
      setActivePlan(planData.plan);
      setCurrentStep(-1);
      toast.info(`Terv előnézet: ${planData.plan.plan.length} lépés`);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Plan előnézet hiba';
      toast.error(msg);
    }
  };

  // Cancel background task
  const cancelTask = async (id: string) => {
    try {
      await api.robotkezCancelTask(id);
      toast.success('Feladat megszakítva');
      refreshData();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Megszakítás sikertelen';
      toast.error(msg);
    }
  };

  // Toggle task details
  const toggleTaskDetails = (id: string) => {
    setExpandedTaskId(prev => prev === id ? null : id);
  };

  // Step status icon helper
  const getStepIcon = (status: api.TaskStep['status']) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'running':
        return <Loader className="w-4 h-4 text-blue-500 animate-spin" />;
      case 'error':
        return <XCircle className="w-4 h-4 text-red-500" />;
      default:
        return <Circle className="w-4 h-4 text-muted-foreground" />;
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 p-6 h-full">
      {/* Left Column: Chat + Timeline */}
      <div className="lg:col-span-2 space-y-6">
        {/* Chat Card */}
        <Card className="glass-card border-border/50 bg-background/50 backdrop-blur-xl flex flex-col h-[500px] overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between pb-2 border-b border-border/50">
            <CardTitle className="flex items-center gap-2 text-base font-medium">
              <Bot className="w-5 h-5 text-primary" />
              Robotkéz V2 - Magyar Agentic Browser
            </CardTitle>
            <div className="flex items-center gap-2">
              <Badge variant={status?.browser.active ? 'default' : 'secondary'} className={status?.browser.active ? 'bg-green-500/20 text-green-500 border-green-500/50' : ''}>
                {status?.browser.active ? 'AKTÍV' : 'LEÁLLÍTVA'}
              </Badge>
              <Button variant="ghost" size="icon" onClick={refreshData} title="Frissítés">
                <RefreshCw className="w-4 h-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col min-h-0 p-0">
            {/* Message History */}
            <ScrollArea className="flex-1 px-4">
              <div className="space-y-4 py-4">
                {messages.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-12 text-center space-y-4">
                    <div className="p-4 rounded-full bg-primary/10 border border-primary/20">
                      <Activity className="w-8 h-8 text-primary animate-pulse" />
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-foreground/80">
                        RobotkezV2 készen áll
                      </p>
                      <p className="text-xs text-muted-foreground max-w-xs">
                        Adj magyar nyelvű utasításokat a böngésző automatizálásához!
                      </p>
                    </div>
                  </div>
                )}
                {messages.map((msg, i) => (
                  <div
                    key={i}
                    className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-2 duration-300`}
                  >
                    {msg.role === 'assistant' && (
                      <div className="h-8 w-8 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                        <Bot className="w-4 h-4 text-primary" />
                      </div>
                    )}
                    <div className="flex flex-col gap-1.5 max-w-[85%]">
                      <div
                        className={`rounded-2xl px-4 py-2.5 text-sm shadow-sm ${
                          msg.role === 'user'
                            ? 'bg-primary text-primary-foreground font-medium'
                            : 'bg-muted/50 border border-border/50 text-foreground'
                        }`}
                      >
                        <p className="whitespace-pre-wrap leading-relaxed">
                          {msg.content}
                        </p>
                      </div>

                      {/* Background Task Badge */}
                      {msg.backgroundTask && msg.taskId && (
                        <button
                          onClick={() => toggleTaskDetails(msg.taskId!)}
                          className="flex items-center gap-1.5 text-[10px] uppercase font-bold tracking-widest text-muted-foreground hover:text-primary transition-colors w-fit px-2 py-1 rounded bg-blue-500/10 border border-blue-500/20"
                        >
                          <Clock className="w-3 h-3" />
                          Háttérben fut - Task ID: {msg.taskId.slice(0, 8)}
                        </button>
                      )}
                    </div>
                    {msg.role === 'user' && (
                      <div className="h-8 w-8 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                        <User className="w-4 h-4 text-primary" />
                      </div>
                    )}
                  </div>
                ))}
                {isLoading && (
                  <div className="flex gap-3">
                    <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                      <Loader className="w-4 h-4 text-primary animate-spin" />
                    </div>
                    <div className="bg-muted/50 rounded-lg px-3 py-2 border border-border/50">
                      <p className="text-sm text-muted-foreground">Feldolgozás...</p>
                    </div>
                  </div>
                )}
                <div ref={scrollRef} />
              </div>
            </ScrollArea>

            {/* Input Area */}
            <div className="p-4 border-t border-border/50">
              <div className="flex gap-2 mb-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={previewPlan}
                  disabled={!input.trim() || isLoading}
                  className="text-xs"
                >
                  Terv előnézet
                </Button>
              </div>
              <div className="flex gap-2">
                <Textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) =>
                    e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), send())
                  }
                  placeholder="pl. 'Navigálj a google.com-ra és keress rá az AI hírekre'"
                  className="min-h-[60px] bg-background/50 border-border resize-none"
                  disabled={isLoading}
                />
                <Button
                  onClick={send}
                  disabled={!input.trim() || isLoading}
                  className="shrink-0"
                >
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Execution Timeline */}
        {activePlan && (
          <Card className="glass-card border-border/50 bg-background/50 backdrop-blur-xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm font-medium">
                <Activity className="w-4 h-4 text-primary" />
                Végrehajtási Terv ({activePlan.plan.length} lépés)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {activePlan.plan.map((step, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-3 p-2 rounded bg-muted/30 border border-border/30"
                  >
                    {getStepIcon(currentStep === i ? 'running' : currentStep > i ? 'completed' : 'pending')}
                    <div className="flex-1">
                      <p className="text-sm font-medium">{step.action}</p>
                      <p className="text-xs text-muted-foreground">{step.description}</p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-4">
                <div className="flex justify-between text-xs text-muted-foreground mb-1">
                  <span>Becsült idő</span>
                  <span>{(activePlan.estimatedDuration / 1000).toFixed(1)}s</span>
                </div>
                <Progress value={currentStep >= 0 ? ((currentStep + 1) / activePlan.plan.length) * 100 : 0} className="h-1" />
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Right Column: Live View + Background Tasks */}
      <div className="space-y-6">
        {/* Live Browser View */}
        <Card className="glass-card border-border/50 bg-background/50 backdrop-blur-xl overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between pb-2 border-b border-border/50">
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              <Eye className="w-4 h-4 text-primary" />
              Élő Nézet (2s frissítés)
            </CardTitle>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowBrowserView(!showBrowserView)}
              title={showBrowserView ? 'Elrejtés' : 'Megjelenítés'}
            >
              {showBrowserView ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </Button>
          </CardHeader>
          {showBrowserView && (
            <CardContent className="p-0 border-t border-border/50 bg-black min-h-[300px] flex items-center justify-center">
              {screenshotUrl ? (
                <img
                  src={screenshotUrl}
                  alt="Böngésző nézet"
                  className="w-full h-auto object-contain cursor-zoom-in transition-transform hover:scale-105"
                  onClick={() => window.open(screenshotUrl, '_blank')}
                />
              ) : (
                <div className="text-muted-foreground flex flex-col items-center gap-2">
                  <Activity className="w-8 h-8 opacity-20" />
                  <span className="text-xs uppercase tracking-widest opacity-50">Nincs aktív kép</span>
                </div>
              )}
            </CardContent>
          )}
        </Card>

        {/* Background Tasks Panel */}
        <Card className="glass-card border-border/50 bg-background/50 backdrop-blur-xl">
          <CardHeader className="flex flex-row items-center justify-between pb-2 border-b border-border/50">
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              <Clock className="w-4 h-4 text-primary" />
              Háttér Feladatok ({backgroundTasks.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[300px]">
              <div className="p-4 space-y-2">
                {backgroundTasks.length === 0 ? (
                  <div className="text-xs text-muted-foreground text-center py-8">
                    Nincsenek háttér feladatok
                  </div>
                ) : (
                  backgroundTasks.map((task) => (
                    <div key={task.id} className="border border-border/50 rounded-lg bg-muted/20">
                      <div
                        className="flex items-center justify-between p-3 cursor-pointer hover:bg-muted/30 transition-colors"
                        onClick={() => toggleTaskDetails(task.id)}
                      >
                        <div className="flex-1">
                          <p className="text-xs font-medium truncate">{task.instruction}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge
                              variant={task.status === 'completed' ? 'default' : task.status === 'error' ? 'destructive' : 'secondary'}
                              className="text-[10px] h-4"
                            >
                              {task.status}
                            </Badge>
                            <span className="text-[10px] text-muted-foreground">{task.progress}%</span>
                          </div>
                        </div>
                        {task.status === 'running' && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={(e) => {
                              e.stopPropagation();
                              cancelTask(task.id);
                            }}
                          >
                            <X className="w-3 h-3" />
                          </Button>
                        )}
                      </div>

                      {/* Task Details (expanded) */}
                      {expandedTaskId === task.id && (
                        <div className="border-t border-border/50 p-3 space-y-2 bg-background/50">
                          <Progress value={task.progress} className="h-1" />
                          <div className="space-y-1">
                            {task.steps.map((step, i) => (
                              <div key={i} className="flex items-start gap-2 text-xs">
                                {getStepIcon(step.status)}
                                <span className={step.status === 'completed' ? 'text-muted-foreground line-through' : ''}>
                                  {step.description}
                                </span>
                              </div>
                            ))}
                          </div>
                          {task.error && (
                            <div className="text-xs text-red-500 bg-red-500/10 border border-red-500/20 rounded p-2">
                              {task.error}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Agent Status Card */}
        {status && (
          <Card className="glass-card border-border/50 bg-background/50 backdrop-blur-xl">
            <CardHeader className="pb-2 border-b border-border/50">
              <CardTitle className="text-sm font-medium">Agent Státusz</CardTitle>
            </CardHeader>
            <CardContent className="pt-4 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Név:</span>
                <span className="font-medium">{status.agent.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Szerepkör:</span>
                <span className="font-medium">{status.agent.role}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Futó feladatok:</span>
                <span className="font-medium text-blue-500">{status.tasks.running}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Befejezett:</span>
                <span className="font-medium text-green-500">{status.tasks.completed}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Hibák:</span>
                <span className="font-medium text-red-500">{status.tasks.error}</span>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
