import { useCallback, useEffect, useState } from 'react';
import { Activity, RefreshCcw, Zap } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useSocket } from '@/context/SocketContext';

// -----------------------------------------------------------------------
// Types (mirroring src/core/ephemeralAgentManager.ts)
// -----------------------------------------------------------------------
interface EphemeralAgentRecord
{
  id: string;
  spec: {
    parentAgentName: string;
    purpose: string;
    allowedTools: string[];
    deniedTools?: string[];
    allowedPaths?: string[];
    allowedHosts?: string[];
    ttlMs?: number;
    tokenBudget?: number;
    costBudgetUsd?: number;
    stepBudget?: number;
  };
  state: 'pending' | 'running' | 'terminated' | 'expired' | 'failed';
  spawnedAt: string;
  terminatedAt?: string;
  terminationReason?: string;
  tokenUsed: number;
  costUsed: number;
  stepsUsed: number;
  lease: {
    expiresAt: string;
    renewalsUsed: number;
    maxRenewals: number;
    budgetStatus: 'healthy' | 'exceeded' | 'awaiting_approval';
    lastBudgetType?: 'token' | 'cost' | 'step';
  };
  approval?: {
    kind: 'spawn' | 'budget';
    reason: string;
    budgetType?: 'token' | 'cost' | 'step';
  };
  auditTrail: Array<{ timestamp: string; event: string; detail?: string }>;
}

// -----------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------

function stateTone ( state: EphemeralAgentRecord['state'] ): string
{
  if ( state === 'running' ) return 'text-emerald-400';
  if ( state === 'pending' ) return 'text-yellow-400';
  if ( state === 'expired' ) return 'text-amber-400';
  if ( state === 'failed' ) return 'text-red-400';
  return 'text-zinc-400';
}

function stateBadgeTone ( state: EphemeralAgentRecord['state'] ): string
{
  if ( state === 'running' ) return 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300';
  if ( state === 'pending' ) return 'border-yellow-500/20 bg-yellow-500/10 text-yellow-300';
  if ( state === 'expired' ) return 'border-amber-500/20 bg-amber-500/10 text-amber-300';
  if ( state === 'failed' ) return 'border-red-500/20 bg-red-500/10 text-red-300';
  return 'border-zinc-500/20 bg-zinc-500/10 text-zinc-400';
}

function formatTs ( ts: string ): string
{
  const d = new Date( ts );
  return Number.isNaN( d.getTime() ) ? ts : d.toLocaleString( 'hu-HU' );
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

// -----------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------

export function EphemeralAgentsPanel ()
{
  const { socket } = useSocket();
  const [agents, setAgents] = useState<EphemeralAgentRecord[]>( [] );
  const [loading, setLoading] = useState( true );
  const [error, setError] = useState<string | null>( null );

  const API_BASE = '/api/v1/developer';

  const loadAgents = useCallback( async () =>
  {
    setLoading( true );
    try
    {
      const res = await fetch( `${ API_BASE }/ephemeral/agents` );
      if ( !res.ok ) throw new Error( `HTTP ${ res.status }` );
      const data = ( await res.json() ) as { agents: EphemeralAgentRecord[] };
      setAgents( data.agents ?? [] );
      setError( null );
    } catch ( err: unknown )
    {
      setError( err instanceof Error ? err.message : String( err ) );
    } finally
    {
      setLoading( false );
    }
  }, [] );

  useEffect( () =>
  {
    void loadAgents();
    const interval = window.setInterval( () => void loadAgents(), 10_000 );
    return () => window.clearInterval( interval );
  }, [loadAgents] );

  useEffect( () =>
  {
    if ( !socket ) return;

    const refresh = () => void loadAgents();
    socket.on( 'phoenix:ephemeral_spawned', refresh );
    socket.on( 'phoenix:ephemeral_terminated', refresh );
    socket.on( 'phoenix:ephemeral_budget_exceeded', refresh );
    socket.on( 'phoenix:approval_resolved', refresh );
    socket.on( 'phoenix:ephemeral_tool_violation', refresh );

    return () =>
    {
      socket.off( 'phoenix:ephemeral_spawned', refresh );
      socket.off( 'phoenix:ephemeral_terminated', refresh );
      socket.off( 'phoenix:ephemeral_budget_exceeded', refresh );
      socket.off( 'phoenix:approval_resolved', refresh );
      socket.off( 'phoenix:ephemeral_tool_violation', refresh );
    };
  }, [loadAgents, socket] );

  const running = agents.filter( ( a ) => a.state === 'running' ).length;
  const pending = agents.filter( ( a ) => a.state === 'pending' ).length;
  const terminated = agents.filter( ( a ) => a.state === 'terminated' || a.state === 'expired' ).length;
  const failed = agents.filter( ( a ) => a.state === 'failed' ).length;

  return (
    <Card className="glass-card border-white/[0.04] bg-white/[0.03] backdrop-blur-xl h-full flex flex-col">
      <CardHeader className="p-4 border-b border-white/[0.04]">
        <CardTitle className="flex items-center justify-between text-xs font-bold tracking-widest uppercase text-white">
          <span className="flex items-center gap-2">
            <Zap size={ 16 } className="text-violet-400" />
            Ephemeral Agents
          </span>
          <div className="flex items-center gap-2">
            <Badge variant={ error ? 'destructive' : loading ? 'secondary' : 'default' }>
              { error ? 'HIBA' : loading ? 'BETÖLTÉS' : 'ÉLŐ' }
            </Badge>
            <Button variant="outline" size="sm" className="h-7" onClick={ () => void loadAgents() }>
              <RefreshCcw size={ 12 } className="mr-1" />
              Frissítés
            </Button>
          </div>
        </CardTitle>
      </CardHeader>

      <CardContent className="p-4 flex-1 flex flex-col gap-4 overflow-hidden">
        { error ? (
          <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-300">
            { error }
          </div>
        ) : null }

        {/* Stats */ }
        <div className="grid grid-cols-4 gap-2">
          <StatTile label="Fut" value={ running } tone="text-emerald-400" />
          <StatTile label="Vár" value={ pending } tone="text-yellow-400" />
          <StatTile label="Lezárt" value={ terminated } tone="text-zinc-400" />
          <StatTile label="Hiba" value={ failed } tone="text-red-400" />
        </div>

        {/* Agent list */ }
        <div className="rounded-xl border border-white/[0.04] bg-zinc-900/50 p-3 flex-1 overflow-hidden">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-zinc-400 font-mono">
              <Activity size={ 13 } className="text-violet-400" />
              Ügynök napló
            </div>
            <Badge variant="outline" className="text-[10px] border-white/[0.08] text-zinc-400">
              { agents.length } bejegyzés
            </Badge>
          </div>

          <div className="space-y-2 max-h-[420px] overflow-auto pr-1">
            { agents.length === 0 ? (
              <p className="text-sm text-zinc-500">Nincs ephemeral ágens adat.</p>
            ) : (
              agents
                .slice()
                .sort( ( a, b ) => b.spawnedAt.localeCompare( a.spawnedAt ) )
                .map( ( agent ) => (
                  <div
                    key={ agent.id }
                    className="rounded-lg border border-white/[0.04] bg-white/[0.02] p-3 space-y-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="outline" className={ stateBadgeTone( agent.state ) }>
                            { agent.state.toUpperCase() }
                          </Badge>
                          <span className="text-[10px] font-mono text-zinc-400">
                            { agent.id.slice( 0, 8 ) }
                          </span>
                        </div>
                        <p className="text-sm font-semibold text-white">{ agent.spec.purpose }</p>
                        <p className="text-xs text-zinc-400">
                          Parent: <span className="text-zinc-300">{ agent.spec.parentAgentName }</span>
                        </p>
                      </div>
                      <div className="shrink-0 text-right space-y-1">
                        <p className="text-[10px] font-mono text-zinc-500">
                          { formatTs( agent.spawnedAt ) }
                        </p>
                        { agent.terminationReason ? (
                          <p className={ `text-[10px] font-mono ${ stateTone( agent.state ) }` }>
                            { agent.terminationReason }
                          </p>
                        ) : null }
                      </div>
                    </div>

                    {/* Budget indicators */ }
                    { ( agent.tokenUsed > 0 || agent.stepsUsed > 0 || agent.lease ) ? (
                      <div className="flex flex-wrap gap-3 text-[10px] font-mono text-zinc-500 pt-1 border-t border-white/[0.04]">
                        { agent.tokenUsed > 0 && (
                          <span>tokens: { agent.tokenUsed }{ agent.spec.tokenBudget ? `/${ agent.spec.tokenBudget }` : '' }</span>
                        ) }
                        { agent.stepsUsed > 0 && (
                          <span>steps: { agent.stepsUsed }{ agent.spec.stepBudget ? `/${ agent.spec.stepBudget }` : '' }</span>
                        ) }
                        { agent.costUsed > 0 && (
                          <span>cost: ${ agent.costUsed.toFixed( 4 ) }</span>
                        ) }
                        { agent.lease && (
                          <span>lease: { agent.lease.renewalsUsed }/{ agent.lease.maxRenewals }</span>
                        ) }
                        { agent.lease && (
                          <span>budget: { agent.lease.budgetStatus }</span>
                        ) }
                        { agent.lease?.lastBudgetType && (
                          <span>last: { agent.lease.lastBudgetType }</span>
                        ) }
                      </div>
                    ) : null }

                    { agent.approval ? (
                      <div className="rounded-md border border-yellow-500/20 bg-yellow-500/10 p-2 text-[10px] font-mono text-yellow-200">
                        approval: { agent.approval.kind }
                        { agent.approval.budgetType ? ` (${ agent.approval.budgetType })` : '' } — { agent.approval.reason }
                      </div>
                    ) : null }

                    {/* Allowed tools */ }
                    { agent.spec.allowedTools.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        { agent.spec.allowedTools.slice( 0, 6 ).map( ( tool ) => (
                          <Badge
                            key={ tool }
                            variant="secondary"
                            className="text-[9px] bg-violet-500/10 text-violet-300 border-violet-500/20"
                          >
                            { tool }
                          </Badge>
                        ) ) }
                        { agent.spec.allowedTools.length > 6 && (
                          <Badge variant="secondary" className="text-[9px]">
                            +{ agent.spec.allowedTools.length - 6 }
                          </Badge>
                        ) }
                      </div>
                    ) : null }

                    { ( agent.spec.allowedPaths?.length || agent.spec.allowedHosts?.length || agent.spec.deniedTools?.length ) ? (
                      <div className="flex flex-wrap gap-1">
                        { ( agent.spec.allowedPaths ?? [] ).slice( 0, 3 ).map( ( scope ) => (
                          <Badge
                            key={ `path-${ scope }` }
                            variant="secondary"
                            className="text-[9px] bg-cyan-500/10 text-cyan-300 border-cyan-500/20"
                          >
                            path:{ scope }
                          </Badge>
                        ) ) }
                        { ( agent.spec.allowedHosts ?? [] ).slice( 0, 3 ).map( ( host ) => (
                          <Badge
                            key={ `host-${ host }` }
                            variant="secondary"
                            className="text-[9px] bg-emerald-500/10 text-emerald-300 border-emerald-500/20"
                          >
                            host:{ host }
                          </Badge>
                        ) ) }
                        { ( agent.spec.deniedTools ?? [] ).slice( 0, 3 ).map( ( tool ) => (
                          <Badge
                            key={ `deny-${ tool }` }
                            variant="secondary"
                            className="text-[9px] bg-red-500/10 text-red-300 border-red-500/20"
                          >
                            deny:{ tool }
                          </Badge>
                        ) ) }
                      </div>
                    ) : null }
                  </div>
                ) )
            ) }
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default EphemeralAgentsPanel;
