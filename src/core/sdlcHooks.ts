// src/core/sdlcHooks.ts
// SDLC fázis quality gate — EPP v2 enforce
import { registerHook } from './agentHookEngine.js';
import { logInfo, logError } from '../utils/logger.js';
import fs from 'fs';
import path from 'path';

/**
 * SDLC fázisok közötti szabályok betartatása.
 */
export function initializeSdlcHooks() {
  logInfo('SDLCHooks', 'Initializing SDLC quality gate hooks...');

  registerHook('sdlc:phase:before', async (ctx) => {
    const { agentName, task } = ctx; // task = phase name, agentName = trackId
    
    logInfo('SDLCHooks', `Checking quality gate for phase: ${task} on track: ${agentName}`);

    if (task === 'coder') {
      // Szabály: Coder fázis csak akkor indulhat, ha az Architect kész
      try {
        const metaPath = path.join(process.cwd(), `conductor/tracks/${agentName}/meta.json`);
        if (fs.existsSync(metaPath)) {
          const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
          
          if (meta.sdlc?.phases?.architect?.status !== 'completed') {
            throw new Error(`❌ Architect fázis nem teljesült a '${agentName}' tracken!`);
          }
          logInfo('SDLCHooks', `Quality gate passed for 'coder' phase.`);
        }
      } catch (e) {
        logError('SDLCHooks', `SDLC Gate Error: ${e instanceof Error ? e.message : String(e)}`);
        throw e; // Megállítjuk a fázisváltást
      }
    }
  }, { priority: 'critical' });
}
