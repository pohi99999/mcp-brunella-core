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
  private cleanupTimer: ReturnType<typeof setInterval> | null = null;
  private readonly CLEANUP_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

  /**
   * Create a new remote session
   */
  createSession(
    userId: string,
    targetId: string,
    metadata?: Record<string, unknown>
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
    input: Record<string, unknown>
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
    result?: Record<string, unknown>,
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

  /**
   * Start the background cleanup timer (CWE-772: resource release)
   */
  startCleanupTimer(): void {
    if (this.cleanupTimer !== null) return; // already running
    this.cleanupTimer = setInterval(() => {
      this.cleanupExpiredSessions();
    }, this.CLEANUP_INTERVAL_MS);
    logInfo('RemoteSessionManager', 'Cleanup timer started');
  }

  /**
   * Stop the background cleanup timer (call on shutdown)
   */
  stopCleanupTimer(): void {
    if (this.cleanupTimer !== null) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
      logInfo('RemoteSessionManager', 'Cleanup timer stopped');
    }
  }
}

// Singleton instance
export const remoteSessionManager = new RemoteSessionManager();

// Start cleanup timer — interval handle is owned by the class instance (CWE-772)
remoteSessionManager.startCleanupTimer();
