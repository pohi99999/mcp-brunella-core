import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Globe, Command, FolderOpen, Loader2, Play, StopCircle, RefreshCcw, Wifi, WifiOff, Terminal, FileText, CheckCircle2 } from 'lucide-react';
import {
  getRemoteTargets,
  createRemoteSession,
  getRemoteSessions,
  sendRemoteCommand,
  getRemoteCommandStatus,
  getRemoteToken,
  RemoteTarget,
  RemoteSession,
  RemoteCommand,
} from '@/lib/apiService';

export function RemoteOperationsPanel() {
  const [loading, setLoading] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [targets, setTargets] = useState<RemoteTarget[]>([]);
  const [sessions, setSessions] = useState<RemoteSession[]>([]);
  const [commands, setCommands] = useState<RemoteCommand[]>([]);
  const [userId, setUserId] = useState('test_user'); // Placeholder for dynamic user ID
  const [selectedTargetId, setSelectedTargetId] = useState<string | null>(null);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [commandInput, setCommandInput] = useState('git status');
  const [commandToolName, setCommandToolName] = useState('run_shell_command'); // Default tool
  const [commandArgs, setCommandArgs] = useState('{ "command": "git status" }');
  const [showTokenDialog, setShowTokenDialog] = useState(false);

  const fetchToken = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getRemoteToken(userId);
      setToken(res.token);
      toast.success('Távoli API token lekérve!');
    } catch (err: any) {
      toast.error(`Token lekérés hiba: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  const loadTargets = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await getRemoteTargets(token);
      setTargets(res);
    } catch (err: any) {
      toast.error(`Távoli célok lekérése hiba: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }, [token]);

  const loadSessions = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await getRemoteSessions(token);
      setSessions(res);
    } catch (err: any) {
      toast.error(`Távoli munkamenetek lekérése hiba: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }, [token]);

  const handleCreateSession = useCallback(async () => {
    if (!token || !selectedTargetId) return;
    setLoading(true);
    try {
      const res = await createRemoteSession(token, userId, selectedTargetId);
      setSelectedSessionId(res.sessionId);
      toast.success(`Új távoli munkamenet létrehozva: ${res.sessionId}`);
      loadSessions();
    } catch (err: any) {
      toast.error(`Munkamenet létrehozás hiba: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }, [token, userId, selectedTargetId, loadSessions]);

  const handleSendCommand = useCallback(async () => {
    if (!token || !selectedSessionId || !selectedTargetId) return;
    setLoading(true);
    try {
      const input = JSON.parse(commandArgs);
      const res = await sendRemoteCommand(token, selectedSessionId, selectedTargetId, commandToolName, input);
      toast.success(`Parancs elküldve: ${res.commandId}`);
      // Optionally poll for command status
    } catch (err: any) {
      toast.error(`Parancs küldése hiba: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }, [token, selectedSessionId, selectedTargetId, commandToolName, commandArgs]);

  useEffect(() => {
    // Auto-fetch token on component mount
    void fetchToken();
  }, [fetchToken]);

  useEffect(() => {
    if (token) {
      void loadTargets();
      void loadSessions();
    }
  }, [token, loadTargets, loadSessions]);

  return (
    <div className="p-6 space-y-6 text-zinc-100">
      <h1 className="text-2xl font-bold tracking-tight">Távoli Műveletek Központ</h1>
      <p className="text-zinc-400 text-sm">Kliens projektek távoli menedzselése és monitorozása a Z: meghajtón.</p>

      <Card className="glass-card border-white/[0.04] bg-white/[0.02]">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Wifi className="text-blue-400" size={20} />
            Kapcsolat és Autentikáció
          </CardTitle>
          <CardDescription className="text-zinc-500">Távoli célpontok és munkamenetek kezelése.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2">
            <Input
              placeholder="User ID (pl. test_user)"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              className="bg-white/5 border-white/10 text-zinc-300"
            />
            <Button onClick={fetchToken} disabled={loading} className="gap-2">
              {loading ? <Loader2 size={16} className="animate-spin" /> : <RefreshCcw size={16} />}
              Token Lekérése
            </Button>
            <Button variant="outline" onClick={() => setShowTokenDialog(true)} disabled={!token} className="gap-2 border-white/10 hover:bg-white/5 text-zinc-300">
              <FileText size={16} />
              Token Megtekintése
            </Button>
          </div>

          {token && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-zinc-400">Célpontok</Label>
                <select
                  value={selectedTargetId || ''}
                  onChange={(e) => setSelectedTargetId(e.target.value)}
                  className="mt-1 block w-full rounded-md border border-white/10 bg-white/5 py-2 pl-3 pr-10 text-zinc-300 focus:border-blue-500 focus:outline-none focus:ring-blue-500 sm:text-sm"
                >
                  <option value="">Válassz célpontot</option>
                  {targets.map((target) => (
                    <option key={target.id} value={target.id}>
                      {target.name} ({target.type})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label className="text-zinc-400">Munkamenetek</Label>
                <div className="flex gap-2">
                  <select
                    value={selectedSessionId || ''}
                    onChange={(e) => setSelectedSessionId(e.target.value)}
                    className="mt-1 block w-full rounded-md border border-white/10 bg-white/5 py-2 pl-3 pr-10 text-zinc-300 focus:border-blue-500 focus:outline-none focus:ring-blue-500 sm:text-sm"
                  >
                    <option value="">Válassz munkamenetet</option>
                    {sessions.map((session) => (
                      <option key={session.id} value={session.id}>
                        {session.id} ({session.targetId})
                      </option>
                    ))}
                  </select>
                  <Button onClick={handleCreateSession} disabled={loading || !selectedTargetId} className="gap-2 mt-1">
                    <Play size={16} />
                    Új Munkamenet
                  </Button>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {token && selectedSessionId && selectedTargetId && (
        <Card className="glass-card border-white/[0.04] bg-white/[0.02]">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Terminal className="text-emerald-400" size={20} />
              Parancs Végrehajtás
            </CardTitle>
            <CardDescription className="text-zinc-500">Parancsok küldése a távoli célpontra.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="commandToolName" className="text-zinc-400">Eszköz neve (pl. run_shell_command)</Label>
              <Input
                id="commandToolName"
                value={commandToolName}
                onChange={(e) => setCommandToolName(e.target.value)}
                className="mt-1 bg-white/5 border-white/10 text-zinc-300"
                placeholder="run_shell_command"
              />
            </div>
            <div>
              <Label htmlFor="commandInput" className="text-zinc-400">Parancs / Bemenet (JSON formátumban)</Label>
              <Input
                id="commandInput"
                value={commandArgs}
                onChange={(e) => setCommandArgs(e.target.value)}
                className="mt-1 bg-white/5 border-white/10 text-zinc-300 font-mono"
                placeholder='{ "command": "ls -la" }'
              />
            </div>
            <Button onClick={handleSendCommand} disabled={loading || !commandToolName || !commandArgs} className="gap-2 bg-purple-600 hover:bg-purple-700 text-white">
              {loading ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}
              Parancs Küldése
            </Button>
          </CardContent>
        </Card>
      )}

      <Card className="glass-card border-white/[0.04] bg-white/[0.02]">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <ClipboardList size={20} className="text-yellow-400" />
            Utolsó Parancsok
          </CardTitle>
          <CardDescription className="text-zinc-500">A legutóbb végrehajtott távoli parancsok státusza.</CardDescription>
        </CardHeader>
        <CardContent>
          {commands.length === 0 ? (
            <p className="text-zinc-500">Még nincs végrehajtott parancs.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-white/5 hover:bg-transparent">
                  <TableHead className="text-zinc-500 uppercase text-[10px] font-bold">ID</TableHead>
                  <TableHead className="text-zinc-500 uppercase text-[10px] font-bold">Eszköz</TableHead>
                  <TableHead className="text-zinc-500 uppercase text-[10px] font-bold">Státusz</TableHead>
                  <TableHead className="text-zinc-500 uppercase text-[10px] font-bold">Eredmény</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {commands.map((cmd) => (
                  <TableRow key={cmd.id} className="border-white/5 hover:bg-white/[0.02]">
                    <TableCell className="text-xs text-zinc-300">{cmd.id}</TableCell>
                    <TableCell className="text-xs font-medium text-white">{cmd.toolName}</TableCell>
                    <TableCell className="text-xs text-center">
                      <Badge variant={cmd.status === 'completed' ? 'success' : cmd.status === 'failed' ? 'destructive' : 'secondary'}>
                        {cmd.status.toUpperCase()}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-zinc-400 max-w-xs truncate">{cmd.result ? JSON.stringify(cmd.result) : cmd.error || 'Nincs adat'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={showTokenDialog} onOpenChange={setShowTokenDialog}>
        <DialogContent className="sm:max-w-[425px] glass-card border-white/[0.04] bg-white/[0.02] text-zinc-100">
          <DialogHeader>
            <DialogTitle>Távoli API Token</DialogTitle>
            <DialogDescription className="text-zinc-400">
              Ez a távoli API token, amivel a Brunella hozzáfér a kliens projektekhez.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="token" className="text-right text-zinc-300">
                Token
              </Label>
              <Input id="token" value={token || ''} readOnly className="col-span-3 bg-white/5 border-white/10 text-zinc-300 font-mono" />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => {
              if (token) navigator.clipboard.writeText(token);
              toast.success('Token a vágólapra másolva!');
              setShowTokenDialog(false);
            }}>
              Token Másolása
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default RemoteOperationsPanel;
