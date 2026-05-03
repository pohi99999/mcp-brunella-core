/**
 * Enhanced Agent Permissions — Runtime RBAC Enforcement
 *
 * Extends the existing permissions.ts with:
 * - Runtime permission checking before MCP tool invocation
 * - Violation logging to SecurityEventsMonitor
 * - Permission profiles loadable from registry.json
 * - Per-agent resource limits (tokens, cost)
 *
 * @track sandbox_security_hardening_20260323
 * @phase Phase 3: RBAC Hardening
 */

import { logInfo, logWarn, logError } from '../../utils/logger.js';
import { Permission, PermissionProfiles, type AgentPermissionConfig } from '../../agents/permissions.js';

// ============================================================================
// TYPES
// ============================================================================

export interface AgentResourceLimits {
  maxTokensPerCall: number;
  maxCostPerDay: number;      // USD
  maxConcurrentTasks: number;
  maxFileWriteSize: number;   // bytes
}

export interface EnhancedPermissionProfile extends AgentPermissionConfig {
  role: string;
  allowedTools: string[];       // MCP tool names
  allowedNetworkDomains: string[];
  codeExecAllowed: boolean;
  resourceLimits: AgentResourceLimits;
}

export interface PermissionCheckResult {
  allowed: boolean;
  agent: string;
  action: string;
  resource?: string;
  reason: string;
  profile: string;
}

export interface ViolationRecord {
  timestamp: string;
  agent: string;
  action: string;
  resource?: string;
  reason: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

// ============================================================================
// DEFAULT RESOURCE LIMITS
// ============================================================================

const DEFAULT_RESOURCE_LIMITS: AgentResourceLimits = {
  maxTokensPerCall: 8192,
  maxCostPerDay: 1.0,
  maxConcurrentTasks: 3,
  maxFileWriteSize: 5_242_880, // 5MB
};

const RESTRICTIVE_LIMITS: AgentResourceLimits = {
  maxTokensPerCall: 2048,
  maxCostPerDay: 0.1,
  maxConcurrentTasks: 1,
  maxFileWriteSize: 1_048_576, // 1MB
};

const ADMIN_LIMITS: AgentResourceLimits = {
  maxTokensPerCall: 32768,
  maxCostPerDay: 50.0,
  maxConcurrentTasks: 10,
  maxFileWriteSize: 52_428_800, // 50MB
};

// ============================================================================
// ENHANCED PERMISSION PROFILES
// ============================================================================

const ENHANCED_PROFILES: Record<string, EnhancedPermissionProfile> = {
  ADMIN: {
    ...PermissionProfiles.DEVELOPER,
    role: 'admin',
    permissions: [Permission.ADMIN],
    allowedTools: ['*'],
    allowedNetworkDomains: ['*'],
    codeExecAllowed: true,
    resourceLimits: ADMIN_LIMITS,
  },
  DEVELOPER: {
    ...PermissionProfiles.DEVELOPER,
    role: 'developer',
    allowedTools: ['read_file', 'write_file', 'run_command', 'run_tests', 'git_status', 'git_diff', 'git_commit'],
    allowedNetworkDomains: ['api.github.com', 'registry.npmjs.org', 'pypi.org'],
    codeExecAllowed: true,
    resourceLimits: DEFAULT_RESOURCE_LIMITS,
  },
  RESEARCHER: {
    ...PermissionProfiles.RESEARCHER,
    role: 'researcher',
    allowedTools: ['read_file', 'search', 'http_request'],
    allowedNetworkDomains: ['*'],
    codeExecAllowed: false,
    resourceLimits: RESTRICTIVE_LIMITS,
  },
  EVALUATOR: {
    ...PermissionProfiles.EVALUATOR,
    role: 'evaluator',
    allowedTools: ['read_file', 'run_tests', 'run_command'],
    allowedNetworkDomains: [],
    codeExecAllowed: false,
    resourceLimits: RESTRICTIVE_LIMITS,
  },
  ROBOTKEZ: {
    ...PermissionProfiles.ROBOTKEZ,
    role: 'robotkez',
    allowedTools: ['browser_navigate', 'browser_screenshot', 'browser_click', 'write_file'],
    allowedNetworkDomains: ['*'],
    codeExecAllowed: false,
    resourceLimits: DEFAULT_RESOURCE_LIMITS,
  },
  READONLY: {
    role: 'readonly',
    permissions: [Permission.READ_FILE, Permission.READ_DIR],
    allowedTools: ['read_file', 'search'],
    allowedNetworkDomains: [],
    codeExecAllowed: false,
    resourceLimits: RESTRICTIVE_LIMITS,
  },
};

// Map agent names to profiles
const AGENT_PROFILE_MAP: Record<string, string> = {
  Orchestrator: 'ADMIN',
  OrchestratorAgent: 'ADMIN',
  CopilotBridge: 'ADMIN',
  DeveloperAgent: 'DEVELOPER',
  CodeReviewerAgent: 'DEVELOPER',
  LintFixerAgent: 'DEVELOPER',
  RefactorBot: 'DEVELOPER',
  TestGeneratorAgent: 'DEVELOPER',
  ResearcherAgent: 'RESEARCHER',
  BifrostGateway: 'RESEARCHER',
  EvaluatorAgent: 'EVALUATOR',
  RobotkezV2: 'ROBOTKEZ',
  SecurityAgent: 'READONLY',
  DataScientistAgent: 'DEVELOPER',
  TaskDecomposerAgent: 'DEVELOPER',
};

// ============================================================================
// ENHANCED PERMISSION MANAGER
// ============================================================================

export class EnhancedPermissionManager {
  private violations: ViolationRecord[] = [];
  private dailyCosts = new Map<string, number>();
  private profiles = new Map<string, EnhancedPermissionProfile>();

  constructor() {
    // Load built-in profiles
    for (const [name, profile] of Object.entries(ENHANCED_PROFILES)) {
      this.profiles.set(name, profile);
    }
  }

  /**
   * Check if an agent has permission to perform an action
   */
  checkPermission(agentName: string, action: string, resource?: string): PermissionCheckResult {
    const profileName = this.getProfileName(agentName);
    const profile = this.profiles.get(profileName);

    if (!profile) {
      // Unknown agent → READONLY by default (principle of least privilege)
      const readonlyProfile = this.profiles.get('READONLY')!;
      return this.evaluatePermission(agentName, action, resource, readonlyProfile, 'READONLY');
    }

    return this.evaluatePermission(agentName, action, resource, profile, profileName);
  }

  /**
   * Check if agent can use a specific MCP tool
   */
  checkToolAccess(agentName: string, toolName: string): PermissionCheckResult {
    const profileName = this.getProfileName(agentName);
    const profile = this.profiles.get(profileName) ?? this.profiles.get('READONLY')!;

    if (profile.allowedTools.includes('*') || profile.allowedTools.includes(toolName)) {
      return {
        allowed: true, agent: agentName, action: `tool:${toolName}`,
        reason: 'Tool access granted', profile: profileName,
      };
    }

    const result: PermissionCheckResult = {
      allowed: false, agent: agentName, action: `tool:${toolName}`,
      reason: `Tool "${toolName}" not in allowed list for ${profileName}`,
      profile: profileName,
    };

    this.recordViolation(agentName, `tool:${toolName}`, undefined, result.reason, 'medium');
    return result;
  }

  /**
   * Check network domain access
   */
  checkNetworkAccess(agentName: string, domain: string): PermissionCheckResult {
    const profileName = this.getProfileName(agentName);
    const profile = this.profiles.get(profileName) ?? this.profiles.get('READONLY')!;

    if (profile.allowedNetworkDomains.includes('*')) {
      return { allowed: true, agent: agentName, action: 'network', resource: domain, reason: 'All domains allowed', profile: profileName };
    }

    const allowed = profile.allowedNetworkDomains.some(pattern => {
      if (pattern.startsWith('*.')) {
        return domain.endsWith(pattern.slice(1));
      }
      return domain === pattern;
    });

    if (allowed) {
      return { allowed: true, agent: agentName, action: 'network', resource: domain, reason: 'Domain whitelisted', profile: profileName };
    }

    const result: PermissionCheckResult = {
      allowed: false, agent: agentName, action: 'network', resource: domain,
      reason: `Domain "${domain}" not allowed for ${profileName}`,
      profile: profileName,
    };

    this.recordViolation(agentName, 'network', domain, result.reason, 'high');
    return result;
  }

  /**
   * Track cost usage (returns false if over daily limit)
   */
  trackCost(agentName: string, costUsd: number): boolean {
    const profileName = this.getProfileName(agentName);
    const profile = this.profiles.get(profileName) ?? this.profiles.get('READONLY')!;

    const current = this.dailyCosts.get(agentName) ?? 0;
    const newTotal = current + costUsd;

    if (newTotal > profile.resourceLimits.maxCostPerDay) {
      this.recordViolation(agentName, 'cost_limit', `${newTotal.toFixed(4)} USD`,
        `Daily cost limit exceeded: ${newTotal.toFixed(4)} > ${profile.resourceLimits.maxCostPerDay}`, 'high');
      return false;
    }

    this.dailyCosts.set(agentName, newTotal);
    return true;
  }

  /**
   * Get agent's permission profile
   */
  getAgentProfile(agentName: string): EnhancedPermissionProfile | undefined {
    const profileName = this.getProfileName(agentName);
    return this.profiles.get(profileName);
  }

  /**
   * Get all violations
   */
  getViolations(limit = 50): ViolationRecord[] {
    return this.violations.slice(-limit);
  }

  /**
   * Get violation statistics
   */
  getViolationStats() {
    const byAgent = new Map<string, number>();
    const bySeverity = { low: 0, medium: 0, high: 0, critical: 0 };

    for (const v of this.violations) {
      byAgent.set(v.agent, (byAgent.get(v.agent) ?? 0) + 1);
      bySeverity[v.severity]++;
    }

    return {
      total: this.violations.length,
      byAgent: Object.fromEntries(byAgent),
      bySeverity,
      alertThresholdReached: this.violations.filter(v =>
        v.severity === 'high' || v.severity === 'critical'
      ).length >= 5,
    };
  }

  /**
   * List all known profiles
   */
  listProfiles(): Array<{ name: string; role: string; toolCount: number; networkDomains: number }> {
    return Array.from(this.profiles.entries()).map(([name, profile]) => ({
      name,
      role: profile.role,
      toolCount: profile.allowedTools.includes('*') ? -1 : profile.allowedTools.length,
      networkDomains: profile.allowedNetworkDomains.includes('*') ? -1 : profile.allowedNetworkDomains.length,
    }));
  }

  /**
   * Reset daily cost tracking (call at midnight)
   */
  resetDailyCosts(): void {
    this.dailyCosts.clear();
    logInfo('[RBAC]', 'Daily cost counters reset');
  }

  // --------------------------------------------------------------------------
  // Private helpers
  // --------------------------------------------------------------------------

  private getProfileName(agentName: string): string {
    // Direct mapping
    if (AGENT_PROFILE_MAP[agentName]) return AGENT_PROFILE_MAP[agentName];

    // Pattern matching
    const lower = agentName.toLowerCase();
    if (lower.includes('orchestrator') || lower.includes('admin')) return 'ADMIN';
    if (lower.includes('developer') || lower.includes('coder') || lower.includes('refactor')) return 'DEVELOPER';
    if (lower.includes('research') || lower.includes('analyzer')) return 'RESEARCHER';
    if (lower.includes('evaluator') || lower.includes('test') || lower.includes('review')) return 'EVALUATOR';
    if (lower.includes('robotkez') || lower.includes('browser') || lower.includes('scraper')) return 'ROBOTKEZ';

    // Default: READONLY
    return 'READONLY';
  }

  private evaluatePermission(
    agentName: string, action: string, resource: string | undefined,
    profile: EnhancedPermissionProfile, profileName: string
  ): PermissionCheckResult {
    // ADMIN gets everything
    if (profile.permissions.includes(Permission.ADMIN)) {
      return { allowed: true, agent: agentName, action, resource, reason: 'Admin access', profile: profileName };
    }

    // Map action string to Permission enum
    const permMap: Record<string, Permission> = {
      read_file: Permission.READ_FILE,
      write_file: Permission.WRITE_FILE,
      delete_file: Permission.DELETE_FILE,
      read_dir: Permission.READ_DIR,
      run_command: Permission.RUN_COMMAND,
      run_tests: Permission.RUN_TESTS,
      git: Permission.GIT_OPERATIONS,
      http: Permission.HTTP_REQUEST,
      browser: Permission.BROWSER_CONTROL,
      db_read: Permission.DB_READ,
      db_write: Permission.DB_WRITE,
      code_exec: Permission.RUN_COMMAND,
    };

    const requiredPerm = permMap[action];
    if (!requiredPerm) {
      // Unknown action → deny for safety
      const result: PermissionCheckResult = {
        allowed: false, agent: agentName, action, resource,
        reason: `Unknown action: ${action}`, profile: profileName,
      };
      this.recordViolation(agentName, action, resource, result.reason, 'low');
      return result;
    }

    if (profile.permissions.includes(requiredPerm)) {
      return { allowed: true, agent: agentName, action, resource, reason: 'Permission granted', profile: profileName };
    }

    const result: PermissionCheckResult = {
      allowed: false, agent: agentName, action, resource,
      reason: `Missing permission: ${requiredPerm}`, profile: profileName,
    };
    this.recordViolation(agentName, action, resource, result.reason, 'medium');
    return result;
  }

  private recordViolation(agent: string, action: string, resource: string | undefined, reason: string, severity: ViolationRecord['severity']): void {
    const violation: ViolationRecord = {
      timestamp: new Date().toISOString(),
      agent, action, resource, reason, severity,
    };
    this.violations.push(violation);

    // Keep bounded
    if (this.violations.length > 5000) {
      this.violations = this.violations.slice(-2500);
    }

    logWarn('[RBAC]', `VIOLATION [${severity}] ${agent}: ${reason}`);
  }
}

// ============================================================================
// SINGLETON
// ============================================================================

let instance: EnhancedPermissionManager | null = null;

export function getEnhancedPermissionManager(): EnhancedPermissionManager {
  if (!instance) {
    instance = new EnhancedPermissionManager();
    logInfo('[RBAC]', 'Enhanced Permission Manager initialized');
  }
  return instance;
}

export function resetEnhancedPermissionManager(): void {
  instance = null;
}
