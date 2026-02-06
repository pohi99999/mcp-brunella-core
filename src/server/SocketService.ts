/**
 * SocketService - Singleton for real-time backend → frontend communication.
 * Provides broadcastLog and updateAgentStatus for Mission Control dashboard.
 */

import type { Server } from 'socket.io';

export type LogType = 'info' | 'error' | 'success';

export type AgentStatusPayload = 'idle' | 'working' | 'error';

class SocketServiceClass {
  private io: Server | null = null;

  init(io: Server): void {
    this.io = io;
  }

  broadcastLog(message: string, type: LogType = 'info', source?: string): void {
    if (!this.io) return;
    this.io.emit('system:log', { message, type, timestamp: Date.now(), source });
  }

  updateAgentStatus(agentName: string, status: AgentStatusPayload, taskDescription?: string): void {
    if (!this.io) return;
    this.io.emit('agent:update', { agentName, status, taskDescription, timestamp: Date.now() });
  }

  isReady(): boolean {
    return this.io !== null;
  }
}

export const socketService = new SocketServiceClass();
