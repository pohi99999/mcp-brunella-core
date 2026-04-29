import { describe, expect, it } from 'vitest';
import { formatAgentResponse } from '@/lib/agentResponseFormatter.js';

describe('agentResponseFormatter', () => {
  it('formats success responses with translated keys', () => {
    const formatted = formatAgentResponse({
      status: 'success',
      data: {
        message: 'Kész',
        result: 'ok',
      },
    }, 'TestAgent');

    expect(formatted).toContain('✅ Művelet sikeres:');
    expect(formatted).toContain('• üzenet: Kész');
    expect(formatted).toContain('• eredmény: ok');
  });

  it('formats error responses consistently', () => {
    const formatted = formatAgentResponse({
      status: 'error',
      error: 'Nem található az ügynök',
    });

    expect(formatted).toBe('❌ Hiba: Nem található az ügynök');
  });

  it('formats health checks safely', () => {
    const formatted = formatAgentResponse({
      data: {
        status: 'HEALTHY',
        components: {
          api: { status: 'healthy', latencyMs: 12 },
          worker: { status: 'error', latencyMs: 31 },
        },
        recommendation: 'System is nominal.',
      },
    }, 'Evaluator');

    expect(formatted).toContain('✅ Rendszer állapot: Egészséges');
    expect(formatted).toContain('🟢 api: működik (12ms)');
    expect(formatted).toContain('🔴 worker: hiba (31ms)');
    expect(formatted).toContain('A rendszer normálisan működik.');
  });

  it('formats delegated responses and primitive fallbacks', () => {
    const delegated = formatAgentResponse({
      status: 'delegated',
      delegatedTo: 'DeveloperAgent',
      reason: 'Kódírás szükséges',
    });

    expect(delegated).toContain('🔄 Feladat delegálva → DeveloperAgent');
    expect(delegated).toContain('Indok: Kódírás szükséges');
    expect(formatAgentResponse(null)).toBe('null');
    expect(formatAgentResponse(42)).toBe('42');
  });
});
