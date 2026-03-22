import { describe, it, expect, beforeEach } from 'vitest';
import { SwarmManager } from '../src/agents/swarm/SwarmManager.js';
import { SwarmAgent } from '../src/agents/swarm/SwarmAgent.js';

describe('SwarmManager', () => {
  let manager: SwarmManager;

  beforeEach(() => {
    manager = new SwarmManager();
  });

  it('pauseAllColonies sets all active colonies to paused', () => {
    manager.createColony({ swarmId: 'c1', name: 'Alpha', objective: 'test' });
    manager.createColony({ swarmId: 'c2', name: 'Beta', objective: 'test' });
    // Force active status
    manager.getColony('c1')!.status = 'active';
    manager.getColony('c2')!.status = 'active';

    manager.pauseAllColonies();

    expect(manager.getColony('c1')!.status).toBe('paused');
    expect(manager.getColony('c2')!.status).toBe('paused');
  });

  it('resumeAllColonies restores paused colonies to active', () => {
    manager.createColony({ swarmId: 'c1', name: 'Alpha', objective: 'test' });
    manager.getColony('c1')!.status = 'paused';

    manager.resumeAllColonies();

    expect(manager.getColony('c1')!.status).toBe('active');
  });

  it('dissolved colony is not affected by pause/resume', () => {
    manager.createColony({ swarmId: 'c1', name: 'Alpha', objective: 'test' });
    manager.getColony('c1')!.status = 'dissolved';

    manager.pauseAllColonies();
    expect(manager.getColony('c1')!.status).toBe('dissolved');

    manager.resumeAllColonies();
    expect(manager.getColony('c1')!.status).toBe('dissolved');
  });

  it('createTriadColony creates colony with researcher/DataScientist/Developer', () => {
    const config = SwarmManager.getTriadConfig();
    expect(config.name).toBe('Triad');
    expect(config.agentIds).toContain('researcher');
    expect(config.agentIds).toContain('DataScientist');
    expect(config.agentIds).toContain('Developer');
  });
});
