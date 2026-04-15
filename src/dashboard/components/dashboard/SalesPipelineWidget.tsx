import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, BarChart3, Filter, Loader2, RefreshCw, Send, Zap } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';

interface LeadItem
{
    id: string;
    company_name: string;
    contact_person?: string | null;
    contact_email?: string | null;
    status: string;
    last_interaction_at?: string | null;
    email_status?: string | null;
    outreach_status?: string | null;
    icebreaker_text?: string | null;
    demo_url?: string | null;
}

interface PipelineStat
{
    status: string;
    count: number;
}

interface Stage
{
    id: string;
    label: string;
    color: string;
}

interface PipelineStatsResponse
{
    success?: boolean;
    stats?: PipelineStat[];
    error?: string;
}

interface LeadsResponse
{
    success?: boolean;
    leads?: LeadItem[];
    error?: string;
}

const STAGES: Stage[] = [
    { id: 'new', label: 'Új Leadek', color: 'bg-blue-500' },
    { id: 'outreach', label: 'Megkeresés', color: 'bg-purple-500' },
    { id: 'responded', label: 'Válaszolt', color: 'bg-orange-500' },
    { id: 'meeting', label: 'Tárgyalás', color: 'bg-yellow-500' },
    { id: 'loi', label: 'Szándéknyilatkozat', color: 'bg-emerald-500' },
    { id: 'closed', label: 'Lezárva', color: 'bg-green-600' },
];

const OTHER_STAGE: Stage = { id: 'other', label: 'Egyéb', color: 'bg-slate-500' };
const DISPLAY_STAGES = [...STAGES, OTHER_STAGE];

function isKnownStage ( status: string ): boolean
{
    return STAGES.some( ( stage ) => stage.id === status );
}

function resolveStageId ( status: string ): string
{
    return isKnownStage( status ) ? status : OTHER_STAGE.id;
}

function normalizeStats ( stats: PipelineStat[] ): Record<string, number>
{
    return stats.reduce<Record<string, number>>( ( acc, item ) =>
    {
        acc[item.status] = item.count;
        return acc;
    }, {} );
}

function buildStageStats ( leads: LeadItem[] ): Record<string, number>
{
    return DISPLAY_STAGES.reduce<Record<string, number>>( ( acc, stage ) =>
    {
        acc[stage.id] = leads.filter( ( lead ) => resolveStageId( lead.status ) === stage.id ).length;
        return acc;
    }, {} );
}

function toErrorMessage ( error: unknown ): string
{
    return error instanceof Error ? error.message : String( error );
}

function statusLabel ( status: string ): string
{
    switch ( status )
    {
        case 'new':
            return 'Új';
        case 'outreach':
            return 'Küldve';
        case 'responded':
            return 'Válasz';
        case 'meeting':
            return 'Meeting';
        case 'loi':
            return 'LOI';
        case 'closed':
            return 'Lezárt';
        case 'other':
            return 'Egyéb';
        default:
            return status.replaceAll( '_', ' ' );
    }
}

async function readPipelineResponse<T> ( response: Response, resourceLabel: string ): Promise<T>
{
    if ( !response.ok )
    {
        const errorText = await response.text().catch( () => '' );
        throw new Error( `${ resourceLabel } lekérés sikertelen (${ response.status })${ errorText ? `: ${ errorText }` : '' }` );
    }

    const payload = ( await response.json() ) as T & { success?: boolean; error?: string };
    if ( payload && typeof payload === 'object' && 'success' in payload && payload.success === false )
    {
        throw new Error( payload.error ?? `${ resourceLabel } lekérés sikertelen` );
    }

    return payload;
}

export function SalesPipelineWidget ()
{
    const [isLoadingLeads, setIsLoadingLeads] = useState( true );
    const [leads, setLeads] = useState<LeadItem[]>( [] );
    const [pipelineStats, setPipelineStats] = useState<Record<string, number>>( {} );
    const [loadError, setLoadError] = useState<string | null>( null );
    const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>( null );

    const visibleStages = useMemo( () =>
    {
        const hasUnmappedLead = leads.some( ( lead ) => !isKnownStage( lead.status ) );
        return hasUnmappedLead ? DISPLAY_STAGES : STAGES;
    }, [leads] );

    const stats = useMemo( () =>
    {
        return Object.keys( pipelineStats ).length > 0 ? pipelineStats : buildStageStats( leads );
    }, [leads, pipelineStats] );

    const groupedLeads = useMemo( () =>
    {
        return visibleStages.reduce<Record<string, LeadItem[]>>( ( acc, stage ) =>
        {
            acc[stage.id] = leads.filter( ( lead ) => resolveStageId( lead.status ) === stage.id );
            return acc;
        }, {} );
    }, [leads, visibleStages] );

    const loadPipelineData = useCallback( async ( notifyOnSuccess: boolean ) =>
    {
        setIsLoadingLeads( true );
        setLoadError( null );

        const [statsResult, leadsResult] = await Promise.allSettled( [
            fetch( '/api/v1/business-jobs/pipeline/stats' ),
            fetch( '/api/v1/business-jobs/leads/all' ),
        ] );

        let nextStats: Record<string, number> = {};
        let nextLeads: LeadItem[] = [];
        let statsFailure: string | null = null;
        let leadsFailure: string | null = null;

        if ( statsResult.status === 'fulfilled' )
        {
            try
            {
                const payload = await readPipelineResponse<PipelineStatsResponse>( statsResult.value, 'Pipeline statisztikák' );
                nextStats = normalizeStats( payload.stats ?? [] );
            } catch ( error: unknown )
            {
                statsFailure = toErrorMessage( error );
            }
        } else
        {
            statsFailure = toErrorMessage( statsResult.reason );
        }

        if ( leadsResult.status === 'fulfilled' )
        {
            try
            {
                const payload = await readPipelineResponse<LeadsResponse>( leadsResult.value, 'Lead lista' );
                nextLeads = ( payload.leads ?? [] ).map( ( lead ) => ( {
                    ...lead,
                    contact_person: lead.contact_person ?? null,
                    contact_email: lead.contact_email ?? null,
                    last_interaction_at: lead.last_interaction_at ?? null,
                    email_status: lead.email_status ?? null,
                    outreach_status: lead.outreach_status ?? null,
                    icebreaker_text: lead.icebreaker_text ?? null,
                    demo_url: lead.demo_url ?? null,
                } ) );
            } catch ( error: unknown )
            {
                leadsFailure = toErrorMessage( error );
            }
        } else
        {
            leadsFailure = toErrorMessage( leadsResult.reason );
        }

        setPipelineStats( nextStats );
        setLeads( nextLeads );

        const failedResources = [
            statsFailure ? 'statisztika' : null,
            leadsFailure ? 'lead lista' : null,
        ].filter( ( item ): item is string => Boolean( item ) );

        if ( failedResources.length > 0 )
        {
            const message = failedResources.length === 2
                ? 'A sales pipeline adatai nem töltődtek be.'
                : `A sales pipeline ${ failedResources[0] } része nem töltődött be.`;
            setLoadError( message );
            if ( notifyOnSuccess )
            {
                toast.warning( message );
            }
        } else if ( notifyOnSuccess )
        {
            toast.success( 'Sales pipeline frissítve.' );
        }

        setLastUpdatedAt( new Date().toISOString() );
        setIsLoadingLeads( false );
    }, [] );

    useEffect( () =>
    {
        void loadPipelineData( false ).catch( ( error: unknown ) =>
        {
            const message = toErrorMessage( error );
            setLoadError( message );
            setIsLoadingLeads( false );
            toast.error( message );
        } );
    }, [loadPipelineData] );

    const refreshData = useCallback( () =>
    {
        void loadPipelineData( true ).catch( ( error: unknown ) =>
        {
            const message = toErrorMessage( error );
            setLoadError( message );
            setIsLoadingLeads( false );
            toast.error( message );
        } );
    }, [loadPipelineData] );

    const activeCount = ( stats.outreach ?? 0 ) + ( stats.responded ?? 0 ) + ( stats.meeting ?? 0 ) + ( stats.loi ?? 0 );
    const hasLoadData = leads.length > 0 || Object.keys( stats ).length > 0;

    return (
        <Card className="w-full overflow-hidden border-primary/20 bg-slate-950/70 shadow-2xl shadow-black/20 backdrop-blur-xl">
            <CardHeader className="border-b border-white/[0.04] bg-white/[0.02] pb-3">
                <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                        <div className="rounded-full bg-primary/10 p-2">
                            <BarChart3 className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                            <CardTitle>Sales Pipeline</CardTitle>
                            <CardDescription>Aktív üzleti folyamatok és tölcsér követés · élő DB nézet</CardDescription>
                            {lastUpdatedAt && (
                                <p className="mt-1 text-[11px] uppercase tracking-[0.24em] text-slate-500">
                                    Utolsó frissítés: {format( new Date( lastUpdatedAt ), 'MMM d. HH:mm' )}
                                </p>
                            )}
                        </div>
                    </div>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={refreshData}
                        disabled={isLoadingLeads}
                        aria-label="Sales pipeline frissítése"
                    >
                        {isLoadingLeads ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                    </Button>
                </div>
            </CardHeader>

            <CardContent className="space-y-4 p-4">
                {loadError && (
                    <div
                        role="alert"
                        className={`flex items-start gap-3 rounded-2xl border px-4 py-3 text-sm ${ hasLoadData
                            ? 'border-amber-500/30 bg-amber-500/10 text-amber-100'
                            : 'border-red-500/30 bg-red-500/10 text-red-100'
                            }`}
                    >
                        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                        <span>{loadError}</span>
                    </div>
                )}

                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {[
                        { label: 'Új', value: stats.new ?? 0, tone: 'text-blue-300' },
                        { label: 'Futó', value: activeCount, tone: 'text-cyan-300' },
                        { label: 'Lezárt', value: stats.closed ?? 0, tone: 'text-emerald-300' },
                    ].map( ( item ) => (
                        <div key={item.label} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4" aria-label={`Összegzés: ${ item.label }`}>
                            <p className="text-[11px] uppercase tracking-[0.24em] text-slate-400">{item.label}</p>
                            <p className={`mt-2 text-2xl font-semibold ${ item.tone }`}>{item.value}</p>
                        </div>
                    ) )}
                </div>

                <div className="flex gap-4 overflow-x-auto pb-2">
                    {visibleStages.map( ( stage ) => (
                        <div
                            key={stage.id}
                            className="min-w-[260px] flex-1 rounded-2xl border border-white/10 bg-white/[0.02] p-3"
                            aria-label={`Stage: ${ stage.label }`}
                        >
                            <div className="mb-3 flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2">
                                    <span className={`h-2.5 w-2.5 rounded-full ${ stage.color }`} />
                                    <span className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">{stage.label}</span>
                                </div>
                                <Badge variant="secondary" className="border-white/10 bg-white/5 text-[10px] text-slate-200">
                                    {groupedLeads[stage.id]?.length ?? 0}
                                </Badge>
                            </div>

                            <div className="h-[420px] space-y-3 overflow-y-auto pr-2 custom-scrollbar">
                                {( groupedLeads[stage.id] ?? [] ).map( ( lead ) => (
                                    <article key={lead.id} className="rounded-xl border border-white/10 bg-slate-950/60 p-4" aria-label={`Lead: ${ lead.company_name }`}>
                                        <div className="flex items-start justify-between gap-3">
                                            <div>
                                                <h4 className="text-sm font-semibold text-white">{lead.company_name}</h4>
                                                <p className="text-xs text-slate-400">{lead.contact_person ?? lead.contact_email ?? '—'}</p>
                                            </div>
                                            <Badge variant="secondary" className="border-white/10 bg-white/5 text-[10px] text-slate-200">
                                                {statusLabel( lead.status )}
                                            </Badge>
                                        </div>

                                        {lead.last_interaction_at && (
                                            <div className="mt-3 flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-slate-500">
                                                <Zap className="h-3.5 w-3.5 text-amber-300" />
                                                {format( new Date( lead.last_interaction_at ), 'MMM d. HH:mm' )}
                                            </div>
                                        )}

                                        {( lead.email_status || lead.outreach_status ) && (
                                            <div className="mt-3 flex flex-wrap gap-2">
                                                {lead.email_status && (
                                                    <Badge variant="secondary" className="border-white/10 bg-white/5 text-[10px] text-slate-200">
                                                        Email: {lead.email_status}
                                                    </Badge>
                                                )}
                                                {lead.outreach_status && (
                                                    <Badge variant="secondary" className="border-white/10 bg-white/5 text-[10px] text-slate-200">
                                                        Outreach: {lead.outreach_status}
                                                    </Badge>
                                                )}
                                            </div>
                                        )}

                                        <div className="mt-4 flex gap-2">
                                            <Button size="sm" variant="outline" className="h-8 flex-1 border-white/10 bg-white/[0.03] text-xs">
                                                Adatlap
                                            </Button>
                                            <Button size="sm" className="h-8 flex-1 text-xs" variant="secondary" disabled>
                                                <Send className="mr-2 h-3.5 w-3.5" /> Email
                                            </Button>
                                        </div>
                                    </article>
                                ) )}

                                {( groupedLeads[stage.id]?.length ?? 0 ) === 0 && (
                                    <div className="flex h-24 items-center justify-center rounded-xl border border-dashed border-white/10 text-xs text-slate-500">
                                        <Filter className="mr-2 h-4 w-4" /> Üres szakasz
                                    </div>
                                )}
                            </div>
                        </div>
                    ) )}
                </div>
            </CardContent>
        </Card>
    );
}
