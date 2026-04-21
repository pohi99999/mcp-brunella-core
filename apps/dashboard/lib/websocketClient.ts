import { useEffect, useRef, useState } from 'react';

// This is a simplified placeholder. In a real app, you would get this 
// from your environment configuration.
const API_BASE = 'ws://localhost:3000'; 

interface WebSocketMessage<T = unknown> {
  type: string;
  payload: T;
  timestamp: string;
}

export function useWebSocketEvents<T = unknown>(
  eventTypes: string[],
  onMessage: (message: WebSocketMessage<T>) => void,
): { isConnected: boolean; error: string | null } {
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    // Construct the WebSocket URL from the API_BASE
    const wsUrl = `${API_BASE.replace(/^http/, 'ws')}/api/v1/ws/events`;
    wsRef.current = new WebSocket(wsUrl);

    wsRef.current.onopen = () => {
      setIsConnected(true);
      setError(null);
      console.log('WebSocket connected.');
    };

    wsRef.current.onmessage = (event) => {
      try {
        const message: WebSocketMessage<T> = JSON.parse(event.data);
        if (eventTypes.includes(message.type)) {
          onMessage(message);
        }
      } catch (e) {
        console.error('Failed to parse WebSocket message:', e);
      }
    };

    wsRef.current.onerror = (e) => {
      console.error('WebSocket error:', e);
      setError('WebSocket connection error.');
      setIsConnected(false);
    };

    wsRef.current.onclose = () => {
      console.log('WebSocket disconnected.');
      setIsConnected(false);
      // Optional: implement auto-reconnect logic here
    };

    // Cleanup on component unmount
    return () => {
      wsRef.current?.close();
    };
  }, [JSON.stringify(eventTypes), onMessage]); // Use JSON.stringify to stabilize the dependency array

  return { isConnected, error };
}
