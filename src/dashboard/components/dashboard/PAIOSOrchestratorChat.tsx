/**
 * PAIOS Orchestrator Chat - Magyar AI Operating System Interface
 *
 * @track orchestrator_chat_upgrade_20260320
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
    Loader2,
    Brain,
    Zap,
    Cpu,
    Cloud,
    Mic,
    Volume2,
    RefreshCw,
} from 'lucide-react';
import { toast } from 'sonner';
import { useSocket } from '@/context/SocketContext';
import { getLLMModelCatalog, type LLMCatalogProvider } from '@/lib/apiService';

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

interface MissionTimelineEntry {
    phase: string;
    status: 'info' | 'started' | 'completed' | 'blocked';
    detail: string;
    timestamp: string;
    agent?: string;
    taskId?: number;
}

interface ChatMessage {
    role: 'user' | 'assistant';
    content: string;
    timestamp: number;
    plan?: PlanStep[];
    taskIds?: number[];
    actionsTriggered?: ActionTriggered[];
    provider?: string;
    model?: string;
    roleLabel?: string;
    thinkingMs?: number;
    suggestions?: string[];
    missionTimeline?: MissionTimelineEntry[];
    approvalRequired?: boolean;
    approvalId?: string;
    riskLevel?: 'low' | 'high';
    runbookHint?: string;
    fallbackUsed?: boolean;
    fallbackReason?: string;
    phoenixTriggered?: boolean;
    error?: boolean;
}

interface PaiosChatResponse {
    success?: boolean;
    summary?: string;
    reply?: string;
    plan?: PlanStep[];
    taskIds?: number[];
    actionsTriggered?: ActionTriggered[];
    provider?: string;
    model?: string;
    role?: string;
    thinkingMs?: number;
    sessionId?: string;
    suggestions?: string[];
    missionTimeline?: MissionTimelineEntry[];
    approvalRequired?: boolean;
    approvalId?: string;
    riskLevel?: 'low' | 'high';
    runbookHint?: string;
    fallbackUsed?: boolean;
    fallbackReason?: string;
    phoenixTriggered?: boolean;
    error?: string;
}

type ModelProvider = 'gemini' | 'github' | 'ollama' | 'anthropic' | 'cloudflare';

interface BrowserSpeechRecognitionResultEvent {
    results: ArrayLike<ArrayLike<{ transcript: string }>>;
}

interface BrowserSpeechRecognition {
    lang: string;
    interimResults: boolean;
    maxAlternatives: number;
    onstart: (() => void) | null;
    onresult: ((event: BrowserSpeechRecognitionResultEvent) => void) | null;
    onerror: (() => void) | null;
    onend: (() => void) | null;
    start: () => void;
}

interface SpeechRecognitionCapableWindow extends Window {
    SpeechRecognition?: new () => BrowserSpeechRecognition;
    webkitSpeechRecognition?: new () => BrowserSpeechRecognition;
}

interface ProviderVisual {
    label: string;
    icon: typeof Brain;
    color: string;
    defaultModel: string;
    fallbackModels: string[];
}

const PROVIDER_VISUALS: Record<ModelProvider, ProviderVisual> = {
    github: {
        label: 'GitHub Models',
        icon: Cloud,
        color: 'text-purple-500',
        defaultModel: 'gpt-4.1',
        fallbackModels: ['gpt-4.1', 'gpt-4.1-mini', 'gpt-4o', 'o3-mini', 'o1-mini'],
    },
    gemini: {
        label: 'Google Gemini',
        icon: Brain,
        color: 'text-blue-500',
        defaultModel: 'gemini-2.5-flash',
        fallbackModels: ['gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-2.0-flash'],
    },
    anthropic: {
        label: 'Anthropic Claude',
        icon: Zap,
        color: 'text-orange-500',
        defaultModel: 'claude-3-5-sonnet-20241022',
        fallbackModels: ['claude-3-5-sonnet-20241022', 'claude-3-5-haiku-20241022'],
    },
    cloudflare: {
        label: 'Cloudflare AI',
        icon: Cloud,
        color: 'text-cyan-500',
        defaultModel: '@cf/meta/llama-3.3-70b-instruct',
        fallbackModels: ['@cf/meta/llama-3.3-70b-instruct', '@cf/meta/llama-3.1-8b-instruct'],
    },
    ollama: {
        label: 'Ollama Local',
        icon: Cpu,
        color: 'text-green-500',
        defaultModel: 'qwen2.5-coder:7b',
        fallbackModels: ['qwen2.5-coder:7b', 'llama3.1:8b', 'deepseek-r1:8b'],
    },
};

const FALLBACK_PROVIDER_CATALOG: LLMCatalogProvider[] = (Object.entries(PROVIDER_VISUALS) as Array<[ModelProvider, ProviderVisual]>).map(([id, visual]) => ({
    id,
    label: visual.label,
    enabled: true,
    defaultModel: visual.defaultModel,
    models: visual.fallbackModels.map((name) => ({
        id: name,
        name,
        provider: id,
        source: 'default' as const,
    })),
}));

function isModelProvider(value: string): value is ModelProvider {
    return value in PROVIDER_VISUALS;
}

const SESSION_STORAGE_KEY = 'paios_orchestrator_session_id';

function createSessionId(): string {
    const randomPart = Math.random().toString(36).slice(2, 10);
    return `dashboard-${Date.now()}-${randomPart}`;
}

export function PAIOSOrchestratorChat() {
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [providerCatalog, setProviderCatalog] = useState<LLMCatalogProvider[]>(FALLBACK_PROVIDER_CATALOG);
    const [selectedProvider, setSelectedProvider] = useState<ModelProvider>('github');
    const [selectedModel, setSelectedModel] = useState<string>(PROVIDER_VISUALS.github.defaultModel);
    const [sessionId, setSessionId] = useState<string>(() => {
        if (typeof window === 'undefined') {
            return createSessionId();
        }

        const existing = window.sessionStorage.getItem(SESSION_STORAGE_KEY);
        if (existing) {
            return existing;
        }

        const generated = createSessionId();
        window.sessionStorage.setItem(SESSION_STORAGE_KEY, generated);
        return generated;
    });
    const scrollRef = useRef<HTMLDivElement>(null);
    const { socket } = useSocket();

    const [isListening, setIsListening] = useState(false);
    const [isSpeaking, setIsSpeaking] = useState(false);
    const audioRef = useRef<HTMLAudioElement | null>(null);

    useEffect(() => {
        let isMounted = true;

        void (async () => {
            try {
                const catalog = await getLLMModelCatalog();
                const supportedProviders = catalog.providers.filter((provider): provider is LLMCatalogProvider & { id: ModelProvider } =>
                    isModelProvider(provider.id) && (provider.enabled || provider.id === 'ollama'),
                );

                if (isMounted && supportedProviders.length > 0) {
                    setProviderCatalog(supportedProviders);
                }
            } catch {
                // Csendes fallback a lokális alaplistára
            }
        })();

        return () => {
            isMounted = false;
        };
    }, []);

    useEffect(() => {
        const providerEntry = providerCatalog.find((provider) => provider.id === selectedProvider);
        if (!providerEntry) {
            setSelectedModel(PROVIDER_VISUALS[selectedProvider].defaultModel);
            return;
        }

        const availableModels = providerEntry.models.map((model) => model.name);
        if (!availableModels.includes(selectedModel)) {
            setSelectedModel(providerEntry.defaultModel || availableModels[0] || PROVIDER_VISUALS[selectedProvider].defaultModel);
        }
    }, [selectedProvider, selectedModel, providerCatalog]);

    const activeProviderCatalog = providerCatalog.find((provider) => provider.id === selectedProvider)
        ?? FALLBACK_PROVIDER_CATALOG.find((provider) => provider.id === selectedProvider)
        ?? FALLBACK_PROVIDER_CATALOG[0];

    const startListening = () => {
        const speechWindow = window as SpeechRecognitionCapableWindow;
        const SpeechRecognition = speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            toast.error('A böngésződ nem támogatja a hangfelismerést.');
            return;
        }

        const recognition = new SpeechRecognition();
        recognition.lang = 'hu-HU';
        recognition.interimResults = false;
        recognition.maxAlternatives = 1;

        recognition.onstart = () => {
            setIsListening(true);
            toast.info('Figyelek...');
        };

        recognition.onresult = (event: BrowserSpeechRecognitionResultEvent) => {
            const transcript = event.results[0][0].transcript;
            setInput(transcript);
            toast.success('Sikeres hangfelismerés.');
        };

        recognition.onerror = () => {
            setIsListening(false);
            toast.error('Hiba a hangfelismerés során.');
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
                body: JSON.stringify({ text }),
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
        } catch {
            setIsSpeaking(false);
        }
    };

    useEffect(() => {
        scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    useEffect(() => {
        if (!socket) return;

        const handleTasksCreated = (data: {
            summary: string;
            taskIds: number[];
            plan: PlanStep[];
            actionsTriggered?: ActionTriggered[];
            timestamp: string;
        }) => {
            toast.success(`✨ ${data.taskIds.length} task delegálva`);
            setMessages((prev) => {
                const updated = [...prev];
                const lastMsg = updated[updated.length - 1];
                if (lastMsg && lastMsg.role === 'assistant') {
                    lastMsg.taskIds = data.taskIds;
                    lastMsg.actionsTriggered = data.actionsTriggered ?? lastMsg.actionsTriggered;
                }
                return updated;
            });
        };

        socket.on('paios:tasks_created', handleTasksCreated);
        return () => {
            socket.off('paios:tasks_created', handleTasksCreated);
        };
    }, [socket]);

    const startNewSession = () => {
        const newSessionId = createSessionId();
        setSessionId(newSessionId);
        setMessages([]);
        if (typeof window !== 'undefined') {
            window.sessionStorage.setItem(SESSION_STORAGE_KEY, newSessionId);
        }
        toast.success('Új operátori session indítva.');
    };

    const sendMessage = async (overrideText?: string) => {
        const text = (overrideText ?? input).trim();
        if (!text || isLoading) return;

        setInput('');
        const userMsg: ChatMessage = {
            role: 'user',
            content: text,
            timestamp: Date.now(),
        };
        setMessages((prev) => [...prev, userMsg]);
        setIsLoading(true);

        try {
            const conversationHistory = messages
                .filter((msg) => !msg.error)
                .map((msg) => ({ role: msg.role, content: msg.content }));

            const response = await fetch('/api/paios/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: text,
                    provider: selectedProvider,
                    model: selectedModel,
                    conversationHistory,
                    sessionId,
                }),
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const result = (await response.json()) as PaiosChatResponse;

            if (result.success) {
                const assistantReply = result.summary || result.reply || 'A kérés feldolgozva.';
                if (result.sessionId && result.sessionId !== sessionId) {
                    setSessionId(result.sessionId);
                    if (typeof window !== 'undefined') {
                        window.sessionStorage.setItem(SESSION_STORAGE_KEY, result.sessionId);
                    }
                }

                setMessages((prev) => [
                    ...prev,
                    {
                        role: 'assistant',
                        content: assistantReply,
                        timestamp: Date.now(),
                        plan: result.plan,
                        taskIds: result.taskIds,
                        actionsTriggered: result.actionsTriggered,
                        provider: result.provider ?? selectedProvider,
                        model: result.model ?? selectedModel,
                        roleLabel: result.role ?? 'orchestrator',
                        thinkingMs: result.thinkingMs,
                        suggestions: result.suggestions,
                        missionTimeline: result.missionTimeline,
                        approvalRequired: result.approvalRequired,
                        approvalId: result.approvalId,
                        riskLevel: result.riskLevel,
                        runbookHint: result.runbookHint,
                        fallbackUsed: result.fallbackUsed,
                        fallbackReason: result.fallbackReason,
                        phoenixTriggered: result.phoenixTriggered,
                    },
                ]);
                if (result.approvalRequired) {
                    toast.warning('Jóváhagyás szükséges a high-risk végrehajtáshoz.');
                }
                toast.success('✅ Orchestrator válaszolt');
                void playTTS(assistantReply);
            } else {
                throw new Error(result.error || 'Unknown error');
            }
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : 'Hiba történt';
            toast.error(`❌ ${msg}`);
            setMessages((prev) => [
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
            <CardHeader className="border-b py-3 px-4">
                <div className="flex items-center justify-between gap-2">
                    <CardTitle className="flex items-center gap-2 text-base">
                        <Brain className="w-4 h-4 text-blue-500" />
                        PAIOS Chat
                    </CardTitle>
                    <div className="flex flex-wrap items-center gap-1 justify-end">
                        <Button
                            variant="outline"
                            size="sm"
                            className="gap-1 h-7"
                            title="Új session"
                            onClick={ startNewSession }
                        >
                            <RefreshCw className="w-3 h-3" />
                            <span className="hidden sm:inline text-xs">Új session</span>
                        </Button>
                        { providerCatalog.map((provider) => {
                            const visual = PROVIDER_VISUALS[provider.id as ModelProvider];
                            const Icon = visual.icon;
                            const isActive = selectedProvider === provider.id;
                            return (
                                <Button
                                    key={ provider.id }
                                    variant={ isActive ? 'default' : 'outline' }
                                    size="sm"
                                    onClick={ () => setSelectedProvider(provider.id as ModelProvider) }
                                    className="gap-1 h-7"
                                    title={ provider.label }
                                >
                                    <Icon className={ `w-3 h-3 ${isActive ? 'text-white' : visual.color}` } />
                                    <span className="hidden sm:inline text-xs">{ provider.label.split(' ')[0] }</span>
                                </Button>
                            );
                        }) }
                        <select
                            value={ selectedModel }
                            onChange={ (e) => setSelectedModel(e.target.value) }
                            className="h-7 rounded-md border bg-background px-2 text-xs"
                            title="Model választás"
                        >
                            { activeProviderCatalog.models.map((model) => (
                                <option key={ model.id } value={ model.name }>
                                    { model.name }
                                </option>
                            )) }
                        </select>
                    </div>
                </div>
                <div className="flex items-center gap-3 mt-1">
                    <p className="text-[10px] text-zinc-500">
                        magyar kérés → tool calling → agent delegálás
                    </p>
                    <p className="text-[10px] text-zinc-600">
                        Session: <span className="font-mono">{ sessionId.slice(-12) }</span>
                    </p>
                </div>
            </CardHeader>

            <CardContent className="flex-1 flex flex-col p-0 overflow-hidden min-h-0">
                <ScrollArea className="flex-1 p-3">
                    <div className="space-y-3">
                        { messages.length === 0 && (
                            <div className="text-center text-zinc-500 py-16">
                                <Brain className="w-10 h-10 mx-auto mb-3 opacity-30" />
                                <p className="text-sm font-medium">Adj egy feladatot magyarul...</p>
                                <p className="text-xs mt-1 opacity-60">Példa: "Készíts egy új API endpointot TDD-vel"</p>
                            </div>
                        ) }

                        { messages.map((msg, idx) => (
                            <div key={ idx } className={ `flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}` }>
                                { msg.role === 'assistant' && (
                                    <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center flex-shrink-0">
                                        <Bot className="w-4 h-4 text-white" />
                                    </div>
                                ) }

                                <div
                                    className={ `max-w-[80%] rounded-lg p-3 ${msg.role === 'user'
                                        ? 'bg-primary text-primary-foreground'
                                        : msg.error
                                            ? 'bg-red-100 dark:bg-red-950 border border-red-300 dark:border-red-800'
                                            : 'bg-muted'
                                        }` }
                                >
                                    <p className="text-sm whitespace-pre-wrap">{ msg.content }</p>

                                    { msg.role === 'assistant' && (
                                        <div className="mt-2 flex flex-wrap items-center gap-1 text-xs opacity-75">
                                            { msg.provider && <Badge variant="outline" className="text-[10px]">{ msg.provider }</Badge> }
                                            { msg.model && <Badge variant="outline" className="text-[10px]">{ msg.model }</Badge> }
                                            { msg.roleLabel && <Badge variant="outline" className="text-[10px]">{ msg.roleLabel }</Badge> }
                                            { msg.fallbackUsed && <Badge variant="outline" className="text-[10px]">fallback</Badge> }
                                            { msg.phoenixTriggered && <Badge variant="outline" className="text-[10px]">phoenix</Badge> }
                                            { typeof msg.thinkingMs === 'number' && <span>⏱️ { msg.thinkingMs } ms</span> }
                                            { msg.riskLevel && <Badge variant="outline" className="text-[10px]">risk: { msg.riskLevel }</Badge> }
                                        </div>
                                    ) }

                                    { msg.role === 'assistant' && msg.fallbackUsed && (
                                        <p className="text-xs mt-2 opacity-80">
                                            ♻️ Fallback aktiválva{ msg.fallbackReason ? ` (${msg.fallbackReason})` : '' }
                                        </p>
                                    ) }

                                    { msg.role === 'assistant' && msg.runbookHint && (
                                        <p className="text-xs mt-2 opacity-80">📚 { msg.runbookHint }</p>
                                    ) }

                                    { msg.role === 'assistant' && msg.approvalRequired && msg.approvalId && (
                                        <div className="mt-2 flex flex-wrap gap-1 border-t pt-2">
                                            <Button
                                                variant="default"
                                                size="sm"
                                                className="h-6 px-2 text-[10px]"
                                                onClick={ () => void sendMessage(`jóváhagyom ${msg.approvalId}`) }
                                            >
                                                ✅ Jóváhagyom { msg.approvalId }
                                            </Button>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="h-6 px-2 text-[10px]"
                                                onClick={ () => void sendMessage('elutasítom') }
                                            >
                                                ❌ Elutasítom
                                            </Button>
                                        </div>
                                    ) }

                                    { msg.role === 'assistant' && msg.suggestions && msg.suggestions.length > 0 && (
                                        <div className="mt-2 flex flex-wrap gap-1">
                                            { msg.suggestions.slice(0, 4).map((suggestion, suggestionIndex) => (
                                                <Button
                                                    key={ `${idx}-suggestion-${suggestionIndex}` }
                                                    variant="outline"
                                                    size="sm"
                                                    className="h-6 px-2 text-[10px]"
                                                    onClick={ () => void sendMessage(suggestion) }
                                                >
                                                    { suggestion }
                                                </Button>
                                            )) }
                                        </div>
                                    ) }

                                    { msg.role === 'assistant' && msg.missionTimeline && msg.missionTimeline.length > 0 && (
                                        <div className="mt-3 border-t pt-2 space-y-1">
                                            <p className="text-xs font-semibold opacity-75">🧭 Mission Timeline</p>
                                            { msg.missionTimeline.slice(-8).map((entry, timelineIndex) => (
                                                <div key={ `${idx}-timeline-${timelineIndex}` } className="text-xs flex items-start gap-2">
                                                    <Badge variant="outline" className="text-[10px] shrink-0">{ entry.phase }</Badge>
                                                    <span className="opacity-80">[{ entry.status }] { entry.detail }</span>
                                                </div>
                                            )) }
                                        </div>
                                    ) }

                                    { msg.plan && msg.plan.length > 0 && (
                                        <div className="mt-3 space-y-2 border-t pt-2">
                                            <p className="text-xs font-semibold opacity-70">📋 Execution Plan:</p>
                                            { msg.plan.map((step, i) => (
                                                <div key={ i } className="flex items-start gap-2 text-xs">
                                                    <Badge variant="outline" className="shrink-0">
                                                        { step.phase }
                                                    </Badge>
                                                    <div className="flex-1">
                                                        <span className="font-medium">{ step.agent }</span>
                                                        <span className="opacity-70"> → { step.task }</span>
                                                    </div>
                                                </div>
                                            )) }
                                        </div>
                                    ) }

                                    { msg.taskIds && msg.taskIds.length > 0 && (
                                        <div className="mt-2 flex flex-wrap gap-1">
                                            <span className="text-xs opacity-70">🎯 Tasks:</span>
                                            { msg.taskIds.map((id) => (
                                                <Badge key={ id } variant="secondary" className="text-xs">
                                                    #{ id }
                                                </Badge>
                                            )) }
                                        </div>
                                    ) }

                                    { msg.actionsTriggered && msg.actionsTriggered.length > 0 && (
                                        <div className="mt-2 border-t pt-2 text-xs space-y-1">
                                            <p className="opacity-70">🤖 Delegált műveletek:</p>
                                            { msg.actionsTriggered.map((action) => (
                                                <div key={ `${action.agent}-${action.taskId}` } className="flex items-center justify-between gap-2">
                                                    <span className="truncate">
                                                        <strong>{ action.agent }</strong>: { action.task }
                                                    </span>
                                                    <Badge variant="secondary" className="text-[10px]">
                                                        #{ action.taskId }
                                                    </Badge>
                                                </div>
                                            )) }
                                        </div>
                                    ) }

                                    <p className="text-xs opacity-50 mt-2">
                                        { new Date(msg.timestamp).toLocaleTimeString('hu-HU') }
                                    </p>
                                </div>

                                { msg.role === 'user' && (
                                    <div className="w-8 h-8 rounded-full bg-gray-700 dark:bg-gray-600 flex items-center justify-center flex-shrink-0">
                                        <User className="w-4 h-4 text-white" />
                                    </div>
                                ) }
                            </div>
                        )) }
                        <div ref={ scrollRef } />
                    </div>
                </ScrollArea>

                <div className="border-t p-3 bg-background shrink-0">
                    <div className="flex gap-2 items-end">
                        <Textarea
                            value={ input }
                            onChange={ (e) => setInput(e.target.value) }
                            onKeyDown={ (e) => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                    void sendMessage();
                                }
                            } }
                            placeholder="Írd be a feladatot magyarul... (Enter = küldés)"
                            className="resize-none min-h-[44px] max-h-[120px] text-sm"
                            disabled={ isLoading }
                        />
                        <Button
                            onClick={ startListening }
                            variant="outline"
                            size="icon"
                            className={ `shrink-0 h-9 w-9 transition-all duration-300 ${isListening ? 'bg-red-500/20 text-red-500 border-red-500/50 animate-pulse' : ''}` }
                            title="Hangutasítás (Magyar)"
                        >
                            { isSpeaking ? (
                                <Volume2 className="w-4 h-4 animate-bounce text-primary" />
                            ) : (
                                <Mic className={ `w-4 h-4 ${isListening ? 'text-red-500' : ''}` } />
                            ) }
                        </Button>
                        <Button onClick={ () => void sendMessage() } disabled={ !input.trim() || isLoading } className="shrink-0 h-9 w-9" size="icon">
                            { isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" /> }
                        </Button>
                    </div>
                    { isLoading && (
                        <p className="text-xs text-zinc-500 mt-1 animate-pulse">⏳ Orchestrator gondolkodik...</p>
                    ) }
                </div>
            </CardContent>
        </Card>
    );
}
