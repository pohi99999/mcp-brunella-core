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

interface ChatMessage {
    role: 'user' | 'assistant';
    content: string;
    timestamp: number;
    plan?: PlanStep[];
    taskIds?: number[];
    error?: boolean;
}

type ModelProvider = 'gemini' | 'github' | 'ollama' | 'anthropic';

interface ModelOption {
    value: ModelProvider;
    label: string;
    icon: typeof Brain;
    color: string;
}

const MODEL_OPTIONS: ModelOption[] = [
    { value: 'gemini', label: 'Gemini 2.0 Flash', icon: Brain, color: 'text-blue-500' },
    { value: 'github', label: 'GPT-4o (GitHub)', icon: Cloud, color: 'text-purple-500' },
    { value: 'ollama', label: 'Qwen 2.5 Coder (Local)', icon: Cpu, color: 'text-green-500' },
    { value: 'anthropic', label: 'Claude Sonnet', icon: Zap, color: 'text-orange-500' },
];

export function PAIOSOrchestratorChat() {
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [selectedModel, setSelectedModel] = useState<ModelProvider>('gemini');
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
            const response = await fetch('/api/paios/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: text,
                    model: selectedModel,
                }),
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const result = await response.json();

            if (result.success) {
                setMessages(prev => [
                    ...prev,
                    {
                        role: 'assistant',
                        content: result.summary,
                        timestamp: Date.now(),
                        plan: result.plan,
                        taskIds: result.taskIds,
                    },
                ]);
                toast.success('✅ Orchestrator válaszolt');
                playTTS(result.summary);
            } else {
                throw new Error(result.error || 'Unknown error');
            }
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
                    Magyar nyelvű feladat → LLM dekompozíció → AgentManager végrehajtás
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
                            ⏳ Orchestrator gondolkodik...
                        </p>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}
