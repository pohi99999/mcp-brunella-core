import { EventEmitter } from "events";
import { logInfo, logWarn } from "../utils/logger.js";
import { socketService } from "../server/SocketService.js";

export interface ChatMessage {
  agentId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
}

export interface SwarmChatSession {
  id: string;
  objective: string;
  participants: string[]; // Agent IDs
  history: ChatMessage[];
  status: 'active' | 'resolved' | 'failed';
  metadata: Record<string, any>;
}

/**
 * SwarmChatManager - Közös kontextusú raj együttműködés kezelője.
 * Megvalósítja a megosztott memóriát és az üzenetek elosztását az ügynökök között.
 */
export class SwarmChatManager extends EventEmitter {
  private sessions = new Map<string, SwarmChatSession>();

  /** Új raj chat munkamenet létrehozása */
  public createSession(objective: string, participants: string[]): SwarmChatSession {
    const session: SwarmChatSession = {
      id: `chat-swarm-${Date.now()}`,
      objective,
      participants,
      history: [
        {
          agentId: 'system',
          role: 'system',
          content: `Raj chat indítva. Cél: ${objective}. Résztvevők: ${participants.join(', ')}`,
          timestamp: new Date().toISOString()
        }
      ],
      status: 'active',
      metadata: {}
    };
    this.sessions.set(session.id, session);
    logInfo('SwarmChatManager', `Új raj chat munkamenet: ${session.id} - ${objective}`);
    return session;
  }

  public getSession(id: string): SwarmChatSession | undefined {
    return this.sessions.get(id);
  }

  /** Összes munkamenet listázása */
  public listSessions(): SwarmChatSession[] {
    return Array.from(this.sessions.values());
  }

  /** Üzenet hozzáadása a megosztott kontextushoz és elosztás a résztvevőknek */
  public addMessage(sessionId: string, message: Omit<ChatMessage, 'timestamp'>): void {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error(`Raj munkamenet nem található: ${sessionId}`);

    const fullMessage: ChatMessage = {
      ...message,
      timestamp: new Date().toISOString()
    };
    session.history.push(fullMessage);
    
    // Valós idejű értesítés a Dashboard felé
    socketService.broadcastChatter(fullMessage.agentId, fullMessage.content, fullMessage.role === 'user' ? 'user' : 'assistant');
    
    logInfo('SwarmChatManager', `[${session.id}] Üzenet tőle: ${fullMessage.agentId}`);
    this.emit('message:added', { sessionId, message: fullMessage });
  }

  /** Munkamenet lezárása */
  public resolveSession(sessionId: string, status: 'resolved' | 'failed' = 'resolved'): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.status = status;
      logInfo('SwarmChatManager', `Raj munkamenet lezárva: ${sessionId} [${status}]`);
      this.emit('session:resolved', { sessionId, status });
    }
  }
}

export const globalSwarmChatManager = new SwarmChatManager();
