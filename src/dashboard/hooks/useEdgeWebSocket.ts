import { useEffect, useRef, useState } from "react";

export interface EdgeMessage {
  type: "status" | "task_update" | "broadcast";
  data: unknown;
  timestamp: number;
}

export interface EdgeConnectionState {
  status: "disconnected" | "connecting" | "connected" | "error";
  error?: string;
  lastMessage?: EdgeMessage;
  messageHistory: EdgeMessage[];
}

export interface UseEdgeWebSocketOptions {
  url?: string;
  autoConnect?: boolean;
  maxHistory?: number;
  onMessage?: (message: EdgeMessage) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
  onError?: (error: string) => void;
}

/**
 * React Hook for connecting to Cloudflare Edge WebSocket (Durable Objects)
 *
 * Usage:
 * ```tsx
 * const { status, connect, disconnect, send, messages } = useEdgeWebSocket({
 *   url: 'wss://bas-orchestrator.iam-dd1.workers.dev/ws',
 *   autoConnect: true
 * });
 * ```
 */
export function useEdgeWebSocket(options: UseEdgeWebSocketOptions = {}) {
  const {
    url = import.meta.env.VITE_EDGE_WS_URL || "ws://localhost:3000/ws",
    autoConnect = false,
    maxHistory = 50,
    onMessage,
    onConnect,
    onDisconnect,
    onError,
  } = options;

  const [state, setState] = useState<EdgeConnectionState>({
    status: "disconnected",
    messageHistory: [],
  });

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();
  const reconnectAttemptsRef = useRef(0);
  const maxReconnectAttempts = 5;
  const reconnectDelayMs = 2000;

  const connect = () => {
    if (
      wsRef.current?.readyState === WebSocket.OPEN ||
      wsRef.current?.readyState === WebSocket.CONNECTING
    ) {
      return;
    }

    setState((prev) => ({ ...prev, status: "connecting", error: undefined }));

    try {
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        setState((prev) => ({
          ...prev,
          status: "connected",
          error: undefined,
        }));
        reconnectAttemptsRef.current = 0;
        onConnect?.();
      };

      ws.onmessage = (event: MessageEvent) => {
        try {
          const parsed = JSON.parse(String(event.data)) as EdgeMessage;
          const message: EdgeMessage = {
            ...parsed,
            timestamp: parsed.timestamp || Date.now(),
          };

          setState((prev) => ({
            ...prev,
            lastMessage: message,
            messageHistory: [message, ...prev.messageHistory].slice(
              0,
              maxHistory,
            ),
          }));

          onMessage?.(message);
        } catch {
          // Ignore parse errors
        }
      };

      ws.onerror = () => {
        const errorMsg = "WebSocket connection error";
        setState((prev) => ({
          ...prev,
          status: "error",
          error: errorMsg,
        }));
        onError?.(errorMsg);
      };

      ws.onclose = (event: CloseEvent) => {
        setState((prev) => ({ ...prev, status: "disconnected" }));
        onDisconnect?.();
        wsRef.current = null;

        // Auto-reconnect logic
        if (
          !event.wasClean &&
          reconnectAttemptsRef.current < maxReconnectAttempts
        ) {
          reconnectAttemptsRef.current++;
          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, reconnectDelayMs);
        }
      };
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Unknown error";
      setState((prev) => ({ ...prev, status: "error", error: errorMsg }));
      onError?.(errorMsg);
    }
  };

  const disconnect = () => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    reconnectAttemptsRef.current = maxReconnectAttempts; // Prevent auto-reconnect
    wsRef.current?.close();
    wsRef.current = null;
    setState((prev) => ({ ...prev, status: "disconnected" }));
  };

  const send = (data: Record<string, unknown>) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data));
      return true;
    }
    return false;
  };

  useEffect(() => {
    if (autoConnect) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, [url, autoConnect]);

  return {
    status: state.status,
    error: state.error,
    lastMessage: state.lastMessage,
    messages: state.messageHistory,
    isConnected: state.status === "connected",
    connect,
    disconnect,
    send,
  };
}
