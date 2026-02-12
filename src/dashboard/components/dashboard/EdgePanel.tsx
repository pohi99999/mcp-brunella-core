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
import { useEdgeWebSocket } from "@/hooks/useEdgeWebSocket";
import {
  CloudArrowUp,
  CheckCircle,
  XCircle,
  Circle,
  ArrowClockwise,
} from "@phosphor-icons/react";

export function EdgePanel() {
  const wsUrl =
    import.meta.env.VITE_EDGE_WS_URL || "ws://localhost:3000/ws";

  const {
    status,
    error,
    messages,
    isConnected,
    lastMessage,
    connect,
    disconnect,
    send,
  } = useEdgeWebSocket({
    url: wsUrl,
    autoConnect: false,
    maxHistory: 20,
  });

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
    send({
      type: "ping",
      timestamp: Date.now(),
      message: "Test from Dashboard",
    });
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
            onClick={connect}
            disabled={isConnected || status === "connecting"}
          >
            Connect
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={disconnect}
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
            <span className="text-muted-foreground">WebSocket URL:</span>
            <span className="font-mono">{wsUrl}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Messages Received:</span>
            <span>{messages.length}</span>
          </div>
          {lastMessage && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Last Message:</span>
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
                    key={idx}
                    className="rounded-md border bg-card p-2 text-xs"
                  >
                    <div className="flex items-center justify-between text-muted-foreground">
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
            <div className="text-sm text-muted-foreground">
              No messages yet. Send a test message to see it here.
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
