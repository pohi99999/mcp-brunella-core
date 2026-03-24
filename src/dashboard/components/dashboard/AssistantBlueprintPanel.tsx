import { useEffect, useState } from 'react';
import { Brain, CheckCircle2, Clock3, Cpu, Database, Loader2, Mic, MonitorSmartphone, ShieldCheck, Sparkles, Wand2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { getAssistantBlueprint, type AssistantBlueprint, type AssistantReadinessStatus } from '@/lib/apiService';

const STATUS_STYLES: Record<AssistantReadinessStatus, { label: string; badge: string; icon: typeof CheckCircle2 }> = {
    ready: { label: 'Kész', badge: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30', icon: CheckCircle2 },
    partial: { label: 'Részben kész', badge: 'bg-amber-500/15 text-amber-300 border-amber-500/30', icon: Clock3 },
    planned: { label: 'Tervezett', badge: 'bg-zinc-500/15 text-zinc-300 border-zinc-500/30', icon: Sparkles },
};

const CAPABILITY_ICONS = {
    'desktop-shell': MonitorSmartphone,
    'model-routing': Cpu,
    'voice-experience': Mic,
    'memory-graphrag': Database,
    'computer-use': Wand2,
    'safety-guardrails': ShieldCheck,
} as const;

export function AssistantBlueprintPanel ()
{
    const [blueprint, setBlueprint] = useState<AssistantBlueprint | null>( null );
    const [error, setError] = useState<string | null>( null );
    const [loading, setLoading] = useState( true );

    useEffect( () =>
    {
        let active = true;

        void ( async () =>
        {
            try
            {
                const data = await getAssistantBlueprint();
                if ( active )
                {
                    setBlueprint( data );
                    setError( null );
                }
            } catch ( err )
            {
                if ( active )
                {
                    setError( err instanceof Error ? err.message : String( err ) );
                }
            } finally
            {
                if ( active )
                {
                    setLoading( false );
                }
            }
        } )();

        return () =>
        {
            active = false;
        };
    }, [] );

    if ( loading )
    {
        return (
            <Card className="border-zinc-800 bg-zinc-950/70">
                <CardContent className="flex min-h-[240px] items-center justify-center gap-3 text-zinc-300">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Assistant blueprint betöltése...
                </CardContent>
            </Card>
        );
    }

    if ( error || !blueprint )
    {
        return (
            <Card className="border-red-900/60 bg-red-950/30">
                <CardHeader>
                    <CardTitle className="text-red-200">Assistant blueprint hiba</CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-red-100/80">
                    { error ?? 'Ismeretlen hiba történt az assistant blueprint lekérésekor.' }
                </CardContent>
            </Card>
        );
    }

    return (
        <div className="space-y-6">
            <Card className="border-zinc-800 bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-950">
                <CardHeader className="space-y-4">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                        <div className="space-y-2">
                            <div className="flex items-center gap-2 text-zinc-400">
                                <Brain className="h-4 w-4" />
                                <span className="text-xs uppercase tracking-[0.24em]">Windows Personal AI Blueprint</span>
                            </div>
                            <CardTitle className="text-2xl text-white">{ blueprint.assistantName }</CardTitle>
                            <p className="max-w-4xl text-sm leading-6 text-zinc-300">{ blueprint.recommendedMode.recommendation }</p>
                        </div>
                        <Badge variant="outline" className="border-cyan-500/40 bg-cyan-500/10 px-3 py-1 text-cyan-200">
                            { blueprint.targetPlatform }
                        </Badge>
                    </div>

                    <div className="grid gap-4 md:grid-cols-3">
                        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4">
                            <div className="text-xs uppercase tracking-[0.2em] text-zinc-500">MVP readiness</div>
                            <div className="mt-2 text-3xl font-semibold text-white">{ blueprint.overallReadiness.score }%</div>
                            <div className="mt-1 text-sm text-cyan-300">{ blueprint.overallReadiness.label }</div>
                        </div>
                        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4">
                            <div className="text-xs uppercase tracking-[0.2em] text-zinc-500">Elsődleges modell</div>
                            <div className="mt-2 text-lg font-medium text-white">{ blueprint.recommendedMode.primaryCloudProvider }</div>
                            <div className="mt-1 text-sm text-zinc-400">Local fallback: { blueprint.recommendedMode.localFallbackProvider }</div>
                        </div>
                        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4">
                            <div className="text-xs uppercase tracking-[0.2em] text-zinc-500">Desktop shell</div>
                            <div className="mt-2 text-lg font-medium text-white">{ blueprint.recommendedMode.desktopShell }</div>
                            <div className="mt-1 text-sm text-zinc-400">{ new Date( blueprint.generatedAt ).toLocaleString( 'hu-HU' ) }</div>
                        </div>
                    </div>

                    <p className="text-sm leading-6 text-zinc-300">{ blueprint.overallReadiness.summary }</p>
                </CardHeader>
            </Card>

            <div className="grid gap-4 xl:grid-cols-2">
                { blueprint.capabilities.map( ( capability ) =>
                {
                    const status = STATUS_STYLES[capability.status];
                    const Icon = CAPABILITY_ICONS[capability.id as keyof typeof CAPABILITY_ICONS] ?? Sparkles;
                    const StatusIcon = status.icon;
                    return (
                        <Card key={ capability.id } className="border-zinc-800 bg-zinc-950/70">
                            <CardHeader className="space-y-3">
                                <div className="flex items-start justify-between gap-3">
                                    <div className="flex items-start gap-3">
                                        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-2 text-cyan-300">
                                            <Icon className="h-5 w-5" />
                                        </div>
                                        <div>
                                            <CardTitle className="text-base text-white">{ capability.title }</CardTitle>
                                            <p className="mt-1 text-sm text-zinc-400">Pontszám: { capability.score }%</p>
                                        </div>
                                    </div>
                                    <Badge variant="outline" className={ status.badge }>
                                        <StatusIcon className="mr-1 h-3.5 w-3.5" />
                                        { status.label }
                                    </Badge>
                                </div>
                                <p className="text-sm leading-6 text-zinc-300">{ capability.summary }</p>
                            </CardHeader>
                            <CardContent>
                                <ul className="space-y-2 text-sm text-zinc-400">
                                    { capability.details.map( ( detail ) => (
                                        <li key={ detail } className="flex gap-2">
                                            <span className="mt-1 h-1.5 w-1.5 rounded-full bg-cyan-400" />
                                            <span>{ detail }</span>
                                        </li>
                                    ) ) }
                                </ul>
                            </CardContent>
                        </Card>
                    );
                } ) }
            </div>

            <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
                <Card className="border-zinc-800 bg-zinc-950/70">
                    <CardHeader>
                        <CardTitle className="text-white">Ajánlott architektúra</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        { blueprint.architecture.map( ( layer ) => (
                            <div key={ layer.id } className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4">
                                <div className="flex items-center justify-between gap-3">
                                    <h3 className="text-sm font-semibold text-white">{ layer.title }</h3>
                                    <Badge variant="outline" className="border-zinc-700 text-zinc-300">{ layer.modules.length } modul</Badge>
                                </div>
                                <p className="mt-2 text-sm leading-6 text-zinc-300">{ layer.summary }</p>
                                <p className="mt-2 text-sm text-zinc-400">{ layer.purpose }</p>
                                <div className="mt-3 flex flex-wrap gap-2">
                                    { layer.modules.map( ( moduleName ) => (
                                        <Badge key={ moduleName } variant="secondary" className="bg-zinc-800 text-zinc-200">
                                            { moduleName }
                                        </Badge>
                                    ) ) }
                                </div>
                                { layer.nextUpgrade ? (
                                    <div className="mt-3 rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-3 text-sm text-cyan-100">
                                        Következő upgrade: { layer.nextUpgrade }
                                    </div>
                                ) : null }
                            </div>
                        ) ) }
                    </CardContent>
                </Card>

                <div className="space-y-4">
                    <Card className="border-zinc-800 bg-zinc-950/70">
                        <CardHeader>
                            <CardTitle className="text-white">Roadmap</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            { blueprint.roadmap.map( ( phase ) => (
                                <div key={ phase.id } className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4">
                                    <div className="text-xs uppercase tracking-[0.2em] text-zinc-500">{ phase.id }</div>
                                    <div className="mt-1 text-sm font-semibold text-white">{ phase.title }</div>
                                    <p className="mt-2 text-sm text-zinc-400">{ phase.goal }</p>
                                </div>
                            ) ) }
                        </CardContent>
                    </Card>

                    <Card className="border-zinc-800 bg-zinc-950/70">
                        <CardHeader>
                            <CardTitle className="text-white">Azonnali következő lépések</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <ul className="space-y-3 text-sm text-zinc-300">
                                { blueprint.nextActions.map( ( action ) => (
                                    <li key={ action } className="flex gap-2">
                                        <span className="mt-1 h-1.5 w-1.5 rounded-full bg-emerald-400" />
                                        <span>{ action }</span>
                                    </li>
                                ) ) }
                            </ul>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
