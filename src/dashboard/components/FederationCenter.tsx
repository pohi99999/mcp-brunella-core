import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card.js';
import { Button } from './ui/button.js';
import { Badge } from './ui/badge.js';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs.js';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table.js';
import { Input } from './ui/input.js';
import { toast } from 'sonner';
import { Globe, Shield, Handshake, FileCode, RefreshCw, PlusCircle, Revoke } from 'lucide-react';

export function FederationCenter() {
  const [peers, setPeers] = useState<any[]>([]);
  const [negotiations, setNegotiations] = useState<any[]>([]);
  const [localManifest, setLocalManifest] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const fetchPeers = async () => {
    try {
      const res = await fetch('/api/v1/federation/peers');
      const data = await res.json();
      setPeers(data.peers || []);
    } catch (e) {
      console.error('Failed to fetch peers', e);
    }
  };

  const fetchNegotiations = async () => {
    try {
      const res = await fetch('/api/v1/federation/negotiations');
      const data = await res.json();
      setNegotiations(data.sessions || []);
    } catch (e) {
      console.error('Failed to fetch negotiations', e);
    }
  };

  const fetchLocalManifest = async () => {
    try {
      const res = await fetch('/api/v1/federation/manifests/local');
      const data = await res.json();
      setLocalManifest(data);
    } catch (e) {
      console.error('Failed to fetch local manifest', e);
    }
  };

  const refreshAll = async () => {
    setLoading(true);
    await Promise.all([fetchPeers(), fetchNegotiations(), fetchLocalManifest()]);
    setLoading(false);
  };

  useEffect(() => {
    refreshAll();
  }, []);

  const handleRevoke = async (peerId: string) => {
    try {
      const res = await fetch(`/api/v1/federation/peers/${peerId}/revoke`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'Manual revocation via Dashboard' })
      });
      if (res.ok) {
        toast.success(`Peer ${peerId} visszavonva`);
        fetchPeers();
      }
    } catch (e) {
      toast.error('Hiba a visszavonás során');
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Federated MCP Center</h1>
          <p className="text-muted-foreground">Kezeld a BAS hálózat távoli kapcsolatait és képességeit.</p>
        </div>
        <Button onClick={refreshAll} disabled={loading}>
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
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
              <CardTitle>Megbízható Partnerek</CardTitle>
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
                    <TableHead>Trust Score</TableHead>
                    <TableHead className="text-right">Műveletek</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {peers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-4 text-muted-foreground">Nincs regisztrált partner.</TableCell>
                    </TableRow>
                  ) : (
                    peers.map((p) => (
                      <TableRow key={p.peerId}>
                        <TableCell className="font-mono text-xs">{p.peerId}</TableCell>
                        <TableCell className="font-medium">{p.displayName}</TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">{p.endpoint}</TableCell>
                        <TableCell>
                          <Badge variant={p.trustState === 'trusted' ? 'success' : 'destructive'}>
                            {p.trustState}
                          </Badge>
                        </TableCell>
                        <TableCell>{p.trustScore}</TableCell>
                        <TableCell className="text-right">
                          {p.trustState === 'trusted' && (
                            <Button variant="ghost" size="sm" onClick={() => handleRevoke(p.peerId)}>
                              Visszavonás
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
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
                {localManifest ? (
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium">Peer ID:</span>
                      <span className="font-mono text-xs">{localManifest.peerId}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium">Aláírás:</span>
                      <Badge variant="outline" className="font-mono text-[10px]">{localManifest.signature.slice(0, 20)}...</Badge>
                    </div>
                    <div className="space-y-2">
                      <p className="text-sm font-medium">Kínált képességek:</p>
                      <div className="flex flex-wrap gap-2">
                        {localManifest.capabilities.map((c: any) => (
                          <Badge key={c.name} variant="secondary">{c.name}</Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Betöltés...</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Manifest Ellenőrzés</CardTitle>
                <CardDescription>Digitálisan aláírt manifestek validálása.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">Másold be a távoli manifest JSON-t az ellenőrzéshez.</p>
                <Input placeholder='{"peerId": "...", "signature": "..."}' />
                <Button variant="outline" className="w-full">Validálás</Button>
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
                  {negotiations.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-4 text-muted-foreground">Nincs aktív tárgyalás.</TableCell>
                    </TableRow>
                  ) : (
                    negotiations.map((s) => (
                      <TableRow key={s.sessionId}>
                        <TableCell className="font-mono text-xs">{s.sessionId.slice(0, 8)}</TableCell>
                        <TableCell>{s.peerId}</TableCell>
                        <TableCell>
                          <Badge>{s.state}</Badge>
                        </TableCell>
                        <TableCell>{s.initialOffer.capabilities.join(', ')}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {s.transcript[s.transcript.length - 1]?.type} @ {new Date(s.updatedAt).toLocaleTimeString()}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
