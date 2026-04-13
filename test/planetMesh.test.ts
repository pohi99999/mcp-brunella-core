/**
 * test/planetMesh.test.ts
 *
 * Unit tesztek a Planet Mesh komponensekhez
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PlanetMesh, RegionConfig, MeshNode } from '../src/mesh/planetMesh.js';

describe('PlanetMesh Component', () => {
  let mesh: PlanetMesh;

  beforeEach(() => {
    mesh = new PlanetMesh();
  });

  it('should initialize with local-core region', () => {
    const regions = mesh.getRegions();
    expect(regions).toHaveLength(1);
    expect(regions[0].regionId).toBe('local-core');
  });

  it('should register and route a new node correctly', () => {
    const node: MeshNode = {
      nodeId: 'worker-1',
      regionId: 'local-core',
      agentType: 'data_engineer',
      capacity: 10
    };

    mesh.registerNode(node);
    
    const route = mesh.routeRequest('data_engineer', 'local-core');
    expect(route).toBeDefined();
    expect(route?.targetNodeId).toBe('worker-1');
  });

  it('should return null if agentType is not available', () => {
    const route = mesh.routeRequest('non_existent_agent', 'local-core');
    expect(route).toBeNull();
  });
});
