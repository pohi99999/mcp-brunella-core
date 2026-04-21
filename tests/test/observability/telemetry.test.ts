/**
 * Observability Phase 1: OpenTelemetry Helpers Tests
 * Track: observability_opentelemetry_20260323
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getTracer, wrapWithSpan } from '../../src/utils/otelTracing.js';

describe('getTracer()', () => {
  it('returns a tracer object', () => {
    const tracer = getTracer('test-tracer');
    expect(tracer).toBeDefined();
    expect(typeof tracer.startActiveSpan).toBe('function');
    expect(typeof tracer.startSpan).toBe('function');
  });

  it('returns different tracers for different names', () => {
    const tracer1 = getTracer('tracer-a');
    const tracer2 = getTracer('tracer-b');
    expect(tracer1).toBeDefined();
    expect(tracer2).toBeDefined();
  });
});

describe('wrapWithSpan()', () => {
  it('returns the result of the wrapped function', async () => {
    const result = await wrapWithSpan(
      'test',
      'test.operation',
      { 'test.key': 'value' },
      async () => 42,
    );
    expect(result).toBe(42);
  });

  it('propagates errors from the wrapped function', async () => {
    await expect(
      wrapWithSpan(
        'test',
        'test.error',
        { 'test.key': 'value' },
        async () => {
          throw new Error('test error');
        },
      ),
    ).rejects.toThrow('test error');
  });

  it('passes span to the function for custom attributes', async () => {
    const result = await wrapWithSpan(
      'test',
      'test.custom',
      { 'test.init': 'yes' },
      async (span) => {
        span.setAttribute('test.custom', 'attr');
        return 'with-span';
      },
    );
    expect(result).toBe('with-span');
  });
});
