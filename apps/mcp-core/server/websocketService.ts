import { WebSocket, WebSocketServer } from 'ws';
import { logInfo, logError } from '@packages/utils/logger.js';
import { ensureError } from '@packages/utils/ensureError.js';
import type { Server } from 'http';

const TAG = 'WebSocketService';

interface WebSocketMessage {
  type: string;
  payload: unknown;
  timestamp: string;
}

class WebSocketManager {
  private wss: WebSocketServer;
  private clients: Set<WebSocket> = new Set();
  private initialized = false;

  constructor() {
    this.wss = new WebSocketServer({ noServer: true });

    this.wss.on('connection', (ws: WebSocket) => {
      this.clients.add(ws);
      logInfo(TAG, `WebSocket client connected. Total clients: ${this.clients.size}`);

      ws.on('close', () => {
        this.clients.delete(ws);
        logInfo(TAG, `WebSocket client disconnected. Total clients: ${this.clients.size}`);
      });

      ws.on('error', (error) => {
        logError(TAG, `WebSocket error: ${ensureError(error).message}`);
      });
    });
  }

  public initialize(server: Server): void {
    if (this.initialized) {
      logInfo(TAG, 'WebSocket service already initialized.');
      return;
    }

    server.on('upgrade', (request, socket, head) => {
      if (request.url === '/api/v1/ws/events') {
        this.wss.handleUpgrade(request, socket, head, (ws) => {
          this.wss.emit('connection', ws, request);
        });
      } else {
        socket.destroy();
      }
    });
    this.initialized = true;
    logInfo(TAG, 'WebSocket service ready to handle upgrades.');
  }

  public broadcast(type: string, payload: unknown): void {
    if (this.clients.size === 0) {
      return; // Ne küldjünk üzenetet, ha nincs csatlakoztatott kliens
    }

    const message: WebSocketMessage = {
      type,
      payload,
      timestamp: new Date().toISOString(),
    };
    const messageString = JSON.stringify(message);

    this.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(messageString);
      }
    });
    logInfo(TAG, `Broadcasted message type: ${type} to ${this.clients.size} clients.`);
  }
}

export const webSocketManager = new WebSocketManager();

