import React, { useEffect, useMemo, useState, type ChangeEvent } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card.js';
import { Button } from './ui/button.js';
import { Badge } from './ui/badge.js';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs.js';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table.js';
import { Input } from './ui/input.js';
import { toast } from 'sonner';
import { Globe, Handshake, FileCode, RefreshCw, PlusCircle } from 'lucide-react';
import
  {
    getFederationNegotiations,
    getFederationPeers,
    getLocalFederationManifest,
    registerFederationPeer,
    revokeFederationPeer,
    verifyFederationManifest,
    type FederationManifest,
    type FederationNegotiationSession,
    type FederationPeer,
  } from '@/lib/apiService';

export function FederationCenter ()
{
  const [peers, setPeers] = useState<FederationPeer[]>( [] );
  const [negotiations, setNegotiations] = useState<FederationNegotiationSession[]>( [] );
  const [localManifest, setLocalManifest] = useState<FederationManifest | null>( null );
  const [loading, setLoading] = useState( false );
  const [verifyInput, setVerifyInput] = useState( '' );
  const [peerForm, setPeerForm] = useState( { peerId: '', displayName: '', endpoint: '' } );

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

  const refreshAll = async () =>
  {
    setLoading( true );
    try
    {
      await Promise.all( [fetchPeers(), fetchNegotiations(), fetchLocalManifest()] );
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
      await fetchPeers();
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

  const handleVerify = async () =>
  {
    try
    {
      const manifest = JSON.parse( verifyInput ) as FederationManifest;
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
