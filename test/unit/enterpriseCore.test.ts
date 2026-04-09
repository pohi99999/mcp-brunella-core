import { describe, it, expect, vi, beforeEach } from 'vitest';
import { eventStore } from '../../src/core/eventStore.js';
import { commandBus } from '../../src/core/commandBus.js';
import { businessPolicies } from '../../src/core/businessPolicies.js';
import { runWithContext, getContext } from '../../src/core/ambientContext.js';
import { agentRateLimiter } from '../../src/core/agentRateLimiter.js';

import { POLICIES } from '../../src/core/businessPolicies.js';

import { sagaOrchestrator } from '../../src/core/sagaOrchestrator.js';
import { selfDiagnostics } from '../../src/core/selfDiagnostics.js';

// Mock auditLog to avoid real DB access
vi.mock('../../src/core/auditLog.js', () => ({
  getAuditDb: vi.fn().mockResolvedValue({
    prepare: vi.fn().mockReturnValue({
      run: vi.fn(),
      all: vi.fn().mockReturnValue([]),
      get: vi.fn(),
    })
  })
}));

describe('Enterprise Core Patterns', () => {
  
  describe('SagaOrchestrator', () => {
    it('should execute saga steps sequentially', async () => {
      const step1 = { name: 'step1', execute: vi.fn().mockResolvedValue(undefined) };
      const step2 = { name: 'step2', execute: vi.fn().mockResolvedValue(undefined) };
      
      await sagaOrchestrator.execute({ id: 'saga-1', steps: [step1, step2] });
      
      expect(step1.execute).toHaveBeenCalled();
      expect(step2.execute).toHaveBeenCalled();
    });

    it('should run compensation on failure', async () => {
      const step1 = { 
        name: 'step1', 
        execute: vi.fn().mockResolvedValue(undefined),
        compensate: vi.fn().mockResolvedValue(undefined)
      };
      const step2 = { 
        name: 'step2', 
        execute: vi.fn().mockRejectedValue(new Error('fail')) 
      };
      
      await expect(sagaOrchestrator.execute({ id: 'saga-fail', steps: [step1, step2] }))
        .rejects.toThrow('fail');
        
      expect(step1.compensate).toHaveBeenCalled();
    });
  });

  describe('SelfDiagnostics', () => {
    it('should return a report with issues', async () => {
      const report = await selfDiagnostics.runFullDiagnosis();
      expect(report.healthy).toBeGreaterThan(0);
      expect(report.degraded).toBeGreaterThan(0); // Because checkN8N is mocked to fail
      expect(report.recommendation).toContain('n8n');
    });
  });

  describe('AmbientContext', () => {
    it('should maintain context across execution', () => {
      runWithContext({ sessionId: 'session-123', userId: 'user-456' }, () => {
        const ctx = getContext();
        expect(ctx?.sessionId).toBe('session-123');
        expect(ctx?.userId).toBe('user-456');
        expect(ctx?.correlationId).toBeDefined();
      });
    });

    it('should nest contexts correctly', () => {
      runWithContext({ sessionId: 'outer' }, () => {
        expect(getContext()?.sessionId).toBe('outer');
        runWithContext({ sessionId: 'inner' }, () => {
          expect(getContext()?.sessionId).toBe('inner');
        });
        expect(getContext()?.sessionId).toBe('outer');
      });
    });
  });

  describe('BusinessPolicies', () => {
    it('should evaluate invoice approval correctly', () => {
      expect(POLICIES.invoice_approval.evaluate(10000)).toBe('auto');
      expect(POLICIES.invoice_approval.evaluate(100000)).toBe('manager');
      expect(POLICIES.invoice_approval.evaluate(1000000)).toBe('board');
    });

    it('should evaluate lead priority correctly', () => {
      expect(POLICIES.lead_priority.evaluate(90)).toBe('hot');
      expect(POLICIES.lead_priority.evaluate(60)).toBe('warm');
      expect(POLICIES.lead_priority.evaluate(20)).toBe('cold');
    });
  });

  describe('AgentRateLimiter', () => {
    it('should allow execution within limits', () => {
      const limiter = agentRateLimiter;
      expect(limiter.canExecute('TestAgent', { perMinute: 5, perHour: 10 })).toBe(true);
    });

    it('should block execution exceeding limits', () => {
      const limiter = agentRateLimiter;
      // Use a new name to avoid state from previous test if not reset (though it's a singleton)
      const name = 'LimitedAgent';
      for(let i=0; i<5; i++) {
        limiter.canExecute(name, { perMinute: 5, perHour: 10 });
      }
      expect(limiter.canExecute(name, { perMinute: 5, perHour: 10 })).toBe(false);
    });
  });

  describe('EventStore & CommandBus', () => {
    it('should dispatch command and append event', async () => {
      const handler = vi.fn().mockResolvedValue({ ok: true });
      commandBus.register('test:cmd', handler);
      
      const cmd = {
        id: 'cmd-1',
        type: 'test:cmd',
        payload: { foo: 'bar' },
        toEvent: (res: any) => ({
          id: 'evt-1',
          type: 'test:evt',
          aggregateId: 'agg-1',
          payload: res,
          metadata: { timestamp: Date.now(), version: 1 }
        })
      };

      const result = await commandBus.dispatch(cmd as any);
      expect(result.ok).toBe(true);
      expect(handler).toHaveBeenCalled();
    });
  });
});
