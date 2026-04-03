import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { generateKeyPairSync } from 'crypto';
import express from 'express';
import request from 'supertest';
import { createFederationRouter } from '../src/server/routes/federation.js';
import { signFederationRequest } from '../src/security/federationPeerAuth.js';
import { inspectFederationPublicKey } from '../src/security/federationPeerProof.js';

const federationMocks = vi.hoisted(() => ({
  listPeers: vi.fn(),
  getPeer: vi.fn(),
  getPeerRuntimeKeyId: vi.fn(),
  getPeerRuntimeKeys: vi.fn(),
  checkTrust: vi.fn(),
  register: vi.fn(),
  revoke: vi.fn(),
  issue: vi.fn(),
  listManifestsForPeer: vi.fn(),
  verify: vi.fn(),
  listSessions: vi.fn(),
  createOffer: vi.fn(),
  accept: vi.fn(),
  reject: vi.fn(),
  execute: vi.fn(),
  getDynamicToolRegistry: vi.fn(),
  getToolRegistry: vi.fn(),
  getRegisteredToolsList: vi.fn(),
  consume: vi.fn(),
}));

vi.mock('../src/core/federation/trustRegistry.js', () => ({
  trustRegistry: {
    listPeers: federationMocks.listPeers,
    getPeer: federationMocks.getPeer,
    getPeerRuntimeKeyId: federationMocks.getPeerRuntimeKeyId,
    getPeerRuntimeKeys: federationMocks.getPeerRuntimeKeys,
    checkTrust: federationMocks.checkTrust,
    register: federationMocks.register,
    revoke: federationMocks.revoke,
  },
}));

vi.mock('../src/core/federation/federationReplayGuard.js', () => ({
  federationReplayGuard: {
    consume: federationMocks.consume,
  },
}));

vi.mock('../src/core/federation/capabilityManifest.js', () => ({
  capabilityManifestManager: {
    issue: federationMocks.issue,
    listManifestsForPeer: federationMocks.listManifestsForPeer,
    verify: federationMocks.verify,
  },
}));

vi.mock('../src/core/federation/negotiationProtocol.js', () => ({
  negotiationProtocol: {
    listSessions: federationMocks.listSessions,
    createOffer: federationMocks.createOffer,
    accept: federationMocks.accept,
    reject: federationMocks.reject,
  },
}));

vi.mock('../src/core/federation/federatedGateway.js', () => ({
  federatedGateway: {
    execute: federationMocks.execute,
  },
}));

vi.mock('../src/core/dynamicToolRegistry.js', () => ({
  getDynamicToolRegistry: federationMocks.getDynamicToolRegistry,
}));

vi.mock('../src/core/toolRegistry.js', () => ({
  getToolRegistry: federationMocks.getToolRegistry,
}));

vi.mock('../src/server/registry.js', () => ({
  getRegisteredToolsList: federationMocks.getRegisteredToolsList,
}));

vi.mock('../src/server/toolRegistry.js', () => ({
  executeLocalTool: federationMocks.execute,
}));

vi.mock('../src/agents/AgentManager.js', () => ({
  agentManager: {
    listAgents: vi.fn(),
    getAgent: vi.fn(),
  },
}));

import { agentManager } from '../src/agents/AgentManager.js';

describe('Federation routes', () => {
  const localKeyPair = generateKeyPairSync('ed25519');
  const remoteKeyPair = generateKeyPairSync('ed25519');
  const localPrivateKeyPem = localKeyPair.privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
  const localPublicKeyPem = localKeyPair.publicKey.export({ type: 'spki', format: 'pem' }).toString();
  const remotePrivateKeyPem = remoteKeyPair.privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
  const remotePublicKeyPem = remoteKeyPair.publicKey.export({ type: 'spki', format: 'pem' }).toString();
  const remoteFingerprint = inspectFederationPublicKey(remotePublicKeyPem).publicKeyFingerprint;
  let app: express.Express;

  function createSignedHeaders(path: string, body: unknown): Record<string, string> {
    return signFederationRequest({
      peerId: 'peer-1',
      privateKey: remotePrivateKeyPem,
      publicKey: remotePublicKeyPem,
      method: 'POST',
      path,
      body,
      targetPeerPublicKey: localPublicKeyPem,
    });
  }

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.FEDERATION_LOCAL_PRIVATE_KEY = localPrivateKeyPem;
    process.env.FEDERATION_LOCAL_PUBLIC_KEY = localPublicKeyPem;
    process.env.FEDERATION_LOCAL_PEER_ID = 'local-federation-node';

    federationMocks.listPeers.mockReturnValue([
      { peerId: 'peer-1', displayName: 'Peer 1', endpoint: 'https://peer-1', trustState: 'trusted' },
    ]);
    federationMocks.getPeer.mockReturnValue({
      peerId: 'peer-1',
      displayName: 'Peer 1',
      endpoint: 'https://peer-1',
      trustState: 'trusted',
      publicKey: remotePublicKeyPem,
    });
    federationMocks.getPeerRuntimeKeyId.mockReturnValue(remoteFingerprint);
    federationMocks.getPeerRuntimeKeys.mockReturnValue([
      { keyId: remoteFingerprint, publicKey: remotePublicKeyPem, status: 'current' },
    ]);
    federationMocks.checkTrust.mockReturnValue('trusted');
    federationMocks.register.mockResolvedValue({
      peerId: 'peer-2',
      displayName: 'Peer 2',
      endpoint: 'https://peer-2',
      trustState: 'trusted',
    });
    federationMocks.revoke.mockResolvedValue({
      peerId: 'peer-1',
      displayName: 'Peer 1',
      endpoint: 'https://peer-1',
      trustState: 'revoked',
      revokedAt: '2026-03-30T10:00:00.000Z',
    });
    federationMocks.issue.mockImplementation((peerId: string, capabilities: Array<{ name: string }>) => ({
      manifestId: 'manifest-1',
      peerId,
      capabilities,
      version: '1.0',
      issuedAt: '2026-03-30T10:00:00.000Z',
      expiresAt: '2026-03-30T11:00:00.000Z',
      signature: 'signature',
    }));
    federationMocks.listManifestsForPeer.mockReturnValue([]);
    federationMocks.verify.mockReturnValue('valid');
    federationMocks.listSessions.mockReturnValue([
      {
        sessionId: 'session-1',
        state: 'offering',
        initialOffer: {
          offerId: 'offer-1',
          fromPeerId: 'local',
          toPeerId: 'peer-1',
          capabilities: ['agent_list'],
          terms: {},
          proposedAt: '2026-03-30T10:00:00.000Z',
        },
        createdAt: '2026-03-30T10:00:00.000Z',
        requiresApproval: false,
        transcript: [],
      },
    ]);
    federationMocks.createOffer.mockResolvedValue({ sessionId: 'session-2' });
    federationMocks.accept.mockResolvedValue({ sessionId: 'session-1', state: 'accepted' });
    federationMocks.reject.mockResolvedValue({ sessionId: 'session-1', state: 'rejected' });
    federationMocks.execute.mockResolvedValue({ success: true, peerId: 'peer-1', data: { ok: true } });
    federationMocks.getDynamicToolRegistry.mockReturnValue({
      getAll: () => [
        {
          manifest: {
            id: 'dynamic-tool',
            description: 'Dynamic tool',
            version: '2.0.0',
            deprecated: true,
            deprecatedMessage: 'use something else',
          },
        },
      ],
    });
    federationMocks.getRegisteredToolsList.mockReturnValue([
      { id: 'agent_list', description: 'Lists agents' },
    ]);
    federationMocks.getToolRegistry.mockResolvedValue({
      getToolDefinitions: () => [
        { name: 'delegate_Developer', description: 'Delegates to Developer agent' },
      ],
    });
    federationMocks.consume.mockReturnValue(true);
    vi.mocked(agentManager.listAgents).mockReturnValue([
      { name: 'Developer', description: 'Developer agent', status: 'idle' },
      { name: 'Orchestrator', description: 'Orchestrator agent', status: 'working' },
    ]);
    vi.mocked(agentManager.getAgent).mockImplementation((name: string) => {
      if (name === 'Developer') {
        return {
          name: 'Developer',
          role: 'developer',
          description: 'Developer agent',
          capabilities: ['code', 'agent_execute'],
          execute: vi.fn(),
        };
      }

      if (name === 'Orchestrator') {
        return {
          name: 'Orchestrator',
          role: 'orchestrator',
          description: 'Orchestrator agent',
          capabilities: ['route'],
          execute: vi.fn(),
        };
      }

      return null;
    });

    app = express();
    app.use(express.json());
    app.use('/api/v1/federation', createFederationRouter());
  });

  afterEach(() => {
    delete process.env.FEDERATION_LOCAL_PRIVATE_KEY;
    delete process.env.FEDERATION_LOCAL_PUBLIC_KEY;
    delete process.env.FEDERATION_LOCAL_PEER_ID;
  });

  it('lists registered peers', async () => {
    const response = await request(app).get('/api/v1/federation/peers');

    expect(response.status).toBe(200);
    expect(response.body.peers).toHaveLength(1);
    expect(federationMocks.listPeers).toHaveBeenCalledOnce();
  });

  it('registers peers through the router', async () => {
    const response = await request(app)
      .post('/api/v1/federation/peers/register')
      .send({ peerId: 'peer-2', displayName: 'Peer 2', endpoint: 'https://peer-2' });

    expect(response.status).toBe(201);
    expect(federationMocks.register).toHaveBeenCalledWith({
      peerId: 'peer-2',
      displayName: 'Peer 2',
      endpoint: 'https://peer-2',
    });
  });

  it('builds the local manifest from real registry sources', async () => {
    const response = await request(app).get('/api/v1/federation/manifests/local');

    expect(response.status).toBe(200);
    expect(federationMocks.issue).toHaveBeenCalledOnce();
    expect(federationMocks.issue.mock.calls[0][1]).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: 'dynamic-tool', version: '2.0.0', deprecated: true }),
      expect.objectContaining({ name: 'agent_list' }),
      expect.objectContaining({ name: 'delegate_Developer' }),
    ]));
    expect(federationMocks.issue.mock.calls[0][0]).toBe('local-federation-node');
  });

  it('lists local agents for federation discovery', async () => {
    const response = await request(app).get('/api/v1/federation/agents');

    expect(response.status).toBe(200);
    expect(response.body.count).toBe(2);
    expect(response.body.agents).toEqual([
      expect.objectContaining({
        agentId: 'Developer',
        nodeId: 'local-federation-node',
        status: 'available',
        capabilities: ['code', 'agent_execute'],
      }),
      expect.objectContaining({
        agentId: 'Orchestrator',
        nodeId: 'local-federation-node',
        status: 'busy',
        capabilities: ['route'],
      }),
    ]);
  });

  it('rejects unsigned federation execute requests', async () => {
    const response = await request(app)
      .post('/api/v1/federation/execute')
      .send({ capabilityName: 'agent_list', payload: { sample: true } });

    expect(response.status).toBe(401);
    expect(federationMocks.execute).not.toHaveBeenCalled();
  });

  it('rejects signed federation capability requests from non-trusted peers', async () => {
    federationMocks.checkTrust.mockReturnValue('pending');
    const body = { capabilityName: 'agent_list', payload: { sample: true } };
    const response = await request(app)
      .post('/api/v1/federation/capabilities/execute')
      .set(createSignedHeaders('/api/v1/federation/capabilities/execute', body))
      .send(body);

    expect(response.status).toBe(403);
    expect(federationMocks.execute).not.toHaveBeenCalled();
  });

  it('rejects replayed signed federation capability requests', async () => {
    federationMocks.consume.mockReturnValue(false);
    const body = { capabilityName: 'agent_list', payload: { sample: true } };
    const response = await request(app)
      .post('/api/v1/federation/capabilities/execute')
      .set(createSignedHeaders('/api/v1/federation/capabilities/execute', body))
      .send(body);

    expect(response.status).toBe(409);
    expect(federationMocks.execute).not.toHaveBeenCalled();
  });

  it('executes signed remote federation requests through the local capability executor', async () => {
    const body = { capabilityName: 'agent_list', payload: { sample: true } };
    const response = await request(app)
      .post('/api/v1/federation/execute')
      .set(createSignedHeaders('/api/v1/federation/execute', body))
      .send(body);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(federationMocks.execute).toHaveBeenCalledWith('agent_list', { sample: true });
    expect(federationMocks.execute).toHaveBeenCalledTimes(1);
  });

  it('rejects inbound execute requests that try to re-route remotely', async () => {
    const body = {
      capabilityName: 'agent_list',
      payload: { sample: true },
      preferredPeerId: 'peer-2',
    };
    const response = await request(app)
      .post('/api/v1/federation/execute')
      .set(createSignedHeaders('/api/v1/federation/execute', body))
      .send(body);

    expect(response.status).toBe(400);
    expect(federationMocks.execute).not.toHaveBeenCalled();
  });
});
