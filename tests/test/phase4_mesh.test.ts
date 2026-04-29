/**
 * Phase 4: Distributed Mesh & Edge Routing — Unit Tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MeshNode } from '@packages/core-logic/meshNode.js';
import { MeshManager } from '@packages/core-logic/meshManager.js';
import { EdgeRouter } from '@packages/core-logic/edgeRouter.js';
import { DeviceOrchestrator } from '@packages/core-logic/deviceOrchestrator.js';
import { OfflineSync } from '@packages/core-logic/offlineSync.js';
import { PhoenixReplication } from '@packages/core-logic/phoenixReplication.js';
import { FederatedAgentManager } from '@packages/agents/federation/FederatedAgentManager.js';
import { AutoJoin } from '@packages/core-logic/autoJoin.js';
import { generateKeyPairSync } from 'crypto';
import { inspectFederationPublicKey } from '@packages/core-logic/federationPeerProof.js';
import { phoenixEventBus } from '@packages/core-logic/phoenixEventBus.js';

// ─── MeshNode ────────────────────────────────────────────────────────────────

describe('MeshNode', () => {
  let node: MeshNode;

  beforeEach(() => {
    node = new MeshNode({
      nodeId: 'test-node-1',
      label: 'Test Node',
      host: 'http://localhost:3001',
      region: 'eu-west',
    });
  });

  afterEach(() => {
    node.stop();
  });

  it('should initialize with joining status', () => {
    expect(node.nodeId).toBe('test-node-1');
    expect(node.status).toBe('joining');
    expect(node.capabilities).toEqual([]);
  });

  it('should go online when started', () => {
    node.start(['chat', 'search']);
    expect(node.status).toBe('online');
    expect(node.capabilities).toEqual(['chat', 'search']);
    expect(node.joinedAt).toBeGreaterThan(0);
  });

  it('should go offline when stopped', () => {
    node.start(['chat']);
    node.stop();
    expect(node.status).toBe('offline');
  });

  it('should update capabilities', () => {
    node.start(['chat']);
    node.updateCapabilities(['chat', 'browser', 'llm']);
    expect(node.capabilities).toEqual(['chat', 'browser', 'llm']);
  });

  it('should serialize to MeshNodeInfo', () => {
    node.start(['chat']);
    const info = node.toInfo();
    expect(info.nodeId).toBe('test-node-1');
    expect(info.label).toBe('Test Node');
    expect(info.host).toBe('http://localhost:3001');
    expect(info.region).toBe('eu-west');
    expect(info.status).toBe('online');
  });

  it('should emit heartbeat events', async () => {
    vi.useFakeTimers();
    const heartbeats: unknown[] = [];
    node.on('heartbeat', (info) => heartbeats.push(info));
    node.start(['chat']);

    vi.advanceTimersByTime(15_001);
    expect(heartbeats.length).toBe(1);

    vi.useRealTimers();
    node.stop();
  });

  it('should detect stale state', () => {
    node.start(['chat']);
    expect(node.isStale()).toBe(false);
    // Force stale by manipulating internal state
    (node as any)._lastHeartbeat = Date.now() - 50_000;
    expect(node.isStale()).toBe(true);
  });
});

// ─── MeshManager ─────────────────────────────────────────────────────────────

describe('MeshManager', () => {
  let localNode: MeshNode;
  let manager: MeshManager;

  beforeEach(() => {
    localNode = new MeshNode({
      nodeId: 'local',
      label: 'Local',
      host: 'http://localhost:3000',
    });
    localNode.start(['chat']);
    manager = new MeshManager(localNode);
    manager.start();
  });

  afterEach(() => {
    manager.stop();
    localNode.stop();
  });

  it('should register and list peers', () => {
    manager.registerPeer({
      nodeId: 'peer-1',
      label: 'Peer 1',
      host: 'http://192.168.1.10:3000',
      capabilities: ['search', 'browser'],
      status: 'online',
      lastHeartbeat: Date.now(),
      joinedAt: Date.now(),
    });

    expect(manager.listPeers().length).toBe(1);
    expect(manager.getPeer('peer-1')?.label).toBe('Peer 1');
  });

  it('should remove peers', () => {
    manager.registerPeer({
      nodeId: 'peer-2',
      label: 'Peer 2',
      host: 'http://10.0.0.5:3000',
      capabilities: ['llm'],
      status: 'online',
      lastHeartbeat: Date.now(),
      joinedAt: Date.now(),
    });

    manager.removePeer('peer-2');
    expect(manager.listPeers().length).toBe(0);
  });

  it('should find peers with specific capability', () => {
    manager.registerPeer({
      nodeId: 'peer-a',
      label: 'A',
      host: 'http://a:3000',
      capabilities: ['llm', 'chat'],
      status: 'online',
      lastHeartbeat: Date.now(),
      joinedAt: Date.now(),
    });
    manager.registerPeer({
      nodeId: 'peer-b',
      label: 'B',
      host: 'http://b:3000',
      capabilities: ['search'],
      status: 'online',
      lastHeartbeat: Date.now(),
      joinedAt: Date.now(),
    });

    const llmPeers = manager.findPeersWithCapability('llm');
    expect(llmPeers.length).toBe(1);
    expect(llmPeers[0].nodeId).toBe('peer-a');
  });

  it('should return full topology', () => {
    const topo = manager.getTopology();
    expect(topo.local.nodeId).toBe('local');
    expect(topo.peers).toEqual([]);
  });

  it('should handle join message', () => {
    manager.handleMessage({
      from: 'peer-x',
      to: 'local',
      type: 'join',
      payload: {
        nodeId: 'peer-x',
        label: 'Remote X',
        host: 'http://x:3000',
        capabilities: ['chat'],
        status: 'online',
        lastHeartbeat: Date.now(),
        joinedAt: Date.now(),
      },
      timestamp: Date.now(),
    });

    expect(manager.getPeer('peer-x')?.label).toBe('Remote X');
  });

  it('should handle leave message', () => {
    manager.registerPeer({
      nodeId: 'peer-y',
      label: 'Y',
      host: 'http://y:3000',
      capabilities: [],
      status: 'online',
      lastHeartbeat: Date.now(),
      joinedAt: Date.now(),
    });

    manager.handleMessage({
      from: 'peer-y',
      to: 'local',
      type: 'leave',
      payload: { nodeId: 'peer-y' },
      timestamp: Date.now(),
    });

    expect(manager.getPeer('peer-y')).toBeUndefined();
  });
});

// ─── EdgeRouter ──────────────────────────────────────────────────────────────

describe('EdgeRouter', () => {
  let localNode: MeshNode;
  let manager: MeshManager;
  let router: EdgeRouter;

  beforeEach(() => {
    localNode = new MeshNode({
      nodeId: 'local',
      label: 'Local',
      host: 'http://localhost:3000',
      region: 'eu-west',
    });
    localNode.start(['chat', 'llm']);
    manager = new MeshManager(localNode);

    router = new EdgeRouter(manager, {
      localNodeId: 'local',
      localRegion: 'eu-west',
      cloudflareWorkerUrl: 'https://cf-test.workers.dev',
    });
  });

  afterEach(() => {
    localNode.stop();
  });

  it('should resolve locally when capability exists', () => {
    const decision = router.resolve('chat');
    expect(decision.target).toBe('local');
    expect(decision.nodeId).toBe('local');
    expect(decision.fallback).toBe(false);
  });

  it('should resolve to same-region peer', () => {
    manager.registerPeer({
      nodeId: 'peer-eu',
      label: 'EU Peer',
      host: 'http://eu:3000',
      capabilities: ['browser'],
      status: 'online',
      region: 'eu-west',
      lastHeartbeat: Date.now(),
      joinedAt: Date.now(),
    });

    const decision = router.resolve('browser');
    expect(decision.target).toBe('peer');
    expect(decision.nodeId).toBe('peer-eu');
  });

  it('should fallback to CF edge when no peer has capability', () => {
    const decision = router.resolve('rare-capability');
    expect(decision.target).toBe('edge');
    expect(decision.nodeId).toBe('cf-edge');
    expect(decision.fallback).toBe(true);
  });

  it('should throw when no route and no CF URL', () => {
    const bareRouter = new EdgeRouter(manager, {
      localNodeId: 'local',
      cloudflareWorkerUrl: undefined,
    });

    expect(() => bareRouter.resolve('nonexistent')).toThrow(/No route found/);
  });

  it('should cache route decisions', () => {
    const d1 = router.resolve('chat');
    const d2 = router.resolve('chat');
    expect(d1).toBe(d2); // Same reference from cache
  });

  it('should invalidate cache', () => {
    const d1 = router.resolve('chat');
    router.invalidateCache();
    const d2 = router.resolve('chat');
    expect(d1).not.toBe(d2); // Different reference after cache clear
  });
});

// ─── DeviceOrchestrator ──────────────────────────────────────────────────────

describe('DeviceOrchestrator', () => {
  let orch: DeviceOrchestrator;

  beforeEach(() => {
    orch = new DeviceOrchestrator();
  });

  it('should link and list devices', () => {
    orch.linkDevice({
      deviceId: 'dev-1',
      userId: 'user-a',
      deviceType: 'web',
      sessionId: 'sess-1',
      connectedAt: Date.now(),
      lastActivity: Date.now(),
      capabilities: ['display'],
    });

    expect(orch.getUserDevices('user-a').length).toBe(1);
    expect(orch.getStats().totalDevices).toBe(1);
  });

  it('should unlink devices', () => {
    orch.linkDevice({
      deviceId: 'dev-2',
      userId: 'user-b',
      deviceType: 'mobile',
      sessionId: 'sess-2',
      connectedAt: Date.now(),
      lastActivity: Date.now(),
      capabilities: [],
    });

    orch.unlinkDevice('dev-2');
    expect(orch.getUserDevices('user-b').length).toBe(0);
  });

  it('should propagate state updates to other devices', () => {
    orch.linkDevice({
      deviceId: 'dev-a',
      userId: 'user-1',
      deviceType: 'web',
      sessionId: 's1',
      connectedAt: Date.now(),
      lastActivity: Date.now(),
      capabilities: [],
    });
    orch.linkDevice({
      deviceId: 'dev-b',
      userId: 'user-1',
      deviceType: 'mobile',
      sessionId: 's2',
      connectedAt: Date.now(),
      lastActivity: Date.now(),
      capabilities: [],
    });

    const updates: unknown[] = [];
    orch.on('device:state_update', (data) => updates.push(data));

    orch.propagateStateUpdate({
      userId: 'user-1',
      sourceDeviceId: 'dev-a',
      key: 'theme',
      value: 'dark',
      version: 1,
      timestamp: Date.now(),
    });

    expect(updates.length).toBe(1);
    expect((updates[0] as any).targetDeviceId).toBe('dev-b');
  });

  it('should ignore stale state updates', () => {
    orch.linkDevice({
      deviceId: 'dev-x',
      userId: 'user-x',
      deviceType: 'web',
      sessionId: 'sx',
      connectedAt: Date.now(),
      lastActivity: Date.now(),
      capabilities: [],
    });

    orch.propagateStateUpdate({
      userId: 'user-x',
      sourceDeviceId: 'other',
      key: 'cursor',
      value: 10,
      version: 5,
      timestamp: Date.now(),
    });

    // Same version should be ignored
    const updates: unknown[] = [];
    orch.on('device:state_update', (data) => updates.push(data));

    orch.propagateStateUpdate({
      userId: 'user-x',
      sourceDeviceId: 'other',
      key: 'cursor',
      value: 10,
      version: 5,
      timestamp: Date.now(),
    });

    expect(updates.length).toBe(0);
  });
});

// ─── OfflineSync ─────────────────────────────────────────────────────────────

describe('OfflineSync', () => {
  let sync: OfflineSync;

  beforeEach(() => {
    sync = new OfflineSync();
  });

  it('should enqueue deltas', () => {
    sync.enqueue({
      sourceNodeId: 'node-a',
      targetNodeId: 'node-b',
      operation: 'update',
      resource: 'session',
      resourceId: 'sess-1',
      payload: { active: true },
    });

    expect(sync.getStats().totalPending).toBe(1);
  });

  it('should return pending deltas for a node', () => {
    sync.enqueue({
      sourceNodeId: 'a',
      targetNodeId: 'b',
      operation: 'create',
      resource: 'agent_state',
      resourceId: 'ag-1',
      payload: { name: 'test' },
    });

    const pending = sync.getPendingDeltas('b');
    expect(pending.length).toBe(1);
    expect(pending[0].resource).toBe('agent_state');
  });

  it('should replay deltas', () => {
    sync.enqueue({
      sourceNodeId: 'a',
      targetNodeId: 'b',
      operation: 'update',
      resource: 'config',
      resourceId: 'c1',
      payload: { key: 'val' },
    });
    sync.enqueue({
      sourceNodeId: 'a',
      targetNodeId: 'b',
      operation: 'delete',
      resource: 'config',
      resourceId: 'c2',
      payload: {},
    });

    const result = sync.replay('b', () => true);
    expect(result.applied).toBe(2);
    expect(result.failed).toBe(0);
    expect(sync.getPendingDeltas('b').length).toBe(0);
  });

  it('should handle failed replays', () => {
    sync.enqueue({
      sourceNodeId: 'a',
      targetNodeId: 'c',
      operation: 'command',
      resource: 'task',
      resourceId: 't1',
      payload: {},
    });

    const result = sync.replay('c', () => false);
    expect(result.applied).toBe(0);
    expect(result.failed).toBe(1);
  });

  it('should purge old applied deltas', () => {
    const delta = sync.enqueue({
      sourceNodeId: 'a',
      targetNodeId: 'd',
      operation: 'update',
      resource: 'x',
      resourceId: 'x1',
      payload: {},
    });

    sync.markApplied([delta.id]);
    // Force old timestamp
    const pending = sync.getPendingDeltas('d');
    expect(pending.length).toBe(0);

    const purged = sync.purgeApplied(0); // 0ms = purge everything
    expect(purged).toBe(1);
  });
});

// ─── PhoenixReplication ──────────────────────────────────────────────────────

describe('PhoenixReplication', () => {
  let repl: PhoenixReplication;

  beforeEach(() => {
    repl = new PhoenixReplication('local-node');
  });

  it('should put and get values', () => {
    repl.put('agents.count', 5);
    expect(repl.get('agents.count')).toBe(5);
  });

  it('should maintain version ordering', () => {
    repl.put('key1', 'a');
    repl.put('key2', 'b');
    const stats = repl.getStats();
    expect(stats.version).toBe(2);
    expect(stats.keys).toBe(2);
  });

  it('should apply remote entries', () => {
    const entry = repl.put('local.key', 'local-val');

    const remote: typeof entry = {
      ...entry,
      id: 'remote-1',
      sourceNodeId: 'remote-node',
      key: 'remote.key',
      value: 'remote-val',
      version: entry.version + 1,
      checksum: '', // Will be recalculated
    };
    // Compute correct checksum
    remote.checksum = (repl as any).computeChecksum(remote.key, remote.value, remote.version);

    const applied = repl.applyRemote(remote);
    expect(applied).toBe(true);
    expect(repl.get('remote.key')).toBe('remote-val');
  });

  it('should reject stale remote entries', () => {
    repl.put('key', 'v1');
    repl.put('key', 'v2'); // version 2

    const stale = {
      id: 'old',
      sourceNodeId: 'other',
      key: 'key',
      value: 'old-val',
      version: 1,
      timestamp: Date.now(),
      checksum: (repl as any).computeChecksum('key', 'old-val', 1),
    };

    expect(repl.applyRemote(stale)).toBe(false);
    expect(repl.get('key')).toBe('v2');
  });

  it('should return entries since a version', () => {
    repl.put('a', 1);
    repl.put('b', 2);
    repl.put('c', 3);

    const since = repl.getEntriesSince(1);
    expect(since.length).toBe(2);
    expect(since[0].key).toBe('b');
  });
});

// ─── FederatedAgentManager ───────────────────────────────────────────────────

describe('FederatedAgentManager', () => {
  const originalFetch = globalThis.fetch;
  const localKeyPair = generateKeyPairSync('ed25519');
  const remoteKeyPair = generateKeyPairSync('ed25519');
  const fallbackKeyPair = generateKeyPairSync('ed25519');
  const localPrivateKeyPem = localKeyPair.privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
  const localPublicKeyPem = localKeyPair.publicKey.export({ type: 'spki', format: 'pem' }).toString();
  const remotePublicKeyPem = remoteKeyPair.publicKey.export({ type: 'spki', format: 'pem' }).toString();
  const remoteFingerprint = inspectFederationPublicKey(remotePublicKeyPem).publicKeyFingerprint;
  const fallbackPublicKeyPem = fallbackKeyPair.publicKey.export({ type: 'spki', format: 'pem' }).toString();
  const fallbackFingerprint = inspectFederationPublicKey(fallbackPublicKeyPem).publicKeyFingerprint;
  let localNode: MeshNode;
  let manager: MeshManager;
  let federation: FederatedAgentManager;

  async function flushDiscoverySync(): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 0));
  }

  beforeEach(() => {
    process.env.FEDERATION_LOCAL_PRIVATE_KEY = localPrivateKeyPem;
    process.env.FEDERATION_LOCAL_PUBLIC_KEY = localPublicKeyPem;
    process.env.FEDERATION_LOCAL_PEER_ID = 'local';
    localNode = new MeshNode({
      nodeId: 'local',
      label: 'Local',
      host: 'http://localhost:3000',
    });
    localNode.start(['chat']);
    manager = new MeshManager(localNode);
    federation = new FederatedAgentManager(manager);
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    delete process.env.FEDERATION_LOCAL_PRIVATE_KEY;
    delete process.env.FEDERATION_LOCAL_PUBLIC_KEY;
    delete process.env.FEDERATION_LOCAL_PEER_ID;
    federation.dispose();
    localNode.stop();
  });

  it('should register and find agents', () => {
    federation.registerAgent({
      agentId: 'agent-1',
      name: 'SearchBot',
      nodeId: 'local',
      host: 'http://localhost:3000',
      capabilities: ['search', 'web'],
      status: 'available',
      lastSeen: Date.now(),
    });

    const found = federation.findAgents('search');
    expect(found.length).toBe(1);
    expect(found[0].name).toBe('SearchBot');
  });

  it('should list agents by node', () => {
    federation.registerAgent({
      agentId: 'a1',
      name: 'A1',
      nodeId: 'node-x',
      host: 'http://x:3000',
      capabilities: ['chat'],
      status: 'available',
      lastSeen: Date.now(),
    });
    federation.registerAgent({
      agentId: 'a2',
      name: 'A2',
      nodeId: 'node-y',
      host: 'http://y:3000',
      capabilities: ['search'],
      status: 'available',
      lastSeen: Date.now(),
    });

    expect(federation.listAgentsOnNode('node-x').length).toBe(1);
    expect(federation.listAgentsOnNode('node-y').length).toBe(1);
  });

  it('should unregister agents', () => {
    federation.registerAgent({
      agentId: 'rm-me',
      name: 'Remove',
      nodeId: 'local',
      host: 'http://localhost:3000',
      capabilities: [],
      status: 'available',
      lastSeen: Date.now(),
    });

    federation.unregisterAgent('rm-me');
    expect(federation.getAgent('rm-me')).toBeUndefined();
  });

  it('should sync peer agents through signed federation discovery using trusted endpoint metadata', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        agents: [
          {
            agentId: 'discovered-agent',
            name: 'DiscoveredAgent',
            nodeId: 'spoofed-node',
            host: 'http://spoofed-remote:3000',
            capabilities: ['agent_execute'],
            status: 'available',
            lastSeen: Date.now(),
          },
        ],
      }),
    });
    globalThis.fetch = fetchMock as typeof globalThis.fetch;

    const { trustRegistry } = await import('@packages/core-logic/federation/trustRegistry.js');
    await trustRegistry.register({
      peerId: 'remote-discovery-peer',
      displayName: 'Remote Discovery',
      endpoint: 'http://trusted-remote:3000',
      publicKey: remotePublicKeyPem,
    });

    manager.registerPeer({
      nodeId: 'remote-discovery-peer',
      label: 'Remote Discovery',
      host: 'http://spoofed-remote:3000',
      capabilities: ['agent_execute'],
      status: 'online',
      lastHeartbeat: Date.now(),
      joinedAt: Date.now(),
    });

    await flushDiscoverySync();

    expect(fetchMock).toHaveBeenCalledWith(
      'http://trusted-remote:3000/api/v1/federation/agents',
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({
          'x-federation-peer-id': 'local',
          'x-federation-signature-scheme': 'asymmetric-v1',
          'x-federation-target-key-id': remoteFingerprint,
        }),
      }),
    );
    expect(federation.getAgent('discovered-agent')).toEqual(
      expect.objectContaining({
        nodeId: 'remote-discovery-peer',
        host: 'http://trusted-remote:3000',
        capabilities: ['agent_execute'],
      }),
    );
  });

  it('should skip peer agent discovery for non-trusted federation peers', async () => {
    const fetchMock = vi.fn();
    globalThis.fetch = fetchMock as typeof globalThis.fetch;

    const { trustRegistry } = await import('@packages/core-logic/federation/trustRegistry.js');
    await trustRegistry.register({
      peerId: 'pending-discovery-peer',
      displayName: 'Pending Discovery',
      endpoint: 'http://pending-remote:3000',
      publicKey: remotePublicKeyPem,
    });
    const pendingPeer = trustRegistry.getPeer('pending-discovery-peer');
    if (!pendingPeer) {
      throw new Error('Expected pending discovery peer to exist');
    }
    pendingPeer.trustState = 'pending';

    manager.registerPeer({
      nodeId: 'pending-discovery-peer',
      label: 'Pending Discovery',
      host: 'http://pending-remote:3000',
      capabilities: ['agent_execute'],
      status: 'online',
      lastHeartbeat: Date.now(),
      joinedAt: Date.now(),
    });

    await flushDiscoverySync();

    expect(fetchMock).not.toHaveBeenCalled();
    expect(federation.listAgentsOnNode('pending-discovery-peer')).toEqual([]);
  });

  it('should return error for unknown agent in executeRemote', async () => {
    const result = await federation.executeRemote({
      agentId: 'nonexistent',
      taskType: 'test',
      input: {},
      fromNodeId: 'local',
    });
    expect(result.status).toBe('error');
    expect(result.error).toContain('not found');
  });

  it('should return error for busy agent in executeRemote', async () => {
    federation.registerAgent({
      agentId: 'busy-agent',
      name: 'Busy',
      nodeId: 'remote',
      host: 'http://remote:3000',
      capabilities: ['work'],
      status: 'busy',
      lastSeen: Date.now(),
    });

    const result = await federation.executeRemote({
      agentId: 'busy-agent',
      taskType: 'test',
      input: {},
      fromNodeId: 'local',
    });
    expect(result.status).toBe('error');
    expect(result.error).toContain('busy');
  });

  it('should send signed agent_execute capability payload for remote execution', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true }),
    });
    globalThis.fetch = fetchMock as typeof globalThis.fetch;

    federation.registerAgent({
      agentId: 'remote-agent',
      name: 'RemoteAgent',
      nodeId: 'remote',
      host: 'http://remote:3000',
      capabilities: ['agent_execute'],
      status: 'available',
      lastSeen: Date.now(),
    });

    const { trustRegistry } = await import('@packages/core-logic/federation/trustRegistry.js');
    await trustRegistry.register({
      peerId: 'remote',
      displayName: 'Remote',
      endpoint: 'http://remote:3000',
      publicKey: remotePublicKeyPem,
    });

    const result = await federation.executeRemote({
      agentId: 'remote-agent',
      taskType: 'diagnose',
      input: { scope: 'tests' },
      fromNodeId: 'local',
    });

    expect(result.status).toBe('success');
    expect(fetchMock).toHaveBeenCalledWith(
      'http://remote:3000/api/v1/federation/execute',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
          'x-federation-peer-id': 'local',
          'x-federation-signature-scheme': 'asymmetric-v1',
          'x-federation-target-key-id': remoteFingerprint,
        }),
        body: JSON.stringify({
          capabilityName: 'agent_execute',
          payload: {
            agentName: 'RemoteAgent',
            task: 'diagnose',
            context: JSON.stringify({
              scope: 'tests',
              fromNodeId: 'local',
            }),
          },
        }),
      }),
    );
  });

  it('should retry remote execution with the next runtime key after auth rejection', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        text: async () => 'Unauthorized: Federation target key binding mismatch',
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ok: true }),
      } as Response);
    globalThis.fetch = fetchMock as typeof globalThis.fetch;

    federation.registerAgent({
      agentId: 'remote-agent',
      name: 'RemoteAgent',
      nodeId: 'remote',
      host: 'http://remote:3000',
      capabilities: ['agent_execute'],
      status: 'available',
      lastSeen: Date.now(),
    });

    const { trustRegistry } = await import('@packages/core-logic/federation/trustRegistry.js');
    await trustRegistry.register({
      peerId: 'remote',
      displayName: 'Remote',
      endpoint: 'http://remote:3000',
      publicKey: remotePublicKeyPem,
      metadata: {
        nextPublicKey: fallbackPublicKeyPem,
      },
    });

    const result = await federation.executeRemote({
      agentId: 'remote-agent',
      taskType: 'diagnose',
      input: { scope: 'tests' },
      fromNodeId: 'local',
    });

    expect(result.status).toBe('success');
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0]?.[1]).toEqual(expect.objectContaining({
      headers: expect.objectContaining({
        'x-federation-target-key-id': remoteFingerprint,
      }),
    }));
    expect(fetchMock.mock.calls[1]?.[1]).toEqual(expect.objectContaining({
      headers: expect.objectContaining({
        'x-federation-target-key-id': fallbackFingerprint,
      }),
    }));
  });

  it('evicts revoked peer agents when revoke is published', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true }),
    });
    globalThis.fetch = fetchMock as typeof globalThis.fetch;

    federation.registerAgent({
      agentId: 'remote-agent',
      name: 'RemoteAgent',
      nodeId: 'remote',
      host: 'http://remote:3000',
      capabilities: ['agent_execute'],
      status: 'available',
      lastSeen: Date.now(),
    });

    const { trustRegistry } = await import('@packages/core-logic/federation/trustRegistry.js');
    await trustRegistry.register({
      peerId: 'remote',
      displayName: 'Remote',
      endpoint: 'http://remote:3000',
      publicKey: remotePublicKeyPem,
    });

    phoenixEventBus.publish('phoenix:federation_peer_revoked', {
      peerId: 'remote',
      displayName: 'Remote',
      reason: 'compromised',
      timestamp: new Date().toISOString(),
    });

    expect(federation.getAgent('remote-agent')).toBeUndefined();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('fails closed for revoked peers even if a stale agent entry still exists', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true }),
    });
    globalThis.fetch = fetchMock as typeof globalThis.fetch;
    const { trustRegistry } = await import('@packages/core-logic/federation/trustRegistry.js');

    federation.registerAgent({
      agentId: 'remote-agent-2',
      name: 'RemoteAgent2',
      nodeId: 'remote',
      host: 'http://remote:3000',
      capabilities: ['agent_execute'],
      status: 'available',
      lastSeen: Date.now(),
    });

    const peer = trustRegistry.getPeer('remote');
    if (!peer) {
      throw new Error('Expected trusted federation peer to exist for stale-entry test');
    }
    peer.trustState = 'revoked';

    const result = await federation.executeRemote({
      agentId: 'remote-agent-2',
      taskType: 'diagnose',
      input: { scope: 'tests' },
      fromNodeId: 'local',
    });

    expect(result.status).toBe('error');
    expect(result.error).toContain('not trusted');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

// ─── AutoJoin ────────────────────────────────────────────────────────────────

describe('AutoJoin', () => {
  let localNode: MeshNode;
  let manager: MeshManager;

  beforeEach(() => {
    localNode = new MeshNode({
      nodeId: 'local',
      label: 'Local',
      host: 'http://localhost:3000',
    });
    localNode.start(['chat']);
    manager = new MeshManager(localNode);
  });

  afterEach(() => {
    localNode.stop();
  });

  it('should create without errors', () => {
    const aj = new AutoJoin(localNode, manager, {
      seedNodes: [{ host: 'http://seed:3000' }],
      maxRetries: 1,
      retryIntervalMs: 100,
    });
    expect(aj).toBeDefined();
    aj.stop();
  });

  it('should handle failed join gracefully', async () => {
    const aj = new AutoJoin(localNode, manager, {
      seedNodes: [{ host: 'http://nonexistent:9999' }],
      maxRetries: 1,
      retryIntervalMs: 50,
    });

    // Mock fetch to simulate failure
    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('Connection refused'));

    const success = await aj.join();
    expect(success).toBe(false);

    globalThis.fetch = originalFetch;
    aj.stop();
  });
});
