/**
 * Tests: EnhancedPermissionManager (RBAC Hardening)
 * @track sandbox_security_hardening_20260323
 * @phase Phase 3
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { EnhancedPermissionManager, resetEnhancedPermissionManager } from '@packages/core-logic/rbac/agentPermissions.js';

describe('EnhancedPermissionManager', () => {
  let pm: EnhancedPermissionManager;

  beforeEach(() => {
    resetEnhancedPermissionManager();
    pm = new EnhancedPermissionManager();
  });

  // --- Permission checks ---

  it('should grant ADMIN agents full access', () => {
    const result = pm.checkPermission('Orchestrator', 'write_file', '/any/path');
    expect(result.allowed).toBe(true);
    expect(result.profile).toBe('ADMIN');
  });

  it('should grant DEVELOPER file write access', () => {
    const result = pm.checkPermission('DeveloperAgent', 'write_file', 'src/index.ts');
    expect(result.allowed).toBe(true);
    expect(result.profile).toBe('DEVELOPER');
  });

  it('should deny RESEARCHER write access', () => {
    const result = pm.checkPermission('ResearcherAgent', 'write_file', 'src/index.ts');
    expect(result.allowed).toBe(false);
  });

  it('should grant RESEARCHER read access', () => {
    const result = pm.checkPermission('ResearcherAgent', 'read_file', 'src/index.ts');
    expect(result.allowed).toBe(true);
  });

  it('should default unknown agents to READONLY', () => {
    const result = pm.checkPermission('UnknownAgent42', 'write_file', 'something');
    expect(result.allowed).toBe(false);
    expect(result.profile).toBe('READONLY');
  });

  it('should allow READONLY agents to read', () => {
    const result = pm.checkPermission('UnknownAgent42', 'read_file');
    expect(result.allowed).toBe(true);
  });

  // --- Tool access ---

  it('should allow ADMIN all tools', () => {
    const result = pm.checkToolAccess('Orchestrator', 'any_tool');
    expect(result.allowed).toBe(true);
  });

  it('should allow DEVELOPER specific tools', () => {
    expect(pm.checkToolAccess('DeveloperAgent', 'read_file').allowed).toBe(true);
    expect(pm.checkToolAccess('DeveloperAgent', 'write_file').allowed).toBe(true);
    expect(pm.checkToolAccess('DeveloperAgent', 'run_command').allowed).toBe(true);
  });

  it('should deny DEVELOPER unauthorized tools', () => {
    const result = pm.checkToolAccess('DeveloperAgent', 'browser_navigate');
    expect(result.allowed).toBe(false);
  });

  it('should deny READONLY most tools', () => {
    const result = pm.checkToolAccess('SomeRandomAgent', 'write_file');
    expect(result.allowed).toBe(false);
  });

  // --- Network access ---

  it('should allow RESEARCHER all network domains', () => {
    const result = pm.checkNetworkAccess('ResearcherAgent', 'any-domain.com');
    expect(result.allowed).toBe(true);
  });

  it('should allow DEVELOPER specific domains', () => {
    expect(pm.checkNetworkAccess('DeveloperAgent', 'api.github.com').allowed).toBe(true);
    expect(pm.checkNetworkAccess('DeveloperAgent', 'registry.npmjs.org').allowed).toBe(true);
  });

  it('should deny DEVELOPER unauthorized domains', () => {
    const result = pm.checkNetworkAccess('DeveloperAgent', 'random-site.com');
    expect(result.allowed).toBe(false);
  });

  it('should deny READONLY all network', () => {
    const result = pm.checkNetworkAccess('SomeAgent', 'google.com');
    expect(result.allowed).toBe(false);
  });

  // --- Cost tracking ---

  it('should track costs and enforce limits', () => {
    // READONLY limit = $0.1/day
    expect(pm.trackCost('SomeAgent', 0.05)).toBe(true);
    expect(pm.trackCost('SomeAgent', 0.04)).toBe(true);
    expect(pm.trackCost('SomeAgent', 0.05)).toBe(false); // Over $0.1
  });

  it('should allow high costs for ADMIN', () => {
    expect(pm.trackCost('Orchestrator', 10.0)).toBe(true);
    expect(pm.trackCost('Orchestrator', 20.0)).toBe(true);
    expect(pm.trackCost('Orchestrator', 20.0)).toBe(true);
    expect(pm.trackCost('Orchestrator', 1.0)).toBe(false); // Over $50
  });

  it('should reset daily costs', () => {
    pm.trackCost('SomeAgent', 0.09);
    pm.resetDailyCosts();
    expect(pm.trackCost('SomeAgent', 0.09)).toBe(true);
  });

  // --- Violation tracking ---

  it('should record violations', () => {
    pm.checkPermission('TestAgent', 'delete_file', 'important.ts');
    const violations = pm.getViolations();
    expect(violations.length).toBe(1);
    expect(violations[0].agent).toBe('TestAgent');
    expect(violations[0].action).toBe('delete_file');
  });

  it('should provide violation statistics', () => {
    pm.checkPermission('AgentA', 'delete_file');
    pm.checkPermission('AgentA', 'write_file');
    pm.checkNetworkAccess('DeveloperAgent', 'bad-domain.com');

    const stats = pm.getViolationStats();
    expect(stats.total).toBe(3);
    expect(stats.byAgent['AgentA']).toBe(2);
  });

  // --- Profile listing ---

  it('should list all profiles', () => {
    const profiles = pm.listProfiles();
    expect(profiles.length).toBeGreaterThanOrEqual(6);
    expect(profiles.find(p => p.name === 'ADMIN')).toBeDefined();
    expect(profiles.find(p => p.name === 'READONLY')).toBeDefined();
  });

  // --- Pattern matching for agent names ---

  it('should match agent names by pattern', () => {
    expect(pm.checkPermission('MyOrchestratorV2', 'write_file').profile).toBe('ADMIN');
    expect(pm.checkPermission('SmartResearchBot', 'read_file').profile).toBe('RESEARCHER');
    expect(pm.checkPermission('AutoTestRunner', 'run_tests').profile).toBe('EVALUATOR');
  });
});
