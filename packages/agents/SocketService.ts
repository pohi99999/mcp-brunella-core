/**
 * SocketService - Singleton for real-time backend → frontend communication.
 * Provides broadcastLog and updateAgentStatus for Mission Control dashboard.
 */

import type { Server } from 'socket.io';
import { eventBus } from '@packages/core-logic/eventBus.js';

export type LogType = 'info' | 'error' | 'success';

export type AgentStatusPayload = 'idle' | 'working' | 'error';

export class SocketServiceClass {
  private io: Server | null = null;

  init(io: Server): void {
    this.io = io;

    // EventBus → WebSocket bridge: forward all bus events to connected Dashboard clients
    eventBus.on('*', (event) => {
      io.emit('brunella:event', event);
    });
  }

  broadcastLog(message: string, type: LogType = 'info', source?: string): void {
    if (!this.io) return;
    this.io.emit('system:log', { message, type, timestamp: Date.now(), source });
  }

  updateAgentStatus(agentName: string, status: AgentStatusPayload, taskDescription?: string): void {
    if (!this.io) return;
    this.io.emit('agent:update', { agentName, status, taskDescription, timestamp: Date.now() });
  }

  broadcastChatter(sender: string, message: string, receiver?: string, context?: any): void {
    if (!this.io) return;
    this.io.emit('agent:chatter', {
      sender,
      receiver,
      message,
      context,
      timestamp: Date.now()
    });
  }

  broadcastDebug(message: string, context?: any): void {
    if (!this.io) return;
    this.io.emit('system:debug', {
      message,
      context,
      timestamp: Date.now()
    });
  }

  isReady(): boolean {
    return this.io !== null;
  }

  /**
   * Generic emit for custom Gold Protocol events (G7.8)
   */
  emit(event: string, data: any): void {
    if (!this.io) return;
    this.io.emit(event, data);
  }

  /**
   * Robotkéz Pro step event broadcast — autonóm feladat lépésenkénti visszajelzés
   */
  broadcastRobotkezStep(stepInfo: Record<string, unknown>): void {
    if (!this.io) return;
    this.io.of('/robotkez-overlay').emit('robotkez:step', {
      ...stepInfo,
      timestamp: Date.now()
    });
    // Fő namespace-re is (Mission Control napló)
    this.io.emit('robotkez:step', {
      ...stepInfo,
      timestamp: Date.now()
    });
  }

  get connectedClientsCount(): number {
    return this.io?.engine.clientsCount || 0;
  }
}

export const socketService = new SocketServiceClass();

