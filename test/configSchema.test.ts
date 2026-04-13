/**
 * Config Schema Validation Tests (P5)
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { z } from 'zod';
import { ConfigSchema } from '../src/config/schema.js';

describe('Config Validation (P5)', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // Reset environment before each test
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
  });

  // ────────── Schema Validation ──────────

  describe('ConfigSchema', () => {
    it('should validate with default values', () => {
      const config = ConfigSchema.parse({});
      expect(config.port).toBe(3000);
      expect(config.nodeEnv).toBe('development');
      expect(config.ollamaBaseUrl).toBe('http://localhost:11434');
      expect(config.pythonBaseUrl).toBe('http://localhost:8000');
    });

    it('should parse port as number', () => {
      const config = ConfigSchema.parse({ port: '5000' });
      expect(config.port).toBe(5000);
      expect(typeof config.port).toBe('number');
    });

    it('should validate URL format for ollamaBaseUrl', () => {
      expect(() =>
        ConfigSchema.parse({ ollamaBaseUrl: 'not-a-url' })
      ).toThrow(/Invalid URL/);
    });

    it('should validate URL format for pythonBaseUrl', () => {
      expect(() =>
        ConfigSchema.parse({ pythonBaseUrl: 'invalid' })
      ).toThrow(/Invalid URL/);
    });

    it('should enforce nodeEnv enum', () => {
      expect(() =>
        ConfigSchema.parse({ nodeEnv: 'staging' })
      ).toThrow();

      const config = ConfigSchema.parse({ nodeEnv: 'production' });
      expect(config.nodeEnv).toBe('production');
    });

    it('should allow optional fields to be undefined', () => {
      const config = ConfigSchema.parse({});
      expect(config.geminiApiKey).toBeUndefined();
      expect(config.githubToken).toBeUndefined();
      expect(config.langchainApiKey).toBeUndefined();
    });

    it('should accept valid optional fields', () => {
      const config = ConfigSchema.parse({
        geminiApiKey: 'test-key',
        githubToken: 'ghp_token',
        ollamaModel: 'llama3.1:8b',
      });

      expect(config.geminiApiKey).toBe('test-key');
      expect(config.githubToken).toBe('ghp_token');
      expect(config.ollamaModel).toBe('llama3.1:8b');
    });

    it('should reject negative port numbers', () => {
      expect(() =>
        ConfigSchema.parse({ port: -1 })
      ).toThrow();
    });

    it('should reject non-integer port numbers', () => {
      expect(() =>
        ConfigSchema.parse({ port: 3000.5 })
      ).toThrow();
    });
  });

  // ────────── Error Messages ──────────

  describe('Error Formatting', () => {
    it('should provide clear error for invalid URL', () => {
      try {
        ConfigSchema.parse({ ollamaBaseUrl: 'not a url at all' });
        expect.fail('Should have thrown');
      } catch (e) {
        expect(e).toBeInstanceOf(z.ZodError);
        const zodError = e as z.ZodError;
        expect(zodError.issues[0].path).toContain('ollamaBaseUrl');
        expect(zodError.issues[0].message).toContain('URL');
      }
    });

    it('should provide clear error for invalid enum', () => {
      try {
        ConfigSchema.parse({ nodeEnv: 'invalid' });
        expect.fail('Should have thrown');
      } catch (e) {
        expect(e).toBeInstanceOf(z.ZodError);
        const zodError = e as z.ZodError;
        expect(zodError.issues[0].path).toContain('nodeEnv');
      }
    });
  });

  // ────────── Defaults ──────────

  describe('Default Values', () => {
    it('should use default geminiModel if not provided', () => {
      const config = ConfigSchema.parse({});
      expect(config.geminiModel).toBe('gemini-2.5-flash');
    });

    it('should use default githubModel if not provided', () => {
      const config = ConfigSchema.parse({});
      expect(config.githubModel).toBe('gpt-4.1');
    });

    it('should use process.cwd() as default workspaceRoot', () => {
      const config = ConfigSchema.parse({});
      expect(config.workspaceRoot).toBe(process.cwd());
    });
  });

  // ────────── Type Coercion ──────────

  describe('Type Coercion', () => {
    it('should coerce string port to number', () => {
      const config = ConfigSchema.parse({ port: '8080' });
      expect(config.port).toBe(8080);
      expect(typeof config.port).toBe('number');
    });

    it('should handle port from environment variable simulation', () => {
      // Simulating ENV var behavior (always strings)
      const config = ConfigSchema.parse({ port: '3456' });
      expect(config.port).toBe(3456);
    });
  });
});
