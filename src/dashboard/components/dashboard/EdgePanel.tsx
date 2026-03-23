import { useEffect, useMemo, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useSystemSignal } from "@/hooks/useSystemSignal";
import {
  CloudArrowUp,
  CheckCircle,
  XCircle,
  Circle,
  ArrowClockwise,
} from "@phosphor-icons/react";

interface EdgePanelMessage {
  id: string;
  type: string;
  data: unknown;
  timestamp: number;
}

export function EdgePanel() {
  const { socket, isConnected } = useSystemSignal();
  const [status, setStatus] = useState<
    "disconnected" | "connecting" | "connected" | "error"
  >("disconnected");
  const [error, setError] = useState<string | undefined>(undefined);
  const [messages, setMessages] = useState<EdgePanelMessage[]>([]);
  const [lastMessage, setLastMessage] = useState<EdgePanelMessage | undefined>(
    undefined,
  );
  const [socketId, setSocketId] = useState<string>("-");
  const [transport, setTransport] = useState<string>("-");
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  const [lastDisconnectReason, setLastDisconnectReason] = useState<string>("-");

  const getTransportName = (): string => {
    const transportName = socket?.io?.engine?.transport?.name;
    return typeof transportName === "string" ? transportName : "-";
  };

  const wsUrl = useMemo(() => {
    const baseUrl =
      import.meta.env.VITE_SOCKET_URL ||
      (import.meta.env.DEV ? "http://localhost:3000" : window.location.origin);
    return `${baseUrl.replace(/^http/i, "ws")}/socket.io/?EIO=4&transport=websocket`;
  }, []);

  useEffect(() => {
    if (!socket) {
      setStatus("disconnected");
      return;
    }

    const pushMessage = (type: string, data: unknown) => {
      const msg: EdgePanelMessage = {
        id: `${type}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        type,
        data,
        timestamp: Date.now(),
      };
      setLastMessage(msg);
      setMessages((prev) => [msg, ...prev].slice(0, 20));
    };

    const onConnect = () => {
      setStatus("connected");
      setError(undefined);
      setSocketId(socket.id ?? "-");
      setTransport(getTransportName());
      setReconnectAttempts(0);
    };

    const onDisconnect = (reason: string) => {
      setStatus("disconnected");
      setLastDisconnectReason(reason || "unknown");
      setSocketId("-");
      setTransport("-");
      if (reason && reason !== "io client disconnect") {
        setError(`Connection closed: ${reason}`);
      }
    };

    const onConnectError = (err: unknown) => {
      setStatus("error");
      const message =
        err instanceof Error
          ? err.message
          : typeof err === "string"
            ? err
            : "Socket connection error";
      setError(message);
    };

    const onReconnectAttempt = () => {
      setReconnectAttempts((prev) => prev + 1);
    };

    const onReconnect = () => {
      setReconnectAttempts(0);
      setSocketId(socket.id ?? "-");
      setTransport(getTransportName());
    };

    const onReconnectFailed = () => {
      setError("Reconnect failed after max attempts");
    };

    const onTaskSubmitted = (payload: unknown) =>
      pushMessage("edge:task:submitted", payload);
    const onTaskProgress = (payload: unknown) =>
      pushMessage("edge:task:progress", payload);
    const onTaskComplete = (payload: unknown) =>
      pushMessage("edge:task:complete", payload);
    const onTaskError = (payload: unknown) =>
      pushMessage("edge:task:error", payload);
    const onStatusResponse = (payload: unknown) =>
      pushMessage("edge:status:response", payload);
    const onStatusError = (payload: unknown) =>
      pushMessage("edge:status:error", payload);
    const onChatResponse = (payload: unknown) =>
      pushMessage("edge:chat:response", payload);
    const onChatError = (payload: unknown) =>
      pushMessage("edge:chat:error", payload);

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("connect_error", onConnectError);
    socket.io.on("reconnect_attempt", onReconnectAttempt);
    socket.io.on("reconnect", onReconnect);
    socket.io.on("reconnect_failed", onReconnectFailed);
    socket.on("edge:task:submitted", onTaskSubmitted);
    socket.on("edge:task:progress", onTaskProgress);
    socket.on("edge:task:complete", onTaskComplete);
    socket.on("edge:task:error", onTaskError);
    socket.on("edge:status:response", onStatusResponse);
    socket.on("edge:status:error", onStatusError);
    socket.on("edge:chat:response", onChatResponse);
    socket.on("edge:chat:error", onChatError);

    setStatus(socket.connected ? "connected" : "disconnected");
    if (socket.connected) {
      setSocketId(socket.id ?? "-");
      setTransport(getTransportName());
    }

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("connect_error", onConnectError);
      socket.io.off("reconnect_attempt", onReconnectAttempt);
      socket.io.off("reconnect", onReconnect);
      socket.io.off("reconnect_failed", onReconnectFailed);
      socket.off("edge:task:submitted", onTaskSubmitted);
      socket.off("edge:task:progress", onTaskProgress);
      socket.off("edge:task:complete", onTaskComplete);
      socket.off("edge:task:error", onTaskError);
      socket.off("edge:status:response", onStatusResponse);
      socket.off("edge:status:error", onStatusError);
      socket.off("edge:chat:response", onChatResponse);
      socket.off("edge:chat:error", onChatError);
    };
  }, [socket]);

  const statusConfig = {
    disconnected: {
      icon: <Circle size={16} weight="fill" className="text-gray-400" />,
      label: "Disconnected",
      color: "secondary" as const,
    },
    connecting: {
      icon: <ArrowClockwise size={16} className="animate-spin text-blue-500" />,
      label: "Connecting...",
      color: "default" as const,
    },
    connected: {
      icon: <CheckCircle size={16} weight="fill" className="text-green-500" />,
      label: "Connected",
      color: "default" as const,
    },
    error: {
      icon: <XCircle size={16} weight="fill" className="text-red-500" />,
      label: "Error",
      color: "destructive" as const,
    },
  };

  const currentStatus = statusConfig[status];

  const handleTestMessage = () => {
    if (!socket || !socket.connected) {
      setError("Socket is not connected");
      return;
    }

    socket.emit("edge:chat:message", {
      instruction: "ping",
      history: [],
    });
  };

  const handleConnect = () => {
    if (!socket) {
      setError("Socket provider not available");
      return;
    }
    setStatus("connecting");
    setError(undefined);
    socket.connect();
  };

  const handleDisconnect = () => {
    if (!socket) return;
    socket.disconnect();
    setStatus("disconnected");
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CloudArrowUp size={24} weight="duotone" className="text-primary" />
            <CardTitle>Edge WebSocket</CardTitle>
          </div>
          <Badge
            variant={currentStatus.color}
            className="flex items-center gap-1.5"
          >
            {currentStatus.icon}
            {currentStatus.label}
          </Badge>
        </div>
        <CardDescription>
          Real-time connection to Cloudflare Edge (Durable Objects)
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Connection Controls */}
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={handleConnect}
            disabled={isConnected || status === "connecting"}
          >
            Connect
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={handleDisconnect}
            disabled={!isConnected && status !== "connecting"}
          >
            Disconnect
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={handleTestMessage}
            disabled={!isConnected}
          >
            Send Test
          </Button>
        </div>

        {/* Error Display */}
        {error && (
          <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            <div className="flex items-center gap-2">
              <XCircle size={16} weight="fill" />
              <span className="font-medium">Connection Error:</span>
            </div>
            <p className="mt-1 text-xs">{error}</p>
          </div>
        )}

        {/* Connection Info */}
        <div className="space-y-2 rounded-md border bg-muted/50 p-3 text-xs">
          <div className="flex justify-between">
            <span className="text-zinc-500">WebSocket URL:</span>
            <span className="font-mono">{wsUrl}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-zinc-500">Socket ID:</span>
            <span className="font-mono">{socketId}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-zinc-500">Transport:</span>
            <span className="font-mono">{transport}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-zinc-500">Reconnect Attempts:</span>
            <span>{reconnectAttempts}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-zinc-500">Last Disconnect:</span>
            <span className="font-mono">{lastDisconnectReason}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-zinc-500">Messages Received:</span>
            <span>{messages.length}</span>
          </div>
          {lastMessage && (
            <div className="flex justify-between">
              <span className="text-zinc-500">Last Message:</span>
              <span>
                {new Date(lastMessage.timestamp).toLocaleTimeString()} -{" "}
                {lastMessage.type}
              </span>
            </div>
          )}
        </div>

        {/* Message History */}
        {messages.length > 0 && (
          <div>
            <h4 className="mb-2 text-sm font-medium">Recent Messages</h4>
            <ScrollArea className="h-[200px] rounded-md border">
              <div className="space-y-2 p-3">
                {messages.map((msg, idx) => (
                  <div
                    key={`${msg.id}-${idx}`}
                    className="rounded-md border bg-card p-2 text-xs"
                  >
                    <div className="flex items-center justify-between text-zinc-500">
                      <Badge variant="outline" className="text-[10px]">
                        {msg.type}
                      </Badge>
                      <span className="font-mono text-[10px]">
                        {new Date(msg.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                    <pre className="mt-1.5 overflow-x-auto whitespace-pre-wrap font-mono text-[10px]">
                      {JSON.stringify(msg.data, null, 2)}
                    </pre>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        )}

        {/* Empty State */}
        {messages.length === 0 && isConnected && (
          <div className="flex items-center justify-center rounded-md border border-dashed py-8 text-center">
            <div className="text-sm text-zinc-500">
              No messages yet. Send a test message to see it here.
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
