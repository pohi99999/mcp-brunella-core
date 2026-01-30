import { describe, it, expect } from 'vitest';
import {
  configureTelemetry,
  isTelemetryEnabled,
  recordEvent,
  recordMetric,
  getTelemetryConfig,
  initTelemetryFromConfig,
  flushTelemetry
} from '../src/utils/telemetry.js';

describe('Telemetry', () => {
  it('disabled by default', () => {
    configureTelemetry({ enabled: false });
    expect(isTelemetryEnabled()).toBe(false);
  });

  it('enabled when configured', () => {
    configureTelemetry({ enabled: true, target: 'local' });
    expect(isTelemetryEnabled()).toBe(true);
    configureTelemetry({ enabled: false });
    expect(isTelemetryEnabled()).toBe(false);
  });

  it('recordEvent does not throw when disabled', () => {
    configureTelemetry({ enabled: false });
    expect(() => recordEvent('test.event', { k: 'v' })).not.toThrow();
  });

  it('recordMetric does not throw when disabled', () => {
    configureTelemetry({ enabled: false });
    expect(() => recordMetric('test.metric', 1, {})).not.toThrow();
  });

  it('getTelemetryConfig returns current config', () => {
    configureTelemetry({ enabled: true, target: 'local', logPrompts: false });
    const c = getTelemetryConfig();
    expect(c.enabled).toBe(true);
    expect(c.target).toBe('local');
    expect(c.logPrompts).toBe(false);
  });

  it('initTelemetryFromConfig accepts nested telemetry object', () => {
    initTelemetryFromConfig({ telemetry: { enabled: true, target: 'local' } });
    expect(isTelemetryEnabled()).toBe(true);
    configureTelemetry({ enabled: false });
  });

  it('flushTelemetry does not throw', () => {
    expect(() => flushTelemetry()).not.toThrow();
  });
});