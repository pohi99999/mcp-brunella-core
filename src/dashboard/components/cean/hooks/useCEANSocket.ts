import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { logInfo, logError } from '@/utils/logger';
import { getSocketOrigin } from '@/lib/backendOrigin';

/**
 * Socket.IO hook for CEAN real-time events
 */
export const useCEANSocket = () => {
  const socketRef = useRef<Socket | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    try {
      const socket = io(getSocketOrigin(), {
        path: '/socket.io',
        transports: ['websocket', 'polling'],
      });

      socketRef.current = socket;

      socket.on('connect', () => {
        logInfo('CEANSocket', 'Connected to WebSocket');
        setConnected(true);
      });

      socket.on('disconnect', () => {
        logInfo('CEANSocket', 'Disconnected from WebSocket');
        setConnected(false);
      });

      socket.on('error', (error: unknown) => {
        const msg = error instanceof Error ? error.message : String(error);
        logError('CEANSocket', msg);
      });

      return () => {
        socket.disconnect();
      };
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      logError('CEANSocket', msg);
    }
  }, []);

  return {
    socket: socketRef.current,
    connected,
    emit: (event: string, data: unknown) => {
      if (socketRef.current?.connected) {
        socketRef.current.emit(event, data);
      }
    },
    on: (event: string, callback: (data: unknown) => void) => {
      if (socketRef.current) {
        socketRef.current.on(event, callback);
      }
    },
  };
};
