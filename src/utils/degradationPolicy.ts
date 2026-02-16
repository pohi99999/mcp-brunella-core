/**
 * Graceful Degradation Policy — Phoenix Protocol v2 (Phase 4)
 *
 * Defines how the system operates when services are unavailable.
 * Ensures partial functionality instead of complete failure.
 *
 * @version 1.0.0
 */

import { logInfo, logWarn, logError } from './logger.js';
import { phoenixEventBus } from '../core/phoenixEventBus.js';

// ---------------------------------------------------------------------------
// TYPES
// ---------------------------------------------------------------------------

export type DegradationLevel = 'full' | 'partial' | 'minimal' | 'offline';

export interface DegradationState {
  level: DegradationLevel;
  availableServices: string[];
  unavailableServices: string[];
  message: string;
  timestamp: string;
  affectedAgents: string[];
}

export interface ServiceDependency {
  service: string;
  requiredFor: string[];
  fallback?: string;
}

// ---------------------------------------------------------------------------
// DEGRADATION LEVELS
// ---------------------------------------------------------------------------

const DEGRADATION_LEVELS: Record<string, DegradationState> = {
  all_healthy: {
    level: 'full',
    availableServices: ['ollama', 'fastapi', 'dashboard', 'agents', 'tools', 'mcp'],
    unavailableServices: [],
    message: 'All services operational',
    timestamp: '',
    affectedAgents: [],
  },
  ollama_down: {
    level: 'partial',
    availableServices: ['fastapi', 'dashboard', 'agents', 'tools', 'file_ops', 'mcp'],
    unavailableServices: ['ollama', 'llm_generation'],
    message: 'LLM service unavailable - basic operations only',
    timestamp: '',
    affectedAgents: ['OrchestratorAgent', 'DeveloperAgent', 'ResearcherAgent'],
  },
  fastapi_down: {
    level: 'partial',
    availableServices: ['ollama', 'dashboard', 'agents', 'tools', 'mcp'],
    unavailableServices: ['fastapi', 'python_execution', 'browser_automation'],
    message: 'Python backend restarting - TypeScript agents available',
    timestamp: '',
    affectedAgents: ['DataScientistAgent', 'RobotkezAgent', 'VoiceAgent'],
  },
  dashboard_down: {
    level: 'partial',
    availableServices: ['ollama', 'fastapi', 'agents', 'tools', 'mcp'],
    unavailableServices: ['dashboard', 'ui'],
    message: 'Dashboard unavailable - CLI and MCP access working',
    timestamp: '',
    affectedAgents: [],
  },
  backend_critical: {
    level: 'minimal',
    availableServices: ['dashboard', 'health_check'],
    unavailableServices: ['ollama', 'fastapi', 'agents', 'tools'],
    message: 'Critical backend failure - monitoring only',
    timestamp: '',
    affectedAgents: ['*'],
  },
  total_failure: {
    level: 'offline',
    availableServices: [],
    unavailableServices: ['*'],
    message: 'System offline - all services down',
    timestamp: '',
    affectedAgents: ['*'],
  },
};

// ---------------------------------------------------------------------------
// SERVICE DEPENDENCIES
// ---------------------------------------------------------------------------

const SERVICE_DEPENDENCIES: ServiceDependency[] = [
  {
    service: 'ollama',
    requiredFor: ['LLM generation', 'Agent planning', 'Code generation'],
  },
  {
    service: 'fastapi',
    requiredFor: ['Python execution', 'Browser automation', 'Data processing'],
  },
  {
    service: 'dashboard',
    requiredFor: ['UI', 'Real-time monitoring'],
  },
];

// ---------------------------------------------------------------------------
// DEGRADATION MANAGER
// ---------------------------------------------------------------------------

class DegradationPolicyManager {
  private currentState: DegradationState = {
    ...DEGRADATION_LEVELS.all_healthy,
    timestamp: new Date().toISOString(),
  };

  /**
   * Assess system degradation level based on failed services.
   */
  assessDegradation(failedServices: string[]): DegradationState {
    const failed = failedServices.map((s) => s.toLowerCase());

    // Determine degradation level
    let newState: DegradationState;

    if (failed.length === 0) {
      newState = { ...DEGRADATION_LEVELS.all_healthy };
    } else if (failed.length >= 3) {
      // 3+ services down = total failure (offline)
      newState = { ...DEGRADATION_LEVELS.total_failure };
    } else if (failed.includes('ollama') && failed.includes('fastapi')) {
      // Both critical backends down = minimal
      newState = { ...DEGRADATION_LEVELS.backend_critical };
    } else if (failed.includes('ollama')) {
      newState = { ...DEGRADATION_LEVELS.ollama_down };
    } else if (failed.includes('fastapi')) {
      newState = { ...DEGRADATION_LEVELS.fastapi_down };
    } else if (failed.includes('dashboard')) {
      newState = { ...DEGRADATION_LEVELS.dashboard_down };
    } else {
      // Unknown failure - partial degradation
      newState = {
        level: 'partial',
        availableServices: ['dashboard', 'health_check'],
        unavailableServices: failed,
        message: `Services down: ${failed.join(', ')}`,
        affectedAgents: [],
        timestamp: new Date().toISOString(),
      };
    }

    // Update timestamp and unavailable list
    newState.timestamp = new Date().toISOString();
    newState.unavailableServices = failed;

    // Update available services list (remove failed services)
    newState.availableServices = newState.availableServices.filter(
      (svc) => !failed.includes(svc.toLowerCase())
    );

    // Log degradation change
    if (newState.level !== this.currentState.level) {
      this.logDegradationChange(this.currentState, newState);
    }

    this.currentState = newState;
    return newState;
  }

  /**
   * Check if a specific service is available in current degradation state.
   */
  isServiceAvailable(serviceName: string): boolean {
    return this.currentState.availableServices.includes(serviceName);
  }

  /**
   * Check if an agent can operate in current degradation state.
   */
  canAgentOperate(agentName: string): boolean {
    const affected = this.currentState.affectedAgents;

    // If all agents affected
    if (affected.includes('*')) {
      return false;
    }

    // Check if this specific agent is affected
    return !affected.some((a) => agentName.includes(a));
  }

  /**
   * Get current degradation state.
   */
  getCurrentState(): DegradationState {
    return { ...this.currentState };
  }

  /**
   * Get user-friendly message for current state.
   */
  getUserMessage(): string {
    const state = this.currentState;

    switch (state.level) {
      case 'full':
        return '🟢 All systems operational';
      case 'partial':
        return `🟡 Partial functionality: ${state.message}`;
      case 'minimal':
        return `🟠 Limited operations: ${state.message}`;
      case 'offline':
        return `🔴 System offline: ${state.message}`;
      default:
        return '⚪ Unknown state';
    }
  }

  /**
   * Get service dependencies for a given service.
   */
  getServiceDependencies(serviceName: string): ServiceDependency | undefined {
    return SERVICE_DEPENDENCIES.find((dep) => dep.service === serviceName);
  }

  /**
   * Log degradation level change.
   */
  private logDegradationChange(
    oldState: DegradationState,
    newState: DegradationState
  ): void {
    const direction = this.getLevelSeverity(newState.level) >
      this.getLevelSeverity(oldState.level)
      ? 'DEGRADED'
      : 'RECOVERED';

    logWarn(
      'DegradationPolicy',
      `${direction}: ${oldState.level} → ${newState.level}`
    );
    logInfo('DegradationPolicy', newState.message);

    // Publish to Phoenix Event Bus
    phoenixEventBus.publish('phoenix:degraded', {
      level: newState.level,
      services: newState.unavailableServices,
      message: newState.message,
      timestamp: newState.timestamp,
    });
  }

  /**
   * Get numeric severity for degradation level (higher = worse).
   */
  private getLevelSeverity(level: DegradationLevel): number {
    const severity: Record<DegradationLevel, number> = {
      full: 0,
      partial: 1,
      minimal: 2,
      offline: 3,
    };
    return severity[level] || 0;
  }

  /**
   * Reset to healthy state (for testing).
   */
  reset(): void {
    this.currentState = {
      ...DEGRADATION_LEVELS.all_healthy,
      timestamp: new Date().toISOString(),
    };
  }
}

// ---------------------------------------------------------------------------
// SINGLETON EXPORT
// ---------------------------------------------------------------------------

export const degradationPolicy = new DegradationPolicyManager();

// ---------------------------------------------------------------------------
// HELPER FUNCTIONS
// ---------------------------------------------------------------------------

/**
 * Quick check if system can handle a specific operation type.
 */
export function canPerformOperation(operationType: string): boolean {
  const state = degradationPolicy.getCurrentState();

  const operationRequirements: Record<string, string[]> = {
    llm_generation: ['ollama'],
    python_execution: ['fastapi'],
    browser_automation: ['fastapi'],
    file_operations: [], // Always available
    health_check: [], // Always available
    agent_delegation: ['ollama', 'fastapi'],
  };

  const required = operationRequirements[operationType] || [];

  // Check if all required services are available
  return required.every((service) => state.availableServices.includes(service));
}

/**
 * Get fallback message for unavailable operation.
 */
export function getFallbackMessage(operationType: string): string {
  const state = degradationPolicy.getCurrentState();

  const fallbacks: Record<string, string> = {
    llm_generation: 'LLM unavailable - please use cached responses or retry later',
    python_execution: 'Python backend unavailable - use TypeScript alternatives',
    browser_automation: 'Browser automation unavailable - manual intervention required',
    agent_delegation: 'Agent system degraded - limited functionality available',
  };

  return (
    fallbacks[operationType] ||
    `Operation unavailable in ${state.level} mode: ${state.message}`
  );
}
