/**
 * Remote Layer API Routes
 * Phase 2: Discovery, Capability & Auth
 *
 * Endpoints:
 *   GET  /api/v1/remote/targets          — List available MCP/agent targets
 *   POST /api/v1/remote/sessions         — Create a new remote session
 *   GET  /api/v1/remote/sessions/:id     — Get session details
 *   DELETE /api/v1/remote/sessions/:id   — Close / deactivate a session
 *   GET  /api/v1/remote/sessions         — List active sessions (for user)
 *   POST /api/v1/remote/commands         — Send a command in a session
 *   GET  /api/v1/remote/commands/:id     — Get command status
 *   POST /api/v1/remote/auth/token       — Issue a remote access token
 *   GET  /api/v1/remote/discover         — MCP server discovery info
 */

import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { logInfo, logError } from '../../utils/logger.js';
import { generateRemoteToken } from '../../security/remoteAuth.js';
import { authRemote as requireRemoteAuth } from '../middleware/authRemote.js';
import {
  saveSession,
  getSession,
  listActiveSessions,
  deactivateSession,
  saveCommand,
  getCommand,
  updateCommandStatus,
} from '../../core/remoteSessionStore.js';
import { discoverMcpServers, getDiscoveredTargets } from '../../core/mcpDiscovery.js';
import { mcpRouter } from '../../core/MCPRouter.js';
import { remoteReadFile, remoteWriteFile, remoteListFiles } from '../../core/remoteFileAccess.js';
import { mapVoiceToCommand, listVoiceIntents } from '../../core/voicePipeline.js';
import { buildMobileSessionSummary, processMobileHeartbeat } from '../../core/mobileClientBootstrap.js';
import { enqueuePaiosAction, processNextPaiosAction, getPaiosQueueStatus } from '../../core/paiosRemoteIntegration.js';
import { remoteEventBridge } from '../../core/remoteEventBridge.js';
import type {
  RemoteSession,
  RemoteCommand,
  CreateSessionRequest,
  SendCommandRequest,
  RemoteFileReadRequest,
  RemoteFileWriteRequest,
  VoiceInputRequest,
  RemoteBridgeEvent,
} from '../../core/types/remote.js';
import type { PaiosAction } from '../../core/paiosRemoteIntegration.js';

export function createRemoteRouter(): Router {
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
    const { userId, ttlMs } = req.body as { userId?: string; ttlMs?: number };
    if (!userId || typeof userId !== 'string') {
      res.status(400).json({ error: 'userId is required' });
      return;
    }
    const ttl = typeof ttlMs === 'number' && ttlMs > 0 ? ttlMs : 3_600_000;
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
    const body = req.body as CreateSessionRequest;
    if (!body.targetId || !body.userId) {
      res.status(400).json({ error: 'targetId and userId are required' });
      return;
    }
    const cap = mcpRouter.getCapability(body.targetId);
    if (!cap) {
      res.status(404).json({ error: `Target '${body.targetId}' not found` });
      return;
    }
    const session: RemoteSession = {
      id: uuidv4(),
      userId: body.userId,
      targetId: body.targetId,
      createdAt: Date.now(),
      expiresAt: Date.now() + 3_600_000,
      active: true,
      commands: [],
      metadata: body.metadata,
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
    const userId = typeof req.query.userId === 'string' ? req.query.userId : undefined;
    const sessions = listActiveSessions(userId);
    res.json({ sessions, count: sessions.length });
  });

  /**
   * GET /sessions/:id
   */
  router.get('/sessions/:id', requireRemoteAuth, (req, res) => {
    const session = getSession(req.params.id as string);
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
    const session = getSession(req.params.id as string);
    if (!session) {
      res.status(404).json({ error: 'Session not found' });
      return;
    }
    deactivateSession(req.params.id as string);
    logInfo('RemoteRouter', `Session closed id=${req.params.id}`);
    res.json({ ok: true });
  });

  // ── Commands ───────────────────────────────────────────────────────────────

  /**
   * POST /commands
   * Body: SendCommandRequest
   */
  router.post('/commands', requireRemoteAuth, (req, res) => {
    const body = req.body as SendCommandRequest;
    if (!body.sessionId || !body.targetId || !body.toolName) {
      res.status(400).json({ error: 'sessionId, targetId, toolName are required' });
      return;
    }
    const session = getSession(body.sessionId);
    if (!session || !session.active) {
      res.status(404).json({ error: 'Session not found or inactive' });
      return;
    }
    const command: RemoteCommand = {
      id: uuidv4(),
      sessionId: body.sessionId,
      targetId: body.targetId,
      toolName: body.toolName,
      input: body.input ?? {},
      status: 'pending',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    try {
      saveCommand(command);
      logInfo('RemoteRouter', `Command queued id=${command.id} tool=${command.toolName}`);
      // Async execution dispatched — update status asynchronously
      _dispatchCommand(command).catch(err =>
        logError('RemoteRouter', `Command dispatch failed id=${command.id}: ${err.message}`)
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
    const command = getCommand(req.params.id as string);
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
    const body = req.body as RemoteFileReadRequest;
    if (!body.sessionId || !body.path) {
      res.status(400).json({ error: 'sessionId and path are required' });
      return;
    }
    const session = getSession(body.sessionId);
    if (!session || !session.active) {
      res.status(404).json({ error: 'Session not found or inactive' });
      return;
    }
    try {
      const result = remoteReadFile(body);
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
    const body = req.body as RemoteFileWriteRequest;
    if (!body.sessionId || !body.path || body.content === undefined) {
      res.status(400).json({ error: 'sessionId, path, and content are required' });
      return;
    }
    const session = getSession(body.sessionId);
    if (!session || !session.active) {
      res.status(404).json({ error: 'Session not found or inactive' });
      return;
    }
    try {
      const result = remoteWriteFile(body);
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
    const sessionId = req.query.sessionId as string;
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
    const body = req.body as VoiceInputRequest;
    if (!body.sessionId || !body.transcript) {
      res.status(400).json({ error: 'sessionId and transcript are required' });
      return;
    }
    const session = getSession(body.sessionId);
    if (!session || !session.active) {
      res.status(404).json({ error: 'Session not found or inactive' });
      return;
    }
    const voiceResult = mapVoiceToCommand(body);
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
    const session = getSession(req.params.sessionId as string);
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
    const { sessionId } = req.body as { sessionId?: string };
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
    const { sessionId, action } = req.body as { sessionId?: string; action?: PaiosAction };
    if (!sessionId || !action || !action.actionId || !action.type) {
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
  router.post('/paios/process', requireRemoteAuth, (req, res) => {
    const { sessionId } = req.body as { sessionId?: string };
    if (!sessionId) {
      res.status(400).json({ error: 'sessionId is required' });
      return;
    }
    const result = processNextPaiosAction(sessionId);
    if (!result) {
      res.json({ message: 'Queue is empty' });
      return;
    }
    res.json(result);
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

    const result = await mcpRouter.execute(cmd.targetId, cmd.toolName, cmd.input) as Record<string, unknown>;
    updateCommandStatus(cmd.id, 'completed', result);
    logInfo('RemoteRouter', `Command completed id=${cmd.id}`);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    updateCommandStatus(cmd.id, 'failed', undefined, msg);
    logError('RemoteRouter', `Command failed id=${cmd.id}: ${msg}`);
  }
}
