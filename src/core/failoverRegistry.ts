/**
 * FailoverRegistry - Cross-Agent Failover Mapping
 *
 * Phoenix Protocol Szint 4: When an agent fails after all retries exhausted,
 * this registry determines which backup agent(s) can handle the same task type.
 *
 * Fallback chain: primary → secondary → tertiary → escalate
 *
 * @version 1.0.0
 */

import { logInfo, logError } from '../utils/logger.js';

// ============================================================================
// INTERFACES
// ============================================================================

export interface FailoverMapping {
  /** Primary agent name */
  primary: string;
  /** Ordered list of backup agents to try */
  fallbacks: string[];
  /** Task categories this mapping covers */
  categories: string[];
}

export interface FailoverAttempt {
  primaryAgent: string;
  fallbackAgent: string;
  taskInstruction: string;
  success: boolean;
  error?: string;
  attemptIndex: number;
  timestamp: string;
}

// ============================================================================
// DEFAULT FAILOVER MAPPINGS
// ============================================================================

/**
 * Default failover chain per agent, based on capability overlap in registry.json.
 *
 * developer → evaluator → orchestrator (code tasks)
 * evaluator → developer → orchestrator (audit/test tasks)
 * researcher → orchestrator              (knowledge tasks)
 * robotkez → orchestrator                (browser tasks — no true backup)
 * lint_fixer → developer                 (lint tasks)
 * SpecWriter → developer                 (spec generation tasks)
 * ProjectConductor → orchestrator        (project management)
 * voice → orchestrator                   (voice tasks — no true backup)
 * EdgeProxy → orchestrator               (edge tasks → local fallback)
 */
const DEFAULT_FAILOVER_MAPPINGS: FailoverMapping[] = [
  {
    primary: 'Developer',
    fallbacks: ['evaluator', 'orchestrator'],
    categories: ['code_generation', 'self_healing', 'pipeline'],
  },
  {
    primary: 'evaluator',
    fallbacks: ['developer', 'orchestrator'],
    categories: ['audit_system', 'run_tests', 'check_health'],
  },
  {
    primary: 'researcher',
    fallbacks: ['orchestrator'],
    categories: ['rag_search', 'summarization'],
  },
  {
    primary: 'robotkez',
    fallbacks: ['orchestrator'],
    categories: ['browser_automation', 'web_scraping'],
  },
  {
    primary: 'lint_fixer',
    fallbacks: ['developer', 'orchestrator'],
    categories: ['lint_check', 'auto_fix', 'type_check'],
  },
  {
    primary: 'SpecWriter',
    fallbacks: ['developer', 'orchestrator'],
    categories: ['track_generation', 'requirement_extraction'],
  },
  {
    primary: 'ProjectConductor',
    fallbacks: ['orchestrator'],
    categories: ['project_management', 'documentation_sync'],
  },
  {
    primary: 'voice',
    fallbacks: ['orchestrator'],
    categories: ['voice_command_refinement', 'multimodal_context_analysis'],
  },
  {
    primary: 'EdgeProxy',
    fallbacks: ['orchestrator'],
    categories: ['edge', 'remote_access'],
  },
  {
    primary: 'project_organizer',
    fallbacks: ['developer', 'orchestrator'],
    categories: ['organization', 'documentation', 'cleanup'],
  },
];

// ============================================================================
// FAILOVER REGISTRY CLASS
// ============================================================================

class FailoverRegistryClass {
  private mappings: Map<string, FailoverMapping> = new Map();
  private attemptLog: FailoverAttempt[] = [];
  private readonly MAX_LOG_SIZE = 100;

  constructor() {
    this.loadDefaults();
  }

  private loadDefaults(): void {
    for (const mapping of DEFAULT_FAILOVER_MAPPINGS) {
      this.mappings.set(mapping.primary.toLowerCase(), mapping);
    }
  }

  /**
   * Get the ordered fallback chain for a failed agent.
   * Returns empty array if no fallbacks are defined.
   */
  getFallbacks(agentName: string): string[] {
    const mapping = this.mappings.get(agentName.toLowerCase());
    return mapping ? [...mapping.fallbacks] : [];
  }

  /**
   * Get all failover mappings.
   */
  getAllMappings(): FailoverMapping[] {
    return Array.from(this.mappings.values());
  }

  /**
   * Register or update a failover mapping.
   */
  registerMapping(mapping: FailoverMapping): void {
    this.mappings.set(mapping.primary.toLowerCase(), mapping);
    logInfo('FailoverRegistry', `Mapping updated: ${mapping.primary} → [${mapping.fallbacks.join(', ')}]`);
  }

  /**
   * Record a failover attempt for auditing.
   */
  recordAttempt(attempt: FailoverAttempt): void {
    this.attemptLog.push(attempt);
    if (this.attemptLog.length > this.MAX_LOG_SIZE) {
      this.attemptLog.splice(0, this.attemptLog.length - this.MAX_LOG_SIZE);
    }
  }

  /**
   * Get recent failover attempts, optionally filtered.
   */
  getAttempts(agentFilter?: string, limit = 50): FailoverAttempt[] {
    const filtered = agentFilter
      ? this.attemptLog.filter(
          (a) =>
            a.primaryAgent.toLowerCase() === agentFilter.toLowerCase() ||
            a.fallbackAgent.toLowerCase() === agentFilter.toLowerCase(),
        )
      : this.attemptLog;
    return filtered.slice(-limit);
  }

  /**
   * Get failover success rate statistics.
   */
  getStats(): {
    totalAttempts: number;
    successCount: number;
    failureCount: number;
    successRate: number;
    byAgent: Record<string, { total: number; success: number }>;
  } {
    const total = this.attemptLog.length;
    const success = this.attemptLog.filter((a) => a.success).length;
    const byAgent: Record<string, { total: number; success: number }> = {};

    for (const attempt of this.attemptLog) {
      const key = attempt.primaryAgent.toLowerCase();
      if (!byAgent[key]) byAgent[key] = { total: 0, success: 0 };
      byAgent[key].total++;
      if (attempt.success) byAgent[key].success++;
    }

    return {
      totalAttempts: total,
      successCount: success,
      failureCount: total - success,
      successRate: total > 0 ? success / total : 0,
      byAgent,
    };
  }

  /**
   * Clear attempt log.
   */
  clearAttempts(): void {
    this.attemptLog = [];
  }
}

export const failoverRegistry = new FailoverRegistryClass();
export default failoverRegistry;
