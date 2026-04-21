/**
 * Remote Session Management Types
 * Defines data structures for remote command execution and streaming
 *
 * Phase 1: Foundation Layer
 * - RemoteSession: Session lifecycle and state
 * - RemoteTarget: Available agents/tools for execution
 * - RemoteCommand: Command queuing and execution
 * - RemoteEvent: Real-time stream events
 */

/**
 * Remote target identifier and capability
 */
export interface RemoteTarget {
  id: string;
  agentName: string;
  capability: string;
  description?: string;
  available: boolean;
}

/**
 * Remote command for execution
 */
export interface RemoteCommand {
  id: string;
  sessionId: string;
  targetId: string;
  toolName: string;
  input: Record<string, unknown>;
  status: 'pending' | 'running' | 'completed' | 'failed';
  result?: Record<string, unknown>;
  error?: string;
  createdAt: number;
  updatedAt: number;
}

/**
 * Remote session for managing command execution and streaming
 */
export interface RemoteSession {
  id: string;
  userId: string;
  targetId: string;
  createdAt: number;
  expiresAt: number;
  commands: RemoteCommand[];
  active: boolean;
  metadata?: Record<string, unknown>;
}

/**
 * Real-time event from remote stream
 */
export interface RemoteEvent {
  id: string;
  sessionId: string;
  type: 'command:status' | 'command:response' | 'stream:closed' | 'error';
  payload: Record<string, unknown>;
  timestamp: number;
}

/**
 * Request/Response shapes for API
 */

export interface CreateSessionRequest {
  targetId: string;
  userId: string;
  metadata?: Record<string, unknown>;
}

export interface CreateSessionResponse {
  sessionId: string;
  expiresAt: number;
  targetId: string;
}

export interface SendCommandRequest {
  sessionId: string;
  targetId: string;
  toolName: string;
  input: Record<string, unknown>;
}

export interface SendCommandResponse {
  commandId: string;
  status: string;
}

export interface ListTargetsResponse {
  targets: RemoteTarget[];
}

export interface SessionStreamEvent {
  id: string;
  sessionId: string;
  type: string;
  payload: Record<string, unknown>;
  timestamp: number;
}

// ─── Phase 3: Event Bridge ────────────────────────────────────────────────────

export type RemoteBridgeEventType =
  | 'agent:status'
  | 'agent:result'
  | 'tool:call'
  | 'tool:result'
  | 'device:connected'
  | 'device:disconnected'
  | 'file:read'
  | 'file:write'
  | 'voice:in'
  | 'voice:command'
  | 'voice:mapped'
  | 'voice:unmapped'
  | 'mobile:heartbeat'
  | 'paios:action:queued'
  | 'paios:action:running'
  | 'paios:action:completed'
  | 'session:update'
  | 'system:heartbeat';

export interface RemoteBridgeEvent {
  id: string;
  type: RemoteBridgeEventType;
  source: string;
  sessionId?: string;
  payload: Record<string, unknown>;
  timestamp: number;
}

// ─── Phase 3: Remote File Access ─────────────────────────────────────────────

export interface RemoteFileReadRequest {
  sessionId: string;
  path: string;
}

export interface RemoteFileReadResponse {
  path: string;
  content: string;
  encoding: 'utf8';
  size: number;
  readAt: number;
}

export interface RemoteFileWriteRequest {
  sessionId: string;
  path: string;
  content: string;
}

export interface RemoteFileWriteResponse {
  path: string;
  bytesWritten: number;
  writtenAt: number;
}

// ─── Phase 3: Voice Command ───────────────────────────────────────────────────

export interface VoiceInputRequest {
  sessionId: string;
  transcript: string;
  lang?: string;
}

export interface VoiceMappedCommand {
  toolName: string;
  targetId: string;
  input: Record<string, unknown>;
  confidence: number;
  rawTranscript: string;
}

export interface VoiceInputResponse {
  mapped: boolean;
  command?: VoiceMappedCommand;
  commandId?: string;
  reason?: string;
}

// ─── Phase 3: Mobile session summary ─────────────────────────────────────────

export interface MobileSessionSummary {
  sessionId: string;
  targetId: string;
  userId: string;
  active: boolean;
  commandCount: number;
  lastActivity: number;
  createdAt: number;
  expiresAt: number;
}
