import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  BrunellaRemoteClient,
  type RemoteCommandPayload,
  type RemoteSessionPayload,
  type RemoteTargetPayload,
} from "../../../utils/BrunellaRemoteClient";

const DEFAULT_USER_ID = "dashboard-user";
const DEFAULT_COMMAND_INPUT = "{\n}";

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

function parseCommandInput(rawInput: string): Record<string, unknown> {
  const trimmed = rawInput.trim();
  if (!trimmed) {
    return {};
  }

  try {
    const parsed = JSON.parse(trimmed) as unknown;
    if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
    return { value: parsed };
  } catch {
    return { value: trimmed };
  }
}

function commandSummary(command?: RemoteCommandPayload): string {
  if (!command) {
    return "Nincs parancs";
  }

  return `${command.toolName} · ${command.status}`;
}

export function RemoteConsolePanel() {
  const remoteClient = useMemo(() => new BrunellaRemoteClient("/api/v1"), []);
  const [targets, setTargets] = useState<RemoteTargetPayload[]>([]);
  const [sessions, setSessions] = useState<RemoteSessionPayload[]>([]);
  const [selectedTargetId, setSelectedTargetId] = useState("");
  const [userId, setUserId] = useState(DEFAULT_USER_ID);
  const [toolName, setToolName] = useState("");
  const [commandInput, setCommandInput] = useState(DEFAULT_COMMAND_INPUT);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const userIdRef = useRef(DEFAULT_USER_ID);

  const targetMap = useMemo<Record<string, RemoteTargetPayload>>(() => {
    return targets.reduce<Record<string, RemoteTargetPayload>>((map, target) => {
      map[target.id] = target;
      return map;
    }, {});
  }, [targets]);

  useEffect(() => {
    userIdRef.current = userId;
  }, [userId]);

  const refreshRemoteState = useCallback(async () => {
    const currentUserId = userIdRef.current.trim();
    if (!currentUserId) {
      setErrorMessage("A felhasználó azonosítója kötelező.");
      setTargets([]);
      setSessions([]);
      return;
    }

    setLoading(true);
    setErrorMessage(null);

    try {
      await remoteClient.authenticate(currentUserId);
      const [nextTargets, nextSessions] = await Promise.all([
        remoteClient.listTargets(currentUserId),
        remoteClient.listSessions(currentUserId),
      ]);

      setTargets(nextTargets);
      setSessions(nextSessions);
      setSelectedTargetId((currentTargetId) => {
        if (currentTargetId && nextTargets.some((target) => target.id === currentTargetId)) {
          return currentTargetId;
        }
        return nextTargets[0]?.id ?? "";
      });
    } catch (error: unknown) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }, [remoteClient]);

  useEffect(() => {
    void refreshRemoteState();
  }, [refreshRemoteState]);

  const handleCreateSession = async () => {
    const currentUserId = userIdRef.current.trim();
    if (!selectedTargetId) {
      toast.error("Válassz célt a session létrehozásához.");
      return;
    }
    if (!currentUserId) {
      toast.error("A felhasználó azonosítója kötelező.");
      return;
    }

    try {
      const session = await remoteClient.createSession(selectedTargetId, currentUserId, {
        source: "dashboard",
      });
      setSessions((currentSessions) => [
        session,
        ...currentSessions.filter((item) => item.id !== session.id),
      ]);
      toast.success(`Session létrehozva: ${session.id}`);
    } catch (error: unknown) {
      toast.error(getErrorMessage(error));
    }
  };

  const handleSendCommand = async (session: RemoteSessionPayload) => {
    const currentUserId = userIdRef.current.trim();
    const normalizedToolName = toolName.trim();

    if (!currentUserId) {
      toast.error("A felhasználó azonosítója kötelező.");
      return;
    }
    if (!normalizedToolName) {
      toast.error("Add meg a tool nevét.");
      return;
    }

    try {
      const command = await remoteClient.sendCommand(
        session.id,
        session.targetId,
        normalizedToolName,
        parseCommandInput(commandInput),
        currentUserId,
      );

      setSessions((currentSessions) =>
        currentSessions.map((currentSession) =>
          currentSession.id === session.id
            ? { ...currentSession, commands: [...currentSession.commands, command] }
            : currentSession,
        ),
      );
      toast.success(`Parancs elküldve: ${command.id}`);
    } catch (error: unknown) {
      toast.error(getErrorMessage(error));
    }
  };

  const activeSessions = sessions.filter((session) => session.active);

  return (
    <Card className="h-full border-white/5 bg-white/[0.03]" id="remote-session-panel">
      <CardHeader className="space-y-2">
        <CardTitle className="flex items-center justify-between gap-3">
          <span>Remote Layer Console</span>
          <Badge variant={errorMessage ? "destructive" : "secondary"}>
            {errorMessage ? "HIBA" : loading ? "BETÖLTÉS" : "KAPCSOLAT OK"}
          </Badge>
        </CardTitle>
        <CardDescription>
          MPC targetek, sessionök és tool dispatch a remote layeren keresztül.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {errorMessage ? (
          <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-200">
            {errorMessage}
          </div>
        ) : null}

        <div className="grid gap-3 md:grid-cols-3">
          <label className="flex flex-col gap-2 text-sm">
            <span>Felhasználó (userId)</span>
            <Input
              value={userId}
              onChange={(event) => {
                const nextValue = event.target.value;
                userIdRef.current = nextValue;
                setUserId(nextValue);
              }}
            />
          </label>

          <label className="flex flex-col gap-2 text-sm">
            <span>Cél</span>
            <select
              className="rounded-md border border-white/10 bg-background px-3 py-2 text-sm"
              value={selectedTargetId}
              onChange={(event) => setSelectedTargetId(event.target.value)}
            >
              {targets.length === 0 ? (
                <option value="">Nincs elérhető target</option>
              ) : null}
              {targets.map((target) => (
                <option key={target.id} value={target.id}>
                  {target.agentName} · {target.capability}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-2 text-sm">
            <span>Tool név</span>
            <Input
              value={toolName}
              onChange={(event) => setToolName(event.target.value)}
              placeholder="pl. list_tools"
            />
          </label>
        </div>

        <label className="flex flex-col gap-2 text-sm">
          <span>Input (JSON vagy egyszerű szöveg)</span>
          <Textarea
            value={commandInput}
            onChange={(event) => setCommandInput(event.target.value)}
            rows={4}
          />
        </label>

        <div className="flex flex-wrap gap-3">
          <Button variant="outline" onClick={() => void refreshRemoteState()} disabled={loading}>
            {loading ? "Frissítés..." : "Frissítés"}
          </Button>
          <Button onClick={() => void handleCreateSession()} disabled={loading || !selectedTargetId}>
            Új session
          </Button>
        </div>

        <div className="space-y-3">
          {activeSessions.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nincsenek aktív sessionök.</p>
          ) : null}

          {activeSessions.map((session) => {
            const latestCommand = session.commands[session.commands.length - 1];
            const target = targetMap[session.targetId];

            return (
              <article
                key={session.id}
                className="rounded-lg border border-white/5 bg-black/20 p-4 shadow-sm"
              >
                <div className="flex flex-col gap-1">
                  <p className="text-xs text-muted-foreground">ID: {session.id}</p>
                  <p className="text-sm font-semibold text-white">
                    {target?.agentName ?? session.targetId}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Capability: {target?.capability ?? "n/a"}
                  </p>
                  <p className="text-xs text-muted-foreground">User: {session.userId}</p>
                  <p className="text-xs text-muted-foreground">
                    Commands: {session.commands.length}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Last: {commandSummary(latestCommand)}
                  </p>
                </div>

                <div className="mt-3 flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => void handleSendCommand(session)}
                    disabled={loading}
                  >
                    Parancs küldése
                  </Button>
                  <span className="text-xs text-muted-foreground">
                    {session.active ? "Aktív" : "Inaktív"}
                  </span>
                </div>
              </article>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
