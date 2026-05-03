import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { logInfo, logError } from '@packages/utils/logger.js';
import { generateRemoteToken } from '@packages/core-logic/remoteAuth.js';
import { authRemote as requireRemoteAuth } from '../middleware/authRemote.js';
import {
  saveSession,
  getSession,
  listActiveSessions,
  deactivateSession,
  saveCommand,
  getCommand,
  updateCommandStatus,
} from '@packages/core-logic/remoteSessionStore.js';
import { discoverMcpServers, getDiscoveredTargets } from '@packages/core-logic/mcpDiscovery.js';
import { mcpRouter } from '@packages/core-logic/MCPRouter.js';
import { mcpClientManager } from '@packages/utils/mcpClientManager.js';
import { remoteReadFile, remoteWriteFile, remoteListFiles } from '@packages/core-logic/remoteFileAccess.js';
import { mapVoiceToCommand, listVoiceIntents } from '@packages/core-logic/voicePipeline.js';
import { buildMobileSessionSummary, processMobileHeartbeat } from '@packages/core-logic/mobileClientBootstrap.js';
import { enqueuePaiosAction, processNextPaiosAction, getPaiosQueueStatus } from '@packages/core-logic/paiosRemoteIntegration.js';
import { remoteEventBridge } from '@packages/core-logic/remoteEventBridge.js';
import type {
  RemoteSession,
  RemoteCommand,
  RemoteBridgeEvent,
} from '@packages/core-logic/types/remote.js';
import type { PaiosAction } from '@packages/core-logic/paiosRemoteIntegration.js';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function readPositiveTtl(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    return 3_600_000;
  }
  return Math.min(Math.trunc(value), 86_400_000);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function readPaiosAction(value: unknown): PaiosAction | null {
  if (!isRecord(value)) return null;
  const actionId = readString(value.actionId);
  const type = readString(value.type);
  const description = readString(value.description) ?? '';
  const payload = isRecord(value.payload) ? value.payload : {};
  const priority = typeof value.priority === 'number' && Number.isFinite(value.priority)
    ? Math.max(1, Math.trunc(value.priority))
    : undefined;
  if (!actionId || !type) return null;
  return { actionId, type, description, payload, priority };
}

export function createRemoteRoutes(): Router {
  const router = Router();

  // ── Auth ───────────────────────────────────────────────────────────────────

  /**
   * POST /auth/token
   * Body: { userId: string, ttlMs?: number }
   * Returns: { token: string, expiresAt: number }
   * NOTE: In production, call this only after validating the caller's identity
   *       via your primary auth mechanism (e.g., session cookie, OAuth).
  */
  router.post('/auth/token', (req, res) => {
    const body = isRecord(req.body) ? req.body : {};
    const userId = readString(body.userId);
    if (!userId) {
      res.status(400).json({ error: 'userId is required' });
      return;
    }
    const ttl = readPositiveTtl(body.ttlMs);
    const expiresAt = Date.now() + ttl;
    const token = generateRemoteToken(userId, ttl);
    logInfo('RemoteRouter', `Token issued for user=${userId}`);
    res.json({ token, expiresAt });
  });

  // ── Discovery ──────────────────────────────────────────────────────────────

  /**
   * GET /discover
   * Returns raw MCP server config list (filtered, no secrets).
   */
  router.get('/discover', requireRemoteAuth, (_req, res) => {
    const servers = discoverMcpServers();
    res.json({ servers, count: servers.length });
  });

  /**
   * GET /targets
   * Returns RemoteTarget[] resolved from discovered MCP servers.
   */
  router.get('/targets', requireRemoteAuth, (_req, res) => {
    const targets = getDiscoveredTargets();
    res.json({ targets, count: targets.length });
  });

  // ── Sessions ───────────────────────────────────────────────────────────────

  /**
   * POST /sessions
   * Body: CreateSessionRequest
  */
  router.post('/sessions', requireRemoteAuth, (req, res) => {
    const body = isRecord(req.body) ? req.body : {};
    const targetId = readString(body.targetId);
    const userId = readString(body.userId);
    const metadata = isRecord(body.metadata) ? body.metadata : undefined;
    if (!targetId || !userId) {
      res.status(400).json({ error: 'targetId and userId are required' });
      return;
    }
    const cap = mcpRouter.getCapability(targetId);
    if (!cap) {
      res.status(404).json({ error: `Target '${targetId}' not found` });
      return;
    }
    const session: RemoteSession = {
      id: uuidv4(),
      userId,
      targetId,
      createdAt: Date.now(),
      expiresAt: Date.now() + 3_600_000,
      active: true,
      commands: [],
      metadata,
    };
    try {
      saveSession(session);
      logInfo('RemoteRouter', `Session created id=${session.id} target=${session.targetId}`);
      res.status(201).json({
        sessionId: session.id,
        expiresAt: session.expiresAt,
        targetId: session.targetId,
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      logError('RemoteRouter', `Failed to create session: ${msg}`);
      res.status(500).json({ error: msg });
    }
  });

  /**
   * GET /sessions
   * Query: ?userId=...  (optional filter)
   */
  router.get('/sessions', requireRemoteAuth, (req, res) => {
    const userId = readString(req.query.userId) ?? undefined;
    const sessions = listActiveSessions(userId);
    res.json({ sessions, count: sessions.length });
  });

  /**
   * GET /sessions/:id
  */
  router.get('/sessions/:id', requireRemoteAuth, (req, res) => {
    const sessionId = readString(req.params.id);
    const session = sessionId ? getSession(sessionId) : undefined;
    if (!session) {
      res.status(404).json({ error: 'Session not found' });
      return;
    }
    res.json({ session });
  });

  /**
   * DELETE /sessions/:id
  */
  router.delete('/sessions/:id', requireRemoteAuth, (req, res) => {
    const sessionId = readString(req.params.id);
    const session = sessionId ? getSession(sessionId) : undefined;
    if (!sessionId || !session) {
      res.status(404).json({ error: 'Session not found' });
      return;
    }
    deactivateSession(sessionId);
    logInfo('RemoteRouter', `Session closed id=${sessionId}`);
    res.json({ ok: true });
  });

  // ── Commands ───────────────────────────────────────────────────────────────

  /**
   * POST /commands
   * Body: SendCommandRequest
  */
  router.post('/commands', requireRemoteAuth, (req, res) => {
    const body = isRecord(req.body) ? req.body : {};
    const sessionId = readString(body.sessionId);
    const targetId = readString(body.targetId);
    const toolName = readString(body.toolName);
    const input = body.input === undefined ? {} : body.input;
    if (!sessionId || !targetId || !toolName) {
      res.status(400).json({ error: 'sessionId, targetId, toolName are required' });
      return;
    }
    if (!isRecord(input)) {
      res.status(400).json({ error: 'input must be an object when provided' });
      return;
    }
    const session = getSession(sessionId);
    if (!session || !session.active) {
      res.status(404).json({ error: 'Session not found or inactive' });
      return;
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
    try {
      saveCommand(command);
      logInfo('RemoteRouter', `Command queued id=${command.id} tool=${command.toolName}`);
      // Async execution dispatched — update status asynchronously
      _dispatchCommand(command).catch((err: unknown) =>
        logError('RemoteRouter', `Command dispatch failed id=${command.id}: ${errorMessage(err)}`)
      );
      res.status(202).json({ commandId: command.id, status: 'pending' });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      res.status(500).json({ error: msg });
    }
  });

  /**
   * GET /commands/:id
  */
  router.get('/commands/:id', requireRemoteAuth, (req, res) => {
    const commandId = readString(req.params.id);
    const command = commandId ? getCommand(commandId) : undefined;
    if (!command) {
      res.status(404).json({ error: 'Command not found' });
      return;
    }
    res.json({ command });
  });

  // ── Phase 3: Files ──────────────────────────────────────────────────────────

  /**
   * POST /files/read
   * Body: RemoteFileReadRequest
  */
  router.post('/files/read', requireRemoteAuth, (req, res) => {
    const body = isRecord(req.body) ? req.body : {};
    const sessionId = readString(body.sessionId);
    const filePath = readString(body.path);
    if (!sessionId || !filePath) {
      res.status(400).json({ error: 'sessionId and path are required' });
      return;
    }
    const session = getSession(sessionId);
    if (!session || !session.active) {
      res.status(404).json({ error: 'Session not found or inactive' });
      return;
    }
    try {
      const result = remoteReadFile({ sessionId, path: filePath });
      res.json(result);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      res.status(400).json({ error: msg });
    }
  });

  /**
   * POST /files/write
   * Body: RemoteFileWriteRequest
  */
  router.post('/files/write', requireRemoteAuth, (req, res) => {
    const body = isRecord(req.body) ? req.body : {};
    const sessionId = readString(body.sessionId);
    const filePath = readString(body.path);
    const content = typeof body.content === 'string' ? body.content : null;
    if (!sessionId || !filePath || content === null) {
      res.status(400).json({ error: 'sessionId, path, and content are required' });
      return;
    }
    const session = getSession(sessionId);
    if (!session || !session.active) {
      res.status(404).json({ error: 'Session not found or inactive' });
      return;
    }
    try {
      const result = remoteWriteFile({ sessionId, path: filePath, content });
      res.json(result);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      res.status(400).json({ error: msg });
    }
  });

  /**
   * GET /files/list
   * Query: ?sessionId=...&dir=...
  */
  router.get('/files/list', requireRemoteAuth, (req, res) => {
    const sessionId = readString(req.query.sessionId);
    if (!sessionId) {
      res.status(400).json({ error: 'sessionId query param is required' });
      return;
    }
    const session = getSession(sessionId);
    if (!session || !session.active) {
      res.status(404).json({ error: 'Session not found or inactive' });
      return;
    }
    try {
      const files = remoteListFiles();
      res.json({ files, count: files.length });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      res.status(400).json({ error: msg });
    }
  });

  // ── Phase 3: Voice ─────────────────────────────────────────────────────────

  /**
   * POST /voice/input
   * Body: VoiceInputRequest
  */
  router.post('/voice/input', requireRemoteAuth, (req, res) => {
    const body = isRecord(req.body) ? req.body : {};
    const sessionId = readString(body.sessionId);
    const transcript = readString(body.transcript);
    const lang = readString(body.lang) ?? undefined;
    if (!sessionId || !transcript) {
      res.status(400).json({ error: 'sessionId and transcript are required' });
      return;
    }
    const session = getSession(sessionId);
    if (!session || !session.active) {
      res.status(404).json({ error: 'Session not found or inactive' });
      return;
    }
    const voiceResult = mapVoiceToCommand({ sessionId, transcript, lang });
    res.json(voiceResult);
  });

  /**
   * GET /voice/intents
   */
  router.get('/voice/intents', requireRemoteAuth, (_req, res) => {
    const intents = listVoiceIntents();
    res.json({ intents, count: intents.length });
  });

  // ── Phase 3: Mobile ────────────────────────────────────────────────────────

  /**
   * GET /mobile/summary/:sessionId
  */
  router.get('/mobile/summary/:sessionId', requireRemoteAuth, (req, res) => {
    const sessionId = readString(req.params.sessionId);
    const session = sessionId ? getSession(sessionId) : undefined;
    if (!session) {
      res.status(404).json({ error: 'Session not found' });
      return;
    }
    const summary = buildMobileSessionSummary(session);
    res.json({ summary });
  });

  /**
   * POST /mobile/heartbeat
   * Body: { sessionId: string }
  */
  router.post('/mobile/heartbeat', requireRemoteAuth, (req, res) => {
    const body = isRecord(req.body) ? req.body : {};
    const sessionId = readString(body.sessionId);
    if (!sessionId) {
      res.status(400).json({ error: 'sessionId is required' });
      return;
    }
    const session = getSession(sessionId);
    if (!session || !session.active) {
      res.status(404).json({ error: 'Session not found or inactive' });
      return;
    }
    const ack = processMobileHeartbeat(sessionId, session);
    res.json(ack);
  });

  // ── Phase 3: PAIOS ─────────────────────────────────────────────────────────

  /**
  * POST /paios/action
  * Body: { sessionId: string, action: PaiosAction }
  */
  router.post('/paios/action', requireRemoteAuth, (req, res) => {
    const body = isRecord(req.body) ? req.body : {};
    const sessionId = readString(body.sessionId);
    const action = readPaiosAction(body.action);
    if (!sessionId || !action) {
      res.status(400).json({ error: 'sessionId and action (with actionId, type) are required' });
      return;
    }
    const session = getSession(sessionId);
    if (!session || !session.active) {
      res.status(404).json({ error: 'Session not found or inactive' });
      return;
    }
    const result = enqueuePaiosAction(sessionId, action);
    res.status(202).json(result);
  });

  /**
   * POST /paios/process
   * Body: { sessionId: string }
  */
  router.post('/paios/process', requireRemoteAuth, async (req, res) => {
    const body = isRecord(req.body) ? req.body : {};
    const sessionId = readString(body.sessionId);
    if (!sessionId) {
      res.status(400).json({ error: 'sessionId is required' });
      return;
    }
    try {
      const result = await processNextPaiosAction(sessionId);
      if (!result) {
        res.json({ message: 'Queue is empty' });
        return;
      }
      res.json(result);
    } catch (error: unknown) {
      res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
    }
  });

  /**
   * GET /paios/queue
   */
  router.get('/paios/queue', requireRemoteAuth, (_req, res) => {
    const status = getPaiosQueueStatus();
    res.json(status);
  });

  // ── Phase 3: Events ────────────────────────────────────────────────────────

  /**
   * GET /events/stream
   * SSE endpoint – publishes all bridge events.
   */
  router.get('/events/stream', requireRemoteAuth, (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    const handler = (event: RemoteBridgeEvent) => {
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    };
    remoteEventBridge.subscribeGlobal(handler);

    req.on('close', () => {
      remoteEventBridge.unsubscribeGlobal(handler);
    });
  });

  return router;
}

// ── Private helpers ──────────────────────────────────────────────────────────

/**
 * Dispatch a queued command to the capability system.
 * Updates DB with result or error.
 */
async function _dispatchCommand(cmd: RemoteCommand): Promise<void> {
  updateCommandStatus(cmd.id, 'running');
  try {
    const cap = mcpRouter.getCapability(cmd.targetId);
    if (!cap) throw new Error(`No capability registered for target '${cmd.targetId}'`);

    const result = await executeRemoteCommand(cmd);
    updateCommandStatus(cmd.id, 'completed', normalizeRemoteResult(result));
    logInfo('RemoteRouter', `Command completed id=${cmd.id}`);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    updateCommandStatus(cmd.id, 'failed', undefined, msg);
    logError('RemoteRouter', `Command failed id=${cmd.id}: ${msg}`);
  }
}

async function executeRemoteCommand(cmd: RemoteCommand): Promise<unknown> {
  if (cmd.targetId.startsWith('mcp:')) {
    const clientName = cmd.targetId.slice(4);
    return mcpClientManager.callTool(clientName, cmd.toolName, cmd.input);
  }

  return mcpRouter.execute(cmd.targetId, cmd.toolName, cmd.input);
}

function normalizeRemoteResult(result: unknown): Record<string, unknown> {
  if (typeof result === 'object' && result !== null && !Array.isArray(result)) {
    return result as Record<string, unknown>;
  }

  return { value: result };
}
