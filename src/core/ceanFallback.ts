/**
 * CEAN Fallback — Phoenix Protocol CEAN Edge Failover (Task 10)
 *
 * Hooks into PhoenixEventBus to automatically switch BifrostGateway
 * to edge-only mode when Ollama degrades, and restore local-preferred
 * mode on recovery.
 *
 * This is a side-effect module: import it once at app startup.
 *
 * @version 1.0.0
 */

import { phoenixEventBus } from './phoenixEventBus.js';
import { bifrostGateway } from './bifrost_gateway.js';
import { swarmManager } from '../agents/AgentManager.js';
import { eventBus } from './eventBus.js';
import { saveCheckpoint } from './checkpoint.js';
import { logInfo } from '../utils/logger.js';

// ---------------------------------------------------------------------------
// FAILOVER HANDLER — phoenix:degraded
// ---------------------------------------------------------------------------

phoenixEventBus.subscribe('phoenix:degraded', async (_event) => {
  logInfo('CeanFallback', 'Phoenix degraded — switching to edge-only mode');

  // Save a checkpoint so we can resume after recovery
  await saveCheckpoint('cean-failover', 0, 'pre-edge-failover', {
    previousMode: bifrostGateway.getMode(),
    timestamp: new Date().toISOString(),
  });

  bifrostGateway.setMode('edge-only');
  swarmManager.pauseAllColonies();

  eventBus.emit({
    source: 'CeanFallback',
    type: 'system.failover',
    payload: { target: 'edge' },
  });
});

// ---------------------------------------------------------------------------
// RECOVERY HANDLER — phoenix:recovery
// ---------------------------------------------------------------------------

phoenixEventBus.subscribe('phoenix:recovery', async (_event) => {
  logInfo('CeanFallback', 'Phoenix recovered — restoring local-preferred mode');

  bifrostGateway.setMode('local-preferred');
  swarmManager.resumeAllColonies();

  eventBus.emit({
    source: 'CeanFallback',
    type: 'system.recovered',
    payload: {},
  });
});

logInfo('CeanFallback', 'CEAN Phoenix fallback handlers registered');
