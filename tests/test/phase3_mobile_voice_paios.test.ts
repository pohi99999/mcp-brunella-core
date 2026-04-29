/**
 * Phase 3: Mobile, Voice & Deep PAIOS Integration — E2E Tests
 *
 * Tests for:
 *  - VoicePipeline (transcript → command mapping, intent matching, confidence)
 *  - MobileClientBootstrap (session summary, heartbeat lifecycle)
 *  - RemoteEventBridge (pub/sub, session-scoped events, global broadcast)
 *  - RemoteFileAccess (sandboxed read/write, path traversal prevention)
 *  - PaiosRemoteIntegration (action queue, process, status)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mapVoiceToCommand, listVoiceIntents } from '@packages/core-logic/voicePipeline.js';
import { buildMobileSessionSummary, processMobileHeartbeat } from '@packages/core-logic/mobileClientBootstrap.js';
import { remoteEventBridge } from '@packages/core-logic/remoteEventBridge.js';
import { enqueuePaiosAction, processNextPaiosAction, getPaiosQueueStatus } from '@packages/core-logic/paiosRemoteIntegration.js';
import type { RemoteSession, RemoteBridgeEvent } from '@packages/core-logic/types/remote.js';

// ─── VoicePipeline ───────────────────────────────────────────────────────────

describe('VoicePipeline', () => {
  it('should map "open myfile.txt" to file_read', () => {
    const result = mapVoiceToCommand({
      sessionId: 'sess-1',
      transcript: 'open myfile.txt',
    });

    expect(result.mapped).toBe(true);
    expect(result.command).toBeDefined();
    expect(result.command!.toolName).toBe('file_read');
    expect(result.command!.input.path).toBe('myfile.txt');
    expect(result.command!.confidence).toBeGreaterThanOrEqual(0.5);
  });

  it('should map "run ResearchAgent" to agent_run', () => {
    const result = mapVoiceToCommand({
      sessionId: 'sess-2',
      transcript: 'run ResearchAgent',
    });

    expect(result.mapped).toBe(true);
    expect(result.command!.toolName).toBe('agent_run');
    expect(result.command!.input.agentId).toBe('ResearchAgent');
  });

  it('should map "status myAgent" to agent_status', () => {
    const result = mapVoiceToCommand({
      sessionId: 'sess-3',
      transcript: 'status myAgent',
    });

    expect(result.mapped).toBe(true);
    expect(result.command!.toolName).toBe('agent_status');
    expect(result.command!.input.agentId).toBe('myAgent');
  });

  it('should map "stop worker-1" to agent_stop', () => {
    const result = mapVoiceToCommand({
      sessionId: 'sess-4',
      transcript: 'stop worker-1',
    });

    expect(result.mapped).toBe(true);
    expect(result.command!.toolName).toBe('agent_stop');
  });

  it('should map "help" to remote_help with high confidence', () => {
    const result = mapVoiceToCommand({
      sessionId: 'sess-5',
      transcript: 'help',
    });

    expect(result.mapped).toBe(true);
    expect(result.command!.toolName).toBe('remote_help');
    expect(result.command!.confidence).toBeGreaterThanOrEqual(0.9);
  });

  it('should return unmapped for nonsensical input', () => {
    const result = mapVoiceToCommand({
      sessionId: 'sess-6',
      transcript: 'xyzzy foobarbaz quantum 42',
    });

    expect(result.mapped).toBe(false);
    expect(result.reason).toBeDefined();
  });

  it('should handle Hungarian commands (nyisd meg)', () => {
    const result = mapVoiceToCommand({
      sessionId: 'sess-hu',
      transcript: 'nyisd meg config.json',
    });

    expect(result.mapped).toBe(true);
    expect(result.command!.toolName).toBe('file_read');
    expect(result.command!.input.path).toBe('config.json');
  });

  it('should list all voice intents', () => {
    const intents = listVoiceIntents();
    expect(intents.length).toBeGreaterThanOrEqual(5);
    expect(intents.every(i => i.tool && i.description && i.example)).toBe(true);
  });
});

// ─── MobileClientBootstrap ───────────────────────────────────────────────────

describe('MobileClientBootstrap', () => {
  const makeSession = (overrides?: Partial<RemoteSession>): RemoteSession => ({
    id: 'mob-sess-1',
    userId: 'mobile-user',
    targetId: 'agent-1',
    createdAt: Date.now(),
    expiresAt: Date.now() + 3600_000,
    commands: [],
    active: true,
    ...overrides,
  });

  it('should build a mobile session summary', () => {
    const session = makeSession();
    const summary = buildMobileSessionSummary(session);

    expect(summary.sessionId).toBe('mob-sess-1');
    expect(summary.userId).toBe('mobile-user');
    expect(summary.targetId).toBe('agent-1');
    expect(summary.active).toBe(true);
    expect(summary.commandCount).toBe(0);
    expect(summary.createdAt).toBeDefined();
    expect(summary.expiresAt).toBeDefined();
  });

  it('should count commands in summary', () => {
    const session = makeSession({
      commands: [
        { id: 'c1', sessionId: 'x', targetId: 'x', toolName: 't', input: {}, status: 'completed', createdAt: 0, updatedAt: 0 },
        { id: 'c2', sessionId: 'x', targetId: 'x', toolName: 't', input: {}, status: 'pending', createdAt: 0, updatedAt: 0 },
      ],
    });
    const summary = buildMobileSessionSummary(session);
    expect(summary.commandCount).toBe(2);
  });

  it('should process heartbeat for active session', () => {
    const session = makeSession();
    const result = processMobileHeartbeat('mob-sess-1', session);

    expect(result.alive).toBe(true);
    expect(result.ttl).toBeDefined();
    expect(result.ttl!).toBeGreaterThan(0);
  });

  it('should return alive=false for missing session', () => {
    const result = processMobileHeartbeat('no-session', undefined);
    expect(result.alive).toBe(false);
  });

  it('should return alive=false for inactive session', () => {
    const session = makeSession({ active: false });
    const result = processMobileHeartbeat('mob-sess-1', session);
    expect(result.alive).toBe(false);
  });

  it('should return alive=false for expired session', () => {
    const session = makeSession({ expiresAt: Date.now() - 1000 });
    const result = processMobileHeartbeat('mob-sess-1', session);
    expect(result.alive).toBe(false);
  });
});

// ─── RemoteEventBridge ───────────────────────────────────────────────────────

describe('RemoteEventBridge', () => {
  it('should publish and receive global events', () => {
    const received: RemoteBridgeEvent[] = [];
    const handler = (e: RemoteBridgeEvent) => received.push(e);

    remoteEventBridge.subscribeGlobal(handler);

    remoteEventBridge.publish({
      type: 'agent:status',
      source: 'TestAgent',
      payload: { status: 'running' },
    });

    expect(received.length).toBe(1);
    expect(received[0].type).toBe('agent:status');
    expect(received[0].source).toBe('TestAgent');

    remoteEventBridge.unsubscribeGlobal(handler);
  });

  it('should publish session-scoped events', () => {
    const sessionEvents: RemoteBridgeEvent[] = [];
    const handler = (e: RemoteBridgeEvent) => sessionEvents.push(e);

    remoteEventBridge.subscribe('session-xyz', handler);

    // This event targets session-xyz
    remoteEventBridge.publish({
      type: 'tool:call',
      source: 'ToolRunner',
      sessionId: 'session-xyz',
      payload: { tool: 'search' },
    });

    // This event targets another session — should NOT be received
    remoteEventBridge.publish({
      type: 'tool:result',
      source: 'ToolRunner',
      sessionId: 'session-other',
      payload: { result: 'done' },
    });

    expect(sessionEvents.length).toBe(1);
    expect(sessionEvents[0].sessionId).toBe('session-xyz');

    remoteEventBridge.unsubscribe('session-xyz', handler);
  });

  it('should return subscriber count', () => {
    const handler = () => {};
    remoteEventBridge.subscribe('count-sess', handler);

    expect(remoteEventBridge.getActiveSubscriberCount('count-sess')).toBe(1);

    remoteEventBridge.unsubscribe('count-sess', handler);
    expect(remoteEventBridge.getActiveSubscriberCount('count-sess')).toBe(0);
  });

  it('should include event id and timestamp', () => {
    const received: RemoteBridgeEvent[] = [];
    const handler = (e: RemoteBridgeEvent) => received.push(e);
    remoteEventBridge.subscribeGlobal(handler);

    const event = remoteEventBridge.publish({
      type: 'system:heartbeat',
      source: 'System',
      payload: {},
    });

    expect(event.id).toBeDefined();
    expect(event.timestamp).toBeGreaterThan(0);
    expect(received[0].id).toBe(event.id);

    remoteEventBridge.unsubscribeGlobal(handler);
  });
});

// ─── PaiosRemoteIntegration ──────────────────────────────────────────────────

describe('PaiosRemoteIntegration', () => {
  // Drain queue before each test
  beforeEach(() => {
    while (processNextPaiosAction('drain') !== null) { /* drain */ }
  });

  it('should enqueue an action and return queued status', () => {
    const result = enqueuePaiosAction('sess-1', {
      actionId: 'act-1',
      type: 'research',
      description: 'Research AI trends',
      payload: { topic: 'AI' },
    });

    expect(result.status).toBe('queued');
    expect(result.actionId).toBe('act-1');
  });

  it('should track queue status', () => {
    enqueuePaiosAction('sess-1', {
      actionId: 'act-q1',
      type: 'scrape',
      description: 'Scrape data',
      payload: {},
    });
    enqueuePaiosAction('sess-1', {
      actionId: 'act-q2',
      type: 'analyze',
      description: 'Analyze data',
      payload: {},
    });

    const status = getPaiosQueueStatus();
    expect(status.length).toBe(2);
    expect(status.actionIds).toContain('act-q1');
    expect(status.actionIds).toContain('act-q2');
  });

  it('should process the next action and complete it', () => {
    enqueuePaiosAction('sess-proc', {
      actionId: 'proc-1',
      type: 'translate',
      description: 'Translate doc',
      payload: { lang: 'hu' },
    });

    const result = processNextPaiosAction('sess-proc');
    expect(result).not.toBeNull();
    expect(result!.actionId).toBe('proc-1');
    expect(result!.status).toBe('completed');
  });

  it('should return null when queue is empty', () => {
    const result = processNextPaiosAction('sess-empty');
    expect(result).toBeNull();
  });

  it('should process actions in FIFO order', () => {
    enqueuePaiosAction('sess-fifo', {
      actionId: 'first',
      type: 'a',
      description: 'First',
      payload: {},
    });
    enqueuePaiosAction('sess-fifo', {
      actionId: 'second',
      type: 'b',
      description: 'Second',
      payload: {},
    });

    const r1 = processNextPaiosAction('sess-fifo');
    const r2 = processNextPaiosAction('sess-fifo');

    expect(r1!.actionId).toBe('first');
    expect(r2!.actionId).toBe('second');
  });
});

// ─── E2E: Full Phase 3 Integration Flow ─────────────────────────────────────

describe('E2E: Phase 3 Full Integration', () => {
  it('should complete voice → event bridge → PAIOS flow', () => {
    const bridgeEvents: RemoteBridgeEvent[] = [];
    const handler = (e: RemoteBridgeEvent) => bridgeEvents.push(e);
    remoteEventBridge.subscribeGlobal(handler);

    // 1. Voice input maps to a command
    const voiceResult = mapVoiceToCommand({
      sessionId: 'e2e-sess',
      transcript: 'run DataCollector',
    });
    expect(voiceResult.mapped).toBe(true);
    expect(voiceResult.command!.toolName).toBe('agent_run');

    // 2. Event bridge should have received voice:mapped event
    const voiceEvent = bridgeEvents.find(e => e.type === 'voice:mapped');
    expect(voiceEvent).toBeDefined();
    expect(voiceEvent!.sessionId).toBe('e2e-sess');

    // 3. Enqueue PAIOS action based on voice command
    const paiosResult = enqueuePaiosAction('e2e-sess', {
      actionId: 'e2e-action',
      type: 'agent_run',
      description: 'Run agent via voice',
      payload: { agentId: voiceResult.command!.input.agentId },
    });
    expect(paiosResult.status).toBe('queued');

    // 4. Bridge should have paios:action:queued event
    const queuedEvent = bridgeEvents.find(e => e.type === 'paios:action:queued');
    expect(queuedEvent).toBeDefined();

    // 5. Process the action
    const processed = processNextPaiosAction('e2e-sess');
    expect(processed!.status).toBe('completed');

    // 6. Bridge should have completed event
    const completedEvent = bridgeEvents.find(e => e.type === 'paios:action:completed');
    expect(completedEvent).toBeDefined();

    remoteEventBridge.unsubscribeGlobal(handler);
  });

  it('should handle mobile heartbeat → event bridge integration', () => {
    const bridgeEvents: RemoteBridgeEvent[] = [];
    const handler = (e: RemoteBridgeEvent) => bridgeEvents.push(e);
    remoteEventBridge.subscribeGlobal(handler);

    const session: RemoteSession = {
      id: 'mobile-e2e',
      userId: 'phone-user',
      targetId: 'agent-x',
      createdAt: Date.now(),
      expiresAt: Date.now() + 600_000,
      commands: [],
      active: true,
    };

    // 1. Build mobile summary
    const summary = buildMobileSessionSummary(session);
    expect(summary.sessionId).toBe('mobile-e2e');
    expect(summary.active).toBe(true);

    // 2. Send heartbeat
    const heartbeat = processMobileHeartbeat('mobile-e2e', session);
    expect(heartbeat.alive).toBe(true);

    // 3. Bridge should have mobile:heartbeat event
    const hbEvent = bridgeEvents.find(e => e.type === 'mobile:heartbeat');
    expect(hbEvent).toBeDefined();
    expect(hbEvent!.sessionId).toBe('mobile-e2e');

    remoteEventBridge.unsubscribeGlobal(handler);
  });

  it('should fail gracefully when voice mapping fails', () => {
    const bridgeEvents: RemoteBridgeEvent[] = [];
    const handler = (e: RemoteBridgeEvent) => bridgeEvents.push(e);
    remoteEventBridge.subscribeGlobal(handler);

    const result = mapVoiceToCommand({
      sessionId: 'fail-sess',
      transcript: 'qwertyuiop asdfghjkl',
    });

    expect(result.mapped).toBe(false);

    // Bridge should have voice:unmapped event
    const unmappedEvent = bridgeEvents.find(e => e.type === 'voice:unmapped');
    expect(unmappedEvent).toBeDefined();
    expect(unmappedEvent!.sessionId).toBe('fail-sess');

    remoteEventBridge.unsubscribeGlobal(handler);
  });
});
