import { useCallback, useEffect, useMemo, useState, type ChangeEvent } from 'react';
import
    {
        CheckCircle2,
        Clock3,
        ExternalLink,
        Globe2,
        Loader2,
        Mail,
        RefreshCw,
        Search,
        Sparkles,
        Target,
        Users,
    } from 'lucide-react';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Input } from '../ui/input';
import { ScrollArea } from '../ui/scroll-area';
import { toast } from 'sonner';
import { useSocket } from '../../context/SocketContext';
import { useBusinessStore } from '../../lib/businessStore';
import type { BusinessJob } from '../../types/dashboard';

interface LeadMiningLead
{
    company_name?: string;
    name?: string;
    website?: string;
    url?: string;
    contact_email?: string;
    email?: string;
    email_status?: string;
    icebreaker_text?: string;
    icebreaker?: string;
    industry?: string;
    [key: string]: unknown;
}

interface LeadMiningResults
{
    jobId?: string;
    query?: string;
    leadType?: string;
    limit?: number;
    syncCount?: number;
    leads?: LeadMiningLead[];
}

const DEFAULT_QUERY = 'fogorvos Budapest';
const DEFAULT_LIMIT = '10';

function isRecord ( value: unknown ): value is Record<string, unknown>
{
    return typeof value === 'object' && value !== null && !Array.isArray( value );
}

function parseLeadArray ( value: unknown ): LeadMiningLead[]
{
    if ( Array.isArray( value ) )
    {
        return value.filter( isRecord ) as LeadMiningLead[];
    }

    if ( isRecord( value ) )
    {
        if ( Array.isArray( value.leads ) )
        {
            return value.leads.filter( isRecord ) as LeadMiningLead[];
        }

        if ( Array.isArray( value.data ) )
        {
            return value.data.filter( isRecord ) as LeadMiningLead[];
        }
    }

    return [];
}

function parseResults ( job: BusinessJob | null ): LeadMiningResults | null
{
    if ( !job?.results_json )
    {
        return null;
    }

    try
    {
        const parsed = JSON.parse( job.results_json ) as unknown;

        if ( Array.isArray( parsed ) )
        {
            return { leads: parseLeadArray( parsed ) };
        }

        if ( isRecord( parsed ) )
        {
            const results = parsed as LeadMiningResults & { data?: unknown };
            return {
                ...results,
                leads: parseLeadArray( results.leads ?? results.data ),
            };
        }
    } catch
    {
        return null;
    }

    return null;
}

function formatDateTime ( value?: string | null ): string
{
    if ( !value )
    {
        return '—';
    }

    const date = new Date( value );
    if ( Number.isNaN( date.getTime() ) )
    {
        return value;
    }

    return date.toLocaleString( 'hu-HU', {
        year: 'numeric',
        month: 'short',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
    } );
}

function getJobStatusClasses ( status: BusinessJob['status'] ): string
{
    switch ( status )
    {
        case 'completed':
            return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700';
        case 'running':
            return 'border-blue-500/30 bg-blue-500/10 text-blue-700';
        case 'failed':
            return 'border-rose-500/30 bg-rose-500/10 text-rose-700';
        default:
            return 'border-muted bg-muted/30 text-muted-foreground';
    }
}

export function LeadMiningWidget ()
{
    const { jobs, isLoading, fetchJobs, createJob } = useBusinessStore();
    const { socket } = useSocket();
    const [query, setQuery] = useState( DEFAULT_QUERY );
    const [limit, setLimit] = useState( DEFAULT_LIMIT );
    const [selectedJobId, setSelectedJobId] = useState<string | null>( null );

    const refreshJobs = useCallback( async () =>
    {
        await fetchJobs( 'lead_mining' );
    }, [fetchJobs] );

    useEffect( () =>
    {
        void refreshJobs();
    }, [refreshJobs] );

    useEffect( () =>
    {
        if ( !socket || typeof socket.on !== 'function' )
        {
            return;
        }

        const handleBusinessJobUpdate = ( payload: { type?: string } ) =>
        {
            if ( !payload?.type || payload.type === 'lead_mining' )
            {
                void refreshJobs();
            }
        };

        socket.on( 'business_job:updated', handleBusinessJobUpdate );

        return () =>
        {
            if ( typeof socket.off === 'function' )
            {
                socket.off( 'business_job:updated', handleBusinessJobUpdate );
            }
        };
    }, [socket, refreshJobs] );

    const leadJobs: BusinessJob[] = useMemo(
        () => jobs
            .filter( ( job ) => job.type === 'lead_mining' )
            .slice()
            .sort( ( left, right ) => new Date( right.created_at ).getTime() - new Date( left.created_at ).getTime() ),
        [jobs],
    );

    useEffect( () =>
    {
        if ( !leadJobs.length )
        {
            return;
        }

        const stillExists = selectedJobId && leadJobs.some( ( job: BusinessJob ) => job.id === selectedJobId );
        if ( !stillExists )
        {
            setSelectedJobId( leadJobs[0].id );
        }
    }, [leadJobs, selectedJobId] );

    const activeJob = useMemo(
        () => leadJobs.find( ( job: BusinessJob ) => job.id === selectedJobId ) ?? leadJobs[0] ?? null,
        [leadJobs, selectedJobId],
    );

    const activeResults = useMemo( () => parseResults( activeJob ), [activeJob] );
    const activeLeads = activeResults?.leads ?? [];
    const runningCount = leadJobs.filter( ( job: BusinessJob ) => job.status === 'running' ).length;
    const completedCount = leadJobs.filter( ( job: BusinessJob ) => job.status === 'completed' ).length;
    const totalLeads = useMemo(
        () => leadJobs.reduce( ( sum: number, job: BusinessJob ) => sum + ( parseResults( job )?.leads?.length ?? 0 ), 0 ),
        [leadJobs],
    );

    const handleStartMining = async () =>
    {
        const parsedLimit = Number( limit );
        const normalizedLimit = Number.isFinite( parsedLimit ) && parsedLimit > 0 ? Math.floor( parsedLimit ) : 10;
        const jobId = await createJob( 'lead_mining', query.trim() || DEFAULT_QUERY, {
            metadata: { limit: normalizedLimit },
        } );

        if ( jobId )
        {
            setSelectedJobId( jobId );
            toast.success( 'Lead mining elindítva' );
            return;
        }

        toast.error( 'Nem sikerült elindítani a lead mining folyamatot.' );
    };

    const handleRefresh = async () =>
    {
        await refreshJobs();
        toast.info( 'Lead mining lista frissítve' );
    };

    return (
        <Card className="border-muted/60 bg-card/95 shadow-sm">
            <CardHeader className="space-y-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-1">
                        <CardTitle className="flex items-center gap-2 text-lg">
                            <Target className="h-5 w-5 text-primary" />
                            B2B Lead Mining
                        </CardTitle>
                        <CardDescription>
                            Élő business jobok, lead eredmények és gyors indítás a P-Sales pipeline-hoz.
                        </CardDescription>
                    </div>

                    <Button variant="outline" size="sm" onClick={handleRefresh}>
                        <RefreshCw className="mr-2 h-4 w-4" />
                        Frissítés
                    </Button>
                </div>

                <div className="grid gap-3 lg:grid-cols-[1fr_120px_auto]">
                    <div className="space-y-1">
                        <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Keresés</label>
                        <Input
                            value={query}
                            onChange={( event: ChangeEvent<HTMLInputElement> ) => setQuery( event.target.value )}
                            placeholder="pl. fogorvos Budapest"
                        />
                    </div>

                    <div className="space-y-1">
                        <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Limit</label>
                        <Input
                            type="number"
                            min={1}
                            value={limit}
                            onChange={( event: ChangeEvent<HTMLInputElement> ) => setLimit( event.target.value )}
                            placeholder="10"
                        />
                    </div>

                    <div className="flex items-end">
                        <Button onClick={handleStartMining} disabled={isLoading} className="w-full lg:w-auto">
                            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
                            Lead mining indítása
                        </Button>
                    </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                    <div className="rounded-lg border border-border/60 bg-muted/20 p-3">
                        <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                            <Users className="h-4 w-4" />
                            Lead jobok
                        </div>
                        <div className="mt-2 text-2xl font-semibold">{leadJobs.length}</div>
                    </div>

                    <div className="rounded-lg border border-border/60 bg-muted/20 p-3">
                        <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                            <Loader2 className="h-4 w-4" />
                            Futó jobok
                        </div>
                        <div className="mt-2 text-2xl font-semibold">{runningCount}</div>
                    </div>

                    <div className="rounded-lg border border-border/60 bg-muted/20 p-3">
                        <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                            <Sparkles className="h-4 w-4" />
                            Összes lead
                        </div>
                        <div className="mt-2 text-2xl font-semibold">{totalLeads}</div>
                        <div className="mt-1 text-xs text-muted-foreground">Lezárt futások: {completedCount}</div>
                    </div>
                </div>
            </CardHeader>

            <CardContent>
                <div className="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
                    <Card className="border-muted/60">
                        <CardHeader className="pb-3">
                            <CardTitle className="text-base">Job history</CardTitle>
                            <CardDescription>Az utolsó lead mining futások és státuszuk.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <ScrollArea className="h-[360px] pr-3">
                                <div className="space-y-3">
                                    {leadJobs.length === 0 ? (
                                        <div className="flex h-32 items-center justify-center rounded-lg border border-dashed border-border/60 bg-muted/20 text-sm text-muted-foreground">
                                            Még nincs lead mining job.
                                        </div>
                                    ) : (
                                        leadJobs.map( ( job ) =>
                                        {
                                            const selected = job.id === activeJob?.id;
                                            const jobResults = parseResults( job );
                                            return (
                                                <button
                                                    key={job.id}
                                                    type="button"
                                                    onClick={() => setSelectedJobId( job.id )}
                                                    className={`w-full rounded-lg border p-3 text-left transition-colors ${ selected ? 'border-primary/50 bg-primary/5' : 'border-border/60 bg-background hover:bg-muted/30' }`}
                                                >
                                                    <div className="flex items-start justify-between gap-3">
                                                        <div className="space-y-1">
                                                            <div className="flex items-center gap-2">
                                                                <span className="font-medium">{job.query || jobResults?.query || 'Lead mining job'}</span>
                                                                <Badge variant="outline" className={getJobStatusClasses( job.status )}>
                                                                    {job.status}
                                                                </Badge>
                                                            </div>
                                                            <div className="text-xs text-muted-foreground">
                                                                {formatDateTime( job.created_at )}
                                                            </div>
                                                        </div>

                                                        <div className="text-right text-xs text-muted-foreground">
                                                            <div>{jobResults?.leads?.length ?? 0} lead</div>
                                                            <div>{jobResults?.syncCount ?? 0} sync</div>
                                                        </div>
                                                    </div>
                                                </button>
                                            );
                                        } )
                                    )}
                                </div>
                            </ScrollArea>
                        </CardContent>
                    </Card>

                    <Card className="border-muted/60">
                        <CardHeader className="pb-3">
                            <CardTitle className="text-base">Aktív lead futás</CardTitle>
                            <CardDescription>
                                {activeJob
                                    ? `${ activeJob.query } • ${ activeJob.status }`
                                    : 'Válassz ki egy jobot vagy indíts új mining futást.'}
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            {!activeJob ? (
                                <div className="flex h-48 items-center justify-center rounded-lg border border-dashed border-border/60 bg-muted/20 text-sm text-muted-foreground">
                                    Nincs megjeleníthető lead eredmény.
                                </div>
                            ) : (
                                <div className="space-y-5">
                                    <div className="grid gap-3 sm:grid-cols-3">
                                        <div className="rounded-lg border border-border/60 bg-muted/20 p-3">
                                            <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                                <Clock3 className="h-4 w-4" />
                                                Létrehozva
                                            </div>
                                            <div className="mt-2 text-sm font-medium">{formatDateTime( activeJob.created_at )}</div>
                                        </div>

                                        <div className="rounded-lg border border-border/60 bg-muted/20 p-3">
                                            <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                                <CheckCircle2 className="h-4 w-4" />
                                                Leadek
                                            </div>
                                            <div className="mt-2 text-sm font-medium">{activeLeads.length}</div>
                                        </div>

                                        <div className="rounded-lg border border-border/60 bg-muted/20 p-3">
                                            <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                                <Globe2 className="h-4 w-4" />
                                                Szinkron
                                            </div>
                                            <div className="mt-2 text-sm font-medium">{activeResults?.syncCount ?? 0}</div>
                                        </div>
                                    </div>

                                    <div className="rounded-lg border border-border/60 bg-muted/10 p-4 text-sm text-muted-foreground">
                                        <div className="flex items-center gap-2 text-foreground">
                                            <Sparkles className="h-4 w-4 text-primary" />
                                            <span className="font-medium">Lekérdezés</span>
                                        </div>
                                        <p className="mt-2 break-words">{activeResults?.query ?? activeJob.query}</p>
                                    </div>

                                    <ScrollArea className="h-[300px] pr-3">
                                        <div className="space-y-3">
                                            {activeLeads.length === 0 ? (
                                                <div className="flex h-40 items-center justify-center rounded-lg border border-dashed border-border/60 bg-muted/20 text-sm text-muted-foreground">
                                                    Ebben a futásban még nincs lead eredmény.
                                                </div>
                                            ) : (
                                                activeLeads.map( ( lead, index ) =>
                                                {
                                                    const title = lead.company_name || lead.name || `Lead #${ index + 1 }`;
                                                    const website = lead.website || lead.url;
                                                    const email = lead.contact_email || lead.email;
                                                    return (
                                                        <article key={`${ title }-${ index }`} className="rounded-lg border border-border/60 bg-card p-4 shadow-sm">
                                                            <div className="flex flex-wrap items-start justify-between gap-3">
                                                                <div className="space-y-2">
                                                                    <div className="flex flex-wrap items-center gap-2">
                                                                        <h3 className="font-semibold">{title}</h3>
                                                                        {lead.email_status ? (
                                                                            <Badge variant="outline">{lead.email_status}</Badge>
                                                                        ) : null}
                                                                    </div>
                                                                    {lead.industry ? (
                                                                        <p className="text-xs uppercase tracking-wide text-muted-foreground">{lead.industry}</p>
                                                                    ) : null}
                                                                </div>

                                                                {website ? (
                                                                    <Button variant="ghost" size="sm" asChild>
                                                                        <a href={website} target="_blank" rel="noreferrer">
                                                                            <ExternalLink className="mr-2 h-4 w-4" />
                                                                            Web
                                                                        </a>
                                                                    </Button>
                                                                ) : null}
                                                            </div>

                                                            <div className="mt-4 grid gap-3 text-sm text-muted-foreground sm:grid-cols-2">
                                                                <div className="flex items-start gap-2">
                                                                    <Mail className="mt-0.5 h-4 w-4 shrink-0" />
                                                                    <span>{email || 'Nincs email'}</span>
                                                                </div>

                                                                <div className="flex items-start gap-2">
                                                                    <Globe2 className="mt-0.5 h-4 w-4 shrink-0" />
                                                                    <span>{website || 'Nincs weboldal'}</span>
                                                                </div>
                                                            </div>

                                                            {lead.icebreaker_text || lead.icebreaker ? (
                                                                <p className="mt-4 rounded-md border border-border/60 bg-muted/30 p-3 text-sm text-foreground">
                                                                    {lead.icebreaker_text || lead.icebreaker}
                                                                </p>
                                                            ) : null}
                                                        </article>
                                                    );
                                                } )
                                            )}
                                        </div>
                                    </ScrollArea>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </CardContent>
        </Card>
    );
}
