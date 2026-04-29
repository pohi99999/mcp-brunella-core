/**
 * Tests for Phoenix Protocol v2 - Graceful Degradation Policy
 *
 * Validates Phase 4: System continues operating at reduced capacity
 * when services fail, rather than complete shutdown.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { degradationPolicy, canPerformOperation, getFallbackMessage, } from '@packages/utils/degradationPolicy.js';
describe('Phoenix Protocol v2 - Graceful Degradation', () => {
    beforeEach(() => {
        // Reset to healthy state before each test
        degradationPolicy.reset();
    });
    describe('Degradation Level Assessment', () => {
        it('should report full functionality when all services healthy', () => {
            const state = degradationPolicy.assessDegradation([]);
            expect(state.level).toBe('full');
            expect(state.availableServices).toContain('ollama');
            expect(state.availableServices).toContain('fastapi');
            expect(state.availableServices).toContain('dashboard');
            expect(state.unavailableServices).toHaveLength(0);
            expect(degradationPolicy.getUserMessage()).toContain('🟢');
        });
        it('should handle Ollama failure with partial degradation', () => {
            const state = degradationPolicy.assessDegradation(['ollama']);
            expect(state.level).toBe('partial');
            expect(state.availableServices).toContain('dashboard');
            expect(state.availableServices).toContain('tools');
            expect(state.unavailableServices).toContain('ollama');
            expect(state.affectedAgents).toContain('OrchestratorAgent');
            expect(state.affectedAgents).toContain('DeveloperAgent');
            expect(degradationPolicy.getUserMessage()).toContain('🟡');
        });
        it('should handle FastAPI failure with partial degradation', () => {
            const state = degradationPolicy.assessDegradation(['fastapi']);
            expect(state.level).toBe('partial');
            expect(state.availableServices).toContain('ollama');
            expect(state.availableServices).toContain('dashboard');
            expect(state.unavailableServices).toContain('fastapi');
            expect(state.affectedAgents).toContain('DataScientistAgent');
            expect(state.affectedAgents).toContain('RobotkezAgent');
        });
        it('should handle Dashboard failure gracefully', () => {
            const state = degradationPolicy.assessDegradation(['dashboard']);
            expect(state.level).toBe('partial');
            expect(state.availableServices).toContain('ollama');
            expect(state.availableServices).toContain('fastapi');
            expect(state.availableServices).toContain('mcp');
            expect(state.message).toContain('CLI');
        });
        it('should report critical degradation when both Ollama and FastAPI down', () => {
            const state = degradationPolicy.assessDegradation(['ollama', 'fastapi']);
            expect(state.level).toBe('minimal');
            expect(state.availableServices).toContain('dashboard');
            expect(state.affectedAgents).toContain('*');
            expect(degradationPolicy.getUserMessage()).toContain('🟠');
        });
        it('should report offline when 3+ services down', () => {
            const state = degradationPolicy.assessDegradation(['ollama', 'fastapi', 'dashboard']);
            expect(state.level).toBe('offline');
            expect(state.message).toContain('offline');
            expect(degradationPolicy.getUserMessage()).toContain('🔴');
        });
    });
    describe('Service Availability Check', () => {
        it('should report all services available when healthy', () => {
            degradationPolicy.assessDegradation([]);
            expect(degradationPolicy.isServiceAvailable('ollama')).toBe(true);
            expect(degradationPolicy.isServiceAvailable('fastapi')).toBe(true);
            expect(degradationPolicy.isServiceAvailable('dashboard')).toBe(true);
        });
        it('should report unavailable services correctly', () => {
            degradationPolicy.assessDegradation(['ollama']);
            expect(degradationPolicy.isServiceAvailable('ollama')).toBe(false);
            expect(degradationPolicy.isServiceAvailable('fastapi')).toBe(true);
            expect(degradationPolicy.isServiceAvailable('dashboard')).toBe(true);
        });
        it('should handle multiple unavailable services', () => {
            degradationPolicy.assessDegradation(['ollama', 'dashboard']);
            expect(degradationPolicy.isServiceAvailable('ollama')).toBe(false);
            expect(degradationPolicy.isServiceAvailable('fastapi')).toBe(true);
            expect(degradationPolicy.isServiceAvailable('dashboard')).toBe(false);
        });
    });
    describe('Agent Operation Check', () => {
        it('should allow all agents when healthy', () => {
            degradationPolicy.assessDegradation([]);
            expect(degradationPolicy.canAgentOperate('OrchestratorAgent')).toBe(true);
            expect(degradationPolicy.canAgentOperate('DeveloperAgent')).toBe(true);
            expect(degradationPolicy.canAgentOperate('DataScientistAgent')).toBe(true);
        });
        it('should block affected agents when service down', () => {
            degradationPolicy.assessDegradation(['ollama']);
            expect(degradationPolicy.canAgentOperate('OrchestratorAgent')).toBe(false);
            expect(degradationPolicy.canAgentOperate('DeveloperAgent')).toBe(false);
            expect(degradationPolicy.canAgentOperate('EvaluatorAgent')).toBe(true);
        });
        it('should block all agents in critical state', () => {
            degradationPolicy.assessDegradation(['ollama', 'fastapi']);
            expect(degradationPolicy.canAgentOperate('OrchestratorAgent')).toBe(false);
            expect(degradationPolicy.canAgentOperate('DeveloperAgent')).toBe(false);
            expect(degradationPolicy.canAgentOperate('DataScientistAgent')).toBe(false);
        });
    });
    describe('Operation Permission Check', () => {
        it('should allow operations when services available', () => {
            degradationPolicy.assessDegradation([]);
            expect(canPerformOperation('llm_generation')).toBe(true);
            expect(canPerformOperation('python_execution')).toBe(true);
            expect(canPerformOperation('file_operations')).toBe(true);
        });
        it('should block LLM operations when Ollama down', () => {
            degradationPolicy.assessDegradation(['ollama']);
            expect(canPerformOperation('llm_generation')).toBe(false);
            expect(canPerformOperation('python_execution')).toBe(true);
            expect(canPerformOperation('file_operations')).toBe(true);
        });
        it('should block Python operations when FastAPI down', () => {
            degradationPolicy.assessDegradation(['fastapi']);
            expect(canPerformOperation('llm_generation')).toBe(true);
            expect(canPerformOperation('python_execution')).toBe(false);
            expect(canPerformOperation('browser_automation')).toBe(false);
        });
        it('should always allow file operations and health checks', () => {
            degradationPolicy.assessDegradation(['ollama', 'fastapi', 'dashboard']);
            expect(canPerformOperation('file_operations')).toBe(true);
            expect(canPerformOperation('health_check')).toBe(true);
        });
    });
    describe('Fallback Messages', () => {
        it('should provide meaningful fallback for LLM operations', () => {
            degradationPolicy.assessDegradation(['ollama']);
            const message = getFallbackMessage('llm_generation');
            expect(message).toContain('LLM unavailable');
            expect(message).toContain('cached responses');
        });
        it('should provide fallback for Python operations', () => {
            degradationPolicy.assessDegradation(['fastapi']);
            const message = getFallbackMessage('python_execution');
            expect(message).toContain('Python backend unavailable');
            expect(message).toContain('TypeScript alternatives');
        });
        it('should provide generic fallback for unknown operations', () => {
            degradationPolicy.assessDegradation(['ollama']);
            const message = getFallbackMessage('unknown_operation');
            expect(message).toContain('unavailable');
        });
    });
    describe('State Persistence', () => {
        it('should maintain current state', () => {
            degradationPolicy.assessDegradation(['ollama']);
            const state1 = degradationPolicy.getCurrentState();
            const state2 = degradationPolicy.getCurrentState();
            expect(state1.level).toBe(state2.level);
            expect(state1.unavailableServices).toEqual(state2.unavailableServices);
        });
        it('should update state when degradation changes', () => {
            degradationPolicy.assessDegradation(['ollama']);
            const state1 = degradationPolicy.getCurrentState();
            degradationPolicy.assessDegradation(['ollama', 'fastapi']);
            const state2 = degradationPolicy.getCurrentState();
            expect(state1.level).toBe('partial');
            expect(state2.level).toBe('minimal');
            expect(state2.unavailableServices).toHaveLength(2);
        });
        it('should update timestamp on state change', { timeout: 5000 }, async () => {
            degradationPolicy.assessDegradation(['ollama']);
            const state1 = degradationPolicy.getCurrentState();
            // Wait a moment
            await new Promise((resolve) => setTimeout(resolve, 10));
            degradationPolicy.assessDegradation(['fastapi']);
            const state2 = degradationPolicy.getCurrentState();
            expect(state2.timestamp).not.toBe(state1.timestamp);
        });
    });
    describe('Service Dependencies', () => {
        it('should provide dependency info for Ollama', () => {
            const deps = degradationPolicy.getServiceDependencies('ollama');
            expect(deps).toBeDefined();
            expect(deps?.service).toBe('ollama');
            expect(deps?.requiredFor).toContain('LLM generation');
        });
        it('should provide dependency info for FastAPI', () => {
            const deps = degradationPolicy.getServiceDependencies('fastapi');
            expect(deps).toBeDefined();
            expect(deps?.service).toBe('fastapi');
            expect(deps?.requiredFor).toContain('Python execution');
        });
        it('should return undefined for unknown service', () => {
            const deps = degradationPolicy.getServiceDependencies('unknown_service');
            expect(deps).toBeUndefined();
        });
    });
    describe('User Messages', () => {
        it('should provide clear status indicators', () => {
            degradationPolicy.assessDegradation([]);
            expect(degradationPolicy.getUserMessage()).toContain('🟢');
            degradationPolicy.assessDegradation(['ollama']);
            expect(degradationPolicy.getUserMessage()).toContain('🟡');
            degradationPolicy.assessDegradation(['ollama', 'fastapi']);
            expect(degradationPolicy.getUserMessage()).toContain('🟠');
            degradationPolicy.assessDegradation(['ollama', 'fastapi', 'dashboard']);
            expect(degradationPolicy.getUserMessage()).toContain('🔴');
        });
        it('should include degradation message in user message', () => {
            degradationPolicy.assessDegradation(['ollama']);
            const message = degradationPolicy.getUserMessage();
            expect(message).toContain('LLM service unavailable');
        });
    });
    describe('Edge Cases', () => {
        it('should handle empty failure list', () => {
            const state = degradationPolicy.assessDegradation([]);
            expect(state.level).toBe('full');
            expect(state.unavailableServices).toHaveLength(0);
        });
        it('should handle case-insensitive service names', () => {
            const state = degradationPolicy.assessDegradation(['OLLAMA', 'FastAPI']);
            expect(state.level).toBe('minimal');
            expect(state.unavailableServices).toEqual(['ollama', 'fastapi']);
        });
        it('should handle unknown service failures gracefully', () => {
            const state = degradationPolicy.assessDegradation(['unknown_service']);
            expect(state.level).toBe('partial');
            expect(state.unavailableServices).toContain('unknown_service');
        });
        it('should reset state correctly', () => {
            degradationPolicy.assessDegradation(['ollama', 'fastapi']);
            expect(degradationPolicy.getCurrentState().level).toBe('minimal');
            degradationPolicy.reset();
            expect(degradationPolicy.getCurrentState().level).toBe('full');
        });
    });
});
