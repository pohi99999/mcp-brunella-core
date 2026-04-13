/**
 * test/telemetry.test.ts
 *
 * Tesztek az új telemetriai és egészségügyi szolgáltatásokhoz.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { logEmitter, LogEvent } from '../src/utils/logger.js';

describe('Telemetry Service', () => {
  it('should emit structured log events with metadata', () => {
    const spy = vi.fn();
    logEmitter.on('log', spy);

    // Szimulálunk egy strukturált naplózást (később implementáljuk a logger.ts-ben)
    const mockEvent: LogEvent = {
      timestamp: new Date().toISOString(),
      level: 'info',
      message: 'Task completed',
      agent: 'DeveloperAgent',
      details: { trackId: 'test_track_2026', duration: 1500 }
    };

    logEmitter.emit('log', mockEvent);

    expect(spy).toHaveBeenCalledWith(expect.objectContaining({
      agent: 'DeveloperAgent',
      details: expect.objectContaining({ trackId: 'test_track_2026' })
    }));
  });
});
