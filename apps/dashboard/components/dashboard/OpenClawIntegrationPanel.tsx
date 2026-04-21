import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, RefreshCcw, ShieldCheck, ShieldX, Workflow } from 'lucide-react';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { ScrollArea } from '../ui/scroll-area';

type TrustZone = 'green' | 'amber' | 'red';

type RuntimeState = 'unconfigured' | 'offline' | 'ready' | 'degraded';

interface OpenClawConfigSnapshot
{
    baseUrl: string | null;
    timeoutMs: number;
    retryCount: number;
    retryDelayMs: number;
    defaultTrustZone: TrustZone;
    approvalThreshold: TrustZone;
    enabled: boolean;
    allowedAgents: string[];
    allowedToolPresets: string[];
    agentAllowlists: Record<string, string[]>;
    redaction: {
        enabled: boolean;
        mask: string;
        sensitiveKeys: string[];
    };
}

interface OpenClawStatusSnapshot
{
    state: RuntimeState;
    configured: boolean;
    reachable: boolean;
    baseUrl?: string | null;
    defaultTrustZone: TrustZone;
    approvalThreshold: TrustZone;
    enabledExecutors: string[];
    redactionEnabled: boolean;
    lastCheckedAt: string;
    message?: string;
    details?: Record<string, unknown>;
}

interface OpenClawRuntimeSnapshot
{
    config: OpenClawConfigSnapshot;
    status: OpenClawStatusSnapshot;
}

interface OpenClawStatusResponse
{
    success: boolean;
    data?: {
        snapshot: OpenClawRuntimeSnapshot;
        health: OpenClawStatusSnapshot;
    };
    error?: string;
}

function statusTone ( state: RuntimeState ): 'default' | 'secondary' | 'destructive'
{
    switch ( state )
    {
        case 'ready':
            return 'secondary';
        case 'offline':
        case 'degraded':
            return 'destructive';
        case 'unconfigured':
        default:
            return 'default';
    }
}

function statusIcon ( state: RuntimeState )
{
    if ( state === 'ready' )
    {
        return <ShieldCheck className="h-4 w-4" />;
    }
    if ( state === 'offline' || state === 'degraded' )
    {
        return <ShieldX className="h-4 w-4" />;
    }
    return <AlertTriangle className="h-4 w-4" />;
}

function trustTone ( zone: TrustZone ): 'default' | 'secondary' | 'destructive'
{
    switch ( zone )
    {
        case 'green':
            return 'secondary';
        case 'amber':
            return 'default';
        case 'red':
        default:
            return 'destructive';
    }
}

function formatDate ( value: string ): string
{
    const parsed = new Date( value );
    return Number.isNaN( parsed.getTime() ) ? value : parsed.toLocaleString();
}

export function OpenClawIntegrationPanel ()
{
    const [snapshot, setSnapshot] = useState<OpenClawRuntimeSnapshot | null>( null );
    const [health, setHealth] = useState<OpenClawStatusSnapshot | null>( null );
    const [loading, setLoading] = useState( true );
    const [refreshing, setRefreshing] = useState( false );
    const [error, setError] = useState<string | null>( null );

    const loadStatus = useCallback( async () =>
    {
        setRefreshing( true );
        try
        {
            const response = await fetch( '/api/v1/openclaw/status', {
                headers: {
                    Accept: 'application/json',
                },
            } );
            const payload = await response.json() as OpenClawStatusResponse;
            if ( !response.ok || !payload.success || !payload.data )
            {
                throw new Error( payload.error ?? `OpenClaw status request failed with HTTP ${ response.status }` );
            }
            setSnapshot( payload.data.snapshot );
            setHealth( payload.data.health );
            setError( null );
        } catch ( err )
        {
            const message = err instanceof Error ? err.message : 'Unknown OpenClaw status error';
            setError( message );
        } finally
        {
            setRefreshing( false );
            setLoading( false );
        }
    }, [] );

    useEffect( () =>
    {
        void loadStatus();
    }, [loadStatus] );

    const summary = useMemo( () =>
    {
        if ( !snapshot )
        {
            return null;
        }

        return {
            trustZone: snapshot.status.defaultTrustZone,
            approvalThreshold: snapshot.status.approvalThreshold,
            executors: snapshot.status.enabledExecutors.length,
            redaction: snapshot.status.redactionEnabled,
        };
    }, [snapshot] );

    return (
        <Card className="border-dashed border-2 border-slate-200 dark:border-slate-700">
            <CardHeader className="space-y-2">
                <div className="flex items-center justify-between gap-4">
                    <div className="space-y-1">
                        <CardTitle className="flex items-center gap-2 text-base">
                            <Workflow className="h-4 w-4 text-slate-600 dark:text-slate-300" />
                            OpenClaw Bridge
                        </CardTitle>
                        <CardDescription>
                            Sandboxed execution plane status, trust-zone policy and approval readiness.
                        </CardDescription>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => void loadStatus()} disabled={refreshing}>
                        <RefreshCcw className={`mr-2 h-4 w-4 ${ refreshing ? 'animate-spin' : '' }`} />
                        Refresh
                    </Button>
                </div>
            </CardHeader>

            <CardContent className="space-y-4">
                {loading ? (
                    <div className="text-sm text-slate-500">Loading OpenClaw status…</div>
                ) : error ? (
                    <div className="rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300">
                        {error}
                    </div>
                ) : null}

                {snapshot && health ? (
                    <div className="space-y-4">
                        <div className="flex flex-wrap items-center gap-2">
                            <Badge variant={statusTone( health.state )} className="flex items-center gap-1">
                                {statusIcon( health.state )}
                                {health.state}
                            </Badge>
                            <Badge variant={trustTone( snapshot.config.defaultTrustZone )}>
                                Default zone: {snapshot.config.defaultTrustZone}
                            </Badge>
                            <Badge variant={trustTone( snapshot.status.approvalThreshold )}>
                                Approval threshold: {snapshot.status.approvalThreshold}
                            </Badge>
                            <Badge variant={snapshot.status.redactionEnabled ? 'secondary' : 'default'}>
                                {snapshot.status.redactionEnabled ? 'Redaction enabled' : 'Redaction disabled'}
                            </Badge>
                        </div>

                        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                            <div className="rounded-lg border p-3">
                                <div className="text-xs uppercase text-muted-foreground">Base URL</div>
                                <div className="mt-1 break-all text-sm font-medium">{snapshot.config.baseUrl ?? 'Not configured'}</div>
                            </div>
                            <div className="rounded-lg border p-3">
                                <div className="text-xs uppercase text-muted-foreground">Executors</div>
                                <div className="mt-1 text-sm font-medium">{summary?.executors ?? 0} allowed executor(s)</div>
                            </div>
                            <div className="rounded-lg border p-3">
                                <div className="text-xs uppercase text-muted-foreground">Timeout / retries</div>
                                <div className="mt-1 text-sm font-medium">
                                    {snapshot.config.timeoutMs} ms / {snapshot.config.retryCount} retry(s)
                                </div>
                            </div>
                            <div className="rounded-lg border p-3">
                                <div className="text-xs uppercase text-muted-foreground">Last checked</div>
                                <div className="mt-1 text-sm font-medium">{formatDate( health.lastCheckedAt )}</div>
                            </div>
                        </div>

                        <ScrollArea className="h-40 rounded-lg border bg-muted/20 p-3">
                            <div className="space-y-3 text-sm">
                                <div>
                                    <div className="text-xs uppercase text-muted-foreground">Message</div>
                                    <div className="mt-1">{health.message ?? 'No status message returned.'}</div>
                                </div>
                                <div>
                                    <div className="text-xs uppercase text-muted-foreground">Allowed executors</div>
                                    <div className="mt-1 flex flex-wrap gap-2">
                                        {health.enabledExecutors.length > 0 ? health.enabledExecutors.map( ( executor ) => (
                                            <Badge key={executor} variant="outline">
                                                {executor}
                                            </Badge>
                                        ) ) : (
                                            <span className="text-muted-foreground">None configured</span>
                                        )}
                                    </div>
                                </div>
                                <div>
                                    <div className="text-xs uppercase text-muted-foreground">Policy notes</div>
                                    <pre className="mt-1 whitespace-pre-wrap break-words rounded-md bg-background p-2 text-xs">
                                        {JSON.stringify( {
                                            redaction: snapshot.config.redaction,
                                            agentAllowlists: snapshot.config.agentAllowlists,
                                            healthDetails: health.details ?? {},
                                        }, null, 2 )}
                                    </pre>
                                </div>
                            </div>
                        </ScrollArea>
                    </div>
                ) : null}
            </CardContent>
        </Card>
    );
}
