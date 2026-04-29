import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { generateKeyPairSync } from 'crypto';
import express from 'express';
import request from 'supertest';
import { createFederationRouter } from '@apps/mcp-core/server/routes/federation.js';
import { generateRemoteToken } from '@packages/core-logic/remoteAuth.js';
import { signFederationRequest } from '@packages/core-logic/federationPeerAuth.js';
import { inspectFederationPublicKey } from '@packages/core-logic/federationPeerProof.js';
import { record as auditRecord, clearAuditLog, closeAuditDb } from '@packages/core-logic/auditLog.js';
import { phoenixEventBus } from '@packages/core-logic/phoenixEventBus.js';

const federationMocks = vi.hoisted(() => ({
  listPeers: vi.fn(),
  getPeer: vi.fn(),
  getPeerRuntimeKeyId: vi.fn(),
  getPeerRuntimeKeys: vi.fn(),
  checkTrust: vi.fn(),
  register: vi.fn(),
  revoke: vi.fn(),
  stageNextRuntimeKey: vi.fn(),
  promoteNextRuntimeKey: vi.fn(),
  issue: vi.fn(),
  getValidManifestForPeer: vi.fn(),
  listManifestsForPeer: vi.fn(),
  verify: vi.fn(),
  assertSigningSecretConfigured: vi.fn(),
  isCapabilityManifestConfigError: vi.fn((error: unknown) => error instanceof Error && error.name === 'CapabilityManifestConfigError'),
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

vi.mock('@packages/core-logic/federation/trustRegistry.js', () => ({
  trustRegistry: {
    listPeers: federationMocks.listPeers,
    getPeer: federationMocks.getPeer,
    getPeerRuntimeKeyId: federationMocks.getPeerRuntimeKeyId,
    getPeerRuntimeKeys: federationMocks.getPeerRuntimeKeys,
    checkTrust: federationMocks.checkTrust,
    register: federationMocks.register,
    revoke: federationMocks.revoke,
    stageNextRuntimeKey: federationMocks.stageNextRuntimeKey,
    promoteNextRuntimeKey: federationMocks.promoteNextRuntimeKey,
  },
}));

vi.mock('@packages/core-logic/federation/federationReplayGuard.js', () => ({
  federationReplayGuard: {
    consume: federationMocks.consume,
  },
}));

vi.mock('@packages/core-logic/federation/capabilityManifest.js', () => ({
  capabilityManifestManager: {
    issue: federationMocks.issue,
    getValidManifestForPeer: federationMocks.getValidManifestForPeer,
    listManifestsForPeer: federationMocks.listManifestsForPeer,
    verify: federationMocks.verify,
    assertSigningSecretConfigured: federationMocks.assertSigningSecretConfigured,
  },
  isCapabilityManifestConfigError: federationMocks.isCapabilityManifestConfigError,
}));

vi.mock('@packages/core-logic/federation/negotiationProtocol.js', () => ({
  negotiationProtocol: {
    listSessions: federationMocks.listSessions,
    createOffer: federationMocks.createOffer,
    accept: federationMocks.accept,
    reject: federationMocks.reject,
  },
}));

vi.mock('@packages/core-logic/federation/federatedGateway.js', () => ({
  federatedGateway: {
    execute: federationMocks.execute,
  },
}));

vi.mock('@packages/core-logic/dynamicToolRegistry.js', () => ({
  getDynamicToolRegistry: federationMocks.getDynamicToolRegistry,
}));

vi.mock('@packages/core-logic/toolRegistry.js', () => ({
  getToolRegistry: federationMocks.getToolRegistry,
}));

vi.mock('@apps/mcp-core/server/registry.js', () => ({
  getRegisteredToolsList: federationMocks.getRegisteredToolsList,
}));

vi.mock('@apps/mcp-core/server/toolRegistry.js', () => ({
  executeLocalTool: federationMocks.execute,
}));

vi.mock('@packages/agents/AgentManager.js', () => ({
  agentManager: {
    listAgents: vi.fn(),
    getAgent: vi.fn(),
  },
}));

import { agentManager } from '@packages/agents/AgentManager.js';

describe('Federation routes', () => {
  const localKeyPair = generateKeyPairSync('ed25519');
  const remoteKeyPair = generateKeyPairSync('ed25519');
  const localPrivateKeyPem = localKeyPair.privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
  const localPublicKeyPem = localKeyPair.publicKey.export({ type: 'spki', format: 'pem' }).toString();
  const remotePrivateKeyPem = remoteKeyPair.privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
  const remotePublicKeyPem = remoteKeyPair.publicKey.export({ type: 'spki', format: 'pem' }).toString();
  const remoteFingerprint = inspectFederationPublicKey(remotePublicKeyPem).publicKeyFingerprint;
  let app: express.Express;

  function createFederationApp(remoteAddress?: string): express.Express {
    const testApp = express();
    testApp.use(express.json());
    if (remoteAddress) {
      testApp.use((req, _res, next) => {
        const socket = req.socket as typeof req.socket & { remoteAddress?: string };
        try {
          Object.defineProperty(socket, 'remoteAddress', {
            value: remoteAddress,
            configurable: true,
          });
        } catch {
          socket.remoteAddress = remoteAddress;
        }
        next();
      });
    }
    testApp.use('/api/v1/federation', createFederationRouter());
    return testApp;
  }

  function createSignedHeaders(
    path: string,
    body: unknown,
    method: 'GET' | 'POST' = 'POST',
  ): Record<string, string> {
    return signFederationRequest({
      peerId: 'peer-1',
      privateKey: remotePrivateKeyPem,
      publicKey: remotePublicKeyPem,
      method,
      path,
      body,
      targetPeerPublicKey: localPublicKeyPem,
    });
  }

  beforeEach(async () => {
    vi.clearAllMocks();
    await clearAuditLog();
    phoenixEventBus.clearHistory();
    process.env.FEDERATION_LOCAL_PRIVATE_KEY = localPrivateKeyPem;
    process.env.FEDERATION_LOCAL_PUBLIC_KEY = localPublicKeyPem;
    process.env.FEDERATION_LOCAL_PEER_ID = 'local-federation-node';
    process.env.REMOTE_AUTH_SECRET = 'test-remote-secret';

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
    federationMocks.stageNextRuntimeKey.mockResolvedValue({
      peerId: 'peer-1',
      displayName: 'Peer 1',
      endpoint: 'https://peer-1',
      trustState: 'trusted',
      metadata: {
        runtimeKeys: {
          current: { keyId: remoteFingerprint, publicKey: remotePublicKeyPem },
          next: { keyId: 'next-key', publicKey: 'next-public-key' },
        },
      },
    });
    federationMocks.promoteNextRuntimeKey.mockResolvedValue({
      peerId: 'peer-1',
      displayName: 'Peer 1',
      endpoint: 'https://peer-1',
      trustState: 'trusted',
      publicKey: 'next-public-key',
      metadata: {
        runtimeKeys: {
          current: { keyId: 'next-key', publicKey: 'next-public-key' },
        },
      },
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
    federationMocks.getValidManifestForPeer.mockReturnValue(undefined);
    federationMocks.listManifestsForPeer.mockReturnValue([]);
    federationMocks.verify.mockReturnValue('valid');
    federationMocks.assertSigningSecretConfigured.mockReturnValue(undefined);
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

    app = createFederationApp();
  });

  afterEach(async () => {
    await clearAuditLog();
    await closeAuditDb();
    phoenixEventBus.clearHistory();
    delete process.env.FEDERATION_LOCAL_PRIVATE_KEY;
    delete process.env.FEDERATION_LOCAL_PUBLIC_KEY;
    delete process.env.FEDERATION_LOCAL_PEER_ID;
    delete process.env.REMOTE_AUTH_SECRET;
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

  it('rejects remote anonymous peer registration', async () => {
    const remoteApp = createFederationApp('10.0.0.5');
    const response = await request(remoteApp)
      .post('/api/v1/federation/peers/register')
      .send({ peerId: 'peer-2', displayName: 'Peer 2', endpoint: 'https://peer-2' });

    expect(response.status).toBe(401);
    expect(federationMocks.register).not.toHaveBeenCalled();
  });

  it('allows remote authenticated peer registration', async () => {
    const remoteApp = createFederationApp('10.0.0.5');
    const response = await request(remoteApp)
      .post('/api/v1/federation/peers/register')
      .set('Authorization', `Bearer ${generateRemoteToken('ops-user')}`)
      .send({ peerId: 'peer-2', displayName: 'Peer 2', endpoint: 'https://peer-2' });

    expect(response.status).toBe(201);
    expect(federationMocks.register).toHaveBeenCalledWith({
      peerId: 'peer-2',
      displayName: 'Peer 2',
      endpoint: 'https://peer-2',
    });
  });

  it('revokes peers through the router', async () => {
    const response = await request(app)
      .post('/api/v1/federation/peers/peer-1/revoke')
      .send({ reason: 'Security breach' });

    expect(response.status).toBe(200);
    expect(response.body.trustState).toBe('revoked');
    expect(federationMocks.revoke).toHaveBeenCalledWith('peer-1', 'Security breach');
  });

  it('rejects remote anonymous peer revocation', async () => {
    const remoteApp = createFederationApp('10.0.0.5');
    const response = await request(remoteApp)
      .post('/api/v1/federation/peers/peer-1/revoke')
      .send({ reason: 'Security breach' });

    expect(response.status).toBe(401);
    expect(federationMocks.revoke).not.toHaveBeenCalled();
  });

  it('stages the next runtime key through the router', async () => {
    const response = await request(app)
      .post('/api/v1/federation/peers/peer-1/runtime-keys/stage')
      .send({ publicKey: 'next-public-key', keyId: 'next-key' });

    expect(response.status).toBe(200);
    expect(federationMocks.stageNextRuntimeKey).toHaveBeenCalledWith('peer-1', 'next-public-key', 'next-key');
  });

  it('rejects remote anonymous runtime key staging', async () => {
    const remoteApp = createFederationApp('10.0.0.5');
    const response = await request(remoteApp)
      .post('/api/v1/federation/peers/peer-1/runtime-keys/stage')
      .send({ publicKey: 'next-public-key', keyId: 'next-key' });

    expect(response.status).toBe(401);
    expect(federationMocks.stageNextRuntimeKey).not.toHaveBeenCalled();
  });

  it('promotes the staged next runtime key through the router', async () => {
    const response = await request(app)
      .post('/api/v1/federation/peers/peer-1/runtime-keys/promote')
      .send({ reason: 'remote rollout confirmed' });

    expect(response.status).toBe(200);
    expect(federationMocks.promoteNextRuntimeKey).toHaveBeenCalledWith('peer-1', 'remote rollout confirmed');
  });

  it('rejects remote anonymous runtime key promotion', async () => {
    const remoteApp = createFederationApp('10.0.0.5');
    const response = await request(remoteApp)
      .post('/api/v1/federation/peers/peer-1/runtime-keys/promote')
      .send({ reason: 'remote rollout confirmed' });

    expect(response.status).toBe(401);
    expect(federationMocks.promoteNextRuntimeKey).not.toHaveBeenCalled();
  });

  it('builds federation operator evidence for loopback operators', async () => {
    const now = new Date().toISOString();
    federationMocks.getPeerRuntimeKeys.mockReturnValue([
      { keyId: remoteFingerprint, publicKey: remotePublicKeyPem, status: 'current' },
      { keyId: 'next-key', publicKey: 'next-public-key', status: 'next' },
    ]);

    await auditRecord('ALLOWED', 'TrustRegistry', 'federation:runtime-key:stage', 'peer-1/next-key');
    await auditRecord('DENIED', 'TrustRegistry', 'federation:revoke', 'peer-1', 'Security breach');
    phoenixEventBus.publish('phoenix:federation_runtime_key_staged', {
      peerId: 'peer-1',
      keyId: 'next-key',
      previousCurrentKeyId: remoteFingerprint,
      timestamp: now,
    });
    phoenixEventBus.publish('phoenix:federation_peer_revoked', {
      peerId: 'peer-1',
      displayName: 'Peer 1',
      reason: 'Security breach',
      timestamp: now,
    });

    const response = await request(app).get('/api/v1/federation/evidence?limit=10');

    expect(response.status).toBe(200);
    expect(response.body.peers).toEqual([
      expect.objectContaining({
        peerId: 'peer-1',
        currentKeyId: remoteFingerprint,
        nextKeyId: 'next-key',
        stageCount: 1,
        revokeCount: 1,
      }),
    ]);
    expect(response.body.journal).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'runtime_key_staged',
          peerId: 'peer-1',
          keyId: 'next-key',
          evidenceSources: expect.arrayContaining(['phoenix', 'audit']),
        }),
        expect.objectContaining({
          kind: 'peer_revoked',
          peerId: 'peer-1',
          outcome: 'denied',
          evidenceSources: expect.arrayContaining(['phoenix', 'audit']),
        }),
      ]),
    );
  });

  it('rejects remote anonymous evidence reads', async () => {
    const remoteApp = createFederationApp('10.0.0.5');
    const response = await request(remoteApp).get('/api/v1/federation/evidence');

    expect(response.status).toBe(401);
  });

  it('allows remote authenticated evidence reads', async () => {
    const remoteApp = createFederationApp('10.0.0.5');
    const response = await request(remoteApp)
      .get('/api/v1/federation/evidence')
      .set('Authorization', `Bearer ${generateRemoteToken('ops-user')}`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual(
      expect.objectContaining({
        peers: expect.any(Array),
        journal: expect.any(Array),
      }),
    );
  });

  it('builds the local manifest from real registry sources', async () => {
    const response = await request(app).get('/api/v1/federation/manifests/local');

    expect(response.status).toBe(200);
    expect(federationMocks.getValidManifestForPeer).toHaveBeenCalledWith('local-federation-node');
    expect(federationMocks.issue).toHaveBeenCalledOnce();
    expect(federationMocks.issue.mock.calls[0][1]).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: 'dynamic-tool', version: '2.0.0', deprecated: true }),
      expect.objectContaining({ name: 'agent_list' }),
      expect.objectContaining({ name: 'delegate_Developer' }),
    ]));
    expect(federationMocks.issue.mock.calls[0][0]).toBe('local-federation-node');
  });

  it('fails closed when local manifest signing config is missing', async () => {
    federationMocks.getValidManifestForPeer.mockReturnValueOnce(undefined);
    federationMocks.issue.mockImplementationOnce(() => {
      const error = new Error('Capability manifest signing requires MANIFEST_SIGNING_SECRET to be configured with at least 32 characters.');
      error.name = 'CapabilityManifestConfigError';
      throw error;
    });

    const response = await request(app).get('/api/v1/federation/manifests/local');

    expect(response.status).toBe(503);
    expect(response.body.error).toContain('MANIFEST_SIGNING_SECRET');
  });

  it('fails closed when manifest verification config is missing', async () => {
    federationMocks.assertSigningSecretConfigured.mockImplementationOnce(() => {
      const error = new Error('Capability manifest signing requires MANIFEST_SIGNING_SECRET to be configured with at least 32 characters.');
      error.name = 'CapabilityManifestConfigError';
      throw error;
    });

    const response = await request(app)
      .post('/api/v1/federation/manifests/verify')
      .send({
        manifestId: '550e8400-e29b-41d4-a716-446655440000',
        peerId: 'peer-1',
        capabilities: [],
        version: '1.0',
        issuedAt: '2026-03-30T10:00:00.000Z',
        expiresAt: '2026-03-30T11:00:00.000Z',
        signature: 'a'.repeat(64),
      });

    expect(response.status).toBe(503);
    expect(response.body.error).toContain('MANIFEST_SIGNING_SECRET');
  });

  it('reuses an existing valid local manifest instead of issuing a new one', async () => {
    federationMocks.getValidManifestForPeer.mockReturnValueOnce({
      manifestId: 'manifest-existing',
      peerId: 'local-federation-node',
      capabilities: [{ name: 'agent_list', description: 'Lists agents' }],
      version: '1.0',
      issuedAt: '2026-03-30T10:00:00.000Z',
      expiresAt: '2026-03-30T11:00:00.000Z',
      signature: 'a'.repeat(64),
    });

    const response = await request(app).get('/api/v1/federation/manifests/local');

    expect(response.status).toBe(200);
    expect(response.body.manifestId).toBe('manifest-existing');
    expect(federationMocks.issue).not.toHaveBeenCalled();
  });

  it('rejects remote anonymous local manifest reads', async () => {
    const remoteApp = createFederationApp('10.0.0.5');
    const response = await request(remoteApp).get('/api/v1/federation/manifests/local');

    expect(response.status).toBe(401);
  });

  it('allows remote authenticated local manifest reads', async () => {
    const remoteApp = createFederationApp('10.0.0.5');
    const response = await request(remoteApp)
      .get('/api/v1/federation/manifests/local')
      .set('Authorization', `Bearer ${generateRemoteToken('ops-user')}`);

    expect(response.status).toBe(200);
  });

  it('rejects remote anonymous manifest verification', async () => {
    const remoteApp = createFederationApp('10.0.0.5');
    const response = await request(remoteApp)
      .post('/api/v1/federation/manifests/verify')
      .send({
        manifestId: '550e8400-e29b-41d4-a716-446655440000',
        peerId: 'peer-1',
        capabilities: [],
        version: '1.0',
        issuedAt: '2026-03-30T10:00:00.000Z',
        expiresAt: '2026-03-30T11:00:00.000Z',
        signature: 'a'.repeat(64),
      });

    expect(response.status).toBe(401);
  });

  it('rejects remote anonymous peer manifest reads', async () => {
    const remoteApp = createFederationApp('10.0.0.5');
    const response = await request(remoteApp).get('/api/v1/federation/manifests/peer/peer-1');

    expect(response.status).toBe(401);
  });

  it('allows remote authenticated peer manifest reads', async () => {
    federationMocks.listManifestsForPeer.mockReturnValueOnce([
      {
        manifestId: 'manifest-peer-1',
        peerId: 'peer-1',
        capabilities: [{ name: 'agent_list', description: 'Lists agents' }],
        version: '1.0',
        issuedAt: '2026-03-30T10:00:00.000Z',
        expiresAt: '2026-03-30T11:00:00.000Z',
        signature: 'a'.repeat(64),
      },
    ]);
    const remoteApp = createFederationApp('10.0.0.5');
    const response = await request(remoteApp)
      .get('/api/v1/federation/manifests/peer/peer-1')
      .set('Authorization', `Bearer ${generateRemoteToken('ops-user')}`);

    expect(response.status).toBe(200);
    expect(response.body.count).toBe(1);
  });

  it('rejects invalid peer ids on manifest peer reads', async () => {
    const response = await request(app).get(`/api/v1/federation/manifests/peer/${'a'.repeat(257)}`);

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('Invalid peerId');
  });

  it('fails closed for invalid manifest verify payload shape', async () => {
    const response = await request(app)
      .post('/api/v1/federation/manifests/verify')
      .send({ manifestId: 'manifest-1' });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ result: 'invalid_signature' });
    expect(federationMocks.verify).not.toHaveBeenCalled();
  });

  it('rejects unsigned federation agent discovery requests', async () => {
    const response = await request(app).get('/api/v1/federation/agents');

    expect(response.status).toBe(401);
  });

  it('lists local agents for signed federation discovery', async () => {
    const response = await request(app)
      .get('/api/v1/federation/agents')
      .set(createSignedHeaders('/api/v1/federation/agents', undefined, 'GET'));

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

  it('rejects signed federation agent discovery from non-trusted peers', async () => {
    federationMocks.checkTrust.mockReturnValue('pending');
    const response = await request(app)
      .get('/api/v1/federation/agents')
      .set(createSignedHeaders('/api/v1/federation/agents', undefined, 'GET'));

    expect(response.status).toBe(403);
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
