import { useCallback, useEffect, useState } from 'react';
import { Bell, RefreshCcw, Send, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useSocket } from '@/context/SocketContext';
import
{
    dispatchApprovalWorkflowNotification,
    getApprovalNotificationDeliveries,
    getApprovalNotificationSummary,
    type ApprovalNotificationDelivery,
    type ApprovalNotificationSummary,
} from '@/lib/apiService';

function formatTimestamp ( timestamp: string ): string
{
    const parsed = new Date( timestamp );
    if ( Number.isNaN( parsed.getTime() ) )
    {
        return timestamp;
    }

    return parsed.toLocaleString( 'hu-HU' );
}

function statusTone ( status: ApprovalNotificationDelivery['status'] ): string
{
    if ( status === 'sent' ) return 'text-emerald-400';
    if ( status === 'failed' ) return 'text-red-400';
    return 'text-yellow-400';
}

function statusLabel ( status: ApprovalNotificationDelivery['status'] ): string
{
    if ( status === 'sent' ) return 'KÉZBESÍTVE';
    if ( status === 'failed' ) return 'HIBA';
    return 'SKIP';
}

function channelTone ( channel: ApprovalNotificationDelivery['channel'] ): string
{
    if ( channel === 'email' ) return 'bg-blue-500/10 text-blue-300 border-blue-500/20';
    if ( channel === 'slack' ) return 'bg-violet-500/10 text-violet-300 border-violet-500/20';
    if ( channel === 'discord' ) return 'bg-indigo-500/10 text-indigo-300 border-indigo-500/20';
    return 'bg-zinc-500/10 text-zinc-300 border-zinc-500/20';
}

function StatTile ( { label, value, tone }: { label: string; value: number; tone: string } )
{
    return (
        <div className="rounded-lg border border-white/[0.04] bg-white/[0.02] p-2 text-center">
            <p className="text-[8px] uppercase font-mono text-zinc-500">{ label }</p>
            <p className={ `text-sm font-bold ${ tone }` }>{ value }</p>
        </div>
    );
}

export function ZeroPromptNotificationPanel ()
{
    const { socket } = useSocket();
    const [summary, setSummary] = useState<ApprovalNotificationSummary | null>( null );
    const [deliveries, setDeliveries] = useState<ApprovalNotificationDelivery[]>( [] );
    const [loading, setLoading] = useState( true );
    const [error, setError] = useState<string | null>( null );
    const [dispatchingWorkflowId, setDispatchingWorkflowId] = useState<string | null>( null );

    const refreshData = useCallback( async () =>
    {
        setLoading( true );
        try
        {
            const [summaryResponse, deliveriesResponse] = await Promise.all( [
                getApprovalNotificationSummary(),
                getApprovalNotificationDeliveries( 10 ),
            ] );
            setSummary( summaryResponse );
            setDeliveries( deliveriesResponse );
            setError( null );
        } catch ( refreshError: unknown )
        {
            const message = refreshError instanceof Error ? refreshError.message : String( refreshError );
            setError( message );
        } finally
        {
            setLoading( false );
        }
    }, [] );

    useEffect( () =>
    {
        void refreshData();
        const interval = window.setInterval( () =>
        {
            void refreshData();
        }, 30000 );

        return () => window.clearInterval( interval );
    }, [refreshData] );

    useEffect( () =>
    {
        if ( !socket )
        {
            return;
        }

        const refreshOnApprovalEvent = () =>
        {
            void refreshData();
        };

        socket.on( 'phoenix:approval_requested', refreshOnApprovalEvent );
        socket.on( 'phoenix:approval_resolved', refreshOnApprovalEvent );

        return () =>
        {
            socket.off( 'phoenix:approval_requested', refreshOnApprovalEvent );
            socket.off( 'phoenix:approval_resolved', refreshOnApprovalEvent );
        };
    }, [refreshData, socket] );

    const resendWorkflowNotification = async ( workflowId?: string ) =>
    {
        if ( !workflowId )
        {
            toast.error( 'Ehhez a kézbesítéshez nincs workflow azonosító.' );
            return;
        }

        setDispatchingWorkflowId( workflowId );
        try
        {
            const resent = await dispatchApprovalWorkflowNotification( workflowId );
            toast.success( `${ resent.length } kézbesítés újraküldve.` );
            await refreshData();
        } catch ( dispatchError: unknown )
        {
            const message = dispatchError instanceof Error ? dispatchError.message : String( dispatchError );
            toast.error( `Újraküldés sikertelen: ${ message }` );
        } finally
        {
            setDispatchingWorkflowId( null );
        }
    };

    const availableChannels = summary?.availableChannels ?? [];

    return (
        <Card className="glass-card border-white/[0.04] bg-white/[0.03] backdrop-blur-xl h-full flex flex-col">
            <CardHeader className="p-4 border-b border-white/[0.04]">
                <CardTitle className="flex items-center justify-between text-xs font-bold tracking-widest uppercase text-white">
                    <span className="flex items-center gap-2">
                        <Bell size={ 16 } className="text-amber-400" />
                        Zero-Prompt Értesítések
                    </span>
                    <div className="flex items-center gap-2">
                        <Badge variant={ error ? 'destructive' : loading ? 'secondary' : 'default' }>
                            { error ? 'HIBA' : loading ? 'FRISSÍTÉS' : 'ÉLŐ' }
                        </Badge>
                        <Button variant="outline" size="sm" className="h-7" onClick={ () => void refreshData() }>
                            <RefreshCcw size={ 12 } className="mr-1" />
                            Frissítés
                        </Button>
                    </div>
                </CardTitle>
            </CardHeader>

            <CardContent className="p-4 flex-1 flex flex-col gap-4">
                { error ? (
                    <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-300">{ error }</div>
                ) : null }

                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    <StatTile label="Pending" value={ summary?.workflowCounts.pending ?? 0 } tone="text-yellow-400" />
                    <StatTile label="Kézbesítve" value={ summary?.sent ?? 0 } tone="text-emerald-400" />
                    <StatTile label="Hiba" value={ summary?.failed ?? 0 } tone="text-red-400" />
                    <StatTile label="Skip" value={ summary?.skipped ?? 0 } tone="text-zinc-300" />
                </div>

                <div className="rounded-xl border border-white/[0.04] bg-zinc-900/50 p-3 space-y-3">
                    <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-zinc-400 font-mono">
                        <ShieldCheck size={ 13 } className="text-emerald-400" />
                        Elérhető csatornák
                    </div>
                    <div className="flex flex-wrap gap-2">
                        { availableChannels.length > 0 ? availableChannels.map( ( channel ) => (
                            <Badge
                                key={ channel.channel }
                                variant="outline"
                                className={ channel.enabled ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300' : 'border-zinc-500/20 bg-zinc-500/10 text-zinc-400' }
                            >
                                { channel.channel.toUpperCase() } { channel.enabled ? 'ON' : 'OFF' }
                            </Badge>
                        ) ) : (
                            <p className="text-xs text-zinc-500">Nincs csatorna metaadat.</p>
                        ) }
                    </div>
                    { ( summary?.channelPolicies?.length ?? 0 ) > 0 ? (
                        <div className="space-y-2">
                            <p className="text-[10px] uppercase tracking-wider text-zinc-500 font-mono">Aktív jelzési policy</p>
                            <div className="space-y-2">
                                { summary?.channelPolicies?.map( ( policy ) => (
                                    <div key={ policy.channel } className="rounded-lg border border-white/[0.04] bg-white/[0.02] p-2">
                                        <div className="flex flex-wrap items-center gap-2 text-[10px] uppercase font-mono text-zinc-400">
                                            <Badge variant="outline" className={ channelTone( policy.channel ) }>
                                                { policy.channel.toUpperCase() }
                                            </Badge>
                                            <span>{ policy.enabled ? 'Aktív' : 'Tiltva' }</span>
                                            { policy.fallbackChannel ? <span>Fallback: { policy.fallbackChannel.toUpperCase() }</span> : null }
                                        </div>
                                        <div className="mt-2 flex flex-wrap gap-1">
                                            { policy.eventTypes.map( ( eventType ) => (
                                                <Badge key={ `${ policy.channel }-${ eventType }` } variant="secondary" className="text-[10px]">
                                                    { eventType }
                                                </Badge>
                                            ) ) }
                                        </div>
                                    </div>
                                ) ) }
                            </div>
                        </div>
                    ) : null }
                </div>

                <div className="rounded-xl border border-white/[0.04] bg-zinc-900/50 p-3 flex-1">
                    <div className="flex items-center justify-between mb-3">
                        <p className="text-xs uppercase tracking-wider text-zinc-400 font-mono">Legutóbbi kézbesítések</p>
                        <Badge variant="outline" className="text-[10px] border-white/[0.08] text-zinc-400">
                            { deliveries.length } esemény
                        </Badge>
                    </div>

                    <div className="space-y-2 max-h-[360px] overflow-auto pr-1">
                        { deliveries.length === 0 ? (
                            <p className="text-sm text-zinc-500">Még nincs kézbesítési esemény.</p>
                        ) : deliveries.map( ( delivery ) => (
                            <div key={ delivery.id } className="rounded-lg border border-white/[0.04] bg-white/[0.02] p-3 space-y-2">
                                <div className="flex items-start justify-between gap-2">
                                    <div className="space-y-1 min-w-0">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <Badge variant="outline" className={ channelTone( delivery.channel ) }>
                                                { delivery.channel.toUpperCase() }
                                            </Badge>
                                            <Badge variant="outline" className={ `border-white/[0.08] ${ statusTone( delivery.status ) }` }>
                                                { statusLabel( delivery.status ) }
                                            </Badge>
                                        </div>
                                        <p className="text-sm font-semibold text-white">{ delivery.title }</p>
                                        <p className="text-xs text-zinc-400 line-clamp-3 whitespace-pre-line">{ delivery.message }</p>
                                    </div>

                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-8 shrink-0"
                                        onClick={ () => void resendWorkflowNotification( delivery.workflowId ) }
                                        disabled={ !delivery.workflowId || dispatchingWorkflowId === delivery.workflowId }
                                    >
                                        <Send size={ 12 } className="mr-1" />
                                        Újra
                                    </Button>
                                </div>

                                <div className="flex flex-wrap items-center gap-3 text-[10px] uppercase font-mono text-zinc-500">
                                    <span>{ formatTimestamp( delivery.createdAt ) }</span>
                                    { delivery.workflowId ? <span>WF: { delivery.workflowId.slice( 0, 8 ) }</span> : null }
                                    <span>{ delivery.eventType }</span>
                                    { delivery.error ? <span className="text-red-400">{ delivery.error }</span> : null }
                                </div>
                            </div>
                        ) ) }
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}

export default ZeroPromptNotificationPanel;