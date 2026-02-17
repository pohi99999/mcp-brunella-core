// FILE: test/modelRouter.test.ts
// PURPOSE: G3.2 — Model Router tesztek (RULE-MR1 through RULE-MR4)

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock logger before importing modelRouter
vi.mock('../src/utils/logger.js', () => ({
  logInfo: vi.fn(),
  logError: vi.fn(),
  setAgentStatus: vi.fn(),
}));

import {
  selectModel,
  routeTask,
  detectComplexity,
  detectCategory,
  getModelProfiles,
  getRoutingHistory,
  clearRoutingHistory,
  getRouterConfig,
  type TaskProfile,
  type RouterConfig,
} from '../src/core/modelRouter.js';

describe('Model Router (G3)', () => {
  beforeEach(() => {
    clearRoutingHistory();
  });

  // ========================================================================
  // detectComplexity
  // ========================================================================
  describe('detectComplexity', () => {
    it('should detect high complexity for planning tasks', () => {
      expect(detectComplexity('Plan the new architecture')).toBe('high');
      expect(detectComplexity('Design system API schema')).toBe('high');
      expect(detectComplexity('Analyze the codebase for security issues')).toBe('high');
      expect(detectComplexity('Strategic migration to new framework')).toBe('high');
    });

    it('should detect low complexity for simple tasks', () => {
      expect(detectComplexity('Write test for utils.ts')).toBe('low');
      expect(detectComplexity('Fix lint errors')).toBe('low');
      expect(detectComplexity('Translate comments to English')).toBe('low');
      expect(detectComplexity('Fix typo in readme')).toBe('low');
      expect(detectComplexity('Update import paths')).toBe('low');
    });

    it('should default to medium for unrecognized tasks', () => {
      expect(detectComplexity('implement the feature')).toBe('medium');
      expect(detectComplexity('create a new endpoint')).toBe('medium');
    });
  });

  // ========================================================================
  // detectCategory
  // ========================================================================
  describe('detectCategory', () => {
    it('should categorize planning tasks', () => {
      expect(detectCategory('Plan the sprint')).toBe('planning');
      expect(detectCategory('Design new architecture')).toBe('planning');
    });

    it('should categorize test tasks', () => {
      expect(detectCategory('Write vitest test')).toBe('test');
      expect(detectCategory('Create spec for module')).toBe('test');
    });

    it('should categorize debug tasks', () => {
      expect(detectCategory('Fix the error in parser')).toBe('debug');
      expect(detectCategory('Debug the memory leak')).toBe('debug');
    });

    it('should categorize doc tasks', () => {
      expect(detectCategory('Update README documentation')).toBe('docs');
      expect(detectCategory('Add JSDoc comments')).toBe('docs');
    });

    it('should default to code_gen', () => {
      expect(detectCategory('implement the feature')).toBe('code_gen');
    });
  });

  // ========================================================================
  // selectModel — RULE-MR1: High complexity → Cloud
  // ========================================================================
  describe('RULE-MR1: High complexity → Cloud', () => {
    it('should select a cloud model for high complexity tasks', () => {
      // Mock API keys to ensure cloud models are available
      vi.stubEnv('GITHUB_TOKEN', 'dummy_token');

      const task: TaskProfile = {
        description: 'Architect the microservice migration',
        complexity: 'high',
        category: 'planning'
      };

      const decision = selectModel(task, { budget: 50 });
      expect(decision.model.provider).not.toBe('ollama');
      expect(decision.reason).toContain('RULE-MR1');

      vi.unstubAllEnvs();
    });

    it('should provide Ollama fallback for high complexity', () => {
      const task: TaskProfile = {
        description: 'Plan the deployment strategy',
        complexity: 'high',
        category: 'planning'
      };

      const decision = selectModel(task, { budget: 50, fallbackEnabled: true });
      expect(decision.fallback).toBeDefined();
      expect(decision.fallback?.provider).toBe('ollama');
    });
  });

  // ========================================================================
  // selectModel — RULE-MR2: Low complexity → Ollama
  // ========================================================================
  describe('RULE-MR2: Low complexity → Ollama', () => {
    it('should select Ollama for low complexity tasks', () => {
      const task: TaskProfile = {
        description: 'Generate unit tests',
        complexity: 'low',
        category: 'test'
      };

      const decision = selectModel(task, { budget: 100 });
      expect(decision.model.provider).toBe('ollama');
      expect(decision.reason).toContain('RULE-MR2');
    });
  });

  // ========================================================================
  // selectModel — RULE-MR3: Budget=0 → Ollama only
  // ========================================================================
  describe('RULE-MR3: Budget=0 → Ollama only', () => {
    it('should always select Ollama when budget is 0', () => {
      const task: TaskProfile = {
        description: 'Architect the entire platform',
        complexity: 'high',
        category: 'planning'
      };

      const decision = selectModel(task, { budget: 0 });
      expect(decision.model.provider).toBe('ollama');
      expect(decision.reason).toContain('RULE-MR3');
    });

    it('should select Ollama even for high complexity with budget 0', () => {
      const task: TaskProfile = {
        description: 'Complex system design',
        complexity: 'high',
        category: 'planning'
      };

      const decision = selectModel(task, { budget: 0 });
      expect(decision.model.provider).toBe('ollama');
    });
  });

  // ========================================================================
  // selectModel — Medium complexity
  // ========================================================================
  describe('Medium complexity routing', () => {
    it('should prefer local when preferLocal is true', () => {
      const task: TaskProfile = {
        description: 'Implement new feature',
        complexity: 'medium',
        category: 'code_gen'
      };

      const decision = selectModel(task, { budget: 50, preferLocal: true });
      expect(decision.model.provider).toBe('ollama');
    });
  });

  // ========================================================================
  // selectModel — Manual override
  // ========================================================================
  describe('Manual override', () => {
    it('should use overrideModel when set', () => {
      const task: TaskProfile = {
        description: 'Any task',
        complexity: 'low',
        category: 'code_gen'
      };

      const decision = selectModel(task, { overrideModel: 'gpt-4o', budget: 50 });
      expect(decision.model.name).toBe('gpt-4o');
      expect(decision.reason).toContain('Manual override');
    });
  });

  // ========================================================================
  // routeTask (convenience function)
  // ========================================================================
  describe('routeTask', () => {
    it('should auto-detect complexity and route', () => {
      const decision = routeTask('Plan the architecture', { budget: 50 });
      expect(decision.model).toBeDefined();
      expect(decision.reason).toBeDefined();
    });

    it('should route simple tasks to Ollama', () => {
      const decision = routeTask('Fix typo in variable name', { budget: 50 });
      expect(decision.model.provider).toBe('ollama');
    });
  });

  // ========================================================================
  // Routing history
  // ========================================================================
  describe('Routing history', () => {
    it('should record routing decisions', () => {
      routeTask('Plan architecture', { budget: 50 });
      routeTask('Fix typo', { budget: 50 });

      const history = getRoutingHistory();
      expect(history.length).toBe(2);
      expect(history[0].timestamp).toBeLessThanOrEqual(history[1].timestamp);
    });

    it('should clear history', () => {
      routeTask('Some task', { budget: 50 });
      clearRoutingHistory();
      expect(getRoutingHistory().length).toBe(0);
    });
  });

  // ========================================================================
  // Model profiles API
  // ========================================================================
  describe('Model profiles', () => {
    it('should return all registered models', () => {
      const profiles = getModelProfiles();
      expect(profiles.length).toBeGreaterThanOrEqual(2);
      
      const providers = profiles.map(p => p.provider);
      expect(providers).toContain('ollama');
    });

    it('should have both brain and muscle roles', () => {
      const profiles = getModelProfiles();
      const roles = profiles.map(p => p.role);
      expect(roles).toContain('brain');
      expect(roles).toContain('muscle');
    });
  });

  // ========================================================================
  // Router config
  // ========================================================================
  describe('getRouterConfig', () => {
    it('should return config with expected keys', () => {
      const config = getRouterConfig();
      expect(config).toHaveProperty('budget');
      expect(config).toHaveProperty('preferLocal');
      expect(config).toHaveProperty('fallbackEnabled');
      expect(typeof config.budget).toBe('number');
    });
  });
});
