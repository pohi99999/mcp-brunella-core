import React, { useEffect, useMemo, useState, type ChangeEvent } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card.js';
import { Button } from './ui/button.js';
import { Badge } from './ui/badge.js';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs.js';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table.js';
import { Input } from './ui/input.js';
import { Textarea } from './ui/textarea.js';
import { ScrollArea } from './ui/scroll-area.js';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select.js';
import { toast } from 'sonner';
import { Globe, Handshake, FileCode, RefreshCw, PlusCircle, Fingerprint, History, ShieldAlert, ShieldCheck } from 'lucide-react';
import
  {
    getFederationEvidence,
    getFederationNegotiations,
    getFederationPeers,
    getLocalFederationManifest,
    type FederationEvidenceSnapshot,
    promoteFederationPeerRuntimeKey,
    registerFederationPeer,
    revokeFederationPeer,
    stageFederationPeerRuntimeKey,
    verifyFederationManifest,
    type FederationManifest,
    type FederationNegotiationSession,
    type FederationPeer,
  } from '@/lib/apiService';

function isFederationManifestCandidate( value: unknown ): value is FederationManifest
{
  if ( !value || typeof value !== 'object' )
  {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return typeof candidate.manifestId === 'string'
    && typeof candidate.peerId === 'string'
    && Array.isArray( candidate.capabilities )
    && typeof candidate.version === 'string'
    && typeof candidate.issuedAt === 'string'
    && typeof candidate.expiresAt === 'string'
    && typeof candidate.signature === 'string';
}

export function FederationCenter ()
{
  const [peers, setPeers] = useState<FederationPeer[]>( [] );
  const [negotiations, setNegotiations] = useState<FederationNegotiationSession[]>( [] );
  const [localManifest, setLocalManifest] = useState<FederationManifest | null>( null );
  const [evidence, setEvidence] = useState<FederationEvidenceSnapshot | null>( null );
  const [loading, setLoading] = useState( false );
  const [verifyInput, setVerifyInput] = useState( '' );
  const [peerForm, setPeerForm] = useState( { peerId: '', displayName: '', endpoint: '' } );
  const [runtimeKeyPeerId, setRuntimeKeyPeerId] = useState( '' );
  const [nextRuntimeKeyPem, setNextRuntimeKeyPem] = useState( '' );
  const [nextRuntimeKeyId, setNextRuntimeKeyId] = useState( '' );
  const [promoteReason, setPromoteReason] = useState( '' );

  const fetchPeers = async () =>
  {
    const data = await getFederationPeers();
    setPeers( data );
  };

  const fetchNegotiations = async () =>
  {
    const data = await getFederationNegotiations();
    setNegotiations( data );
  };

  const fetchLocalManifest = async () =>
  {
    const data = await getLocalFederationManifest();
    setLocalManifest( data );
  };

  const fetchEvidence = async () =>
  {
    const data = await getFederationEvidence();
    setEvidence( data );
  };

  const refreshAll = async () =>
  {
    setLoading( true );
    try
    {
      await Promise.all( [fetchPeers(), fetchNegotiations(), fetchLocalManifest(), fetchEvidence()] );
    } catch ( error )
    {
      const message = error instanceof Error ? error.message : 'Ismeretlen hiba';
      toast.error( `Federation frissítés sikertelen: ${ message }` );
    } finally
    {
      setLoading( false );
    }
  };

  useEffect( () =>
  {
    refreshAll();
  }, [] );

  const handleRevoke = async ( peerId: string ) =>
  {
    try
    {
      await revokeFederationPeer( peerId, 'Manual revocation via Dashboard' );
      toast.success( `Peer ${ peerId } visszavonva` );
      await Promise.all( [fetchPeers(), fetchEvidence()] );
    } catch ( error )
    {
      const message = error instanceof Error ? error.message : 'Ismeretlen hiba';
      toast.error( `Hiba a visszavonás során: ${ message }` );
    }
  };

  const handleRegister = async () =>
  {
    if ( !peerForm.peerId.trim() || !peerForm.displayName.trim() || !peerForm.endpoint.trim() )
    {
      toast.error( 'A peer ID, név és endpoint kötelező.' );
      return;
    }

    try
    {
      await registerFederationPeer( {
        peerId: peerForm.peerId.trim(),
        displayName: peerForm.displayName.trim(),
        endpoint: peerForm.endpoint.trim(),
      } );
      toast.success( `Peer regisztrálva: ${ peerForm.peerId }` );
      setPeerForm( { peerId: '', displayName: '', endpoint: '' } );
      await refreshAll();
    } catch ( error )
    {
      const message = error instanceof Error ? error.message : 'Ismeretlen hiba';
      toast.error( `Peer regisztráció sikertelen: ${ message }` );
    }
  };

  const handleStageRuntimeKey = async () =>
  {
    if ( !runtimeKeyPeerId )
    {
      toast.error( 'Válassz ki egy federált partnert.' );
      return;
    }

    if ( !nextRuntimeKeyPem.trim() )
    {
      toast.error( 'A következő runtime public key kötelező.' );
      return;
    }

    try
    {
      await stageFederationPeerRuntimeKey( runtimeKeyPeerId, {
        publicKey: nextRuntimeKeyPem.trim(),
        keyId: nextRuntimeKeyId.trim() || undefined,
      } );
      toast.success( `Next runtime kulcs stage-elve: ${ runtimeKeyPeerId }` );
      setNextRuntimeKeyPem( '' );
      setNextRuntimeKeyId( '' );
      await Promise.all( [fetchPeers(), fetchEvidence()] );
    } catch ( error )
    {
      const message = error instanceof Error ? error.message : 'Ismeretlen hiba';
      toast.error( `Runtime key stage sikertelen: ${ message }` );
    }
  };

  const handlePromoteRuntimeKey = async () =>
  {
    if ( !runtimeKeyPeerId )
    {
      toast.error( 'Válassz ki egy federált partnert.' );
      return;
    }

    try
    {
      await promoteFederationPeerRuntimeKey( runtimeKeyPeerId, promoteReason.trim() || undefined );
      toast.success( `Runtime kulcs promotálva: ${ runtimeKeyPeerId }` );
      setPromoteReason( '' );
      await Promise.all( [fetchPeers(), fetchEvidence()] );
    } catch ( error )
    {
      const message = error instanceof Error ? error.message : 'Ismeretlen hiba';
      toast.error( `Runtime key promóció sikertelen: ${ message }` );
    }
  };

  const handleVerify = async () =>
  {
    try
    {
      if ( verifyInput.length > 65_536 )
      {
        toast.error( 'A manifest JSON túl nagy. Maximum 64 KB engedélyezett.' );
        return;
      }

      const parsed = JSON.parse( verifyInput ) as unknown;
      if ( !isFederationManifestCandidate( parsed ) )
      {
        toast.error( 'Érvénytelen manifest JSON szerkezet.' );
        return;
      }

      const manifest = parsed;
      const result = await verifyFederationManifest( manifest );
      toast.success( `Manifest ellenőrzés eredménye: ${ result }` );
    } catch ( error )
    {
      const message = error instanceof Error ? error.message : 'Ismeretlen hiba';
      toast.error( `Manifest ellenőrzés sikertelen: ${ message }` );
    }
  };

  const peerCountLabel = useMemo( () => `Partnerek (${ peers.length })`, [peers.length] );

  const updatePeerFormField = ( field: 'peerId' | 'displayName' | 'endpoint' ) => ( event: ChangeEvent<HTMLInputElement> ) =>
  {
    setPeerForm( {
      ...peerForm,
      [field]: event.target.value,
    } );
  };

  const getTrustVariant = ( state: FederationPeer['trustState'] ) =>
  {
    if ( state === 'trusted' ) return 'default';
    if ( state === 'pending' ) return 'secondary';
    return 'destructive';
  };

  const formatEvidenceTimestamp = ( timestamp: string | null ) =>
  {
    if ( !timestamp ) return '—';
    return new Date( timestamp ).toLocaleString( 'hu-HU' );
  };

  const operatorEvidence = evidence?.journal ?? [];
  const rolloutPeers = evidence?.peers ?? [];

  const getEvidenceOutcomeLabel = ( outcome: NonNullable<FederationEvidenceSnapshot['journal'][number]['outcome']> ) =>
  {
    if ( outcome === 'allowed' ) return 'ALLOWED';
    if ( outcome === 'denied' ) return 'DENIED';
    return 'OBSERVED';
  };

  const getEvidenceOutcomeTone = ( outcome: NonNullable<FederationEvidenceSnapshot['journal'][number]['outcome']> ) =>
  {
    if ( outcome === 'allowed' ) return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200';
    if ( outcome === 'denied' ) return 'border-rose-500/30 bg-rose-500/10 text-rose-200';
    return 'border-cyan-500/30 bg-cyan-500/10 text-cyan-200';
  };

  const getRotationTone = ( rotationState: FederationEvidenceSnapshot['peers'][number]['rotationState'] ) =>
  {
    if ( rotationState === 'staged' ) return 'border-cyan-500/30 bg-cyan-500/10 text-cyan-200';
    if ( rotationState === 'revoked' ) return 'border-rose-500/30 bg-rose-500/10 text-rose-200';
    if ( rotationState === 'missing' ) return 'border-amber-500/30 bg-amber-500/10 text-amber-200';
    return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200';
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Federated MCP Center</h1>
          <p className="text-muted-foreground">Kezeld a BAS hálózat távoli kapcsolatait és képességeit.</p>
        </div>
        <Button onClick={ refreshAll } disabled={ loading }>
          <RefreshCw className={ `mr-2 h-4 w-4 ${ loading ? 'animate-spin' : '' }` } />
          Frissítés
        </Button>
      </div>

      <Tabs defaultValue="peers" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="peers">
            <Globe className="mr-2 h-4 w-4" /> Partnerek (Peers)
          </TabsTrigger>
          <TabsTrigger value="manifests">
            <FileCode className="mr-2 h-4 w-4" /> Manifestek
          </TabsTrigger>
          <TabsTrigger value="negotiations">
            <Handshake className="mr-2 h-4 w-4" /> Tárgyalások
          </TabsTrigger>
        </TabsList>

        <TabsContent value="peers" className="space-y-4 pt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <PlusCircle className="h-4 w-4" />
                Új federált partner
              </CardTitle>
              <CardDescription>Regisztrálj trusted/pending állapotú távoli MCP partnert.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-3">
              <Input value={ peerForm.peerId } placeholder="peer-id" onChange={ updatePeerFormField( 'peerId' ) } />
              <Input value={ peerForm.displayName } placeholder="Megjelenítési név" onChange={ updatePeerFormField( 'displayName' ) } />
              <Input value={ peerForm.endpoint } placeholder="https://peer.example.com" onChange={ updatePeerFormField( 'endpoint' ) } />
              <div className="md:col-span-3 flex justify-end">
                <Button onClick={ handleRegister }>Partner regisztrálása</Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{ peerCountLabel }</CardTitle>
              <CardDescription>A BAS hálózatban regisztrált aktív csomópontok.</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Peer ID</TableHead>
                    <TableHead>Név</TableHead>
                    <TableHead>Endpoint</TableHead>
                    <TableHead>Állapot</TableHead>
                    <TableHead>Érvényesség</TableHead>
                    <TableHead className="text-right">Műveletek</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  { peers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={ 6 } className="text-center py-4 text-muted-foreground">Nincs regisztrált partner.</TableCell>
                    </TableRow>
                  ) : (
                    peers.map( ( p: FederationPeer ) => (
                      <TableRow key={ p.peerId }>
                        <TableCell className="font-mono text-xs">{ p.peerId }</TableCell>
                        <TableCell className="font-medium">{ p.displayName }</TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">{ p.endpoint }</TableCell>
                        <TableCell>
                          <Badge variant={ getTrustVariant( p.trustState ) }>
                            { p.trustState }
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          { p.trustedAt ?? p.revokedAt ?? '—' }
                        </TableCell>
                        <TableCell className="text-right">
                          { p.trustState === 'trusted' && (
                            <Button variant="ghost" size="sm" onClick={ () => handleRevoke( p.peerId ) }>
                              Visszavonás
                            </Button>
                          ) }
                        </TableCell>
                      </TableRow>
                    ) )
                  ) }
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Runtime key lifecycle</CardTitle>
              <CardDescription>Stage-eld a következő runtime kulcsot, majd promotáld current állapotba.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-2">
                  <p className="text-sm font-medium">Federált partner</p>
                  <Select value={ runtimeKeyPeerId } onValueChange={ setRuntimeKeyPeerId }>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Válassz peert" />
                    </SelectTrigger>
                    <SelectContent>
                      { peers.map( ( peer ) => (
                        <SelectItem key={ peer.peerId } value={ peer.peerId }>
                          { peer.peerId }
                        </SelectItem>
                      ) ) }
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-medium">Next key ID (opcionális)</p>
                  <Input
                    value={ nextRuntimeKeyId }
                    placeholder="fingerprint vagy explicit key id"
                    onChange={ ( event ) => setNextRuntimeKeyId( event.target.value ) }
                  />
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium">Next runtime public key (PEM)</p>
                <Textarea
                  value={ nextRuntimeKeyPem }
                  placeholder="-----BEGIN PUBLIC KEY-----"
                  onChange={ ( event ) => setNextRuntimeKeyPem( event.target.value ) }
                />
                <div className="flex justify-end">
                  <Button onClick={ handleStageRuntimeKey }>Next kulcs stage-elése</Button>
                </div>
              </div>

              <div className="space-y-2 border-t pt-4">
                <p className="text-sm font-medium">Promóció oka (opcionális)</p>
                <Input
                  value={ promoteReason }
                  placeholder="pl. remote rollout confirmed"
                  onChange={ ( event ) => setPromoteReason( event.target.value ) }
                />
                <div className="flex justify-end">
                  <Button variant="outline" onClick={ handlePromoteRuntimeKey }>Next kulcs promotálása</Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="overflow-hidden border-cyan-500/20 bg-[radial-gradient(circle_at_top_left,_rgba(34,211,238,0.16),_transparent_35%),linear-gradient(180deg,rgba(15,23,42,0.96),rgba(2,8,23,0.92))]">
            <CardHeader className="border-b border-white/6">
              <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.28em] text-cyan-200/80">
                    <History className="h-4 w-4" />
                    Federation Evidence
                  </div>
                  <CardTitle className="text-2xl font-semibold tracking-tight text-white">Operator journal</CardTitle>
                  <CardDescription className="max-w-2xl text-slate-300/80">
                    Runtime key rollout, peer revoke és trust-határesetek egy közös, auditált operátori feedben.
                  </CardDescription>
                </div>

                <div className="grid gap-2 sm:grid-cols-2 xl:min-w-[360px]">
                  <div className="rounded-2xl border border-white/8 bg-white/4 px-4 py-3">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-400">Trusted peers</p>
                    <p className="mt-2 text-2xl font-semibold text-white">{ evidence?.totals.trustedCount ?? 0 }</p>
                    <p className="text-xs text-slate-400">Pending: { evidence?.totals.pendingCount ?? 0 }</p>
                  </div>
                  <div className="rounded-2xl border border-cyan-500/20 bg-cyan-500/8 px-4 py-3">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-cyan-200/80">Rotation staged</p>
                    <p className="mt-2 text-2xl font-semibold text-white">{ evidence?.totals.peersWithNextKey ?? 0 }</p>
                    <p className="text-xs text-cyan-100/70">Stage: { evidence?.totals.stageCount ?? 0 } • Promote: { evidence?.totals.promoteCount ?? 0 }</p>
                  </div>
                  <div className="rounded-2xl border border-rose-500/20 bg-rose-500/8 px-4 py-3">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-rose-200/80">Denied trail</p>
                    <p className="mt-2 text-2xl font-semibold text-white">{ evidence?.totals.deniedCount ?? 0 }</p>
                    <p className="text-xs text-rose-100/70">Revoke: { evidence?.totals.revokeCount ?? 0 }</p>
                  </div>
                  <div className="rounded-2xl border border-white/8 bg-white/4 px-4 py-3">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-400">Journal feed</p>
                    <p className="mt-2 text-2xl font-semibold text-white">{ evidence?.totals.journalCount ?? 0 }</p>
                    <p className="text-xs text-slate-400">
                      { evidence?.truncated ? 'Rövidített feed, az API további bejegyzést tartalmaz.' : 'A legfrissebb operator evidence.' }
                    </p>
                  </div>
                </div>
              </div>
            </CardHeader>

            <CardContent className="grid gap-6 px-6 py-6 xl:grid-cols-[minmax(0,1.25fr)_360px]">
              <div className="rounded-3xl border border-white/8 bg-slate-950/70 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
                <div className="flex items-center justify-between border-b border-white/6 px-5 py-4">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-slate-400">Runtime rollout feed</p>
                    <p className="mt-1 text-sm text-slate-300">Stage, promote, revoke és route outcome események</p>
                  </div>
                  <Badge variant="outline" className="border-cyan-500/30 bg-cyan-500/10 text-cyan-100">
                    { operatorEvidence.length } entry
                  </Badge>
                </div>

                <ScrollArea className="h-[420px]">
                  <div className="relative space-y-3 px-5 py-5 before:absolute before:bottom-5 before:left-[1.35rem] before:top-5 before:w-px before:bg-gradient-to-b before:from-cyan-400/50 before:via-white/10 before:to-transparent">
                    { operatorEvidence.length === 0 ? (
                      <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.03] px-5 py-6 text-sm text-slate-400">
                        Még nincs federation operator evidence. A stage/promote/revoke műveletek itt jelennek meg.
                      </div>
                    ) : (
                      operatorEvidence.map( ( entry ) => (
                        <div key={ entry.id } className="relative pl-10">
                          <div className="absolute left-[0.72rem] top-5 h-3 w-3 rounded-full border border-slate-950 bg-cyan-300 shadow-[0_0_0_4px_rgba(8,15,30,0.9)]" />
                          <div className="rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-4 shadow-[0_16px_40px_-24px_rgba(0,0,0,0.85)]">
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                              <div className="space-y-2">
                                <div className="flex flex-wrap items-center gap-2">
                                  <Badge variant="outline" className={ getEvidenceOutcomeTone( entry.outcome ) }>
                                    { getEvidenceOutcomeLabel( entry.outcome ) }
                                  </Badge>
                                  <span className="text-sm font-semibold text-white">{ entry.title }</span>
                                  { entry.peerId && (
                                    <Badge variant="outline" className="border-white/10 bg-white/[0.04] text-slate-200">
                                      { entry.peerId }
                                    </Badge>
                                  ) }
                                </div>
                                <p className="text-sm leading-6 text-slate-300">{ entry.detail }</p>
                                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
                                  { entry.keyId && (
                                    <span className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-1 font-mono text-[11px] text-slate-200">
                                      key:{ entry.keyId }
                                    </span>
                                  ) }
                                  { entry.previousCurrentKeyId && (
                                    <span className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-1 font-mono text-[11px] text-slate-200">
                                      prev:{ entry.previousCurrentKeyId }
                                    </span>
                                  ) }
                                  <span className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-1 uppercase tracking-[0.2em] text-[10px]">
                                    { entry.evidenceSources.join( '+' ) }
                                  </span>
                                </div>
                              </div>
                              <div className="text-right text-xs text-slate-400">
                                <p className="font-mono tracking-wide text-slate-300">{ formatEvidenceTimestamp( entry.timestamp ) }</p>
                                <p className="mt-1">{ entry.displayName ?? 'Federation operator action' }</p>
                              </div>
                            </div>
                          </div>
                        </div>
                      ) )
                    ) }
                  </div>
                </ScrollArea>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-slate-400">Rollout matrix</p>
                    <p className="mt-1 text-sm text-slate-300">Peerenkénti current/next key és legutóbbi operator action</p>
                  </div>
                  <Fingerprint className="h-4 w-4 text-cyan-300" />
                </div>

                { rolloutPeers.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.03] px-4 py-5 text-sm text-slate-400">
                    Nincs federált partner vagy operator evidence.
                  </div>
                ) : (
                  rolloutPeers.map( ( peer ) => (
                    <div key={ peer.peerId } className="rounded-2xl border border-white/8 bg-slate-950/70 px-4 py-4 shadow-[0_18px_45px_-30px_rgba(0,0,0,0.85)]">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-white">{ peer.displayName }</p>
                          <p className="mt-1 text-xs font-mono text-slate-400">{ peer.peerId }</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant={ getTrustVariant( peer.trustState ) }>{ peer.trustState }</Badge>
                          <Badge variant="outline" className={ getRotationTone( peer.rotationState ) }>
                            { peer.rotationState }
                          </Badge>
                        </div>
                      </div>

                      <div className="mt-4 grid gap-3 rounded-2xl border border-white/6 bg-white/[0.03] p-3">
                        <div className="flex items-center justify-between text-xs">
                          <span className="uppercase tracking-[0.22em] text-slate-500">Current</span>
                          <span className="font-mono text-slate-200">{ peer.currentKeyId ?? '—' }</span>
                        </div>
                        <div className="flex items-center justify-between text-xs">
                          <span className="uppercase tracking-[0.22em] text-slate-500">Next</span>
                          <span className="font-mono text-cyan-100">{ peer.nextKeyId ?? '—' }</span>
                        </div>
                        <div className="grid grid-cols-3 gap-2 pt-1 text-center text-xs">
                          <div className="rounded-xl border border-white/6 bg-white/[0.03] px-2 py-2">
                            <p className="text-[10px] uppercase tracking-[0.22em] text-slate-500">Stage</p>
                            <p className="mt-1 text-sm font-semibold text-white">{ peer.stageCount }</p>
                          </div>
                          <div className="rounded-xl border border-white/6 bg-white/[0.03] px-2 py-2">
                            <p className="text-[10px] uppercase tracking-[0.22em] text-slate-500">Promote</p>
                            <p className="mt-1 text-sm font-semibold text-white">{ peer.promoteCount }</p>
                          </div>
                          <div className="rounded-xl border border-white/6 bg-white/[0.03] px-2 py-2">
                            <p className="text-[10px] uppercase tracking-[0.22em] text-slate-500">Revoke</p>
                            <p className="mt-1 text-sm font-semibold text-white">{ peer.revokeCount }</p>
                          </div>
                        </div>
                      </div>

                      <div className="mt-4 flex items-start gap-3 rounded-2xl border border-white/6 bg-white/[0.03] px-3 py-3">
                        { peer.latestOutcome === 'denied' ? (
                          <ShieldAlert className="mt-0.5 h-4 w-4 text-rose-300" />
                        ) : (
                          <ShieldCheck className="mt-0.5 h-4 w-4 text-emerald-300" />
                        ) }
                        <div className="min-w-0">
                          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Legutóbbi művelet</p>
                          <p className="mt-1 text-sm text-slate-200">{ peer.latestAction ?? 'Még nincs operator action' }</p>
                          <p className="mt-1 text-xs text-slate-400">{ formatEvidenceTimestamp( peer.lastEvidenceAt ) }</p>
                        </div>
                      </div>
                    </div>
                  ) )
                ) }
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="manifests" className="space-y-4 pt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Helyi Capability Manifest</CardTitle>
                <CardDescription>A te BAS rendszered által kínált képességek.</CardDescription>
              </CardHeader>
              <CardContent>
                { localManifest ? (
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium">Peer ID:</span>
                      <span className="font-mono text-xs">{ localManifest.peerId }</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium">Aláírás:</span>
                      <Badge variant="outline" className="font-mono text-[10px]">{ localManifest.signature.slice( 0, 20 ) }...</Badge>
                    </div>
                    <div className="space-y-2">
                      <p className="text-sm font-medium">Kínált képességek:</p>
                      <div className="flex flex-wrap gap-2">
                        { localManifest.capabilities.map( ( capability: FederationManifest['capabilities'][number] ) => (
                          <Badge key={ capability.name } variant="secondary">
                            { capability.name }
                            { capability.version ? `@${ capability.version }` : '' }
                            { capability.deprecated ? ' (deprecated)' : '' }
                          </Badge>
                        ) ) }
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Betöltés...</p>
                ) }
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Manifest Ellenőrzés</CardTitle>
                <CardDescription>Digitálisan aláírt manifestek validálása.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">Másold be a távoli manifest JSON-t az ellenőrzéshez.</p>
                <Input value={ verifyInput } onChange={ ( event: ChangeEvent<HTMLInputElement> ) => setVerifyInput( event.target.value ) } placeholder='{"peerId": "...", "signature": "..."}' />
                <Button variant="outline" className="w-full" onClick={ handleVerify }>Validálás</Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="negotiations" className="space-y-4 pt-4">
          <Card>
            <CardHeader>
              <CardTitle>Capability Negotiation Sessions</CardTitle>
              <CardDescription>Folyamatban lévő tárgyalások távoli erőforrások használatáról.</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Session ID</TableHead>
                    <TableHead>Partner</TableHead>
                    <TableHead>Állapot</TableHead>
                    <TableHead>Képességek</TableHead>
                    <TableHead>Utolsó üzenet</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  { negotiations.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={ 5 } className="text-center py-4 text-muted-foreground">Nincs aktív tárgyalás.</TableCell>
                    </TableRow>
                  ) : (
                    negotiations.map( ( s: FederationNegotiationSession ) => (
                      <TableRow key={ s.sessionId }>
                        <TableCell className="font-mono text-xs">{ s.sessionId.slice( 0, 8 ) }</TableCell>
                        <TableCell>{ s.initialOffer.toPeerId }</TableCell>
                        <TableCell>
                          <Badge>{ s.state }</Badge>
                        </TableCell>
                        <TableCell>{ s.initialOffer.capabilities.join( ', ' ) }</TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          { s.transcript[s.transcript.length - 1]?.action ?? '—' } @ { new Date( s.transcript[s.transcript.length - 1]?.timestamp ?? s.resolvedAt ?? s.createdAt ).toLocaleTimeString() }
                        </TableCell>
                      </TableRow>
                    ) )
                  ) }
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
