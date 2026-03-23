import { useEffect, useMemo, useState } from 'react';
import { Bot, CheckCircle2, Eye, EyeOff, Loader2, MessageSquare, Pause, Play, RefreshCw, ScreenShare, Send, Sparkles, Waypoints } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { LiveExecutionMonitor } from '@/components/dashboard/LiveExecutionMonitor';
import { useSocket } from '@/context/SocketContext';
import {
    browserCopilotConfigure,
    browserCopilotConfirm,
    browserCopilotGetSession,
    browserCopilotPause,
    browserCopilotReset,
    browserCopilotResume,
    browserCopilotSendMessage,
    type BrowserCopilotEnginePreference,
    type BrowserCopilotMode,
    type BrowserCopilotSessionState,
} from '@/lib/apiService';
import { toast } from 'sonner';

const chromeAcpUrl = 'http://localhost:9315';

const modeLabels: Record<BrowserCopilotMode, string> = {
    observe: 'Observe',
    guide: 'Guide',
    auto: 'Auto',
};

const engineLabels: Record<BrowserCopilotEnginePreference, string> = {
    auto: 'Auto nézet',
    'chrome-acp': 'Chrome ACP',
    robotkez: 'Robotkéz live',
};

function SessionBadge({ session }: { session: BrowserCopilotSessionState }) {
    const intent = session.status === 'error'
        ? 'bg-red-500/15 text-red-400 border-red-500/30'
        : session.status === 'executing'
            ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
            : session.status === 'waiting-confirmation'
                ? 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                : 'bg-zinc-500/10 text-zinc-300 border-zinc-500/30';

    return <Badge variant="outline" className={ intent }>{ session.status }</Badge>;
}

export function BrowserCopilotPanel() {
    const { socket } = useSocket();
    const [session, setSession] = useState<BrowserCopilotSessionState | null>(null);
    const [input, setInput] = useState('');
    const [isBusy, setIsBusy] = useState(false);
    const [showOverlay, setShowOverlay] = useState(true);

    const latestMessages = useMemo(() => session?.messages.slice(-8) ?? [], [session?.messages]);

    const refreshSession = async () => {
        try {
            const response = await browserCopilotGetSession();
            setSession(response.session);
            setShowOverlay(response.session.overlayEnabled);
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            toast.error(`Browser Copilot frissítési hiba: ${message}`);
        }
    };

    useEffect(() => {
        void refreshSession();
        const interval = window.setInterval(() => {
            void refreshSession();
        }, 3000);
        return () => window.clearInterval(interval);
    }, []);

    useEffect(() => {
        if (!socket) return;
        const handler = (nextSession: BrowserCopilotSessionState) => {
            setSession(nextSession);
            setShowOverlay(nextSession.overlayEnabled);
        };
        socket.on('browser-copilot:update', handler);
        return () => {
            socket.off('browser-copilot:update', handler);
        };
    }, [socket]);

    const withBusy = async (fn: () => Promise<void>) => {
        setIsBusy(true);
        try {
            await fn();
        } finally {
            setIsBusy(false);
        }
    };

    const handleConfigure = async (config: Partial<Pick<BrowserCopilotSessionState, 'mode' | 'enginePreference' | 'overlayEnabled'>>) => {
        await withBusy(async () => {
            const response = await browserCopilotConfigure(config);
            setSession(response.session);
            setShowOverlay(response.session.overlayEnabled);
        });
    };

    const handleSend = async () => {
        const instruction = input.trim();
        if (!instruction) return;
        await withBusy(async () => {
            const response = await browserCopilotSendMessage(instruction);
            setSession(response.session);
            setInput('');
        });
    };

    const currentScreenshot = session?.lastScreenshotUrl
        ? `${session.lastScreenshotUrl}${session.lastScreenshotUrl.includes('?') ? '&' : '?'}panel=${Date.now()}`
        : `/api/v1/robotkez/screenshot?t=${Date.now()}`;

    return (
        <div className="grid grid-cols-1 xl:grid-cols-[1.4fr_0.9fr] gap-6 p-6 h-full">
            <div className="space-y-6 min-w-0">
                <Card className="border-border/60 bg-background/50 backdrop-blur-xl overflow-hidden">
                    <CardHeader className="flex flex-row items-center justify-between gap-4 border-b border-border/50">
                        <div className="space-y-2">
                            <CardTitle className="flex items-center gap-2 text-base">
                                <Sparkles className="w-5 h-5 text-primary" />
                                Browser Copilot Mission Control
                            </CardTitle>
                            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                                <SessionBadge session={ session ?? {
                                    sessionId: 'loading', status: 'idle', mode: 'auto', enginePreference: 'auto', viewportEngine: 'robotkez', actionEngine: 'robotkez', chromeAcpReachable: false, overlayEnabled: true, paused: false, lastUpdatedAt: 0, messages: [],
                                } } />
                                { session && <Badge variant="outline">Mód: { modeLabels[session.mode] }</Badge> }
                                { session && <Badge variant="outline">Nézet: { session.viewportEngine }</Badge> }
                                { session && <Badge variant="outline">Akció: { session.actionEngine }</Badge> }
                                { session?.chromeAcpReachable ? (
                                    <Badge className="bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">Chrome ACP él</Badge>
                                ) : (
                                    <Badge variant="outline">Chrome ACP offline</Badge>
                                ) }
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <Button variant="outline" size="sm" onClick={ () => void refreshSession() } disabled={ isBusy }>
                                <RefreshCw className={ `w-4 h-4 ${isBusy ? 'animate-spin' : ''}` } />
                            </Button>
                            <Button variant={ session?.paused ? 'default' : 'outline' } size="sm" onClick={ () => void withBusy(async () => setSession((await browserCopilotResume()).session)) } disabled={ isBusy || !session?.paused }>
                                <Play className="w-4 h-4 mr-1" />
                                Resume
                            </Button>
                            <Button variant="outline" size="sm" onClick={ () => void withBusy(async () => setSession((await browserCopilotPause()).session)) } disabled={ isBusy || !!session?.paused }>
                                <Pause className="w-4 h-4 mr-1" />
                                Pause
                            </Button>
                            <Button variant="ghost" size="sm" onClick={ () => void withBusy(async () => setSession((await browserCopilotReset()).session)) } disabled={ isBusy }>
                                Reset
                            </Button>
                        </div>
                    </CardHeader>
                    <CardContent className="p-4 space-y-4">
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
                            <div className="space-y-2 lg:col-span-2">
                                <p className="text-[11px] uppercase tracking-[0.24em] text-muted-foreground">Vezérlési mód</p>
                                <div className="flex flex-wrap gap-2">
                                    { (Object.keys(modeLabels) as BrowserCopilotMode[]).map((mode) => (
                                        <Button
                                            key={ mode }
                                            size="sm"
                                            variant={ session?.mode === mode ? 'default' : 'outline' }
                                            onClick={ () => void handleConfigure({ mode }) }
                                            disabled={ isBusy }
                                        >
                                            { modeLabels[mode] }
                                        </Button>
                                    )) }
                                </div>
                            </div>
                            <div className="space-y-2">
                                <p className="text-[11px] uppercase tracking-[0.24em] text-muted-foreground">Live viewport</p>
                                <div className="flex flex-wrap gap-2">
                                    { (Object.keys(engineLabels) as BrowserCopilotEnginePreference[]).map((engine) => (
                                        <Button
                                            key={ engine }
                                            size="sm"
                                            variant={ session?.enginePreference === engine ? 'default' : 'outline' }
                                            onClick={ () => void handleConfigure({ enginePreference: engine }) }
                                            disabled={ isBusy }
                                        >
                                            { engineLabels[engine] }
                                        </Button>
                                    )) }
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center justify-between rounded-xl border border-border/50 bg-muted/20 px-4 py-3">
                            <div>
                                <p className="text-sm font-medium">Chat overlay</p>
                                <p className="text-xs text-muted-foreground">Lebegő magyar vezérlőpanel a live nézet felett</p>
                            </div>
                            <div className="flex items-center gap-2">
                                { showOverlay ? <Eye className="w-4 h-4 text-primary" /> : <EyeOff className="w-4 h-4 text-muted-foreground" /> }
                                <Switch checked={ showOverlay } onCheckedChange={ (checked) => void handleConfigure({ overlayEnabled: checked }) } />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-border/60 bg-background/50 backdrop-blur-xl overflow-hidden">
                    <CardHeader className="border-b border-border/50">
                        <CardTitle className="flex items-center gap-2 text-sm font-medium">
                            <ScreenShare className="w-4 h-4 text-primary" />
                            Élő session coordinator nézet
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-4">
                        <div className="grid grid-cols-1 2xl:grid-cols-[1.5fr_0.9fr] gap-4">
                            <div className="relative min-h-[560px] rounded-2xl border border-border/50 bg-black overflow-hidden">
                                { session?.viewportEngine === 'chrome-acp' ? (
                                    <iframe
                                        src={ chromeAcpUrl }
                                        title="Chrome ACP Live View"
                                        className="w-full h-[560px] border-0 bg-zinc-950"
                                        sandbox="allow-scripts allow-forms allow-same-origin"
                                        referrerPolicy="no-referrer"
                                    />
                                ) : (
                                    <div className="h-[560px] flex items-center justify-center bg-zinc-950">
                                        <img
                                            src={ currentScreenshot }
                                            alt="Robotkéz live screenshot"
                                            className="max-h-full max-w-full object-contain"
                                        />
                                    </div>
                                ) }

                                <div className="absolute left-3 top-3 flex flex-wrap gap-2">
                                    <Badge className="bg-black/70 text-white border-white/20">Viewport: { session?.viewportEngine ?? 'robotkez' }</Badge>
                                    <Badge className="bg-black/70 text-white border-white/20">Action Engine: { session?.actionEngine ?? 'robotkez' }</Badge>
                                    { session?.lastTaskId && <Badge className="bg-black/70 text-white border-white/20">Task: { session.lastTaskId.slice(0, 8) }</Badge> }
                                </div>

                                { showOverlay && (
                                    <div className="absolute right-4 bottom-4 w-full max-w-md rounded-2xl border border-white/10 bg-zinc-950/85 backdrop-blur-xl shadow-2xl overflow-hidden">
                                        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
                                            <div className="flex items-center gap-2 text-sm font-medium text-white">
                                                <MessageSquare className="w-4 h-4 text-primary" />
                                                Magyar browser overlay
                                            </div>
                                            { session?.status === 'executing' && <Loader2 className="w-4 h-4 text-primary animate-spin" /> }
                                        </div>
                                        <ScrollArea className="h-48 px-4 py-3">
                                            <div className="space-y-3">
                                                { latestMessages.map((message) => (
                                                    <div key={ message.id } className={ `rounded-xl px-3 py-2 text-xs leading-relaxed ${message.role === 'user' ? 'bg-primary text-primary-foreground ml-8' : message.role === 'assistant' ? 'bg-white/5 text-zinc-100 mr-2' : 'bg-amber-500/10 text-amber-100 border border-amber-500/20'}` }>
                                                        { message.content }
                                                    </div>
                                                )) }
                                            </div>
                                        </ScrollArea>
                                        <div className="border-t border-white/10 p-3 space-y-2">
                                            <Textarea
                                                value={ input }
                                                onChange={ (event) => setInput(event.target.value) }
                                                placeholder="Pl.: nyisd meg az űrlapot, és guide módban töltsük ki együtt…"
                                                className="min-h-[76px] resize-none border-white/10 bg-white/5 text-white placeholder:text-zinc-500"
                                                disabled={ isBusy }
                                                onKeyDown={ (event) => {
                                                    if (event.key === 'Enter' && !event.shiftKey) {
                                                        event.preventDefault();
                                                        void handleSend();
                                                    }
                                                } }
                                            />
                                            <div className="flex items-center justify-between gap-2">
                                                <Button variant="secondary" size="sm" onClick={ () => void withBusy(async () => setSession((await browserCopilotConfirm()).session)) } disabled={ isBusy || session?.status !== 'waiting-confirmation' }>
                                                    <CheckCircle2 className="w-4 h-4 mr-1" />
                                                    Megerősítés
                                                </Button>
                                                <Button onClick={ () => void handleSend() } disabled={ isBusy || !input.trim() }>
                                                    <Send className="w-4 h-4 mr-1" />
                                                    Küldés
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                ) }
                            </div>

                            <div className="space-y-4 min-w-0">
                                <Card className="border-border/50 bg-muted/20">
                                    <CardHeader className="pb-2">
                                        <CardTitle className="flex items-center gap-2 text-sm">
                                            <Waypoints className="w-4 h-4 text-primary" />
                                            Session állapot
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="space-y-3 text-xs text-muted-foreground">
                                        <div className="grid grid-cols-2 gap-2">
                                            <div className="rounded-lg border border-border/40 bg-background/40 p-3">
                                                <p className="uppercase tracking-widest text-[10px] mb-1">Mód</p>
                                                <p className="text-foreground text-sm font-medium">{ session ? modeLabels[session.mode] : 'Betöltés...' }</p>
                                            </div>
                                            <div className="rounded-lg border border-border/40 bg-background/40 p-3">
                                                <p className="uppercase tracking-widest text-[10px] mb-1">Overlay</p>
                                                <p className="text-foreground text-sm font-medium">{ showOverlay ? 'Aktív' : 'Rejtett' }</p>
                                            </div>
                                        </div>
                                        <div className="rounded-lg border border-border/40 bg-background/40 p-3 space-y-1">
                                            <p className="uppercase tracking-widest text-[10px]">Utolsó instrukció</p>
                                            <p className="text-foreground leading-relaxed">{ session?.currentInstruction ?? '—' }</p>
                                        </div>
                                        <div className="rounded-lg border border-border/40 bg-background/40 p-3 space-y-1">
                                            <p className="uppercase tracking-widest text-[10px]">Pending guide</p>
                                            <p className="text-foreground leading-relaxed">{ session?.pendingInstruction ?? 'Nincs függő megerősítés.' }</p>
                                        </div>
                                    </CardContent>
                                </Card>

                                <LiveExecutionMonitor />
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <div className="space-y-6 min-w-0">
                <Card className="border-border/60 bg-background/50 backdrop-blur-xl">
                    <CardHeader className="border-b border-border/50">
                        <CardTitle className="flex items-center gap-2 text-sm font-medium">
                            <Bot className="w-4 h-4 text-primary" />
                            Browser Copilot session feed
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                        <ScrollArea className="h-[720px]">
                            <div className="p-4 space-y-3">
                                { (session?.messages ?? []).map((message) => (
                                    <div key={ message.id } className={ `rounded-2xl border px-4 py-3 ${message.role === 'user' ? 'bg-primary/10 border-primary/20 ml-6' : message.role === 'assistant' ? 'bg-muted/30 border-border/50 mr-2' : 'bg-amber-500/5 border-amber-500/20'}` }>
                                        <p className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground mb-2">{ message.role }</p>
                                        <p className="text-sm leading-relaxed">{ message.content }</p>
                                    </div>
                                )) }
                            </div>
                        </ScrollArea>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
