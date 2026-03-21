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

import React, { useState, useRef, useEffect } from 'react';
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
  X,
  Monitor,
  MousePointer,
  Keyboard,
  Crosshair,
  Bug
} from 'lucide-react';
import { toast } from 'sonner';
import * as api from '@/lib/apiService';
import { useSocket } from '@/context/SocketContext';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  plan?: api.ExecutionPlan;
  taskId?: string;
  backgroundTask?: boolean;
  screenshot?: string; // NEW: for inline visual feedback
}

export function RobotkezV2Chat() {
  const { socket } = useSocket();
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

  // --- Gépi Vezérlés állapotok ---
  const [viewMode, setViewMode] = useState<'chat' | 'computer' | 'devtools'>('chat');
  const [computerScreenB64, setComputerScreenB64] = useState<string>('');
  const [computerLoading, setComputerLoading] = useState(false);
  const [typeText, setTypeText] = useState('');
  const [visionDesc, setVisionDesc] = useState('');
  const [computerLog, setComputerLog] = useState<string[]>([]);
  const [autoTaskInput, setAutoTaskInput] = useState('');
  const [autoTaskRunning, setAutoTaskRunning] = useState(false);
  const [trainingRunning, setTrainingRunning] = useState(false);
  const [trainingMode, setTrainingMode] = useState<'basic' | 'workflows'>('basic');

  // --- DevTools állapotok ---
  const [devtoolsUrl, setDevtoolsUrl] = useState('http://localhost:5173');
  const [devtoolsLoading, setDevtoolsLoading] = useState(false);
  const [devtoolsReport, setDevtoolsReport] = useState<api.DevToolsDebugReport | null>(null);
  const [devtoolsMarkdown, setDevtoolsMarkdown] = useState('');

  const addComputerLog = (msg: string) => setComputerLog(prev => [msg, ...prev].slice(0, 20));

  const refreshComputerScreen = async () => {
    try {
      const data = await api.computerScreenshot();
      if (data.screenshot_b64) setComputerScreenB64(data.screenshot_b64);
    } catch (err) {
      addComputerLog(`❌ Képernyőfotó hiba: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const handleComputerImageClick = async (e: React.MouseEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    const rect = img.getBoundingClientRect();
    const x_pct = (e.clientX - rect.left) / rect.width;
    const y_pct = (e.clientY - rect.top) / rect.height;
    setComputerLoading(true);
    try {
      const result = await api.computerClickPct(x_pct, y_pct);
      addComputerLog(`🖱️ Kattintás: (${(x_pct * 100).toFixed(1)}%, ${(y_pct * 100).toFixed(1)}%) → ${result.x}×${result.y}px`);
      await refreshComputerScreen();
    } catch (err) {
      addComputerLog(`❌ Kattintás hiba: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setComputerLoading(false);
    }
  };

  const handleComputerType = async () => {
    if (!typeText.trim()) return;
    setComputerLoading(true);
    try {
      await api.computerType(typeText);
      addComputerLog(`⌨️ Begépelve: "${typeText}"`);
      setTypeText('');
      await refreshComputerScreen();
    } catch (err) {
      addComputerLog(`❌ Gépelési hiba: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setComputerLoading(false);
    }
  };

  const handleVisionClick = async () => {
    if (!visionDesc.trim()) return;
    setComputerLoading(true);
    try {
      const result = await api.computerVisionClick(visionDesc);
      addComputerLog(`🎯 Vision kattintás: "${visionDesc}" → ${result.status}`);
      setVisionDesc('');
      await refreshComputerScreen();
    } catch (err) {
      addComputerLog(`❌ Vision kattintás hiba: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setComputerLoading(false);
    }
  };

  const handleAutoTask = async () => {
    if (!autoTaskInput.trim()) return;
    setAutoTaskRunning(true);
    addComputerLog(`🚀 Autonóm feladat indítása: "${autoTaskInput}"`);
    try {
      const result = await api.computerAutoTask(autoTaskInput);
      const cr = result.comet_result;
      if (cr.success) {
        addComputerLog(`✅ Feladat kész! ${cr.steps_completed} lépés, ${cr.attempts} próbálkozás`);
      } else {
        addComputerLog(`❌ Feladat sikertelen: ${cr.error ?? 'ismeretlen hiba'} (${cr.attempts} próba)`);
      }
      // Step log megjelenítése
      for (const entry of result.step_log) {
        if (entry['type'] === 'step_done') {
          const icon = entry['success'] ? '✓' : '✗';
          addComputerLog(`  ${icon} ${entry['action'] ?? '?'}`);
        }
      }
      setAutoTaskInput('');
      await refreshComputerScreen();
    } catch (err) {
      addComputerLog(`❌ Auto feladat hiba: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setAutoTaskRunning(false);
    }
  };

  const handleTrainingToggle = async () => {
    if (trainingRunning) {
      try {
        await api.robotkezTrainingStop();
        addComputerLog('⏹ Tréning leállítva');
        setTrainingRunning(false);
      } catch (err) {
        addComputerLog(`❌ Tréning leállítás hiba: ${err instanceof Error ? err.message : String(err)}`);
      }
    } else {
      try {
        const result = await api.robotkezTrainingStart(trainingMode);
        addComputerLog(`▶ Tréning elindult (${trainingMode}, PID: ${result.pid})`);
        setTrainingRunning(true);
      } catch (err) {
        addComputerLog(`❌ Tréning indítás hiba: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  };

  // DevTools debug futtatás
  const handleDevToolsRun = async () => {
    if (!devtoolsUrl.trim()) return;
    setDevtoolsLoading(true);
    setDevtoolsReport(null);
    setDevtoolsMarkdown('');
    try {
      const result = await api.robotkezDevToolsReport(devtoolsUrl);
      if (result.success) {
        setDevtoolsReport(result.report);
        setDevtoolsMarkdown(result.markdown);
        toast.success('DevTools riport kész');
      } else {
        toast.error('DevTools riport sikertelen');
      }
    } catch (err) {
      toast.error(`DevTools hiba: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setDevtoolsLoading(false);
    }
  };

  // Tréning állapot ellenőrzés (10s)
  useEffect(() => {
    if (viewMode !== 'computer') return;
    const checkTraining = async () => {
      try {
        const st = await api.robotkezTrainingStatus();
        setTrainingRunning(st.running);
      } catch { /* ignore */ }
    };
    checkTraining();
    const interval = setInterval(checkTraining, 10000);
    return () => clearInterval(interval);
  }, [viewMode]);

  // Gépi Vezérlés auto-frissítés (3s)
  useEffect(() => {
    if (viewMode !== 'computer') return;
    refreshComputerScreen();
    const interval = setInterval(refreshComputerScreen, 3000);
    return () => clearInterval(interval);
  }, [viewMode]);

  // Socket.IO: valós idejű Comet step események
  useEffect(() => {
    if (!socket) return;
    const handler = (data: Record<string, unknown>) => {
      const t = data['type'] as string;
      if (t === 'step_done') {
        const icon = data['success'] ? '✅' : '❌';
        addComputerLog(`${icon} [${(data['step_index'] as number) + 1}] ${data['action'] ?? '?'} — ${data['description'] ?? ''}`);
      } else if (t === 'attempt_start') {
        addComputerLog(`🔄 Próbálkozás ${data['attempt']}/${data['max_retries']}: ${data['task'] ?? ''}`);
      } else if (t === 'step_start') {
        addComputerLog(`⏳ [${(data['step_index'] as number) + 1}/${data['total_steps']}] ${data['description'] ?? data['action']}`);
      }
    };
    socket.on('robotkez:step', handler);
    return () => { socket.off('robotkez:step', handler); };
  }, [socket]);

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
      console.error('[RobotkezV2Chat] Refresh error:', err instanceof Error ? err.message : String(err));
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

    const thinkingPhrases = [
      'Böngésző indul...',
      'Oldalt elemzem...',
      'DOM fát olvasom...',
      'Kattintási célpontokat keresek...',
      'Még egy kis türelmet...'
    ];
    let phraseIdx = 0;
    const thinkingInterval = setInterval(() => {
      setThinkingText(thinkingPhrases[phraseIdx % thinkingPhrases.length]);
      phraseIdx++;
    }, 1500);

    try {
      const result = await api.robotkezChat(text);
      clearInterval(thinkingInterval);

      // Check if task was delegated to background
      if (result.data?.taskId) {
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: result.message || `🚀 Rendben, felpörgetem a böngészőt (ID: ${result.data.taskId}).`,
          timestamp: Date.now(),
          taskId: result.data.taskId,
          plan: result.data.plan,
          backgroundTask: true
        }]);
        toast.info('🚀 Robotkéz elindult a háttérben!');
      } else {
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: result.message || (result.success ? '✅ Meg is oldottam!' : '⚠️ Problémába ütköztem.'),
          timestamp: Date.now(),
          screenshot: result.data?.screenshot
        }]);
        toast.success('✨ Feladat elvégezve');
      }
    } catch (e: unknown) {
      clearInterval(thinkingInterval);
      const msg = e instanceof Error ? e.message : 'Hiba történt';
      toast.error(`❌ ${msg}`);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `❌ Ajjaj, hiba csúszott a folyamatba: ${msg}`,
        timestamp: Date.now()
      }]);
    } finally {
      setIsLoading(false);
      setThinkingText('Gondolkodom...');
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
              {status?.browser.engine && (
                <Badge
                  variant="outline"
                  className={
                    status.browser.engine.toLowerCase().includes('cloudflare')
                      ? 'bg-blue-500/10 text-blue-400 border-blue-400/40'
                      : 'bg-zinc-500/10 text-zinc-300 border-zinc-400/30'
                  }
                >
                  {status.browser.engine.toLowerCase().includes('cloudflare') ? '☁ CF Browser' : '🖥 Local'}
                </Badge>
              )}
              <Button variant="ghost" size="icon" onClick={refreshData} title="Frissítés" aria-label="Adatok frissítése">
                <RefreshCw className="w-4 h-4" />
              </Button>
            </div>
          </CardHeader>

          {/* Mode Switcher Tab Bar */}
          <div className="flex border-b border-border/50 bg-background/30">
            <button
              onClick={() => setViewMode('chat')}
              className={`flex items-center gap-1.5 px-4 py-2 text-xs font-medium transition-colors ${
                viewMode === 'chat'
                  ? 'border-b-2 border-primary text-primary bg-primary/5'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Bot className="w-3.5 h-3.5" />
              Böngésző Chat
            </button>
            <button
              onClick={() => setViewMode('computer')}
              className={`flex items-center gap-1.5 px-4 py-2 text-xs font-medium transition-colors ${
                viewMode === 'computer'
                  ? 'border-b-2 border-primary text-primary bg-primary/5'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Monitor className="w-3.5 h-3.5" />
              Gépi Vezérlés
            </button>
            <button
              onClick={() => setViewMode('devtools')}
              className={`flex items-center gap-1.5 px-4 py-2 text-xs font-medium transition-colors ${
                viewMode === 'devtools'
                  ? 'border-b-2 border-primary text-primary bg-primary/5'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Bug className="w-3.5 h-3.5" />
              DevTools
            </button>
          </div>

          <CardContent className="flex-1 flex flex-col min-h-0 p-0">
            {/* === CHAT MÓD === */}
            {viewMode === 'chat' && (<>
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
                        className={`rounded-2xl px-4 py-2.5 text-sm shadow-sm ${msg.role === 'user'
                            ? 'bg-primary text-primary-foreground font-medium'
                            : 'bg-muted/50 border border-border/50 text-foreground'
                          }`}
                      >
                        <p className="whitespace-pre-wrap leading-relaxed">
                          {msg.content}
                        </p>
                        {msg.screenshot && (
                          <div className="mt-2 rounded-lg overflow-hidden border border-border/50 bg-black/20">
                            <img
                              src={msg.screenshot.startsWith('data:') ? msg.screenshot : `data:image/png;base64,${msg.screenshot}`}
                              alt="Screenshot"
                              className="w-full h-auto cursor-zoom-in hover:scale-[1.02] transition-transform"
                              onClick={() => window.open(msg.screenshot?.startsWith('data:') ? msg.screenshot : `data:image/png;base64,${msg.screenshot}`, '_blank')}
                            />
                          </div>
                        )}
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
                      <p className="text-sm text-muted-foreground animate-pulse">
                        {thinkingText}
                      </p>
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
            </>)}

            {/* === GÉPI VEZÉRLÉS MÓD === */}
            {viewMode === 'computer' && (
              <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
                {/* OS Képernyő (kattintható) */}
                <div className="flex-1 bg-black min-h-0 relative overflow-hidden">
                  {computerLoading && (
                    <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-10">
                      <Loader className="w-6 h-6 text-primary animate-spin" />
                    </div>
                  )}
                  {computerScreenB64 ? (
                    <img
                      src={`data:image/png;base64,${computerScreenB64}`}
                      alt="Képernyő"
                      className="w-full h-full object-contain cursor-crosshair"
                      onClick={handleComputerImageClick}
                      title="Kattints ide a képernyőn való kattintáshoz"
                    />
                  ) : (
                    <div className="flex items-center justify-center h-full text-muted-foreground flex-col gap-2">
                      <Monitor className="w-8 h-8 opacity-20" />
                      <span className="text-xs uppercase tracking-widest opacity-50">
                        Képernyő betöltése...
                      </span>
                    </div>
                  )}
                </div>

                {/* Vezérlők */}
                <div className="p-3 border-t border-border/50 space-y-2 bg-background/80">
                  {/* Gépelés sor */}
                  <div className="flex gap-2">
                    <div className="flex items-center gap-1 text-muted-foreground shrink-0">
                      <Keyboard className="w-4 h-4" />
                    </div>
                    <input
                      type="text"
                      value={typeText}
                      onChange={e => setTypeText(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleComputerType()}
                      placeholder="Begépelendő szöveg (Enter = küld)"
                      className="flex-1 bg-background/50 border border-border/50 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary/50"
                      disabled={computerLoading}
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleComputerType}
                      disabled={!typeText.trim() || computerLoading}
                    >
                      <Send className="w-3 h-3" />
                    </Button>
                  </div>

                  {/* Vision kattintás sor */}
                  <div className="flex gap-2">
                    <div className="flex items-center gap-1 text-muted-foreground shrink-0">
                      <Crosshair className="w-4 h-4" />
                    </div>
                    <input
                      type="text"
                      value={visionDesc}
                      onChange={e => setVisionDesc(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleVisionClick()}
                      placeholder="Vision kattintás: pl. 'Start gomb', 'Böngésző ikon'"
                      className="flex-1 bg-background/50 border border-border/50 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary/50"
                      disabled={computerLoading}
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleVisionClick}
                      disabled={!visionDesc.trim() || computerLoading}
                    >
                      <MousePointer className="w-3 h-3" />
                    </Button>
                  </div>

                  {/* Autonóm feladat sor (Comet Orchestrator) */}
                  <div className="flex gap-2">
                    <div className="flex items-center gap-1 text-muted-foreground shrink-0">
                      <Bot className="w-4 h-4" />
                    </div>
                    <input
                      type="text"
                      value={autoTaskInput}
                      onChange={e => setAutoTaskInput(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleAutoTask()}
                      placeholder="Autonóm feladat: pl. 'Keress rá a Google-on az AI hírekre'"
                      className="flex-1 bg-background/50 border border-border/50 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary/50"
                      disabled={autoTaskRunning}
                    />
                    <Button
                      size="sm"
                      variant={autoTaskRunning ? 'secondary' : 'default'}
                      onClick={handleAutoTask}
                      disabled={!autoTaskInput.trim() || autoTaskRunning}
                    >
                      {autoTaskRunning ? <Loader className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                    </Button>
                  </div>

                  {/* Training vezérlés */}
                  <div className="flex gap-2 items-center pt-1 border-t border-border/30">
                    <span className="text-[10px] text-muted-foreground shrink-0 uppercase tracking-wider">Tréning:</span>
                    <select
                      value={trainingMode}
                      onChange={e => setTrainingMode(e.target.value as 'basic' | 'workflows')}
                      className="bg-background/50 border border-border/50 rounded px-2 py-1 text-xs focus:outline-none"
                      disabled={trainingRunning}
                    >
                      <option value="basic">Alapfeladatok</option>
                      <option value="workflows">n8n Workflow Builder</option>
                    </select>
                    <Button
                      size="sm"
                      variant={trainingRunning ? 'destructive' : 'default'}
                      onClick={handleTrainingToggle}
                      className="text-xs"
                    >
                      {trainingRunning ? '⏹ Leállítás' : '▶ Indítás'}
                    </Button>
                    {trainingRunning && (
                      <Badge variant="secondary" className="bg-green-500/20 text-green-500 text-[10px] animate-pulse">
                        Fut
                      </Badge>
                    )}
                  </div>

                  {/* Eseménynapló */}
                  {computerLog.length > 0 && (
                    <div className="max-h-[72px] overflow-y-auto space-y-0.5">
                      {computerLog.map((entry, i) => (
                        <p key={i} className="text-[10px] text-muted-foreground font-mono truncate">{entry}</p>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* === DEVTOOLS MÓD === */}
            {viewMode === 'devtools' && (
              <div className="flex-1 flex flex-col min-h-0 overflow-auto">
                {/* URL input + Futtatás */}
                <div className="p-4 border-b border-border/50 space-y-3">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={devtoolsUrl}
                      onChange={e => setDevtoolsUrl(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleDevToolsRun()}
                      placeholder="URL (pl. http://localhost:5173)"
                      className="flex-1 bg-background/50 border border-border/50 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary/50"
                      disabled={devtoolsLoading}
                    />
                    <Button
                      onClick={handleDevToolsRun}
                      disabled={!devtoolsUrl.trim() || devtoolsLoading}
                    >
                      {devtoolsLoading ? <Loader className="w-4 h-4 animate-spin" /> : <Bug className="w-4 h-4" />}
                      <span className="ml-1.5">Elemzés</span>
                    </Button>
                  </div>
                  <p className="text-[10px] text-muted-foreground">
                    Hálózati kérések, JS hibák és teljesítmény metrikák elemzése Playwright CDP-vel
                  </p>
                </div>

                {/* Eredmények */}
                <div className="flex-1 overflow-auto p-4 space-y-4">
                  {devtoolsLoading && (
                    <div className="flex flex-col items-center justify-center py-12 gap-3">
                      <Loader className="w-8 h-8 text-primary animate-spin" />
                      <p className="text-sm text-muted-foreground">Elemzés folyamatban... (böngésző indítás + adatgyűjtés)</p>
                    </div>
                  )}

                  {devtoolsReport && !devtoolsLoading && (
                    <>
                      {/* Összefoglaló kártyák */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        <div className="bg-muted/30 border border-border/30 rounded-lg p-3 text-center">
                          <p className="text-lg font-bold">{devtoolsReport.performance.pageLoadTime.toFixed(0)}</p>
                          <p className="text-[10px] text-muted-foreground uppercase">Page Load (ms)</p>
                        </div>
                        <div className="bg-muted/30 border border-border/30 rounded-lg p-3 text-center">
                          <p className="text-lg font-bold">{devtoolsReport.performance.firstContentfulPaint.toFixed(0)}</p>
                          <p className="text-[10px] text-muted-foreground uppercase">FCP (ms)</p>
                        </div>
                        <div className={`border rounded-lg p-3 text-center ${devtoolsReport.console.errors.length > 0 ? 'bg-red-500/10 border-red-500/30' : 'bg-muted/30 border-border/30'}`}>
                          <p className="text-lg font-bold">{devtoolsReport.console.errors.length}</p>
                          <p className="text-[10px] text-muted-foreground uppercase">JS Hibák</p>
                        </div>
                        <div className={`border rounded-lg p-3 text-center ${devtoolsReport.network.failedRequests > 0 ? 'bg-orange-500/10 border-orange-500/30' : 'bg-muted/30 border-border/30'}`}>
                          <p className="text-lg font-bold">{devtoolsReport.network.failedRequests}</p>
                          <p className="text-[10px] text-muted-foreground uppercase">Hálózati Hiba</p>
                        </div>
                      </div>

                      {/* Összefoglaló szöveg */}
                      <div className="bg-muted/20 border border-border/30 rounded-lg p-3">
                        <p className="text-xs whitespace-pre-wrap">{devtoolsReport.summary}</p>
                      </div>

                      {/* JS Hibák */}
                      {devtoolsReport.console.errors.length > 0 && (
                        <div>
                          <h4 className="text-xs font-semibold mb-2 text-red-500">JS Hibák ({devtoolsReport.console.errors.length})</h4>
                          <div className="space-y-1">
                            {devtoolsReport.console.errors.map((err, i) => (
                              <div key={i} className="bg-red-500/5 border border-red-500/20 rounded p-2 text-[11px] font-mono">
                                <span className="text-red-400">{err.message}</span>
                                {err.source && <span className="text-muted-foreground ml-2">@ {err.source}{err.line ? `:${err.line}` : ''}</span>}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Figyelmeztetések */}
                      {devtoolsReport.console.warnings.length > 0 && (
                        <div>
                          <h4 className="text-xs font-semibold mb-2 text-yellow-500">Figyelmeztetések ({devtoolsReport.console.warnings.length})</h4>
                          <div className="space-y-1">
                            {devtoolsReport.console.warnings.slice(0, 5).map((w, i) => (
                              <p key={i} className="text-[11px] font-mono text-yellow-400 truncate">{w.message}</p>
                            ))}
                            {devtoolsReport.console.warnings.length > 5 && (
                              <p className="text-[10px] text-muted-foreground">...és még {devtoolsReport.console.warnings.length - 5} további</p>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Hálózati hibák */}
                      {devtoolsReport.network.failedRequestsList.length > 0 && (
                        <div>
                          <h4 className="text-xs font-semibold mb-2 text-orange-500">Sikertelen Kérések ({devtoolsReport.network.failedRequestsList.length})</h4>
                          <div className="space-y-1">
                            {devtoolsReport.network.failedRequestsList.map((req, i) => (
                              <div key={i} className="text-[11px] font-mono truncate">
                                <span className="text-orange-400">{req.url}</span>
                                <span className="text-muted-foreground"> — {req.error}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Hálózati összesítés */}
                      <div>
                        <h4 className="text-xs font-semibold mb-2">Hálózat ({devtoolsReport.network.totalRequests} kérés)</h4>
                        <div className="text-[11px] text-muted-foreground">
                          {devtoolsReport.network.requests
                            .sort((a, b) => b.duration - a.duration)
                            .slice(0, 5)
                            .map((r, i) => (
                              <div key={i} className="flex justify-between py-0.5 border-b border-border/20">
                                <span className="truncate flex-1 mr-2">{r.url.length > 60 ? r.url.slice(0, 57) + '...' : r.url}</span>
                                <span className="shrink-0 font-mono">{r.status} {r.duration.toFixed(0)}ms</span>
                              </div>
                            ))}
                        </div>
                      </div>
                    </>
                  )}

                  {!devtoolsReport && !devtoolsLoading && (
                    <div className="flex flex-col items-center justify-center py-12 text-center space-y-3">
                      <Bug className="w-8 h-8 text-muted-foreground opacity-20" />
                      <p className="text-xs text-muted-foreground">Adj meg egy URL-t és kattints az Elemzés gombra</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Execution Timeline */}
        {activePlan && (
          <Card className="glass-card border-border/50 bg-background/50 backdrop-blur-xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm font-medium">
                <Activity className="w-4 h-4 text-primary" />
                🔥 Lépésről-lépésre Terv ({activePlan.plan.length} lépés)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {activePlan.plan.map((step, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-3 p-2 rounded bg-muted/30 border border-border/30 transition-all hover:bg-muted"
                  >
                    {getStepIcon(currentStep === i ? 'running' : currentStep > i ? 'completed' : 'pending')}
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="outline" className="text-[10px] leading-none text-blue-500 border-blue-500/30 bg-blue-500/10">
                          {step.action}
                        </Badge>
                      </div>
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
              aria-label={showBrowserView ? 'Élő nézet elrejtése' : 'Élő nézet megjelenítése'}
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
                            title="Folyamat leállítása"
                            aria-label="Folyamat leállítása"
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
