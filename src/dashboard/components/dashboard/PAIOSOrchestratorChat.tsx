/**
 * PAIOS Orchestrator Chat - Magyar AI Operating System Interface
 *
 * Features:
 * - Magyar természetes nyelvű chat (feladat dekompozíció)
 * - Execution Plan megjelenítése (fázisok: design → implementation → test)
 * - Task Queue monitoring (AgentManager delegált taskek)
 * - Socket.IO real-time updates (paios:tasks_created event)
 * - Model selector (Gemini, GPT-4o, Local, Workers AI)
 *
 * @track paios_orchestrator_chat_20260223
 * @phase Phase 3 - Dashboard UI
 */

import { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import {
    Send,
    User,
    Bot,
    CheckCircle2,
    Loader2,
    Circle,
    Brain,
    Zap,
    Cpu,
    Cloud,
    Mic,
    Volume2
} from 'lucide-react';
import { toast } from 'sonner';
import { useSocket } from '@/context/SocketContext';

interface PlanStep {
    phase: string;
    agent: string;
    task: string;
}

interface ActionTriggered {
    agent: string;
    task: string;
    taskId: number;
    status: 'started' | 'completed' | 'error';
}

interface ChatMessage {
    role: 'user' | 'assistant';
    content: string;
    timestamp: number;
    plan?: PlanStep[];
    taskIds?: number[];
    actionsTriggered?: ActionTriggered[];
    thinkingMs?: number;
    error?: boolean;
}

type UniversalProvider = 'gemini' | 'github' | 'claude' | 'cloudflare' | 'ollama';

interface ModelOption {
    value: UniversalProvider;
    label: string;
    icon: typeof Brain;
    color: string;
}

const MODEL_OPTIONS: ModelOption[] = [
    { value: 'gemini', label: 'Gemini ★', icon: Brain, color: 'text-blue-500' },
    { value: 'github', label: 'GitHub Models ★', icon: Cloud, color: 'text-purple-500' },
    { value: 'claude', label: 'Claude ★', icon: Zap, color: 'text-orange-500' },
    { value: 'cloudflare', label: 'Cloudflare Edge ★', icon: Cpu, color: 'text-yellow-500' },
    { value: 'ollama', label: 'Qwen (helyi)', icon: Cpu, color: 'text-green-500' },
];

export function PAIOSOrchestratorChat() {
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [selectedModel, setSelectedModel] = useState<UniversalProvider>('gemini');
    const scrollRef = useRef<HTMLDivElement>(null);
    const { socket } = useSocket();

    const [isListening, setIsListening] = useState(false);
    const [isSpeaking, setIsSpeaking] = useState(false);
    const audioRef = useRef<HTMLAudioElement | null>(null);

    const startListening = () => {
        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (!SpeechRecognition) {
            toast.error("A böngésződ nem támogatja a hangfelismerést.");
            return;
        }
        
        const recognition = new SpeechRecognition();
        recognition.lang = 'hu-HU';
        recognition.interimResults = false;
        recognition.maxAlternatives = 1;

        recognition.onstart = () => {
            setIsListening(true);
            toast.info("Figyelek...");
        };

        recognition.onresult = (event: any) => {
            const transcript = event.results[0][0].transcript;
            setInput(transcript);
            toast.success("Sikeres hangfelismerés.");
        };

        recognition.onerror = (event: any) => {
            console.error("Speech recognition error", event.error);
            setIsListening(false);
            toast.error("Hiba a hangfelismerés során.");
        };

        recognition.onend = () => {
            setIsListening(false);
        };

        recognition.start();
    };

    const playTTS = async (text: string) => {
        try {
            setIsSpeaking(true);
            const response = await fetch('/api/v1/voice/tts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text })
            });
            const data = await response.json();
            if (data.url) {
                if (audioRef.current) {
                    audioRef.current.pause();
                }
                const audio = new Audio(data.url);
                audioRef.current = audio;
                audio.onended = () => setIsSpeaking(false);
                audio.play();
            } else {
                setIsSpeaking(false);
            }
        } catch (e) {
            console.error('TTS error', e);
            setIsSpeaking(false);
        }
    };

    // Auto-scroll to bottom
    useEffect(() => {
        scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // Socket.IO listener for real-time task updates
    useEffect(() => {
        if (!socket) return;

        const handleTasksCreated = (data: {
            summary: string;
            taskIds: number[];
            plan: PlanStep[];
            timestamp: string;
        }) => {
            toast.success(`✨ ${data.taskIds.length} task delegálva`);
            // Optionally update last message with task IDs
            setMessages(prev => {
                const updated = [...prev];
                const lastMsg = updated[updated.length - 1];
                if (lastMsg && lastMsg.role === 'assistant') {
                    lastMsg.taskIds = data.taskIds;
                }
                return updated;
            });
        };

        socket.on('paios:tasks_created', handleTasksCreated);
        return () => {
            socket.off('paios:tasks_created', handleTasksCreated);
        };
    }, [socket]);

    // Send chat message
    const sendMessage = async () => {
        const text = input.trim();
        if (!text || isLoading) return;

        setInput('');
        const userMsg: ChatMessage = {
            role: 'user',
            content: text,
            timestamp: Date.now(),
        };
        setMessages(prev => [...prev, userMsg]);
        setIsLoading(true);

        try {
            const history = messages.map(m => ({ role: m.role, content: m.content }));
            const response = await fetch('/api/orchestrator/universal', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: text,
                    provider: selectedModel,
                    conversationHistory: history,
                }),
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const result = await response.json() as {
                reply: string;
                actionsTriggered: ActionTriggered[];
                provider: string;
                thinkingMs: number;
            };

            const assistantMsg: ChatMessage = {
                role: 'assistant',
                content: result.reply,
                timestamp: Date.now(),
                actionsTriggered: result.actionsTriggered,
                thinkingMs: result.thinkingMs,
            };
            setMessages(prev => [...prev, assistantMsg]);

            if (result.actionsTriggered?.length > 0) {
                toast.success(`🔧 ${result.actionsTriggered.length} feladat delegálva`);
            } else {
                toast.success('✅ Brunella válaszolt');
            }
            playTTS(result.reply);
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : 'Hiba történt';
            toast.error(`❌ ${msg}`);
            setMessages(prev => [
                ...prev,
                {
                    role: 'assistant',
                    content: `❌ Hiba: ${msg}`,
                    timestamp: Date.now(),
                    error: true,
                },
            ]);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Card className="h-full flex flex-col">
            <CardHeader className="border-b">
                <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                        <Brain className="w-5 h-5 text-blue-500" />
                        PAIOS Orchestrator Chat
                    </CardTitle>
                    {/* Model Selector */}
                    <div className="flex gap-1">
                        {MODEL_OPTIONS.map(model => {
                            const Icon = model.icon;
                            const isActive = selectedModel === model.value;
                            return (
                                <Button
                                    key={model.value}
                                    variant={isActive ? 'default' : 'outline'}
                                    size="sm"
                                    onClick={() => setSelectedModel(model.value)}
                                    className="gap-1"
                                    title={model.label}
                                >
                                    <Icon className={`w-3 h-3 ${isActive ? 'text-white' : model.color}`} />
                                    <span className="hidden sm:inline text-xs">{model.label.split(' ')[0]}</span>
                                </Button>
                            );
                        })}
                    </div>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                    Magyar természetes nyelv → {selectedModel.toUpperCase()} dönt → 47 agent vagy Cloudflare Worker
                </p>
            </CardHeader>

            <CardContent className="flex-1 flex flex-col p-0 overflow-hidden">
                {/* Chat Messages */}
                <ScrollArea className="flex-1 p-4">
                    <div className="space-y-4">
                        {messages.length === 0 && (
                            <div className="text-center text-muted-foreground py-8">
                                <Brain className="w-12 h-12 mx-auto mb-2 opacity-50" />
                                <p className="text-sm">Adj egy feladatot magyarul...</p>
                                <p className="text-xs mt-2 opacity-70">
                                    Példa: "Készíts egy új API endpointot TDD-vel"
                                </p>
                            </div>
                        )}
                        {messages.map((msg, idx) => (
                            <div
                                key={idx}
                                className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                            >
                                {msg.role === 'assistant' && (
                                    <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center flex-shrink-0">
                                        <Bot className="w-4 h-4 text-white" />
                                    </div>
                                )}
                                <div
                                    className={`max-w-[80%] rounded-lg p-3 ${msg.role === 'user'
                                            ? 'bg-primary text-primary-foreground'
                                            : msg.error
                                                ? 'bg-red-100 dark:bg-red-950 border border-red-300 dark:border-red-800'
                                                : 'bg-muted'
                                        }`}
                                >
                                    <p className="text-sm whitespace-pre-wrap">{msg.content}</p>

                                    {/* Execution Plan */}
                                    {msg.plan && msg.plan.length > 0 && (
                                        <div className="mt-3 space-y-2 border-t pt-2">
                                            <p className="text-xs font-semibold opacity-70">📋 Execution Plan:</p>
                                            {msg.plan.map((step, i) => (
                                                <div key={i} className="flex items-start gap-2 text-xs">
                                                    <Badge variant="outline" className="shrink-0">
                                                        {step.phase}
                                                    </Badge>
                                                    <div className="flex-1">
                                                        <span className="font-medium">{step.agent}</span>
                                                        <span className="opacity-70"> → {step.task}</span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {/* Task IDs */}
                                    {msg.taskIds && msg.taskIds.length > 0 && (
                                        <div className="mt-2 flex flex-wrap gap-1">
                                            <span className="text-xs opacity-70">🎯 Tasks:</span>
                                            {msg.taskIds.map(id => (
                                                <Badge key={id} variant="secondary" className="text-xs">
                                                    #{id}
                                                </Badge>
                                            ))}
                                        </div>
                                    )}

                                    {/* Action Bubbles — universal orchestrator delegations */}
                                    {msg.actionsTriggered && msg.actionsTriggered.length > 0 && (
                                        <div className="mt-3 space-y-2 border-t pt-2">
                                            {msg.actionsTriggered.map((action, i) => (
                                                <div key={i} className="flex items-start gap-2 rounded-md border border-blue-500/30 bg-blue-500/10 p-2 text-xs">
                                                    <CheckCircle2 className="mt-0.5 h-3 w-3 shrink-0 text-blue-400" />
                                                    <div className="flex-1 min-w-0">
                                                        <span className="font-semibold text-blue-300">Delegálva → {action.agent}</span>
                                                        <p className="opacity-80 truncate mt-0.5">{action.task}</p>
                                                        <div className="flex items-center gap-1 mt-1">
                                                            <Badge variant="outline" className="text-[10px] px-1 py-0 border-blue-500/40 text-blue-300">
                                                                #{action.taskId}
                                                            </Badge>
                                                            <span className="opacity-60">{action.status}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    <p className="text-xs opacity-50 mt-2">
                                        {new Date(msg.timestamp).toLocaleTimeString('hu-HU')}
                                    </p>
                                </div>
                                {msg.role === 'user' && (
                                    <div className="w-8 h-8 rounded-full bg-gray-700 dark:bg-gray-600 flex items-center justify-center flex-shrink-0">
                                        <User className="w-4 h-4 text-white" />
                                    </div>
                                )}
                            </div>
                        ))}
                        <div ref={scrollRef} />
                    </div>
                </ScrollArea>

                {/* Input Area */}
                <div className="border-t p-4 bg-background">
                    <div className="flex gap-2">
                        <Textarea
                            value={input}
                            onChange={e => setInput(e.target.value)}
                            onKeyDown={e => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                    sendMessage();
                                }
                            }}
                            placeholder="Írd be a feladatot magyarul... (Enter = küldés, Shift+Enter = új sor)"
                            className="resize-none min-h-[60px]"
                            disabled={isLoading}
                        />
                        <Button
                            onClick={startListening}
                            variant="outline"
                            size="icon"
                            className={`self-end transition-all duration-300 ${isListening ? 'bg-red-500/20 text-red-500 border-red-500/50 animate-pulse' : ''}`}
                            title="Hangutasítás (Magyar)"
                        >
                            {isSpeaking ? <Volume2 className="w-4 h-4 animate-bounce text-primary" /> : <Mic className={`w-4 h-4 ${isListening ? 'text-red-500' : ''}`} />}
                        </Button>
                        <Button
                            onClick={sendMessage}
                            disabled={!input.trim() || isLoading}
                            className="self-end"
                        >
                            {isLoading ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                                <Send className="w-4 h-4" />
                            )}
                        </Button>
                    </div>
                    {isLoading && (
                        <p className="text-xs text-muted-foreground mt-2 animate-pulse">
                            ⟳ {selectedModel.toUpperCase()} gondolkodik...
                        </p>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}
