/**
 * Phase 1: Remote Foundation — E2E Tests
 *
 * Tests for:
 *  - RemoteSessionManager (session lifecycle, commands, events, cleanup)
 *  - Remote types integrity
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RemoteSessionManager } from '../src/core/RemoteSessionManager.js';

// ─── RemoteSessionManager ────────────────────────────────────────────────────

describe('RemoteSessionManager', () => {
  let manager: RemoteSessionManager;

  beforeEach(() => {
    manager = new RemoteSessionManager();
  });

  // ── Session Lifecycle ──────────────────────────────────────────────

  it('should create a new session with valid fields', () => {
    const session = manager.createSession('user-1', 'target-1', { foo: 'bar' });

    expect(session.id).toBeDefined();
    expect(session.userId).toBe('user-1');
    expect(session.targetId).toBe('target-1');
    expect(session.active).toBe(true);
    expect(session.commands).toEqual([]);
    expect(session.metadata).toEqual({ foo: 'bar' });
    expect(session.expiresAt).toBeGreaterThan(session.createdAt);
  });

  it('should retrieve an existing session by id', () => {
    const session = manager.createSession('u1', 't1');
    const found = manager.getSession(session.id);

    expect(found).toBeDefined();
    expect(found!.id).toBe(session.id);
  });

  it('should return undefined for non-existent session', () => {
    expect(manager.getSession('nonexistent-id')).toBeUndefined();
  });

  it('should return undefined for expired sessions', () => {
    const session = manager.createSession('u1', 't1');
    // Force expiry
    session.expiresAt = Date.now() - 1;

    expect(manager.getSession(session.id)).toBeUndefined();
  });

  it('should close a session', () => {
    const session = manager.createSession('u1', 't1');
    manager.closeSession(session.id);

    const found = manager.getSession(session.id);
    expect(found).toBeDefined();
    expect(found!.active).toBe(false);
  });

  it('should cleanup expired sessions', () => {
    const s1 = manager.createSession('u1', 't1');
    const s2 = manager.createSession('u2', 't2');

    // Expire s1
    s1.expiresAt = Date.now() - 1;

    manager.cleanupExpiredSessions();

    expect(manager.getSession(s1.id)).toBeUndefined();
    expect(manager.getSession(s2.id)).toBeDefined();
  });

  // ── Commands ───────────────────────────────────────────────────────

  it('should add a command to a session', () => {
    const session = manager.createSession('u1', 't1');
    const cmd = manager.addCommand(session.id, 't1', 'file_read', { path: '/test.txt' });

    expect(cmd).not.toBeNull();
    expect(cmd!.toolName).toBe('file_read');
    expect(cmd!.status).toBe('pending');
    expect(cmd!.sessionId).toBe(session.id);
    expect(cmd!.input).toEqual({ path: '/test.txt' });
  });

  it('should return null when adding command to non-existent session', () => {
    const cmd = manager.addCommand('no-session', 't1', 'tool', {});
    expect(cmd).toBeNull();
  });

  it('should update command status to running', () => {
    const session = manager.createSession('u1', 't1');
    const cmd = manager.addCommand(session.id, 't1', 'agent_run', { agentId: 'test' });

    const updated = manager.updateCommandStatus(session.id, cmd!.id, 'running');
    expect(updated).not.toBeNull();
    expect(updated!.status).toBe('running');
  });

  it('should update command status to completed with result', () => {
    const session = manager.createSession('u1', 't1');
    const cmd = manager.addCommand(session.id, 't1', 'agent_run', { agentId: 'a1' });

    const updated = manager.updateCommandStatus(
      session.id,
      cmd!.id,
      'completed',
      { output: 'done' }
    );
    expect(updated!.status).toBe('completed');
    expect(updated!.result).toEqual({ output: 'done' });
  });

  it('should update command status to failed with error', () => {
    const session = manager.createSession('u1', 't1');
    const cmd = manager.addCommand(session.id, 't1', 'bad_tool', {});

    const updated = manager.updateCommandStatus(
      session.id,
      cmd!.id,
      'failed',
      undefined,
      'Tool not found'
    );
    expect(updated!.status).toBe('failed');
    expect(updated!.error).toBe('Tool not found');
  });

  it('should return null updating command on nonexistent session', () => {
    const result = manager.updateCommandStatus('no-session', 'no-cmd', 'running');
    expect(result).toBeNull();
  });

  it('should list pending commands', () => {
    const session = manager.createSession('u1', 't1');
    manager.addCommand(session.id, 't1', 'tool1', {});
    manager.addCommand(session.id, 't1', 'tool2', {});
    const cmd3 = manager.addCommand(session.id, 't1', 'tool3', {});
    manager.updateCommandStatus(session.id, cmd3!.id, 'completed');

    const pending = manager.getPendingCommands(session.id);
    expect(pending.length).toBe(2);
    expect(pending.every(c => c.status === 'pending')).toBe(true);
  });

  it('should return empty array for pending commands on missing session', () => {
    expect(manager.getPendingCommands('nonexistent')).toEqual([]);
  });

  // ── Event Stream ───────────────────────────────────────────────────

  it('should emit command:status events when command status changes', () => {
    const session = manager.createSession('u1', 't1');
    const cmd = manager.addCommand(session.id, 't1', 'test_tool', {});

    manager.updateCommandStatus(session.id, cmd!.id, 'running');

    const events = manager.getEventsSince(session.id, 0);
    expect(events.length).toBeGreaterThan(0);

    const statusEvent = events.find(e => e.type === 'command:status');
    expect(statusEvent).toBeDefined();
    expect(statusEvent!.payload.commandId).toBe(cmd!.id);
    expect(statusEvent!.payload.status).toBe('running');
  });

  it('should emit stream:closed event when session is closed', () => {
    const session = manager.createSession('u1', 't1');
    manager.closeSession(session.id);

    const events = manager.getEventsSince(session.id, 0);
    const closedEvent = events.find(e => e.type === 'stream:closed');
    expect(closedEvent).toBeDefined();
    expect(closedEvent!.payload.reason).toBe('session_closed');
  });

  it('should filter events since a given timestamp', () => {
    const session = manager.createSession('u1', 't1');
    const cmd = manager.addCommand(session.id, 't1', 'tool', {});

    const T1 = Date.now();
    manager.updateCommandStatus(session.id, cmd!.id, 'running');

    // Everything since T1 - 1 should include the running event
    const events = manager.getEventsSince(session.id, T1 - 1);
    expect(events.length).toBeGreaterThanOrEqual(1);
  });

  it('should return empty events for missing session', () => {
    expect(manager.getEventsSince('no-sess', 0)).toEqual([]);
  });
});

// ─── Remote Types Integrity ──────────────────────────────────────────────────

describe('Remote Types Integrity', () => {
  it('RemoteSession should have required fields', () => {
    const manager = new RemoteSessionManager();
    const session = manager.createSession('u1', 't1');

    expect(session).toHaveProperty('id');
    expect(session).toHaveProperty('userId');
    expect(session).toHaveProperty('targetId');
    expect(session).toHaveProperty('createdAt');
    expect(session).toHaveProperty('expiresAt');
    expect(session).toHaveProperty('commands');
    expect(session).toHaveProperty('active');
  });

  it('RemoteCommand should have proper structure once added', () => {
    const manager = new RemoteSessionManager();
    const session = manager.createSession('user1', 'target1');
    const cmd = manager.addCommand(session.id, 'target1', 'toolX', { key: 'val' });

    expect(cmd).toHaveProperty('id');
    expect(cmd).toHaveProperty('sessionId');
    expect(cmd).toHaveProperty('targetId');
    expect(cmd).toHaveProperty('toolName');
    expect(cmd).toHaveProperty('input');
    expect(cmd).toHaveProperty('status');
    expect(cmd).toHaveProperty('createdAt');
    expect(cmd).toHaveProperty('updatedAt');
  });
});

// ─── E2E: Full Session Flow ──────────────────────────────────────────────────

describe('E2E: Remote Session Full Flow', () => {
  it('should complete a full session lifecycle: create → command → update → events → close', () => {
    const manager = new RemoteSessionManager();

    // 1. Create session
    const session = manager.createSession('e2e-user', 'orchestrator', { source: 'test' });
    expect(session.active).toBe(true);

    // 2. Add multiple commands
    const cmd1 = manager.addCommand(session.id, 'orchestrator', 'agent_run', { agentId: 'ResearchAgent' });
    const cmd2 = manager.addCommand(session.id, 'orchestrator', 'file_read', { path: 'report.md' });
    expect(cmd1).not.toBeNull();
    expect(cmd2).not.toBeNull();

    // 3. Run and complete cmd1
    manager.updateCommandStatus(session.id, cmd1!.id, 'running');
    manager.updateCommandStatus(session.id, cmd1!.id, 'completed', { output: 'Research done' });

    // 4. Fail cmd2
    manager.updateCommandStatus(session.id, cmd2!.id, 'failed', undefined, 'File not found');

    // 5. Verify pending commands
    expect(manager.getPendingCommands(session.id)).toEqual([]);

    // 6. Verify event trail
    const events = manager.getEventsSince(session.id, 0);
    const types = events.map(e => e.type);
    expect(types.filter(t => t === 'command:status').length).toBeGreaterThanOrEqual(3);

    // 7. Close session
    manager.closeSession(session.id);
    const closedSession = manager.getSession(session.id);
    expect(closedSession!.active).toBe(false);

    // 8. Verify stream:closed event
    const allEvents = manager.getEventsSince(session.id, 0);
    expect(allEvents.some(e => e.type === 'stream:closed')).toBe(true);
  });

  it('should handle multiple concurrent sessions independently', () => {
    const manager = new RemoteSessionManager();

    const s1 = manager.createSession('alice', 'agent-a');
    const s2 = manager.createSession('bob', 'agent-b');

    manager.addCommand(s1.id, 'agent-a', 'tool1', {});
    manager.addCommand(s2.id, 'agent-b', 'tool2', {});

    expect(manager.getSession(s1.id)!.commands.length).toBe(1);
    expect(manager.getSession(s2.id)!.commands.length).toBe(1);

    // Close s1, s2 should still be active
    manager.closeSession(s1.id);
    expect(manager.getSession(s1.id)!.active).toBe(false);
    expect(manager.getSession(s2.id)!.active).toBe(true);
  });
});
