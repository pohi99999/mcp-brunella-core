import { describe, it, expect } from 'vitest';
import { moduleRegistry } from '../src/services/ModuleRegistry.js';

/**
 * Phase 6: Enterprise Suite Integration & E2E Tests
 * Tests ModuleRegistry service and 14-module enterprise configuration
 */

describe('Phase 6: Enterprise Suite Integration', () => {
  // ========================================================================
  // Module Registry Tests
  // ========================================================================

  describe('ModuleRegistry Service', () => {
    it('should initialize with all modules', () => {
      const modules = moduleRegistry.getAllModules();
      expect(modules.length).toBeGreaterThanOrEqual(13);
    });

    it('should have modules from all 4 categories', () => {
      const stats = moduleRegistry.getStats();
      expect(stats.categories).toContain('sales');
      expect(stats.categories).toContain('finance');
      expect(stats.categories).toContain('hr');
      expect(stats.categories).toContain('logistics');
    });

    it('should have 3 Sales modules', () => {
      const sales = moduleRegistry.getModulesByCategory('sales');
      expect(sales).toHaveLength(3);
      expect(sales.map(m => m.name)).toContain('SalesAgent');
      expect(sales.map(m => m.name)).toContain('PricingAgent');
      expect(sales.map(m => m.name)).toContain('NegotiationEngine');
    });

    it('should have 3 Finance modules', () => {
      const finance = moduleRegistry.getModulesByCategory('finance');
      expect(finance).toHaveLength(3);
      expect(finance.map(m => m.name)).toContain('FinanceGuardian');
      expect(finance.map(m => m.name)).toContain('DigitalOfficeManager');
      expect(finance.map(m => m.name)).toContain('GrantHunter');
    });

    it('should have 4 HR modules', () => {
      const hr = moduleRegistry.getModulesByCategory('hr');
      expect(hr).toHaveLength(4);
      expect(hr.map(m => m.name)).toContain('HeadHunterAgent');
      expect(hr.map(m => m.name)).toContain('ConflictMediatorAgent');
      expect(hr.map(m => m.name)).toContain('LocalCSRBot');
      expect(hr.map(m => m.name)).toContain('SentimentAnalysisModule');
    });

    it('should have 3 Logistics modules', () => {
      const logistics = moduleRegistry.getModulesByCategory('logistics');
      expect(logistics).toHaveLength(3);
      expect(logistics.map(m => m.name)).toContain('LogisticsDispatcher');
      expect(logistics.map(m => m.name)).toContain('KnowledgeBuilder');
      expect(logistics.map(m => m.name)).toContain('ProactiveClaimsAgent');
    });

    it('should have correct module statistics', () => {
      const stats = moduleRegistry.getStats();
      expect(stats.totalModules).toBeGreaterThanOrEqual(13);
      expect(stats.byCategory.sales).toBe(3);
      expect(stats.byCategory.finance).toBe(3);
      expect(stats.byCategory.hr).toBe(4);
      expect(stats.byCategory.logistics).toBe(3);
    });
  });

  // ========================================================================
  // Module Information Tests
  // ========================================================================

  describe('Module Information', () => {
    it('should expose module registry for API', () => {
      const modules = moduleRegistry.getAllModules();
      expect(modules).toBeInstanceOf(Array);
      expect(modules.length).toBeGreaterThan(0);

      // Each module should have required fields
      modules.forEach((module) => {
        expect(module.name).toBeDefined();
        expect(module.category).toBeDefined();
        expect(module.keywords).toBeDefined();
        expect(module.priority).toBeDefined();
      });
    });

    it('should have unique module names', () => {
      const modules = moduleRegistry.getAllModules();
      const names = modules.map((m) => m.name);
      const uniqueNames = new Set(names);
      expect(uniqueNames.size).toBe(names.length);
    });

    it('should have valid priority scores', () => {
      const modules = moduleRegistry.getAllModules();
      modules.forEach((module) => {
        expect(module.priority).toBeGreaterThan(0);
        expect(module.priority).toBeLessThanOrEqual(10);
      });
    });

    it('should have meaningful keywords for each module', () => {
      const modules = moduleRegistry.getAllModules();
      modules.forEach((module) => {
        expect(module.keywords.length).toBeGreaterThan(0);
        expect(Array.isArray(module.keywords)).toBe(true);
      });
    });

    it('should have module descriptions', () => {
      const modules = moduleRegistry.getAllModules();
      modules.forEach((module) => {
        expect(module.description).toBeDefined();
        expect(module.description!.length).toBeGreaterThan(0);
      });
    });
  });

  // ========================================================================
  // Module Lookup Tests
  // ========================================================================

  describe('Module Lookup', () => {
    it('should find module by name', () => {
      const sales = moduleRegistry.getModule('SalesAgent');
      expect(sales).toBeDefined();
      expect(sales!.category).toBe('sales');
    });

    it('should return undefined for non-existent module', () => {
      const module = moduleRegistry.getModule('NonExistentModule');
      expect(module).toBeUndefined();
    });

    it('should retrieve all sales modules', () => {
      const sales = moduleRegistry.getModulesByCategory('sales');
      expect(sales.length).toBe(3);
    });

    it('should retrieve all finance modules', () => {
      const finance = moduleRegistry.getModulesByCategory('finance');
      expect(finance.length).toBe(3);
    });

    it('should retrieve all HR modules', () => {
      const hr = moduleRegistry.getModulesByCategory('hr');
      expect(hr.length).toBe(4);
    });

    it('should retrieve all logistics modules', () => {
      const logistics = moduleRegistry.getModulesByCategory('logistics');
      expect(logistics.length).toBe(3);
    });
  });

  // ========================================================================
  // Integration Summary
  // ========================================================================

  it('should validate complete enterprise suite readiness', () => {
    const modules = moduleRegistry.getAllModules();
    const stats = moduleRegistry.getStats();

    // Verify Phase 1-5 completion
    expect(modules.length).toBeGreaterThanOrEqual(13);
    expect(stats.totalModules).toBeGreaterThanOrEqual(13);
    expect(stats.categories).toHaveLength(4);

    // Verify category distribution
    const byCategory = stats.byCategory as Record<string, number>;
    expect(byCategory.sales).toBe(3);
    expect(byCategory.finance).toBe(3);
    expect(byCategory.hr).toBe(4);
    expect(byCategory.logistics).toBe(3);
  });
});
