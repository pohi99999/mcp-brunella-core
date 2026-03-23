/**
 * Remote Session Manager
 * Manages in-memory remote sessions, commands, and event streams
 *
 * Phase 1: Foundation
 * - Session lifecycle (create, expire, cleanup)
 * - Command queuing and tracking
 * - Event stream for real-time updates
 */

import { v4 as uuidv4 } from 'uuid';
import { logInfo, logError } from '../utils/logger.js';
import type {
  RemoteSession,
  RemoteCommand,
  RemoteTarget,
  RemoteEvent,
} from './types/remote.js';

export class RemoteSessionManager {
  private sessions = new Map<string, RemoteSession>();
  private events = new Map<string, RemoteEvent[]>();
  private sessionTimeout = 3600000; // 1 hour default
  private maxEventsPerSession = 1000;

  /**
   * Create a new remote session
   */
  createSession(
    userId: string,
    targetId: string,
    metadata?: Record<string, any>
  ): RemoteSession {
    const now = Date.now();
    const session: RemoteSession = {
      id: uuidv4(),
      userId,
      targetId,
      createdAt: now,
      expiresAt: now + this.sessionTimeout,
      commands: [],
      active: true,
      metadata,
    };

    this.sessions.set(session.id, session);
    this.events.set(session.id, []);

    logInfo('RemoteSessionManager', `Session created: ${session.id} for target ${targetId}`);
    return session;
  }

  /**
   * Get an existing session
   */
  getSession(sessionId: string): RemoteSession | undefined {
    const session = this.sessions.get(sessionId);
    if (session && session.expiresAt < Date.now()) {
      // Session expired, clean it up
      this.sessions.delete(sessionId);
      this.events.delete(sessionId);
      logInfo('RemoteSessionManager', `Session expired: ${sessionId}`);
      return undefined;
    }
    return session;
  }

  /**
   * Add a command to a session
   */
  addCommand(
    sessionId: string,
    targetId: string,
    toolName: string,
    input: Record<string, any>
  ): RemoteCommand | null {
    const session = this.getSession(sessionId);
    if (!session) {
      logError('RemoteSessionManager', `Session not found: ${sessionId}`);
      return null;
    }

    const command: RemoteCommand = {
      id: uuidv4(),
      sessionId,
      targetId,
      toolName,
      input,
      status: 'pending',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    session.commands.push(command);
    logInfo('RemoteSessionManager', `Command added: ${command.id} to session ${sessionId}`);
    return command;
  }

  /**
   * Update command status
   */
  updateCommandStatus(
    sessionId: string,
    commandId: string,
    status: 'pending' | 'running' | 'completed' | 'failed',
    result?: Record<string, any>,
    error?: string
  ): RemoteCommand | null {
    const session = this.getSession(sessionId);
    if (!session) return null;

    const command = session.commands.find(c => c.id === commandId);
    if (!command) return null;

    command.status = status;
    command.updatedAt = Date.now();
    if (result) command.result = result;
    if (error) command.error = error;

    // Emit event for stream
    this.addEvent(sessionId, {
      id: uuidv4(),
      sessionId,
      type: 'command:status',
      payload: {
        commandId,
        status,
        result,
        error,
      },
      timestamp: Date.now(),
    });

    return command;
  }

  /**
   * Get pending commands for a session
   */
  getPendingCommands(sessionId: string): RemoteCommand[] {
    const session = this.getSession(sessionId);
    if (!session) return [];
    return session.commands.filter(c => c.status === 'pending');
  }

  /**
   * Add an event to the session stream
   */
  addEvent(sessionId: string, event: RemoteEvent): void {
    const events = this.events.get(sessionId) || [];
    events.push(event);

    // Keep only recent events
    if (events.length > this.maxEventsPerSession) {
      events.splice(0, events.length - this.maxEventsPerSession);
    }

    this.events.set(sessionId, events);
  }

  /**
   * Get events since a given timestamp
   */
  getEventsSince(sessionId: string, timestamp: number): RemoteEvent[] {
    const events = this.events.get(sessionId) || [];
    return events.filter(e => e.timestamp > timestamp);
  }

  /**
   * Close a session
   */
  closeSession(sessionId: string): void {
    const session = this.getSession(sessionId);
    if (session) {
      session.active = false;
      this.addEvent(sessionId, {
        id: uuidv4(),
        sessionId,
        type: 'stream:closed',
        payload: { reason: 'session_closed' },
        timestamp: Date.now(),
      });
      logInfo('RemoteSessionManager', `Session closed: ${sessionId}`);
    }
  }

  /**
   * Cleanup expired sessions
   */
  cleanupExpiredSessions(): void {
    const now = Date.now();
    let cleanedCount = 0;

    for (const [sessionId, session] of this.sessions.entries()) {
      if (session.expiresAt < now) {
        this.sessions.delete(sessionId);
        this.events.delete(sessionId);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      logInfo('RemoteSessionManager', `Cleaned up ${cleanedCount} expired sessions`);
    }
  }

  /**
   * Get all active sessions (for debugging)
   */
  getActiveSessions(): RemoteSession[] {
    const now = Date.now();
    return Array.from(this.sessions.values()).filter(
      s => s.active && s.expiresAt > now
    );
  }
}

// Singleton instance
export const remoteSessionManager = new RemoteSessionManager();

// Cleanup expired sessions every 5 minutes
setInterval(() => {
  remoteSessionManager.cleanupExpiredSessions();
}, 5 * 60 * 1000);
