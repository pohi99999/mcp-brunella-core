/**
 * PAIOS Orchestrator Chat - Magyar AI Operating System Interface
 *
 * @track orchestrator_chat_upgrade_20260320
 */

import { useState, useRef, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
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
    ChevronDown,
    ChevronUp,
} from 'lucide-react';
import { toast } from 'sonner';
import { useSocket } from '@/context/SocketContext';
import { getLLMModelCatalog, type LLMCatalogProvider } from '@/lib/apiService';
import { Marked } from 'marked';

const markedInstance = new Marked({
    breaks: true,
    gfm: true,
});

function renderMarkdown(text: string): string {
    try {
        return markedInstance.parse(text) as string;
    } catch {
        return text;
    }
}

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

type ModelProvider = 'gemini' | 'github' | 'ollama' | 'anthropic' | 'cloudflare' | 'copilot';
type VoiceOption = 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer';

interface PaiosVoiceConfig {
    response_voice: VoiceOption;
    tts_model: 'tts-1' | 'tts-1-hd';
    speed: number;
}

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
    copilot: {
        label: 'Copilot CLI',
        icon: Zap,
        color: 'text-yellow-500',
        defaultModel: 'copilot-cli',
        fallbackModels: ['copilot-cli'],
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

function selectPreferredSpeechVoice(voices: SpeechSynthesisVoice[], preferredVoice: VoiceOption): SpeechSynthesisVoice | undefined {
    const normalizedPreferredVoice = preferredVoice.toLowerCase();
    // Extended female hints — Windows, macOS, common TTS names
    const femaleHints = ['female', 'woman', 'samantha', 'zira', 'eva', 'anna', 'katja', 'julia', 'victoria', 'nova', 'shimmer', 'zsuzsanna', 'agnes', 'ágnes', 'ildiko', 'ildikó'];
    const maleHints = ['male', 'man', 'szabolcs', 'daniel', 'dániel', 'onyx', 'echo', 'fable'];
    const preferredLocaleVoices = voices.filter((voice) => voice.lang.toLowerCase().startsWith('hu'));

    // 1. Exact name match (e.g. browser has a "nova" voice)
    const exactMatch = voices.find((voice) => voice.name.toLowerCase().includes(normalizedPreferredVoice));
    if (exactMatch) return exactMatch;

    // 2. Hungarian female voice
    const huFemale = preferredLocaleVoices.find((voice) =>
        femaleHints.some((hint) => voice.name.toLowerCase().includes(hint))
    );
    if (huFemale) return huFemale;

    // 3. Hungarian voice that is NOT male (skip Szabolcs etc.)
    const huNonMale = preferredLocaleVoices.find((voice) =>
        !maleHints.some((hint) => voice.name.toLowerCase().includes(hint))
    );
    if (huNonMale) return huNonMale;

    // 4. Any female voice
    const anyFemale = voices.find((voice) =>
        femaleHints.some((hint) => voice.name.toLowerCase().includes(hint))
    );
    if (anyFemale) return anyFemale;

    // 5. Last resort: first available (better than silence)
    return voices[0];
}

export function PAIOSOrchestratorChat() {
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [providerCatalog, setProviderCatalog] = useState<LLMCatalogProvider[]>(FALLBACK_PROVIDER_CATALOG);
    const [selectedProvider, setSelectedProvider] = useState<ModelProvider>('github');
    const [selectedModel, setSelectedModel] = useState<string>(PROVIDER_VISUALS.github.defaultModel);
    const [voiceConfig, setVoiceConfig] = useState<PaiosVoiceConfig>({
        response_voice: 'nova',
        tts_model: 'tts-1',
        speed: 1,
    });
    const activeVoiceLabel = voiceConfig.response_voice === 'nova'
        ? 'Nova női hang'
        : voiceConfig.response_voice;
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
    const chatContainerRef = useRef<HTMLDivElement>(null);
    const { socket } = useSocket();

    const [isListening, setIsListening] = useState(false);
    const [isSpeaking, setIsSpeaking] = useState(false);
    const [showDebug, setShowDebug] = useState(false);
    const [debugLogs, setDebugLogs] = useState<Array<{ message: string, context?: any, timestamp: number }>>([]);
    const [expandedMeta, setExpandedMeta] = useState<Record<number, boolean>>({});
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

                const configResponse = await fetch('/api/paios/config');
                if (!configResponse.ok) {
                    return;
                }

                const config = await configResponse.json() as { voice?: Partial<PaiosVoiceConfig> };
                if (isMounted && config.voice) {
                    setVoiceConfig((current) => ({
                        response_voice: config.voice?.response_voice ?? current.response_voice,
                        tts_model: config.voice?.tts_model ?? current.tts_model,
                        speed: typeof config.voice?.speed === 'number' ? config.voice.speed : current.speed,
                    }));
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
            const [{ transcript }] = event.results[0];
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
        const plainText = text.replace(/[#*_`~[\]()>|-]/g, '').replace(/\n{2,}/g, '. ').trim();
        if (!plainText) return;

        try {
            setIsSpeaking(true);
            // OpenAI Nova TTS via backend /api/tts (returns audio/mpeg blob)
            const response = await fetch('/api/tts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    text: plainText.slice(0, 4000),
                    voice: voiceConfig.response_voice,
                    model: voiceConfig.tts_model,
                    speed: voiceConfig.speed,
                }),
            });

            if (response.ok && response.headers.get('content-type')?.includes('audio')) {
                if (audioRef.current) audioRef.current.pause();
                const audioBlob = await response.blob();
                const audioUrl = URL.createObjectURL(audioBlob);
                const audio = new Audio(audioUrl);
                audioRef.current = audio;
                audio.onended = () => { setIsSpeaking(false); URL.revokeObjectURL(audioUrl); };
                audio.onerror = () => { setIsSpeaking(false); URL.revokeObjectURL(audioUrl); };
                await audio.play();
                toast.success(`🎙️ Brunella beszél... (${activeVoiceLabel})`);
                return;
            }
        } catch {
            // Backend TTS nem elérhető, fallback a böngésző speechSynthesis-re
        }

        // Fallback: böngésző beépített speechSynthesis
        if ('speechSynthesis' in window) {
            window.speechSynthesis.cancel();
            const utterance = new SpeechSynthesisUtterance(plainText.slice(0, 500));
            utterance.lang = 'hu-HU';
            utterance.rate = voiceConfig.speed;
            const voices = window.speechSynthesis.getVoices();
            const preferredVoice = selectPreferredSpeechVoice(voices, voiceConfig.response_voice);
            if (preferredVoice) {
                utterance.voice = preferredVoice;
            }
            utterance.onend = () => setIsSpeaking(false);
            utterance.onerror = () => setIsSpeaking(false);
            window.speechSynthesis.speak(utterance);
        } else {
            setIsSpeaking(false);
        }
    };

    useEffect(() => {
        const container = chatContainerRef.current;
        if (!container) return;
        // Auto-scroll csak ha a user a chat alján van (±80px)
        const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 80;
        if (isNearBottom) {
            scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
        }
    }, [messages]);

    const [liveChatter, setLiveChatter] = useState<string>('');

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

        const handleAgentChatter = (data: { sender: string, message: string }) => {
            setLiveChatter(`[${data.sender}] ${data.message}`);
        };

        const handleSystemLog = (data: { message: string, type: string, source?: string }) => {
             if (data.type === 'error') {
                 // Csak akkor mutatjuk ha az orchestrator gondolkodik, silent fallback-hez
                 setLiveChatter(`⚠️ ${data.source ? `[${data.source}] ` : ''}${data.message}`);
             }
        };

        const handleSystemDebug = (data: { message: string, context?: any, timestamp: number }) => {
            setDebugLogs((prev) => [data, ...prev].slice(0, 100));
        };

        socket.on('paios:tasks_created', handleTasksCreated);
        socket.on('agent:chatter', handleAgentChatter);
        socket.on('system:log', handleSystemLog);
        socket.on('system:debug', handleSystemDebug);

        return () => {
            socket.off('paios:tasks_created', handleTasksCreated);
            socket.off('agent:chatter', handleAgentChatter);
            socket.off('system:log', handleSystemLog);
            socket.off('system:debug', handleSystemDebug);
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
                            variant={ showDebug ? 'default' : 'outline' }
                            size="sm"
                            className="gap-1 h-7"
                            title="Debug csatorna"
                            onClick={ () => setShowDebug(!showDebug) }
                        >
                            <Zap className={ `w-3 h-3 ${showDebug ? 'text-white' : 'text-yellow-500'}` } />
                            <span className="hidden sm:inline text-xs">Debug</span>
                        </Button>
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
                        <Badge variant="secondary" className="h-5 px-2 text-[10px]">
                            🎙️ { activeVoiceLabel }
                        </Badge>
                </div>
            </CardHeader>

            <CardContent className="flex-1 flex flex-row p-0 overflow-hidden min-h-0">
                <div className="flex-1 flex flex-col min-w-0">
                    <div ref={ chatContainerRef } className="flex-1 overflow-y-auto p-3 scroll-smooth">
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
                                        { msg.role === 'user' ? (
                                            <p className="text-sm whitespace-pre-wrap">{ msg.content }</p>
                                        ) : (
                                            <div
                                                className="text-sm prose prose-sm dark:prose-invert prose-p:my-1 prose-headings:my-2 prose-ul:my-1 prose-ol:my-1 prose-li:my-0.5 max-w-none [&_hr]:my-2"
                                                dangerouslySetInnerHTML={ { __html: renderMarkdown(msg.content) } }
                                            />
                                        ) }

                                        { msg.role === 'assistant' && (
                                            <div className="mt-2 flex flex-wrap items-center gap-1 text-xs opacity-75">
                                                { msg.provider && <Badge variant="outline" className="text-[10px]">{ msg.provider }</Badge> }
                                                { msg.model && <Badge variant="outline" className="text-[10px]">{ msg.model }</Badge> }
                                                { typeof msg.thinkingMs === 'number' && <span>⏱️ { msg.thinkingMs } ms</span> }
                                            </div>
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

                                        { /* Összecsukható részletek (timeline, plan, tasks) */ }
                                        { msg.role === 'assistant' && (msg.missionTimeline?.length || msg.plan?.length || msg.taskIds?.length || msg.runbookHint || msg.actionsTriggered?.length) && (
                                            <div className="mt-2 border-t pt-1">
                                                <button
                                                    onClick={ () => setExpandedMeta((prev) => ({ ...prev, [idx]: !prev[idx] })) }
                                                    className="flex items-center gap-1 text-[10px] text-zinc-400 hover:text-zinc-200 transition-colors"
                                                >
                                                    { expandedMeta[idx] ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" /> }
                                                    Részletek
                                                    { msg.runbookHint && <span className="opacity-60 ml-1">| 📚 { msg.runbookHint }</span> }
                                                </button>

                                                { expandedMeta[idx] && (
                                                    <div className="mt-1 space-y-1 text-xs animate-in slide-in-from-top-1 duration-200">
                                                        { msg.fallbackUsed && (
                                                            <p className="opacity-80">
                                                                ♻️ Fallback{ msg.fallbackReason ? ` (${msg.fallbackReason})` : '' }
                                                            </p>
                                                        ) }

                                                        { msg.missionTimeline && msg.missionTimeline.length > 0 && (
                                                            <div className="space-y-0.5">
                                                                <p className="font-semibold opacity-75">🧭 Mission Timeline</p>
                                                                { msg.missionTimeline.slice(-8).map((entry, timelineIndex) => (
                                                                    <div key={ `${idx}-timeline-${timelineIndex}` } className="flex items-start gap-2">
                                                                        <Badge variant="outline" className="text-[10px] shrink-0">{ entry.phase }</Badge>
                                                                        <span className="opacity-80">[{ entry.status }] { entry.detail }</span>
                                                                    </div>
                                                                )) }
                                                            </div>
                                                        ) }

                                                        { msg.plan && msg.plan.length > 0 && (
                                                            <div className="space-y-1">
                                                                <p className="font-semibold opacity-70">📋 Execution Plan</p>
                                                                { msg.plan.map((step, i) => (
                                                                    <div key={ i } className="flex items-start gap-2">
                                                                        <Badge variant="outline" className="shrink-0">{ step.phase }</Badge>
                                                                        <div className="flex-1">
                                                                            <span className="font-medium">{ step.agent }</span>
                                                                            <span className="opacity-70"> → { step.task }</span>
                                                                        </div>
                                                                    </div>
                                                                )) }
                                                            </div>
                                                        ) }

                                                        { msg.taskIds && msg.taskIds.length > 0 && (
                                                            <div className="flex flex-wrap gap-1">
                                                                <span className="opacity-70">🎯 Tasks:</span>
                                                                { msg.taskIds.map((id) => (
                                                                    <Badge key={ id } variant="secondary" className="text-xs">#{ id }</Badge>
                                                                )) }
                                                            </div>
                                                        ) }

                                                        { msg.actionsTriggered && msg.actionsTriggered.length > 0 && (
                                                            <div className="space-y-0.5">
                                                                <p className="opacity-70">🤖 Delegált műveletek:</p>
                                                                { msg.actionsTriggered.map((action) => (
                                                                    <div key={ `${action.agent}-${action.taskId}` } className="flex items-center justify-between gap-2">
                                                                        <span className="truncate">
                                                                            <strong>{ action.agent }</strong>: { action.task }
                                                                        </span>
                                                                        <Badge variant="secondary" className="text-[10px]">#{ action.taskId }</Badge>
                                                                    </div>
                                                                )) }
                                                            </div>
                                                        ) }
                                                    </div>
                                                ) }
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
                    </div>

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
                            <div className="mt-1 flex flex-col gap-1">
                                <p className="text-xs text-zinc-500 animate-pulse">⏳ Orchestrator gondolkodik...</p>
                                { liveChatter && (
                                    <p className="text-[10px] text-zinc-400 bg-zinc-100 dark:bg-zinc-800/50 px-2 py-1 rounded w-fit max-w-full truncate">
                                        { liveChatter }
                                    </p>
                                ) }
                            </div>
                        ) }
                    </div>
                </div>

                { showDebug && (
                    <div className="w-80 border-l bg-zinc-50 dark:bg-zinc-900/50 flex flex-col min-h-0 animate-in slide-in-from-right duration-300">
                        <div className="p-2 border-b flex items-center justify-between bg-zinc-100 dark:bg-zinc-800">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Invisible Debug Channel</span>
                            <Button variant="ghost" size="icon" className="h-5 w-5" onClick={ () => setShowDebug(false) }>
                                <ChevronUp className="w-3 h-3 rotate-90" />
                            </Button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-2 space-y-2 font-mono text-[10px]">
                            { debugLogs.length === 0 && (
                                <p className="text-center text-zinc-400 mt-10 italic">Nincs debug adat...</p>
                            ) }
                            { debugLogs.map((log, i) => (
                                <div key={ i } className="p-2 rounded border bg-background shadow-sm">
                                    <div className="flex justify-between opacity-50 mb-1 text-[9px]">
                                        <span>{ new Date(log.timestamp).toLocaleTimeString() }</span>
                                    </div>
                                    <div className="font-bold text-blue-500 mb-1 break-words">{ log.message }</div>
                                    { log.context && (
                                        <pre className="overflow-x-auto whitespace-pre-wrap break-all bg-zinc-100 dark:bg-zinc-800 p-1.5 rounded border text-[9px] leading-tight">
                                            { JSON.stringify(log.context, null, 2) }
                                        </pre>
                                    ) }
                                </div>
                            )) }
                        </div>
                    </div>
                ) }
            </CardContent>
        </Card>
    );
}
