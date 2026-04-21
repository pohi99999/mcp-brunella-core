/**
 * Phase 3 Tests: PII & Secret Redaction
 * Track: guardrails_evaluation_20260323
 */
import { describe, it, expect } from 'vitest';
import { redactText, redactObject, safeRedactAgentOutput } from '../../src/security/redactor.js';

describe('redactText()', () => {
  it('redacts email addresses', () => {
    const result = redactText('Küldj emailt ide: john@example.com és ide: test.user@domain.co.uk');
    expect(result.redacted).toContain('[EMAIL_REDACTED]');
    expect(result.redacted).not.toContain('john@example.com');
    expect(result.hadFindings).toBe(true);
    expect(result.findings.some(f => f.type === 'email')).toBe(true);
  });

  it('redacts Hungarian phone numbers', () => {
    const result = redactText('Hívj: +36-30-123-4567 vagy 06 20 234 5678');
    expect(result.redacted).toContain('[PHONE_REDACTED]');
    expect(result.redacted).not.toContain('+36-30-123-4567');
  });

  it('redacts IP addresses', () => {
    const result = redactText('A szerver IP: 192.168.1.100');
    expect(result.redacted).toContain('[IP_REDACTED]');
  });

  it('redacts API keys', () => {
    const result = redactText('api_key: sk_fake_XXXXXXXXXXXXXXXXXXXXXXXX');
    expect(result.redacted).toContain('[API_KEY_REDACTED]');
  });

  it('redacts bearer tokens', () => {
    const result = redactText('Authorization: Bearer eyJhbGciOiJIUzI1NiJ9.payload.signature');
    expect(result.redacted).toContain('[TOKEN_REDACTED]');
  });

  it('redacts GitHub tokens', () => {
    const result = redactText('Use token: ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghij');
    expect(result.redacted).toContain('[GITHUB_TOKEN_REDACTED]');
  });

  it('redacts OpenAI keys', () => {
    const result = redactText('Use this: sk-abcdefghijklmnopqrstuv');
    expect(result.redacted).toContain('[OPENAI_KEY_REDACTED]');
  });

  it('redacts connection strings', () => {
    const result = redactText('DB: mongodb://user:pass@host:27017/db');
    expect(result.redacted).toContain('[CONNECTION_STRING_REDACTED]');
  });

  it('returns clean text unchanged', () => {
    const clean = 'Ez egy teljesen normális szöveg.';
    const result = redactText(clean);
    expect(result.redacted).toBe(clean);
    expect(result.hadFindings).toBe(false);
  });

  it('handles multiple PII types in one text', () => {
    const result = redactText('Email: test@ex.com, IP: 10.0.0.1, Token: ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZ123456789a');
    expect(result.findings.length).toBeGreaterThanOrEqual(3);
  });
});

describe('redactObject()', () => {
  it('deep-redacts nested objects', () => {
    const obj = {
      user: { email: 'test@example.com', name: 'Teszt Elek' },
      config: { apiKey: 'api_key: sk_live_ABCDEFGHIJKLMNOPQRSTUV' },
    };
    const { redacted, allFindings } = redactObject(obj);
    expect((redacted as any).user.email).toContain('[EMAIL_REDACTED]');
    expect((redacted as any).config.apiKey).toContain('[API_KEY_REDACTED]');
    expect(allFindings.length).toBeGreaterThanOrEqual(2);
  });

  it('handles arrays', () => {
    const arr = ['john@test.com', 'clean text', 'Bearer abc123.def456.ghi789'];
    const { redacted } = redactObject(arr);
    expect((redacted as string[])[0]).toContain('[EMAIL_REDACTED]');
    expect((redacted as string[])[1]).toBe('clean text');
  });
});

describe('safeRedactAgentOutput()', () => {
  it('soft-fails on null input', () => {
    const result = safeRedactAgentOutput(null, 'TestAgent');
    expect(result).toBeNull();
  });

  it('returns redacted object for valid input', () => {
    const data = { message: 'Sent to test@example.com' };
    const result = safeRedactAgentOutput(data, 'TestAgent');
    expect(result.message).toContain('[EMAIL_REDACTED]');
  });
});
