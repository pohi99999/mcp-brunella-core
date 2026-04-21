import { describe, it, expect, vi, beforeEach } from 'vitest';
import { registerHook, fireHook, clearHooks } from '../src/core/agentHookEngine.js';
import { wrapToolWithHooks } from '../src/core/mcpToolHook.js';
import { initializeSdlcHooks } from '../src/core/sdlcHooks.js';
import fs from 'fs';
import path from 'path';

describe('BAS Hook Infrastructure', () => {
  beforeEach(() => {
    clearHooks();
  });

  describe('AgentHookEngine', () => {
    it('should fire lifecycle hooks with correct context', async () => {
      const spy = vi.fn();
      registerHook('agent:test', spy);

      await fireHook('agent:test', { 
        agentName: 'TestAgent', 
        task: 'unit test' 
      });

      expect(spy).toHaveBeenCalledWith(expect.objectContaining({
        agentName: 'TestAgent',
        task: 'unit test'
      }));
    });
  });

  describe('MCP Tool Hooks', () => {
    it('should wrap tools and fire before/after hooks', async () => {
      const beforeSpy = vi.fn();
      const afterSpy = vi.fn();
      
      registerHook('tool:before', beforeSpy);
      registerHook('tool:after', afterSpy);

      const mockHandler = vi.fn().mockResolvedValue({ success: true });
      const wrapped = wrapToolWithHooks('test_tool', mockHandler);

      const result = await wrapped({ param: 'value' });

      expect(result.success).toBe(true);
      expect(beforeSpy).toHaveBeenCalled();
      expect(afterSpy).toHaveBeenCalledWith(expect.objectContaining({
        agentName: 'test_tool',
        result: { success: true }
      }));
    });
  });

  describe('SDLC Hooks', () => {
    it('should enforce architect completion before coder phase', async () => {
      clearHooks();
      initializeSdlcHooks();
      
      // Mock meta.json check
      vi.spyOn(fs, 'existsSync').mockReturnValue(true);
      vi.spyOn(fs, 'readFileSync').mockReturnValue(JSON.stringify({
        sdlc: {
          phases: {
            architect: { status: 'pending' } // Not completed
          }
        }
      }));

      const errors = await fireHook('sdlc:phase:before', {
        agentName: 'test-track',
        task: 'coder'
      });

      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].message).toContain('Architect fázis nem teljesült');
    });
  });
});
