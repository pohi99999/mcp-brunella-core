import { registerHook, fireHook } from './agentHookEngine.js';
import { phoenixEventBus } from './phoenixEventBus.js';
import { logInfo } from '@packages/utils/logger.js';

/**
 * PhoenixHookBridge - Összeköti a Hook Engine-t a Phoenix Protocol-al.
 * Lehetővé teszi az öngyógyító folyamatok indítását hook események alapján.
 */
logInfo('PhoenixHookBridge', 'Initializing Phoenix-Hook Bridge...');

// 1. Ügynök hiba esetén értesítjük a Phoenix-et
registerHook('agent:task:failed', async (payload: any) => {
  const { agentName, error, task } = payload;
  
  logInfo('PhoenixHookBridge', `Relaying failure for ${agentName} to Phoenix Event Bus.`);
  
  phoenixEventBus.publish('phoenix:agent_failed', {
    agentName,
    taskInstruction: task || 'Unknown task',
    error: error || 'Unknown error',
    retriesExhausted: payload.retriesExhausted || 0,
    timestamp: new Date().toISOString()
  });
});

// 2. Rendszer helyreállás esetén hook trigger
phoenixEventBus.subscribe('phoenix:recovery', (event) => {
  fireHook('system:recovered', { 
    agentName: 'Phoenix',
    task: 'recovery',
    type: event.type, 
    timestamp: Date.now() 
  });
});

