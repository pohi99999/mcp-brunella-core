import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Cloud, Globe, RefreshCcw } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import { Skeleton } from '@/components/ui/skeleton'
import { useTranslation } from 'react-i18next'
import { getCloudflareConfig, submitCloudflareWorkerTask, type CloudflareRuntimeConfig } from '@/lib/apiService'

interface EdgeAgent
{
    id: string
    name: string
    kind: 'public' | 'internal'
    url?: string
    status: 'online' | 'offline' | 'unknown'
    latencyMs?: number
    statusCode?: number
    error?: string
}

interface CloudflareStatus
{
    status: 'connected' | 'degraded' | 'error'
    summary: {
        total: number
        online: number
        offline: number
        unknown: number
    }
    workers: EdgeAgent[]
}

export function CloudflareAgentsCard ()
{
    const { t } = useTranslation()
    const [data, setData] = useState<CloudflareStatus | null>( null )
    const [config, setConfig] = useState<CloudflareRuntimeConfig | null>( null )
    const [loading, setLoading] = useState( true )
    const [instruction, setInstruction] = useState( () => t( 'cloudflare_widget.default_instruction', 'állapotellenőrzés' ) )
    const [runningWorkerId, setRunningWorkerId] = useState<string | null>( null )

    const getStatusLabel = ( status: CloudflareStatus['status'] ) =>
    {
        switch ( status )
        {
            case 'connected':
                return t( 'cloudflare_widget.status_connected', 'kapcsolódva' )
            case 'degraded':
                return t( 'cloudflare_widget.status_degraded', 'korlátozott' )
            default:
                return t( 'cloudflare_widget.status_error', 'hiba' )
        }
    }

    const getWorkerStatusLabel = ( status: EdgeAgent['status'] ) =>
    {
        switch ( status )
        {
            case 'online':
                return t( 'common.healthy', 'Egészséges' )
            case 'offline':
                return t( 'common.offline', 'Offline' )
            default:
                return t( 'cloudflare_widget.unknown', 'ismeretlen' )
        }
    }

    const fetchData = async () =>
    {
        try
        {
            const [agentsRes, configRes] = await Promise.all( [
                fetch( '/api/cloudflare/agents' ),
                getCloudflareConfig(),
            ] )

            if ( !agentsRes.ok )
            {
                throw new Error( `HTTP ${ agentsRes.status }` )
            }

            const json = await agentsRes.json()
            setData( json )
            setConfig( configRes )
        } catch ( e: unknown )
        {
            toast.error( t( 'cloudflare_widget.fetch_error', 'Nem sikerült lekérni a Cloudflare állapotot' ) )
        } finally
        {
            setLoading( false )
        }
    }

    useEffect( () =>
    {
        fetchData()
        const interval = setInterval( fetchData, 10000 ) // Poll every 10s
        return () => clearInterval( interval )
    }, [] )

    const handleWorkerTask = async ( workerId: string, workerName: string ) =>
    {
        if ( !instruction.trim() )
        {
            toast.error( t( 'cloudflare_widget.dispatch_required', 'Adj meg egy feladatot a workerhez' ) )
            return
        }

        setRunningWorkerId( workerId )
        try
        {
            const result = await submitCloudflareWorkerTask( workerId, instruction.trim(), {} )
            toast.success( t( 'cloudflare_widget.dispatch_success', 'Feladat elküldve: {{workerName}}', { workerName } ), {
                description: result.endpoint
                    ? t( 'cloudflare_widget.dispatch_success_desc', 'Végpont: {{endpoint}}', { endpoint: result.endpoint } )
                    : t( 'cloudflare_widget.dispatch_success_desc_fallback', 'A worker feladatot elfogadta' ),
            } )
        } catch ( e: unknown )
        {
            const msg = e instanceof Error ? e.message : String( e )
            toast.error( t( 'cloudflare_widget.dispatch_error', 'Worker dispatch hiba: {{workerName}}', { workerName } ), {
                description: msg,
            } )
        } finally
        {
            setRunningWorkerId( null )
        }
    }

    if ( loading && !data )
    {
        return (
            <Card className="glass-card border-white/[0.04] overflow-hidden mt-4">
                <CardHeader className="pb-3 border-b border-white/[0.04] bg-white/[0.04] flex flex-row items-center justify-between">
                    <CardTitle className="flex items-center gap-2 text-sm font-bold tracking-wider uppercase text-zinc-500">
                        <Skeleton className="h-4 w-4 rounded-full" />
                        <Skeleton className="h-4 w-32" />
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="p-4 space-y-3">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <Skeleton className="h-4 w-4 rounded-full" />
                                <div className="space-y-1">
                                    <Skeleton className="h-3 w-24" />
                                    <Skeleton className="h-2 w-16" />
                                </div>
                            </div>
                            <Skeleton className="h-2 w-12" />
                        </div>
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <Skeleton className="h-4 w-4 rounded-full" />
                                <div className="space-y-1">
                                    <Skeleton className="h-3 w-24" />
                                    <Skeleton className="h-2 w-16" />
                                </div>
                            </div>
                            <Skeleton className="h-2 w-12" />
                        </div>
                    </div>
                </CardContent>
            </Card>
        )
    }

    if ( !data ) return null

    return (
            <Card className="glass-card border-white/[0.04] overflow-hidden mt-4">
                <CardHeader className="pb-3 border-b border-white/[0.04] bg-white/[0.04] flex flex-row items-center justify-between">
                    <CardTitle className="flex items-center gap-2 text-sm font-bold tracking-wider uppercase text-zinc-500">
                        <Cloud size={ 16 } className="text-orange-400" />
                        { t( 'cloudflare_widget.title', 'Cloudflare Edge ágensek' ) }
                    </CardTitle>
                    <div className="flex items-center gap-2">
                        <Badge variant={ data.status === 'connected' ? 'default' : data.status === 'degraded' ? 'secondary' : 'destructive' } className="text-[10px]">
                            { getStatusLabel( data.status ) }
                        </Badge>
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={ fetchData } disabled={ loading }>
                            <RefreshCcw size={ 12 } className={ loading ? "animate-spin" : "" } />
                    </Button>
                </div>
            </CardHeader>
            <CardContent className="p-0">
                <div className="px-4 py-3 border-b border-white/[0.04] bg-white/[0.02] flex flex-col gap-2">
                    <span className="text-xs text-zinc-400">{ t( 'cloudflare_widget.direct_task', 'Közvetlen worker feladat' ) }</span>
                    <div className="flex gap-2">
                        <Input
                            id="cloudflare-worker-task"
                            name="cloudflare-worker-task"
                            aria-label={ t( 'cloudflare_widget.direct_task', 'Közvetlen worker feladat' ) }
                            value={ instruction }
                            onChange={ ( e ) => setInstruction( e.target.value ) }
                            placeholder={ t( 'cloudflare_widget.placeholder', 'Pl.: állapotellenőrzés vagy státuszriport' ) }
                            className="h-8 text-xs"
                        />
                    </div>
                </div>
                <div className="px-4 py-2 text-xs text-zinc-400 border-b border-white/[0.04] bg-white/[0.02]">
                    { t( 'cloudflare_widget.summary', 'összes: {{total}} • online: {{online}} • offline: {{offline}} • ismeretlen: {{unknown}}', data.summary ) }
                </div>
                { config && (
                    <div className="px-4 py-2 text-[11px] text-zinc-400 border-b border-white/[0.04] bg-white/[0.02] space-y-1">
                        <div>
                            { t( 'cloudflare_widget.edge', 'edge' ) }: <span className="font-mono text-zinc-300">{ config.edge.workerUrl }</span>
                        </div>
                        <div>
                            { t( 'cloudflare_widget.chat', 'chat' ) }: <span className="font-mono text-zinc-300">{ config.chat.url }</span>
                        </div>
                        <div className="flex flex-wrap gap-3">
                            <span>
                                { t( 'cloudflare_widget.tunnel', 'tunnel' ) }: { config.tunnel.enabled ? t( 'cloudflare_widget.enabled', 'engedélyezve' ) : t( 'cloudflare_widget.disabled', 'letiltva' ) }
                            </span>
                            <span>
                                { t( 'cloudflare_widget.api_token', 'api-token' ) }: { config.auth.hasCloudflareApiToken ? t( 'cloudflare_widget.ok', 'ok' ) : t( 'cloudflare_widget.missing', 'hiányzik' ) }
                            </span>
                            <span>
                                { t( 'cloudflare_widget.cean_key', 'cean-kulcs' ) }: { config.auth.hasCeanApiKey ? t( 'cloudflare_widget.ok', 'ok' ) : t( 'cloudflare_widget.missing', 'hiányzik' ) }
                            </span>
                        </div>
                        { config.tunnel.dashboardUrl && (
                            <div>
                                <a
                                    href={ config.tunnel.dashboardUrl }
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-cyan-400 hover:text-cyan-300 underline"
                                >
                                    { t( 'cloudflare_widget.mobile_dashboard', 'Mobil dashboard megnyitása (Tunnel)' ) }
                                </a>
                            </div>
                        ) }
                    </div>
                ) }
                <div className="divide-y divide-white/5">
                    { data.workers.map( agent => (
                        <div key={ agent.id } className="flex items-center justify-between px-4 py-3 hover:bg-white/[0.03] transition-colors">
                            <div className="flex items-center gap-3">
                                <Globe size={ 16 } className="text-zinc-500" />
                                <div className="flex flex-col">
                                    <span className="text-sm font-mono text-zinc-200">{ agent.name }</span>
                                    <span className="text-[10px] text-zinc-500">
                                        { agent.kind } • { agent.url || t( 'cloudflare_widget.kind_not_configured', 'nincs konfigurálva' ) }
                                    </span>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className={ `h-2 w-2 rounded-full ${ agent.status === 'online' ? 'bg-green-500 animate-pulse' : agent.status === 'offline' ? 'bg-red-500' : 'bg-yellow-500' }` } />
                                <span className="text-xs text-zinc-400 capitalize">
                                    { getWorkerStatusLabel( agent.status ) }
                                    { typeof agent.latencyMs === 'number' ? ` (${ agent.latencyMs }ms)` : '' }
                                </span>
                                <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-7 px-2 text-[10px]"
                                    disabled={ !agent.url || runningWorkerId === agent.id }
                                    onClick={ () => handleWorkerTask( agent.id, agent.name ) }
                                >
                                    { runningWorkerId === agent.id ? t( 'cloudflare_widget.sending', 'Küldés...' ) : t( 'cloudflare_widget.send_task', 'Task küldés' ) }
                                </Button>
                            </div>
                        </div>
                    ) ) }
                    { data.workers.length === 0 && (
                        <div className="p-4 text-center text-xs text-zinc-500">
                            { t( 'cloudflare_widget.no_workers', 'Nincs aktív edge ágens.' ) }
                        </div>
                    ) }
                </div>
            </CardContent>
        </Card>
    )
}
