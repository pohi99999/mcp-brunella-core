import { describe, it } from 'node:test';
import assert from 'node:assert';
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
    assert.strictEqual(isTelemetryEnabled(), false);
  });

  it('enabled when configured', () => {
    configureTelemetry({ enabled: true, target: 'local' });
    assert.strictEqual(isTelemetryEnabled(), true);
    configureTelemetry({ enabled: false });
    assert.strictEqual(isTelemetryEnabled(), false);
  });

  it('recordEvent does not throw when disabled', () => {
    configureTelemetry({ enabled: false });
    assert.doesNotThrow(() => recordEvent('test.event', { k: 'v' }));
  });

  it('recordMetric does not throw when disabled', () => {
    configureTelemetry({ enabled: false });
    assert.doesNotThrow(() => recordMetric('test.metric', 1, {}));
  });

  it('getTelemetryConfig returns current config', () => {
    configureTelemetry({ enabled: true, target: 'local', logPrompts: false });
    const c = getTelemetryConfig();
    assert.strictEqual(c.enabled, true);
    assert.strictEqual(c.target, 'local');
    assert.strictEqual(c.logPrompts, false);
  });

  it('initTelemetryFromConfig accepts nested telemetry object', () => {
    initTelemetryFromConfig({ telemetry: { enabled: true, target: 'local' } });
    assert.strictEqual(isTelemetryEnabled(), true);
    configureTelemetry({ enabled: false });
  });

  it('flushTelemetry does not throw', () => {
    assert.doesNotThrow(() => flushTelemetry());
  });
});
